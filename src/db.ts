import Dexie, { type Table } from 'dexie';

export interface Task {
  id?: number;
  title: string;
  duration: number; // in minutes
  deadline: Date;
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  notes?: string;
  completed: boolean;
  completedAt?: Date;
  scheduledTime?: Date;
  createdAt: Date;
  manualOrder?: number;
  scheduled?: boolean;
  repeat?: 'never' | 'daily' | 'weekly';
}

export interface SessionLog {
  id?: number;
  taskId: number;
  taskTitle: string;
  startTime: Date;
  endTime: Date;
  plannedDuration: number; // in minutes
  actualDuration: number; // in milliseconds
}

export interface Settings {
  id?: number;
  workingHoursStart: number; // 0-24
  workingHoursEnd: number; // 0-24
  deadlineWeight: number; // 0-100
  priorityWeight: number; // 0-100
  onboardingCompleted: boolean;
}

export class TaskFlowDB extends Dexie {
  tasks!: Table<Task>;
  settings!: Table<Settings>;
  sessionLogs!: Table<SessionLog>;

  constructor() {
    super('TaskFlowDB');
    this.version(2).stores({
      tasks: '++id, title, deadline, priority, category, completed, scheduledTime',
      settings: '++id',
      sessionLogs: '++id, taskId, startTime'
    });
  }
}

export const db = new TaskFlowDB();
