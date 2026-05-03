import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma';
import redis from '../lib/redis';
import { bulkSyncSchema } from '../schemas/tasks';
import { TaskStatus } from '@prisma/client';
import { updateTaskScore } from '../services/scoring';

export async function syncRoutes(app: FastifyInstance) {
  app.addHook('preHandler', async (req) => {
    await req.jwtVerify();
  });

  app.post('/push', async (req, reply) => {
    const userId = (req.user as any).sub;
    const operations = bulkSyncSchema.parse(req.body);

    const results = { applied: 0, conflicts: [] as any[] };

    for (const op of operations) {
      const existing = await prisma.task.findFirst({ where: { id: op.id, user_id: userId } });

      if (existing && op.payload.client_updated_at) {
        const clientTime = new Date(op.payload.client_updated_at);
        if (existing.updated_at > clientTime) {
          results.conflicts.push({ id: op.id, server: existing, client: op.payload });
          continue;
        }
      }

      if (op.operation === 'create' || op.operation === 'update') {
        await prisma.task.upsert({
          where: { id: op.id },
          create: {
            ...(op.payload as any),
            id: op.id,
            user_id: userId,
            deadline: new Date(op.payload.deadline!),
          },
          update: {
            ...(op.payload as any),
            deadline: op.payload.deadline ? new Date(op.payload.deadline) : undefined,
          },
        });
        await updateTaskScore(op.id, userId);
        results.applied++;
      } else if (op.operation === 'delete') {
        if (existing) {
          await prisma.task.update({
            where: { id: op.id },
            data: { deleted_at: new Date(), status: TaskStatus.archived },
          });
          results.applied++;
        }
      }
    }

    // Update last sync timestamp
    await redis.set(`sync:last_sync:${userId}`, new Date().toISOString());

    reply.send({ data: results });
  });

  app.get('/pull', async (req, reply) => {
    const userId = (req.user as any).sub;
    const { since } = req.query as any;

    const tasks = await prisma.task.findMany({
      where: {
        user_id: userId,
        updated_at: { gte: since ? new Date(since) : new Date(0) },
      },
    });

    const serverClock = new Date();
    await redis.set(`sync:last_sync:${userId}`, serverClock.toISOString());

    reply.send({ data: tasks, meta: { server_clock: serverClock } });
  });

  app.get('/status', async (req, reply) => {
    const userId = (req.user as any).sub;

    const [lastSyncRaw, serverClock] = await Promise.all([
      redis.get(`sync:last_sync:${userId}`),
      Promise.resolve(new Date()),
    ]);

    // Count tasks that were updated more recently than last sync (proxy for pending conflicts)
    const lastSyncAt = lastSyncRaw ? new Date(lastSyncRaw) : null;
    const pendingConflictsCount = lastSyncAt
      ? await prisma.task.count({
          where: {
            user_id: userId,
            updated_at: { gt: lastSyncAt },
            client_updated_at: { not: null },
          },
        })
      : 0;

    reply.send({
      data: {
        last_sync_at: lastSyncAt,
        pending_conflicts_count: pendingConflictsCount,
        server_clock: serverClock,
      },
    });
  });
}
