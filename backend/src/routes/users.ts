import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma';
import redis from '../lib/redis';
import { calculateScore } from '../services/scheduler';
import { z } from 'zod';
import { taskSchema } from '../schemas/tasks';

const userUpdateSchema = z.object({
  display_name: z.string().optional(),
  working_hours_start: z
    .string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .optional(),
  working_hours_end: z
    .string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .optional(),
  timezone: z.string().optional(),
  scoring_weight_urgency: z.number().min(0).max(1).optional(),
  scoring_weight_priority: z.number().min(0).max(1).optional(),
  scoring_weight_duration: z.number().min(0).max(1).optional(),
});

const importSchema = z.object({
  tasks: z.array(
    taskSchema.extend({
      id: z.string().uuid(),
      client_updated_at: z.string().datetime().optional(),
    })
  ),
});

export async function userRoutes(app: FastifyInstance) {
  app.addHook('preHandler', async (req) => {
    await req.jwtVerify();
  });

  app.get('/me', async (req, reply) => {
    const userId = (req.user as any).sub;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return reply.status(404).send({ message: 'User not found' });
    reply.send({ data: user });
  });

  app.patch('/me', async (req, reply) => {
    const userId = (req.user as any).sub;
    const data = userUpdateSchema.parse(req.body);

    // Validate weights sum to 1.0 if any weight is updated
    if (
      data.scoring_weight_urgency !== undefined ||
      data.scoring_weight_priority !== undefined ||
      data.scoring_weight_duration !== undefined
    ) {
      const currentUser = await prisma.user.findUnique({ where: { id: userId } });
      if (!currentUser) return reply.status(404).send({ message: 'User not found' });

      const wU = data.scoring_weight_urgency ?? currentUser.scoring_weight_urgency;
      const wP = data.scoring_weight_priority ?? currentUser.scoring_weight_priority;
      const wD = data.scoring_weight_duration ?? currentUser.scoring_weight_duration;

      if (Math.abs(wU + wP + wD - 1.0) > 0.001) {
        return reply.status(422).send({ message: 'Scoring weights must sum to 1.0' });
      }
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data,
    });

    // Recompute all task scores if weights changed
    if (
      data.scoring_weight_urgency !== undefined ||
      data.scoring_weight_priority !== undefined ||
      data.scoring_weight_duration !== undefined
    ) {
      const tasks = await prisma.task.findMany({
        where: { user_id: userId, deleted_at: null },
      });
      await Promise.all(
        tasks.map(async (task) => {
          const breakdown = calculateScore(task as any, user);
          await prisma.task.update({
            where: { id: task.id },
            data: { composite_score: breakdown.score },
          });
        })
      );
    }

    reply.send({ data: user });
  });

  app.patch('/me/onboarding', async (req, reply) => {
    const userId = (req.user as any).sub;
    const { completed } = z.object({ completed: z.literal(true) }).parse(req.body);

    const user = await prisma.user.update({
      where: { id: userId },
      data: { onboarding_completed: completed },
    });

    reply.send({ data: { onboarding_completed: user.onboarding_completed } });
  });

  app.get('/me/export', async (req, reply) => {
    const userId = (req.user as any).sub;

    // Rate limit: 1 request per 24 hours
    if (process.env.NODE_ENV !== 'test') {
      const rateLimitKey = `export_rate_limit:${userId}`;
      const count = await redis.incr(rateLimitKey);
      if (count === 1) {
        await redis.expire(rateLimitKey, 24 * 60 * 60);
      }
      if (count > 1) {
        return reply.status(429).send({
          type: 'https://taskflow.com/probs/rate-limited',
          title: 'Too Many Requests',
          status: 429,
          detail: 'Data export is limited to once per 24 hours.',
          instance: req.url,
        });
      }
    }

    const [user, tasks, sessions, logs] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.task.findMany({ where: { user_id: userId } }),
      prisma.session.findMany({ where: { user_id: userId } }),
      prisma.actionLog.findMany({ where: { user_id: userId } }),
    ]);

    reply.send({
      data: { user, tasks, sessions, action_logs: logs },
    });
  });

  app.post('/me/import', async (req, reply) => {
    const userId = (req.user as any).sub;
    const { tasks } = importSchema.parse(req.body);

    let imported = 0;
    let skipped = 0;
    const conflicts: any[] = [];

    for (const taskData of tasks) {
      const { id, client_updated_at, ...fields } = taskData as any;

      const existing = await prisma.task.findFirst({ where: { id, user_id: userId } });

      if (existing) {
        if (client_updated_at) {
          const clientTime = new Date(client_updated_at);
          if (existing.updated_at > clientTime) {
            conflicts.push({ id, server: existing, client: taskData });
            continue;
          }
        }
        // Server version is older or no client_updated_at — update
        await prisma.task.update({
          where: { id },
          data: { ...fields, deadline: new Date(fields.deadline) },
        });
        imported++;
      } else {
        // New task — create with preserved UUID
        await prisma.task.create({
          data: {
            ...fields,
            id,
            user_id: userId,
            deadline: new Date(fields.deadline),
          },
        });
        imported++;
      }
    }

    reply.send({ data: { imported, skipped, conflicts } });
  });
}
