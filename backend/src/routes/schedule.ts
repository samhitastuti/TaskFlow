import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma';
import { generateSchedule } from '../services/scheduler';

export async function scheduleRoutes(app: FastifyInstance) {
  app.addHook('preHandler', async (req) => {
    await req.jwtVerify();
  });

  app.get('/today', async (req, reply) => {
    const userId = (req.user as any).sub;
    
    const [tasks, user] = await Promise.all([
      prisma.task.findMany({ where: { user_id: userId, deleted_at: null } }),
      prisma.user.findUnique({ where: { id: userId } })
    ]);

    if (!user) return reply.status(404).send({ message: 'User not found' });

    const result = generateSchedule(tasks as any, user as any);
    reply.send({ data: result });
  });

  app.post('/recompute', async (req, reply) => {
    const userId = (req.user as any).sub;
    
    const [tasks, user] = await Promise.all([
      prisma.task.findMany({ where: { user_id: userId, deleted_at: null } }),
      prisma.user.findUnique({ where: { id: userId } })
    ]);

    if (!user) return reply.status(404).send({ message: 'User not found' });

    const result = generateSchedule(tasks as any, user as any);
    reply.send({ data: result });
  });

  app.get('/conflicts', async (req, reply) => {
    const userId = (req.user as any).sub;
    
    const [tasks, user] = await Promise.all([
      prisma.task.findMany({ where: { user_id: userId, deleted_at: null } }),
      prisma.user.findUnique({ where: { id: userId } })
    ]);

    if (!user) return reply.status(404).send({ message: 'User not found' });

    const result = generateSchedule(tasks as any, user as any);
    reply.send({ data: { conflicts: result.conflicts } });
  });
}
