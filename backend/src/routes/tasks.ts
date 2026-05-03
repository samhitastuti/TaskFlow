import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma';
import { taskSchema, updateTaskSchema, bulkSyncSchema } from '../schemas/tasks';
import { calculateScore } from '../services/scheduler';
import { TaskStatus, ActionType } from '@prisma/client';

async function updateTaskScore(taskId: string, userId: string) {
  const [task, user] = await Promise.all([
    prisma.task.findUnique({ where: { id: taskId } }),
    prisma.user.findUnique({ where: { id: userId } })
  ]);

  if (!task || !user) return;

  const breakdown = calculateScore(task as any, user as any);
  
  await prisma.$transaction([
    prisma.task.update({
      where: { id: taskId },
      data: { composite_score: breakdown.score }
    }),
    prisma.scoreSnapshot.create({
      data: {
        task_id: taskId,
        user_id: userId,
        score: breakdown.score,
        urgency_component: breakdown.urgency_component,
        priority_component: breakdown.priority_component,
        duration_component: breakdown.duration_component,
      }
    })
  ]);
}

export async function taskRoutes(app: FastifyInstance) {
  app.addHook('preHandler', async (req) => {
    await req.jwtVerify();
  });

  app.get('/', async (req, reply) => {
    const userId = (req.user as any).sub;
    const { status, category, sort } = req.query as any;

    const tasks = await prisma.task.findMany({
      where: {
        user_id: userId,
        deleted_at: null,
        ...(status && { status: { in: status.split(',') } }),
        ...(category && { category: { in: category.split(',') } }),
      },
      orderBy: sort === 'composite_score_desc' ? { composite_score: 'desc' } : 
               sort === 'deadline_asc' ? { deadline: 'asc' } : 
               { created_at: 'desc' }
    });

    reply.send({ data: tasks });
  });

  app.post('/', async (req, reply) => {
    const userId = (req.user as any).sub;
    const data = taskSchema.parse(req.body);

    const task = await prisma.task.create({
      data: {
        ...data,
        user_id: userId,
        deadline: new Date(data.deadline),
      }
    });

    await updateTaskScore(task.id, userId);
    
    await prisma.actionLog.create({
      data: {
        user_id: userId,
        task_id: task.id,
        action: ActionType.task_created,
        payload: task as any,
      }
    });

    const updatedTask = await prisma.task.findUnique({
      where: { id: task.id },
      include: { scoreSnapshots: { orderBy: { snapshot_at: 'desc' }, take: 1 } }
    });

    reply.status(201).send({ data: updatedTask });
  });

  app.get('/:id', async (req, reply) => {
    const userId = (req.user as any).sub;
    const { id } = req.params as any;

    const task = await prisma.task.findFirst({
      where: { id, user_id: userId },
      include: {
        scoreSnapshots: { orderBy: { snapshot_at: 'desc' }, take: 10 },
        sessions: true,
      }
    });

    if (!task) return reply.status(404).send({ message: 'Task not found' });

    reply.send({ data: task });
  });

  app.patch('/:id', async (req, reply) => {
    const userId = (req.user as any).sub;
    const { id } = req.params as any;
    const data = updateTaskSchema.parse(req.body);

    const task = await prisma.task.update({
      where: { id, user_id: userId },
      data: {
        ...data,
        deadline: data.deadline ? new Date(data.deadline) : undefined,
      }
    });

    await updateTaskScore(id, userId);

    reply.send({ data: task });
  });

  app.delete('/:id', async (req, reply) => {
    const userId = (req.user as any).sub;
    const { id } = req.params as any;

    const task = await prisma.task.update({
      where: { id, user_id: userId },
      data: {
        deleted_at: new Date(),
        status: TaskStatus.archived,
      }
    });

    reply.send({ data: { id: task.id, deleted_at: task.deleted_at } });
  });

  app.post('/:id/complete', async (req, reply) => {
    const userId = (req.user as any).sub;
    const { id } = req.params as any;

    const task = await prisma.task.update({
      where: { id, user_id: userId },
      data: {
        status: TaskStatus.completed,
        completed_at: new Date(),
      }
    });

    // Handle recurrence
    let nextTask = null;
    if (task.recurrence !== 'none') {
      const nextDeadline = new Date(task.deadline);
      if (task.recurrence === 'daily') nextDeadline.setDate(nextDeadline.getDate() + 1);
      if (task.recurrence === 'weekly') nextDeadline.setDate(nextDeadline.getDate() + 7);

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
        }
      });
      await updateTaskScore(nextTask.id, userId);
    }

    reply.send({ data: { task, next_recurrence_task: nextTask } });
  });

  app.post('/:id/skip', async (req, reply) => {
    const userId = (req.user as any).sub;
    const { id } = req.params as any;

    const task = await prisma.task.update({
      where: { id, user_id: userId },
      data: {
        skip_count: { increment: 1 }
      }
    });

    await updateTaskScore(id, userId);
    const updatedTask = await prisma.task.findUnique({ where: { id } });

    reply.send({ data: updatedTask });
  });
}
