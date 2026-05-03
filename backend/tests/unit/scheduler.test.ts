import { describe, it, expect } from 'vitest';
import { generateSchedule, Task, UserPreferences } from '../../src/services/scheduler';
import { Category, TaskStatus } from '@prisma/client';

describe('Scheduling Engine', () => {
  const prefs: UserPreferences = {
    scoring_weight_urgency: 0.4,
    scoring_weight_priority: 0.4,
    scoring_weight_duration: 0.2,
    working_hours_start: '09:00',
    working_hours_end: '18:00',
    timezone: 'UTC'
  };

  const now = new Date('2024-01-01T10:00:00Z');

  it('should sort tasks by composite score', () => {
    const tasks: Task[] = [
      {
        id: '1',
        title: 'Low Priority',
        deadline: new Date('2024-01-07T10:00:00Z'),
        duration_minutes: 60,
        priority_weight: 0.1,
        category: Category.work,
        status: TaskStatus.pending,
        dependencies: [],
        skip_count: 0
      },
      {
        id: '2',
        title: 'High Priority Urgent',
        deadline: new Date('2024-01-01T12:00:00Z'),
        duration_minutes: 30,
        priority_weight: 0.9,
        category: Category.work,
        status: TaskStatus.pending,
        dependencies: [],
        skip_count: 0
      }
    ];

    const result = generateSchedule(tasks, prefs, now);
    expect(result.queue[0].id).toBe('2');
    expect(result.queue[1].id).toBe('1');
  });

  it('should respect working hours', () => {
    const tasks: Task[] = [
      {
        id: '1',
        title: 'Long Task',
        deadline: new Date('2024-01-01T18:30:00Z'), // 6:30 PM, within conflict buffer
        duration_minutes: 600, // 10 hours, won't fit in remaining 8 hours
        priority_weight: 0.5,
        category: Category.work,
        status: TaskStatus.pending,
        dependencies: [],
        skip_count: 0
      }
    ];

    const result = generateSchedule(tasks, prefs, now);
    expect(result.queue).toHaveLength(0);
    expect(result.conflicts).toHaveLength(1);
  });
});
