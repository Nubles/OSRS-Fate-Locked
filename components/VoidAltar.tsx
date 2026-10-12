
import React, { useEffect, useRef, useState } from 'react';
import { useGame } from '../context/GameContext';
import { SectionGuide } from './SectionGuide';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { resolveModeRules } from '../config/gameModes';
import { RITUALS, ritualEffect, ritualFateCost } from '../config/economy';
import { getChunkFrontier, chunkKey, chunkLabel } from '../utils/chunkAdjacency';
import { chunkContentService } from '../services/ChunkContentService';
import { X } from 'lucide-react';
import { RitualIcon } from './rituals/RitualIcon';
import { loadRitualFonts, RS_BOLD, RS_FONT, RS_SMALL } from './rituals/ritualAssets';

interface VoidAltarProps {
  onClose: () => void;
}

/** A Cartographer candidate: a frontier chunk offered for choosing. */
interface ChunkChoice {
  key: string;
  label: string;
  hint: string | null;
}

/**
 * The last Cartographer offer, pinned to the run's history tip. Offers are
 * drawn when the chooser opens; on an unseeded run each draw is fresh, so
 * without this, walking away and reopening re-rolled them for free. Any
 * committed action moves the tip and allows a new draw.
 */
let pinnedCartographerOffer: { tip: string; keys: string[] } | null = null;

export const VoidAltar: React.FC<VoidAltarProps> = ({ onClose }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef);
  const { fatePoints, keys, activeBuff, performRitual, performGambit, performCartographer, unlocks, gameModeId, customMode, nextFloat, runId, history, freeClarity } = useGame();

  // The Gambit is irreversible and stakes everything — arm on first click,
  // fire on the second, disarm when anything else is touched.
  const [gambitArmed, setGambitArmed] = useState(false);
  // Cartographer chooser: null = closed, [] = frontier empty, else 3 options.
  const [chunkChoices, setChunkChoices] = useState<ChunkChoice[] | null>(null);

  // Ritual fate costs scale with the run's game mode, priced by the same
  // ritualFateCost the engine checks against.
  const rules = resolveModeRules(gameModeId, customMode);

  // The RuneScape fonts for the window's text; system fonts stand in until they load.
  useEffect(() => { void loadRitualFonts(); }, []);

  const openCartographer = () => {
    // Draw 3 distinct candidates from the live frontier (fewer if it's small).
    const frontier = getChunkFrontier(unlocks.chunks ?? [], unlocks);
    const tip = `${runId}:${history.length}:${history[history.length - 1]?.hash ?? ''}`;
    const pinned = pinnedCartographerOffer?.tip === tip
      ? pinnedCartographerOffer.keys
          .map(key => frontier.find(chunk => chunkKey(chunk) === key))
          .filter((chunk): chunk is (typeof frontier)[number] => chunk !== undefined)
      : [];
    let shuffled: typeof frontier;
    if (pinned.length > 0) {
      shuffled = pinned;
    } else {
      // Partial Fisher–Yates through the seeded-run choke point: the 3 offered
      // chunks are deterministic per chain tip on a seeded run. The count is
      // fixed before the loop because splice shrinks the pool.
      const pool = [...frontier];
      shuffled = [];
      const count = Math.min(3, pool.length);
      for (let i = 0; i < count; i++) {
        shuffled.push(pool.splice(Math.floor(nextFloat('cartographer', i) * pool.length), 1)[0]);
      }
      pinnedCartographerOffer = { tip, keys: shuffled.map(chunkKey) };
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
      const fate = ritualFateCost(r.id, rules.ritualCostMultiplier);
      const isGambit = r.id === 'GAMBIT';
      // Achievements can give free Rituals of Clarity; the engine uses one before any Fate.
      const free = r.id === 'LUCK' ? freeClarity ?? 0 : 0;
      return {
        id: r.id,
        name: r.name,
        desc: ritualEffect(r.id, rules.ritualCostMultiplier),
        cost: r.keyCost ? `${r.keyCost} Keys`
          : isGambit ? `ALL Fate (min ${fate})`
          : free > 0 ? `Free (${free} from achievements)`
          : `${fate} Fate Points`,
        canAfford: r.keyCost ? keys >= r.keyCost : free > 0 || fatePoints >= fate,
        active: (r.id === 'LUCK' && activeBuff === 'LUCK') || (r.id === 'GREED' && activeBuff === 'GREED'),
        // Only one buff can wait for the next roll; buying the other would
        // silently replace it and waste its Fate.
        buffPending: (r.id === 'LUCK' || r.id === 'GREED') && activeBuff !== 'NONE' && activeBuff !== r.id,
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

  // An in-game interface window: brown stone panels, orange titles, yellow values.
  const rsText = (font: string): React.CSSProperties => ({ fontFamily: font, fontSize: 16, textShadow: '1px 1px 0 #000', WebkitFontSmoothing: 'none' });
  const panel = 'bg-[#2b251c] border border-[#14110d] shadow-[inset_1px_1px_0_#5c5244,inset_-1px_-1px_0_#000]';
  const slot = 'w-[76px] h-[68px] grid place-items-center bg-[#1d1913] border border-[#0d0b08] shadow-[inset_1px_1px_0_#000,inset_-1px_-1px_0_#4a4034]';

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Void altar" tabIndex={-1} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 animate-in fade-in duration-300">
      <div className="bg-[#3e3529] border-2 border-black w-full max-w-5xl max-h-[90vh] flex flex-col p-1.5 gap-1.5 shadow-[inset_1px_1px_0_#5c5244,inset_-1px_-1px_0_#14110d,0_10px_40px_rgba(0,0,0,0.6)]">

        {/* Title bar */}
        <div className={`relative h-8 shrink-0 flex items-center justify-center ${panel}`}>
          <h2 className="flex items-center gap-2 text-[#ff981f]" style={rsText(RS_BOLD)}>The Void Altar <SectionGuide id="VOID_ALTAR" /></h2>
          <button
            onClick={onClose}
            aria-label="Close the Void Altar"
            className="absolute right-1 top-1 w-6 h-[22px] grid place-items-center bg-[#4a4033] border border-black shadow-[inset_1px_1px_0_#6b5f4d,inset_-1px_-1px_0_#2b241b] text-[#ff981f] hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Resources */}
        <div className="shrink-0 flex flex-wrap justify-center gap-x-6 gap-y-1 px-2 py-1.5 bg-[#1f1a14] border border-[#14110d] shadow-[inset_1px_1px_0_#000] text-[#ff981f]" style={rsText(RS_FONT)}>
          <span>Fate Points: <span className="text-[#ffff00]">{fatePoints}</span></span>
          <span>Keys: <span className="text-[#ffff00]">{keys}</span></span>
        </div>
        <p className="shrink-0 text-center text-xs text-[#c9b993]">A successful roll resets your Fate to 0, so spend it first.</p>

        {/* Content */}
        <div className="overflow-y-auto custom-scrollbar">
          {chunkChoices !== null ? (
            /* ── Cartographer chooser ─────────────────────────────────────── */
            <div className="animate-in fade-in duration-300 p-2">
              <div className="text-center mb-3">
                <h3 className="text-[#ff981f]" style={rsText(RS_BOLD)}>Choose a chunk</h3>
                <p className="text-xs text-[#c9b993] mt-1">Pick the frontier chunk to unlock. This is the only way to choose land in Chunked.</p>
              </div>
              {chunkChoices.length === 0 ? (
                <p className="text-center text-[#c9b993] text-sm py-8">The frontier is empty: no chunk next to your land is left to unlock.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-1.5">
                  {chunkChoices.map((c) => (
                    <button
                      key={c.key}
                      onClick={() => chooseChunk(c)}
                      className={`text-left grid grid-cols-[76px_minmax(0,1fr)] gap-x-2.5 p-2 min-h-[90px] ${panel} hover:bg-[#352d22] hover:shadow-[inset_0_0_0_1px_#8f7f5f,inset_-1px_-1px_0_#000]`}
                    >
                      <div className={slot}><RitualIcon id="CARTOGRAPHER" /></div>
                      <div className="min-w-0">
                        <div className="text-[#ff981f]" style={rsText(RS_BOLD)}>{c.label}</div>
                        <div className="text-[#ffff00]" style={rsText(RS_SMALL)}>({c.key})</div>
                        {c.hint && <div className="text-xs text-[#d8ccb0] mt-1">{c.hint}</div>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <div className="text-center mt-4">
                <button onClick={() => setChunkChoices(null)} className="text-xs text-[#c9b993] hover:text-white underline underline-offset-2">
                  {chunkChoices.length === 0 ? 'Back' : 'Walk away (no Fate spent)'}
                </button>
              </div>
            </div>
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1.5">
            {rituals.map((ritual) => {
                const armed = ritual.id === 'GAMBIT' && gambitArmed;
                const usable = ritual.canAfford && !ritual.active && !ritual.buffPending;
                return (
                    <button
                        key={ritual.id}
                        disabled={!usable}
                        onClick={() => onRitualClick(ritual.id)}
                        onBlur={() => { if (ritual.id === 'GAMBIT') setGambitArmed(false); }}
                        className={`grid grid-cols-[76px_minmax(0,1fr)] grid-rows-[auto_1fr_auto] gap-x-2.5 p-2 text-left min-h-[132px] ${panel} ${
                          ritual.active
                            ? 'shadow-[inset_0_0_0_1px_#00ff00] cursor-default'
                            : armed
                              ? 'bg-[#3a2a12] shadow-[inset_0_0_0_2px_#ffff00] cursor-pointer'
                              : usable
                                ? 'cursor-pointer hover:bg-[#352d22] hover:shadow-[inset_0_0_0_1px_#8f7f5f,inset_-1px_-1px_0_#000]'
                                : 'opacity-50 grayscale cursor-not-allowed'
                        }`}
                    >
                        <div className={`row-span-3 ${slot}`}><RitualIcon id={ritual.id} /></div>
                        <h3 className="text-[#ff981f] leading-[18px]" style={rsText(RS_BOLD)}>{ritual.name}</h3>
                        <p className="text-[12.5px] leading-[1.45] text-[#d8ccb0] mt-1 mb-1.5">
                          {armed
                            ? `${fatePoints} Fate hangs over the Void. Click again to let it decide, or click anywhere else to step back.`
                            : ritual.desc}
                        </p>
                        <div className="flex items-baseline justify-between gap-2 border-t border-[#1a1611] pt-1 shadow-[0_-1px_0_#4a4034]" style={rsText(RS_FONT)}>
                            <span className={ritual.canAfford ? 'text-[#ffff00]' : 'text-[#8b8478]'}>{ritual.cost}</span>
                            {ritual.active && <span className="text-[#00ff00]" style={rsText(RS_SMALL)}>Active</span>}
                            {armed && <span className="text-[#ff3a2a]" style={rsText(RS_SMALL)}>Armed</span>}
                            {ritual.buffPending && <span className="text-[#8b8478]" style={rsText(RS_SMALL)}>Other buff active</span>}
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
