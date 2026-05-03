import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma';
import { sessionStartSchema } from '../schemas/sessions';
import { SessionStatus, TaskStatus, ActionType } from '@prisma/client';

export async function sessionRoutes(app: FastifyInstance) {
  app.addHook('preHandler', async (req) => {
    await req.jwtVerify();
  });

  app.post('/start', async (req, reply) => {
    const userId = (req.user as any).sub;
    const { task_id, planned_duration_minutes } = sessionStartSchema.parse(req.body);

    const activeSession = await prisma.session.findFirst({
      where: { user_id: userId, status: SessionStatus.active }
    });

    if (activeSession) {
      return reply.status(409).send({ message: 'Another session is already active' });
    }

    const session = await prisma.session.create({
      data: {
        user_id: userId,
        task_id,
        planned_duration_minutes,
        status: SessionStatus.active,
      }
    });

    await prisma.task.update({
      where: { id: task_id },
      data: { status: TaskStatus.in_progress }
    });

    await prisma.actionLog.create({
      data: {
        user_id: userId,
        task_id,
        action: ActionType.session_started,
        payload: { session_id: session.id }
      }
    });

    reply.status(201).send({ data: session });
  });

  app.post('/:id/pause', async (req, reply) => {
    const userId = (req.user as any).sub;
    const { id } = req.params as any;

    const session = await prisma.session.findFirst({
      where: { id, user_id: userId }
    });

    if (!session) return reply.status(404).send({ message: 'Session not found' });

    const pauseLog = session.pause_log as any[] || [];
    pauseLog.push({ paused_at: new Date() });

    const updated = await prisma.session.update({
      where: { id },
      data: { pause_log: pauseLog }
    });

    reply.send({ data: updated });
  });

  app.post('/:id/resume', async (req, reply) => {
    const userId = (req.user as any).sub;
    const { id } = req.params as any;

    const session = await prisma.session.findFirst({
      where: { id, user_id: userId }
    });

    if (!session) return reply.status(404).send({ message: 'Session not found' });

    const pauseLog = session.pause_log as any[] || [];
    if (pauseLog.length > 0) {
      const lastPause = pauseLog[pauseLog.length - 1];
      if (!lastPause.resumed_at) {
        lastPause.resumed_at = new Date();
      }
    }

    const updated = await prisma.session.update({
      where: { id },
      data: { pause_log: pauseLog }
    });

    reply.send({ data: updated });
  });

  app.post('/:id/end', async (req, reply) => {
    const userId = (req.user as any).sub;
    const { id } = req.params as any;

    const session = await prisma.session.findFirst({
      where: { id, user_id: userId }
    });

    if (!session) return reply.status(404).send({ message: 'Session not found' });

    const endedAt = new Date();
    const pauseLog = session.pause_log as any[] || [];
    
    // Calculate total paused time
    let totalPausedMs = 0;
    for (const p of pauseLog) {
      if (p.paused_at && p.resumed_at) {
        totalPausedMs += new Date(p.resumed_at).getTime() - new Date(p.paused_at).getTime();
      } else if (p.paused_at && !p.resumed_at) {
        totalPausedMs += endedAt.getTime() - new Date(p.paused_at).getTime();
      }
    }

    const elapsedMs = endedAt.getTime() - session.started_at.getTime();
    const actualDurationMinutes = Math.round((elapsedMs - totalPausedMs) / (1000 * 60));

    const updated = await prisma.session.update({
      where: { id },
      data: {
        ended_at: endedAt,
        actual_duration_minutes: actualDurationMinutes,
        status: SessionStatus.completed,
      }
    });

    await prisma.actionLog.create({
      data: {
        user_id: userId,
        task_id: session.task_id,
        action: ActionType.session_ended,
        payload: { session_id: session.id, actual_duration_minutes: actualDurationMinutes }
      }
    });

    reply.send({ data: updated });
  });

  app.get('/', async (req, reply) => {
    const userId = (req.user as any).sub;
    const { task_id } = req.query as any;

    const sessions = await prisma.session.findMany({
      where: {
        user_id: userId,
        ...(task_id && { task_id })
      },
      orderBy: { started_at: 'desc' }
    });

    reply.send({ data: sessions });
  });
}
