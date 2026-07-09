
import React, { useRef, useState } from 'react';
import { useGame } from '../context/GameContext';
import { SectionGuide } from './SectionGuide';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { resolveModeRules } from '../config/gameModes';
import { RITUALS } from '../config/economy';
import { getChunkFrontier, chunkKey, chunkLabel } from '../utils/chunkAdjacency';
import { chunkContentService } from '../services/ChunkContentService';
import { X, Sparkles, Key, Shield, Dices, ArrowRight, Dna, Coins, Skull, Map as MapIcon } from 'lucide-react';

interface VoidAltarProps {
  onClose: () => void;
}

/** A Cartographer candidate: a frontier chunk offered for choosing. */
interface ChunkChoice {
  key: string;
  label: string;
  hint: string | null;
}

export const VoidAltar: React.FC<VoidAltarProps> = ({ onClose }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef);
  const { fatePoints, keys, activeBuff, performRitual, performGambit, performCartographer, unlocks, animationsEnabled, gameModeId, customMode, nextFloat } = useGame();

  // The Gambit is irreversible and stakes everything — arm on first click,
  // fire on the second, disarm when anything else is touched.
  const [gambitArmed, setGambitArmed] = useState(false);
  // Cartographer chooser: null = closed, [] = frontier empty, else 3 options.
  const [chunkChoices, setChunkChoices] = useState<ChunkChoice[] | null>(null);

  // Ritual fate costs scale with the run's game mode (see GameContext reducer).
  const rules = resolveModeRules(gameModeId, customMode);
  const ritualCost = (base: number) => Math.round(base * rules.ritualCostMultiplier);

  // Visual identity per ritual — name, effect and cost all come from
  // config/economy.ts (RITUALS), the same source the reducer and Codex use.
  const RITUAL_UI: Record<string, { icon: any; color: string; border: string; bg: string; costColor: string }> = {
    LUCK:         { icon: Dices,    color: 'text-blue-400',    border: 'border-blue-500/30',    bg: 'bg-blue-900/20',    costColor: 'text-osrs-pity' },
    GREED:        { icon: Coins,    color: 'text-yellow-400',  border: 'border-yellow-500/30',  bg: 'bg-yellow-900/20',  costColor: 'text-osrs-pity' },
    CHAOS:        { icon: Dna,      color: 'text-red-500',     border: 'border-red-500/30',     bg: 'bg-red-900/20',     costColor: 'text-osrs-pity' },
    GAMBIT:       { icon: Skull,    color: 'text-fuchsia-400', border: 'border-fuchsia-500/30', bg: 'bg-fuchsia-950/30', costColor: 'text-osrs-pity' },
    CARTOGRAPHER: { icon: MapIcon,  color: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-900/20', costColor: 'text-osrs-pity' },
    TRANSMUTE:    { icon: Sparkles, color: 'text-purple-400',  border: 'border-purple-500/30',  bg: 'bg-purple-900/20',  costColor: 'text-osrs-gold' },
  };

  const openCartographer = () => {
    // Draw 3 distinct candidates from the live frontier (fewer if it's small).
    const frontier = getChunkFrontier(unlocks.chunks ?? []);
    // Partial Fisher–Yates through the seeded-run choke point: the 3 offered
    // chunks are deterministic per chain tip on a seeded run.
    const pool = [...frontier];
    const shuffled: typeof pool = [];
    for (let i = 0; i < Math.min(3, pool.length); i++) {
      shuffled.push(pool.splice(Math.floor(nextFloat('cartographer', i) * pool.length), 1)[0]);
    }
    setChunkChoices(shuffled.map((c) => {
      const key = chunkKey(c);
      let hint: string | null = null;
      if (chunkContentService.ready) {
        const content = chunkContentService.contentFor(c.cx, c.cy);
        const bits: string[] = [];
        if (chunkContentService.hasBank(c.cx, c.cy)) bits.push('bank');
        if (content && content.shops.length > 0) bits.push(`${content.shops.length} shops`);
        if (content && content.monsters.length > 0) bits.push(`${content.monsters.length} monsters`);
        hint = bits.length > 0 ? bits.join(' · ') : 'quiet terrain';
      }
      return { key, label: chunkLabel(key), hint };
    }));
  };

  const chooseChunk = (choice: ChunkChoice) => {
    performCartographer(choice.key, choice.label);
    setChunkChoices(null);
  };

  const rituals = RITUALS
    .filter((r) => !r.chunkedOnly || gameModeId === 'chunked')
    .map((r) => {
      const fate = r.fateCost ? ritualCost(r.fateCost) : 0;
      const isGambit = r.id === 'GAMBIT';
      return {
        id: r.id,
        name: r.name,
        desc: r.effect,
        cost: r.keyCost ? `${r.keyCost} Keys`
          : isGambit ? `ALL Fate (min ${fate})`
          : `${fate} Fate Points`,
        canAfford: r.keyCost ? keys >= r.keyCost : fatePoints >= fate,
        active: (r.id === 'LUCK' && activeBuff === 'LUCK') || (r.id === 'GREED' && activeBuff === 'GREED'),
        ...RITUAL_UI[r.id],
      };
    });

  const onRitualClick = (id: string) => {
    if (id === 'GAMBIT') {
      if (!gambitArmed) { setGambitArmed(true); return; }
      setGambitArmed(false);
      performGambit();
      return;
    }
    setGambitArmed(false);
    if (id === 'CARTOGRAPHER') { openCartographer(); return; }
    performRitual(id as 'LUCK' | 'GREED' | 'CHAOS' | 'TRANSMUTE');
  };

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
                <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-blue-300 uppercase tracking-widest flex items-center gap-2">The Void Altar <SectionGuide id="VOID_ALTAR" /></h2>
                <p className="text-xs text-purple-400/60 font-mono mt-1">Fate resets when you find a key — spend it while it burns.</p>
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
          {chunkChoices !== null ? (
            /* ── Cartographer chooser ─────────────────────────────────────── */
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="text-center mb-6">
                <h3 className="text-lg font-black text-emerald-300 uppercase tracking-widest">The map unfolds…</h3>
                <p className="text-xs text-gray-400 mt-1">Three paths reveal themselves. Choose where Fate takes you — this is the only say you get.</p>
              </div>
              {chunkChoices.length === 0 ? (
                <p className="text-center text-gray-500 text-sm py-8">The frontier is empty — nothing borders your territory yet.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {chunkChoices.map((c) => (
                    <button
                      key={c.key}
                      onClick={() => chooseChunk(c)}
                      className="group text-left rounded-xl border-2 border-emerald-500/30 bg-emerald-900/10 hover:bg-emerald-900/25 hover:scale-[1.02] hover:shadow-[0_0_25px_rgba(52,211,153,0.2)] transition-all p-5 min-h-[130px] flex flex-col"
                    >
                      <MapIcon size={18} className="text-emerald-400 mb-2" />
                      <div className="font-bold text-emerald-100">{c.label}</div>
                      <div className="text-[11px] text-gray-500 font-mono">({c.key})</div>
                      {c.hint && <div className="text-[11px] text-emerald-300/70 mt-auto pt-2">{c.hint}</div>}
                    </button>
                  ))}
                </div>
              )}
              <div className="text-center mt-6">
                <button onClick={() => setChunkChoices(null)} className="text-xs text-gray-500 hover:text-white underline underline-offset-2">
                  {chunkChoices.length === 0 ? 'Back' : 'Walk away (no Fate spent)'}
                </button>
              </div>
            </div>
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rituals.map((ritual) => {
                const Icon = ritual.icon;
                const armed = ritual.id === 'GAMBIT' && gambitArmed;
                return (
                    <button
                        key={ritual.id}
                        disabled={!ritual.canAfford || ritual.active}
                        onClick={() => onRitualClick(ritual.id)}
                        onBlur={() => { if (ritual.id === 'GAMBIT') setGambitArmed(false); }}
                        className={`
                            relative group flex flex-col h-full text-left rounded-xl border-2 transition-all duration-300 overflow-hidden min-h-[200px]
                            ${ritual.active
                                ? 'border-green-500/50 bg-green-900/10 cursor-default ring-1 ring-green-500 shadow-[0_0_20px_rgba(34,197,94,0.1)]'
                                : armed
                                    ? 'border-fuchsia-400 bg-fuchsia-950/50 ring-2 ring-fuchsia-400/60 shadow-[0_0_30px_rgba(232,121,249,0.35)] cursor-pointer'
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
                                {armed && (
                                    <span className="px-2 py-1 bg-fuchsia-500/20 text-fuchsia-300 text-[10px] font-bold uppercase tracking-wider rounded border border-fuchsia-500/40 animate-pulse">Armed</span>
                                )}
                            </div>

                            <div>
                                <h3 className={`font-bold text-lg mb-1 ${ritual.color}`}>{ritual.name}</h3>
                                <p className="text-xs text-gray-400 leading-relaxed min-h-[40px]">
                                  {armed
                                    ? `${fatePoints} Fate hangs over the Void. Click again to let it decide — or click anywhere else to step back.`
                                    : ritual.desc}
                                </p>
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
          )}
        </div>
      </div>
    </div>
  );
};
