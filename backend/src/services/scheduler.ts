import { Category, TaskStatus, Recurrence } from '@prisma/client';

export interface Task {
  id: string;
  title: string;
  deadline: Date;
  duration_minutes: number;
  priority_weight: number;
  category: Category;
  status: TaskStatus;
  dependencies: string[];
  skip_count: number;
  composite_score?: number | null;
}

export interface UserPreferences {
  scoring_weight_urgency: number;
  scoring_weight_priority: number;
  scoring_weight_duration: number;
  working_hours_start: string;
  working_hours_end: string;
  timezone: string;
}

export interface ScoreBreakdown {
  score: number;
  urgency_component: number;
  priority_component: number;
  duration_component: number;
}

export const MAX_DEADLINE_WINDOW_SECONDS = 7 * 24 * 60 * 60; // 7 days

export function calculateUrgency(deadline: Date, now: Date = new Date()): number {
  const secondsToDeadline = (deadline.getTime() - now.getTime()) / 1000;
  return Math.max(0, Math.min(1, 1 - (secondsToDeadline / MAX_DEADLINE_WINDOW_SECONDS)));
}

export function calculateScore(task: Task, prefs: UserPreferences, now: Date = new Date()): ScoreBreakdown {
  const urgency = calculateUrgency(task.deadline, now);
  const durationScore = 15 / Math.max(15, task.duration_minutes); // Normalize by min duration 15m
  
  const urgencyComp = urgency * prefs.scoring_weight_urgency;
  const priorityComp = task.priority_weight * prefs.scoring_weight_priority;
  const durationComp = durationScore * prefs.scoring_weight_duration;
  
  // Penalty for skips: subtract 0.05 * skip_count
  const skipPenalty = 0.05 * task.skip_count;
  
  let totalScore = urgencyComp + priorityComp + durationComp - skipPenalty;
  totalScore = Math.max(0, totalScore);

  return {
    score: totalScore,
    urgency_component: urgencyComp,
    priority_component: priorityComp,
    duration_component: durationComp,
  };
}

export interface ScheduleResult {
  queue: Task[];
  conflicts: Task[];
  total_duration_minutes: number;
  available_minutes: number;
  load_percentage: number;
}

export function generateSchedule(
  tasks: Task[],
  prefs: UserPreferences,
  now: Date = new Date()
): ScheduleResult {
  // 1. Filter candidates (pending/in_progress)
  let candidates = tasks.filter(t => 
    t.status === TaskStatus.pending || t.status === TaskStatus.in_progress
  );

  // 2. Compute scores
  const tasksWithScores = candidates.map(t => ({
    ...t,
    _tempScore: calculateScore(t, prefs, now).score
  }));

  // 3. Sort by score descending
  tasksWithScores.sort((a, b) => b._tempScore - a._tempScore);

  // 4. Handle dependencies (Greedy)
  const completedTaskIds = new Set(tasks.filter(t => t.status === TaskStatus.completed).map(t => t.id));
  const queue: Task[] = [];
  const conflicts: Task[] = [];
  
  // Calculate working hours available for today
  const [startH, startM] = prefs.working_hours_start.split(':').map(Number);
  const [endH, endM] = prefs.working_hours_end.split(':').map(Number);
  
  const dayStart = new Date(now);
  dayStart.setUTCHours(startH, startM, 0, 0);
  
  const dayEnd = new Date(now);
  dayEnd.setUTCHours(endH, endM, 0, 0);
  
  let availableMinutes = Math.max(0, (dayEnd.getTime() - Math.max(now.getTime(), dayStart.getTime())) / (1000 * 60));
  let currentMinutes = 0;
  let totalDurationMinutes = 0;

  for (const task of tasksWithScores) {
    // Check dependencies
    const depsMet = task.dependencies.every(depId => completedTaskIds.has(depId));
    
    if (!depsMet) continue;

    if (currentMinutes + task.duration_minutes <= availableMinutes) {
      queue.push(task);
      currentMinutes += task.duration_minutes;
      totalDurationMinutes += task.duration_minutes;
    } else {
      // Conflict: Cannot fit today and deadline is before or shortly after today's end
      const buffer = 60; // 1 hour buffer
      const cutoff = new Date(dayEnd.getTime() + buffer * 60000);
      if (task.deadline <= cutoff) {
        conflicts.push(task);
      }
    }
  }

  return {
    queue,
    conflicts,
    total_duration_minutes: totalDurationMinutes,
    available_minutes: availableMinutes,
    load_percentage: availableMinutes > 0 ? (totalDurationMinutes / availableMinutes) * 100 : 0
  };
}
