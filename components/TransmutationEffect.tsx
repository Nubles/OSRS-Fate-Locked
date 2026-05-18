
import React, { useEffect, useState } from 'react';
import { Key, Sparkles } from 'lucide-react';

interface TransmutationEffectProps {
  onComplete: () => void;
}

export const TransmutationEffect: React.FC<TransmutationEffectProps> = ({ onComplete }) => {
  const [phase, setPhase] = useState<'summon' | 'converge' | 'explode' | 'reveal'>('summon');

  useEffect(() => {
    // Animation Timeline
    const t1 = setTimeout(() => setPhase('converge'), 1000); // Keys suck into center
    const t2 = setTimeout(() => setPhase('explode'), 2000);  // Explosion flash
    const t3 = setTimeout(() => setPhase('reveal'), 2200);   // Show Omni-Key
    const t4 = setTimeout(() => onComplete(), 6000);         // Auto-close after lingering

    return () => {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4);
    };
  }, [onComplete]);

  // Generate 5 keys arranged in a circle
  const keys = [0, 1, 2, 3, 4].map(i => {
     const angle = (i * 72 - 90) * (Math.PI / 180); // Start at -90deg (top)
     return { id: i, angle };
  });

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-md">
      
      {/* Background Pulse */}
      <div className={`absolute inset-0 transition-colors duration-1000 ${phase === 'explode' ? 'bg-white/10' : 'bg-purple-900/10'}`}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-900/20 via-transparent to-transparent animate-pulse"></div>
      </div>

      <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
        
        {/* Converging Keys */}
        {keys.map((k) => {
            // Radius: Summon = 160px, Converge = 0px
            const radius = phase === 'summon' ? 160 : 0;
            const x = Math.cos(k.angle) * radius;
            const y = Math.sin(k.angle) * radius;
            
            // Visibility logic
            const visible = phase === 'summon' || phase === 'converge';

            return (
                <div 
                    key={k.id}
                    className="absolute flex items-center justify-center transition-all duration-1000 ease-in-out"
                    style={{
                        transform: `translate(${x}px, ${y}px) rotate(${phase === 'converge' ? 720 + (k.id * 72) : k.id * 72}deg)`,
                        opacity: visible ? 1 : 0,
                        scale: visible ? 1 : 0,
                    }}
                >
                    <div className="relative">
                        <Key className="w-16 h-16 text-osrs-gold drop-shadow-[0_0_15px_rgba(251,191,36,0.8)]" />
                        {/* Trailing effect */}
                        <div className="absolute inset-0 bg-yellow-500/30 blur-lg rounded-full animate-pulse"></div>
                    </div>
                </div>
            );
        })}

        {/* Central Singularity (During Converge) */}
        {(phase === 'summon' || phase === 'converge') && (
            <div className={`absolute w-8 h-8 bg-purple-500 rounded-full blur-md transition-all duration-1000 ease-in ${phase === 'converge' ? 'scale-[3] opacity-100 bg-white' : 'scale-0 opacity-0'}`}></div>
        )}

        {/* Explosion Flash */}
        {phase === 'explode' && (
            <div className="absolute inset-0 bg-white animate-flash z-50 mix-blend-screen"></div>
        )}

        {/* Reveal Omni-Key */}
        {phase === 'reveal' && (
            <div className="relative z-50 flex flex-col items-center animate-float-up">
                <div className="relative">
                    {/* Glowing Aura */}
                    <div className="absolute inset-0 bg-purple-600 blur-[80px] opacity-60 animate-pulse"></div>
                    <div className="absolute inset-0 bg-white blur-[30px] opacity-20"></div>
                    
                    <Sparkles className="w-48 h-48 text-purple-300 drop-shadow-[0_0_40px_rgba(192,132,252,1)] relative z-10" />
                    
                    {/* Orbiting particles */}
                    <div className="absolute inset-0 border border-purple-400/30 rounded-full w-80 h-80 -left-16 -top-16 animate-[spin_6s_linear_infinite]">
                        <div className="w-3 h-3 bg-purple-200 rounded-full absolute top-0 left-1/2 -translate-x-1/2 shadow-[0_0_15px_#fff]"></div>
                    </div>
                    <div className="absolute inset-0 border border-purple-400/20 rounded-full w-64 h-64 -left-8 -top-8 animate-[spin_4s_linear_infinite_reverse]">
                         <div className="w-2 h-2 bg-white rounded-full absolute bottom-0 left-1/2 -translate-x-1/2 shadow-[0_0_10px_#fff]"></div>
                    </div>
                </div>

                <div className="mt-12 text-center space-y-3">
                    <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-purple-200 to-purple-400 uppercase tracking-[0.3em] drop-shadow-lg">
                        Transmutation
                    </h2>
                    <div className="h-px w-32 bg-purple-500/50 mx-auto"></div>
                    <p className="text-purple-300 font-mono text-sm tracking-widest font-bold animate-pulse">1 OMNI-KEY FORGED</p>
                    <button 
                         onClick={onComplete}
                         className="mt-8 px-8 py-2 bg-purple-900/50 hover:bg-purple-800/50 border border-purple-500/30 rounded text-purple-200 text-xs font-bold uppercase tracking-widest transition-all"
                    >
                        Collect
                    </button>
                </div>
            </div>
        )}

      </div>
    </div>
  );
};
