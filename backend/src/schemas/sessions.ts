import { z } from 'zod';

export const sessionStartSchema = z.object({
  task_id: z.string().uuid(),
  planned_duration_minutes: z.number().min(15),
});

export type SessionStartInput = z.infer<typeof sessionStartSchema>;
