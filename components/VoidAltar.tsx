
import React, { useRef } from 'react';
import { useGame } from '../context/GameContext';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { resolveModeRules } from '../config/gameModes';
import { X, Sparkles, Key, Shield, Dices, ArrowRight, Dna, Coins } from 'lucide-react';

interface VoidAltarProps {
  onClose: () => void;
}

export const VoidAltar: React.FC<VoidAltarProps> = ({ onClose }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef);
  const { fatePoints, keys, activeBuff, performRitual, animationsEnabled, gameModeId, customMode } = useGame();

  // Ritual fate costs scale with the run's game mode (see GameContext reducer).
  const rules = resolveModeRules(gameModeId, customMode);
  const ritualCost = (base: number) => Math.round(base * rules.ritualCostMultiplier);
  const luckCost = ritualCost(15);
  const greedCost = ritualCost(30);
  const chaosCost = ritualCost(25);

  const rituals = [
    {
      id: 'LUCK',
      name: 'Ritual of Clarity',
      cost: `${luckCost} Fate Points`,
      desc: 'Your next roll will be rolled twice. The best result is chosen automatically.',
      canAfford: fatePoints >= luckCost,
      active: activeBuff === 'LUCK',
      icon: Dices,
      color: 'text-blue-400',
      border: 'border-blue-500/30',
      bg: 'bg-blue-900/20',
      costColor: 'text-osrs-pity'
    },
    {
      id: 'GREED',
      name: 'Ritual of Greed',
      cost: `${greedCost} Fate Points`,
      desc: `Gamble ${greedCost} Fate Points. If your NEXT roll is successful, receive 2 Keys instead of 1.`,
      canAfford: fatePoints >= greedCost,
      active: activeBuff === 'GREED',
      icon: Coins,
      color: 'text-yellow-400',
      border: 'border-yellow-500/30',
      bg: 'bg-yellow-900/20',
      costColor: 'text-osrs-pity'
    },
    {
      id: 'CHAOS',
      name: 'Ritual of Chaos',
      cost: `${chaosCost} Fate Points`,
      desc: 'Manifest your accumulated misfortune into a single Chaos Key.',
      canAfford: fatePoints >= chaosCost,
      active: false,
      icon: Dna,
      color: 'text-red-500',
      border: 'border-red-500/30',
      bg: 'bg-red-900/20',
      costColor: 'text-osrs-pity'
    },
    {
      id: 'TRANSMUTE',
      name: 'Ritual of Transmutation',
      cost: '5 Keys',
      desc: 'Fuse five standard Keys to forge a single Omni-Key.',
      canAfford: keys >= 5,
      active: false,
      icon: Sparkles,
      color: 'text-purple-400',
      border: 'border-purple-500/30',
      bg: 'bg-purple-900/20',
      costColor: 'text-osrs-gold'
    }
  ];

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Void altar" tabIndex={-1} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <div className="bg-[#121212] border border-purple-900/50 w-full max-w-5xl rounded-xl shadow-[0_0_50px_rgba(88,28,135,0.3)] overflow-hidden flex flex-col relative max-h-[90vh]">
        
        {/* Background Effects */}
        {animationsEnabled && (
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-50%] left-[-20%] w-[800px] h-[800px] bg-purple-900/10 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute bottom-[-20%] right-[-20%] w-[600px] h-[600px] bg-blue-900/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s'}}></div>
            </div>
        )}

        {/* Header */}
        <div className="bg-[#1a1a1a] p-6 border-b border-purple-900/30 flex justify-between items-center relative z-10">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-950 rounded-lg border border-purple-700/50 shadow-inner">
                <Sparkles className={`w-6 h-6 text-purple-400 ${animationsEnabled ? 'animate-spin-slow' : ''}`} />
            </div>
            <div>
                <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-blue-300 uppercase tracking-widest">The Void Altar</h2>
                <p className="text-xs text-purple-400/60 font-mono mt-1">Alter your destiny through sacrifice.</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-full transition-colors text-gray-500 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Resources Bar */}
        <div className="bg-black/40 px-6 py-3 border-b border-white/5 flex gap-6 justify-center font-mono text-sm relative z-10">
            <div className="flex items-center gap-2 text-osrs-pity">
                <Shield size={16} />
                <span>Fate Points: <span className="font-bold text-lg">{fatePoints}</span></span>
            </div>
            <div className="w-px h-6 bg-white/10"></div>
            <div className="flex items-center gap-2 text-osrs-gold">
                <Key size={16} />
                <span>Keys: <span className="font-bold text-lg">{keys}</span></span>
            </div>
        </div>

        {/* Content */}
        <div className="p-8 overflow-y-auto custom-scrollbar relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {rituals.map((ritual) => {
                const Icon = ritual.icon;
                return (
                    <button
                        key={ritual.id}
                        disabled={!ritual.canAfford || ritual.active}
                        onClick={() => performRitual(ritual.id as any)}
                        className={`
                            relative group flex flex-col h-full text-left rounded-xl border-2 transition-all duration-300 overflow-hidden min-h-[220px]
                            ${ritual.active 
                                ? 'border-green-500/50 bg-green-900/10 cursor-default ring-1 ring-green-500 shadow-[0_0_20px_rgba(34,197,94,0.1)]' 
                                : ritual.canAfford 
                                    ? `${ritual.border} ${ritual.bg} hover:scale-[1.02] hover:shadow-xl cursor-pointer`
                                    : 'border-gray-800 bg-gray-900/50 opacity-50 cursor-not-allowed grayscale'
                            }
                        `}
                    >
                        {/* Hover Gradient */}
                        {ritual.canAfford && !ritual.active && (
                            <div className="absolute inset-0 bg-gradient-to-t from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        )}

                        <div className="p-5 flex-1 flex flex-col gap-3">
                            <div className="flex justify-between items-start">
                                <div className={`p-2.5 rounded-lg bg-black/40 border border-white/5 ${ritual.color}`}>
                                    <Icon size={20} />
                                </div>
                                {ritual.active && (
                                    <span className="px-2 py-1 bg-green-500/20 text-green-400 text-[10px] font-bold uppercase tracking-wider rounded border border-green-500/30">Active</span>
                                )}
                            </div>
                            
                            <div>
                                <h3 className={`font-bold text-lg mb-1 ${ritual.color}`}>{ritual.name}</h3>
                                <p className="text-xs text-gray-400 leading-relaxed min-h-[40px]">{ritual.desc}</p>
                            </div>

                            <div className={`mt-auto pt-3 border-t border-white/5 flex items-center justify-between text-xs font-mono font-bold ${ritual.canAfford ? ritual.costColor : 'text-gray-600'}`}>
                                <span>{ritual.cost}</span>
                                {ritual.canAfford && !ritual.active && (
                                    <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                                )}
                            </div>
                        </div>
                    </button>
                );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
