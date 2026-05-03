import { z } from 'zod';
import { Category, TaskStatus, Recurrence } from '@prisma/client';

export const taskSchema = z.object({
  title: z.string().max(120),
  notes: z.string().optional().nullable(),
  deadline: z.string().datetime(),
  duration_minutes: z.number().min(15),
  priority_weight: z.number().min(0).max(1),
  category: z.nativeEnum(Category),
  status: z.nativeEnum(TaskStatus).default(TaskStatus.pending),
  recurrence: z.nativeEnum(Recurrence).default(Recurrence.none),
  dependencies: z.array(z.string().uuid()).optional(),
  client_updated_at: z.string().datetime().optional(),
});

export const updateTaskSchema = taskSchema.partial();

export const bulkSyncSchema = z.array(z.object({
  operation: z.enum(['create', 'update', 'delete']),
  id: z.string().uuid(),
  payload: updateTaskSchema,
}));

export type TaskInput = z.infer<typeof taskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type BulkSyncInput = z.infer<typeof bulkSyncSchema>;
