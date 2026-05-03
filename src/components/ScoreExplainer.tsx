import React from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Info, Question } from '@phosphor-icons/react';
import { type Task, type Settings } from '../db';
import { useTaskFlowStore } from '../store';

export function ScoreExplainer({ task }: { task: Task }) {
  const settings = useTaskFlowStore(state => state.settings);
  
  const now = new Date().getTime();
  const deadlineTime = new Date(task.deadline).getTime();
  const timeToDeadline = deadlineTime - now;
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
  
  const priorityMap = { low: 0.2, medium: 0.4, high: 0.7, critical: 1.0 };
  const pScore = priorityMap[task.priority];
  const dScore = Math.max(0, 1 - (timeToDeadline / oneWeekMs));
  
  const dWeight = settings.deadlineWeight / 100;
  const pWeight = settings.priorityWeight / 100;
  
  const weightedDeadline = dScore * dWeight;
  const weightedPriority = pScore * pWeight;
  const total = weightedDeadline + weightedPriority;

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button className="text-ceil/40 hover:text-pearly-purple transition-colors">
          <Question size={18} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="w-64 p-4 bg-deep-space border border-pearly-purple/30 rounded-lg shadow-2xl z-[100] animate-in fade-in zoom-in-95 duration-200">
          <h4 className="text-[10px] text-pearly-purple uppercase font-bold tracking-widest mb-3 border-b border-pearly-purple/20 pb-2">Score Breakdown</h4>
          
          <div className="space-y-4">
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-ceil">Deadline Urgency</span>
                <span className="text-desert-sand font-mono">{(dScore * 100).toFixed(0)}%</span>
              </div>
              <div className="h-1 bg-chinese-blue rounded-full overflow-hidden">
                <div className="h-full bg-pearly-purple" style={{ width: `${dScore * 100}%` }} />
              </div>
              <p className="text-[9px] text-ceil/60 italic">Weighted at {(dWeight * 100).toFixed(0)}% importance</p>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-ceil">Priority Weight</span>
                <span className="text-desert-sand font-mono">{(pScore * 100).toFixed(0)}%</span>
              </div>
              <div className="h-1 bg-chinese-blue rounded-full overflow-hidden">
                <div className="h-full bg-antique-ruby" style={{ width: `${pScore * 100}%` }} />
              </div>
              <p className="text-[9px] text-ceil/60 italic">Weighted at {(pWeight * 100).toFixed(0)}% importance</p>
            </div>

            <div className="pt-2 border-t border-pearly-purple/20 flex justify-between items-center">
              <span className="text-[10px] text-desert-sand uppercase font-bold">Computed Raw</span>
              <span className="text-lg font-display font-bold text-pearly-purple">{total.toFixed(4)}</span>
            </div>
          </div>
          <Popover.Arrow className="fill-deep-space border-pearly-purple/30" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
