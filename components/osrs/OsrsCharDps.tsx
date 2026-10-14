import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { EQUIPMENT_SLOTS } from '../../constants';
import { gearService } from '../../services/GearService';
import { monsterKey, monsterService } from '../../services/MonsterService';
import { attackBonuses, GearItem, ZERO_BONUSES } from '../../utils/gearStats';
import { computeDps, formatTimeToKill, STANCES, PRAYERS, POTIONS, Style, AttackType, DpsInput, type Stance } from '../../utils/dps';
import { WikiLink } from '../WikiLink';
import { rangedDefenceFor, type RangedDamageType } from '../../utils/rangedDamage';
import { dpsCombatOptions } from '../../utils/weaponCombat';
import { skillIconSrc } from './OsrsDashGems';

/**
 * Equipment Lab, DPS view: the classic DpsCalc inside the Equipment Lab
 * panel (one column when the panel is narrow, two when it is wide). Same
 * state, options, data and computeDps call; the stance is a 2 x 2 grid of
 * buttons (each one an attack type + stance the weapon has) and the target
 * picker sits inline instead of in a popover.
 */

type Status = 'loading' | 'ready' | 'error';
const cap = (x: string) => x[0].toUpperCase() + x.slice(1);

/** The stance's boost, from its own numbers in utils/dps. */
const stanceBoost = (style: Style, s: Stance, speedTicks?: number): string => {
  if (s.speedDelta < 0) return `${-s.speedDelta} tick faster`;
  if (style === 'melee') {
    if (s.atk && s.str) return `+${s.atk} Atk, +${s.str} Str`;
    if (s.atk) return `+${s.atk} Attack`;
    if (s.str) return `+${s.str} Strength`;
    return 'no Atk/Str boost';
  }
  if (s.atk) return `+${s.atk} ${style === 'ranged' ? 'Ranged' : 'Magic'}`;
  if (style === 'magic' && speedTicks) return `${speedTicks} ticks`;
  return 'no boost';
};

const TILE_ICON: Record<string, string> = {
  'Max hit': 'M7 1L2 7h4l-1 4 5-6H6z',
  'Hit chance': 'M6 1.5a4.5 4.5 0 1 0 0.01 0M6 4a2 2 0 1 0 0.01 0',
  DPS: 'M2 10l7-7M7 2h3v3M10 10L3 3M2 5V2h3',
  'Time to kill': 'M6 1a5 5 0 1 0 0.01 0M6 3v3l2 1.5',
};

const Crosshair: React.FC<{ on: boolean }> = ({ on }) => (
  <svg aria-hidden="true" width="22" height="22" viewBox="0 0 22 22">
    <circle cx="11" cy="11" r="7" fill="none" stroke={on ? '#ff3030' : '#8a7c66'} strokeWidth="2" />
    <circle cx="11" cy="11" r="2" fill={on ? '#ff3030' : '#8a7c66'} />
    <path d="M11 1v5M11 16v5M1 11h5M16 11h5" stroke={on ? '#ff3030' : '#8a7c66'} strokeWidth="2" />
  </svg>
);

interface Props {
  /** One line for the worn-equipment panel: the weapon, accuracy and strength in use. */
  onSummary?: (line: string) => void;
}

export const OsrsCharDps: React.FC<Props> = ({ onSummary }) => {
  const { unlocks, loadout: rawLoadout } = useGame();
  const loadout = rawLoadout || {};

  const [status, setStatus] = useState<Status>(gearService.ready && monsterService.ready ? 'ready' : 'loading');
  useEffect(() => {
    let alive = true;
    setStatus('loading');
    Promise.all([gearService.init(), monsterService.init()])
      .then(() => alive && setStatus('ready'))
      .catch(() => alive && setStatus('error'));
    return () => { alive = false; };
  }, []);
  const retry = () => { setStatus('loading'); Promise.all([gearService.init(true), monsterService.init(true)]).then(() => setStatus('ready')).catch(() => setStatus('error')); };

  const [style, setStyle] = useState<Style>('melee');
  const [meleeType, setMeleeType] = useState<AttackType>('slash');
  const [rangedOverride, setRangedOverride] = useState<RangedDamageType | 'auto'>('auto');
  const [stanceId, setStanceId] = useState('aggressive');
  const [prayerId, setPrayerId] = useState('none');
  const [potionId, setPotionId] = useState('none');
  const [baseSpellMax, setBaseSpellMax] = useState(24);
  const [levels, setLevels] = useState({ attack: 99, strength: 99, ranged: 99, magic: 99 });
  const [targetKey, setTargetKey] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const L = unlocks.levels || {};
    setLevels({
      attack: L.Attack || 1, strength: L.Strength || 1, ranged: L.Ranged || 1, magic: L.Magic || 1,
    });
  }, [unlocks.levels]);

  useEffect(() => {
    setPrayerId('none'); setPotionId('none');
  }, [style]);

  const attackType: AttackType = style === 'melee' ? meleeType : style === 'ranged' ? 'ranged' : 'magic';

  const gear = useMemo(() => {
    const items = EQUIPMENT_SLOTS.map((s) => gearService.byId(loadout[s])).filter((x): x is GearItem => !!x);
    const b = items.length ? attackBonuses(items) : { ...ZERO_BONUSES };
    const weapon = gearService.byId(loadout['Weapon']);
    const accuracy = attackType === 'stab' ? b.stab : attackType === 'slash' ? b.slash : attackType === 'crush' ? b.crush : attackType === 'ranged' ? b.ranged : b.magic;
    return { bonuses: b, accuracy, meleeStr: b.meleeStr, rangedStr: b.rangedStr, magicDmgPct: b.magicStr, speedTicks: weapon?.speed || 4, weaponName: weapon?.name, category: weapon?.category ?? (loadout['Weapon'] == null ? 'Unarmed' : undefined), rangedDamageType: weapon?.rangedDamageType, count: items.length };
  }, [loadout, attackType, status]);

  const combatOptions = useMemo(() => dpsCombatOptions(gear.category), [gear.category]);
  const styleOptions = combatOptions.filter(option => option.style === style);
  const meleeTypes = [...new Set(styleOptions.map(option => option.attackType))];
  const selectedOption = styleOptions.find(option => option.attackType === attackType && option.stanceId === stanceId);
  useEffect(() => {
    if (!combatOptions.length || selectedOption) return;
    const next = styleOptions.find(option => option.attackType === attackType) ?? styleOptions[0] ?? combatOptions[0];
    setStyle(next.style);
    if (next.style === 'melee') setMeleeType(next.attackType);
    setStanceId(next.stanceId);
  }, [combatOptions, style, attackType, stanceId]);

  const monster = monsterService.byKey(targetKey);
  const rangedType = rangedOverride === 'auto' ? gear.rangedDamageType ?? 'standard' : rangedOverride;

  const result = useMemo(() => {
    if (!monster || !selectedOption) return null;
    const defLevel = style === 'magic' ? monster.magicLevel : monster.defLevel;
    const defBonus = attackType === 'stab' ? monster.def.stab : attackType === 'slash' ? monster.def.slash : attackType === 'crush' ? monster.def.crush : attackType === 'ranged' ? rangedDefenceFor(monster, rangedType) : monster.def.magic;
    const input: DpsInput = {
      style, attackType, stanceId, prayerId, potionId, baseSpellMax,
      levels, gear: { accuracy: gear.accuracy, meleeStr: gear.meleeStr, rangedStr: gear.rangedStr, magicDmgPct: gear.magicDmgPct, speedTicks: selectedOption.speedTicks ?? gear.speedTicks },
      monster: { defLevel, defBonus, hp: monster.hp },
    };
    return computeDps(input);
  }, [monster, style, attackType, stanceId, prayerId, potionId, baseSpellMax, levels, gear, rangedType, selectedOption]);

  const fmt = (v: number) => `${v > 0 ? '+' : ''}${v}`;
  const strPart = style === 'melee' ? `melee str ${fmt(gear.meleeStr)}` : style === 'ranged' ? `ranged str ${fmt(gear.rangedStr)}` : `magic dmg ${fmt(gear.magicDmgPct)}%`;
  const summary = gear.count > 0
    ? `${gear.weaponName ?? 'Unarmed'} · ${attackType} accuracy ${fmt(gear.accuracy)} · ${strPart}`
    : 'No gear equipped. Equip items in the Gear view.';
  useEffect(() => { onSummary?.(summary); }, [summary, onSummary]);

  const targets = useMemo(() => (status === 'ready' ? monsterService.search(query, 80) : []), [query, status]);
  // In the narrow panel the result sits below the target list: bring it into view once a target is chosen.
  const resultRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (targetKey) resultRef.current?.scrollIntoView?.({ block: 'nearest' }); }, [targetKey]);

  if (status !== 'ready') {
    return (
      <section className="osrs-char-dps" aria-label="DPS calculator">
        <div className="osrs-dash-labempty">
          <span role="status" className="osrs-sh" style={{ color: status === 'error' ? 'var(--osrs-red, #ff3030)' : 'var(--osrs-tan, #c8b897)' }}>
            {status === 'loading' ? 'Loading gear + monster data...' : (monsterService.error || gearService.error || 'Could not load data.')}
          </span>
          {status === 'error' && <button type="button" className="osrs-btn" style={{ height: 28 }} onClick={retry}>Retry</button>}
        </div>
      </section>
    );
  }

  const styleLevels: { key: keyof typeof levels; label: string; icon: string }[] =
    style === 'melee' ? [{ key: 'attack', label: 'Attack', icon: 'Attack' }, { key: 'strength', label: 'Strength', icon: 'Strength' }]
      : style === 'ranged' ? [{ key: 'ranged', label: 'Ranged', icon: 'Ranged' }]
        : [{ key: 'magic', label: 'Magic', icon: 'Magic' }];
  const stanceOf = (id: string) => STANCES[style].find((s) => s.id === id);
  const L = unlocks.levels || {};

  return (
    <section className="osrs-char-dps" aria-label="DPS calculator">
      <div className="osrs-dash-dpsgrid">
        <div className="osrs-dash-dpscol">
          <div role="group" aria-label="Combat style" className="osrs-dash-dpsstyles">
            {(['melee', 'ranged', 'magic'] as const).map((id) => {
              const ok = combatOptions.some(option => option.style === id);
              const on = style === id;
              return (
                <button key={id} type="button" className={`osrs-btn osrs-dash-dpsstyle${on ? ' is-red' : ''}`} aria-pressed={on} disabled={!ok}
                  title={ok ? cap(id) : `Your weapon has no ${id} attack`} onClick={() => setStyle(id)}>
                  <img className="osrs-px" src={skillIconSrc(id === 'melee' ? 'Attack' : cap(id))} alt="" aria-hidden="true" width={25} height={25} style={ok ? undefined : { filter: 'grayscale(1) brightness(.6)' }} />
                  {cap(id)}
                </button>
              );
            })}
          </div>

          {!combatOptions.length && <p role="status" className="osrs-sh" style={{ margin: 0, color: 'var(--osrs-yellow, #ff0)' }}>Attack options for this weapon need review before a combat estimate is available.</p>}

          {styleOptions.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span className="osrs-dash-lbl">Stance</span>
              <div role="group" aria-label="Stance" className="osrs-dash-stances">
                {styleOptions.map((o) => {
                  const st = stanceOf(o.stanceId);
                  if (!st) return null;
                  const on = o.attackType === attackType && o.stanceId === stanceId;
                  return (
                    <button key={`${o.attackType}-${o.stanceId}`} type="button" className={`osrs-dash-stance${on ? ' is-red' : ''}`} aria-pressed={on}
                      onClick={() => { if (style === 'melee') setMeleeType(o.attackType); setStanceId(o.stanceId); }}>
                      <span style={{ font: "16px 'RSBold', sans-serif", color: on ? '#fff' : 'var(--osrs-orange, #ff981f)' }}>{st.label}</span>
                      <span style={{ font: "16px 'RSSmall', sans-serif", color: 'var(--osrs-tan, #c8b897)' }}>
                        {style === 'melee' ? `${cap(o.attackType)} · ` : ''}{stanceBoost(style, st, o.speedTicks)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="osrs-dash-dpsfields">
            {style === 'melee' && (
              <label className="osrs-dash-field"><span className="osrs-dash-lbl">Attack type</span>
                <select className="osrs-dash-sel" value={meleeType} onChange={(e) => setMeleeType(e.target.value as AttackType)}>
                  {meleeTypes.map((t) => <option key={t} value={t}>{cap(t)}</option>)}
                </select>
              </label>
            )}
            {style === 'ranged' && (
              <label className="osrs-dash-field"><span className="osrs-dash-lbl">Ranged damage type</span>
                <select className="osrs-dash-sel" value={rangedOverride} onChange={e => setRangedOverride(e.target.value as RangedDamageType | 'auto')}>
                  <option value="auto">{gear.rangedDamageType ? `Weapon: ${gear.rangedDamageType}` : 'Standard assumed — select your type'}</option>
                  <option value="light">Light</option><option value="standard">Standard</option><option value="heavy">Heavy</option>
                </select>
              </label>
            )}
            {style === 'magic' && (
              <label className="osrs-dash-field"><span className="osrs-dash-lbl">Spell base max</span>
                <input className="osrs-dash-num" type="number" value={baseSpellMax} min={0} onChange={(e) => setBaseSpellMax(Math.max(0, +e.target.value || 0))} />
              </label>
            )}
            <label className="osrs-dash-field"><span className="osrs-dash-lbl">Potion</span>
              <select className="osrs-dash-sel" value={potionId} onChange={(e) => setPotionId(e.target.value)}>
                {POTIONS[style].map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </label>
            <label className="osrs-dash-field" style={{ gridColumn: '1 / -1' }}><span className="osrs-dash-lbl">Prayer</span>
              <select className="osrs-dash-sel" value={prayerId} onChange={(e) => setPrayerId(e.target.value)}>
                {PRAYERS[style].map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </label>
            {styleLevels.map(({ key, label, icon }) => (
              <label key={key} className="osrs-dash-field"><span className="osrs-dash-lbl" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <img className="osrs-px" src={skillIconSrc(icon, true)} alt="" aria-hidden="true" width={16} height={16} />{label} lvl</span>
                <input className="osrs-dash-num" type="number" value={levels[key]} min={1} max={99} onChange={(e) => setLevels((l) => ({ ...l, [key]: Math.min(99, Math.max(1, +e.target.value || 1)) }))} />
              </label>
            ))}
          </div>

          <div className="osrs-dash-infoline">
            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" style={{ flexShrink: 0, marginTop: 2 }}><circle cx="6" cy="6" r="5" fill="none" stroke="#c8b897" strokeWidth="1.3" /><path d="M6 5v4M6 3v.5" stroke="#c8b897" strokeWidth="1.5" /></svg>
            <span>{gear.count > 0
              ? `Using your equipped gear${gear.weaponName ? ` · ${gear.weaponName}` : ''} (${selectedOption?.speedTicks ?? gear.speedTicks}t before stance)`
              : 'No gear equipped. Equip items in the Gear view.'}</span>
          </div>
          <p className="osrs-dash-muted-s" style={{ margin: 0, lineHeight: '16px' }}>
            Levels start from your run: Attack {L.Attack || 1}, Strength {L.Strength || 1}, Ranged {L.Ranged || 1}, Magic {L.Magic || 1}.
          </p>
        </div>

        <div className="osrs-dash-dpscol">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
            <span className="osrs-dash-lbl">Choose target</span>
            <label className="osrs-dash-search is-wide">
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14"><circle cx="6" cy="6" r="4.5" fill="none" stroke="#c8b897" strokeWidth="2" /><path d="M9.5 9.5l3.5 3.5" stroke="#c8b897" strokeWidth="2" /></svg>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search monsters..." aria-label="Search monsters" />
            </label>
            <div className="osrs-inner osrs-dash-targets" role="list" aria-label="Target monsters">
              {targets.length === 0 && <p className="osrs-dash-muted-s osrs-dash-pickmsg">No monsters match.</p>}
              {targets.map((m) => {
                const key = monsterKey(m);
                const on = key === targetKey;
                return (
                  <button key={key} type="button" role="listitem" aria-pressed={on} className={`osrs-dash-pickrow${on ? ' is-on' : ''}`} onClick={() => setTargetKey(key)}>
                    <span className="osrs-slot" style={{ width: 40, height: 36, flexShrink: 0 }}><Crosshair on={on} /></span>
                    <span className="osrs-dash-pickrow-text">
                      <span className="osrs-dash-pickrow-name" style={{ color: on ? 'var(--osrs-yellow, #ff0)' : '#fff' }}>
                        {m.name}{m.version ? <span style={{ color: 'var(--osrs-muted, #8a7c66)' }}> · {m.version}</span> : ''}
                      </span>
                      <span className="osrs-dash-pickrow-sub">HP {m.hp} · Def {m.defLevel} · Mage {m.magicLevel}</span>
                    </span>
                    <span className="osrs-dash-muted-s" style={{ flexShrink: 0 }}>Lvl {m.level}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div ref={resultRef} className="osrs-inner osrs-dash-dpsresult">
            {result && monster ? (
              <>
                <div className="osrs-sh" style={{ display: 'flex', alignItems: 'baseline', gap: 8, color: '#fff' }}>
                  <WikiLink name={monster.name} />
                  <span style={{ fontFamily: 'RSSmall, sans-serif', color: 'var(--osrs-muted, #8a7c66)' }}>{monster.version ? `${monster.version} · ` : ''}HP {monster.hp} · Def {monster.defLevel} · Mage {monster.magicLevel}</span>
                </div>
                <div className="osrs-dash-dpstiles">
                  {([
                    ['Max hit', String(result.maxHit), 'var(--osrs-red, #ff3030)'],
                    ['Hit chance', `${Math.round(result.hitChance * 100)}%`, 'var(--osrs-yellow, #ff0)'],
                    ['DPS', result.dps.toFixed(2), '#00ff00'],
                    ['Time to kill', formatTimeToKill(result.ttk), '#fff'],
                  ] as const).map(([label, value, color]) => (
                    <div key={label} className="osrs-dash-dpstile">
                      <span className="osrs-dash-lbl" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12"><path d={TILE_ICON[label]} fill="none" stroke="#c8b897" strokeWidth="1.5" /></svg>{label}
                      </span>
                      <span className="osrs-sh" style={{ font: "32px 'RSBold', sans-serif", lineHeight: '28px', color }}>{value}</span>
                    </div>
                  ))}
                </div>
                <div className="osrs-dash-dpsminis">
                  {([
                    ['Eff. atk', result.effAtk],
                    [style === 'magic' ? 'Spell' : 'Eff. str', style === 'magic' ? result.maxHit : result.effStr],
                    ['Interval', `${result.attackInterval.toFixed(1)}s`],
                  ] as const).map(([label, value]) => (
                    <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span className="osrs-dash-lbl">{label}</span>
                      <span className="osrs-sh" style={{ fontFamily: 'RSBold, sans-serif', color: '#fff' }}>{value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="osrs-sh" style={{ margin: 0, color: 'var(--osrs-tan, #c8b897)' }}>Choose a target monster to see max hit, hit chance, DPS and time to kill.</p>
            )}
            <p className="osrs-dash-muted-s" style={{ margin: 'auto 0 0', display: 'flex', gap: 6, lineHeight: '16px' }}>
              <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" style={{ flexShrink: 0, marginTop: 2 }}><path d="M1 9l1.5-6 2.5 3L6 2l1 4 2.5-3L11 9z" fill="none" stroke="#8a7c66" strokeWidth="1.2" /></svg>
              <span>Baseline DPS for a standard setup. Special attacks and item passives (Twisted bow, Salve, Slayer helm, Void, crystal...) aren't modelled; Magic uses your spell's base max hit.</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default OsrsCharDps;
