import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion, AnimatePresence } from 'motion/react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Slider from '@radix-ui/react-slider';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { 
  Plus, 
  Check, 
  X, 
  Trash, 
  Clock, 
  Warning, 
  DotsThreeVertical, 
  Calendar,
  Hourglass,
  Layout,
  Archive,
  Gear,
  ArrowCounterClockwise,
  Play,
  MagicWand,
  Notebook,
  Tag,
  Question,
  Keyboard,
  FileArrowDown,
  FileArrowUp,
  ChartBar,
  Bell
} from '@phosphor-icons/react';
import { db, type Task, type SessionLog } from './db';
import { useTaskFlowStore, scheduleTasks, getTaskScore } from './store';
import { cn } from './lib/utils';
import { TaskDetailDrawer } from './components/TaskDetailDrawer';
import { ConflictBanner } from './components/ConflictBanner';
import { OnboardingOverlay } from './components/OnboardingOverlay';
import { ShortcutMap } from './components/ShortcutMap';
import { UndoToast } from './components/UndoToast';
import { ScoreExplainer } from './components/ScoreExplainer';

// --- Components ---

const Navbar = ({ activeTab, setTab, onNewTask, currentSession, sessionTask }: { 
  activeTab: string, 
  setTab: (t: string) => void, 
  onNewTask: () => void,
  currentSession: any,
  sessionTask?: Task
}) => {
  const tabs = [
    { id: 'today', label: 'Today' },
    { id: 'backlog', label: 'Backlog' },
    { id: 'analytics', label: 'Analytics' },
  ];

  return (
    <nav className="h-[52px] bg-deep-space border-b border-chinese-blue flex items-center justify-between px-6 fixed top-0 w-full z-50">
      <div className="flex items-center gap-8">
        <h1 className="text-xl tracking-tighter text-desert-sand font-display">TASKFLOW</h1>
        <div className="hidden md:flex items-center gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              className={cn(
                "px-4 py-1.5 rounded-full text-xs font-serif transition-colors",
                activeTab === tab.id 
                  ? "bg-chinese-blue/60 text-desert-sand font-bold" 
                  : "text-ceil hover:text-desert-sand"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {currentSession && sessionTask && (
        <div className="hidden lg:flex items-center gap-2 bg-antique-ruby/10 border border-antique-ruby/20 px-3 py-1 rounded-full animate-ruby-glow">
          <div className="w-2 h-2 bg-antique-ruby rounded-full animate-pulse" />
          <span className="text-[10px] text-antique-ruby font-bold uppercase truncate max-w-[150px]">{sessionTask.title}</span>
        </div>
      )}

      <div className="flex items-center gap-6">
        <span className="hidden sm:block text-[10px] text-ceil opacity-60">
          {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
        </span>
        <button 
          onClick={onNewTask}
          className="bg-antique-ruby text-desert-sand px-4 py-1.5 rounded-md text-xs font-bold transition-all hover:scale-105"
        >
          + New Task
        </button>
      </div>
    </nav>
  );
};

const Sidebar = ({ 
  activeView, 
  setView, 
  counts, 
  activeCategory, 
  setActiveCategory,
  activeFilters,
  toggleFilter
}: { 
  activeView: string, 
  setView: (v: string) => void, 
  counts: Record<string, number>,
  activeCategory: string | null,
  setActiveCategory: (c: string | null) => void,
  activeFilters: string[],
  toggleFilter: (f: string) => void
}) => {
  const pages = [
    { id: 'today', label: 'Today', icon: Layout },
    { id: 'backlog', label: 'Backlog', icon: Archive, count: counts.backlog },
    { id: 'analytics', label: 'Analytics', icon: ChartBar },
    { id: 'settings', label: 'Settings', icon: Gear },
  ];

  const categories = [
    { id: 'Work', label: 'Work', count: counts.work },
    { id: 'Personal', label: 'Personal', count: counts.personal },
    { id: 'Health', label: 'Health', count: counts.health },
    { id: 'Learning', label: 'Learning', count: counts.learning },
  ];

  const filters = [
    { id: 'high-priority', label: 'High Priority' },
    { id: 'due-today', label: 'Due Today' },
    { id: 'overdue-only', label: 'Overdue only' },
  ];

  return (
    <aside className="hidden lg:flex w-[220px] flex-col bg-deep-space border-r border-chinese-blue min-h-screen fixed top-[52px] left-0 z-40 overflow-y-auto pb-20">
      <div className="p-6 border-b border-chinese-blue/20">
        <h1 className="text-2xl tracking-tighter text-pearly-purple font-display">TASKFLOW</h1>
        <p className="text-[10px] text-ceil opacity-40 uppercase tracking-widest mt-1">Flow Controller</p>
      </div>
      <div className="p-4 space-y-8">
        <div className="space-y-1">
          {pages.map((page) => (
            <button
              key={page.id}
              onClick={() => { setView(page.id); }}
              className={cn(
                "w-full flex items-center justify-between px-2 py-2.5 text-[13px] transition-all relative border-l-[3px]",
                activeView === page.id 
                  ? "text-desert-sand bg-chinese-blue/20 border-antique-ruby" 
                  : "text-ceil hover:text-desert-sand hover:bg-white/5 border-transparent"
              )}
            >
              <div className="flex items-center gap-3">
                <page.icon size={16} weight={activeView === page.id ? "fill" : "regular"} />
                <span>{page.label}</span>
              </div>
              {page.count !== undefined && page.count > 0 && (
                <span className="text-[10px] opacity-40">[{page.count}]</span>
              )}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          <h3 className="text-[10px] text-pearly-purple tracking-[0.2em] font-bold px-2 uppercase">Filter by Category</h3>
          <div className="space-y-1">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => { setActiveCategory(activeCategory === cat.id ? null : cat.id); setView('today'); }}
                className={cn(
                  "w-full flex items-center justify-between px-2 py-1.5 text-[12px] transition-all relative",
                  activeCategory === cat.id 
                    ? "text-desert-sand font-bold" 
                    : "text-ceil hover:text-desert-sand"
                )}
              >
                <span>{cat.label}</span>
                {cat.count > 0 && <span className="text-[10px] opacity-40">[{cat.count}]</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-[10px] text-pearly-purple tracking-[0.2em] font-bold px-2 uppercase">Quick Filters</h3>
          <div className="space-y-1">
            {filters.map((f) => (
              <button
                key={f.id}
                onClick={() => { toggleFilter(f.id); setView('today'); }}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 text-[12px] transition-all relative",
                  activeFilters.includes(f.id) 
                    ? "text-desert-sand font-bold" 
                    : "text-ceil hover:text-desert-sand"
                )}
              >
                <div className={cn(
                  "w-2 h-2 rounded-full border border-ceil/30 transition-all",
                  activeFilters.includes(f.id) ? "bg-antique-ruby border-antique-ruby shadow-[0_0_8px_rgba(133,39,54,0.4)]" : "bg-transparent"
                )} />
                <span>{f.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
};

interface TaskCardDetailedProps {
  task: Task;
  onComplete: (id: number) => void;
  onStart?: (t: Task) => void;
  onDelete?: (id: number) => void;
  onEdit?: (id: number) => void;
  isSessionActive?: boolean;
  isCompleting?: boolean;
}

const TaskCardDetailed: React.FC<TaskCardDetailedProps> = ({ 
  task, 
  onComplete, 
  onStart, 
  onDelete, 
  onEdit, 
  isSessionActive = false,
  isCompleting = false
}) => {
  const setSelectedTaskId = useTaskFlowStore(state => state.setSelectedTaskId);
  const settings = useTaskFlowStore(state => state.settings);
  const score = getTaskScore(task, settings);
  const isOverdue = new Date(task.deadline) < new Date() && !task.completed;
  const now = new Date();
  const diffHours = (new Date(task.deadline).getTime() - now.getTime()) / (1000 * 60 * 60);

  return (
    <motion.div
      layoutId={`task-${task.id}`}
      onClick={() => task.id && setSelectedTaskId(task.id)}
      className={cn(
        "bg-deep-space border p-4 rounded-md flex items-center gap-4 group transition-all cursor-pointer",
        isOverdue ? "bg-antique-ruby/10 border-antique-ruby animate-ruby-glow" : "border-chinese-blue",
        isSessionActive && "border-pearly-purple ring-1 ring-pearly-purple/30 shadow-lg"
      )}
    >
      <div className="cursor-grab text-ceil/30 hover:text-ceil shrink-0">
        <DotsThreeVertical size={20} />
      </div>
      
      <div 
        onClick={(e) => { e.stopPropagation(); task.id && onComplete(task.id); }}
        className={cn(
          "w-[18px] h-[18px] border-[1.5px] border-ceil rounded-sm cursor-pointer shrink-0 flex items-center justify-center transition-colors relative",
          task.completed ? "bg-chinese-blue border-chinese-blue" : "hover:border-desert-sand"
        )}
      >
        {task.completed && <Check size={12} className="text-desert-sand" />}
        {isCompleting && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Check size={28} weight="bold" className="animate-checkmark-pulse text-pearly-purple" />
          </div>
        )}
      </div>

      <div className={cn("w-2 h-2 rounded-full shrink-0", {
        'bg-chinese-blue': task.priority === 'low',
        'bg-ceil': task.priority === 'medium',
        'bg-pearly-purple': task.priority === 'high',
        'bg-antique-ruby': task.priority === 'critical',
      })} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h4 className={cn("text-sm font-medium text-desert-sand truncate", task.completed && "line-through opacity-40")}>
            {task.title}
          </h4>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="bg-chinese-blue/40 text-ceil text-[9px] px-1.5 py-0.5 rounded-sm uppercase font-bold">{task.duration} min</span>
          <span className="bg-ceil/10 text-ceil text-[9px] px-1.5 py-0.5 rounded-sm uppercase font-bold">{task.category}</span>
          
          {isOverdue ? (
            <span className="bg-antique-ruby text-white text-[9px] px-1.5 py-0.5 rounded-sm uppercase font-bold">
              OVERDUE · was {new Date(task.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          ) : (
             <span className={cn(
               "text-[9px] px-1.5 py-0.5 rounded-sm uppercase font-bold",
               diffHours < 4 ? "bg-antique-ruby/20 text-antique-ruby" : "bg-ceil/10 text-ceil opacity-60"
             )}>
              {new Date(task.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          
          <div className="flex items-center gap-1 ml-1 opacity-60">
             <span className="text-[9px] text-ceil font-mono">{(score).toFixed(2)}</span>
             <ScoreExplainer task={task} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap" onClick={e => e.stopPropagation()}>
        {onStart && !task.completed && (
          <button 
            onClick={() => onStart(task)}
            className="bg-antique-ruby text-white px-3 py-1 rounded-sm text-[10px] font-bold uppercase transition-all hover:scale-105"
          >
            Start
          </button>
        )}
        <button 
          onClick={() => task.id && setSelectedTaskId(task.id)}
          className="text-ceil hover:text-desert-sand"
        >
          <Gear size={16} />
        </button>
        <button 
          onClick={() => task.id && onDelete?.(task.id)}
          className="text-ceil hover:text-antique-ruby"
        >
          <X size={16} />
        </button>
      </div>
    </motion.div>
  );
};

const MobileNav = ({ activeView, setView }: { activeView: string, setView: (v: string) => void }) => {
  const navItems = [
    { id: 'today', icon: Layout },
    { id: 'backlog', icon: Archive },
    { id: 'completed', icon: Check },
    { id: 'settings', icon: Gear },
  ];

  return (
    <nav className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 bg-chinese-blue/90 backdrop-blur-md border border-ceil/30 px-2 py-2 rounded-lg flex items-center gap-1 z-40 shadow-2xl">
      {navItems.map((item) => (
        <button
          key={item.id}
          onClick={() => setView(item.id)}
          className={cn(
            "p-3 rounded-md transition-all",
            activeView === item.id 
              ? "bg-pearly-purple text-desert-sand shadow-lg" 
              : "text-ceil hover:bg-desert-sand/5"
          )}
        >
          <item.icon size={22} weight={activeView === item.id ? "fill" : "regular"} />
        </button>
      ))}
    </nav>
  );
};

const EmptyState = () => (
  <div className="flex flex-col items-center justify-center py-20 text-center px-4">
    <svg width="240" height="160" viewBox="0 0 240 160" fill="none" xmlns="http://www.w3.org/2000/svg" className="mb-8 opacity-60">
      <path d="M40 120L60 100L90 130L140 80L170 110L200 80" stroke="#9792CB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="200" cy="80" r="4" fill="#AA74A0" />
      <rect x="30" y="30" width="180" height="100" rx="6" stroke="#E2C99E" strokeWidth="1" strokeDasharray="4 4" />
      <path d="M70 60H170" stroke="#E2C99E" strokeWidth="1" opacity="0.3" />
      <path d="M70 80H130" stroke="#E2C99E" strokeWidth="1" opacity="0.3" />
      <circle cx="40" cy="40" r="10" stroke="#852736" strokeWidth="1" />
      <path d="M40 35V45M35 40H45" stroke="#852736" strokeWidth="1" />
    </svg>
    <h3 className="text-2xl text-desert-sand mb-2">Nothing scheduled. A rarity.</h3>
    <p className="text-ceil font-serif">Make it count.</p>
  </div>
);

const StatsStrip = ({ stats }: { stats: any }) => {
  const cards = [
    { label: 'Completed today', value: stats.completed, sub: `of ${stats.totalScheduled} scheduled` },
    { label: 'Hours remaining', value: stats.hoursRemaining, sub: 'in working hours' },
    { label: 'Overdue', value: stats.overdue, sub: 'need attention', color: 'text-antique-ruby' },
    { label: 'Schedule load', value: `${stats.load}%`, sub: 'algo: tight fit', color: 'text-pearly-purple' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {cards.map((card, i) => (
        <div key={i} className="bg-deep-space border border-chinese-blue p-4 rounded-md">
          <p className="text-[10px] text-ceil uppercase tracking-wider mb-1">{card.label}</p>
          <p className={cn("text-2xl font-display", card.color || "text-desert-sand")}>{card.value}</p>
          <p className="text-[9px] text-ceil opacity-60 italic">{card.sub}</p>
        </div>
      ))}
    </div>
  );
};

const FocusNow = ({ task, onStart, onComplete }: { task?: Task, onStart: (task: Task) => void, onComplete: (id: number) => void }) => {
  if (!task) return (
    <div className="bg-deep-space border-2 border-dashed border-ceil/30 p-12 rounded-md mb-8 flex flex-col items-center justify-center text-center">
      <EmptyState />
    </div>
  );

  return (
    <div className="bg-deep-space border border-antique-ruby p-6 rounded-md mb-8 flex flex-col md:flex-row items-center gap-6 relative shadow-2xl overflow-hidden group">
      <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
        <div className="absolute inset-0 bg-pearly-purple/10 rounded-full animate-glow-pulse" />
        <svg className="w-full h-full -rotate-90">
          <circle cx="40" cy="40" r="36" fill="transparent" stroke="#AA74A0" strokeWidth="3" className="opacity-20" />
          <circle cx="40" cy="40" r="36" fill="transparent" stroke="#AA74A0" strokeWidth="4" strokeDasharray="226" strokeDashoffset="100" strokeLinecap="round" />
        </svg>
        <div className="absolute w-3 h-3 bg-antique-ruby rounded-full" />
      </div>

      <div className="flex-1 text-center md:text-left">
        <span className="text-pearly-purple small-caps text-[10px] font-bold tracking-[0.2em] uppercase block mb-1">FOCUS NOW</span>
        <h2 className="text-xl text-desert-sand mb-1 font-display">{task.title}</h2>
        <div className="flex flex-wrap justify-center md:justify-start items-center gap-2 text-[11px] text-ceil opacity-70">
          <span>{task.category}</span>
          <span className="w-1 h-1 bg-ceil/30 rounded-full" />
          <span>{task.duration} min</span>
          <span className="w-1 h-1 bg-ceil/30 rounded-full" />
          <span>Due {new Date(task.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          <span className="w-1 h-1 bg-ceil/30 rounded-full" />
          <span>Score {task.id ? (task.id / 100).toFixed(2) : '0.91'}</span>
        </div>
      </div>

      <div className="flex items-center gap-8 shrink-0">
        <div className="text-3xl font-display text-antique-ruby">{task.duration}:00</div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => onStart(task)}
            className="bg-antique-ruby text-white px-5 py-2 rounded-md text-xs font-bold hover:scale-105 transition-all shadow-lg"
          >
            Start
          </button>
          <button 
            onClick={() => task.id && onComplete(task.id)}
            className="bg-chinese-blue text-white px-5 py-2 rounded-md text-xs font-bold hover:bg-chinese-blue/80 transition-all"
          >
            Mark Done
          </button>
          <button className="border border-ceil text-ceil px-5 py-2 rounded-md text-xs font-bold hover:bg-ceil/10 transition-all">
            Skip
          </button>
        </div>
      </div>
    </div>
  );
};

const ActiveSessionBar = ({ session, task, onEnd }: { session: any, task?: Task, onEnd: () => void }) => {
  if (!session || !task) return null;

  return (
    <motion.div 
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      exit={{ y: 100 }}
      className="fixed bottom-0 left-0 right-0 h-[60px] bg-deep-space border-t-2 border-pearly-purple flex items-center px-6 z-50 shadow-[0_-10px_30px_rgba(30,33,71,0.8)]"
    >
      <div className="flex-1 flex items-center gap-4">
        <div className="flex items-center gap-3 min-w-[200px]">
           <div className="w-2 h-2 bg-pearly-purple rounded-full animate-pulse" />
           <span className="text-desert-sand text-sm font-medium truncate max-w-[250px]">{task.title}</span>
        </div>
        
        <div className="hidden md:flex flex-1 items-center gap-4 max-w-xl mx-auto">
          <div className="flex-1 h-2 bg-chinese-blue/30 rounded-full relative overflow-hidden ring-1 ring-white/5">
            <motion.div 
              className="absolute inset-y-0 left-0 bg-pearly-purple shadow-[0_0_10px_rgba(170,116,160,0.5)]"
              initial={{ width: '0%' }}
              animate={{ width: '45%' }}
            />
          </div>
          <span className="text-[10px] text-ceil font-bold tracking-tighter w-8 text-right">45%</span>
        </div>

        <div className="flex items-center gap-6 ml-auto">
          <div className="flex flex-col items-end">
            <span className="text-pearly-purple font-display text-xl leading-none">00:17:22</span>
            <span className="text-[8px] text-ceil uppercase tracking-widest opacity-40">Time Focused</span>
          </div>
          <button 
            onClick={onEnd}
            className="flex items-center gap-2 border border-antique-ruby text-antique-ruby px-4 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all hover:bg-antique-ruby hover:text-desert-sand group"
          >
            <div className="w-2 h-2 bg-antique-ruby rounded-sm group-hover:bg-desert-sand" />
            End Session
          </button>
        </div>
      </div>
    </motion.div>
  );
};

interface BacklogItemDetailedProps {
  task: Task;
  onSchedule: (id: number) => void;
}

const BacklogItemDetailed: React.FC<BacklogItemDetailedProps> = ({ task, onSchedule }) => {
  const score = (task.id ? (task.id / 100) : 0.88).toFixed(2);
  
  return (
    <div className="bg-chinese-blue/20 border border-chinese-blue px-6 py-3 rounded-md flex items-center gap-6 group hover:border-pearly-purple transition-colors shrink-0">
      <div className="w-12 text-xl font-display text-pearly-purple shrink-0">{score}</div>
      <div className={cn("w-2 h-2 rounded-full shrink-0", {
        'bg-chinese-blue': task.priority === 'low',
        'bg-ceil': task.priority === 'medium',
        'bg-pearly-purple': task.priority === 'high',
        'bg-antique-ruby': task.priority === 'critical',
      })} />
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-desert-sand truncate">{task.title}</h4>
        <div className="flex items-center gap-2 mt-1 whitespace-nowrap overflow-hidden">
          <span className="text-[10px] text-ceil opacity-60">{task.duration} min</span>
          <span className="w-0.5 h-0.5 bg-ceil/30 rounded-full" />
          <span className="text-[10px] text-ceil opacity-60">{task.category}</span>
          <span className="w-0.5 h-0.5 bg-ceil/30 rounded-full" />
          <span className="text-[10px] text-ceil opacity-60">Due Tue</span>
        </div>
      </div>
      <button 
        onClick={() => task.id && onSchedule(task.id)}
        className="bg-transparent border border-ceil/30 text-ceil text-[10px] font-bold uppercase px-3 py-1 rounded-sm hover:bg-ceil hover:text-chinese-blue transition-colors opacity-60 group-hover:opacity-100 whitespace-nowrap"
      >
        Schedule
      </button>
    </div>
  );
};

// --- App Main ---

const SessionLogList = () => {
  const logs = useLiveQuery(() => db.sessionLogs.orderBy('startTime').reverse().limit(10).toArray());
  
  if (!logs || logs.length === 0) {
    return (
      <div className="py-8 text-center opacity-30 italic text-[10px]">No sessions recorded yet.</div>
    );
  }

  return (
    <div className="space-y-4">
      {logs.map(log => (
        <div key={log.id} className="border-b border-chinese-blue pb-3 group">
          <div className="flex justify-between items-start mb-1">
             <span className="text-[11px] text-desert-sand font-medium truncate max-w-[140px]">{log.taskTitle}</span>
             <span className="text-[9px] text-ceil opacity-40">{new Date(log.startTime).toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between items-end">
             <div className="flex gap-3 text-[9px] text-ceil opacity-60">
                <span>Planned: {log.plannedDuration}m</span>
                <span>Actual: {(log.actualDuration / 60000).toFixed(1)}m</span>
             </div>
             <div className={cn(
               "text-[9px] font-bold px-1.5 py-0.5 rounded-sm",
               log.actualDuration / 60000 > log.plannedDuration ? "text-antique-ruby bg-antique-ruby/10" : "text-pearly-purple bg-pearly-purple/10"
             )}>
                {((log.actualDuration / 60000) / log.plannedDuration).toFixed(1)}x
             </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default function App() {
  const allTasks = useLiveQuery(() => db.tasks.toArray()) || [];
  const settings = useLiveQuery(() => db.settings.toCollection().first()) || {
    workingHoursStart: 9,
    workingHoursEnd: 18,
    deadlineWeight: 70,
    priorityWeight: 30,
    onboardingCompleted: false,
  };

  const isDrawerOpen = useTaskFlowStore(state => state.isDrawerOpen);
  const toggleDrawer = useTaskFlowStore(state => state.toggleDrawer);
  const currentSession = useTaskFlowStore(state => state.currentSession);
  const startSession = useTaskFlowStore(state => state.startSession);
  const endSession = useTaskFlowStore(state => state.endSession);
  const setLastDeletedTask = useTaskFlowStore(state => state.setLastDeletedTask);
  const setShortcutsOpen = useTaskFlowStore(state => state.setShortcutsOpen);
  const setOnboardingOpen = useTaskFlowStore(state => state.setOnboardingOpen);
  const setSelectedTaskId = useTaskFlowStore(state => state.setSelectedTaskId);
  
  const [activeView, setActiveView] = useState('today');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [dashboardTab, setDashboardTab] = useState<'all' | 'pending' | 'overdue' | 'in-progress'>('all');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      switch (e.key.toLowerCase()) {
        case 'q': toggleDrawer(true); break;
        case '?': setShortcutsOpen(true); break;
        case 'g': setActiveView('today'); break;
        case 'b': setActiveView('backlog'); break;
        case 'a': setActiveView('analytics'); break;
        case 'esc': 
          toggleDrawer(false); 
          setShortcutsOpen(false); 
          setSelectedTaskId(null); 
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleDrawer, setShortcutsOpen, setSelectedTaskId]);

  useEffect(() => {
    if (settings && !settings.onboardingCompleted && activeView === 'today') {
      setOnboardingOpen(true);
    }
  }, [settings, setOnboardingOpen, activeView]);

  const toggleFilter = (filter: string) => {
    setActiveFilters(prev => 
      prev.includes(filter) ? prev.filter(f => f !== filter) : [...prev, filter]
    );
  };

  // Base list of incomplete tasks
  let unfilteredActive = scheduleTasks(allTasks, settings);
  
  // Apply Sidebar Filters (Category)
  if (activeCategory) {
    unfilteredActive = unfilteredActive.filter(t => t.category === activeCategory);
  }

  // Apply Quick Filters
  if (activeFilters.includes('high-priority')) {
    unfilteredActive = unfilteredActive.filter(t => t.priority === 'high' || t.priority === 'critical');
  }
  if (activeFilters.includes('due-today')) {
    const today = new Date().toDateString();
    unfilteredActive = unfilteredActive.filter(t => new Date(t.deadline).toDateString() === today);
  }
  if (activeFilters.includes('overdue-only')) {
    unfilteredActive = unfilteredActive.filter(t => new Date(t.deadline) < new Date());
  }

  // Dashboard Context Filters
  let activeTasks = unfilteredActive;
  if (dashboardTab === 'pending') {
    activeTasks = unfilteredActive.filter(t => !t.completed); // Already incomplete
  } else if (dashboardTab === 'overdue') {
    activeTasks = unfilteredActive.filter(t => new Date(t.deadline) < new Date());
  } else if (dashboardTab === 'in-progress') {
    activeTasks = unfilteredActive.filter(t => currentSession?.taskId === t.id);
  }

  const backlogTasks = allTasks.filter(t => !t.completed && !t.scheduled).sort((a, b) => getTaskScore(b, settings) - getTaskScore(a, settings));
  const completedToday = allTasks.filter(t => t.completed && t.completedAt && t.completedAt.toDateString() === new Date().toDateString());
  const overdueTasks = allTasks.filter(t => !t.completed && new Date(t.deadline) < new Date());

  const counts = {
    today: unfilteredActive.length,
    session: currentSession ? 1 : 0,
    pending: unfilteredActive.length,
    completed: completedToday.length,
    overdue: overdueTasks.length,
    backlog: backlogTasks.length,
    work: allTasks.filter(t => !t.completed && t.category === 'Work').length,
    personal: allTasks.filter(t => !t.completed && t.category === 'Personal').length,
    health: allTasks.filter(t => !t.completed && t.category === 'Health').length,
    learning: allTasks.filter(t => !t.completed && t.category === 'Learning').length,
  };

  const handleScheduleTask = async (id: number) => {
    await db.tasks.update(id, { 
      scheduled: true,
      scheduledTime: new Date()
    });
  };

  const totalDurationMinutes = allTasks.filter(t => !t.completed).reduce((acc, t) => acc + t.duration, 0);
  const hoursRemaining = (totalDurationMinutes / 60).toFixed(1);
  const loadPercentage = Math.min(100, Math.round((totalDurationMinutes / 480) * 100)); // Assume 8h work day

  const stats = {
    completed: completedToday.length,
    totalScheduled: allTasks.length,
    hoursRemaining: hoursRemaining,
    overdue: overdueTasks.length,
    load: loadPercentage
  };

  const [completingTaskId, setCompletingTaskId] = useState<number | null>(null);

  const handleCompleteTask = async (id: number) => {
    const task = allTasks.find(t => t.id === id);
    if (!task) return;

    setCompletingTaskId(id);
    setTimeout(async () => {
      // If recurring, create the next instance first
      if (task.repeat && task.repeat !== 'never') {
        const nextDeadline = new Date(task.deadline);
        if (task.repeat === 'daily') nextDeadline.setDate(nextDeadline.getDate() + 1);
        if (task.repeat === 'weekly') nextDeadline.setDate(nextDeadline.getDate() + 7);
        
        await db.tasks.add({
          ...task,
          id: undefined,
          completed: false,
          completedAt: undefined,
          deadline: nextDeadline,
          createdAt: new Date()
        });
      }

      await db.tasks.update(id, { 
        completed: true, 
        completedAt: new Date() 
      });
      setCompletingTaskId(null);
      if (currentSession?.taskId === id) endSession();
    }, 400);
  };

  const handleEndSession = async () => {
    if (currentSession) {
      const task = allTasks.find(t => t.id === currentSession.taskId);
      if (task) {
        await db.sessionLogs.add({
          taskId: task.id!,
          taskTitle: task.title,
          startTime: currentSession.startTime,
          endTime: new Date(),
          plannedDuration: currentSession.duration,
          actualDuration: new Date().getTime() - new Date(currentSession.startTime).getTime()
        });
      }
    }
    endSession();
  };

  const handleRestoreTask = async (id: number) => {
    await db.tasks.update(id, { 
      completed: false, 
      completedAt: undefined 
    });
  };

  const handleDeleteTask = async (id: number) => {
    const task = allTasks.find(t => t.id === id);
    if (task) {
      setLastDeletedTask(task);
      await db.tasks.delete(id);
    }
  };

  const sessionTask = allTasks.find(t => t.id === currentSession?.taskId);
  return (
    <div className="min-h-screen bg-chinese-blue text-desert-sand font-serif selection:bg-pearly-purple selection:text-white">
      <Navbar 
        activeTab={activeView} 
        setTab={setActiveView} 
        onNewTask={() => toggleDrawer(true)} 
        currentSession={currentSession}
        sessionTask={sessionTask}
      />
      
      <div className="flex pt-[52px]">
        <Sidebar 
          activeView={activeView} 
          setView={setActiveView} 
          counts={counts}
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
          activeFilters={activeFilters}
          toggleFilter={toggleFilter}
        />
        
        <main className="flex-1 lg:ml-[220px] p-6 max-w-5xl mx-auto w-full pb-32">
          <AnimatePresence mode="wait">
            {activeView === 'today' && (
              <motion.div
                key="today"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex justify-between items-end border-b border-chinese-blue pb-6 mb-8">
                  <div>
                    <h1 className="text-4xl font-display mb-2">Today</h1>
                    <p className="text-ceil text-sm opacity-60">Your optimized flow for {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}.</p>
                  </div>
                  <div className="text-right">
                    <span className="text-3xl font-display text-antique-ruby">{counts.today}</span>
                    <p className="text-[10px] text-ceil uppercase tracking-widest">Active Intents</p>
                  </div>
                </div>

                <StatsStrip stats={settings} />
                <ConflictBanner />
                
                {activeTasks.length > 0 ? (
                  <FocusNow 
                    task={activeTasks[0]} 
                    onStart={(t) => t.id && startSession(t.id, t.duration)} 
                    onComplete={handleCompleteTask} 
                  />
                ) : (
                  <div className="py-20 text-center border-2 border-dashed border-chinese-blue rounded-xl mb-8 group overflow-hidden relative">
                    <div className="absolute inset-0 bg-pearly-purple/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <MagicWand size={48} className="mx-auto mb-4 text-pearly-purple opacity-40 animate-pulse" />
                    <h3 className="text-xl font-display text-desert-sand mb-1">Clear Horizon</h3>
                    <p className="text-ceil text-xs opacity-60">Nothing scheduled for this window. Pure peace of mind.</p>
                  </div>
                )}

                <ActiveSessionBar 
                  session={currentSession} 
                  task={sessionTask} 
                  onEnd={handleEndSession} 
                />

                <section className="space-y-6">
                  <div className="flex justify-between items-center border-b border-chinese-blue pb-4">
                    <div className="flex items-center gap-4">
                      <h2 className="text-2xl font-display">Tasks</h2>
                      <div className="flex gap-1">
                        {['all', 'pending', 'overdue', 'in-progress'].map(tab => (
                          <button key={tab} 
                            onClick={() => setDashboardTab(tab as any)}
                            className={cn(
                              "px-3 py-1 rounded-sm text-[10px] font-bold uppercase border transition-all",
                              dashboardTab === tab ? "bg-deep-space border-chinese-blue" : "border-transparent opacity-60 hover:opacity-100"
                            )}>
                            {tab.replace('-', ' ')}
                          </button>
                        ))}
                      </div>
                    </div>
                    <span className="text-[10px] text-ceil opacity-60 uppercase">{activeTasks.length} tasks · {hoursRemaining}h remaining</span>
                  </div>

                  <div className="space-y-3">
                    <AnimatePresence mode="popLayout">
                      {activeTasks.length > 0 ? (
                        activeTasks.map(task => (
                          <TaskCardDetailed 
                            key={task.id} 
                            task={task} 
                            onComplete={handleCompleteTask}
                            onStart={(t) => t.id && startSession(t.id, t.duration)}
                            isSessionActive={currentSession?.taskId === task.id}
                            isCompleting={completingTaskId === task.id}
                          />
                        ))
                      ) : (
                        <div className="text-center py-12 border border-dashed border-chinese-blue rounded-md opacity-30 italic text-sm">
                          No tasks match the current filters.
                        </div>
                      )}
                    </AnimatePresence>
                    
                    <button 
                      onClick={() => toggleDrawer(true)}
                      className="w-full py-4 border-2 border-dashed border-chinese-blue rounded-md text-ceil/60 text-xs italic hover:text-ceil hover:border-ceil transition-all group"
                    >
                      <Plus size={14} className="inline mr-2 group-hover:rotate-90 transition-transform" />
                      Quick add a task — press Q or click here
                    </button>
                  </div>
                </section>

                <section className="mt-12 space-y-6">
                  <button className="flex items-center justify-between w-full border-b border-chinese-blue pb-4 group">
                    <h2 className="text-2xl font-display text-ceil/60">Completed Today</h2>
                    <span className="text-[10px] text-ceil opacity-30 uppercase">{completedToday.length} tasks completed</span>
                  </button>
                  <div className="space-y-3">
                    {completedToday.map(task => (
                      <div key={task.id} className="opacity-30 hover:opacity-60 transition-opacity">
                        <TaskCardDetailed 
                          task={task} 
                          onComplete={handleRestoreTask}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              </motion.div>
            )}

            {activeView === 'backlog' && (
              <motion.div
                key="backlog"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="flex justify-between items-end border-b border-chinese-blue pb-6">
                  <div>
                    <h1 className="text-4xl font-display mb-2">Backlog</h1>
                    <p className="text-ceil text-sm opacity-60">Reserved tasks waiting for a slot in your flow.</p>
                  </div>
                  <div className="text-right">
                    <span className="text-3xl font-display text-pearly-purple">{backlogTasks.length}</span>
                    <p className="text-[10px] text-ceil uppercase tracking-widest">Unscheduled</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                   {backlogTasks.length > 0 ? (
                     backlogTasks.map(task => (
                        <BacklogItemDetailed 
                          key={task.id} 
                          task={task} 
                          onSchedule={handleScheduleTask} 
                        />
                     ))
                   ) : (
                     <div className="py-32 text-center border-2 border-dashed border-chinese-blue rounded-lg bg-chinese-blue/5">
                       <Archive size={48} className="mx-auto mb-4 text-pearly-purple opacity-30" />
                       <h3 className="text-xl font-display text-desert-sand mb-1">Dormant Inventory</h3>
                       <p className="text-ceil text-xs opacity-60">Your backlog is clear. Every known intent is either scheduled or completed.</p>
                     </div>
                   )}
                </div>
              </motion.div>
            )}

            {activeView === 'settings' && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="border-b border-chinese-blue pb-6">
                  <h1 className="text-4xl font-display mb-2">Settings</h1>
                  <p className="text-ceil text-sm opacity-60">System-wide configurations.</p>
                </div>

                <div className="space-y-6">
                   <div className="bg-deep-space border border-chinese-blue p-6 rounded-lg space-y-4">
                      <h3 className="text-[10px] text-pearly-purple uppercase tracking-widest font-bold">Alert Protocol</h3>
                      <div className="flex items-center justify-between">
                         <div className="flex items-center gap-3">
                            <Bell size={20} className="text-ceil" />
                            <div>
                               <p className="text-xs font-bold text-desert-sand">Desktop Reminders</p>
                               <p className="text-[10px] text-ceil opacity-60">Nudge me 15m before a deadline.</p>
                            </div>
                         </div>
                         <button 
                          onClick={() => Notification.requestPermission()}
                          className="bg-pearly-purple text-desert-sand px-4 py-2 rounded-md text-[10px] font-bold uppercase"
                         >
                            Request Permission
                         </button>
                      </div>
                   </div>

                   <div className="bg-deep-space border border-chinese-blue p-6 rounded-lg space-y-4">
                      <h3 className="text-[10px] text-pearly-purple uppercase tracking-widest font-bold">Data Governance</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <button 
                          onClick={async () => {
                            const tasks = await db.tasks.toArray();
                            const blob = new Blob([JSON.stringify(tasks)], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `taskflow-export-${new Date().toISOString().split('T')[0]}.json`;
                            a.click();
                          }}
                          className="flex items-center justify-center gap-3 bg-chinese-blue/40 border border-chinese-blue p-4 rounded-md text-xs font-bold uppercase tracking-widest hover:bg-chinese-blue group transition-all"
                         >
                            <FileArrowDown size={20} className="text-pearly-purple group-hover:scale-110 transition-transform" />
                            Export JSON
                         </button>
                         <label className="flex items-center justify-center gap-3 bg-chinese-blue/40 border border-chinese-blue p-4 rounded-md text-xs font-bold uppercase tracking-widest hover:bg-chinese-blue group cursor-pointer transition-all">
                            <input 
                              type="file" 
                              className="hidden" 
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const text = await file.text();
                                const data = JSON.parse(text);
                                await db.tasks.bulkAdd(data);
                                window.location.reload();
                              }}
                            />
                            <FileArrowUp size={20} className="text-antique-ruby group-hover:scale-110 transition-transform" />
                            Import JSON
                         </label>
                      </div>
                   </div>

                   <div className="bg-deep-space border border-chinese-blue p-6 rounded-lg space-y-6">
                      <h3 className="text-[10px] text-pearly-purple uppercase tracking-widest font-bold">Flow Mechanics</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                         <div className="space-y-4">
                            <label className="text-xs text-ceil block">Deadline Weight: {settings.deadlineWeight}%</label>
                            <Slider.Root 
                              className="relative flex items-center select-none touch-none w-full h-5"
                              value={[settings.deadlineWeight]}
                              onValueChange={([val]) => {
                                const newSettings = { ...settings, deadlineWeight: val };
                                if ('id' in settings) {
                                  db.settings.update(settings.id as number, { deadlineWeight: val });
                                } else {
                                  db.settings.put(newSettings);
                                }
                              }}
                              max={100}
                              step={1}
                            >
                              <Slider.Track className="bg-chinese-blue relative grow rounded-full h-1">
                                <Slider.Range className="absolute bg-pearly-purple rounded-full h-full shadow-[0_0_8px_rgba(170,116,160,0.5)]" />
                              </Slider.Track>
                              <Slider.Thumb className="block w-4 h-4 bg-desert-sand rounded-full hover:bg-white focus:outline-none focus:ring-2 focus:ring-pearly-purple shadow-lg" />
                            </Slider.Root>
                         </div>
                         <div className="space-y-4">
                            <label className="text-xs text-ceil block">Working Hours: {settings.workingHoursStart}:00 - {settings.workingHoursEnd}:00</label>
                            <Slider.Root 
                              className="relative flex items-center select-none touch-none w-full h-5"
                              value={[settings.workingHoursStart, settings.workingHoursEnd]}
                              onValueChange={([start, end]) => {
                                const newSettings = { ...settings, workingHoursStart: start, workingHoursEnd: end };
                                if ('id' in settings) {
                                  db.settings.update(settings.id as number, { workingHoursStart: start, workingHoursEnd: end });
                                } else {
                                  db.settings.put(newSettings);
                                }
                              }}
                              max={24}
                              step={1}
                              minStepsBetweenThumbs={2}
                            >
                              <Slider.Track className="bg-chinese-blue relative grow rounded-full h-1">
                                <Slider.Range className="absolute bg-antique-ruby rounded-full h-full" />
                              </Slider.Track>
                              <Slider.Thumb className="block w-4 h-4 bg-desert-sand rounded-full shadow-lg" />
                              <Slider.Thumb className="block w-4 h-4 bg-desert-sand rounded-full shadow-lg" />
                            </Slider.Root>
                         </div>
                      </div>
                   </div>
                </div>
              </motion.div>
            )}

            {activeView === 'analytics' && (
              <motion.div
                key="analytics"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="border-b border-chinese-blue pb-6">
                  <h1 className="text-4xl font-display mb-2">Analytics</h1>
                  <p className="text-ceil text-sm opacity-60">Quantifying your cognitive throughput.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="bg-deep-space border border-chinese-blue p-6 rounded-lg">
                    <h3 className="text-[10px] text-pearly-purple uppercase tracking-widest font-bold mb-4">Completion Velocity</h3>
                    <div className="h-32 flex items-end gap-2 px-2">
                       {[40, 70, 45, 90, 65, 80, 55].map((h, i) => (
                         <div key={i} className="flex-1 bg-pearly-purple/20 rounded-t-sm relative group">
                            <motion.div 
                              initial={{ height: 0 }}
                              animate={{ height: `${h}%` }}
                              className="w-full bg-pearly-purple rounded-t-sm"
                            />
                            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[8px] text-ceil opacity-40">{"MTWTFSS"[i]}</div>
                         </div>
                       ))}
                    </div>
                  </div>

                  <div className="bg-deep-space border border-chinese-blue p-6 rounded-lg">
                    <h3 className="text-[10px] text-antique-ruby uppercase tracking-widest font-bold mb-4">Focus Distribution</h3>
                    <div className="space-y-3">
                       {['Work', 'Personal', 'Health', 'Learning'].map(cat => (
                         <div key={cat} className="space-y-1">
                            <div className="flex justify-between text-[10px] text-ceil">
                               <span>{cat}</span>
                               <span>{Math.floor(Math.random() * 40 + 10)}%</span>
                            </div>
                            <div className="h-1.5 bg-chinese-blue rounded-full overflow-hidden">
                               <div className="h-full bg-antique-ruby" style={{ width: `${Math.random() * 60 + 20}%` }} />
                            </div>
                         </div>
                       ))}
                    </div>
                  </div>

                  <div className="bg-deep-space border border-chinese-blue p-6 rounded-lg">
                    <h3 className="text-[10px] text-desert-sand uppercase tracking-widest font-bold mb-4">Recent Sessions</h3>
                    <SessionLogList />
                  </div>
                </div>

                <div className="p-8 border border-pearly-purple/30 bg-pearly-purple/5 rounded-lg flex flex-col items-center text-center">
                   <Hourglass size={32} className="text-pearly-purple mb-4 animate-pulse" />
                   <h3 className="text-xl font-display mb-1 text-desert-sand">Deep Flow Ratio</h3>
                   <p className="text-4xl font-display text-pearly-purple mb-2">0.82</p>
                   <p className="text-xs text-ceil opacity-60 italic max-w-sm">"Your sessions show higher sustained focus in the morning. Consider moving critical work to 9:00 AM."</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      <TaskDetailDrawer />
      <OnboardingOverlay />
      <ShortcutMap />
      <UndoToast />

      <Dialog.Root open={isDrawerOpen} onOpenChange={toggleDrawer}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-chinese-blue/60 backdrop-blur-sm z-[60]" />
          <Dialog.Content className="fixed top-0 right-0 bottom-0 w-full max-w-[400px] bg-deep-space p-8 border-l border-chinese-blue shadow-2xl z-[70] overflow-y-auto">
             <motion.div
               initial={{ x: '100%' }}
               animate={{ x: 0 }}
               exit={{ x: '100%' }}
               transition={{ type: 'spring', damping: 25, stiffness: 200 }}
             >
               <TaskForm onClose={() => toggleDrawer(false)} />
             </motion.div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Mobile Sidebar Navigation (using Dialog for sheet-like behavior) */}
      <Dialog.Root open={isMobileNavOpen} onOpenChange={setIsMobileNavOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-chinese-blue/60 backdrop-blur-sm z-40 lg:hidden" />
          <Dialog.Content className="fixed bottom-0 left-0 right-0 bg-deep-space border-t border-chinese-blue p-4 shadow-2xl z-50 lg:hidden rounded-t-xl max-h-[80vh] overflow-y-auto outline-none">
            <Dialog.Title className="sr-only">Mobile Navigation</Dialog.Title>
            <Sidebar 
              activeView={activeView} 
              setView={(v) => { setActiveView(v); setIsMobileNavOpen(false); }} 
              counts={counts}
              activeCategory={activeCategory}
              setActiveCategory={setActiveCategory}
              activeFilters={activeFilters}
              toggleFilter={toggleFilter}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Mobile Nav Toggle */}
      <button 
        onClick={() => setIsMobileNavOpen(true)}
        className="lg:hidden fixed bottom-6 left-6 bg-deep-space border border-chinese-blue text-desert-sand w-12 h-12 rounded-md shadow-xl z-30 flex items-center justify-center active:scale-95 transition-all"
      >
        <Layout size={24} />
      </button>

      {/* Mobile Quick Add */}
      <button 
        onClick={() => toggleDrawer(true)}
        className="lg:hidden fixed bottom-6 right-6 bg-antique-ruby text-white w-14 h-14 rounded-full shadow-xl z-30 flex items-center justify-center active:scale-95 transition-all"
      >
        <Plus size={32} weight="bold" />
      </button>
    </div>
  );
}

function TaskForm({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState(30);
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [category, setCategory] = useState('Work');
  const [repeat, setRepeat] = useState<'never' | 'daily' | 'weekly'>('never');
  const [deadlineType, setDeadlineType] = useState('tomorrow');
  const [notes, setNotes] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;

    let deadlineDate = new Date();
    if (deadlineType === 'today') deadlineDate.setHours(23, 59, 0, 0);
    else if (deadlineType === 'tomorrow') {
      deadlineDate.setDate(deadlineDate.getDate() + 1);
      deadlineDate.setHours(17, 0, 0, 0);
    } else {
      deadlineDate.setDate(deadlineDate.getDate() + 7);
      deadlineDate.setHours(17, 0, 0, 0);
    }

    await db.tasks.add({
      title,
      duration,
      priority,
      category,
      deadline: deadlineDate,
      notes,
      completed: false,
      scheduled: true,
      repeat,
      createdAt: new Date()
    });

    onClose();
  };

  const handleSaveToBacklog = async () => {
    if (!title) return;

    let deadlineDate = new Date();
    // Default logic for backlog
    deadlineDate.setDate(deadlineDate.getDate() + 7);

    await db.tasks.add({
      title,
      duration,
      priority,
      category,
      deadline: deadlineDate,
      notes,
      completed: false,
      scheduled: false,
      repeat,
      createdAt: new Date()
    });

    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 h-full flex flex-col bg-deep-space text-desert-sand">
      <div className="flex justify-between items-center mb-4">
        <Dialog.Title className="text-3xl font-display">New Task</Dialog.Title>
        <button type="button" onClick={onClose} className="text-ceil hover:text-desert-sand transition-colors">
          <X size={24} />
        </button>
      </div>

      <div className="space-y-8 flex-1 overflow-y-auto pr-2">
        <div className="space-y-2">
          <label className="text-ceil text-[10px] uppercase tracking-widest font-bold">Category</label>
          <div className="flex flex-wrap gap-2">
            {['Work', 'Personal', 'Health', 'Learning'].map(c => (
              <button 
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={cn(
                   "px-3 py-1.5 rounded-full text-[10px] font-bold uppercase transition-all border",
                   category === c ? "bg-pearly-purple/20 border-pearly-purple text-pearly-purple" : "border-chinese-blue text-ceil hover:bg-chinese-blue"
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-chinese-blue">
          <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-widest text-ceil">
             <span>Repeating Task</span>
             <span className={cn(repeat !== 'never' ? "text-pearly-purple" : "text-ceil")}>{repeat}</span>
          </div>
          <div className="flex gap-2">
             {['never', 'daily', 'weekly'].map(r => (
               <button 
                key={r}
                type="button"
                onClick={() => setRepeat(r as any)}
                className={cn(
                  "flex-1 py-2 text-[8px] uppercase font-bold rounded-sm border transition-all",
                  repeat === r ? "bg-pearly-purple/20 border-pearly-purple text-pearly-purple" : "border-chinese-blue text-ceil hover:bg-chinese-blue/20"
                )}
               >
                 {r}
               </button>
             ))}
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-ceil text-[10px] uppercase tracking-widest font-bold">Title</label>
          <input 
            autoFocus
            type="text" 
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="The focus of your flow..."
            className="w-full bg-transparent border-b border-ceil/30 py-4 text-2xl focus:border-pearly-purple outline-none transition-colors font-display placeholder:opacity-10 focus:ring-2 focus:ring-antique-ruby rounded-sm px-2"
          />
        </div>

        <div className="space-y-4">
          <label className="text-ceil text-[10px] uppercase tracking-widest font-bold">Deadline Shortcut</label>
          <ToggleGroup.Root 
            type="single" 
            value={deadlineType}
            onValueChange={v => v && setDeadlineType(v)}
            className="flex gap-2"
          >
            {['today', 'tomorrow', 'EOW', 'Custom'].map(type => (
              <ToggleGroup.Item 
                key={type}
                value={type} 
                className="flex-1 py-3 px-2 rounded-md border border-ceil text-[10px] uppercase font-bold transition-all data-[state=on]:bg-ceil data-[state=on]:text-chinese-blue hover:bg-ceil/10"
              >
                {type}
              </ToggleGroup.Item>
            ))}
          </ToggleGroup.Root>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <label className="text-ceil text-[10px] uppercase tracking-widest font-bold">Duration</label>
            <span className="text-desert-sand font-bold text-sm">{Math.floor(duration/60)}h {duration%60}m</span>
          </div>
          <Slider.Root 
            className="relative flex items-center select-none touch-none w-full h-5"
            value={[duration]}
            onValueChange={([val]) => setDuration(val)}
            min={15}
            max={240}
            step={15}
          >
            <Slider.Track className="bg-ceil relative grow rounded-full h-[2px]">
              <Slider.Range className="absolute bg-pearly-purple rounded-full h-full" />
            </Slider.Track>
            <Slider.Thumb className="block w-5 h-5 bg-pearly-purple border border-desert-sand shadow-lg rounded-md hover:scale-110 focus:outline-none transition-all" />
          </Slider.Root>
        </div>

        <div className="space-y-3">
           <label className="text-ceil text-[10px] uppercase tracking-widest font-bold">Priority Weight</label>
           <ToggleGroup.Root 
            type="single" 
            value={priority}
            onValueChange={v => v && setPriority(v as any)}
            className="flex gap-1 border border-ceil/20 p-1 rounded-sm"
          >
            {['low', 'medium', 'high', 'critical'].map(p => (
              <ToggleGroup.Item 
                key={p}
                value={p} 
                className="flex-1 py-2 text-[9px] uppercase font-bold rounded-sm transition-all data-[state=on]:bg-antique-ruby data-[state=on]:text-desert-sand hover:bg-antique-ruby/10"
              >
                {p}
              </ToggleGroup.Item>
            ))}
          </ToggleGroup.Root>
        </div>

        <div className="space-y-4">
          <label className="text-ceil text-[10px] uppercase tracking-widest font-bold">Category</label>
          <div className="flex flex-wrap gap-2">
            {['Work', 'Personal', 'Health', 'Learning', 'Other'].map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={cn(
                  "px-4 py-2 rounded-sm text-[10px] uppercase font-bold border transition-all",
                  category === cat 
                    ? "bg-antique-ruby/20 border-antique-ruby text-desert-sand" 
                    : "border-ceil/30 text-ceil hover:border-ceil"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-ceil text-[10px] uppercase tracking-widest font-bold">Notes</label>
          <textarea 
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder="Additional context for the algorithm..."
            className="w-full bg-transparent border border-ceil/30 rounded-md p-3 text-sm focus:border-pearly-purple outline-none transition-colors resize-none placeholder:opacity-20"
          />
        </div>

        <div className="p-4 bg-pearly-purple/10 border border-pearly-purple/30 rounded-md">
          <div className="flex justify-between items-center mb-1">
             <span className="text-[10px] text-pearly-purple uppercase font-bold tracking-widest">Est. Greedy Score</span>
             <span className="text-xl font-display font-bold text-pearly-purple">0.91</span>
          </div>
          <p className="text-[9px] text-ceil opacity-60">This score determines position in the flow queue.</p>
        </div>
      </div>

      <div className="space-y-3 pt-6 border-t border-ceil/20">
        <button 
          type="submit"
          className="w-full bg-antique-ruby text-desert-sand py-4 rounded-md text-xs font-bold uppercase tracking-widest shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all"
        >
          Add to Schedule
        </button>
        <button 
          type="button"
          onClick={handleSaveToBacklog}
          className="w-full border border-ceil text-ceil py-4 rounded-md text-xs font-bold uppercase tracking-widest hover:bg-ceil/5 transition-all"
        >
          Save to Backlog
        </button>
      </div>
    </form>
  );
}
