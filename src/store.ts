import { create } from 'zustand';
import { db, type Task, type Settings } from './db';

interface TaskFlowState {
  tasks: Task[];
  settings: Settings;
  isDrawerOpen: boolean;
  selectedTaskId: number | null; // For the Detail Drawer
  isShortcutsOpen: boolean;
  isOnboardingOpen: boolean;
  lastDeletedTask: Task | null;
  activeTaskId: number | null;
  currentSession: {
    taskId: number;
    startTime: Date;
    duration: number; // planned duration in min
    isPaused: boolean;
  } | null;
  setTasks: (tasks: Task[]) => void;
  setSettings: (settings: Settings) => void;
  toggleDrawer: (open?: boolean) => void;
  setSelectedTaskId: (id: number | null) => void;
  setShortcutsOpen: (open: boolean) => void;
  setOnboardingOpen: (open: boolean) => void;
  setLastDeletedTask: (task: Task | null) => void;
  setActiveTask: (id: number | null) => void;
  startSession: (taskId: number, duration: number) => void;
  endSession: () => void;
}

const defaultSettings: Settings = {
  workingHoursStart: 9,
  workingHoursEnd: 18,
  deadlineWeight: 70,
  priorityWeight: 30,
  onboardingCompleted: false,
};

export const useTaskFlowStore = create<TaskFlowState>((set) => ({
  tasks: [],
  settings: defaultSettings,
  isDrawerOpen: false,
  selectedTaskId: null,
  isShortcutsOpen: false,
  isOnboardingOpen: false,
  lastDeletedTask: null,
  activeTaskId: null,
  currentSession: null,
  setTasks: (tasks) => set({ tasks }),
  setSettings: (settings) => set({ settings }),
  toggleDrawer: (open) => set((state) => ({ isDrawerOpen: open ?? !state.isDrawerOpen })),
  setSelectedTaskId: (id) => set({ selectedTaskId: id }),
  setShortcutsOpen: (open) => set({ isShortcutsOpen: open }),
  setOnboardingOpen: (open) => set({ isOnboardingOpen: open }),
  setLastDeletedTask: (task) => set({ lastDeletedTask: task }),
  setActiveTask: (id) => set({ activeTaskId: id }),
  startSession: (taskId, duration) => set({ 
    currentSession: { taskId, startTime: new Date(), duration, isPaused: false } 
  }),
  endSession: () => set({ currentSession: null }),
}));

// Helper to calculate scheduling (Greedy Algorithm for Earliest Deadline First + Priority)
export const getTaskScore = (task: Task, settings: Settings): number => {
  const now = new Date().getTime();
  const deadlineTime = new Date(task.deadline).getTime();
  const timeToDeadline = deadlineTime - now;
  
  // Normalized components
  const priorityMap = { low: 0.2, medium: 0.4, high: 0.7, critical: 1.0 };
  const priorityScore = priorityMap[task.priority];
  
  // Deadline score: inversly proportional to time left. 
  // 1 week = min importance, 0 hours = max importance
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
  const deadlineImportance = Math.max(0, 1 - (timeToDeadline / oneWeekMs));
  
  const rawScore = (deadlineImportance * (settings.deadlineWeight / 100)) + 
                   (priorityScore * (settings.priorityWeight / 100));
                   
  return Math.min(1.0, Math.max(0, rawScore));
};

export const scheduleTasks = (tasks: Task[], settings: Settings): Task[] => {
  const incomplete = tasks.filter(t => !t.completed);
  return [...incomplete].sort((a, b) => getTaskScore(b, settings) - getTaskScore(a, settings));
};
