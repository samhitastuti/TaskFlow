import React from 'react';
import * as Toast from '@radix-ui/react-toast';
import { ArrowCounterClockwise, X } from '@phosphor-icons/react';
import { useTaskFlowStore } from '../store';
import { db } from '../db';

export function UndoToast() {
  const lastDeletedTask = useTaskFlowStore(state => state.lastDeletedTask);
  const setLastDeletedTask = useTaskFlowStore(state => state.setLastDeletedTask);

  const handleUndo = async () => {
    if (!lastDeletedTask) return;
    const { id, ...taskData } = lastDeletedTask;
    await db.tasks.add(taskData);
    setLastDeletedTask(null);
  };

  return (
    <Toast.Provider swipeDirection="right">
      <Toast.Root 
        open={!!lastDeletedTask} 
        onOpenChange={(open) => !open && setLastDeletedTask(null)}
        duration={5000}
        className="fixed bottom-8 right-8 bg-chinese-blue border border-pearly-purple/40 p-4 rounded-lg shadow-2xl z-[150] flex items-center gap-4 animate-in slide-in-from-bottom-5 fade-in"
      >
        <div className="flex-1">
          <Toast.Title className="text-desert-sand text-sm font-bold">Task deleted</Toast.Title>
          <Toast.Description className="text-ceil text-xs opacity-60">You have 5 seconds to undo this action.</Toast.Description>
        </div>
        <div className="flex items-center gap-2">
          <Toast.Action asChild altText="Undo deletion">
            <button 
              onClick={handleUndo}
              className="flex items-center gap-2 bg-pearly-purple text-desert-sand px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider hover:bg-pearly-purple/80 transition-colors"
            >
              <ArrowCounterClockwise size={14} />
              Undo
            </button>
          </Toast.Action>
          <Toast.Close asChild>
            <button className="text-ceil p-1 hover:text-desert-sand">
              <X size={16} />
            </button>
          </Toast.Close>
        </div>
      </Toast.Root>
      <Toast.Viewport />
    </Toast.Provider>
  );
}
