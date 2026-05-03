import { describe, it, expect } from 'vitest';
import { generateSchedule, calculateScore, Task, UserPreferences } from '../../src/services/scheduler';
import { Category, TaskStatus, Recurrence } from '@prisma/client';

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
        recurrence: Recurrence.none,
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
        recurrence: Recurrence.none,
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
        recurrence: Recurrence.none,
        dependencies: [],
        skip_count: 0
      }
    ];

    const result = generateSchedule(tasks, prefs, now);
    expect(result.queue).toHaveLength(0);
    expect(result.conflicts).toHaveLength(1);
  });

  it('should apply skip penalty to composite score', () => {
    const task: Task = {
      id: '1',
      title: 'Skipped Task',
      deadline: new Date('2024-01-03T10:00:00Z'),
      duration_minutes: 30,
      priority_weight: 0.5,
      category: Category.work,
      status: TaskStatus.pending,
      recurrence: Recurrence.none,
      dependencies: [],
      skip_count: 0
    };

    const skippedTask: Task = { ...task, id: '2', skip_count: 3 };

    const scoreNoSkip = calculateScore(task, prefs, now).score;
    const scoreWithSkip = calculateScore(skippedTask, prefs, now).score;

    expect(scoreNoSkip).toBeGreaterThan(scoreWithSkip);
    // 3 skips = 0.15 penalty
    expect(scoreNoSkip - scoreWithSkip).toBeCloseTo(0.15, 5);
  });

  it('should exclude tasks with unmet dependencies', () => {
    const depId = 'dep-1';
    const tasks: Task[] = [
      {
        id: depId,
        title: 'Prerequisite',
        deadline: new Date('2024-01-01T17:00:00Z'),
        duration_minutes: 30,
        priority_weight: 0.5,
        category: Category.work,
        status: TaskStatus.pending,
        recurrence: Recurrence.none,
        dependencies: [],
        skip_count: 0
      },
      {
        id: 'blocked-1',
        title: 'Blocked Task',
        deadline: new Date('2024-01-01T17:30:00Z'),
        duration_minutes: 30,
        priority_weight: 0.9,
        category: Category.work,
        status: TaskStatus.pending,
        recurrence: Recurrence.none,
        dependencies: [depId],
        skip_count: 0
      }
    ];

    const result = generateSchedule(tasks, prefs, now);
    const queueIds = result.queue.map(t => t.id);
    expect(queueIds).not.toContain('blocked-1');
    expect(queueIds).toContain(depId);
  });

  it('should compute load_percentage correctly', () => {
    // 1 hour available from 10:00 to 18:00 = 480 minutes. Fill with 240 minutes.
    const tasks: Task[] = Array.from({ length: 4 }, (_, i) => ({
      id: `${i}`,
      title: `Task ${i}`,
      deadline: new Date('2024-01-01T17:59:00Z'),
      duration_minutes: 60,
      priority_weight: 0.5,
      category: Category.work,
      status: TaskStatus.pending,
      recurrence: Recurrence.none,
      dependencies: [],
      skip_count: 0
    }));

    const result = generateSchedule(tasks, prefs, now);
    expect(result.load_percentage).toBeGreaterThan(0);
    expect(result.available_minutes).toBe(480);
  });
});
