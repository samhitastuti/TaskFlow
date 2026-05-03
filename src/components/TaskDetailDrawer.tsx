import React, { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import * as Slider from '@radix-ui/react-slider';
import { X, Trash, Clock, Calendar, Tag, Notebook, Info } from '@phosphor-icons/react';
import { db, type Task } from '../db';
import { useTaskFlowStore, getTaskScore } from '../store';
import { cn } from '../lib/utils';
import { ScoreExplainer } from './ScoreExplainer';

export function TaskDetailDrawer() {
  const selectedTaskId = useTaskFlowStore(state => state.selectedTaskId);
  const setSelectedTaskId = useTaskFlowStore(state => state.setSelectedTaskId);
  const settings = useTaskFlowStore(state => state.settings);
  
  const [task, setTask] = useState<Task | null>(null);
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState(30);
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [category, setCategory] = useState('Work');
  const [notes, setNotes] = useState('');
  const [deadline, setDeadline] = useState<string>('');

  useEffect(() => {
    if (selectedTaskId) {
      db.tasks.get(selectedTaskId).then(t => {
        if (t) {
          setTask(t);
          setTitle(t.title);
          setDuration(t.duration);
          setPriority(t.priority);
          setCategory(t.category);
          setNotes(t.notes || '');
          setDeadline(new Date(t.deadline).toISOString().slice(0, 16));
        }
      });
    }
  }, [selectedTaskId]);

  const handleUpdate = async () => {
    if (!task?.id) return;
    await db.tasks.update(task.id, {
      title,
      duration,
      priority,
      category,
      notes,
      deadline: new Date(deadline)
    });
    setSelectedTaskId(null);
  };

  const handleDelete = async () => {
    if (!task?.id) return;
    await db.tasks.delete(task.id);
    setSelectedTaskId(null);
  };

  if (!task) return null;

  const score = getTaskScore(task, settings);

  return (
    <Dialog.Root open={!!selectedTaskId} onOpenChange={(open) => !open && setSelectedTaskId(null)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-chinese-blue/60 backdrop-blur-sm z-[80]" />
        <Dialog.Content className="fixed top-0 right-0 bottom-0 w-full max-w-[450px] bg-deep-space p-8 border-l border-chinese-blue shadow-2xl z-[90] overflow-y-auto">
          <div className="flex justify-between items-center mb-8">
            <Dialog.Title className="text-2xl font-display text-desert-sand">Task Details</Dialog.Title>
            <div className="flex items-center gap-2">
              <button onClick={handleDelete} className="p-2 text-ceil hover:text-antique-ruby transition-colors">
                <Trash size={20} />
              </button>
              <button onClick={() => setSelectedTaskId(null)} className="p-2 text-ceil hover:text-desert-sand transition-colors">
                <X size={24} />
              </button>
            </div>
          </div>

          <div className="space-y-8">
            <div className="p-4 bg-pearly-purple/10 border border-pearly-purple/30 rounded-md flex justify-between items-center group">
               <div>
                  <span className="text-[10px] text-pearly-purple uppercase font-bold tracking-widest block mb-1">Algorithm Score</span>
                  <div className="flex items-center gap-2">
                    <span className="text-3xl font-display font-bold text-pearly-purple">{score.toFixed(2)}</span>
                    <ScoreExplainer task={task} />
                  </div>
               </div>
               <div className="text-right">
                  <span className="text-[10px] text-ceil uppercase font-bold tracking-widest block mb-1">Created</span>
                  <span className="text-xs text-ceil opacity-60">{task.createdAt.toLocaleDateString()}</span>
               </div>
            </div>

            <div className="space-y-2">
              <label className="text-ceil text-[10px] uppercase tracking-widest font-bold">Title</label>
              <input 
                type="text" 
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full bg-transparent border-b border-ceil/30 py-2 text-xl focus:border-pearly-purple outline-none transition-colors font-display text-desert-sand"
              />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-ceil text-[10px] uppercase tracking-widest font-bold">Duration</label>
                <div className="flex items-center gap-2 text-desert-sand">
                  <Clock size={16} className="text-pearly-purple" />
                  <input 
                    type="number" 
                    value={duration}
                    onChange={e => setDuration(parseInt(e.target.value))}
                    className="bg-transparent border-b border-ceil/30 w-16 outline-none focus:border-pearly-purple"
                  />
                  <span className="text-xs opacity-60">min</span>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-ceil text-[10px] uppercase tracking-widest font-bold">Category</label>
                <div className="flex items-center gap-2 text-desert-sand">
                  <Tag size={16} className="text-antique-ruby" />
                  <select 
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="bg-transparent border-b border-ceil/30 outline-none focus:border-pearly-purple text-xs"
                  >
                    {['Work', 'Personal', 'Health', 'Learning', 'Other'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-ceil text-[10px] uppercase tracking-widest font-bold">Deadline</label>
              <div className="flex items-center gap-2 text-desert-sand">
                <Calendar size={16} className="text-pearly-purple" />
                <input 
                  type="datetime-local" 
                  value={deadline}
                  onChange={e => setDeadline(e.target.value)}
                  className="bg-transparent border-b border-ceil/30 w-full outline-none focus:border-pearly-purple text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-ceil text-[10px] uppercase tracking-widest font-bold">Priority Weight</label>
              <ToggleGroup.Root 
                type="single" 
                value={priority}
                onValueChange={(val) => val && setPriority(val as any)}
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

            <div className="space-y-2">
              <label className="text-ceil text-[10px] uppercase tracking-widest font-bold">Notes</label>
              <div className="relative">
                <Notebook size={16} className="absolute left-3 top-3 text-pearly-purple opacity-40" />
                <textarea 
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={4}
                  className="w-full bg-chinese-blue/10 border border-ceil/20 rounded-md p-3 pl-10 text-sm text-desert-sand focus:border-pearly-purple outline-none transition-colors resize-none"
                  placeholder="Context for your flow..."
                />
              </div>
            </div>

            <button 
              onClick={handleUpdate}
              className="w-full bg-antique-ruby text-desert-sand py-4 rounded-md text-xs font-bold uppercase tracking-widest shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all"
            >
              Save Changes
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
