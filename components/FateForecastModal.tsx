import React, { useState, useMemo } from 'react';
import { X, Sparkles, Key, Clock, Dices, Gauge, TrendingUp, ChevronRight } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { TableType } from '../types';
import { getPoolAndStateKey, isValidUnlock } from '../utils/gameEngine';
import { keyVelocity, forecastTarget, keysToTarget } from '../utils/fateForecast';

interface Props {
  onClose: () => void;
}

// The random key tables Fate draws from (excludes Omni-tier skills/equipment and
// player-completed quests/diaries/CAs — those aren't decided by a key roll).
// `singular` is used for "a specific <thing>" copy.
const FORECAST_TABLES: { table: TableType; singular: string }[] = [
  { table: TableType.REGIONS, singular: 'region' },
  { table: TableType.BOSSES, singular: 'boss' },
  { table: TableType.MINIGAMES, singular: 'minigame' },
  { table: TableType.MERCHANTS, singular: 'merchant' },
  { table: TableType.POH, singular: 'housing unlock' },
  { table: TableType.STORAGE, singular: 'storage unlock' },
  { table: TableType.MOBILITY, singular: 'mobility unlock' },
  { table: TableType.FARMING_LAYERS, singular: 'farming patch' },
  { table: TableType.GUILDS, singular: 'guild' },
  { table: TableType.ARCANA, singular: 'arcana unlock' },
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

  const velocity = useMemo(() => keyVelocity(history), [history]);

  // One entry per category that still has locked items, with its remaining count.
  const categories = useMemo(() => {
    return FORECAST_TABLES.map(({ table, singular }) => {
      const { pool } = getPoolAndStateKey(table);
      const remaining = pool.filter((item) => isValidUnlock(table, item, unlocks)).length;
      return { table, singular, remaining, headline: keysToTarget(remaining).p50 };
    }).filter((c) => c.remaining > 0);
  }, [unlocks]);

  const [selected, setSelected] = useState<TableType | null>(null);
  const active = useMemo(
    () => categories.find((c) => c.table === selected) ?? categories[0] ?? null,
    [categories, selected],
  );

  const forecast = useMemo(
    () => (active ? forecastTarget(active.remaining, keys, velocity) : null),
    [active, keys, velocity],
  );
  const completeAll = useMemo(() => {
    if (!active) return null;
    const keysToEarn = Math.max(0, active.remaining - Math.max(0, keys));
    const days = velocity.ok && velocity.keysPerDay > 0 ? keysToEarn / velocity.keysPerDay : null;
    return { totalKeys: active.remaining, days };
  }, [active, keys, velocity]);

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
            <p className="text-[11px] text-gray-500 mt-1">How long until Fate hands you something from each category.</p>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1a1a1a] border border-white/10" title="Keys earned per day, from your history">
            <Gauge size={13} className="text-emerald-400" />
            <span className="text-[11px] text-gray-300">
              {velocity.ok ? <>~{velocity.keysPerDay.toFixed(1)} <span className="text-gray-500">keys/day</span></> : <span className="text-gray-500">pace: n/a</span>}
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors" aria-label="Close"><X size={18} /></button>
        </div>

        {categories.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-500 gap-3 px-6">
            <Sparkles size={28} className="text-fuchsia-500/40" />
            <p className="text-[13px]">Every category is fully unlocked — Fate has nothing left to give. 🎉</p>
          </div>
        ) : (
          <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2">
            {/* Category board */}
            <div className="flex flex-col min-h-0 border-r border-white/10">
              <div className="px-3 py-2 text-[9px] uppercase tracking-widest text-gray-500 border-b border-white/5 shrink-0">
                Category · keys for one
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                {categories.map((c) => {
                  const isActive = active?.table === c.table;
                  return (
                    <button
                      key={c.table}
                      onClick={() => setSelected(c.table)}
                      className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                        isActive ? 'bg-fuchsia-950/40 border border-fuchsia-500/40' : 'border border-transparent hover:bg-white/5'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className={`text-[13px] font-semibold truncate ${isActive ? 'text-fuchsia-200' : 'text-gray-200'}`}>{c.table}</div>
                        <div className="text-[10px] text-gray-500">{c.remaining} locked</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[13px] font-bold text-amber-300 leading-none">~{c.headline}</div>
                        <div className="text-[9px] text-gray-600">keys</div>
                      </div>
                      <ChevronRight size={13} className={isActive ? 'text-fuchsia-300' : 'text-gray-600'} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Detail */}
            <div className="flex flex-col min-h-0 overflow-y-auto custom-scrollbar p-4">
              {active && forecast && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div>
                    <h3 className="text-lg font-bold text-white leading-tight">{active.table}</h3>
                    <p className="text-[11px] text-gray-500 mt-1 flex items-center gap-1.5">
                      <Dices size={12} className="text-fuchsia-400" />
                      <span className="text-gray-300 font-semibold">{active.remaining}</span> locked · each draw is a <span className="text-gray-300 font-semibold">1 in {active.remaining}</span> shot at any specific one.
                    </p>
                  </div>

                  {/* A specific one */}
                  <div className="rounded-xl bg-[#1a1a1a] border border-white/10 p-4">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-gray-500 mb-2">
                      <Key size={12} className="text-amber-400" /> Keys for a specific {active.singular}
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-black text-amber-300 leading-none">{forecast.keys.p50}</span>
                      <span className="text-[11px] text-gray-500">most likely</span>
                    </div>
                    <div className="text-[11px] text-gray-500 mt-1">
                      80% chance within <span className="text-gray-300 font-semibold">{forecast.keys.p10}–{forecast.keys.p90}</span> keys
                      {forecast.days && <> · ≈ <span className="text-emerald-300 font-semibold">{fmtDays(forecast.days.p50)}</span> at your pace</>}
                    </div>
                    <div className="relative h-2 mt-3 rounded-full bg-black/50 border border-white/5 overflow-hidden">
                      <div
                        className="absolute h-full bg-fuchsia-500/30"
                        style={{ left: `${(forecast.keys.p10 / forecast.keys.remaining) * 100}%`, width: `${((forecast.keys.p90 - forecast.keys.p10) / forecast.keys.remaining) * 100}%` }}
                      />
                      <div className="absolute top-0 h-full w-0.5 bg-fuchsia-300" style={{ left: `${(forecast.keys.p50 / forecast.keys.remaining) * 100}%` }} />
                    </div>
                    <p className="text-[9px] text-gray-600 mt-2">Every locked {active.singular} is equally likely, so the wait is the same whichever one you're after.</p>
                  </div>

                  {/* Complete the whole category */}
                  {completeAll && (
                    <div className="rounded-xl bg-[#1a1a1a] border border-white/10 p-4">
                      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-gray-500 mb-2">
                        <Sparkles size={12} className="text-fuchsia-400" /> Complete all {completeAll.totalKeys}
                      </div>
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-xl font-black text-fuchsia-300 leading-none">{completeAll.totalKeys} keys</span>
                        {completeAll.days != null && <span className="text-[11px] text-gray-500">· ≈ {fmtDays(completeAll.days)} at your pace</span>}
                      </div>
                      <p className="text-[10px] text-gray-600 mt-1">Clearing the category just takes {completeAll.totalKeys} spends here — no luck involved.</p>
                    </div>
                  )}

                  {/* Keys in hand / pace footnote */}
                  <div className="flex items-center justify-between text-[10px] text-gray-600 px-1">
                    <span className="flex items-center gap-1.5"><Key size={11} className="text-amber-400/70" /> You hold <span className="text-amber-300 font-semibold">{keys}</span> key{keys === 1 ? '' : 's'}</span>
                    {velocity.ok
                      ? <span className="flex items-center gap-1.5"><Clock size={11} className="text-emerald-400/70" /> ~{velocity.keysPerDay.toFixed(1)} keys/day</span>
                      : <span className="text-gray-700">play more for time estimates</span>}
                  </div>

                  <p className="text-[9px] text-gray-600 leading-relaxed flex items-start gap-1.5">
                    <TrendingUp size={11} className="shrink-0 mt-0.5" />
                    Assumes you spend keys on {active.table.toLowerCase()} and that Fate draws uniformly at random; the pool shrinks as you unlock.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
