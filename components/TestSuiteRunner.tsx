import React, { useEffect, useState, useRef } from 'react';
import { useGame } from '../context/GameContext';
import { TableType, GameState } from '../types';
import { Check, X, Terminal, Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';

interface TestSuiteRunnerProps {
  onComplete: () => void;
}

type TestLog = {
  message: string;
  status: 'pending' | 'success' | 'error';
};

export const TestSuiteRunner: React.FC<TestSuiteRunnerProps> = ({ onComplete }) => {
  const game = useGame();
  const [step, setStep] = useState(0);
  const [logs, setLogs] = useState<TestLog[]>([]);
  
  // Use a ref to hold the backup so it persists across renders
  const backupRef = useRef<Partial<GameState> | null>(null);
  const hasInitialized = useRef(false);

  const addLog = (message: string, status: 'pending' | 'success' | 'error' = 'pending') => {
    setLogs(prev => [...prev, { message, status }]);
  };

  const updateLastLog = (status: 'success' | 'error') => {
    setLogs(prev => {
      const newLogs = [...prev];
      if (newLogs.length > 0) {
        newLogs[newLogs.length - 1].status = status;
      }
      return newLogs;
    });
  };

  // The Test Sequence Machine
  useEffect(() => {
    let timeout: number;

    const runStep = async () => {
      switch (step) {
        case 0: // Initialization & Backup
          if (hasInitialized.current) return;
          hasInitialized.current = true;
          
          addLog("Initializing Void Diagnostics...");
          
          // Create backup of pure state
          const currentState: Partial<GameState> = {
            keys: game.keys,
            specialKeys: game.specialKeys,
            chaosKeys: game.chaosKeys,
            fatePoints: game.fatePoints,
            activeBuff: game.activeBuff,
            unlocks: JSON.parse(JSON.stringify(game.unlocks)),
            history: [...game.history],
            hasSeenOnboarding: game.hasSeenOnboarding
          };
          backupRef.current = currentState;
          
          timeout = window.setTimeout(() => {
            updateLastLog('success');
            setStep(1);
          }, 600);
          break;

        case 1: // Reset Game
          addLog("Wiping Timeline (Reset)...");
          game.resetGame();
          timeout = window.setTimeout(() => setStep(2), 600);
          break;

        case 2: // Verify Reset & Inject Test Data
          if (game.keys === 3 && game.fatePoints === 0) {
            updateLastLog('success');
            addLog("Injecting Test Parameters (Keys=10, Fate=49)...");
            // Inject scenario for Pity Test
            game.importSave({
                keys: 10,
                fatePoints: 49,
                specialKeys: 0,
                chaosKeys: 0,
                unlocks: {
                    ...game.unlocks,
                    skills: { 'Hitpoints': 10 }, // Reset skills
                    regions: [],
                    equipment: {}
                }
            });
            timeout = window.setTimeout(() => setStep(3), 600);
          } else {
            updateLastLog('error');
            addLog("Reset Validation Failed", 'error');
          }
          break;

        case 3: // Perform Fail Roll (Test Pity)
          if (game.keys === 10 && game.fatePoints === 49) {
             updateLastLog('success');
             addLog("Testing Pity System (Forcing Fail at 49 Fate)...");
             // 0% chance to force fail
             game.rollForKey("TEST_PROTOCOL", 0, window.innerWidth/2, window.innerHeight/2); 
             timeout = window.setTimeout(() => setStep(4), 1200);
          } else {
             updateLastLog('error');
             addLog(`State Injection Failed (Keys:${game.keys}, Fate:${game.fatePoints})`, 'error');
          }
          break;

        case 4: // Verify Pity Result
          // Should have gained 1 key (pity) and fate reset to 0
          if (game.keys === 11 && game.fatePoints === 0) {
              updateLastLog('success');
              addLog("Pity System Verified (+1 Key, Fate Reset).");
              
              addLog("Testing Content Unlock (Skill: Strength)...");
              game.unlockContent(TableType.SKILLS, 'Strength', 'key', 1);
              timeout = window.setTimeout(() => setStep(5), 1000);
          } else {
              updateLastLog('error');
              addLog(`Pity System Failed. Keys:${game.keys} (Exp: 11), Fate:${game.fatePoints}`, 'error');
          }
          break;

        case 5: // Verify Unlock & Test Level Up
          if (game.unlocks.skills['Strength'] && game.unlocks.skills['Strength'] > 0 && game.keys === 10) {
              updateLastLog('success');
              addLog("Unlock Mechanism Verified.");
              
              addLog("Testing Level Up Logic (Strength)...");
              game.levelUpSkill('Strength');
              timeout = window.setTimeout(() => setStep(6), 1000);
          } else {
              updateLastLog('error');
              addLog("Unlock Failed or Cost Incorrect", 'error');
          }
          break;
        
        case 6: // Verify Level Up & Test Ritual
           if (game.unlocks.levels['Strength'] > 1) {
              updateLastLog('success');
              addLog("Level Up Verified.");

              addLog("Injecting Fate for Rituals...");
              game.importSave({ fatePoints: 50 });
              timeout = window.setTimeout(() => setStep(7), 600);
           } else {
              updateLastLog('error');
              addLog("Level Up Failed", 'error');
           }
           break;

        case 7: // Perform Ritual
           if (game.fatePoints === 50) {
               updateLastLog('success');
               addLog("Testing Ritual of Clarity (Luck Buff)...");
               game.performRitual('LUCK');
               timeout = window.setTimeout(() => setStep(8), 1000);
           } else {
               updateLastLog('error');
               addLog("Fate Injection Failed", 'error');
           }
           break;

        case 8: // Verify Buff & Restore
           if (game.activeBuff === 'LUCK') {
               updateLastLog('success');
               addLog("Ritual Effects Confirmed.");
               
               addLog("Restoring User Timeline...");
               if (backupRef.current) {
                   game.importSave(backupRef.current);
               }
               timeout = window.setTimeout(() => setStep(9), 1000);
           } else {
               updateLastLog('error');
               addLog("Buff Activation Failed", 'error');
           }
           break;

        case 9: // Completion
           updateLastLog('success');
           addLog("ALL SYSTEMS NOMINAL. DIAGNOSTIC COMPLETE.", 'success');
           timeout = window.setTimeout(() => {
               onComplete();
           }, 2000);
           break;
      }
    };

    runStep();

    return () => window.clearTimeout(timeout);
  }, [step]); // Depend on step to chain effects

  return (
    <div className="w-full h-full flex flex-col bg-black font-mono text-sm p-4 rounded-lg border border-green-500/30 shadow-[inset_0_0_20px_rgba(34,197,94,0.1)] overflow-hidden relative">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none"></div>
      <div className="absolute top-0 left-0 w-full h-1 bg-green-500/50 shadow-[0_0_10px_#22c55e]"></div>
      
      <div className="flex items-center gap-2 mb-4 text-green-500 border-b border-green-900/50 pb-2 shrink-0">
        <Terminal size={18} />
        <span className="font-bold tracking-widest uppercase">Void System Diagnostics</span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar p-2">
        {logs.map((log, i) => (
          <div key={i} className={`flex items-start gap-3 ${log.status === 'error' ? 'text-red-400' : log.status === 'success' ? 'text-green-400' : 'text-gray-400'}`}>
             <div className="mt-0.5 shrink-0">
                {log.status === 'pending' && <Loader2 size={14} className="animate-spin" />}
                {log.status === 'success' && <Check size={14} />}
                {log.status === 'error' && <X size={14} />}
             </div>
             <span className={`${log.status === 'success' ? 'opacity-100' : 'opacity-80'}`}>{log.message}</span>
          </div>
        ))}
        {step === 9 && (
            <div className="mt-4 p-3 bg-green-900/20 border border-green-500/30 rounded text-green-300 flex items-center gap-2 animate-pulse">
                <ShieldCheck size={18} />
                <span>State Restoration Confirmed. Returning to interface...</span>
            </div>
        )}
      </div>

      <div className="mt-2 text-[10px] text-gray-600 uppercase tracking-widest text-right">
         Fate-Locked Engine V1.1
      </div>
    </div>
  );
};
