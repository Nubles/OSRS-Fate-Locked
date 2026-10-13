import React, { Suspense, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { lazyWithRetry } from '../../utils/lazyRetry';
import { useGame } from '../../context/GameContext';
import { EQUIPMENT_SLOTS, EQUIPMENT_TIER_MAX, SLOT_CONFIG } from '../../constants';
import { NoteTrigger } from '../NoteTrigger';
import { SectionGuide } from '../SectionGuide';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { TIER_LABELS } from '../../utils/combatPower';
import { TIER_GEMS, gemSrc, gemColor, itemSrc } from './OsrsDashGems';
import './osrs-dashboard.css';

const GearView = lazyWithRetry(() => import('../GearView').then(m => ({ default: m.GearView })));
const DpsCalc = lazyWithRetry(() => import('../DpsCalc').then(m => ({ default: m.DpsCalc })));

/**
 * Equipment Lab in the OSRS layout: the worn-equipment interface (each slot
 * shows the gem of its unlocked tier and a tier badge), the tier breakdown or
 * the loadout planner below it, and the slot detail as an OSRS window. Same
 * state, props and Omni-Key upgrade flow as the classic Equipment Lab.
 */

interface Props {
  onUpgrade: (slot: string) => void;
  suspendModals?: boolean;
}

const slotImg = (slot: string) =>
  `https://oldschool.runescape.wiki/images/${SLOT_CONFIG[slot]?.file ?? 'Globe_icon.png'}`;

/** The worn-equipment interface layout: 3 columns x 5 rows, as in game. */
const DOLL_LAYOUT = ['', 'Head', '', 'Cape', 'Neck', 'Ammo', 'Weapon', 'Body', 'Shield', '', 'Legs', '', 'Gloves', 'Boots', 'Ring'];
const EQUIP_GEMS = TIER_GEMS.slice(0, EQUIPMENT_TIER_MAX);

const slotExamine = (slot: string, tier: number) =>
  tier > 0
    ? `${slot} slot. Tier ${tier} unlocked: up to ${TIER_LABELS[tier - 1]} gear.`
    : `${slot} slot. Locked: no tier unlocked yet.`;

const TierCells: React.FC<{ tier: number; target?: number }> = ({ tier, target = 0 }) => (
  <span className="osrs-dash-cells" aria-hidden="true">
    {EQUIP_GEMS.map((g, i) => (
      <span key={g.name} style={{ background: tier > i ? gemColor(tier) : target > i ? 'rgba(199,125,255,.45)' : 'var(--osrs-slot-hi, #2a231a)' }} />
    ))}
  </span>
);

export const OsrsEquipment: React.FC<Props> = ({ onUpgrade, suspendModals = false }) => {
  const { unlocks, specialKeys } = useGame();
  const equipment = unlocks.equipment;

  const [mode, setMode] = useState<'tiers' | 'gear' | 'dps'>('tiers');
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
    <div className="osrs-dash-equip">
      <div className="osrs-inner osrs-dash-equipbar">
        <h3 className="osrs-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          Equipment Lab <SectionGuide id="EQUIPMENT_LAB" suspendModals={suspendModals} />
        </h3>
        <div role="group" aria-label="Equipment Lab view" style={{ display: 'flex', gap: 3 }}>
          {(['tiers', 'gear', 'dps'] as const).map((m) => (
            <button key={m} type="button" className={`osrs-btn${mode === m ? ' is-on' : ''}`} style={{ height: 26 }} aria-pressed={mode === m} onClick={() => setMode(m)}>
              {m === 'tiers' ? 'Tiers' : m === 'gear' ? 'Gear' : 'DPS'}
            </button>
          ))}
        </div>
        {mode === 'tiers' && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="osrs-dash-yellow-s">{totalEquipTiers}/{maxPossible} Tiers</span>
            <button
              type="button"
              className={`osrs-btn${planMode ? ' is-on' : ''}`}
              style={{ height: 26 }}
              onClick={() => (planMode ? setPlanMode(false) : enterPlan())}
              title="Plan a target loadout and see the Omni-Key cost"
            >
              {planMode ? 'Done' : 'Plan'}
            </button>
          </div>
        )}
      </div>

      <Suspense fallback={<p role="status" className="osrs-sh" style={{ padding: 16, color: 'var(--osrs-tan, #c8b897)' }}>Loading equipment tools...</p>}>
        {mode === 'gear' && <GearView suspendModals={suspendModals} />}
        {mode === 'dps' && <DpsCalc suspendModals={suspendModals} />}
      </Suspense>

      {mode === 'tiers' && (
        <>
          <section className="osrs-win" aria-label="Worn Equipment">
            <div className="osrs-dash-wintitle"><h3 className="osrs-title">Worn Equipment</h3></div>
            <div className="osrs-dash-doll">
              {DOLL_LAYOUT.map((slot, i) => {
                if (!slot || !SLOT_CONFIG[slot]) return <span key={`gap-${i}`} aria-hidden="true" />;
                const tier = equipment[slot] || 0;
                const isUnlocked = tier > 0;
                const canUnlock = tier < EQUIPMENT_TIER_MAX && specialKeys > 0;
                return (
                  <div key={slot} className="osrs-dash-dollcell" data-examine-name={`${slot} slot`} data-examine={slotExamine(slot, tier)}>
                    <button
                      type="button"
                      onClick={() => setSelected(slot)}
                      className={`osrs-dash-dollslot${isUnlocked ? ' is-on' : ''}`}
                      title={`${slot}: Tier ${tier} — click for details`}
                      aria-label={`${slot}: Tier ${tier}, click for details`}
                    >
                      {isUnlocked
                        ? <img className="osrs-px" src={gemSrc(tier)} alt="" aria-hidden="true" width={36} height={32} style={{ marginTop: -10 }} />
                        : <img src={slotImg(slot)} alt="" aria-hidden="true" width={34} height={34} style={{ opacity: 0.35, objectFit: 'contain' }} />}
                      <span className="osrs-dash-dollbadge" style={{ color: isUnlocked ? 'var(--osrs-yellow, #ff0)' : 'var(--osrs-muted, #8a7c66)' }}>
                        {isUnlocked ? `${slot} · T${tier}` : `T${tier}`}
                      </span>
                      {canUnlock && (
                        <img className="osrs-px osrs-dash-dollomni" src={itemSrc('omni_key')} alt="" aria-hidden="true" width={18} height={16} title="An Omni-Key can raise this slot" />
                      )}
                    </button>
                    <div className="osrs-dash-dollnote">
                      <NoteTrigger id={`Equip_${slot}`} title={slot} suspendModals={suspendModals} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="osrs-dash-tan-s" style={{ textAlign: 'center', padding: '0 8px 8px' }}>Each slot shows the tier you can wear. Click a slot for its tier ladder.</div>
          </section>

          {planMode ? (
            <section className="osrs-win" aria-label="Target loadout">
              <div className="osrs-dash-wintitle">
                <h3 className="osrs-title">Target loadout</h3>
              </div>
              <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                  <button type="button" className="osrs-btn" style={{ height: 24 }} onClick={resetPlan}>Reset</button>
                  <button type="button" className="osrs-btn" style={{ height: 24, color: 'var(--osrs-yellow, #ff0)' }} onClick={maxPlan}>Max</button>
                </div>
                <div className="osrs-inner" style={{ padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
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
                    <span style={{ fontFamily: 'RSBold, sans-serif', color: planCost === 0 ? 'var(--osrs-tan, #c8b897)' : planCost <= specialKeys ? 'var(--osrs-green, #0dc10d)' : 'var(--osrs-yellow, #ff0)' }}>{planCost}</span>
                    <span className="osrs-dash-muted-s">Omni · have {specialKeys}</span>
                  </span>
                </div>
              </div>
            </section>
          ) : (
            <section className="osrs-win" aria-label="Equipment Tiers">
              <div className="osrs-dash-wintitle"><h3 className="osrs-title">Equipment Tiers</h3></div>
              <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="osrs-dash-tiles">
                  {[
                    { label: 'Gear', value: `${stats.pct}%`, sub: `${totalEquipTiers}/${maxPossible}`, color: 'var(--osrs-orange, #ff981f)' },
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
                <div className="osrs-dash-ladder">
                  <span className="osrs-dash-muted-s">Low</span>
                  {EQUIP_GEMS.map((g, i) => (
                    <span key={g.name} title={`Tier ${i + 1} · ${TIER_LABELS[i]}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <img className="osrs-px" src={gemSrc(i + 1)} alt="" aria-hidden="true" width={27} height={24} />
                      <span className="osrs-sh" style={{ font: "16px 'RSSmall', sans-serif", color: g.color }}>{i + 1}</span>
                    </span>
                  ))}
                  <span className="osrs-dash-muted-s">Max</span>
                </div>
                <div className="osrs-inner" style={{ padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {stats.entries.map(({ slot, tier }) => (
                    <div key={slot} className="osrs-dash-tierrow">
                      <span className="osrs-dash-tierrow-name" style={{ color: tier > 0 ? '#fff' : 'var(--osrs-muted, #8a7c66)' }}>{slot}</span>
                      <TierCells tier={tier} />
                      <span className="osrs-dash-yellow-s" style={{ width: 28, textAlign: 'right', color: tier >= EQUIPMENT_TIER_MAX ? 'var(--osrs-yellow, #ff0)' : tier > 0 ? 'var(--osrs-orange, #ff981f)' : 'var(--osrs-muted, #8a7c66)' }}>T{tier}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {!suspendModals && selected && (
            <OsrsSlotDetail
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

interface SlotDetailProps {
  slot: string;
  tier: number;
  specialKeys: number;
  onClose: () => void;
  onUpgrade: () => void;
}

const OsrsSlotDetail: React.FC<SlotDetailProps> = ({ slot, tier, specialKeys, onClose, onUpgrade }) => {
  useEscapeKey(onClose, true);
  const isMaxed = tier >= EQUIPMENT_TIER_MAX;
  const nextTier = tier + 1;
  const canUpgrade = !isMaxed && specialKeys > 0;
  const curLabel = tier > 0 ? TIER_LABELS[tier - 1] : 'Locked';

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,.6)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${slot} details`}
    >
      <div className="osrs-win" style={{ width: 380, maxWidth: '100%' }} onClick={(e) => e.stopPropagation()}>
        <div className="osrs-dash-wintitle">
          <h3 className="osrs-title">{slot}</h3>
          <button type="button" onClick={onClose} className="osrs-dash-close" aria-label="Close">
            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="2.5" /></svg>
          </button>
        </div>
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="osrs-slot" style={{ width: 52, height: 48, flexShrink: 0, boxShadow: 'inset 0 0 0 1px #857048' }}>
              {tier > 0
                ? <img className="osrs-px" src={gemSrc(tier)} alt="" aria-hidden="true" width={36} height={32} />
                : <img src={slotImg(slot)} alt="" aria-hidden="true" width={30} height={30} style={{ opacity: 0.4, objectFit: 'contain' }} />}
            </span>
            <span className="osrs-sh" style={{ display: 'flex', flexDirection: 'column', lineHeight: '18px' }}>
              <span style={{ fontFamily: 'RSBold, sans-serif', color: '#fff' }}>{slot}</span>
              <span style={{ color: 'var(--osrs-tan, #c8b897)' }}>Tier {tier}{tier > 0 && <span style={{ color: 'var(--osrs-orange, #ff981f)' }}> · {curLabel}</span>}</span>
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
              <button type="button" className="osrs-btn" style={{ height: 34, color: canUpgrade ? 'var(--osrs-purple, #c77dff)' : undefined }} onClick={onUpgrade} disabled={!canUpgrade}>
                {canUpgrade ? `Upgrade to Tier ${nextTier}` : 'Need an Omni-Key'}
              </button>
              {tier === 0 && (
                <p className="osrs-dash-muted-s" style={{ margin: 0 }}>This slot is locked. Unlocking grants Tier 1.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default OsrsEquipment;
