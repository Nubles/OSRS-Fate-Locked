
import React, { useEffect, useRef, useState } from 'react';
import { useGame } from '../context/GameContext';
import { SectionGuide } from './SectionGuide';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { resolveModeRules } from '../config/gameModes';
import { BARROWS_BROTHERS, INVOCATIONS, INVOCATION_ROLLS, RITUALS, SACRIFICE_USES_PER_RUN, invocationAllowed, invocationOmniBonus, ritualEffect, ritualFateCost, type Invocation } from '../config/economy';
import { ritualAvailability, rollRitualActive } from '../utils/ritualEffects';
import type { NewRitualId } from '../context/GameContext';
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
  const { fatePoints, keys, activeBuff, performRitual, performGambit, performCartographer, castRitual, rituals: running, unlocks, gameModeId, customMode, nextFloat, runId, history, freeRituals } = useGame();

  // The Gambit and Sacrifice can't be undone: arm on the first click, fire on
  // the second, disarm when anything else is touched.
  const [armedId, setArmedId] = useState<'GAMBIT' | 'SACRIFICE' | null>(null);
  // Amascut's Invocations: null = closed, else the handicaps picked so far.
  const [invocationPick, setInvocationPick] = useState<Invocation['id'][] | null>(null);
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

  const r = running;
  /** What a running ritual still has to do, shown on its card. */
  const runningText = (id: string): string | null => {
    if (id === 'LUCK' && activeBuff === 'LUCK') return 'Active';
    if (id === 'GREED' && activeBuff === 'GREED') return 'Active';
    if (id === 'WARD' && r?.ward) return 'Waiting for your next Key';
    if (id === 'TEARS' && r?.tearsFailsLeft) return `${r.tearsFailsLeft} fails left`;
    if (id === 'PACT' && r?.pactRollsLeft) return `${r.pactRollsLeft} rolls left`;
    if (id === 'PACT' && r?.pactDebt) return `Debt: ${r.pactDebt} Fate`;
    if (id === 'INVOCATIONS' && r?.invocations) return `${r.invocations.rollsLeft} rolls left`;
    if (id === 'BARROWS' && r?.barrows) {
      const name = BARROWS_BROTHERS.find(b => b.id === r.barrows!.brother)?.name.split(' ')[0];
      return `${name}: ${r.barrows.rollsLeft} rolls left`;
    }
    return null;
  };

  const invocationsCost = freeRituals?.includes('INVOCATIONS') ? 0 : ritualFateCost('INVOCATIONS', rules.ritualCostMultiplier);

  const rituals = RITUALS
    .filter((ritual) => !ritual.chunkedOnly || gameModeId === 'chunked')
    .map((ritual) => {
      const fate = ritualFateCost(ritual.id, rules.ritualCostMultiplier);
      const isGambit = ritual.id === 'GAMBIT';
      const isBuff = ritual.id === 'LUCK' || ritual.id === 'GREED';
      const isNew = ritual.god !== undefined || ritual.id === 'INVOCATIONS' || ritual.id === 'BARROWS' || ritual.id === 'SACRIFICE';
      const availability = isNew ? ritualAvailability(ritual.id, ritual.god, { activeBuff, rituals: r, history, unlocks }) : null;
      const status = runningText(ritual.id);
      // Achievements give free rituals; the engine uses one before any Fate.
      const free = (freeRituals ?? []).filter((id) => id === ritual.id).length;
      const sacrificesLeft = SACRIFICE_USES_PER_RUN - (r?.sacrificesUsed ?? 0);
      return {
        id: ritual.id,
        name: ritual.name,
        desc: ritualEffect(ritual.id, rules.ritualCostMultiplier),
        cost: ritual.keyCost ? `${ritual.keyCost} Keys`
          : isGambit ? `ALL Fate (min ${fate})`
          : free > 0 ? `Free (${free} from achievements)`
          : ritual.id === 'PACT' ? 'Free now, pay later'
          : `${fate} Fate Points`,
        canAfford: ritual.keyCost ? keys >= ritual.keyCost : free > 0 || fatePoints >= fate,
        active: status !== null,
        status: status ?? (ritual.id === 'SACRIFICE' && availability?.ok ? `${sacrificesLeft} left this run` : null),
        // Only one ritual can shape the next rolls; buying another would
        // silently replace it and waste its Fate.
        blocked: isBuff
          ? (activeBuff !== ritual.id && rollRitualActive(activeBuff, r) ? 'Another roll ritual is active' : null)
          : status === null && availability && !availability.ok ? availability.reason ?? 'Not available' : null,
      };
    });

  const onRitualClick = (id: string) => {
    if (id === 'GAMBIT' || id === 'SACRIFICE') {
      if (armedId !== id) { setArmedId(id); return; }
      setArmedId(null);
      if (id === 'GAMBIT') performGambit();
      else castRitual('SACRIFICE');
      return;
    }
    setArmedId(null);
    if (id === 'CARTOGRAPHER') { openCartographer(); return; }
    if (id === 'INVOCATIONS') { setInvocationPick([]); return; }
    if (id === 'LUCK' || id === 'GREED' || id === 'CHAOS' || id === 'TRANSMUTE') performRitual(id);
    else castRitual(id as NewRitualId);
  };

  const toggleInvocation = (id: Invocation['id']) =>
    setInvocationPick(picked => picked && (picked.includes(id) ? picked.filter(i => i !== id) : [...picked, id]));
  const invoke = () => {
    if (!invocationPick?.length) return;
    castRitual('INVOCATIONS', INVOCATIONS.filter(i => invocationPick.includes(i.id)).map(i => i.id));
    setInvocationPick(null);
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
          {invocationPick !== null ? (
            /* ── Amascut's Invocations: pick the handicaps ─────────────────── */
            <div className="animate-in fade-in duration-300 p-2">
              <div className="text-center mb-3">
                <h3 className="text-[#ff981f]" style={rsText(RS_BOLD)}>Choose your invocations</h3>
                <p className="text-xs text-[#c9b993] mt-1">Each handicap lasts for your next {INVOCATION_ROLLS} rolls and raises their Omni-Key chance. All four together add more.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                {INVOCATIONS.map((inv) => {
                  const on = invocationPick.includes(inv.id);
                  const allowed = invocationAllowed(inv, fatePoints - invocationsCost);
                  return (
                    <button
                      key={inv.id}
                      aria-pressed={on}
                      disabled={!allowed}
                      onClick={() => toggleInvocation(inv.id)}
                      className={`text-left grid grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-x-2.5 p-2 ${panel} hover:bg-[#352d22] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent ${on ? 'shadow-[inset_0_0_0_1px_#ffff00]' : ''}`}
                    >
                      <span className={`w-4 h-4 border-2 ${on ? 'bg-[#ffd84a] border-[#7a4a00]' : 'bg-[#1d1913] border-[#0d0b08]'}`} />
                      <span className="min-w-0">
                        <span className="block text-[#ff981f]" style={rsText(RS_BOLD)}>{inv.name}</span>
                        <span className="block text-xs text-[#d8ccb0]">{inv.handicap}</span>
                        {!allowed && <span className="block text-xs text-[#ff7070]">Needs {inv.minFateLeft} Fate left after the ritual</span>}
                      </span>
                      <span className="text-[#ffff00]" style={rsText(RS_SMALL)}>+{inv.omniBonus}%</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-center mt-3 text-[#ffff00]" style={rsText(RS_FONT)}>
                Omni-Key chance +{invocationOmniBonus(invocationPick)}% on your next {INVOCATION_ROLLS} rolls
              </p>
              <div className="flex justify-center gap-4 mt-3">
                <button
                  onClick={invoke}
                  disabled={invocationPick.length === 0}
                  className={`px-3 py-1 ${panel} text-[#ff981f] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#352d22]`}
                  style={rsText(RS_FONT)}
                >
                  Invoke ({invocationsCost > 0 ? `${invocationsCost} Fate` : 'free'})
                </button>
                <button onClick={() => setInvocationPick(null)} className="text-xs text-[#c9b993] hover:text-white underline underline-offset-2">
                  Walk away (no Fate spent)
                </button>
              </div>
            </div>
          ) : chunkChoices !== null ? (
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
                const armed = armedId === ritual.id;
                const usable = ritual.canAfford && !ritual.active && !ritual.blocked;
                return (
                    <button
                        key={ritual.id}
                        disabled={!usable}
                        onClick={() => onRitualClick(ritual.id)}
                        onBlur={() => { if (armed) setArmedId(null); }}
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
                          {armed && ritual.id === 'GAMBIT'
                            ? `${fatePoints} Fate hangs over the Void. Click again to let it decide, or click anywhere else to step back.`
                            : armed
                              ? 'Fate will take the top tier of 3 random skills or gear slots. Click again to offer them, or click anywhere else to step back.'
                              : ritual.desc}
                        </p>
                        <div className="flex flex-wrap items-baseline justify-between gap-x-2 border-t border-[#1a1611] pt-1 shadow-[0_-1px_0_#4a4034]" style={rsText(RS_FONT)}>
                            <span className={`whitespace-nowrap ${ritual.canAfford ? 'text-[#ffff00]' : 'text-[#8b8478]'}`}>{ritual.cost}</span>
                            {ritual.status && <span className={ritual.active ? 'text-[#00ff00]' : 'text-[#c9b993]'} style={rsText(RS_SMALL)}>{ritual.status}</span>}
                            {armed && <span className="text-[#ff3a2a]" style={rsText(RS_SMALL)}>Armed</span>}
                            {ritual.blocked && <span className="text-[#8b8478] text-right" style={rsText(RS_SMALL)}>{ritual.blocked}</span>}
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
