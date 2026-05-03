import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Keyboard } from '@phosphor-icons/react';
import { useTaskFlowStore } from '../store';
import { motion } from 'motion/react';

export function ShortcutMap() {
  const isShortcutsOpen = useTaskFlowStore(state => state.isShortcutsOpen);
  const setShortcutsOpen = useTaskFlowStore(state => state.setShortcutsOpen);

  const shortcuts = [
    { key: 'Q', action: 'Quick-add new task' },
    { key: 'S', action: 'Start focus session' },
    { key: 'D', action: 'Mark selected as done' },
    { key: 'E', action: 'Edit selected task' },
    { key: 'G', action: 'Go to dashboard' },
    { key: 'B', action: 'View backlog' },
    { key: 'A', action: 'Open analytics' },
    { key: '?', action: 'Show/hide this map' },
    { key: 'Esc', action: 'Close current view/drawer' },
  ];

  return (
    <Dialog.Root open={isShortcutsOpen} onOpenChange={setShortcutsOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-chinese-blue/80 backdrop-blur-md z-[110]" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-deep-space p-8 border border-pearly-purple/30 rounded-xl shadow-2xl z-[120] outline-none">
          <div className="flex justify-between items-center mb-8 border-b border-pearly-purple/20 pb-4">
             <div className="flex items-center gap-3">
                <Keyboard size={24} className="text-pearly-purple" />
                <Dialog.Title className="text-2xl font-display text-desert-sand">Keyboard Force</Dialog.Title>
             </div>
             <button onClick={() => setShortcutsOpen(false)} className="text-ceil hover:text-desert-sand transition-colors">
               <X size={24} />
             </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
             {shortcuts.map((s, i) => (
               <motion.div 
                 key={s.key}
                 initial={{ opacity: 0, x: -10 }}
                 animate={{ opacity: 1, x: 0 }}
                 transition={{ delay: i * 0.05 }}
                 className="flex items-center justify-between group"
               >
                 <span className="text-sm text-ceil group-hover:text-desert-sand transition-colors">{s.action}</span>
                 <div className="flex items-center">
                    <div className="min-w-[40px] px-2 py-1 bg-chinese-blue/40 border border-ceil/30 rounded-md text-desert-sand font-mono text-center text-xs shadow-[0_2px_0_rgba(170,116,160,0.3)]">
                      {s.key}
                    </div>
                 </div>
               </motion.div>
             ))}
          </div>

          <div className="mt-8 pt-6 border-t border-pearly-purple/20 text-center">
             <p className="text-[10px] text-ceil opacity-40 uppercase tracking-[0.2em]">Efficiency through muscle memory</p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
