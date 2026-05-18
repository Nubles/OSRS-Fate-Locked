
import React, { useRef } from 'react';
import { X, BookOpen, Lock, Unlock, Star } from 'lucide-react';
import { SKILL_UNLOCK_DATA } from '../data/skillUnlocks';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface SkillDetailModalProps {
  skill: string;
  currentTier: number;
  onClose: () => void;
}

export const SkillDetailModal: React.FC<SkillDetailModalProps> = ({ skill, currentTier, onClose }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef);
  const unlockData = SKILL_UNLOCK_DATA[skill] || {};
  const tiers = Array.from({ length: 10 }, (_, i) => i + 1);

  // Get skill icon url
  const iconUrl = `https://oldschool.runescape.wiki/images/${skill}_icon.png`;

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={`${skill} skill detail`} tabIndex={-1} className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#1a1a1a] border border-white/10 w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="bg-[#222] p-4 border-b border-white/10 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-black/40 rounded-lg border border-white/5 flex items-center justify-center">
                <img src={iconUrl} alt={skill} className="w-6 h-6 object-contain" />
            </div>
            <div>
                <h2 className="text-xl font-bold text-white tracking-wide">{skill} Progression</h2>
                <div className="flex items-center gap-2 text-xs text-gray-400 font-mono mt-0.5">
                    <span className={currentTier > 0 ? "text-green-400" : "text-gray-500"}>
                        Current: Tier {currentTier}
                    </span>
                    <span>•</span>
                    <span>Max: Tier 10</span>
                </div>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors group"
          >
            <X className="w-6 h-6 text-gray-400 group-hover:text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
            
            {/* Description / Flavor (Optional placeholder) */}
            <div className="bg-blue-900/20 border border-blue-500/30 p-4 rounded-lg flex gap-3">
                <BookOpen className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <p className="text-sm text-blue-200/80 leading-relaxed">
                    Unlocking a tier grants access to training methods and equipment requirements within that level range. 
                    You may train beyond your unlocked tier, but you are restricted to using only unlocked content.
                </p>
            </div>

            {/* Tiers Grid/List */}
            <div className="space-y-4">
                {tiers.map((tier) => {
                    const isUnlocked = currentTier >= tier;
                    const isNext = currentTier + 1 === tier;
                    const benefits = unlockData[tier];
                    const range = tier === 10 ? '90-99' : `${(tier - 1) * 10 + (tier === 1 ? 1 : 0)}-${tier * 10 - 1}`;

                    return (
                        <div 
                            key={tier} 
                            className={`
                                relative border rounded-lg overflow-hidden transition-all
                                ${isUnlocked 
                                    ? 'bg-[#1f2937] border-green-500/30 shadow-[0_0_10px_rgba(16,185,129,0.05)]' 
                                    : isNext 
                                        ? 'bg-[#1a1a1a] border-purple-500/40 ring-1 ring-purple-500/20' 
                                        : 'bg-[#111] border-white/5 opacity-60'}
                            `}
                        >
                            {/* Tier Header */}
                            <div className={`
                                px-4 py-2 flex justify-between items-center text-xs font-bold uppercase tracking-wider
                                ${isUnlocked ? 'bg-green-900/20 text-green-400 border-b border-green-500/10' : isNext ? 'bg-purple-900/20 text-purple-300 border-b border-purple-500/10' : 'bg-black/40 text-gray-500 border-b border-white/5'}
                            `}>
                                <div className="flex items-center gap-2">
                                    {isUnlocked ? <Unlock size={14} /> : <Lock size={14} />}
                                    <span>Tier {tier}</span>
                                    <span className="opacity-50">|</span>
                                    <span>Levels {range}</span>
                                </div>
                                {isUnlocked && <span className="flex items-center gap-1"><Star size={12} fill="currentColor" /> Active</span>}
                                {isNext && <span className="flex items-center gap-1 animate-pulse">Next Unlock</span>}
                            </div>

                            {/* Benefits List */}
                            <div className="p-4">
                                {benefits && benefits.length > 0 ? (
                                    <ul className="space-y-2">
                                        {benefits.map((benefit, idx) => (
                                            <li key={idx} className="text-sm text-gray-300 flex items-start gap-2">
                                                <span className={`mt-1.5 w-1 h-1 rounded-full ${isUnlocked ? 'bg-green-500' : 'bg-gray-600'}`}></span>
                                                <span className={isUnlocked ? 'text-gray-200' : 'text-gray-500'}>{benefit}</span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-xs text-gray-600 italic">No specific unlocks recorded for this tier.</p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

        </div>
      </div>
    </div>
  );
};
