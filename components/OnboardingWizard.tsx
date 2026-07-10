

import React, { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { 
  ArrowRight, Check, Lock, MousePointer2, 
  Dices, Skull, Shield, Sparkles, Key, Dna, Zap 
} from 'lucide-react';

// --- SHARED STYLES ---
const CARD_BASE = "relative overflow-hidden rounded-lg border-2 transition-all duration-300 bg-[#2a2620] border-[#4a453d]";
const TEXT_GOLD = "text-[#fbbf24]";
const TEXT_MUTED = "text-[#888]";

// --- VISUAL DEMO 1: THE LOCK (Concept) ---
const ConceptVisual: React.FC = () => {
  return (
    <div className="relative w-full max-w-[300px] aspect-video bg-[#1a1a1a] rounded-lg border border-white/10 p-4 grid grid-cols-3 gap-2 overflow-hidden shadow-2xl">
      {/* Grid of Locked Skills */}
      {[...Array(9)].map((_, i) => (
        <div key={i} className="bg-[#111] rounded border border-white/5 flex flex-col items-center justify-center relative group">
          <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center mb-1">
             <Lock size={12} className="text-red-500/50" />
          </div>
          <div className="h-1 w-8 bg-white/10 rounded-full"></div>
          
          {/* Scanning Effect */}
          <div className="absolute inset-0 bg-red-500/10 opacity-0 animate-pulse" style={{ animationDelay: `${i * 0.1}s` }}></div>
        </div>
      ))}
      
      {/* Overlay Text */}
      <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-[2px]">
        <div className="text-center">
          <div className="text-3xl font-black text-red-500 tracking-widest drop-shadow-[0_0_10px_rgba(239,68,68,0.8)] animate-pulse">LOCKED</div>
          <div className="text-[10px] text-gray-400 font-mono uppercase mt-1">Fate Decides All</div>
        </div>
      </div>
    </div>
  );
};

// --- VISUAL DEMO 2: THE ROLL (Action Tab) ---
const RollVisual: React.FC = () => {
  const [phase, setPhase] = useState<'idle' | 'hover' | 'click' | 'rolling' | 'result'>('idle');

  useEffect(() => {
    const sequence = async () => {
      setPhase('idle');
      await new Promise(r => setTimeout(r, 1000));
      setPhase('hover');
      await new Promise(r => setTimeout(r, 800));
      setPhase('click');
      await new Promise(r => setTimeout(r, 200));
      setPhase('rolling');
      await new Promise(r => setTimeout(r, 1500));
      setPhase('result');
      await new Promise(r => setTimeout(r, 2000));
      // Loop
      sequence();
    };
    sequence();
  }, []);

  return (
    <div className="relative w-full max-w-[320px] p-6 flex flex-col items-center">
      {/* Fake Slayer Card */}
      <div className={`
        relative w-full h-20 overflow-hidden rounded-lg border-2 transition-all duration-300
        bg-[#142618] border-[#2a4c30]
        ${phase === 'hover' || phase === 'click' ? 'bg-[#1a3320] border-[#3a6640]' : ''}
        ${phase === 'click' ? 'scale-[0.98]' : ''}
      `}>
        {/* Content */}
        <div className="absolute inset-0 flex flex-col justify-center items-start pl-4 z-10">
          <h3 className="font-black text-base uppercase tracking-wider text-[#4ade80]">Mazchna</h3>
          <p className="text-[10px] text-gray-400 font-mono mb-1.5">Canifis (Easy)</p>
          <div className="px-2 py-0.5 rounded text-[10px] font-bold border bg-[#0a150c] border-[#1f3823] text-[#4ade80] flex items-center gap-1.5">
             <Skull size={10} /> 10% Chance
          </div>
        </div>
        
        {/* Rolling Overlay */}
        {phase === 'rolling' && (
           <div className="absolute inset-0 bg-black/80 z-20 flex items-center justify-center gap-2">
              <Dices className="text-yellow-400 animate-spin" size={20} />
              <span className="text-xs font-bold text-yellow-400 font-mono">ROLLING...</span>
           </div>
        )}

        {/* Result Overlay */}
        {phase === 'result' && (
           <div className="absolute inset-0 bg-green-900/90 z-20 flex items-center justify-center gap-2 animate-in fade-in zoom-in">
              <Key className="text-white drop-shadow-[0_0_10px_white]" size={24} />
              <span className="text-sm font-black text-white uppercase tracking-widest">SUCCESS!</span>
           </div>
        )}
      </div>

      {/* Simulated Cursor */}
      <div 
        className="absolute z-50 transition-all duration-700 ease-in-out pointer-events-none drop-shadow-xl"
        style={{
          top: phase === 'idle' ? '120%' : '50%',
          left: phase === 'idle' ? '120%' : '80%',
          transform: `translate(-50%, -50%) ${phase === 'click' ? 'scale(0.8)' : 'scale(1)'}`
        }}
      >
        <MousePointer2 
          className="fill-white text-black" 
          size={32} 
        />
        {phase === 'click' && (
          <div className="absolute -top-2 -left-2 w-12 h-12 rounded-full border-2 border-white animate-ping opacity-50"></div>
        )}
      </div>
    </div>
  );
};

// --- VISUAL DEMO 3: FATE & PITY (Header Mechanics) ---
const FateVisual: React.FC = () => {
  const [fate, setFate] = useState(40);
  const [pityTrigger, setPityTrigger] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setFate(prev => {
        if (prev >= 50) {
          setPityTrigger(true);
          setTimeout(() => {
             setPityTrigger(false);
             setFate(0);
          }, 2000);
          return 50;
        }
        return prev + 2;
      });
    }, 100);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="w-full max-w-[280px] bg-[#1b1b1b] p-4 rounded-xl border border-white/10 shadow-xl flex flex-col gap-4">
      {/* Status Bar Mockup */}
      <div className="w-full">
         <div className="flex justify-between text-[10px] mb-1.5 font-bold uppercase tracking-wider">
            <span className={fate >= 50 ? "text-amber-400 animate-pulse" : "text-gray-500"}>Fate Points</span>
            <span className="text-gray-400">{Math.floor(fate)}/50</span>
         </div>
         <div className="h-3 bg-black/50 rounded-full overflow-hidden border border-white/10 relative">
           <div 
             className={`h-full transition-all duration-100 ease-linear ${fate >= 50 ? 'bg-amber-500 shadow-[0_0_15px_#f59e0b]' : 'bg-red-800'}`} 
             style={{ width: `${(fate / 50) * 100}%` }} 
           />
         </div>
      </div>

      {/* Narrative Text */}
      <div className="text-[10px] text-gray-400 text-center font-mono h-12 flex items-center justify-center">
        {pityTrigger ? (
           <span className="text-amber-400 font-bold animate-bounce uppercase">Max Fate! +1 Guaranteed Key</span>
        ) : (
           <span>Failed rolls grant <span className="text-red-400">Fate</span>.<br/>Bad luck is rewarded.</span>
        )}
      </div>
    </div>
  );
};

// --- VISUAL DEMO 4: THE UNLOCK (Gacha Tab) ---
const UnlockVisual: React.FC = () => {
  const [state, setState] = useState<'locked' | 'click' | 'reveal'>('locked');

  useEffect(() => {
    const loop = async () => {
      setState('locked');
      await new Promise(r => setTimeout(r, 1500));
      setState('click');
      await new Promise(r => setTimeout(r, 500));
      setState('reveal');
      await new Promise(r => setTimeout(r, 2500));
      loop();
    };
    loop();
  }, []);

  return (
    <div className="relative w-full max-w-[260px] flex justify-center">
      {/* Mock Spend Card */}
      <div className={`
        relative overflow-hidden rounded-md border-2 transition-all duration-300 w-full p-3 shadow-lg min-h-[100px] flex flex-col justify-between
        ${state === 'reveal' ? 'bg-[#2a2620] border-[#fbbf24] shadow-[0_0_20px_rgba(251,191,36,0.2)]' : 'bg-[#111] border-[#333]'}
      `}>
        {/* Header */}
        <div className="flex justify-between items-start w-full relative z-10">
          <div className={`p-1.5 rounded bg-[#1a1814] border border-[#3a352e] flex items-center justify-center w-8 h-8 ${state === 'reveal' ? 'text-[#fbbf24]' : 'text-gray-600'}`}>
             <Shield size={18} />
          </div>
          <div className="flex flex-col items-end">
             <span className="text-[8px] text-[#666] font-bold uppercase">Price</span>
             <span className="text-[#fbbf24] font-bold">1 Key</span>
          </div>
        </div>

        {/* Text */}
        <div className="mt-2">
            <h3 className={`text-sm font-bold ${state === 'reveal' ? 'text-white' : 'text-gray-500'}`}>Equipment</h3>
            <p className="text-[9px] text-[#666] uppercase">Unlock Slot</p>
        </div>

        {/* Void Reveal Effect Overlay */}
        {state === 'reveal' && (
            <div className="absolute inset-0 bg-black/80 z-20 flex flex-col items-center justify-center animate-in fade-in duration-300">
                <div className="relative">
                    <div className="absolute inset-0 bg-purple-500 blur-xl opacity-50 animate-pulse"></div>
                    <div className="w-12 h-12 bg-[#2a2620] border-2 border-purple-500 rounded flex items-center justify-center relative z-10 animate-float-up">
                        <img src="https://oldschool.runescape.wiki/images/Head_slot.png" className="w-8 h-8" alt="" />
                    </div>
                </div>
                <span className="text-purple-300 text-[10px] font-bold mt-2 uppercase tracking-widest animate-pulse">Head Slot</span>
            </div>
        )}

        {/* Cursor */}
        <div 
            className="absolute z-50 transition-all duration-500 pointer-events-none"
            style={{
                top: state === 'locked' ? '120%' : '80%',
                left: state === 'locked' ? '120%' : '80%',
                opacity: state === 'reveal' ? 0 : 1
            }}
        >
            <MousePointer2 className="fill-white text-black" size={24} />
            {state === 'click' && (
                <div className="absolute -top-1 -left-1 w-8 h-8 bg-white rounded-full animate-ping opacity-50"></div>
            )}
        </div>
      </div>
    </div>
  );
};

// --- VISUAL DEMO 5: THE ALTAR (Buffs) ---
const AltarVisual: React.FC = () => {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const loop = async () => {
      setActive(false);
      await new Promise(r => setTimeout(r, 1500));
      setActive(true);
      await new Promise(r => setTimeout(r, 2000));
      loop();
    };
    loop();
  }, []);

  return (
    <div className="w-full max-w-[280px] flex flex-col gap-4 items-center">
        {/* Mock Altar Button */}
        <div className={`
            w-full p-3 rounded-lg border-2 flex items-center gap-3 transition-all duration-300 relative overflow-hidden
            ${active 
                ? 'bg-blue-900/30 border-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.3)] scale-[1.02]' 
                : 'bg-[#1a1a1a] border-blue-900/30 opacity-70'}
        `}>
            <div className={`p-2 rounded-full border ${active ? 'bg-blue-500 text-white border-blue-300' : 'bg-[#111] text-blue-900 border-blue-900/50'}`}>
                <Dices size={18} />
            </div>
            <div className="flex-1">
                <div className={`text-xs font-bold uppercase tracking-wider ${active ? 'text-blue-300' : 'text-gray-500'}`}>Ritual of Clarity</div>
                <div className="text-[9px] text-gray-500">Next roll has Advantage</div>
            </div>
            
            {/* Click Effect */}
            {!active && (
                <div className="absolute right-2 bottom-2">
                    <MousePointer2 className="fill-white text-black animate-bounce" size={20} />
                </div>
            )}
        </div>

        {/* Result Indicator */}
        <div className={`
            px-4 py-2 rounded-full border text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-all duration-500
            ${active ? 'opacity-100 translate-y-0 bg-blue-500 text-white border-blue-400 shadow-lg' : 'opacity-0 translate-y-4 bg-transparent border-transparent'}
        `}>
            <Zap size={12} className="fill-current" /> Buff Active
        </div>
    </div>
  );
};

// --- MAIN WIZARD COMPONENT ---

export const OnboardingWizard: React.FC = () => {
  const { completeOnboarding } = useGame();
  const [step, setStep] = useState(0);

  const STEPS = [
    {
      title: "Fate Locked",
      subtitle: "The Concept",
      desc: "You begin with nothing. No skills. No equipment. No map access. Your account is completely locked until Fate decides otherwise.",
      visual: <ConceptVisual />,
      color: "text-red-500",
      bg: "from-red-900/20"
    },
    {
      title: "The Roll",
      subtitle: "Earning Keys",
      desc: "Complete tasks in-game (Slayer, Quests, Clues) then click the matching card. Rolls are based on difficulty. Success grants a Key.",
      visual: <RollVisual />,
      color: "text-green-400",
      bg: "from-green-900/20"
    },
    {
      title: "The Unlocking",
      subtitle: "Spending Keys",
      desc: "Spend your hard-earned Keys to randomly unlock content tiers. Unlocks are permanent and open up new training methods.",
      visual: <UnlockVisual />,
      color: "text-yellow-400",
      bg: "from-yellow-900/20"
    },
    {
      title: "Cruel Fate",
      subtitle: "Pity System",
      desc: "RNG can be cruel. Failed rolls grant Fate Points instead of Keys. Build up enough Fate Points to receive a guaranteed Pity Key — the exact threshold depends on the game mode you pick next.",
      visual: <FateVisual />,
      color: "text-amber-500",
      bg: "from-amber-900/20"
    },
    {
      title: "The Altar",
      subtitle: "Bending Luck",
      desc: "Spend Fate Points at the Void Altar to perform Rituals — roll with Advantage, gamble for double loot, or forge rare keys. And whenever you want every rate, key and ritual in one place, open the Codex from the top bar.",
      visual: <AltarVisual />,
      color: "text-blue-400",
      bg: "from-blue-900/20"
    }
  ];

  const currentStep = STEPS[step];

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
    } else {
      completeOnboarding();
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/95 backdrop-blur-xl p-4 animate-in fade-in duration-500">
      
      {/* Background Ambience */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
         <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-tr ${currentStep.bg} via-transparent to-transparent rounded-full blur-[100px] transition-all duration-1000`}></div>
         <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10"></div>
      </div>

      <div className="relative w-full max-w-4xl h-[600px] bg-[#161616] border border-white/10 rounded-2xl shadow-2xl flex overflow-hidden">
        
        {/* Left: Interactive Visual */}
        <div className="w-1/2 bg-[#0a0a0a] border-r border-white/5 relative flex flex-col items-center justify-center p-8 overflow-hidden">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
            
            <div key={step} className="relative z-10 w-full flex items-center justify-center animate-in zoom-in slide-in-from-bottom-4 duration-500">
                {currentStep.visual}
            </div>

            {/* Pagination Dots */}
            <div className="absolute bottom-8 left-0 w-full flex justify-center gap-2 z-20">
                {STEPS.map((_, i) => (
                    <div 
                        key={i} 
                        className={`w-2 h-2 rounded-full transition-all duration-300 ${i === step ? 'bg-white scale-125' : 'bg-white/20'}`}
                    />
                ))}
            </div>
        </div>

        {/* Right: Content & Controls */}
        <div className="w-1/2 p-12 flex flex-col justify-center relative z-10">
            <div className="mb-auto">
                <span className={`text-xs font-bold uppercase tracking-[0.2em] ${currentStep.color} mb-2 block`}>
                    Step {step + 1} / {STEPS.length}
                </span>
                
                <h1 className="text-4xl font-black text-white mb-2 tracking-tight">
                    {currentStep.title}
                </h1>
                <h2 className="text-xl text-gray-500 font-light mb-6">
                    {currentStep.subtitle}
                </h2>
                
                <p className="text-gray-300 text-lg leading-relaxed border-l-2 border-white/10 pl-6">
                    {currentStep.desc}
                </p>
            </div>

            <div className="mt-12 flex justify-end">
                <button 
                    onClick={handleNext}
                    className="group px-8 py-4 bg-white text-black font-black uppercase tracking-widest rounded-lg hover:bg-gray-200 transition-all flex items-center gap-3 shadow-lg hover:shadow-white/20"
                >
                    {step === STEPS.length - 1 ? "Make Your First Roll" : "Next"}
                    <ArrowRight className="group-hover:translate-x-1 transition-transform" />
                </button>
            </div>
        </div>

      </div>
    </div>
  );
};
