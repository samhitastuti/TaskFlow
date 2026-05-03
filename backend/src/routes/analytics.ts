import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma';
import redis from '../lib/redis';
import { TaskStatus } from '@prisma/client';

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
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);

    const streakStart = new Date(now);
    streakStart.setDate(streakStart.getDate() - 365);

    const [tasksToday, tasksWeek, sessions, allTasks] = await Promise.all([
      prisma.task.count({
        where: { user_id: userId, completed_at: { gte: todayStart }, status: TaskStatus.completed },
      }),
      prisma.task.count({
        where: { user_id: userId, completed_at: { gte: weekStart }, status: TaskStatus.completed },
      }),
      prisma.session.findMany({
        where: { user_id: userId, started_at: { gte: weekStart } },
      }),
      prisma.task.findMany({
        where: { user_id: userId, status: TaskStatus.completed, completed_at: { not: null } },
        select: { completed_at: true, deadline: true, category: true },
        orderBy: { completed_at: 'desc' },
      }),
    ]);

    const avgSessionDuration =
      sessions.length > 0
        ? sessions.reduce((acc, s) => acc + (s.actual_duration_minutes || 0), 0) / sessions.length
        : 0;

    // On-time completion rate: completed before or by deadline
    const onTime = allTasks.filter(
      (t) => t.completed_at && t.deadline && t.completed_at <= t.deadline
    ).length;
    const onTimeRate = allTasks.length > 0 ? onTime / allTasks.length : 0;

    // Most productive hour: count sessions by start hour
    const hourCounts: Record<number, number> = {};
    for (const s of sessions) {
      const h = s.started_at.getHours();
      hourCounts[h] = (hourCounts[h] || 0) + 1;
    }
    const mostProductiveHour =
      Object.keys(hourCounts).length > 0
        ? parseInt(Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0][0])
        : 9;

    // Top category by completed task count this week
    const weekTasks = await prisma.task.findMany({
      where: { user_id: userId, completed_at: { gte: weekStart }, status: TaskStatus.completed },
      select: { category: true },
    });
    const catCounts: Record<string, number> = {};
    for (const t of weekTasks) {
      catCounts[t.category] = (catCounts[t.category] || 0) + 1;
    }
    const topCategory =
      Object.keys(catCounts).length > 0
        ? Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0][0]
        : 'work';

    // Current streak (consecutive days with at least one completion)
    const completionDays = new Set(
      allTasks
        .filter((t) => t.completed_at)
        .map((t) => t.completed_at!.toISOString().split('T')[0])
    );

    let streakDays = 0;
    const cursor = new Date(now);
    cursor.setHours(0, 0, 0, 0);
    while (true) {
      const dateKey = cursor.toISOString().split('T')[0];
      if (!completionDays.has(dateKey)) break;
      streakDays++;
      cursor.setDate(cursor.getDate() - 1);
    }

    const summary = {
      tasks_completed_today: tasksToday,
      tasks_completed_this_week: tasksWeek,
      average_session_duration_minutes: Math.round(avgSessionDuration),
      on_time_completion_rate: Math.round(onTimeRate * 100) / 100,
      most_productive_hour: mostProductiveHour,
      top_category: topCategory,
      current_streak_days: streakDays,
      total_time_logged_minutes: sessions.reduce(
        (acc, s) => acc + (s.actual_duration_minutes || 0),
        0
      ),
    };

    await redis.setex(cacheKey, 300, JSON.stringify(summary));
    reply.send({ data: summary });
  });

  app.get('/heatmap', async (req, reply) => {
    const userId = (req.user as any).sub;

    // 52-week window
    const since = new Date();
    since.setDate(since.getDate() - 364);

    const tasks = await prisma.task.findMany({
      where: {
        user_id: userId,
        status: TaskStatus.completed,
        completed_at: { not: null, gte: since },
      },
      select: { completed_at: true },
    });

    const counts: Record<string, number> = {};
    for (const t of tasks) {
      const day = t.completed_at!.toISOString().split('T')[0];
      counts[day] = (counts[day] || 0) + 1;
    }

    const heatmap = Object.entries(counts).map(([date, count]) => ({ date, count }));
    reply.send({ data: heatmap });
  });

  app.get('/load', async (req, reply) => {
    const userId = (req.user as any).sub;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return reply.status(404).send({ message: 'User not found' });

    const [startH, startM] = user.working_hours_start.split(':').map(Number);
    const [endH, endM] = user.working_hours_end.split(':').map(Number);
    const dailyMinutes = (endH * 60 + endM) - (startH * 60 + startM);

    const since = new Date();
    since.setDate(since.getDate() - 30);
    since.setHours(0, 0, 0, 0);

    const tasks = await prisma.task.findMany({
      where: {
        user_id: userId,
        deleted_at: null,
        created_at: { gte: since },
      },
      select: { deadline: true, duration_minutes: true, status: true, completed_at: true },
    });

    const load: Record<string, { scheduled_minutes: number; completed_minutes: number; available_minutes: number }> = {};
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const d = new Date(since);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().split('T')[0];
      load[key] = { scheduled_minutes: 0, completed_minutes: 0, available_minutes: dailyMinutes };
    }

    for (const t of tasks) {
      const deadlineDay = t.deadline.toISOString().split('T')[0];
      if (load[deadlineDay]) {
        load[deadlineDay].scheduled_minutes += t.duration_minutes;
      }
      if (t.status === TaskStatus.completed && t.completed_at) {
        const completedDay = t.completed_at.toISOString().split('T')[0];
        if (load[completedDay]) {
          load[completedDay].completed_minutes += t.duration_minutes;
        }
      }
    }

    const result = Object.entries(load).map(([date, data]) => ({
      date,
      ...data,
      load_percentage: dailyMinutes > 0 ? Math.round((data.scheduled_minutes / dailyMinutes) * 100) : 0,
    }));

    reply.send({ data: result });
  });

  app.get('/categories', async (req, reply) => {
    const userId = (req.user as any).sub;

    const tasks = await prisma.task.findMany({
      where: { user_id: userId, deleted_at: null },
      select: {
        category: true,
        status: true,
        composite_score: true,
        deadline: true,
        completed_at: true,
        sessions: {
          select: { planned_duration_minutes: true, actual_duration_minutes: true },
        },
      },
    });

    const categories: Record<string, {
      count: number;
      completed: number;
      score_sum: number;
      score_count: number;
      planned_sum: number;
      actual_sum: number;
      on_time: number;
    }> = {};

    for (const t of tasks) {
      const cat = t.category;
      if (!categories[cat]) {
        categories[cat] = { count: 0, completed: 0, score_sum: 0, score_count: 0, planned_sum: 0, actual_sum: 0, on_time: 0 };
      }
      categories[cat].count++;
      if (t.status === TaskStatus.completed) {
        categories[cat].completed++;
        if (t.completed_at && t.deadline && t.completed_at <= t.deadline) {
          categories[cat].on_time++;
        }
      }
      if (t.composite_score != null) {
        categories[cat].score_sum += t.composite_score;
        categories[cat].score_count++;
      }
      for (const s of t.sessions) {
        categories[cat].planned_sum += s.planned_duration_minutes;
        categories[cat].actual_sum += s.actual_duration_minutes || 0;
      }
    }

    const result = Object.entries(categories).map(([category, data]) => ({
      category,
      count: data.count,
      average_score: data.score_count > 0 ? Math.round((data.score_sum / data.score_count) * 1000) / 1000 : 0,
      completion_rate: data.count > 0 ? Math.round((data.completed / data.count) * 100) / 100 : 0,
      on_time_rate: data.completed > 0 ? Math.round((data.on_time / data.completed) * 100) / 100 : 0,
      average_planned_duration_minutes: data.completed > 0 ? Math.round(data.planned_sum / data.completed) : 0,
      average_actual_duration_minutes: data.completed > 0 ? Math.round(data.actual_sum / data.completed) : 0,
    }));

    reply.send({ data: result });
  });

  app.get('/score-drift', async (req, reply) => {
    const userId = (req.user as any).sub;
    const { task_id } = req.query as any;

    const snapshots = await prisma.scoreSnapshot.findMany({
      where: { user_id: userId, ...(task_id && { task_id }) },
      orderBy: { snapshot_at: 'asc' },
      take: 50,
    });

    reply.send({ data: snapshots });
  });
}
