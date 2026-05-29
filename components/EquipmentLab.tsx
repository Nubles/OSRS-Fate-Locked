import React, { useState, useMemo } from 'react';
import {
  X, Sparkles, ChevronsUp, Crown, AlertCircle, Shield, Gauge,
  Swords, Crosshair, Wand2, Heart, RotateCcw, Plus, Minus, SlidersHorizontal, Lock,
} from 'lucide-react';
import { useGame } from '../context/GameContext';
import { EQUIPMENT_SLOTS, EQUIPMENT_TIER_MAX, SLOT_CONFIG } from '../constants';
import { NoteTrigger } from './NoteTrigger';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { computeCombatPower, overallCombatPower, TIER_LABELS, PowerAxisKey } from '../utils/combatPower';
import { EQUIP_TIER_COLORS, equipTierColor } from '../utils/equipTiers';
import { GearView } from './GearView';

const slotImg = (slot: string) =>
  `https://oldschool.runescape.wiki/images/${SLOT_CONFIG[slot]?.file ?? 'Globe_icon.png'}`;

const AXIS_ICON: Record<PowerAxisKey, typeof Swords> = {
  melee: Swords, ranged: Crosshair, magic: Wand2, defence: Shield, prayer: Heart,
};
const AXIS_BAR: Record<PowerAxisKey, string> = {
  melee: 'bg-red-500', ranged: 'bg-emerald-500', magic: 'bg-blue-500',
  defence: 'bg-slate-400', prayer: 'bg-amber-400',
};

interface Props {
  /** Kick off the existing Omni-key upgrade flow (confirm + reveal) for a slot. */
  onUpgrade: (slot: string) => void;
}

export const EquipmentLab: React.FC<Props> = ({ onUpgrade }) => {
  const { unlocks, specialKeys } = useGame();
  const equipment = unlocks.equipment;

  const [mode, setMode] = useState<'tiers' | 'gear'>('tiers');
  const [selected, setSelected] = useState<string | null>(null);
  const [planMode, setPlanMode] = useState(false);
  const [targets, setTargets] = useState<Record<string, number>>({});

  const totalEquipTiers = useMemo(
    () => EQUIPMENT_SLOTS.reduce((a, s) => a + (equipment[s] || 0), 0),
    [equipment],
  );
  const maxPossible = EQUIPMENT_SLOTS.length * EQUIPMENT_TIER_MAX;

  const stats = useMemo(() => {
    const entries = EQUIPMENT_SLOTS.map((slot) => ({ slot, tier: equipment[slot] || 0 }));
    const weakest = entries.reduce((lo, e) => (e.tier < lo.tier ? e : lo), entries[0]);
    return {
      entries,
      weakest,
      maxed: entries.filter((e) => e.tier >= EQUIPMENT_TIER_MAX).length,
      unlocked: entries.filter((e) => e.tier > 0).length,
      avg: totalEquipTiers / EQUIPMENT_SLOTS.length,
      pct: Math.round((totalEquipTiers / maxPossible) * 100),
    };
  }, [equipment, totalEquipTiers, maxPossible]);

  const power = useMemo(() => computeCombatPower(unlocks), [unlocks]);
  const overall = useMemo(() => overallCombatPower(unlocks), [unlocks]);

  // ── Loadout planner ──────────────────────────────────────────────────────
  const targetFor = (slot: string) => Math.max(targets[slot] ?? (equipment[slot] || 0), equipment[slot] || 0);
  const planCost = useMemo(
    () => EQUIPMENT_SLOTS.reduce((sum, s) => sum + Math.max(0, targetFor(s) - (equipment[s] || 0)), 0),
    [targets, equipment],
  );
  const setTarget = (slot: string, value: number) =>
    setTargets((t) => ({ ...t, [slot]: Math.min(EQUIPMENT_TIER_MAX, Math.max(equipment[slot] || 0, value)) }));
  const resetPlan = () => setTargets({});
  const maxPlan = () => setTargets(Object.fromEntries(EQUIPMENT_SLOTS.map((s) => [s, EQUIPMENT_TIER_MAX])));

  const enterPlan = () => { resetPlan(); setPlanMode(true); };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex justify-between items-center bg-[#151515] p-2 rounded border border-white/5 mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <h3 className="text-gray-300 font-bold text-sm">Equipment Lab</h3>
          {/* Tiers / Gear mode toggle */}
          <div className="flex items-center rounded-lg border border-white/10 bg-[#1f1f1f] p-0.5">
            {(['tiers', 'gear'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide transition-colors ${
                  mode === m ? 'bg-[#322a1e] text-amber-300' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {m === 'tiers' ? 'Tiers' : 'Gear'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {mode === 'tiers' && (
            <>
              <span className="text-xs text-gray-500 font-mono">{totalEquipTiers}/{maxPossible} Tiers</span>
              <button
                onClick={() => (planMode ? setPlanMode(false) : enterPlan())}
                className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[10px] font-bold uppercase tracking-wide transition-colors ${
                  planMode
                    ? 'border-cyan-500/50 bg-cyan-950/40 text-cyan-300'
                    : 'border-white/10 bg-[#1f1f1f] text-gray-400 hover:text-gray-200'
                }`}
                title="Plan a target loadout and see the Omni-Key cost"
              >
                <SlidersHorizontal size={11} /> {planMode ? 'Done' : 'Plan'}
              </button>
            </>
          )}
        </div>
      </div>

      {mode === 'gear' && <GearView />}

      {mode === 'tiers' && (
      <>
      {/* Paper-doll */}
      <div className="shrink-0 flex items-center justify-center bg-[#1a1814] rounded-lg border border-[#3a352e] shadow-inner relative min-h-[420px] py-6 overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{ background: 'radial-gradient(ellipse 55% 60% at 50% 45%, rgba(133,112,72,0.16), transparent 70%)' }}
        />
        <div className="grid grid-cols-3 gap-6 w-max relative z-10">
          {EQUIPMENT_SLOTS.map((slot) => {
            const tier = equipment[slot] || 0;
            const isUnlocked = tier > 0;
            const canUnlock = tier < EQUIPMENT_TIER_MAX && specialKeys > 0;
            const config = SLOT_CONFIG[slot];
            if (!config) return null;
            return (
              <div key={slot} className={`${config.gridArea} relative group`}>
                <button
                  onClick={() => setSelected(slot)}
                  className={`
                    w-20 h-20 relative flex items-center justify-center rounded-lg bg-[#28241d] border-2 border-[#453f36] shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)] transition-all duration-150 cursor-pointer hover:scale-105 hover:border-[#857048]
                    ${canUnlock ? 'ring-1 ring-purple-400/50 hover:ring-2 hover:ring-purple-400/80 z-20' : ''}
                    ${isUnlocked ? 'border-[#857048] bg-[#322a1e]' : ''}
                  `}
                  title={`${slot}: Tier ${tier} — click for details`}
                >
                  <img
                    src={slotImg(slot)}
                    alt={slot}
                    className={`w-10 h-10 object-contain drop-shadow-md transition-all duration-300 ${isUnlocked ? 'opacity-100 brightness-110 scale-110' : 'opacity-20 grayscale scale-90 group-hover:opacity-40'}`}
                  />
                  <div className={`absolute -bottom-3 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border shadow-md transition-colors ${isUnlocked ? 'bg-[#3d3322] text-[#fbbf24] border-[#fbbf24]/30' : 'bg-[#151515] text-gray-600 border-gray-700'}`}>
                    T{tier}
                  </div>
                  {canUnlock && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-purple-600 border border-purple-300/50 flex items-center justify-center shadow-md">
                      <ChevronsUp size={10} strokeWidth={3} className="text-white" />
                    </span>
                  )}
                </button>
                <div className="absolute top-0 left-0 z-30 opacity-0 group-hover:opacity-100 transition-opacity">
                  <NoteTrigger id={`Equip_${slot}`} title={slot} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Combat Power */}
      <div className="mt-4 bg-[#151515] border border-white/10 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-[11px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
            <Gauge size={12} className="text-amber-300" /> Combat Power
          </h4>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-black text-amber-300 leading-none">{overall}</span>
            <span className="text-[9px] text-gray-600 font-mono">/100</span>
          </div>
        </div>
        <div className="space-y-1.5">
          {power.map((r) => {
            const Icon = AXIS_ICON[r.key];
            return (
              <div key={r.key} className="flex items-center gap-2.5">
                <Icon size={12} className="text-gray-500 shrink-0" />
                <span className="text-[10px] font-semibold text-gray-400 w-14 shrink-0">{r.label}</span>
                <div className="flex-1 h-2 bg-black/50 rounded-full overflow-hidden border border-white/5">
                  <div className={`h-full rounded-full transition-all duration-500 ${AXIS_BAR[r.key]}`} style={{ width: `${r.value}%` }} />
                </div>
                <span className="text-[9px] font-mono font-bold text-gray-300 w-6 text-right shrink-0">{r.value}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Lower panel: breakdown OR planner */}
      {planMode ? (
        <div className="mt-4 bg-[#151515] border border-cyan-500/20 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-widest text-cyan-300 flex items-center gap-1.5">
              <SlidersHorizontal size={12} /> Target loadout
            </span>
            <div className="flex items-center gap-1.5">
              <button onClick={resetPlan} className="px-2 py-1 rounded border border-white/10 bg-[#1f1f1f] text-gray-400 hover:text-gray-200 text-[10px] font-bold flex items-center gap-1"><RotateCcw size={10} /> Reset</button>
              <button onClick={maxPlan} className="px-2 py-1 rounded border border-yellow-500/30 bg-yellow-950/30 text-yellow-300 hover:bg-yellow-900/40 text-[10px] font-bold flex items-center gap-1"><Crown size={10} /> Max</button>
            </div>
          </div>

          <div className="space-y-1.5">
            {EQUIPMENT_SLOTS.map((slot) => {
              const cur = equipment[slot] || 0;
              const tgt = targetFor(slot);
              return (
                <div key={slot} className="flex items-center gap-2">
                  <img src={slotImg(slot)} alt="" className={`w-4 h-4 object-contain shrink-0 ${cur > 0 ? '' : 'grayscale opacity-40'}`} />
                  <span className="text-[10px] font-semibold w-14 shrink-0 text-gray-300">{slot}</span>
                  <div className="flex gap-px flex-1 h-1.5 bg-black/50 rounded-sm overflow-hidden border border-white/5">
                    {Array.from({ length: EQUIPMENT_TIER_MAX }).map((_, i) => (
                      <div
                        key={i}
                        className={`flex-1 transition-all duration-300 ${
                          cur > i ? equipTierColor(cur) : tgt > i ? 'bg-cyan-500/30' : 'bg-[#1a1a1a]'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => setTarget(slot, tgt - 1)} disabled={tgt <= cur} className="w-5 h-5 rounded bg-[#1f1f1f] border border-white/10 text-gray-400 disabled:opacity-30 hover:text-white flex items-center justify-center"><Minus size={10} /></button>
                    <span className="text-[10px] font-mono font-bold w-6 text-center text-cyan-200">T{tgt}</span>
                    <button onClick={() => setTarget(slot, tgt + 1)} disabled={tgt >= EQUIPMENT_TIER_MAX} className="w-5 h-5 rounded bg-[#1f1f1f] border border-white/10 text-gray-400 disabled:opacity-30 hover:text-white flex items-center justify-center"><Plus size={10} /></button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className={`flex items-center justify-between rounded-lg px-3 py-2 border ${planCost === 0 ? 'border-white/5 bg-[#1a1a1a]' : planCost <= specialKeys ? 'border-emerald-500/30 bg-emerald-950/30' : 'border-amber-500/30 bg-amber-950/30'}`}>
            <span className="text-[10px] uppercase tracking-wide text-gray-400">This loadout needs</span>
            <span className="flex items-center gap-1.5 text-[12px] font-bold">
              <Sparkles size={12} className="text-purple-400" />
              <span className={planCost === 0 ? 'text-gray-400' : planCost <= specialKeys ? 'text-emerald-300' : 'text-amber-300'}>{planCost}</span>
              <span className="text-gray-600 font-mono text-[10px]">Omni · have {specialKeys}</span>
            </span>
          </div>
        </div>
      ) : (
        <div className="mt-4 bg-[#151515] border border-white/10 rounded-xl p-4 space-y-4">
          {/* summary + legend */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: 'Gear', value: `${stats.pct}%`, sub: `${totalEquipTiers}/${maxPossible}`, color: 'text-amber-300' },
              { label: 'Avg Tier', value: stats.avg.toFixed(1), sub: `${stats.unlocked}/${EQUIPMENT_SLOTS.length} used`, color: 'text-gray-200' },
              { label: 'Maxed', value: `${stats.maxed}`, sub: `at T${EQUIPMENT_TIER_MAX}`, color: 'text-yellow-400' },
              { label: 'Weakest', value: stats.weakest.slot, sub: `T${stats.weakest.tier}`, color: 'text-red-300' },
            ].map((t) => (
              <div key={t.label} className="bg-[#1a1a1a] border border-white/5 rounded-lg px-3 py-2 hover-lift">
                <div className="text-[9px] uppercase tracking-widest text-gray-500 mb-0.5">{t.label}</div>
                <div className={`text-sm font-bold truncate ${t.color}`} title={t.value}>{t.value}</div>
                <div className="text-[9px] text-gray-600 font-mono">{t.sub}</div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[9px] uppercase tracking-widest text-gray-500 mr-1">Low</span>
            {EQUIP_TIER_COLORS.map((c, i) => (
              <div key={i} className="flex flex-col items-center gap-0.5" title={`Tier ${i + 1} · ${TIER_LABELS[i]}`}>
                <div className={`w-4 h-2.5 rounded-sm ${c}`} />
                <span className="text-[8px] text-gray-600 font-mono leading-none">{i + 1}</span>
              </div>
            ))}
            <span className="text-[9px] uppercase tracking-widest text-gray-500 ml-1">Max</span>
          </div>

          <div className="space-y-1.5">
            {stats.entries.map(({ slot, tier }) => (
              <div key={slot} className="flex items-center gap-2.5">
                <img src={slotImg(slot)} alt="" className={`w-4 h-4 object-contain shrink-0 ${tier > 0 ? '' : 'grayscale opacity-40'}`} />
                <span className={`text-[10px] font-semibold w-14 shrink-0 ${tier > 0 ? 'text-gray-300' : 'text-gray-600'}`}>{slot}</span>
                <div className="flex gap-px flex-1 h-1.5 bg-black/50 rounded-sm overflow-hidden border border-white/5">
                  {Array.from({ length: EQUIPMENT_TIER_MAX }).map((_, i) => (
                    <div key={i} className={`flex-1 transition-all duration-500 ${tier > i ? equipTierColor(tier) : 'bg-[#1a1a1a]'}`} />
                  ))}
                </div>
                <span className={`text-[9px] font-mono font-bold w-7 text-right shrink-0 ${tier >= EQUIPMENT_TIER_MAX ? 'text-yellow-400' : tier > 0 ? 'text-amber-300/80' : 'text-gray-600'}`}>T{tier}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Slot detail popover */}
      {selected && (
        <SlotDetail
          slot={selected}
          tier={equipment[selected] || 0}
          specialKeys={specialKeys}
          onClose={() => setSelected(null)}
          onUpgrade={() => { onUpgrade(selected); setSelected(null); }}
        />
      )}
      </>
      )}
    </div>
  );
};

// ── Slot detail popover ──────────────────────────────────────────────────────
interface SlotDetailProps {
  slot: string;
  tier: number;
  specialKeys: number;
  onClose: () => void;
  onUpgrade: () => void;
}

const SlotDetail: React.FC<SlotDetailProps> = ({ slot, tier, specialKeys, onClose, onUpgrade }) => {
  useEscapeKey(onClose, true);
  const isMaxed = tier >= EQUIPMENT_TIER_MAX;
  const nextTier = tier + 1;
  const canUpgrade = !isMaxed && specialKeys > 0;
  const curLabel = tier > 0 ? TIER_LABELS[tier - 1] : 'Locked';

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${slot} details`}
    >
      <div
        className="bg-[#1a1814] border border-[#3a352e] rounded-xl shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-white/10 bg-[#211d15]">
          <div className="w-12 h-12 rounded-lg bg-[#28241d] border-2 border-[#857048] flex items-center justify-center shrink-0">
            <img src={slotImg(slot)} alt={slot} className={`w-7 h-7 object-contain ${tier > 0 ? 'brightness-110' : 'grayscale opacity-40'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-white leading-none">{slot}</h3>
            <p className="text-[11px] text-gray-400 mt-1">
              Tier {tier} {tier > 0 && <span className="text-amber-300">· {curLabel}</span>}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {/* Tier ladder */}
        <div className="p-4 space-y-3">
          <div className="flex items-end gap-1">
            {EQUIP_TIER_COLORS.map((c, i) => {
              const t = i + 1;
              const reached = tier >= t;
              const isNext = t === nextTier;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`Tier ${t} · ${TIER_LABELS[i]}`}>
                  <div
                    className={`w-full h-8 rounded-sm transition-all ${reached ? c : 'bg-[#221d15]'} ${isNext ? 'ring-2 ring-purple-400/70' : ''} ${reached ? '' : 'opacity-40'}`}
                  />
                  <span className={`text-[8px] font-mono leading-none ${reached ? 'text-gray-300' : 'text-gray-600'}`}>{t}</span>
                </div>
              );
            })}
          </div>

          {/* Status / next */}
          {isMaxed ? (
            <div className="flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-950/20 px-3 py-2.5 text-yellow-300">
              <Crown size={15} className="shrink-0" />
              <span className="text-[12px] font-bold">Maxed — Tier {EQUIPMENT_TIER_MAX} ({TIER_LABELS[EQUIPMENT_TIER_MAX - 1]})</span>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-lg border border-white/10 bg-[#211d15] px-3 py-2">
                <span className="text-[11px] text-gray-400">
                  Next: <span className="font-bold text-gray-200">Tier {nextTier}</span>
                  <span className="text-amber-300"> · {TIER_LABELS[nextTier - 1]}</span>
                </span>
                <span className="flex items-center gap-1 text-[11px] font-bold text-purple-300">
                  <Sparkles size={12} /> 1 Omni-Key
                </span>
              </div>
              <button
                onClick={onUpgrade}
                disabled={!canUpgrade}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-[12px] font-bold transition-colors ${
                  canUpgrade
                    ? 'bg-purple-600 hover:bg-purple-500 text-white'
                    : 'bg-[#211d15] text-gray-600 border border-white/5 cursor-not-allowed'
                }`}
              >
                {canUpgrade ? <><ChevronsUp size={14} /> Upgrade to Tier {nextTier}</> : <><Lock size={13} /> Need an Omni-Key</>}
              </button>
              {tier === 0 && (
                <p className="text-[10px] text-gray-500 flex items-center gap-1.5">
                  <AlertCircle size={11} /> This slot is locked — unlocking grants Tier 1.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
