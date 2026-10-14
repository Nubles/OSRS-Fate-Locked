import React, { useEffect, useMemo, useState } from 'react';
import { canonicalTierFromName } from '../../utils/gearTiers';
import { useGame } from '../../context/GameContext';
import { EQUIPMENT_SLOTS } from '../../constants';
import { gearService } from '../../services/GearService';
import { chunkContentService } from '../../services/ChunkContentService';
import { GearItem, GearBonuses, sumBonuses } from '../../utils/gearStats';
import { itemObtainability } from '../../utils/itemObtainability';
import { WikiLink } from '../WikiLink';
import { gemSrc, gemColor, itemSpriteSrc, itemSpriteFallback } from './OsrsDashGems';

/**
 * Equipment Lab, Gear view: the item picker for the chosen slot ("Choose
 * Weapon"), drawn inside the Equipment Lab panel (OsrsEquipment) under or
 * beside the worn-equipment doll. Same data, sorting, equip and remove rules
 * as the classic GearView; the picker sits in the panel instead of a popover.
 */

export type GearStatus = 'loading' | 'ready' | 'error';
const MAX_ROWS = 120;

/** A single offensive headline bonus, for the compact picker row (as GearView). */
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

const Pin: React.FC<{ ok: boolean; label?: string }> = ({ ok, label }) => (
  <svg role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} width="10" height="13" viewBox="0 0 10 13" style={{ flexShrink: 0 }}>
    <path d="M5 12C2 8 1 6.5 1 4.5a4 4 0 0 1 8 0C9 6.5 8 8 5 12z" fill={ok ? '#0dc10d' : '#ff3030'} stroke="#000" strokeWidth="1" />
    <circle cx="5" cy="4.5" r="1.5" fill="#2e271e" />
  </svg>
);

/** Equip an item, clearing the other hand for two-handers (GearView's rule). */
export const useEquip = () => {
  const { loadout, setLoadoutSlot } = useGame();
  return (item: GearItem) => {
    const equipped = loadout || {};
    const clear: string[] = [];
    if (item.slot === 'Weapon' && item.twoHanded) clear.push('Shield');
    if (item.slot === 'Shield') {
      const w = gearService.byId(equipped['Weapon']);
      if (w?.twoHanded) clear.push('Weapon');
    }
    setLoadoutSlot(item.slot, item.id, clear.length ? clear : undefined);
  };
};

interface PickerProps {
  slot: string;
  status: GearStatus;
  onClose: () => void;
  onRetry: () => void;
}

/** The item picker for one slot, inside the Equipment Lab panel; Close goes back to the doll. */
export const OsrsGearPicker: React.FC<PickerProps> = ({ slot, status, onClose, onRetry }) => (
  <section className="osrs-char-pick" aria-label={`Choose ${slot}`}>
    <div className="osrs-char-pickbar">
      <h4 className="osrs-title" style={{ margin: 0 }}>Choose {slot}</h4>
      <button type="button" className="osrs-dash-close is-static" onClick={onClose} aria-label="Close" title="Back to the worn equipment">
        <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="2.5" /></svg>
      </button>
    </div>
    <PickerBody key={slot} slot={slot} status={status} onRetry={onRetry} />
  </section>
);

const PickerBody: React.FC<{ slot: string; status: GearStatus; onRetry: () => void }> = ({ slot, status, onRetry }) => {
  const { unlocks, loadout, setLoadoutSlot } = useGame();
  const equip = useEquip();
  const currentItemId = (loadout || {})[slot];
  const unlockedTier = unlocks.equipment[slot] || 0;
  const [query, setQuery] = useState('');
  const [contentReady, setContentReady] = useState(chunkContentService.ready);
  useEffect(() => {
    if (!contentReady) chunkContentService.init().then((ok) => setContentReady(ok));
  }, [contentReady]);

  const all = status === 'ready' ? gearService.bySlot(slot) : [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (q ? all.filter((i) => i.name.toLowerCase().includes(q)) : all).slice();
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
    <div className="osrs-dash-pickbody">
      <div className="osrs-sh osrs-dash-pickhead">
        <span>Unlocked up to</span>
        {unlockedTier > 0 && <img className="osrs-px" src={gemSrc(unlockedTier)} alt="" aria-hidden="true" width={27} height={24} />}
        <span style={{ color: gemColor(unlockedTier) }}>Tier {unlockedTier}</span>
        {currentItemId != null && (
          <button type="button" className="osrs-btn" style={{ marginLeft: 'auto', height: 28, color: 'var(--osrs-red, #ff3030)' }} onClick={() => setLoadoutSlot(slot, null)}>
            <svg aria-hidden="true" width="12" height="14" viewBox="0 0 12 14"><path d="M1 3h10M4 3V1h4v2M2.5 3l.8 10h5.4l.8-10" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
            Remove
          </button>
        )}
      </div>
      <label className="osrs-dash-search is-wide">
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14"><circle cx="6" cy="6" r="4.5" fill="none" stroke="#c8b897" strokeWidth="2" /><path d="M9.5 9.5l3.5 3.5" stroke="#c8b897" strokeWidth="2" /></svg>
        <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${slot.toLowerCase()}...`} aria-label={`Search ${slot.toLowerCase()}`} />
      </label>
      <p className="osrs-dash-muted-s osrs-char-estnote" style={{ margin: 0, lineHeight: '16px' }}>Est. = a stat-based tier awaiting review.</p>
      <div className="osrs-inner osrs-dash-picklist" role="list" aria-label={`${slot} items`}>
        {status === 'loading' && <p role="status" className="osrs-dash-muted-s osrs-dash-pickmsg">Loading equipment data...</p>}
        {status === 'error' && (
          <div className="osrs-dash-pickmsg" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <span className="osrs-sh" style={{ color: 'var(--osrs-red, #ff3030)' }}>{gearService.error ?? 'Could not load equipment data.'}</span>
            <button type="button" className="osrs-btn" style={{ height: 28 }} onClick={onRetry}>Retry</button>
          </div>
        )}
        {status === 'ready' && shown.length === 0 && <p className="osrs-dash-muted-s osrs-dash-pickmsg">No items match.</p>}
        {status === 'ready' && shown.map((item) => {
          const tier = gearService.tierOf(item.id);
          const estimated = canonicalTierFromName(item.name) == null;
          const tierLabel = `${estimated ? 'Est. ' : ''}T${tier}`;
          const locked = tier > unlockedTier;
          const isCurrent = item.id === currentItemId;
          const obt = contentReady ? itemObtainability(item.name, unlocks) : 'unknown';
          const sub = `${topBonus(item.bonuses)}${item.twoHanded ? ' · 2H' : ''}`;
          return (
            <button
              key={item.id}
              type="button"
              role="listitem"
              onClick={() => !locked && equip(item)}
              disabled={locked}
              className={`osrs-dash-pickrow${isCurrent ? ' is-on' : ''}${locked ? ' is-locked' : ''}`}
              title={locked ? `Unlock Tier ${tier} in this slot to equip` : item.name}
            >
              <span className="osrs-slot" style={{ width: 36, height: 32, flexShrink: 0 }}>
                <img className="osrs-px" src={itemSpriteSrc(item.id)} alt="" aria-hidden="true" width={36} height={32} onError={itemSpriteFallback(item.imageFile)} style={{ objectFit: 'contain' }} />
              </span>
              <span className="osrs-dash-pickrow-text">
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                  <span className="osrs-dash-pickrow-name"><WikiLink name={item.name} /></span>
                  {obt !== 'unknown' && <Pin ok={obt === 'obtainable'} label={obt === 'obtainable' ? 'Obtainable in an unlocked area' : 'Only obtainable in locked areas'} />}
                </span>
                {sub && <span className="osrs-dash-pickrow-sub">{sub}</span>}
              </span>
              <span className="osrs-dash-tierbadge" title={estimated ? 'Est. = a stat-based tier awaiting review' : undefined} style={{ color: locked ? 'var(--osrs-muted, #8a7c66)' : gemColor(tier), background: locked ? 'var(--osrs-well, #1f1a14)' : 'var(--osrs-slot-hi, #2a231a)' }}>
                {locked
                  ? <svg aria-hidden="true" width="11" height="12" viewBox="0 0 12 12"><rect x="2" y="5" width="8" height="6" fill="#8a7c66" /><path d="M4 5V3.5a2 2 0 0 1 4 0V5" fill="none" stroke="#8a7c66" strokeWidth="1.5" /></svg>
                  : tier > 0 && <img className="osrs-px" src={gemSrc(tier)} alt="" aria-hidden="true" width={18} height={16} />}
                {tierLabel}
              </span>
            </button>
          );
        })}
        {status === 'ready' && filtered.length > MAX_ROWS && (
          <p className="osrs-dash-muted-s" style={{ margin: 0, padding: '6px 0 4px', textAlign: 'center' }}>+{filtered.length - MAX_ROWS} more matches, refine your search</p>
        )}
      </div>
      <div className="osrs-dash-tan-s osrs-char-picklegend">
        <span title="Obtainable in an unlocked area"><Pin ok />In an unlocked area</span>
        <span title="Only obtainable in locked areas"><Pin ok={false} />Only in locked areas</span>
      </div>
    </div>
  );
};

/** Equipped items resolved from the loadout (recomputed when gear data loads). */
export const useWornItems = (status: GearStatus) => {
  const { loadout } = useGame();
  return useMemo(() => {
    const equipped = loadout || {};
    const items = EQUIPMENT_SLOTS.map((s) => gearService.byId(equipped[s])).filter((x): x is GearItem => !!x);
    return { items, totals: sumBonuses(items) };
  }, [loadout, status]);
};
