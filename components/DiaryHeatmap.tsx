import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, LayoutGrid } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { DIARY_DATA } from '../data/diaryData';
import { ALL_DIARY_TASKS } from '../data/diaryTasks';
import { diaryUnmet } from '../utils/journalProgress';
import { useLocalStorage } from '../hooks/useLocalStorage';

type Status = 'done' | 'available' | 'almost' | 'locked';
const TIERS = ['Easy', 'Medium', 'Hard', 'Elite'] as const;

const CELL: Record<Status, string> = {
  done: 'bg-emerald-500/80 hover:bg-emerald-400',
  available: 'bg-amber-500/80 hover:bg-amber-400',
  almost: 'bg-sky-500/70 hover:bg-sky-400',
  locked: 'bg-white/[0.06] hover:bg-white/15',
};

/**
 * Diary completion heatmap — every diary tier as a coloured cell in a
 * region × tier grid, so the whole diary landscape reads at a glance. Click a
 * cell to filter the list to that tier.
 */
export const DiaryHeatmap: React.FC<{ onPick: (diaryId: string) => void }> = ({ onPick }) => {
  const { unlocks, gameModeId } = useGame();
  const [open, setOpen] = useLocalStorage<boolean>('jrnl:diary:heatmap', true);

  // Diary "areas" are the id prefix (e.g. "Ardougne"), not the continent.
  const { areas, statusOf } = useMemo(() => {
    const areas = [...new Set(Object.keys(DIARY_DATA).map(id => id.replace(/ (Easy|Medium|Hard|Elite)$/, '')))];
    const statusOf = (area: string, tier: string): Status | null => {
      const d = DIARY_DATA[`${area} ${tier}`];
      if (!d) return null;
      const tasks = ALL_DIARY_TASKS.filter(t => t.tierId === d.id);
      const allDone = tasks.length > 0 && tasks.every(t => unlocks.completedTasks.includes(t.id));
      if (unlocks.diaries.includes(d.id) || allDone) return 'done';
      const unmet = diaryUnmet(d, unlocks, gameModeId).length;
      return unmet === 0 ? 'available' : unmet === 1 ? 'almost' : 'locked';
    };
    return { areas, statusOf };
  }, [unlocks, gameModeId]);

  return (
    <div className="shrink-0 border-b border-white/5 bg-[#161616]">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-2 px-3 py-1.5 text-left">
        {open ? <ChevronDown size={12} className="text-gray-500" /> : <ChevronRight size={12} className="text-gray-500" />}
        <LayoutGrid size={12} className="text-green-300" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-green-200/90">Diary map</span>
        <div className="ml-auto flex items-center gap-2 text-[9px] text-gray-500">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500/80" />done</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-500/80" />ready</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-sky-500/70" />almost</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-white/15" />locked</span>
        </div>
      </button>
      {open && (
        <div className="px-2 pb-2 overflow-x-auto">
          <div className="grid gap-1 min-w-[300px]" style={{ gridTemplateColumns: '78px repeat(4, 1fr)' }}>
            <div />
            {TIERS.map(t => <div key={t} className="text-[9px] text-gray-600 text-center pb-0.5">{t}</div>)}
            {areas.map(area => (
              <React.Fragment key={area}>
                <div className="text-[10px] text-gray-400 flex items-center truncate pr-1" title={area}>{area}</div>
                {TIERS.map(tier => {
                  const s = statusOf(area, tier);
                  if (!s) return <div key={tier} />;
                  return (
                    <button
                      key={tier}
                      onClick={() => { onPick(`${area} ${tier}`); setOpen(false); }}
                      title={`${area} ${tier} — ${s}`}
                      className={`h-5 rounded-sm transition-colors ${CELL[s]}`}
                      aria-label={`${area} ${tier} diary: ${s}`}
                    />
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
