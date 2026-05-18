
import React, { useEffect, useState } from 'react';
import { Coins, Eye, Dna, Zap } from 'lucide-react';

interface EffectProps {
  onComplete: () => void;
}

// --- RITUAL OF CLARITY (LUCK) ---
export const ClarityEffect: React.FC<EffectProps> = ({ onComplete }) => {
  useEffect(() => {
    const timer = setTimeout(onComplete, 2500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-blue-950/40 backdrop-blur-sm">
      {/* Expanding Ripple */}
      <div className="absolute inset-0 bg-blue-500/10 animate-[ping_1.5s_cubic-bezier(0,0,0.2,1)_infinite]"></div>
      
      <div className="relative flex flex-col items-center animate-focus">
         <div className="relative mb-6">
            <div className="absolute inset-0 bg-blue-400 blur-2xl opacity-50 animate-pulse"></div>
            <Eye className="w-32 h-32 text-blue-200 relative z-10 drop-shadow-[0_0_20px_rgba(59,130,246,1)]" strokeWidth={1} />
            {/* Rotating Rings */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border border-blue-400/30 rounded-full animate-[spin_4s_linear_infinite]"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 border border-blue-400/50 rounded-full animate-[spin_3s_linear_infinite_reverse]"></div>
         </div>
         
         <h2 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-300 via-white to-blue-300 tracking-[0.2em] uppercase text-center animate-in fade-in zoom-in duration-1000">
            Vision Cleared
         </h2>
         <p className="mt-2 text-blue-200 font-mono text-sm tracking-widest opacity-80 animate-pulse">ADVANTAGE ACTIVE</p>
      </div>
    </div>
  );
};

// --- RITUAL OF GREED ---
export const GreedEffect: React.FC<EffectProps> = ({ onComplete }) => {
  useEffect(() => {
    const timer = setTimeout(onComplete, 3000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  // Generate random coins
  const coins = Array.from({ length: 30 }).map((_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 1}s`,
    duration: `${0.5 + Math.random()}s`,
    size: Math.random() > 0.5 ? 24 : 32
  }));

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-yellow-950/60 backdrop-blur-sm overflow-hidden">
      
      {/* Coin Rain */}
      {coins.map((coin) => (
        <div 
          key={coin.id}
          className="absolute -top-10 text-yellow-400 animate-rain"
          style={{ 
            left: coin.left, 
            animationDelay: coin.delay,
            animationDuration: coin.duration
          }}
        >
          <Coins size={coin.size} fill="currentColor" className="opacity-80 drop-shadow-md" />
        </div>
      ))}

      <div className="relative z-10 text-center animate-in zoom-in slide-in-from-bottom-10 duration-500">
         <div className="relative inline-block">
             <div className="absolute inset-0 bg-yellow-500 blur-[50px] opacity-40 animate-pulse"></div>
             <Coins className="w-40 h-40 text-yellow-300 drop-shadow-[0_0_30px_rgba(234,179,8,1)] animate-bounce" strokeWidth={1.5} />
         </div>
         
         <div className="mt-8 space-y-2">
            <h2 className="text-5xl font-black text-yellow-400 uppercase tracking-tighter drop-shadow-lg scale-y-125">
               GREED
            </h2>
            <div className="flex items-center justify-center gap-2 text-yellow-200 font-bold bg-black/40 px-4 py-1 rounded-full border border-yellow-500/30 mx-auto w-max">
                <span className="text-xl">2x</span>
                <span className="text-xs uppercase tracking-widest">Rewards Enabled</span>
            </div>
         </div>
      </div>
    </div>
  );
};

// --- RITUAL OF CHAOS ---
export const ChaosEffect: React.FC<EffectProps> = ({ onComplete }) => {
  useEffect(() => {
    const timer = setTimeout(onComplete, 2000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-red-950/80 backdrop-grayscale">
      
      {/* Glitch Background Overlay */}
      <div className="absolute inset-0 bg-red-600/10 animate-pulse mix-blend-overlay"></div>
      
      {/* Random Glitch Lines */}
      <div className="absolute top-[20%] left-0 w-full h-1 bg-red-500/50 animate-glitch"></div>
      <div className="absolute top-[60%] left-0 w-full h-2 bg-white/20 animate-glitch" style={{ animationDirection: 'reverse' }}></div>
      <div className="absolute top-[80%] left-0 w-full h-px bg-red-400/60 animate-glitch"></div>

      <div className="relative z-10 flex flex-col items-center">
         <div className="relative animate-shake">
            <div className="absolute inset-0 bg-red-500 blur-[40px] opacity-60 animate-pulse"></div>
            <Dna className="w-40 h-40 text-red-500 drop-shadow-[0_0_10px_#fff]" />
            <Zap className="absolute top-0 right-0 w-16 h-16 text-white fill-white animate-ping" />
         </div>
         
         <div className="mt-8 text-center relative">
             <h2 className="text-6xl font-black text-white mix-blend-difference tracking-widest animate-glitch" style={{ textShadow: '4px 0 red, -4px 0 cyan' }}>
                 CHAOS
             </h2>
             <p className="text-red-400 font-mono mt-2 uppercase tracking-[0.5em] text-xs">Reality Fractured</p>
         </div>
      </div>
    </div>
  );
};
