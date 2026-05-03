import prisma from '../lib/prisma';
import { calculateScore } from './scheduler';

/**
 * Recomputes composite_score for a task and appends a ScoreSnapshot row.
 * Returns the ScoreBreakdown, or null if the task/user could not be found.
 */
export async function updateTaskScore(taskId: string, userId: string) {
  const [task, user] = await Promise.all([
    prisma.task.findUnique({ where: { id: taskId } }),
    prisma.user.findUnique({ where: { id: userId } }),
  ]);

  if (!task || !user) return null;

  const breakdown = calculateScore(task as any, user);

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
