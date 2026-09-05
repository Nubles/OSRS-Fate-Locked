import React, { useState, useEffect, useMemo } from 'react';
import {
  X, Swords, Loader2, AlertCircle, RefreshCw, Crosshair, Shield, Zap, Clock,
  Skull, Crown, Gauge, Heart, Info, ChevronRight, FlaskConical, Box, Boxes,
} from 'lucide-react';
import { useGame } from '../context/GameContext';
import { EQUIPMENT_SLOTS } from '../constants';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { SectionGuide } from './SectionGuide';
import { gearService } from '../services/GearService';
import { monsterService, MonsterStats } from '../services/MonsterService';
import { sumBonuses, GearItem, ZERO_BONUSES } from '../utils/gearStats';
import { planBoss, bossLoadoutIssue, BossPlan, BOSS_ALIASES, PlayerCombat, Readiness, Danger } from '../utils/bossPlanner';
import { EntityModel } from './EntityModel';
import { modelFor, orientationFor } from '../data/entityModels';
import { WikiLink } from './WikiLink';

interface Props { onClose: () => void }
type Status = 'loading' | 'ready' | 'error';

const monsterImg = (file: string) => `https://oldschool.runescape.wiki/images/${(file || '').replace(/ /g, '_')}`;

const READINESS: Record<Readiness, { label: string; cls: string; dot: string }> = {
  excellent: { label: 'Excellent', cls: 'text-emerald-300', dot: 'bg-emerald-400' },
  good: { label: 'Geared', cls: 'text-green-300', dot: 'bg-green-400' },
  workable: { label: 'Workable', cls: 'text-amber-300', dot: 'bg-amber-400' },
  slow: { label: 'Slow', cls: 'text-orange-300', dot: 'bg-orange-400' },
  undergeared: { label: 'Undergeared', cls: 'text-red-300', dot: 'bg-red-400' },
};
const DANGER: Record<Danger, { label: string; cls: string }> = {
  low: { label: 'Low', cls: 'text-gray-300' },
  medium: { label: 'Medium', cls: 'text-amber-300' },
  high: { label: 'High', cls: 'text-orange-300' },
  extreme: { label: 'Extreme', cls: 'text-red-400' },
};
const READY_ORDER: Readiness[] = ['excellent', 'good', 'workable', 'slow', 'undergeared'];

const fmtTtk = (s: number): string => {
  if (!isFinite(s) || s <= 0) return '—';
  if (s < 60) return `${s.toFixed(1)}s`;
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
};

export const BossKillPlanner: React.FC<Props> = ({ onClose }) => {
  const { unlocks, loadout: rawLoadout } = useGame();
  const loadout = rawLoadout || {};
  useEscapeKey(onClose, true);

  const [status, setStatus] = useState<Status>(gearService.ready && monsterService.ready ? 'ready' : 'loading');
  const [boostsOn, setBoostsOn] = useState(false);
  const [confirmedLoadout, setConfirmedLoadout] = useState<typeof rawLoadout | null>(null);
  // Confirmation belongs to this exact immutable snapshot, never a later loadout.
  const rangedSuppliesConfirmed = rawLoadout != null && confirmedLoadout === rawLoadout;
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setStatus('loading');
    Promise.all([gearService.init(), monsterService.init()]).then(() => alive && setStatus('ready')).catch(() => alive && setStatus('error'));
    return () => { alive = false; };
  }, []);
  const retry = () => { setStatus('loading'); Promise.all([gearService.init(true), monsterService.init(true)]).then(() => setStatus('ready')).catch(() => setStatus('error')); };

  // Equipped gear bonuses + weapon speed.
  const gear = useMemo(() => {
    const items = EQUIPMENT_SLOTS.map((s) => gearService.byId(loadout[s])).filter((x): x is GearItem => !!x);
    const b = items.length ? sumBonuses(items) : { ...ZERO_BONUSES };
    const weapon = gearService.byId(loadout['Weapon']);
    return { bonuses: b, speedTicks: weapon?.speed || 4, count: items.length, weaponName: weapon?.name, weaponCategory: EQUIPMENT_SLOTS.some(s => loadout[s] != null && !gearService.byId(loadout[s])) ? undefined : loadout['Weapon'] == null ? 'Unarmed' : weapon?.category };
  }, [loadout, status]);

  const player: PlayerCombat = useMemo(() => {
    const L = unlocks.levels || {};
    return {
      levels: { attack: L.Attack || 1, strength: L.Strength || 1, ranged: L.Ranged || 1, magic: L.Magic || 1, hitpoints: L.Hitpoints || 10 },
      gear: { bonuses: gear.bonuses, speedTicks: gear.speedTicks },
      boostsOn,
      weaponCategory: gear.weaponCategory,
      rangedSuppliesConfirmed,
    };
  }, [unlocks.levels, gear, boostsOn, rangedSuppliesConfirmed]);

  // Resolve unlocked bosses → monster + plan; split matched vs. encounters.
  const { ranked, encounters } = useMemo(() => {
    const matched: { boss: string; monster: MonsterStats; plan: BossPlan }[] = [];
    const enc: { boss: string; reason: string }[] = [];
    if (status === 'ready') {
      for (const boss of unlocks.bosses || []) {
        const m = monsterService.byName(BOSS_ALIASES[boss] ?? boss);
        const plan = m ? planBoss(player, m) : null;
        if (m && plan) matched.push({ boss, monster: m, plan });
        else enc.push({ boss, reason: m ? bossLoadoutIssue(player)! : 'No single-target encounter model' });
      }
    }
    matched.sort((a, b) => READY_ORDER.indexOf(a.plan.readiness) - READY_ORDER.indexOf(b.plan.readiness) || b.plan.dps - a.plan.dps);
    return { ranked: matched, encounters: enc };
  }, [unlocks.bosses, player, status]);

  const current = ranked.find((r) => r.boss === selected) ?? ranked[0];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={onClose} role="dialog" aria-modal="true" aria-label="Boss Kill Planner">
      <div className="bg-[#161616] border border-white/10 rounded-xl shadow-2xl w-full max-w-3xl h-[82vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {['Bow', 'Crossbow', 'Thrown'].includes(gear.weaponCategory ?? '') && (
          <label className="p-3 text-xs text-amber-200 flex items-center gap-2">
            <input type="checkbox" checked={rangedSuppliesConfirmed} onChange={e => setConfirmedLoadout(e.target.checked ? rawLoadout : null)} />
            I confirmed compatible ammunition or charges for this weapon and its legal use.
          </label>
        )}
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-white/10 bg-[#1b1b1b] shrink-0">
          <div className="p-2 bg-red-900/20 rounded-lg border border-red-500/30 text-red-300"><Skull size={18} /></div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-white leading-none flex items-center gap-1.5">Boss Kill Planner <SectionGuide id="KILL_PLANNER" /></h2>
            <p className="text-[11px] text-gray-500 mt-1">Your DPS, kill times and readiness against the bosses you've unlocked.</p>
          </div>
          <button onClick={() => window.dispatchEvent(new CustomEvent('fate:nav', { detail: { target: 'open:gallery' } }))} title="Review all 3D models" className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-white/10 bg-[#1f1f1f] text-gray-400 hover:text-white hover:border-white/20 text-[10px] font-bold uppercase tracking-wide transition-colors">
            <Boxes size={11} /> Gallery
          </button>
          <button onClick={() => setBoostsOn((b) => !b)} title="Toggle prayers + potions" className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-[10px] font-bold uppercase tracking-wide transition-colors ${boostsOn ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300' : 'border-white/10 bg-[#1f1f1f] text-gray-400'}`}>
            <FlaskConical size={11} /> Boosts {boostsOn ? 'on' : 'off'}
          </button>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white" aria-label="Close"><X size={18} /></button>
        </div>

        {status !== 'ready' ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 text-gray-500">
            {status === 'loading' ? <Loader2 size={22} className="animate-spin text-red-400" /> : <AlertCircle size={22} className="text-red-400" />}
            <p className="text-[12px]">{status === 'loading' ? 'Loading gear + monster data…' : (monsterService.error || 'Could not load data.')}</p>
            {status === 'error' && <button onClick={retry} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#252525] border border-white/10 text-gray-200 text-[11px] font-bold"><RefreshCw size={12} /> Retry</button>}
          </div>
        ) : (unlocks.bosses || []).length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 text-gray-500 px-8">
            <Skull size={26} className="text-gray-600" />
            <p className="text-[12px]">No bosses unlocked yet — unlock some via fate, then plan your kills here.</p>
          </div>
        ) : (
          <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2">
            {/* Boss list */}
            <div className="flex flex-col min-h-0 border-r border-white/10 overflow-y-auto custom-scrollbar p-2 space-y-1">
              {gear.count === 0 && (
                <div className="text-[10px] text-amber-300/80 bg-amber-950/20 border border-amber-500/20 rounded-lg px-2.5 py-2 mb-1 flex items-start gap-1.5">
                  <Info size={11} className="shrink-0 mt-0.5" /> No gear equipped — equip items in the Equipment Lab’s <span className="text-fuchsia-300">Gear</span> tab for real numbers.
                </div>
              )}
              {ranked.map(({ boss, monster, plan }) => {
                const r = READINESS[plan.readiness];
                const isActive = current?.boss === boss;
                return (
                  <button key={boss} onClick={() => setSelected(boss)} className={`w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 border text-left transition-colors ${isActive ? 'border-red-500/40 bg-red-950/30' : 'border-transparent hover:bg-white/5'}`}>
                    <img src={monsterImg(monster.imageFile)} alt="" className="w-7 h-7 object-contain shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-semibold text-gray-200 truncate">{boss}</div>
                      <div className={`text-[10px] flex items-center gap-1.5 ${r.cls}`}><span className={`w-1.5 h-1.5 rounded-full ${r.dot}`} /> {r.label} · {plan.dps.toFixed(1)} dps</div>
                    </div>
                    <ChevronRight size={13} className={isActive ? 'text-red-300' : 'text-gray-600'} />
                  </button>
                );
              })}
              {encounters.length > 0 && (
                <div className="pt-2 mt-1 border-t border-white/5">
                  <div className="text-[9px] uppercase tracking-widest text-gray-600 px-1 mb-1">No verified damage estimate</div>
                  {encounters.map(({ boss: b, reason }) => (
                    <div key={b} className="flex items-center gap-2 px-2.5 py-1.5 text-[11px] text-gray-500">
                      <Skull size={11} className="text-gray-700 shrink-0" /> <span>{b}: {reason}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Detail */}
            <div className="flex flex-col min-h-0 overflow-y-auto custom-scrollbar p-4">
              {current && <Detail boss={current.boss} monster={current.monster} plan={current.plan} weaponName={gear.weaponName} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const Detail: React.FC<{ boss: string; monster: MonsterStats; plan: BossPlan; weaponName?: string }> = ({ boss, monster, plan, weaponName }) => {
  const r = READINESS[plan.readiness];
  const d = DANGER[plan.danger];
  const model = modelFor(boss);
  const { animationsEnabled } = useGame();
  const [show3D, setShow3D] = useState(true);
  const toggleBtn = (cls: string) => (
    <button
      onClick={() => setShow3D((s) => !s)}
      title={show3D ? 'Show 2D sprite' : 'Show 3D model'}
      className={`flex items-center gap-1 px-2 py-1 rounded-md border border-white/10 bg-black/40 text-[10px] font-bold text-gray-300 hover:text-white hover:border-white/20 transition-colors ${cls}`}
    >
      <Box size={11} /> {show3D ? '3D' : '2D'}
    </button>
  );
  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Large 3D model viewer (drag to rotate, scroll to zoom) */}
      {model && show3D && (
        <div className="relative w-full h-60 rounded-xl bg-gradient-to-b from-white/[0.05] to-black/30 border border-white/10 overflow-hidden">
          <EntityModel src={model} poster={monsterImg(monster.imageFile)} alt={boss} interactive autoRotate={animationsEnabled} orientation={orientationFor(boss)} fill />
          {toggleBtn('absolute top-2 right-2 z-10')}
        </div>
      )}

      <div className="flex items-center gap-3">
        {(!model || !show3D) && (
          <img src={monsterImg(monster.imageFile)} alt="" className="w-12 h-12 object-contain shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }} />
        )}
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-white leading-tight truncate"><WikiLink name={boss} icon /></h3>
          <p className="text-[11px] text-gray-500">{monster.version ? `${monster.version} · ` : ''}Lvl {monster.level} · HP {monster.hp}</p>
        </div>
        {model && !show3D && toggleBtn('ml-auto shrink-0')}
      </div>

      {/* Readiness banner */}
      <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 bg-[#1a1a1a] border-white/10`}>
        <span className={`w-2 h-2 rounded-full ${r.dot}`} />
        <span className={`text-[12px] font-bold ${r.cls}`}>{r.label}</span>
        <span className="text-[10px] text-gray-500">· best as <span className="text-gray-300 uppercase">{plan.style === 'melee' ? plan.attackType : plan.style}</span>{weaponName ? ` · ${weaponName}` : ''}</span>
      </div>

      {/* Core stats */}
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Best DPS" value={plan.dps.toFixed(2)} accent="text-emerald-300" Icon={Swords} />
        <Stat label="Max hit" value={plan.maxHit} accent="text-red-300" Icon={Zap} />
        <Stat label="Hit chance" value={`${Math.round(plan.hitChance * 100)}%`} accent="text-amber-300" Icon={Crosshair} />
        <Stat label="Time to kill" value={fmtTtk(plan.ttk)} accent="text-sky-300" Icon={Clock} />
      </div>

      {/* Gear gap */}
      <div className="rounded-xl bg-[#1a1a1a] border border-white/10 p-3">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-gray-500 mb-1.5">
          <span className="flex items-center gap-1.5"><Gauge size={11} className="text-fuchsia-400" /> Gear vs strong setup</span>
          <span className="text-gray-300 font-bold">{plan.gearGapPct}%</span>
        </div>
        <div className="h-2 rounded-full bg-black/50 border border-white/5 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-red-500 via-amber-400 to-emerald-400 rounded-full transition-all duration-500" style={{ width: `${plan.gearGapPct}%` }} />
        </div>
        <p className="text-[9px] text-gray-600 mt-1">Your DPS as a share of a strong endgame setup for this style.</p>
      </div>

      {/* Rates + threat */}
      <div className="grid grid-cols-3 gap-2">
        <Mini label="Kills / hr" value={plan.killsPerHour || '—'} Icon={Crown} />
        <Mini label="Danger" value={d.label} cls={d.cls} Icon={Skull} />
        <Mini label="Kills / trip" value={`~${plan.killsBeforeBank}`} Icon={Heart} />
      </div>
      <div className="text-[10px] text-gray-500 flex items-start gap-1.5">
        <Shield size={11} className="shrink-0 mt-0.5" /> Boss max hit <span className="text-gray-300 font-semibold">{monster.maxHit}</span>{monster.attributes.length ? ` · ${monster.attributes.join(', ')}` : ''}
      </div>

      <p className="text-[9px] text-gray-600 leading-relaxed flex items-start gap-1.5">
        <Info size={11} className="shrink-0 mt-0.5" />
        DPS auto-picks your best melee/ranged option (Magic → use the DPS tab for spell-specific numbers). Kills/trip & danger are rough threat estimates assuming no protection prayers; special attacks and item passives aren't modelled.
      </p>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: React.ReactNode; accent: string; Icon: typeof Zap }> = ({ label, value, accent, Icon }) => (
  <div className="rounded-lg bg-[#151515] border border-white/5 px-3 py-2">
    <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-gray-500 mb-0.5"><Icon size={10} /> {label}</div>
    <div className={`text-xl font-black leading-none ${accent}`}>{value}</div>
  </div>
);
const Mini: React.FC<{ label: string; value: React.ReactNode; cls?: string; Icon: typeof Zap }> = ({ label, value, cls = 'text-gray-200', Icon }) => (
  <div className="rounded-lg bg-[#151515] border border-white/5 px-2.5 py-2 text-center">
    <div className="flex items-center justify-center gap-1 text-[8px] uppercase tracking-widest text-gray-600 mb-0.5"><Icon size={9} /> {label}</div>
    <div className={`text-[13px] font-bold ${cls}`}>{value}</div>
  </div>
);
