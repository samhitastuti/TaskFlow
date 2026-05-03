import React, { useMemo } from 'react';
import { Warning, ArrowRight } from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'motion/react';
import { useTaskFlowStore } from '../store';

export function ConflictBanner() {
  const tasks = useTaskFlowStore(state => state.tasks);
  const settings = useTaskFlowStore(state => state.settings);
  
  const conflictInfo = useMemo(() => {
    const activeTasks = tasks.filter(t => !t.completed);
    const totalMinutesNeeded = activeTasks.reduce((acc, t) => acc + t.duration, 0);
    
    // Calculate remaining minutes in work day
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTimeMinutes = currentHour * 60 + currentMinute;
    
    // workingHoursEnd is 0-24, e.g. 18 (6pm)
    const endTimeMinutes = settings.workingHoursEnd * 60;
    const remainingMinutes = Math.max(0, endTimeMinutes - currentTimeMinutes);
    
    const overdueCount = activeTasks.filter(t => new Date(t.deadline) < new Date()).length;
    
    if (totalMinutesNeeded > remainingMinutes) {
      return {
        hasConflict: true,
        needed: totalMinutesNeeded,
        remaining: remainingMinutes,
        overdue: overdueCount,
        excess: totalMinutesNeeded - remainingMinutes
      };
    }
    
    return { hasConflict: false };
  }, [tasks, settings]);

  if (!conflictInfo.hasConflict) return null;

  return (
    <motion.div 
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      className="overflow-hidden"
    >
      <div className="bg-antique-ruby/10 border border-antique-ruby/30 p-3 rounded-md mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-antique-ruby/20 p-1.5 rounded-sm">
            <Warning size={18} className="text-antique-ruby" weight="bold" />
          </div>
          <div>
            <p className="text-xs font-bold text-desert-sand uppercase tracking-tight">Scheduling Conflict Detected</p>
            <p className="text-[10px] text-ceil opacity-70 italic">
              Tasks require {conflictInfo.needed}m of focus, but only {conflictInfo.remaining}m remain in working hours. 
              {conflictInfo.excess > 0 && <span className="text-antique-ruby ml-1">({conflictInfo.excess}m overflow)</span>}
            </p>
          </div>
        </div>
        <button className="flex items-center gap-1.5 bg-antique-ruby text-white px-3 py-1.5 rounded-sm text-[10px] font-bold uppercase transition-all hover:scale-105 active:scale-95 shadow-lg">
          Optimize
          <ArrowRight size={14} />
        </button>
      </div>
    </motion.div>
  );
}
