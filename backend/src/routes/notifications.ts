import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma';
import { z } from 'zod';

const prefSchema = z.object({
  deadline_warning_minutes: z.number().int().min(1),
  session_overrun_minutes: z.number().int().min(1),
  daily_summary_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  enabled: z.boolean(),
});

export async function notificationRoutes(app: FastifyInstance) {
  app.addHook('preHandler', async (req) => {
    await req.jwtVerify();
  });

  app.post('/preferences', async (req, reply) => {
    const userId = (req.user as any).sub;
    const prefs = prefSchema.parse(req.body);

    const user = await prisma.user.update({
      where: { id: userId },
      data: { notification_preferences: prefs as any },
    });

    reply.send({ data: user.notification_preferences });
  });

  app.get('/pending', async (req, reply) => {
    const userId = (req.user as any).sub;
    const notifications = await prisma.notification.findMany({
      where: { user_id: userId, sent_at: { not: null }, dismissed_at: null },
      orderBy: { scheduled_for: 'asc' },
    });
    reply.send({ data: notifications });
  });

  app.post('/:id/dismiss', async (req, reply) => {
    const userId = (req.user as any).sub;
    const { id } = req.params as any;

    const notification = await prisma.notification.findFirst({
      where: { id, user_id: userId },
    });

    if (!notification) return reply.status(404).send({ message: 'Notification not found' });

    await prisma.notification.update({
      where: { id },
      data: { dismissed_at: new Date() },
    });

    reply.send({ success: true });
  });
}
