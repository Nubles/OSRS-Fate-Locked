import React, { useState, useMemo } from 'react';
import { X, Search, Sparkles, TrendingUp, Key, Clock, Dices, Gauge, ChevronRight } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { TableType } from '../types';
import { getPoolAndStateKey, isValidUnlock } from '../utils/gameEngine';
import { keyVelocity, forecastTarget } from '../utils/fateForecast';

interface Props {
  onClose: () => void;
}

// The random key tables Fate draws from (excludes Omni-tier skills/equipment and
// player-completed quests/diaries/CAs — those aren't decided by a key roll).
const FORECAST_TABLES: TableType[] = [
  TableType.REGIONS, TableType.BOSSES, TableType.MINIGAMES, TableType.MOBILITY,
  TableType.ARCANA, TableType.POH, TableType.MERCHANTS, TableType.STORAGE,
  TableType.GUILDS, TableType.FARMING_LAYERS,
];

const fmtDays = (d: number): string => {
  if (d <= 0) return 'now';
  if (d < 1) return '<1 day';
  if (d < 14) return `${Math.round(d)} day${Math.round(d) === 1 ? '' : 's'}`;
  if (d < 60) return `${Math.round(d / 7)} weeks`;
  return `${Math.round(d / 30)} months`;
};

export const FateForecastModal: React.FC<Props> = ({ onClose }) => {
  const { unlocks, keys, history } = useGame();
  useEscapeKey(onClose, true);

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<{ table: TableType; item: string } | null>(null);

  const velocity = useMemo(() => keyVelocity(history), [history]);

  // Locked items per forecast table (Fate's remaining pool).
  const groups = useMemo(() => {
    return FORECAST_TABLES.map((table) => {
      const { pool } = getPoolAndStateKey(table);
      const locked = pool.filter((item) => isValidUnlock(table, item, unlocks));
      return { table, locked };
    }).filter((g) => g.locked.length > 0);
  }, [unlocks]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({ table: g.table, locked: g.locked.filter((i) => i.toLowerCase().includes(q)) }))
      .filter((g) => g.locked.length > 0);
  }, [groups, query]);

  const remaining = selected
    ? (groups.find((g) => g.table === selected.table)?.locked.length ?? 1)
    : 0;
  const forecast = useMemo(
    () => (selected ? forecastTarget(remaining, keys, velocity) : null),
    [selected, remaining, keys, velocity],
  );

  // "Complete the whole category": clearing a table takes exactly R spends
  // (each draw reveals a new locked item, no replacement).
  const completeAll = useMemo(() => {
    if (!selected) return null;
    const keysToEarn = Math.max(0, remaining - Math.max(0, keys));
    const days = velocity.ok && velocity.keysPerDay > 0 ? keysToEarn / velocity.keysPerDay : null;
    return { totalKeys: remaining, keysToEarn, days };
  }, [selected, remaining, keys, velocity]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Fate Forecast"
    >
      <div
        className="bg-[#161616] border border-white/10 rounded-xl shadow-2xl w-full max-w-3xl h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-white/10 bg-[#1b1b1b] shrink-0">
          <div className="p-2 bg-fuchsia-900/20 rounded-lg border border-fuchsia-500/30 text-fuchsia-300">
            <Sparkles size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-white leading-none">Fate Forecast</h2>
            <p className="text-[11px] text-gray-500 mt-1">Where will Fate take you? Pick a locked unlock to see how long it'll likely take.</p>
          </div>
          {/* Pace */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1a1a1a] border border-white/10" title="Keys earned per day, from your history">
            <Gauge size={13} className="text-emerald-400" />
            <span className="text-[11px] text-gray-300">
              {velocity.ok ? <>~{velocity.keysPerDay.toFixed(1)} <span className="text-gray-500">keys/day</span></> : <span className="text-gray-500">pace: n/a</span>}
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors" aria-label="Close"><X size={18} /></button>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2">
          {/* Target picker */}
          <div className="flex flex-col min-h-0 border-r border-white/10">
            <div className="p-2 border-b border-white/5 shrink-0">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-600" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search regions, bosses, minigames…"
                  className="w-full pl-8 pr-3 py-2 rounded-lg bg-black/40 border border-white/10 text-[12px] text-gray-200 focus:outline-none focus:border-fuchsia-500/40 placeholder:text-gray-700"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-3">
              {filtered.length === 0 && (
                <p className="text-center text-[11px] text-gray-600 py-10">Nothing locked here — Fate has been kind.</p>
              )}
              {filtered.map((g) => (
                <div key={g.table}>
                  <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-gray-500 px-1 mb-1">
                    {g.table} <span className="text-gray-700">· {g.locked.length} locked</span>
                  </div>
                  <div className="space-y-0.5">
                    {g.locked.map((item) => {
                      const active = selected?.table === g.table && selected?.item === item;
                      return (
                        <button
                          key={item}
                          onClick={() => setSelected({ table: g.table, item })}
                          className={`w-full flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12px] transition-colors ${
                            active ? 'bg-fuchsia-950/40 border border-fuchsia-500/40 text-fuchsia-200' : 'border border-transparent text-gray-300 hover:bg-white/5'
                          }`}
                        >
                          <span className="truncate">{item}</span>
                          <ChevronRight size={12} className={active ? 'text-fuchsia-300' : 'text-gray-600'} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Forecast */}
          <div className="flex flex-col min-h-0 overflow-y-auto custom-scrollbar p-4">
            {!selected || !forecast ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-gray-600 gap-3 px-6">
                <Sparkles size={28} className="text-fuchsia-500/40" />
                <p className="text-[12px]">Pick a locked unlock on the left and Fate will tell you how long the wait is likely to be.</p>
              </div>
            ) : (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-gray-500">{selected.table}</div>
                  <h3 className="text-lg font-bold text-white leading-tight">{selected.item}</h3>
                  <p className="text-[11px] text-gray-500 mt-1 flex items-center gap-1.5">
                    <Dices size={12} className="text-fuchsia-400" />
                    Fate is choosing from <span className="text-gray-300 font-semibold">{forecast.keys.remaining}</span> locked {selected.table.toLowerCase()}.
                  </p>
                </div>

                {/* Equal-likelihood note — explains why every item in a table reads the same. */}
                <div className="flex items-start gap-2 rounded-lg border border-fuchsia-500/20 bg-fuchsia-950/20 px-3 py-2 text-fuchsia-200/80">
                  <Dices size={13} className="shrink-0 mt-0.5 text-fuchsia-400" />
                  <p className="text-[10px] leading-relaxed">
                    Fate draws at random, so <span className="font-semibold text-fuchsia-200">every locked {selected.table.toLowerCase().replace(/s$/, '')}</span> is equally likely — the estimate below is the same whichever one you pick. Each key has a <span className="font-semibold text-fuchsia-200">1 in {forecast.keys.remaining}</span> chance of being this one.
                  </p>
                </div>

                {/* Keys for one specific item */}
                <div className="rounded-xl bg-[#1a1a1a] border border-white/10 p-4">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-gray-500 mb-2">
                    <Key size={12} className="text-amber-400" /> Keys for this {selected.table.toLowerCase().replace(/s$/, '')}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-amber-300 leading-none">{forecast.keys.p50}</span>
                    <span className="text-[11px] text-gray-500">most likely</span>
                  </div>
                  <div className="text-[11px] text-gray-500 mt-1">
                    80% chance within <span className="text-gray-300 font-semibold">{forecast.keys.p10}–{forecast.keys.p90}</span> keys spent here
                  </div>
                  {/* distribution band */}
                  <div className="relative h-2 mt-3 rounded-full bg-black/50 border border-white/5 overflow-hidden">
                    <div
                      className="absolute h-full bg-fuchsia-500/30"
                      style={{ left: `${(forecast.keys.p10 / forecast.keys.remaining) * 100}%`, width: `${((forecast.keys.p90 - forecast.keys.p10) / forecast.keys.remaining) * 100}%` }}
                    />
                    <div className="absolute top-0 h-full w-0.5 bg-fuchsia-300" style={{ left: `${(forecast.keys.p50 / forecast.keys.remaining) * 100}%` }} />
                  </div>
                  <div className="flex justify-between text-[8px] text-gray-600 font-mono mt-0.5"><span>1</span><span>{forecast.keys.remaining}</span></div>
                </div>

                {/* Time */}
                <div className="rounded-xl bg-[#1a1a1a] border border-white/10 p-4">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-gray-500 mb-2">
                    <Clock size={12} className="text-emerald-400" /> Time at your pace
                  </div>
                  {forecast.days ? (
                    <>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black text-emerald-300 leading-none">{fmtDays(forecast.days.p50)}</span>
                        <span className="text-[11px] text-gray-500">most likely</span>
                      </div>
                      <div className="text-[11px] text-gray-500 mt-1">
                        range <span className="text-gray-300 font-semibold">{fmtDays(forecast.days.p10)} – {fmtDays(forecast.days.p90)}</span>
                        {' '}· ~{velocity.keysPerDay.toFixed(1)} keys/day
                      </div>
                      <div className="text-[10px] text-gray-600 mt-2">
                        You hold <span className="text-amber-300 font-semibold">{keys}</span> key{keys === 1 ? '' : 's'} now ·
                        need to earn ~<span className="text-gray-300">{forecast.keysToEarn.p50}</span> more (most likely).
                      </div>
                    </>
                  ) : (
                    <p className="text-[11px] text-gray-500">
                      Not enough history to estimate a pace yet — keep rolling and a time estimate will appear here.
                      You hold <span className="text-amber-300 font-semibold">{keys}</span> keys now.
                    </p>
                  )}
                </div>

                {/* Complete the whole category — varies by table size, gives a "big goal" number. */}
                {completeAll && completeAll.totalKeys > 1 && (
                  <div className="rounded-xl bg-[#1a1a1a] border border-white/10 p-4">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-gray-500 mb-2">
                      <Sparkles size={12} className="text-fuchsia-400" /> Complete all {completeAll.totalKeys} {selected.table.toLowerCase()}
                    </div>
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-xl font-black text-fuchsia-300 leading-none">{completeAll.totalKeys} keys</span>
                      {completeAll.days != null && (
                        <span className="text-[11px] text-gray-500">· ≈ {fmtDays(completeAll.days)} at your pace</span>
                      )}
                    </div>
                    <div className="text-[10px] text-gray-600 mt-1">Spend every key here to clear the category (no luck involved — it just takes {completeAll.totalKeys}).</div>
                  </div>
                )}

                <p className="text-[9px] text-gray-600 leading-relaxed flex items-start gap-1.5">
                  <TrendingUp size={11} className="shrink-0 mt-0.5" />
                  Assumes you spend keys on {selected.table.toLowerCase()} and that Fate draws uniformly at random.
                  Each draw also reveals other {selected.table.toLowerCase()}, so the pool shrinks as you go.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
