import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma';
import { z } from 'zod';

const prefSchema = z.object({
  deadline_warning_minutes: z.number().int(),
  session_overrun_minutes: z.number().int(),
  daily_summary_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  enabled: z.boolean(),
});

export async function notificationRoutes(app: FastifyInstance) {
  app.addHook('preHandler', async (req) => {
    await req.jwtVerify();
  });

  app.get('/pending', async (req, reply) => {
    const userId = (req.user as any).sub;
    const notifications = await prisma.notification.findMany({
      where: { user_id: userId, sent_at: { not: null }, dismissed_at: null }
    });
    reply.send({ data: notifications });
  });

  app.post('/:id/dismiss', async (req, reply) => {
    const userId = (req.user as any).sub;
    const { id } = req.params as any;

    await prisma.notification.update({
      where: { id, user_id: userId },
      data: { dismissed_at: new Date() }
    });

    reply.send({ success: true });
  });
}
