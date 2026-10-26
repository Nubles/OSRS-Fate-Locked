import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { EQUIPMENT_SLOTS, EQUIPMENT_TIER_MAX } from '../../constants';
import { SectionGuide } from '../SectionGuide';
import { TIER_LABELS } from '../../utils/combatPower';
import { canonicalTierFromName } from '../../utils/gearTiers';
import { gearService } from '../../services/GearService';
import { TIER_GEMS, gemColor, itemSrc, roman } from './OsrsDashGems';
import { OsrsTierMark } from './OsrsTierMark';
import { useTierMarks } from '../../utils/uiStyle';
import { OsrsCharDoll, type DollSlot } from './OsrsCharDoll';
import { BONUS_GROUPS, type GearItem } from '../../utils/gearStats';
import { OsrsGearPicker, useWornItems, type GearStatus } from './OsrsCharGear';
import { OsrsCharDps } from './OsrsCharDps';
import './osrs-dashboard.css';

/**
 * Equipment Lab in the OSRS layout: the Character tab's Equipment panel.
 *
 * Every view lives inside the panel's own area (beside Skills); the mode
 * buttons switch what its body shows and a close button returns to the
 * overview:
 *  - Overview (no view): the OSRS Worn Equipment interface (OsrsCharDoll:
 *    slot tiles, silhouettes, worn sprites, each slot's tier as a numeral
 *    and gem on the tile), as big as the panel allows, and the Equipment
 *    Stats of what is worn when there is room for them.
 *  - Tiers: the doll with the chosen slot outlined and that slot's ladder,
 *    next tier and Omni-Key upgrade beneath it.
 *  - Plan: the target loadout planner and its Omni-Key cost.
 *  - Gear: the doll with each worn item's own tier; a slot opens its item picker.
 *  - DPS: the DPS calculator, one column when the panel is narrow.
 *
 * Same state, data and Omni-Key upgrade flow as the classic Equipment Lab,
 * GearView and DpsCalc; only where things sit has changed.
 */

export type OsrsLabMode = 'tiers' | 'gear' | 'dps';
export interface OsrsLabView { mode: OsrsLabMode; slot?: string | null; plan?: boolean }

interface Props {
  onUpgrade: (slot: string) => void;
  suspendModals?: boolean;
}

const EQUIP_GEMS = TIER_GEMS.slice(0, EQUIPMENT_TIER_MAX);
const MAX_TIERS = EQUIPMENT_SLOTS.length * EQUIPMENT_TIER_MAX;

/** Loads the gear catalogue once (names, tiers and stats for the loadout). */
export const useGearData = () => {
  const [status, setStatus] = useState<GearStatus>(gearService.ready ? 'ready' : 'loading');
  useEffect(() => {
    if (gearService.ready) { setStatus('ready'); return; }
    let alive = true;
    setStatus('loading');
    gearService.init().then(() => { if (alive) setStatus('ready'); }).catch(() => { if (alive) setStatus('error'); });
    return () => { alive = false; };
  }, []);
  const retry = useCallback(() => {
    setStatus('loading');
    gearService.init(true).then(() => setStatus('ready')).catch(() => setStatus('error'));
  }, []);
  return { status, retry };
};

const slotExamine = (slot: string, tier: number, itemName?: string) =>
  `${slot} slot${itemName ? `: ${itemName}` : ''}. ${tier > 0 ? `Tier ${roman(tier)} unlocked: up to ${TIER_LABELS[tier - 1]} gear.` : 'Locked: no tier unlocked yet.'}`;

const TierCells: React.FC<{ tier: number; target?: number }> = ({ tier, target = 0 }) => (
  <span className="osrs-dash-cells" aria-hidden="true">
    {EQUIP_GEMS.map((g, i) => (
      <span key={g.name} style={{ background: tier > i ? gemColor(tier) : target > i ? 'rgba(199,125,255,.45)' : 'var(--osrs-slot-hi, #2a231a)' }} />
    ))}
  </span>
);

const CloseX: React.FC = () => (
  <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="2.5" /></svg>
);

/** The OSRS Equipment Stats bonuses for what is worn (from the Gear loadout). */
const WornBonuses: React.FC<{ status: GearStatus }> = ({ status }) => {
  const { items, totals } = useWornItems(status);
  return (
    <div className="osrs-inner osrs-char-bonuses" role="group" aria-label={`Equipment Stats, ${items.length} of ${EQUIPMENT_SLOTS.length} slots worn`}
      title={`Equipment Stats for what you wear (${items.length}/${EQUIPMENT_SLOTS.length} slots). Choose gear in the Gear view.`}>
      {BONUS_GROUPS.map((group) => (
        <div key={group.label} style={{ minWidth: 0 }}>
          {/* "Attack bonus" etc.; the word "bonus" drops out when the panel is narrow. */}
          <h4>{group.label.replace(/ bonus$/, '')}<span className="osrs-char-bonusword"> bonus</span></h4>
          <dl>
            {group.rows.map((row) => {
              const v = totals[row.key];
              return (
                <React.Fragment key={row.key}>
                  <dt>{row.label}:</dt>
                  <dd style={{ color: v > 0 ? 'var(--osrs-yellow, #ff0)' : v < 0 ? 'var(--osrs-red, #ff3030)' : 'var(--osrs-muted, #8a7c66)' }}>
                    {v > 0 ? '+' : ''}{v}{row.pct ? '%' : ''}
                  </dd>
                </React.Fragment>
              );
            })}
          </dl>
        </div>
      ))}
    </div>
  );
};

// ── The panel ────────────────────────────────────────────────────────────────

interface PanelProps extends Props {
  /** The open view; null shows the overview. */
  view: OsrsLabView | null;
  onView: (view: OsrsLabView | null) => void;
}

const MODE_TITLE: Record<OsrsLabMode | 'plan', string> = {
  tiers: 'Tier ladder and Omni-Key upgrade per slot',
  gear: 'Choose real items for each slot',
  dps: 'DPS calculator',
  plan: 'Plan an upgrade: a target loadout and its Omni-Key cost',
};

export const OsrsLabCompact: React.FC<PanelProps> = ({ view, onView, onUpgrade, suspendModals = false }) => {
  const { unlocks, specialKeys, loadout } = useGame();
  const equipment = unlocks.equipment;
  const equipped = loadout || {};
  const { status, retry } = useGearData();
  const [targets, setTargets] = useState<Record<string, number>>({});

  const total = useMemo(() => EQUIPMENT_SLOTS.reduce((a, s) => a + (equipment[s] || 0), 0), [equipment]);
  const weakest = useMemo(() => EQUIPMENT_SLOTS.reduce((lo, s) => ((equipment[s] || 0) < (equipment[lo] || 0) ? s : lo), EQUIPMENT_SLOTS[0]), [equipment]);
  const wornItems = useMemo(() => EQUIPMENT_SLOTS.map((s) => (status === 'ready' ? gearService.byId(equipped[s]) : undefined)), [equipped, status]);

  const mode = view?.mode ?? null;
  const planMode = mode === 'tiers' && !!view?.plan;
  const tSlot = view?.slot && EQUIPMENT_SLOTS.includes(view.slot) ? view.slot : weakest;
  const pickSlot = mode === 'gear' && view?.slot && EQUIPMENT_SLOTS.includes(view.slot) ? view.slot : null;

  // Loadout planner (classic Equipment Lab's rules).
  const targetFor = (slot: string) => Math.max(targets[slot] ?? (equipment[slot] || 0), equipment[slot] || 0);
  const planCost = EQUIPMENT_SLOTS.reduce((sum, s) => sum + Math.max(0, targetFor(s) - (equipment[s] || 0)), 0);
  const setTarget = (slot: string, value: number) =>
    setTargets((t) => ({ ...t, [slot]: Math.min(EQUIPMENT_TIER_MAX, Math.max(equipment[slot] || 0, value)) }));
  const resetPlan = () => setTargets({});
  const maxPlan = () => setTargets(Object.fromEntries(EQUIPMENT_SLOTS.map((s) => [s, EQUIPMENT_TIER_MAX])));
  // Entering the planner starts from a clean plan, as the classic Plan button does.
  useEffect(() => { if (planMode) resetPlan(); }, [planMode]);

  // The doll: tier gems (overview, Tiers) or each worn item's own gem (Gear).
  const dollSlots = (kind: 'tiers' | 'gear'): DollSlot[] => EQUIPMENT_SLOTS.map((slot, i) => {
    const ut = equipment[slot] || 0;
    const id = equipped[slot];
    const item = wornItems[i];
    if (kind === 'tiers') {
      return {
        slot, itemId: id, imageFile: item?.imageFile, gem: ut, dim: ut === 0,
        selected: mode === 'tiers' && !planMode && tSlot === slot,
        omni: ut < EQUIPMENT_TIER_MAX && specialKeys > 0, note: true,
        label: `${slot}: ${id != null ? `${item?.name ?? 'equipped item'}, ` : ''}Tier ${ut}. Click for its tier ladder.`,
        examine: slotExamine(slot, ut, item?.name),
        onClick: () => onView({ mode: 'tiers', slot }),
      };
    }
    const tier = item ? gearService.tierOf(item.id) : 0;
    const est = item ? canonicalTierFromName(item.name) == null : false;
    return {
      slot, itemId: id, imageFile: item?.imageFile, gem: id != null ? tier : ut, dim: id == null && ut === 0, selected: pickSlot === slot,
      label: id != null
        ? `${slot}: ${item?.name ?? 'equipped item'}${item ? `, ${est ? 'Est. ' : ''}Tier ${roman(tier)}` : ''}. Choose ${slot}`
        : `${slot}: empty, unlocked up to Tier ${ut}. Choose ${slot}`,
      examine: slotExamine(slot, ut, item?.name),
      onClick: () => onView({ mode: 'gear', slot }),
    };
  });

  const modeBtn = (key: OsrsLabMode | 'plan', label: string, next: OsrsLabView) => {
    const on = key === 'plan' ? planMode : mode === key && !planMode;
    return (
      <button key={key} type="button" className={`osrs-btn${on ? ' is-on' : ''}`} aria-pressed={on}
        title={on ? `${MODE_TITLE[key]} (click again to close)` : MODE_TITLE[key]}
        onClick={() => onView(on ? null : next)}>
        {label}
      </button>
    );
  };

  let body: React.ReactNode;
  if (mode === null) {
    body = (
      <div className="osrs-char-worn">
        <div className="osrs-char-wornrow">
          <OsrsCharDoll slots={dollSlots('tiers')} suspendModals={suspendModals} />
        </div>
        <WornBonuses status={status} />
      </div>
    );
  } else if (planMode) {
    body = (
      <section className="osrs-char-plan" aria-label="Target loadout">
        <div className="osrs-inner osrs-char-planrows">
          {EQUIPMENT_SLOTS.map((slot) => {
            const cur = equipment[slot] || 0;
            const tgt = targetFor(slot);
            return (
              <div key={slot} className="osrs-dash-tierrow">
                <span className="osrs-dash-tierrow-name" style={{ color: cur > 0 ? '#fff' : 'var(--osrs-muted, #8a7c66)' }}>{slot}</span>
                <TierCells tier={cur} target={tgt} />
                <button type="button" className="osrs-btn osrs-dash-step" onClick={() => setTarget(slot, tgt - 1)} disabled={tgt <= cur} aria-label={`Lower ${slot} target`}>-</button>
                <span className="osrs-char-plantier" style={{ color: tgt > cur ? 'var(--osrs-purple, #c77dff)' : 'var(--osrs-tan, #c8b897)' }} aria-label={`${slot} target Tier ${tgt}`}>T{tgt}</span>
                <button type="button" className="osrs-btn osrs-dash-step" onClick={() => setTarget(slot, tgt + 1)} disabled={tgt >= EQUIPMENT_TIER_MAX} aria-label={`Raise ${slot} target`}>+</button>
              </div>
            );
          })}
        </div>
        <div className="osrs-dash-plancost">
          <span style={{ display: 'flex', gap: 3 }}>
            <button type="button" className="osrs-btn" onClick={resetPlan} title="Back to your current tiers">Reset</button>
            <button type="button" className="osrs-btn" style={{ color: 'var(--osrs-yellow, #ff0)' }} onClick={maxPlan} title={`Every slot at Tier ${EQUIPMENT_TIER_MAX}`}>Max</button>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }} title="Omni-Keys this loadout needs (one per tier)">
            <img className="osrs-px" src={itemSrc('omni_key')} alt="" aria-hidden="true" width={18} height={16} />
            <span className="osrs-sh" style={{ fontFamily: 'RSBold, sans-serif', color: planCost === 0 ? 'var(--osrs-tan, #c8b897)' : planCost <= specialKeys ? 'var(--osrs-green, #0dc10d)' : 'var(--osrs-yellow, #ff0)' }}>{planCost}</span>
            <span className="osrs-dash-muted-s">needed · have {specialKeys}</span>
          </span>
        </div>
      </section>
    );
  } else if (mode === 'tiers') {
    body = (
      <div className="osrs-char-tiersview">
        <div className="osrs-char-worn is-doll">
          <div className="osrs-char-wornrow">
            <OsrsCharDoll slots={dollSlots('tiers')} suspendModals={suspendModals} />
          </div>
        </div>
        <SlotDetail slot={tSlot} tier={equipment[tSlot] || 0} specialKeys={specialKeys} onUpgrade={() => onUpgrade(tSlot)} />
      </div>
    );
  } else if (mode === 'gear') {
    body = (
      <div className={`osrs-char-gearview${pickSlot ? ' has-pick' : ''}`}>
        <div className={`osrs-char-worn${pickSlot ? ' is-doll' : ''}`}>
          <div className="osrs-char-wornrow">
            <OsrsCharDoll slots={dollSlots('gear')} suspendModals={suspendModals} />
          </div>
          {!pickSlot && <WornBonuses status={status} />}
          {!pickSlot && <p className="osrs-dash-muted-s osrs-char-hint">Click a slot to choose its gear.</p>}
        </div>
        {pickSlot && <OsrsGearPicker slot={pickSlot} status={status} onClose={() => onView({ mode: 'gear', slot: null })} onRetry={retry} />}
      </div>
    );
  } else {
    body = <OsrsCharDps />;
  }

  return (
    <section className="osrs-inner osrs-dash-labmini" aria-label="Equipment Lab">
      <div className="osrs-dash-panelhead osrs-char-labhead">
        <h3 className="osrs-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          Equipment Lab <SectionGuide id="EQUIPMENT_LAB" className="osrs-dash-qmark" suspendModals={suspendModals} />
        </h3>
        <span className="osrs-dash-yellow-s" style={{ marginLeft: 'auto' }}>{total}/{MAX_TIERS} tiers</span>
        {mode !== null && (
          <button type="button" className="osrs-dash-close is-static" onClick={() => onView(null)} aria-label="Close Equipment Lab view" title="Back to the overview">
            <CloseX />
          </button>
        )}
      </div>
      <div className="osrs-char-labmodes">
        <div role="group" aria-label="Equipment Lab view">
          {modeBtn('tiers', 'Tiers', { mode: 'tiers', slot: tSlot })}
          {modeBtn('gear', 'Gear', { mode: 'gear', slot: null })}
          {modeBtn('dps', 'DPS', { mode: 'dps' })}
        </div>
        {modeBtn('plan', 'Plan', { mode: 'tiers', slot: tSlot, plan: true })}
      </div>
      <div className="osrs-char-labbody">{body}</div>
    </section>
  );
};

/** One slot's tier ladder, next tier and the Omni-Key upgrade. */
const SlotDetail: React.FC<{ slot: string; tier: number; specialKeys: number; onUpgrade: () => void }> = ({ slot, tier, specialKeys, onUpgrade }) => {
  const isMaxed = tier >= EQUIPMENT_TIER_MAX;
  const nextTier = tier + 1;
  const canUpgrade = !isMaxed && specialKeys > 0;
  const gems = useTierMarks() === 'gems';
  return (
    <section className="osrs-inner osrs-char-detail" aria-label={`${slot} details`}>
      <div className="osrs-sh osrs-char-detailhead">
        {gems || tier > 0 ? <OsrsTierMark tier={Math.max(tier, 1)} size="row" look={tier > 0 ? 'on' : 'off'} framed /> : null}
        <span style={{ fontFamily: 'RSBold, sans-serif', color: '#fff' }}>{slot}</span>
        <span className="osrs-char-detailtier">
          <span style={{ color: tier > 0 ? gemColor(tier) : 'var(--osrs-muted, #8a7c66)' }}>Tier {tier > 0 ? roman(tier) : 0}</span>
          {tier > 0 && <span style={{ color: 'var(--osrs-orange, #ff981f)' }}> · {TIER_LABELS[tier - 1]}</span>}
        </span>
      </div>
      <div className="osrs-char-ladder" role="img" aria-label={`Tier ${tier} of ${EQUIPMENT_TIER_MAX}`}>
        {EQUIP_GEMS.map((g, i) => {
          const t = i + 1;
          const reached = tier >= t;
          return (
            <span key={g.name} title={`Tier ${roman(t)} · ${TIER_LABELS[i]}`} className={t === nextTier ? 'is-next' : undefined}
              style={{ background: reached ? g.color : undefined, color: reached ? '#fff' : undefined }}>
              {roman(t)}
            </span>
          );
        })}
      </div>
      {isMaxed ? (
        <div className="osrs-sh osrs-char-detailnext" style={{ color: 'var(--osrs-yellow, #ff0)' }}>
          Maxed: Tier {roman(EQUIPMENT_TIER_MAX)} ({TIER_LABELS[EQUIPMENT_TIER_MAX - 1]})
        </div>
      ) : (
        <>
          <div className="osrs-sh osrs-char-detailnext">
            <span className="osrs-char-detailnexttext">Next: <span style={{ color: '#fff' }}>Tier {roman(nextTier)}</span><span style={{ color: 'var(--osrs-orange, #ff981f)' }}> · {TIER_LABELS[nextTier - 1]}</span></span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, color: 'var(--osrs-purple, #c77dff)' }} title="Cost: 1 Omni-Key">
              <img className="osrs-px" src={itemSrc('omni_key')} alt="" aria-hidden="true" width={18} height={16} />1
            </span>
          </div>
          <div className="osrs-char-detailact">
            <button type="button" className="osrs-btn" style={{ color: canUpgrade ? 'var(--osrs-purple, #c77dff)' : undefined }} onClick={onUpgrade} disabled={!canUpgrade}
              title={tier === 0 ? 'This slot is locked. Unlocking grants Tier I.' : 'Each Omni-Key raises one slot by one tier.'}>
              {!canUpgrade && <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12"><rect x="2" y="5" width="8" height="6" fill="currentColor" /><path d="M4 5V3.5a2 2 0 0 1 4 0V5" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>}
              {canUpgrade ? `Upgrade to Tier ${roman(nextTier)}` : 'Need an Omni-Key'}
            </button>
            <span className="osrs-dash-muted-s" title={`You hold ${specialKeys} Omni-Key${specialKeys === 1 ? '' : 's'}. Each one raises one slot by one tier.`}>have {specialKeys}</span>
          </div>
        </>
      )}
    </section>
  );
};

/** The lab on its own (EquipmentLab's OSRS branch): the same panel with its own view. */
export const OsrsEquipment: React.FC<Props> = (props) => {
  const [view, setView] = useState<OsrsLabView | null>(null);
  return <OsrsLabCompact {...props} view={view} onView={setView} />;
};

export default OsrsEquipment;
