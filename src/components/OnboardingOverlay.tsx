import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { CaretRight, CaretLeft, Play, Clock, ChartBar, MagicWand } from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'motion/react';
import { useTaskFlowStore } from '../store';
import { db } from '../db';
import { cn } from '../lib/utils';

export function OnboardingOverlay() {
  const settings = useTaskFlowStore(state => state.settings);
  const isOnboardingOpen = useTaskFlowStore(state => state.isOnboardingOpen);
  const setOnboardingOpen = useTaskFlowStore(state => state.setOnboardingOpen);
  
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: "Define Your Range",
      description: "When does your peak cognitive flow happen? TaskFlow schedules tasks based on your energy windows.",
      icon: Clock,
      content: (
        <div className="space-y-6 py-4">
           <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                 <label className="text-[10px] text-ceil uppercase font-bold tracking-widest">Flow Start</label>
                 <input 
                    type="number" 
                    defaultValue={9} 
                    className="w-full bg-deep-space border border-ceil/30 rounded-md p-3 text-2xl font-display text-desert-sand outline-none focus:border-pearly-purple"
                 />
              </div>
              <div className="space-y-1">
                 <label className="text-[10px] text-ceil uppercase font-bold tracking-widest">Flow End</label>
                 <input 
                    type="number" 
                    defaultValue={18} 
                    className="w-full bg-deep-space border border-ceil/30 rounded-md p-3 text-2xl font-display text-desert-sand outline-none focus:border-pearly-purple"
                 />
              </div>
           </div>
           <p className="text-[10px] text-ceil opacity-60 italic text-center">You can refine these in Settings later.</p>
        </div>
      )
    },
    {
      title: "Algorithm Bias",
      description: "How should the algorithm weigh your work? Prioritize deadlines for speed, or priority for quality.",
      icon: MagicWand,
      content: (
        <div className="space-y-6 py-4">
           <div className="space-y-4">
              <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-widest">
                 <span className="text-ceil">Deadline Sensitivity</span>
                 <span className="text-pearly-purple">High (70%)</span>
              </div>
              <div className="h-2 bg-chinese-blue rounded-full">
                 <div className="h-full w-[70%] bg-pearly-purple rounded-full shadow-[0_0_10px_rgba(170,116,160,0.5)]" />
              </div>
           </div>
           <div className="space-y-3 p-4 bg-pearly-purple/10 border border-pearly-purple/30 rounded-lg">
              <p className="text-[11px] text-desert-sand leading-relaxed">
                 TaskFlow uses a **Greedy Earliest Deadline First** logic combined with a priority multiplier.
              </p>
           </div>
        </div>
      )
    },
    {
      title: "Ready for Flow?",
      description: "You're set. Add your first task and let the algorithm handle the cognitive load of scheduling.",
      icon: Play,
      content: (
        <div className="py-8 flex justify-center">
           <div className="relative">
              <div className="absolute inset-0 bg-pearly-purple opacity-20 blur-2xl animate-pulse" />
              <div className="relative bg-chinese-blue/30 border border-pearly-purple/40 p-8 rounded-full flex items-center justify-center">
                <Play size={48} className="text-pearly-purple ml-2" weight="fill" />
              </div>
           </div>
        </div>
      )
    }
  ];

  const handleComplete = async () => {
    const existing = await db.settings.toCollection().first();
    if (existing) {
      await db.settings.update(existing.id!, { onboardingCompleted: true });
    } else {
      await db.settings.add({
        workingHoursStart: 9,
        workingHoursEnd: 18,
        deadlineWeight: 70,
        priorityWeight: 30,
        onboardingCompleted: true
      });
    }
    setOnboardingOpen(false);
  };

  const currentStep = steps[step];

  return (
    <Dialog.Root open={isOnboardingOpen} onOpenChange={setOnboardingOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-chinese-blue/90 backdrop-blur-xl z-[130]" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-deep-space border border-chinese-blue p-10 rounded-2xl shadow-[0_0_50px_rgba(30,33,71,0.5)] z-[140] outline-none">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1.05, y: -10 }}
              transition={{ duration: 0.3 }}
              className="text-center"
            >
              <div className="w-16 h-16 bg-pearly-purple/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-pearly-purple/30">
                <currentStep.icon size={32} className="text-pearly-purple" weight="bold" />
              </div>
              <Dialog.Title className="text-3xl font-display text-desert-sand mb-2">{currentStep.title}</Dialog.Title>
              <p className="text-ceil text-sm max-w-sm mx-auto opacity-70 leading-relaxed mb-8">
                {currentStep.description}
              </p>

              {currentStep.content}

              <div className="mt-12 flex justify-between items-center">
                 <div className="flex gap-2">
                    {steps.map((_, i) => (
                      <div key={i} className={cn(
                        "w-2 h-2 rounded-full transition-all duration-300",
                        step === i ? "bg-pearly-purple w-6" : "bg-ceil/20"
                      )} />
                    ))}
                 </div>
                 <div className="flex gap-4">
                    {step > 0 && (
                      <button 
                        onClick={() => setStep(step - 1)}
                        className="p-3 text-ceil hover:text-desert-sand"
                      >
                         <CaretLeft size={24} />
                      </button>
                    )}
                    {step < steps.length - 1 ? (
                      <button 
                        onClick={() => setStep(step + 1)}
                        className="bg-pearly-purple text-desert-sand px-6 py-2 rounded-md flex items-center gap-2 font-bold text-sm uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-[0_4px_15px_rgba(170,116,160,0.3)]"
                      >
                         Next
                         <CaretRight size={18} />
                      </button>
                    ) : (
                      <button 
                        onClick={handleComplete}
                        className="bg-antique-ruby text-white px-8 py-2 rounded-md font-bold text-sm uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-[0_4px_15px_rgba(133,39,54,0.3)]"
                      >
                         Finish Setup
                      </button>
                    )}
                 </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
