import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { EQUIPMENT_SLOTS, EQUIPMENT_TIER_MAX } from '../../constants';
import { SectionGuide } from '../SectionGuide';
import { TIER_LABELS } from '../../utils/combatPower';
import { canonicalTierFromName } from '../../utils/gearTiers';
import { gearService } from '../../services/GearService';
import { TIER_GEMS, gemSrc, gemColor, gemCropStyle, gemSmallSrc, itemSrc, roman } from './OsrsDashGems';
import { OsrsCharDoll, type DollSlot } from './OsrsCharDoll';
import { BONUS_GROUPS } from '../../utils/gearStats';
import { OsrsGearPicker, OsrsGearStats, useWornItems, type GearStatus } from './OsrsCharGear';
import { OsrsCharDps } from './OsrsCharDps';
import './osrs-dashboard.css';

/**
 * Equipment Lab in the OSRS layout.
 *
 *  - OsrsLabCompact: the Character tab's Equipment panel: the OSRS Worn
 *    Equipment interface (OsrsCharDoll: the game's slot tiles, silhouettes
 *    and connector lines, worn item sprites, a tier gem in each corner),
 *    each slot's tier as a list beside it, the Equipment Stats bonuses of
 *    what is worn when there is room, Tiers / Gear / DPS and Plan.
 *  - OsrsLabFull: the whole Character tab (Gear board) once a mode, a slot
 *    or the planner is opened from the compact panel: the Tiers breakdown and
 *    slot detail (with the Omni-Key upgrade), the Gear picker and stats, or
 *    the DPS calculator, beside the Worn Equipment interface.
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
  `${slot} slot${itemName ? `: ${itemName}` : ''}. ${tier > 0 ? `Tier ${tier} unlocked: up to ${TIER_LABELS[tier - 1]} gear.` : 'Locked: no tier unlocked yet.'}`;

const TierCells: React.FC<{ tier: number; target?: number }> = ({ tier, target = 0 }) => (
  <span className="osrs-dash-cells" aria-hidden="true">
    {EQUIP_GEMS.map((g, i) => (
      <span key={g.name} style={{ background: tier > i ? gemColor(tier) : target > i ? 'rgba(199,125,255,.45)' : 'var(--osrs-slot-hi, #2a231a)' }} />
    ))}
  </span>
);

const LabGuide: React.FC<{ suspendModals: boolean }> = ({ suspendModals }) => (
  <SectionGuide id="EQUIPMENT_LAB" className="osrs-dash-qmark" suspendModals={suspendModals} />
);

// ── Compact (Main board) ─────────────────────────────────────────────────────

/** Each slot's tier, as a list beside the doll: gem, slot, "Tier I · Bronze / Iron". */
const SlotTierList: React.FC<{ equipment: Record<string, number> }> = ({ equipment }) => (
  <ul className="osrs-char-slotlist" aria-label="Tier per slot">
    {EQUIPMENT_SLOTS.map((slot) => {
      const t = equipment[slot] || 0;
      const text = t > 0 ? `Tier ${roman(t)} · ${TIER_LABELS[t - 1]}` : 'Locked';
      return (
        <li key={slot} className={t > 0 ? undefined : 'is-zero'} title={`${slot}: ${t > 0 ? `Tier ${t}, up to ${TIER_LABELS[t - 1]} gear` : 'no tier unlocked yet'}`}>
          <img className={`osrs-px is-gem is-small${t > 0 ? '' : ' is-none'}`} src={gemSmallSrc(Math.max(t, 1))} alt="" aria-hidden="true" />
          <span className={`is-gem is-big${t > 0 ? '' : ' is-none'}`} style={gemCropStyle(Math.max(t, 1))} aria-hidden="true" />
          <span className="is-name">{slot}</span>
          <span className="is-tier" style={{ color: t > 0 ? gemColor(t) : 'var(--osrs-muted, #8a7c66)' }}>
            <span className="is-small" aria-hidden="true">{t > 0 ? `Tier ${roman(t)}` : 'Locked'}</span>
            <span className="is-big">{text}</span>
            <span className="sr-only">{text}</span>
          </span>
        </li>
      );
    })}
  </ul>
);

/** The OSRS Equipment Stats bonuses for what is worn (from the Gear loadout). */
const WornBonuses: React.FC<{ status: GearStatus }> = ({ status }) => {
  const { items, totals } = useWornItems(status);
  return (
    <div className="osrs-inner osrs-char-bonuses" role="group" aria-label={`Equipment Stats, ${items.length} of ${EQUIPMENT_SLOTS.length} slots worn`}
      title={`Equipment Stats for what you wear (${items.length}/${EQUIPMENT_SLOTS.length} slots). Choose gear in the Gear view.`}>
      {BONUS_GROUPS.map((group) => (
        <div key={group.label} style={{ minWidth: 0 }}>
          <h4>{group.label}</h4>
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

export const OsrsLabCompact: React.FC<{ onOpen: (view: OsrsLabView) => void; suspendModals?: boolean }> = ({ onOpen, suspendModals = false }) => {
  const { unlocks, specialKeys, loadout } = useGame();
  const equipment = unlocks.equipment;
  const equipped = loadout || {};
  const { status } = useGearData();
  const total = EQUIPMENT_SLOTS.reduce((a, s) => a + (equipment[s] || 0), 0);

  const slots: DollSlot[] = EQUIPMENT_SLOTS.map((slot) => {
    const tier = equipment[slot] || 0;
    const id = equipped[slot];
    const item = status === 'ready' ? gearService.byId(id) : undefined;
    return {
      slot,
      itemId: id,
      imageFile: item?.imageFile,
      gem: tier,
      dim: tier === 0,
      omni: tier < EQUIPMENT_TIER_MAX && specialKeys > 0,
      label: `${slot}: ${id != null ? `${item?.name ?? 'equipped item'}, ` : ''}Tier ${tier}. Click for its tier ladder.`,
      examine: slotExamine(slot, tier, item?.name),
      onClick: () => onOpen({ mode: 'tiers', slot }),
      note: true,
    };
  });

  return (
    <section className="osrs-inner osrs-dash-labmini" aria-label="Equipment Lab">
      <div className="osrs-dash-panelhead" style={{ alignSelf: 'stretch', padding: 0 }}>
        <h3 className="osrs-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>Equipment Lab <LabGuide suspendModals={suspendModals} /></h3>
        <span className="osrs-dash-yellow-s">{total}/{MAX_TIERS} tiers</span>
      </div>
      <div style={{ display: 'flex', gap: 6, alignSelf: 'stretch' }}>
        <div role="group" aria-label="Equipment Lab view" style={{ flex: 3, display: 'flex', gap: 3 }}>
          {(['tiers', 'gear', 'dps'] as const).map((m) => (
            <button key={m} type="button" className={`osrs-btn${m === 'tiers' ? ' is-on' : ''}`} style={{ flex: 1, height: 26, padding: 0 }}
              aria-pressed={m === 'tiers'} onClick={() => onOpen({ mode: m })}
              title={m === 'tiers' ? 'Open the tier breakdown' : m === 'gear' ? 'Choose real items for each slot' : 'DPS calculator'}>
              {m === 'tiers' ? 'Tiers' : m === 'gear' ? 'Gear' : 'DPS'}
            </button>
          ))}
        </div>
        <button type="button" className="osrs-btn" style={{ flex: 1, height: 26, padding: 0 }} onClick={() => onOpen({ mode: 'tiers', plan: true })}
          aria-label="Plan an upgrade" title="Plan an upgrade: a target loadout and its Omni-Key cost">Plan</button>
      </div>
      <div className="osrs-char-worn">
        <div className="osrs-char-wornrow">
          <OsrsCharDoll slots={slots} suspendModals={suspendModals} />
          <SlotTierList equipment={equipment} />
        </div>
        <WornBonuses status={status} />
      </div>
    </section>
  );
};

// ── Full lab (Gear board) ────────────────────────────────────────────────────

interface FullProps extends Props {
  view: OsrsLabView;
  onView: (view: OsrsLabView) => void;
  /** Back to the Character tab's Skills (absent when the lab stands alone). */
  onClose?: () => void;
}

const BAR_NOTE: Record<OsrsLabMode, string> = {
  tiers: 'Tier ladder per slot',
  gear: "Pick real items up to each slot's tier",
  dps: 'Melee, Ranged or Magic against one target',
};

export const OsrsLabFull: React.FC<FullProps> = ({ view, onView, onClose, onUpgrade, suspendModals = false }) => {
  const { unlocks, specialKeys, loadout } = useGame();
  const equipment = unlocks.equipment;
  const equipped = loadout || {};
  const { status, retry } = useGearData();
  const { items } = useWornItems(status);
  const [targets, setTargets] = useState<Record<string, number>>({});
  const [dpsLine, setDpsLine] = useState('');

  const totalEquipTiers = useMemo(() => EQUIPMENT_SLOTS.reduce((a, s) => a + (equipment[s] || 0), 0), [equipment]);
  const stats = useMemo(() => {
    const entries = EQUIPMENT_SLOTS.map((slot) => ({ slot, tier: equipment[slot] || 0 }));
    const weakest = entries.reduce((lo, e) => (e.tier < lo.tier ? e : lo), entries[0]);
    return {
      entries,
      weakest,
      maxed: entries.filter((e) => e.tier >= EQUIPMENT_TIER_MAX).length,
      unlocked: entries.filter((e) => e.tier > 0).length,
      avg: totalEquipTiers / EQUIPMENT_SLOTS.length,
      pct: Math.round((totalEquipTiers / MAX_TIERS) * 100),
    };
  }, [equipment, totalEquipTiers]);

  const mode = view.mode;
  const planMode = mode === 'tiers' && !!view.plan;
  const tSlot = view.slot && EQUIPMENT_SLOTS.includes(view.slot) ? view.slot : stats.weakest.slot;
  const pickSlot = mode === 'gear' ? (view.slot ?? null) : null;

  // Loadout planner (classic Equipment Lab's rules).
  const targetFor = (slot: string) => Math.max(targets[slot] ?? (equipment[slot] || 0), equipment[slot] || 0);
  const planCost = EQUIPMENT_SLOTS.reduce((sum, s) => sum + Math.max(0, targetFor(s) - (equipment[s] || 0)), 0);
  const setTarget = (slot: string, value: number) =>
    setTargets((t) => ({ ...t, [slot]: Math.min(EQUIPMENT_TIER_MAX, Math.max(equipment[slot] || 0, value)) }));
  const resetPlan = () => setTargets({});
  const maxPlan = () => setTargets(Object.fromEntries(EQUIPMENT_SLOTS.map((s) => [s, EQUIPMENT_TIER_MAX])));
  // Entering the planner starts from a clean plan, as the classic Plan button does.
  useEffect(() => { if (planMode) resetPlan(); }, [planMode]);

  const setMode = (m: OsrsLabMode) => onView({ mode: m, slot: m === 'tiers' ? tSlot : null });

  // Worn-equipment info box.
  const dt = equipment[tSlot] || 0;
  let info: { title: string; sub: string; hint: string };
  if (mode === 'tiers') {
    info = { title: `${tSlot}: Tier ${dt}${dt > 0 ? ` · ${TIER_LABELS[dt - 1]}` : ''}`, sub: 'Each slot shows the tier you can wear.', hint: 'Click a slot for its tier ladder.' };
  } else if (mode === 'dps') {
    info = { title: 'Using your equipped gear', sub: dpsLine, hint: 'Change pieces in the Gear view.' };
  } else if (pickSlot) {
    const it = gearService.byId(equipped[pickSlot]);
    const ut = equipment[pickSlot] || 0;
    info = { title: `${pickSlot}: ${it?.name ?? (equipped[pickSlot] != null ? 'equipped item' : 'empty')}`, sub: `Unlocked up to Tier ${ut}${ut ? ` · ${TIER_LABELS[ut - 1]}` : ''}`, hint: 'Click a slot to choose its gear.' };
  } else {
    info = { title: `${items.length}/${EQUIPMENT_SLOTS.length} equipped`, sub: `${totalEquipTiers} of ${MAX_TIERS} equipment tiers unlocked.`, hint: 'Click a slot to choose its gear.' };
  }

  return (
    <div className="osrs-dash-labfull">
      <div className="osrs-inner osrs-dash-labbar">
        <h2 className="osrs-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>Equipment Lab <LabGuide suspendModals={suspendModals} /></h2>
        <div role="group" aria-label="Equipment Lab view" style={{ display: 'flex', gap: 3 }}>
          {(['tiers', 'gear', 'dps'] as const).map((m) => (
            <button key={m} type="button" className={`osrs-btn${mode === m ? ' is-on' : ''}`} style={{ height: 26, padding: '0 12px' }} aria-pressed={mode === m} onClick={() => setMode(m)}>
              {m === 'tiers' ? 'Tiers' : m === 'gear' ? 'Gear' : 'DPS'}
            </button>
          ))}
        </div>
        <span className="osrs-dash-tan-s" style={{ marginLeft: 'auto' }}>{BAR_NOTE[mode]}</span>
        {mode === 'tiers' && (
          <>
            <span className="osrs-dash-yellow-s">{totalEquipTiers}/{MAX_TIERS} Tiers</span>
            <button type="button" className={`osrs-btn${planMode ? ' is-on' : ''}`} style={{ height: 28, padding: '0 10px' }} aria-pressed={planMode}
              onClick={() => onView({ mode: 'tiers', slot: tSlot, plan: !planMode })} title="Plan a target loadout and see the Omni-Key cost">
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14"><path d="M1 3h12M1 7h12M1 11h12" stroke="currentColor" strokeWidth="1.5" /><rect x="3" y="1" width="3" height="4" fill="#4a4033" stroke="currentColor" strokeWidth="1.5" /><rect x="8" y="5" width="3" height="4" fill="#4a4033" stroke="currentColor" strokeWidth="1.5" /><rect x="4" y="9" width="3" height="4" fill="#4a4033" stroke="currentColor" strokeWidth="1.5" /></svg>
              {planMode ? 'Done' : 'Plan'}
            </button>
          </>
        )}
        {onClose && (
          <button type="button" className="osrs-dash-close is-static" onClick={onClose} aria-label="Close Equipment Lab" title="Close the Equipment Lab (back to Skills)">
            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="2.5" /></svg>
          </button>
        )}
      </div>

      <div className="osrs-dash-labbody">
        <div className="osrs-dash-labmain">
          {mode === 'gear' && (
            <div className="osrs-dash-labgear">
              <OsrsGearPicker slot={pickSlot} status={status} onClose={() => onView({ mode: 'gear', slot: null })} onRetry={retry} />
              <OsrsGearStats status={status} />
            </div>
          )}
          {mode === 'dps' && <OsrsCharDps onSummary={setDpsLine} />}
          {mode === 'tiers' && (
            <div className="osrs-dash-labtiers">
              {planMode ? (
                <section className="osrs-win osrs-dash-labwin" aria-label="Target loadout">
                  <div className="osrs-dash-wintitle"><h3 className="osrs-title">Target loadout</h3></div>
                  <div className="osrs-dash-labpad">
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                      <button type="button" className="osrs-btn" style={{ height: 26 }} onClick={resetPlan}>Reset</button>
                      <button type="button" className="osrs-btn" style={{ height: 26, color: 'var(--osrs-yellow, #ff0)' }} onClick={maxPlan}>Max</button>
                    </div>
                    <div className="osrs-inner osrs-dash-tierrows">
                      {EQUIPMENT_SLOTS.map((slot) => {
                        const cur = equipment[slot] || 0;
                        const tgt = targetFor(slot);
                        return (
                          <div key={slot} className="osrs-dash-tierrow">
                            <span className="osrs-dash-tierrow-name" style={{ color: cur > 0 ? '#fff' : 'var(--osrs-muted, #8a7c66)' }}>{slot}</span>
                            <TierCells tier={cur} target={tgt} />
                            <button type="button" className="osrs-btn osrs-dash-step" onClick={() => setTarget(slot, tgt - 1)} disabled={tgt <= cur} aria-label={`Lower ${slot} target`}>-</button>
                            <span className="osrs-dash-yellow-s" style={{ width: 26, textAlign: 'center', color: 'var(--osrs-purple, #c77dff)' }}>T{tgt}</span>
                            <button type="button" className="osrs-btn osrs-dash-step" onClick={() => setTarget(slot, tgt + 1)} disabled={tgt >= EQUIPMENT_TIER_MAX} aria-label={`Raise ${slot} target`}>+</button>
                          </div>
                        );
                      })}
                    </div>
                    <div className="osrs-dash-plancost">
                      <span className="osrs-dash-tan-s">This loadout needs</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <img className="osrs-px" src={itemSrc('omni_key')} alt="" aria-hidden="true" width={18} height={16} />
                        <span className="osrs-sh" style={{ fontFamily: 'RSBold, sans-serif', color: planCost === 0 ? 'var(--osrs-tan, #c8b897)' : planCost <= specialKeys ? 'var(--osrs-green, #0dc10d)' : 'var(--osrs-yellow, #ff0)' }}>{planCost}</span>
                        <span className="osrs-dash-muted-s">Omni · have {specialKeys}</span>
                      </span>
                    </div>
                  </div>
                </section>
              ) : (
                <section className="osrs-win osrs-dash-labwin" aria-label="Tier breakdown">
                  <div className="osrs-dash-wintitle"><h3 className="osrs-title">Equipment Tiers</h3></div>
                  <div className="osrs-dash-labpad">
                    <div className="osrs-dash-tiles">
                      {[
                        { label: 'Gear', value: `${stats.pct}%`, sub: `${totalEquipTiers}/${MAX_TIERS}`, color: 'var(--osrs-orange, #ff981f)' },
                        { label: 'Avg Tier', value: stats.avg.toFixed(1), sub: `${stats.unlocked}/${EQUIPMENT_SLOTS.length} used`, color: '#fff' },
                        { label: 'Maxed', value: `${stats.maxed}`, sub: `at T${EQUIPMENT_TIER_MAX}`, color: 'var(--osrs-yellow, #ff0)' },
                        { label: 'Weakest', value: stats.weakest.slot, sub: `T${stats.weakest.tier}`, color: 'var(--osrs-red, #ff3030)' },
                      ].map((t) => (
                        <div key={t.label} className="osrs-inner osrs-dash-tile">
                          <span className="osrs-dash-muted-s">{t.label}</span>
                          <span style={{ fontFamily: 'RSBold, sans-serif', color: t.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={t.value}>{t.value}</span>
                          <span className="osrs-dash-tan-s">{t.sub}</span>
                        </div>
                      ))}
                    </div>
                    <div className="osrs-dash-ladder osrs-dash-muted-s">
                      <span>Low</span>
                      {EQUIP_GEMS.map((g, i) => (
                        <span key={g.name} title={`Tier ${i + 1} · ${TIER_LABELS[i]}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                          <img className="osrs-px" src={gemSrc(i + 1)} alt="" aria-hidden="true" width={27} height={24} />
                          <span style={{ color: g.color }}>{i + 1}</span>
                        </span>
                      ))}
                      <span>Max</span>
                    </div>
                    <div className="osrs-inner osrs-dash-tierrows is-spread">
                      {stats.entries.map(({ slot, tier }) => (
                        <button key={slot} type="button" className={`osrs-dash-tierrow is-btn${slot === tSlot ? ' is-on' : ''}`}
                          aria-label={`${slot}: Tier ${tier}. Show details`} aria-pressed={slot === tSlot} onClick={() => onView({ mode: 'tiers', slot })}>
                          <span className="osrs-dash-tierrow-name" style={{ color: tier > 0 ? '#fff' : 'var(--osrs-muted, #8a7c66)' }}>{slot}</span>
                          <TierCells tier={tier} />
                          <span className="osrs-dash-yellow-s" style={{ width: 30, textAlign: 'right', color: tier > 0 ? 'var(--osrs-orange, #ff981f)' : 'var(--osrs-muted, #8a7c66)' }}>T{tier}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </section>
              )}
              <SlotDetail slot={tSlot} tier={dt} specialKeys={specialKeys} onUpgrade={() => onUpgrade(tSlot)} />
            </div>
          )}
        </div>

        <section className="osrs-win osrs-dash-wornwin" aria-label="Worn Equipment">
          <div className="osrs-dash-wintitle"><h3 className="osrs-title">Worn Equipment</h3></div>
          <div className="osrs-dash-wornbody">
            <div className="osrs-char-wornrow">
              <OsrsCharDoll suspendModals={suspendModals} slots={EQUIPMENT_SLOTS.map((slot): DollSlot => {
                const ut = equipment[slot] || 0;
                const id = equipped[slot];
                const item = status === 'ready' ? gearService.byId(id) : undefined;
                const sel = mode === 'tiers' ? tSlot === slot : pickSlot === slot;
                const clickable = mode !== 'dps';
                const pick = () => {
                  if (mode === 'tiers') onView({ mode: 'tiers', slot, plan: view.plan });
                  else if (mode === 'gear') onView({ mode: 'gear', slot });
                };
                if (mode === 'tiers') {
                  return {
                    slot, itemId: id, imageFile: item?.imageFile, gem: ut, dim: ut === 0, selected: sel,
                    omni: ut < EQUIPMENT_TIER_MAX && specialKeys > 0, note: true,
                    label: `${slot}: Tier ${ut}, click for details`, examine: slotExamine(slot, ut, item?.name), onClick: pick,
                  };
                }
                // Gear and DPS: a worn item shows its own tier gem; an empty slot the tier it is unlocked to.
                const tier = item ? gearService.tierOf(item.id) : 0;
                const est = item ? canonicalTierFromName(item.name) == null : false;
                const aria = id != null
                  ? `${slot}: ${item?.name ?? 'equipped item'}${item ? `, ${est ? 'Est. ' : ''}Tier ${tier}` : ''}${clickable ? `. Choose ${slot}` : ''}`
                  : `${slot}: empty, unlocked up to Tier ${ut}${clickable ? `. Choose ${slot}` : ''}`;
                return {
                  slot, itemId: id, imageFile: item?.imageFile, gem: id != null ? tier : ut, dim: id == null && ut === 0, selected: sel,
                  label: aria, examine: slotExamine(slot, ut, item?.name), onClick: pick, disabled: !clickable,
                };
              })} />
            </div>
            <div className="osrs-inner osrs-sh osrs-dash-worninfo">
              <span style={{ color: '#fff' }}>{info.title}</span>
              {info.sub && <span style={{ color: 'var(--osrs-tan, #c8b897)' }}>{info.sub}</span>}
              <span style={{ fontFamily: 'RSSmall, sans-serif', color: 'var(--osrs-muted, #8a7c66)' }}>{info.hint}</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

const SlotDetail: React.FC<{ slot: string; tier: number; specialKeys: number; onUpgrade: () => void }> = ({ slot, tier, specialKeys, onUpgrade }) => {
  const isMaxed = tier >= EQUIPMENT_TIER_MAX;
  const nextTier = tier + 1;
  const canUpgrade = !isMaxed && specialKeys > 0;
  return (
    <section className="osrs-win osrs-dash-labwin" aria-label={`${slot} details`}>
      <div className="osrs-dash-wintitle"><h3 className="osrs-title">{slot}</h3></div>
      <div className="osrs-dash-labpad" style={{ gap: 12, padding: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="osrs-slot" style={{ width: 52, height: 48, flexShrink: 0, boxShadow: 'inset 0 0 0 1px #857048' }}>
            <img className="osrs-px" src={gemSrc(Math.max(tier, 1))} alt="" aria-hidden="true" width={36} height={32} style={tier > 0 ? undefined : { filter: 'grayscale(1) brightness(.5)' }} />
          </span>
          <span className="osrs-sh" style={{ display: 'flex', flexDirection: 'column', lineHeight: '18px' }}>
            <span style={{ fontFamily: 'RSBold, sans-serif', color: '#fff' }}>{slot}</span>
            <span style={{ color: 'var(--osrs-tan, #c8b897)' }}>Tier {tier}{tier > 0 && <span style={{ color: 'var(--osrs-orange, #ff981f)' }}> · {TIER_LABELS[tier - 1]}</span>}</span>
          </span>
        </div>
        <div className="osrs-dash-detailcells">
          {EQUIP_GEMS.map((g, i) => {
            const t = i + 1;
            const reached = tier >= t;
            return (
              <span key={g.name} title={`Tier ${t} · ${TIER_LABELS[i]}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                <span style={{
                  display: 'block', width: '100%', height: 30, boxSizing: 'border-box', border: '1px solid #000',
                  background: reached ? g.color : '#221d15',
                  boxShadow: reached ? 'inset 0 -3px 0 rgba(0,0,0,.35)' : undefined,
                  outline: t === nextTier ? '2px solid var(--osrs-purple, #c77dff)' : undefined, outlineOffset: 1,
                }} />
                <span className="osrs-sh" style={{ font: "16px 'RSSmall', sans-serif", color: reached ? '#fff' : 'var(--osrs-muted, #8a7c66)' }}>{t}</span>
              </span>
            );
          })}
        </div>
        {isMaxed ? (
          <div className="osrs-inner osrs-sh" style={{ padding: '6px 10px', color: 'var(--osrs-yellow, #ff0)' }}>
            Maxed: Tier {EQUIPMENT_TIER_MAX} ({TIER_LABELS[EQUIPMENT_TIER_MAX - 1]})
          </div>
        ) : (
          <>
            <div className="osrs-inner osrs-sh" style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--osrs-tan, #c8b897)' }}>
              <span>Next: <span style={{ color: '#fff' }}>Tier {nextTier}</span><span style={{ color: 'var(--osrs-orange, #ff981f)' }}> · {TIER_LABELS[nextTier - 1]}</span></span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--osrs-purple, #c77dff)' }}>
                <img className="osrs-px" src={itemSrc('omni_key')} alt="" aria-hidden="true" width={18} height={16} />1 Omni-Key
              </span>
            </div>
            <button type="button" className="osrs-btn" style={{ height: 34, gap: 8, color: canUpgrade ? 'var(--osrs-purple, #c77dff)' : undefined }} onClick={onUpgrade} disabled={!canUpgrade}>
              {!canUpgrade && <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12"><rect x="2" y="5" width="8" height="6" fill="currentColor" /><path d="M4 5V3.5a2 2 0 0 1 4 0V5" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>}
              {canUpgrade ? `Upgrade to Tier ${nextTier}` : 'Need an Omni-Key'}
            </button>
            {tier === 0 && <p className="osrs-dash-muted-s" style={{ margin: 0 }}>This slot is locked. Unlocking grants Tier 1.</p>}
          </>
        )}
        <p className="osrs-dash-muted-s" style={{ margin: 'auto 0 0', lineHeight: '16px' }}>
          You hold {specialKeys} Omni-Key{specialKeys === 1 ? '' : 's'}. Each Omni-Key raises one slot by one tier.
        </p>
      </div>
    </section>
  );
};

/** The lab on its own (EquipmentLab's OSRS branch): the full view, starting on Tiers. */
export const OsrsEquipment: React.FC<Props> = (props) => {
  const [view, setView] = useState<OsrsLabView>({ mode: 'tiers' });
  return <OsrsLabFull {...props} view={view} onView={setView} />;
};

export default OsrsEquipment;
