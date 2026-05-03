import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma';
import { bulkSyncSchema } from '../schemas/tasks';

export async function syncRoutes(app: FastifyInstance) {
  app.addHook('preHandler', async (req) => {
    await req.jwtVerify();
  });

  app.post('/push', async (req, reply) => {
    const userId = (req.user as any).sub;
    const operations = bulkSyncSchema.parse(req.body);

    const results = { applied: 0, conflicts: [] as any[] };

    for (const op of operations) {
      const existing = await prisma.task.findUnique({ where: { id: op.id } });

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
          create: { ...op.payload as any, id: op.id, user_id: userId, deadline: new Date(op.payload.deadline!) },
          update: { ...op.payload as any, deadline: op.payload.deadline ? new Date(op.payload.deadline) : undefined }
        });
        results.applied++;
      } else if (op.operation === 'delete') {
        await prisma.task.update({
          where: { id: op.id },
          data: { deleted_at: new Date() }
        });
        results.applied++;
      }
    }

    reply.send({ data: results });
  });

  app.get('/pull', async (req, reply) => {
    const userId = (req.user as any).sub;
    const { since } = req.query as any;

    const tasks = await prisma.task.findMany({
      where: {
        user_id: userId,
        updated_at: { gte: since ? new Date(since) : new Date(0) }
      }
    });

    reply.send({ data: tasks, meta: { server_clock: new Date() } });
  });

  app.get('/status', async (req, reply) => {
    reply.send({ data: { server_clock: new Date() } });
  });
}
