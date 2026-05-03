import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma';
import { z } from 'zod';

const userUpdateSchema = z.object({
  display_name: z.string().optional(),
  working_hours_start: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  working_hours_end: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  timezone: z.string().optional(),
  scoring_weight_urgency: z.number().min(0).max(1).optional(),
  scoring_weight_priority: z.number().min(0).max(1).optional(),
  scoring_weight_duration: z.number().min(0).max(1).optional(),
});

export async function userRoutes(app: FastifyInstance) {
  app.addHook('preHandler', async (req) => {
    await req.jwtVerify();
  });

  app.get('/me', async (req, reply) => {
    const userId = (req.user as any).sub;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    reply.send({ data: user });
  });

  app.patch('/me', async (req, reply) => {
    const userId = (req.user as any).sub;
    const data = userUpdateSchema.parse(req.body);

    // Validate weights sum to 1.0 if any weight is updated
    if (data.scoring_weight_urgency !== undefined || 
        data.scoring_weight_priority !== undefined || 
        data.scoring_weight_duration !== undefined) {
      
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
      data
    });

    reply.send({ data: user });
  });

  app.patch('/me/onboarding', async (req, reply) => {
    const userId = (req.user as any).sub;
    const { completed } = z.object({ completed: z.literal(true) }).parse(req.body);

    const user = await prisma.user.update({
      where: { id: userId },
      data: { onboarding_completed: completed }
    });

    reply.send({ data: user });
  });

  app.get('/me/export', async (req, reply) => {
    const userId = (req.user as any).sub;
    
    const [user, tasks, sessions, logs] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.task.findMany({ where: { user_id: userId } }),
      prisma.session.findMany({ where: { user_id: userId } }),
      prisma.actionLog.findMany({ where: { user_id: userId } }),
    ]);

    reply.send({
      data: { user, tasks, sessions, action_logs: logs }
    });
  });
}
