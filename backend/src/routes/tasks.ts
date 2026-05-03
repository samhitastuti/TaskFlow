import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma';
import { taskSchema, updateTaskSchema, bulkSyncSchema } from '../schemas/tasks';
import { calculateScore, generateSchedule } from '../services/scheduler';
import { TaskStatus, ActionType, Recurrence } from '@prisma/client';

async function updateTaskScore(taskId: string, userId: string) {
  const [task, user] = await Promise.all([
    prisma.task.findUnique({ where: { id: taskId } }),
    prisma.user.findUnique({ where: { id: userId } }),
  ]);

  if (!task || !user) return null;

  const breakdown = calculateScore(task as any, user as any);

  await prisma.$transaction([
    prisma.task.update({
      where: { id: taskId },
      data: { composite_score: breakdown.score },
    }),
    prisma.scoreSnapshot.create({
      data: {
        task_id: taskId,
        user_id: userId,
        score: breakdown.score,
        urgency_component: breakdown.urgency_component,
        priority_component: breakdown.priority_component,
        duration_component: breakdown.duration_component,
      },
    }),
  ]);

  return breakdown;
}

async function getUpdatedQueue(userId: string) {
  const [tasks, user] = await Promise.all([
    prisma.task.findMany({ where: { user_id: userId, deleted_at: null } }),
    prisma.user.findUnique({ where: { id: userId } }),
  ]);
  if (!user) return null;
  return generateSchedule(tasks as any, user as any);
}

function buildScoreBreakdown(task: { composite_score: number | null; priority_weight: number; deadline: Date; duration_minutes: number }, user: { scoring_weight_urgency: number; scoring_weight_priority: number; scoring_weight_duration: number }) {
  return calculateScore(task as any, user as any);
}

export async function taskRoutes(app: FastifyInstance) {
  app.addHook('preHandler', async (req) => {
    await req.jwtVerify();
  });

  // GET /tasks
  app.get('/', async (req, reply) => {
    const userId = (req.user as any).sub;
    const { status, category, sort, include_overdue, limit, cursor } = req.query as any;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return reply.status(404).send({ message: 'User not found' });

    const pageSize = Math.min(parseInt(limit) || 50, 100);

    const tasks = await prisma.task.findMany({
      where: {
        user_id: userId,
        deleted_at: null,
        ...(status && { status: { in: status.split(',') } }),
        ...(category && { category: { in: category.split(',') } }),
        ...(include_overdue === 'false' && {
          OR: [{ deadline: { gte: new Date() } }, { status: TaskStatus.completed }],
        }),
        ...(cursor && { id: { gt: cursor } }),
      },
      orderBy:
        sort === 'composite_score_desc'
          ? { composite_score: 'desc' }
          : sort === 'deadline_asc'
          ? { deadline: 'asc' }
          : { created_at: 'desc' },
      take: pageSize + 1,
    });

    const hasMore = tasks.length > pageSize;
    const page = hasMore ? tasks.slice(0, pageSize) : tasks;
    const nextCursor = hasMore ? page[page.length - 1].id : null;

    const enriched = page.map((task) => ({
      ...task,
      is_overdue: task.deadline < new Date() && task.status !== TaskStatus.completed,
      score_breakdown: buildScoreBreakdown(task, user),
    }));

    reply.send({
      data: enriched,
      meta: { cursor: nextCursor, has_more: hasMore },
    });
  });

  // POST /tasks
  app.post('/', async (req, reply) => {
    const userId = (req.user as any).sub;
    const data = taskSchema.parse(req.body);

    const task = await prisma.task.create({
      data: {
        ...data,
        user_id: userId,
        deadline: new Date(data.deadline),
      },
    });

    const breakdown = await updateTaskScore(task.id, userId);

    // Create first future recurrence instance if recurrence is set
    if (task.recurrence !== Recurrence.none) {
      const nextDeadline = new Date(task.deadline);
      if (task.recurrence === Recurrence.daily) nextDeadline.setDate(nextDeadline.getDate() + 1);
      if (task.recurrence === Recurrence.weekly) nextDeadline.setDate(nextDeadline.getDate() + 7);

      const futureTask = await prisma.task.create({
        data: {
          title: task.title,
          notes: task.notes,
          deadline: nextDeadline,
          duration_minutes: task.duration_minutes,
          priority_weight: task.priority_weight,
          category: task.category,
          user_id: userId,
          recurrence: task.recurrence,
          recurrence_parent_id: task.id,
        },
      });
      await updateTaskScore(futureTask.id, userId);
    }

    await prisma.actionLog.create({
      data: {
        user_id: userId,
        task_id: task.id,
        action: ActionType.task_created,
        payload: task as any,
      },
    });

    const updatedTask = await prisma.task.findUnique({ where: { id: task.id } });

    reply.status(201).send({
      data: {
        ...updatedTask,
        score_breakdown: breakdown,
      },
    });
  });

  // GET /tasks/:id
  app.get('/:id', async (req, reply) => {
    const userId = (req.user as any).sub;
    const { id } = req.params as any;

    const [task, user] = await Promise.all([
      prisma.task.findFirst({
        where: { id, user_id: userId },
        include: {
          scoreSnapshots: { orderBy: { snapshot_at: 'desc' }, take: 10 },
          sessions: { orderBy: { started_at: 'desc' } },
        },
      }),
      prisma.user.findUnique({ where: { id: userId } }),
    ]);

    if (!task) return reply.status(404).send({ message: 'Task not found' });
    if (!user) return reply.status(404).send({ message: 'User not found' });

    // Resolve dependency task objects
    let dependency_tasks: any[] = [];
    if (task.dependencies.length > 0) {
      dependency_tasks = await prisma.task.findMany({
        where: { id: { in: task.dependencies }, user_id: userId },
      });
    }

    reply.send({
      data: {
        ...task,
        is_overdue: task.deadline < new Date() && task.status !== TaskStatus.completed,
        score_breakdown: buildScoreBreakdown(task, user),
        score_history: task.scoreSnapshots,
        session_history: task.sessions,
        dependency_tasks,
      },
    });
  });

  // PATCH /tasks/:id
  app.patch('/:id', async (req, reply) => {
    const userId = (req.user as any).sub;
    const { id } = req.params as any;
    const data = updateTaskSchema.parse(req.body);

    const before = await prisma.task.findFirst({ where: { id, user_id: userId } });
    if (!before) return reply.status(404).send({ message: 'Task not found' });

    const task = await prisma.task.update({
      where: { id },
      data: {
        ...data,
        deadline: data.deadline ? new Date(data.deadline) : undefined,
      },
    });

    const breakdown = await updateTaskScore(id, userId);

    // Recompute scores for tasks that depend on this task
    const dependentTasks = await prisma.task.findMany({
      where: { user_id: userId, dependencies: { has: id }, deleted_at: null },
    });
    await Promise.all(dependentTasks.map((dt) => updateTaskScore(dt.id, userId)));

    await prisma.actionLog.create({
      data: {
        user_id: userId,
        task_id: id,
        action: ActionType.task_updated,
        payload: { before, after: task } as any,
      },
    });

    reply.send({ data: { ...task, score_breakdown: breakdown } });
  });

  // DELETE /tasks/:id
  app.delete('/:id', async (req, reply) => {
    const userId = (req.user as any).sub;
    const { id } = req.params as any;

    const task = await prisma.task.update({
      where: { id, user_id: userId },
      data: {
        deleted_at: new Date(),
        status: TaskStatus.archived,
      },
    });

    await prisma.actionLog.create({
      data: {
        user_id: userId,
        task_id: id,
        action: ActionType.task_deleted,
        payload: { deleted_at: task.deleted_at } as any,
      },
    });

    reply.send({ data: { id: task.id, deleted_at: task.deleted_at } });
  });

  // POST /tasks/:id/complete
  app.post('/:id/complete', async (req, reply) => {
    const userId = (req.user as any).sub;
    const { id } = req.params as any;

    const task = await prisma.task.update({
      where: { id, user_id: userId },
      data: {
        status: TaskStatus.completed,
        completed_at: new Date(),
      },
    });

    await prisma.actionLog.create({
      data: {
        user_id: userId,
        task_id: id,
        action: ActionType.task_completed,
        payload: { completed_at: task.completed_at } as any,
      },
    });

    // Handle recurrence
    let nextTask = null;
    if (task.recurrence !== Recurrence.none) {
      const nextDeadline = new Date(task.deadline);
      if (task.recurrence === Recurrence.daily) nextDeadline.setDate(nextDeadline.getDate() + 1);
      if (task.recurrence === Recurrence.weekly) nextDeadline.setDate(nextDeadline.getDate() + 7);

      nextTask = await prisma.task.create({
        data: {
          title: task.title,
          notes: task.notes,
          deadline: nextDeadline,
          duration_minutes: task.duration_minutes,
          priority_weight: task.priority_weight,
          category: task.category,
          user_id: userId,
          recurrence: task.recurrence,
          recurrence_parent_id: task.recurrence_parent_id || task.id,
        },
      });
      await updateTaskScore(nextTask.id, userId);
    }

    const updated_queue = await getUpdatedQueue(userId);

    reply.send({ data: { task, next_recurrence_task: nextTask, updated_queue } });
  });

  // POST /tasks/:id/skip
  app.post('/:id/skip', async (req, reply) => {
    const userId = (req.user as any).sub;
    const { id } = req.params as any;

    await prisma.task.update({
      where: { id, user_id: userId },
      data: { skip_count: { increment: 1 } },
    });

    const breakdown = await updateTaskScore(id, userId);
    const updatedTask = await prisma.task.findUnique({ where: { id } });

    await prisma.actionLog.create({
      data: {
        user_id: userId,
        task_id: id,
        action: ActionType.task_skipped,
        payload: { skip_count: updatedTask?.skip_count } as any,
      },
    });

    const updated_queue = await getUpdatedQueue(userId);

    reply.send({ data: { task: { ...updatedTask, score_breakdown: breakdown }, updated_queue } });
  });

  // POST /tasks/:id/restore
  app.post('/:id/restore', async (req, reply) => {
    const userId = (req.user as any).sub;
    const { id } = req.params as any;

    const task = await prisma.task.update({
      where: { id, user_id: userId },
      data: {
        deleted_at: null,
        status: TaskStatus.pending,
      },
    });

    const breakdown = await updateTaskScore(id, userId);
    const updated_queue = await getUpdatedQueue(userId);

    reply.send({ data: { task: { ...task, score_breakdown: breakdown }, updated_queue } });
  });

  // POST /tasks/bulk
  app.post('/bulk', async (req, reply) => {
    const userId = (req.user as any).sub;
    const operations = bulkSyncSchema.parse(req.body);

    const applied: string[] = [];
    const conflicts: any[] = [];

    for (const op of operations) {
      const existing = await prisma.task.findFirst({
        where: { id: op.id, user_id: userId },
      });

      if (existing && op.payload.client_updated_at) {
        const clientTime = new Date(op.payload.client_updated_at);
        if (existing.updated_at > clientTime) {
          conflicts.push({ id: op.id, server: existing, client: op.payload });
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
        applied.push(op.id);
      } else if (op.operation === 'delete') {
        if (existing) {
          await prisma.task.update({
            where: { id: op.id },
            data: { deleted_at: new Date(), status: TaskStatus.archived },
          });
          applied.push(op.id);
        }
      }
    }

    reply.send({ data: { applied, conflicts } });
  });
}
