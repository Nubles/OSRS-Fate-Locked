import React from 'react';
import { BookOpen, Dices, Sparkles, Shield, HelpCircle } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { resolveModeRules } from '../config/gameModes';

export const FateMechanics: React.FC = () => {
  const { gameModeId, customMode } = useGame();
  const rules = resolveModeRules(gameModeId, customMode);
  return (
    <div className="bg-osrs-panel border border-osrs-border rounded-lg p-6 shadow-lg relative">
      {/* Background Container - Clipped */}
      <div className="absolute inset-0 overflow-hidden rounded-lg pointer-events-none z-0">
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-osrs-gold/5 rounded-full blur-3xl"></div>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/5 relative z-10">
        <div className="p-2 bg-osrs-gold/10 rounded-lg border border-osrs-gold/20 shadow-sm">
          <BookOpen className="w-5 h-5 text-osrs-gold" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-gray-100 text-lg leading-none">Fate Mechanics</h3>
            <div className="group relative flex items-center z-50">
                <HelpCircle className="w-4 h-4 text-gray-500 hover:text-osrs-gold cursor-help transition-colors" />
                <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-[#1a1a1a] border border-osrs-border rounded shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none text-xs text-gray-300 font-normal leading-relaxed">
                   This section explains the core rules of the RNG Ironman mode, including drop rates, special items, and bad luck protection.
                   <div className="absolute left-2 top-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-[#1a1a1a]"></div>
                </div>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1">Understanding the rules of the game</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative z-10">
        {/* Rolling */}
        <div className="bg-black/20 p-4 rounded-lg border border-white/5 hover:bg-emerald-900/10 hover:border-emerald-500/30 transition-all duration-300 group">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-emerald-900/20 rounded-lg border border-emerald-500/20 text-emerald-400 group-hover:scale-110 transition-transform shadow-[0_0_10px_rgba(16,185,129,0.1)] shrink-0">
              <Dices size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold uppercase tracking-wide text-emerald-400 mb-1 group-hover:text-emerald-300 transition-colors">Rolling for Keys</h4>
              <p className="text-xs text-gray-400 leading-relaxed mb-2">
                Complete tasks to roll. Harder tasks have better odds.
              </p>
              <div className="text-[10px] text-emerald-300 bg-emerald-900/30 px-2 py-1 rounded inline-block border border-emerald-500/20 font-mono shadow-sm">
                {rules.omniChanceBase}% Chance: <span className="text-white font-bold">Omni-Key</span>
              </div>
            </div>
          </div>
        </div>

        {/* Omni-Keys */}
        <div className="bg-black/20 p-4 rounded-lg border border-white/5 hover:bg-purple-900/10 hover:border-purple-500/30 transition-all duration-300 group">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-purple-900/20 rounded-lg border border-purple-500/20 text-purple-400 group-hover:scale-110 transition-transform shadow-[0_0_10px_rgba(168,85,247,0.1)] shrink-0">
              <Sparkles size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold uppercase tracking-wide text-purple-400 mb-1 group-hover:text-purple-300 transition-colors">Omni-Keys</h4>
              <p className="text-xs text-gray-400 leading-relaxed mb-2">
                Rare keys that allow you to <b>choose your reward</b> directly.
              </p>
               <div className="text-[10px] text-purple-300 bg-purple-900/30 px-2 py-1 rounded inline-block border border-purple-500/20 font-mono shadow-sm">
                Bypass RNG
              </div>
            </div>
          </div>
        </div>

        {/* Bad Luck Protection */}
        <div className="bg-black/20 p-4 rounded-lg border border-white/5 hover:bg-amber-900/10 hover:border-amber-500/30 transition-all duration-300 group">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-amber-900/20 rounded-lg border border-amber-500/20 text-amber-400 group-hover:scale-110 transition-transform shadow-[0_0_10px_rgba(245,158,11,0.1)] shrink-0">
              <Shield size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold uppercase tracking-wide text-amber-500 mb-1 group-hover:text-amber-400 transition-colors">Bad Luck Protection</h4>
              <p className="text-xs text-gray-400 leading-relaxed mb-2">
                Failed rolls grant <b>Fate Points</b>. 
              </p>
               <div className="text-[10px] text-amber-300 bg-amber-900/30 px-2 py-1 rounded inline-block border border-amber-500/20 font-mono shadow-sm">
                {rules.pityEnabled ? `${rules.pityThreshold} Points = Guaranteed Key` : 'Pity disabled in this mode'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}