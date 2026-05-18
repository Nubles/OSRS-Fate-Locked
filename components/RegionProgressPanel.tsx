import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, ListChecks, X } from 'lucide-react';
import { REGION_GROUPS, MISTHALIN_AREAS } from '../constants';

const ALWAYS_UNLOCKED = new Set<string>(['Misthalin']);

interface ContinentProgress {
  name: string;
  subs: string[];
  unlockedSubs: string[];
  pct: number;
  complete: boolean;
}

const computeProgress = (regionUnlocks: string[]): ContinentProgress[] => {
  const continents: Array<[string, string[]]> = [
    ['Misthalin', MISTHALIN_AREAS],
    ...Object.entries(REGION_GROUPS),
  ];
  const unlockSet = new Set(regionUnlocks);
  return continents.map(([name, subs]) => {
    const continentUnlocked = ALWAYS_UNLOCKED.has(name) || unlockSet.has(name);
    const unlockedSubs = subs.filter(
      s => continentUnlocked || unlockSet.has(s) || ALWAYS_UNLOCKED.has(s)
    );
    const pct = subs.length === 0 ? 0 : (unlockedSubs.length / subs.length) * 100;
    return {
      name,
      subs,
      unlockedSubs,
      pct,
      complete: unlockedSubs.length === subs.length && subs.length > 0,
    };
  });
};

interface Props {
  regionUnlocks: string[];
}

export const RegionProgressPanel: React.FC<Props> = ({ regionUnlocks }) => {
  const [open, setOpen] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const rows = useMemo(() => computeProgress(regionUnlocks), [regionUnlocks]);
  const totalSubs = rows.reduce((acc, r) => acc + r.subs.length, 0);
  const totalUnlocked = rows.reduce((acc, r) => acc + r.unlockedSubs.length, 0);
  const overallPct = totalSubs === 0 ? 0 : (totalUnlocked / totalSubs) * 100;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="bg-black/80 border border-white/20 rounded px-3 py-1.5 text-xs text-gray-200 hover:bg-white/10 flex items-center gap-1.5 shadow-lg backdrop-blur-sm pointer-events-auto"
        title="Show region progress"
      >
        <ListChecks size={14} />
        Progress ({totalUnlocked}/{totalSubs})
      </button>
    );
  }

  return (
    <div className="bg-black/85 border border-white/15 rounded-md shadow-lg backdrop-blur-sm w-[260px] max-h-[520px] flex flex-col pointer-events-auto">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-200 uppercase tracking-wider">
          <ListChecks size={13} />
          Region Progress
        </div>
        <button
          onClick={() => setOpen(false)}
          className="text-gray-400 hover:text-white"
          title="Collapse"
        >
          <X size={14} />
        </button>
      </div>

      <div className="px-3 py-2 border-b border-white/10">
        <div className="flex justify-between text-[10px] text-gray-400 mb-1">
          <span>Overall</span>
          <span className="font-mono text-emerald-300">{totalUnlocked}/{totalSubs}</span>
        </div>
        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500/80 transition-all duration-300"
            style={{ width: `${overallPct}%` }}
          />
        </div>
      </div>

      <div className="overflow-y-auto custom-scrollbar flex-1">
        {rows.map(row => {
          const isExpanded = expanded[row.name] ?? false;
          return (
            <div key={row.name} className="border-b border-white/5 last:border-b-0">
              <button
                onClick={() => setExpanded(s => ({ ...s, [row.name]: !isExpanded }))}
                className="w-full px-3 py-2 flex flex-col gap-1 hover:bg-white/5 text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 min-w-0">
                    {isExpanded
                      ? <ChevronDown size={12} className="text-gray-400 shrink-0" />
                      : <ChevronRight size={12} className="text-gray-400 shrink-0" />}
                    <span className={`text-xs truncate ${row.complete ? 'text-emerald-300 font-semibold' : 'text-gray-200'}`}>
                      {row.name}
                    </span>
                  </div>
                  <span className={`text-[10px] font-mono shrink-0 ml-2 ${row.complete ? 'text-emerald-300' : 'text-gray-400'}`}>
                    {row.unlockedSubs.length}/{row.subs.length}
                  </span>
                </div>
                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${row.complete ? 'bg-emerald-400' : 'bg-emerald-500/60'}`}
                    style={{ width: `${row.pct}%` }}
                  />
                </div>
              </button>
              {isExpanded && row.subs.length > 0 && (
                <div className="px-3 pb-2 flex flex-wrap gap-1">
                  {row.subs.map(sub => {
                    const unlocked = row.unlockedSubs.includes(sub);
                    return (
                      <span
                        key={sub}
                        className={`text-[9px] px-1.5 py-0.5 rounded ${unlocked ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-500/30' : 'bg-white/5 text-gray-400 border border-white/10'}`}
                      >
                        {sub}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
