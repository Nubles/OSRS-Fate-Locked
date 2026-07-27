import React, { useState, useEffect, useMemo } from 'react';
import {
  Swords, Crosshair, Wand2, X, Search, Loader2, AlertCircle, RefreshCw, Target, Info, Zap, Clock, Crown,
} from 'lucide-react';
import { useGame } from '../context/GameContext';
import { EQUIPMENT_SLOTS } from '../constants';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { gearService } from '../services/GearService';
import { monsterService, MonsterStats } from '../services/MonsterService';
import { sumBonuses, GearItem, ZERO_BONUSES } from '../utils/gearStats';
import {
  computeDps, STANCES, PRAYERS, POTIONS, Style, AttackType, DpsInput,
} from '../utils/dps';
import { WikiLink } from './WikiLink';

type Status = 'loading' | 'ready' | 'error';

const STYLE_META: { id: Style; label: string; Icon: typeof Swords }[] = [
  { id: 'melee', label: 'Melee', Icon: Swords },
  { id: 'ranged', label: 'Ranged', Icon: Crosshair },
  { id: 'magic', label: 'Magic', Icon: Wand2 },
];
const MELEE_TYPES: AttackType[] = ['stab', 'slash', 'crush'];
const monsterImg = (file: string) => `https://oldschool.runescape.wiki/images/${(file || '').replace(/ /g, '_')}`;

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="flex flex-col gap-1">
    <span className="text-[9px] uppercase tracking-widest text-gray-500">{label}</span>
    {children}
  </label>
);
const selectCls = 'bg-black/40 border border-white/10 rounded px-2 py-1.5 text-[11px] text-gray-200 focus:outline-none focus:border-red-500/40';

interface DpsCalcProps { suspendModals?: boolean }

export const DpsCalc: React.FC<DpsCalcProps> = ({ suspendModals = false }) => {
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

  // ── Config state ──────────────────────────────────────────────────────────
  const [style, setStyle] = useState<Style>('melee');
  const [meleeType, setMeleeType] = useState<AttackType>('slash');
  const [stanceId, setStanceId] = useState('aggressive');
  const [prayerId, setPrayerId] = useState('none');
  const [potionId, setPotionId] = useState('none');
  const [baseSpellMax, setBaseSpellMax] = useState(24);
  const [levels, setLevels] = useState({ attack: 99, strength: 99, ranged: 99, magic: 99 });
  const [monsterId, setMonsterId] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Prefill levels from the run once.
  useEffect(() => {
    const L = unlocks.levels || {};
    setLevels({
      attack: L.Attack || 1, strength: L.Strength || 1, ranged: L.Ranged || 1, magic: L.Magic || 1,
    });
  }, [unlocks.levels]);

  // Reset stance/prayer/potion to valid options when style changes.
  useEffect(() => {
    setStanceId(STANCES[style][0].id === 'accurate' && style === 'melee' ? 'aggressive' : STANCES[style][0].id);
    setPrayerId('none'); setPotionId('none');
  }, [style]);

  const attackType: AttackType = style === 'melee' ? meleeType : style === 'ranged' ? 'ranged' : 'magic';

  // Equipped gear → summed bonuses + weapon speed.
  const gear = useMemo(() => {
    const items = EQUIPMENT_SLOTS.map((s) => gearService.byId(loadout[s])).filter((x): x is GearItem => !!x);
    const b = items.length ? sumBonuses(items) : { ...ZERO_BONUSES };
    const weapon = gearService.byId(loadout['Weapon']);
    const accuracy = attackType === 'stab' ? b.stab : attackType === 'slash' ? b.slash : attackType === 'crush' ? b.crush : attackType === 'ranged' ? b.ranged : b.magic;
    return { bonuses: b, accuracy, meleeStr: b.meleeStr, rangedStr: b.rangedStr, magicDmgPct: b.magicStr, speedTicks: weapon?.speed || 4, weaponName: weapon?.name, count: items.length };
  }, [loadout, attackType, status]);

  const monster = monsterService.byId(monsterId ?? undefined);

  const result = useMemo(() => {
    if (!monster) return null;
    const defLevel = style === 'magic' ? monster.magicLevel : monster.defLevel;
    const defBonus = attackType === 'stab' ? monster.def.stab : attackType === 'slash' ? monster.def.slash : attackType === 'crush' ? monster.def.crush : attackType === 'ranged' ? monster.def.ranged : monster.def.magic;
    const input: DpsInput = {
      style, attackType, stanceId, prayerId, potionId, baseSpellMax,
      levels, gear: { accuracy: gear.accuracy, meleeStr: gear.meleeStr, rangedStr: gear.rangedStr, magicDmgPct: gear.magicDmgPct, speedTicks: gear.speedTicks },
      monster: { defLevel, defBonus, hp: monster.hp },
    };
    return computeDps(input);
  }, [monster, style, attackType, stanceId, prayerId, potionId, baseSpellMax, levels, gear]);

  if (status !== 'ready') {
    return (
      <div className="flex flex-col items-center justify-center text-center gap-3 py-16 text-gray-500">
        {status === 'loading' ? <Loader2 size={22} className="animate-spin text-red-400" /> : <AlertCircle size={22} className="text-red-400" />}
        <p className="text-[12px]">{status === 'loading' ? 'Loading gear + monster data…' : (monsterService.error || gearService.error || 'Could not load data.')}</p>
        {status === 'error' && <button onClick={retry} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#252525] border border-white/10 hover:bg-[#2d2d2d] text-gray-200 text-[11px] font-bold"><RefreshCw size={12} /> Retry</button>}
      </div>
    );
  }

  const styleLevels: { key: keyof typeof levels; label: string }[] =
    style === 'melee' ? [{ key: 'attack', label: 'Attack' }, { key: 'strength', label: 'Strength' }]
      : style === 'ranged' ? [{ key: 'ranged', label: 'Ranged' }]
        : [{ key: 'magic', label: 'Magic' }];

  return (
    <div className="space-y-4">
      {/* Style selector */}
      <div className="flex items-center rounded-lg border border-white/10 bg-[#1f1f1f] p-0.5">
        {STYLE_META.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setStyle(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] font-bold transition-colors ${style === id ? 'bg-red-950/50 text-red-300' : 'text-gray-500 hover:text-gray-300'}`}>
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {/* Config */}
      <div className="grid grid-cols-2 gap-2.5">
        {style === 'melee' && (
          <Field label="Attack type">
            <select value={meleeType} onChange={(e) => setMeleeType(e.target.value as AttackType)} className={selectCls}>
              {MELEE_TYPES.map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}
            </select>
          </Field>
        )}
        <Field label="Stance">
          <select value={stanceId} onChange={(e) => setStanceId(e.target.value)} className={selectCls}>
            {STANCES[style].map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </Field>
        <Field label="Prayer">
          <select value={prayerId} onChange={(e) => setPrayerId(e.target.value)} className={selectCls}>
            {PRAYERS[style].map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </Field>
        <Field label="Potion">
          <select value={potionId} onChange={(e) => setPotionId(e.target.value)} className={selectCls}>
            {POTIONS[style].map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </Field>
        {style === 'magic' && (
          <Field label="Spell base max">
            <input type="number" value={baseSpellMax} min={0} onChange={(e) => setBaseSpellMax(Math.max(0, +e.target.value || 0))} className={selectCls} />
          </Field>
        )}
        {styleLevels.map(({ key, label }) => (
          <Field key={key} label={`${label} lvl`}>
            <input type="number" value={levels[key]} min={1} max={99} onChange={(e) => setLevels((l) => ({ ...l, [key]: Math.min(99, Math.max(1, +e.target.value || 1)) }))} className={selectCls} />
          </Field>
        ))}
      </div>

      {/* Gear summary */}
      <div className="text-[10px] text-gray-500 flex items-center gap-1.5">
        <Info size={11} />
        {gear.count > 0 ? <>Using your equipped gear{gear.weaponName ? ` · ${gear.weaponName}` : ''} ({gear.speedTicks}t)</> : <>No gear equipped — equip items in the <span className="text-fuchsia-300">Gear</span> tab.</>}
      </div>

      {/* Monster target */}
      <button onClick={() => setPickerOpen(true)} className="w-full flex items-center gap-3 rounded-xl border border-white/10 bg-[#1a1a1a] px-3 py-2.5 hover:bg-white/5 transition-colors text-left">
        <div className="w-9 h-9 rounded bg-black/30 flex items-center justify-center shrink-0">
          {monster ? <img src={monsterImg(monster.imageFile)} alt="" className="w-7 h-7 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }} /> : <Target size={16} className="text-gray-600" />}
        </div>
        <div className="flex-1 min-w-0">
          {monster ? (
            <>
              <div className="text-[12px] font-semibold text-gray-200 truncate"><WikiLink name={monster.name} />{monster.version ? <span className="text-gray-500"> · {monster.version}</span> : ''}</div>
              <div className="text-[10px] text-gray-500 font-mono">HP {monster.hp} · Def {monster.defLevel} · Mage {monster.magicLevel}</div>
            </>
          ) : <div className="text-[12px] text-gray-400">Choose a target monster…</div>}
        </div>
        <Search size={14} className="text-gray-600 shrink-0" />
      </button>

      {/* Results */}
      {result && monster && (
        <div className="rounded-xl bg-[#1a1a1a] border border-red-500/20 p-4 space-y-3 animate-in fade-in duration-200">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Max hit" value={result.maxHit} accent="text-red-300" Icon={Zap} />
            <Stat label="Hit chance" value={`${Math.round(result.hitChance * 100)}%`} accent="text-amber-300" Icon={Target} />
            <Stat label="DPS" value={result.dps.toFixed(2)} accent="text-emerald-300" Icon={Swords} />
            <Stat label="Time to kill" value={fmtTtk(result.ttk)} accent="text-sky-300" Icon={Clock} />
          </div>
          <div className="grid grid-cols-3 gap-2 text-center pt-1 border-t border-white/5">
            <Mini label="Eff. atk" value={result.effAtk} />
            <Mini label={style === 'magic' ? 'Spell' : 'Eff. str'} value={style === 'magic' ? result.maxHit : result.effStr} />
            <Mini label="Interval" value={`${result.attackInterval.toFixed(1)}s`} />
          </div>
          <p className="text-[9px] text-gray-600 leading-relaxed flex items-start gap-1.5">
            <Crown size={11} className="shrink-0 mt-0.5" />
            Baseline DPS for a standard setup. Special attacks and item passives (Twisted bow, Salve, Slayer helm, Void, crystal…) aren't modelled; Magic uses your spell's base max hit.
          </p>
        </div>
      )}

      {!suspendModals && pickerOpen && (
        <MonsterPicker
          currentId={monsterId}
          onClose={() => setPickerOpen(false)}
          onPick={(id) => { setMonsterId(id); setPickerOpen(false); }}
        />
      )}
    </div>
  );
};

const Stat: React.FC<{ label: string; value: React.ReactNode; accent: string; Icon: typeof Zap }> = ({ label, value, accent, Icon }) => (
  <div className="rounded-lg bg-[#151515] border border-white/5 px-3 py-2">
    <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-gray-500 mb-0.5"><Icon size={10} /> {label}</div>
    <div className={`text-xl font-black leading-none ${accent}`}>{value}</div>
  </div>
);
const Mini: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div><div className="text-[8px] uppercase tracking-widest text-gray-600">{label}</div><div className="text-[12px] font-bold text-gray-300 font-mono">{value}</div></div>
);

const fmtTtk = (s: number): string => {
  if (!isFinite(s) || s <= 0) return '—';
  if (s < 60) return `${s.toFixed(1)}s`;
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
};

// ── Monster picker popover ────────────────────────────────────────────────────
const MonsterPicker: React.FC<{ currentId: number | null; onClose: () => void; onPick: (id: number) => void }> = ({ currentId, onClose, onPick }) => {
  useEscapeKey(onClose, true);
  const [query, setQuery] = useState('');
  const results = useMemo(() => monsterService.search(query, 80), [query]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150" onClick={onClose} role="dialog" aria-modal="true" aria-label="Choose monster">
      <div className="bg-[#161616] border border-white/10 rounded-xl shadow-2xl w-full max-w-md h-[70vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 p-3 border-b border-white/10 bg-[#1b1b1b] shrink-0">
          <Target size={16} className="text-red-400" />
          <h3 className="flex-1 text-sm font-bold text-white">Choose target</h3>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white" aria-label="Close"><X size={16} /></button>
        </div>
        <div className="p-2 border-b border-white/5 shrink-0">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-600" />
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search monsters…" className="w-full pl-8 pr-3 py-2 rounded-lg bg-black/40 border border-white/10 text-[12px] text-gray-200 focus:outline-none focus:border-red-500/40 placeholder:text-gray-700" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-1.5 space-y-1">
          {results.length === 0 && <div className="text-center text-[11px] text-gray-600 py-10">No monsters match.</div>}
          {results.map((m) => (
            <button key={`${m.id}-${m.version}`} onClick={() => onPick(m.id)}
              className={`w-full flex items-center gap-2.5 rounded-lg px-2 py-1.5 border text-left transition-colors ${m.id === currentId ? 'border-red-500/40 bg-red-950/30' : 'border-transparent hover:bg-white/5'}`}>
              <img src={monsterImg(m.imageFile)} alt="" className="w-7 h-7 object-contain shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }} />
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-semibold text-gray-200 truncate">{m.name}{m.version ? <span className="text-gray-500"> · {m.version}</span> : ''}</div>
                <div className="text-[9px] text-gray-500 font-mono truncate">Lvl {m.level} · HP {m.hp} · Def {m.defLevel}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
