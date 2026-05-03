import { describe, it, expect } from 'vitest';
import { generateSchedule, Task, UserPreferences } from '../../src/services/scheduler';
import { Category, TaskStatus, Recurrence } from '@prisma/client';
import { randomUUID } from 'crypto';

const CATEGORIES = [Category.work, Category.personal, Category.health, Category.learning, Category.other];
const STATUSES = [TaskStatus.pending, TaskStatus.in_progress];

function makeTasks(count: number, now: Date): Task[] {
  return Array.from({ length: count }, (_, i) => ({
    id: randomUUID(),
    title: `Task ${i + 1}`,
    deadline: new Date(now.getTime() + (1 + (i % 48)) * 60 * 60 * 1000), // 1–48 hours from now
    duration_minutes: 15 + (i % 8) * 15, // 15–120 minutes
    priority_weight: Math.round((i % 10) / 10 * 100) / 100,
    category: CATEGORIES[i % CATEGORIES.length],
    status: STATUSES[i % STATUSES.length],
    recurrence: Recurrence.none,
    dependencies: [],
    skip_count: i % 5,
    composite_score: null,
  }));
}

describe('Scheduler Benchmark', () => {
  const prefs: UserPreferences = {
    scoring_weight_urgency: 0.4,
    scoring_weight_priority: 0.4,
    scoring_weight_duration: 0.2,
    working_hours_start: '09:00',
    working_hours_end: '18:00',
    timezone: 'UTC',
  };

  it('should complete schedule computation for 500 tasks in under 100ms', () => {
    const now = new Date('2024-06-01T09:00:00Z');
    const tasks = makeTasks(500, now);

    const start = performance.now();
    const result = generateSchedule(tasks, prefs, now);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(100);
    expect(result.queue.length + result.conflicts.length).toBeGreaterThanOrEqual(0);
    expect(result.available_minutes).toBeGreaterThan(0);
  });

  it('should handle 500 tasks with dependency chains efficiently', () => {
    const now = new Date('2024-06-01T09:00:00Z');
    const tasks = makeTasks(500, now);

    // Add dependency chains: every 5th task depends on the previous
    for (let i = 5; i < tasks.length; i += 5) {
      tasks[i].dependencies = [tasks[i - 1].id];
    }

    // Mark some prerequisites as completed
    for (let i = 4; i < tasks.length; i += 5) {
      tasks[i].status = TaskStatus.completed;
    }

    const start = performance.now();
    const result = generateSchedule(tasks, prefs, now);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(100);
  });
});
