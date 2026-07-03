import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, Trash2, Lock, Loader2, AlertCircle, RefreshCw, Shirt } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { EQUIPMENT_SLOTS, SLOT_CONFIG } from '../constants';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { gearService } from '../services/GearService';
import { chunkContentService } from '../services/ChunkContentService';
import { GearItem, sumBonuses, BONUS_GROUPS, GearBonuses } from '../utils/gearStats';
import { equipTierColor } from '../utils/equipTiers';
import { itemObtainability } from '../utils/itemObtainability';
import { MapPin } from 'lucide-react';
import { WikiLink } from './WikiLink';
import { UnlockState } from '../types';

const emptySlotImg = (slot: string) =>
  `https://oldschool.runescape.wiki/images/${SLOT_CONFIG[slot]?.file ?? 'Globe_icon.png'}`;
const itemImg = (file: string) =>
  `https://oldschool.runescape.wiki/images/${(file || '').replace(/ /g, '_')}`;

const MAX_ROWS = 120;

type Status = 'loading' | 'ready' | 'error';

/** A single offensive headline bonus, for the compact picker row. */
const topBonus = (b: GearBonuses): string => {
  const off: [string, number][] = [
    ['Stab', b.stab], ['Slash', b.slash], ['Crush', b.crush], ['Magic', b.magic], ['Ranged', b.ranged],
  ];
  const best = off.reduce((m, x) => (x[1] > m[1] ? x : m), off[0]);
  if (best[1] !== 0) return `${best[0]} +${best[1]}`;
  if (b.prayer) return `Prayer +${b.prayer}`;
  if (b.defStab + b.defSlash + b.defCrush + b.defMagic + b.defRanged > 0) return 'Defensive';
  return '';
};

export const GearView: React.FC = () => {
  const { unlocks, loadout, setLoadoutSlot } = useGame();
  const equipped = loadout || {};
  const [status, setStatus] = useState<Status>(gearService.ready ? 'ready' : 'loading');
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (gearService.ready) { setStatus('ready'); return; }
    let alive = true;
    setStatus('loading');
    gearService.init().then(() => { if (alive) setStatus('ready'); }).catch(() => { if (alive) setStatus('error'); });
    return () => { alive = false; };
  }, []);

  const retry = () => {
    setStatus('loading');
    gearService.init(true).then(() => setStatus('ready')).catch(() => setStatus('error'));
  };

  // Resolved equipped items + summed bonuses (recompute when loadout / data changes).
  const { items, totals } = useMemo(() => {
    const its = EQUIPMENT_SLOTS
      .map((s) => gearService.byId(equipped[s]))
      .filter((x): x is GearItem => !!x);
    return { items: its, totals: sumBonuses(its) };
  }, [equipped, status]);

  const equip = (item: GearItem) => {
    const clear: string[] = [];
    if (item.slot === 'Weapon' && item.twoHanded) clear.push('Shield');
    if (item.slot === 'Shield') {
      const w = gearService.byId(equipped['Weapon']);
      if (w?.twoHanded) clear.push('Weapon');
    }
    setLoadoutSlot(item.slot, item.id, clear.length ? clear : undefined);
    setSelected(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Paper-doll (real items) */}
      <div className="shrink-0 flex items-center justify-center bg-[#1a1814] rounded-lg border border-[#3a352e] shadow-inner relative min-h-[420px] py-6 overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{ background: 'radial-gradient(ellipse 55% 60% at 50% 45%, rgba(133,112,72,0.16), transparent 70%)' }}
        />
        <div className="grid grid-cols-3 gap-6 w-max relative z-10">
          {EQUIPMENT_SLOTS.map((slot) => {
            const config = SLOT_CONFIG[slot];
            if (!config) return null;
            const item = gearService.byId(equipped[slot]);
            const unlockedTier = unlocks.equipment[slot] || 0;
            return (
              <div key={slot} className={`${config.gridArea} relative group`}>
                <button
                  onClick={() => setSelected(slot)}
                  className="w-20 h-20 relative flex items-center justify-center rounded-lg bg-[#28241d] border-2 border-[#453f36] shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)] transition-all duration-150 cursor-pointer hover:scale-105 hover:border-[#857048]"
                  title={item ? `${slot}: ${item.name}` : `${slot}: empty (unlocked ≤ T${unlockedTier})`}
                >
                  <img
                    src={item ? itemImg(item.imageFile) : emptySlotImg(slot)}
                    alt={item?.name ?? slot}
                    className={`w-10 h-10 object-contain drop-shadow-md transition-all ${item ? 'opacity-100 brightness-110' : 'opacity-20 grayscale group-hover:opacity-40'}`}
                    onError={(e) => { (e.target as HTMLImageElement).src = emptySlotImg(slot); }}
                  />
                  {item && (
                    <div className={`absolute -bottom-3 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold border shadow-md ${equipTierColor(gearService.tierOf(item.id))} text-black/80 border-black/20`}>
                      T{gearService.tierOf(item.id)}
                    </div>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Gear stats */}
      <div className="mt-4 bg-[#151515] border border-white/10 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-[11px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
            <Shirt size={12} className="text-amber-300" /> Gear Stats
          </h4>
          <span className="text-[10px] text-gray-600 font-mono">{items.length}/{EQUIPMENT_SLOTS.length} equipped</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {BONUS_GROUPS.map((group) => (
            <div key={group.label} className="space-y-1">
              <div className="text-[9px] uppercase tracking-widest text-gray-500 border-b border-white/5 pb-1">{group.label}</div>
              {group.rows.map((row) => {
                const v = totals[row.key];
                return (
                  <div key={row.key} className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-500">{row.label}</span>
                    <span className={`font-mono font-bold ${v > 0 ? 'text-gray-200' : v < 0 ? 'text-red-400' : 'text-gray-600'}`}>
                      {v > 0 ? '+' : ''}{v}{row.pct ? '%' : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <p className="text-[9px] text-gray-600 mt-3 flex items-center gap-1">
          <AlertCircle size={10} /> Items are gated by each slot's unlocked tier. Tiers are estimated from item power.
        </p>
      </div>

      {/* Picker */}
      {selected && (
        <GearPicker
          slot={selected}
          status={status}
          currentItemId={equipped[selected]}
          unlockedTier={unlocks.equipment[selected] || 0}
          unlocks={unlocks}
          onClose={() => setSelected(null)}
          onEquip={equip}
          onRemove={() => { setLoadoutSlot(selected, null); setSelected(null); }}
          onRetry={retry}
        />
      )}
    </div>
  );
};

// ── Item picker popover ──────────────────────────────────────────────────────
interface PickerProps {
  slot: string;
  status: Status;
  currentItemId?: number;
  unlockedTier: number;
  unlocks: UnlockState;
  onClose: () => void;
  onEquip: (item: GearItem) => void;
  onRemove: () => void;
  onRetry: () => void;
}

const GearPicker: React.FC<PickerProps> = ({ slot, status, currentItemId, unlockedTier, unlocks, onClose, onEquip, onRemove, onRetry }) => {
  useEscapeKey(onClose, true);
  const [query, setQuery] = useState('');
  // Lazy-load the chunk-content dataset so we can show where each item is
  // obtainable (and whether that source is unlocked yet).
  const [contentReady, setContentReady] = useState(chunkContentService.ready);
  useEffect(() => {
    if (!contentReady) chunkContentService.init().then((ok) => setContentReady(ok));
  }, [contentReady]);

  const all = status === 'ready' ? gearService.bySlot(slot) : [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (q ? all.filter((i) => i.name.toLowerCase().includes(q)) : all).slice();
    // Surface what you can actually equip: equippable first (strongest first),
    // then locked items ordered by how close they are to your unlocked tier.
    return list.sort((a, b) => {
      const ta = gearService.tierOf(a.id);
      const tb = gearService.tierOf(b.id);
      const la = ta > unlockedTier ? 1 : 0;
      const lb = tb > unlockedTier ? 1 : 0;
      if (la !== lb) return la - lb;
      if (la === 0) return tb - ta || a.name.localeCompare(b.name);
      return ta - tb || a.name.localeCompare(b.name);
    });
  }, [all, query, unlockedTier]);
  const shown = filtered.slice(0, MAX_ROWS);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Choose ${slot}`}
    >
      <div className="bg-[#161616] border border-white/10 rounded-xl shadow-2xl w-full max-w-md h-[70vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center gap-3 p-3 border-b border-white/10 bg-[#1b1b1b] shrink-0">
          <img src={emptySlotImg(slot)} alt="" className="w-6 h-6 object-contain opacity-70" />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-white leading-none">{slot}</h3>
            <p className="text-[10px] text-gray-500 mt-0.5">Unlocked up to <span className="text-amber-300">Tier {unlockedTier}</span></p>
          </div>
          {currentItemId != null && (
            <button onClick={onRemove} className="flex items-center gap-1 px-2 py-1 rounded border border-red-500/30 bg-red-950/30 text-red-300 hover:bg-red-900/40 text-[10px] font-bold"><Trash2 size={11} /> Remove</button>
          )}
          <button onClick={onClose} className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white" aria-label="Close"><X size={16} /></button>
        </div>

        {/* Search */}
        <div className="p-2 border-b border-white/5 shrink-0">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-600" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${slot.toLowerCase()}…`}
              className="w-full pl-8 pr-3 py-2 rounded-lg bg-black/40 border border-white/10 text-[12px] text-gray-200 focus:outline-none focus:border-cyan-500/40 placeholder:text-gray-700"
            />
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {status === 'loading' && (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-gray-500">
              <Loader2 size={20} className="animate-spin text-cyan-400" />
              <span className="text-[11px]">Loading equipment data…</span>
            </div>
          )}
          {status === 'error' && (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-gray-500 px-6 text-center">
              <AlertCircle size={20} className="text-red-400" />
              <span className="text-[11px]">{gearService.error ?? 'Could not load equipment data.'}</span>
              <button onClick={onRetry} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#252525] border border-white/10 hover:bg-[#2d2d2d] text-gray-200 text-[11px] font-bold"><RefreshCw size={12} /> Retry</button>
            </div>
          )}
          {status === 'ready' && (
            <div className="p-1.5 space-y-1">
              {shown.length === 0 && (
                <div className="text-center text-[11px] text-gray-600 py-10">No items match.</div>
              )}
              {shown.map((item) => {
                const tier = gearService.tierOf(item.id);
                const locked = tier > unlockedTier;
                const isCurrent = item.id === currentItemId;
                const obt = contentReady ? itemObtainability(item.name, unlocks) : 'unknown';
                return (
                  <button
                    key={item.id}
                    onClick={() => !locked && onEquip(item)}
                    disabled={locked}
                    className={`w-full flex items-center gap-2.5 rounded-lg px-2 py-1.5 border text-left transition-colors ${
                      isCurrent ? 'border-cyan-500/40 bg-cyan-950/30'
                      : locked ? 'border-transparent opacity-45 cursor-not-allowed'
                      : 'border-transparent hover:bg-white/5 hover:border-white/10 cursor-pointer'
                    }`}
                    title={locked ? `Unlock Tier ${tier} in this slot to equip` : item.name}
                  >
                    <img src={itemImg(item.imageFile)} alt="" className="w-7 h-7 object-contain shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-semibold text-gray-200 truncate flex items-center gap-1">
                        <WikiLink name={item.name} />
                        {obt !== 'unknown' && (
                          <MapPin
                            size={10}
                            className={`shrink-0 ${obt === 'obtainable' ? 'text-emerald-400' : 'text-red-400'}`}
                            aria-label={obt === 'obtainable' ? 'Obtainable in an unlocked area' : 'Only obtainable in locked areas'}
                          />
                        )}
                      </div>
                      <div className="text-[9px] text-gray-500 truncate">{topBonus(item.bonuses)}{item.twoHanded ? ' · 2H' : ''}</div>
                    </div>
                    <span className={`shrink-0 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${locked ? 'bg-[#1a1a1a] text-gray-500 border border-white/5' : `${equipTierColor(tier)} text-black/80`}`}>
                      {locked ? <span className="flex items-center gap-0.5"><Lock size={8} /> T{tier}</span> : `T${tier}`}
                    </span>
                  </button>
                );
              })}
              {filtered.length > MAX_ROWS && (
                <div className="text-center text-[10px] text-gray-600 py-2">+{filtered.length - MAX_ROWS} more — refine your search</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
