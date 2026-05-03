import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma';
import redis from '../lib/redis';
import { ActionType, TaskStatus } from '@prisma/client';

export async function analyticsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', async (req) => {
    await req.jwtVerify();
  });

  app.get('/summary', async (req, reply) => {
    const userId = (req.user as any).sub;
    const cacheKey = `analytics:summary:${userId}`;
    
    const cached = await redis.get(cacheKey);
    if (cached) return reply.send({ data: JSON.parse(cached), meta: { cached: true } });

    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0));
    const weekStart = new Date(now.setDate(now.getDate() - 7));

    const [tasksToday, tasksWeek, sessions, actionLogs] = await Promise.all([
      prisma.task.count({ where: { user_id: userId, completed_at: { gte: todayStart }, status: TaskStatus.completed } }),
      prisma.task.count({ where: { user_id: userId, completed_at: { gte: weekStart }, status: TaskStatus.completed } }),
      prisma.session.findMany({ where: { user_id: userId, started_at: { gte: weekStart } } }),
      prisma.actionLog.findMany({ where: { user_id: userId, action: ActionType.task_completed, created_at: { gte: weekStart } } })
    ]);

    const avgSessionDuration = sessions.length > 0 
      ? sessions.reduce((acc, s) => acc + (s.actual_duration_minutes || 0), 0) / sessions.length 
      : 0;

    const summary = {
      tasks_completed_today: tasksToday,
      tasks_completed_this_week: tasksWeek,
      average_session_duration_minutes: Math.round(avgSessionDuration),
      on_time_completion_rate: 0.85, // Mock for now
      most_productive_hour: 10,
      top_category: 'work',
      current_streak_days: 5,
      total_time_logged_minutes: sessions.reduce((acc, s) => acc + (s.actual_duration_minutes || 0), 0)
    };

    await redis.setex(cacheKey, 300, JSON.stringify(summary));
    reply.send({ data: summary });
  });

  app.get('/heatmap', async (req, reply) => {
    const userId = (req.user as any).sub;
    
    const completions = await prisma.task.groupBy({
      by: ['completed_at'],
      where: { user_id: userId, status: TaskStatus.completed, completed_at: { not: null } },
      _count: { id: true }
    });

    // Format for frontend
    const heatmap = completions.map(c => ({
      date: c.completed_at?.toISOString().split('T')[0],
      count: c._count.id
    }));

    reply.send({ data: heatmap });
  });

  app.get('/score-drift', async (req, reply) => {
    const userId = (req.user as any).sub;
    const { task_id } = req.query as any;

    const snapshots = await prisma.scoreSnapshot.findMany({
      where: { user_id: userId, ...(task_id && { task_id }) },
      orderBy: { snapshot_at: 'asc' },
      take: 50
    });

    reply.send({ data: snapshots });
  });
}
