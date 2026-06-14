import React, { useMemo, useState } from 'react';
import { Sparkles, ChevronDown, ChevronRight, BookOpen, Map as MapIcon, Scroll } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { QUEST_DATA } from '../data/questData';
import { DIARY_DATA } from '../data/diaryData';
import { ALL_DIARY_TASKS } from '../data/diaryTasks';
import { DropSource } from '../types';
import { questUnmet, diaryUnmet } from '../utils/journalProgress';
import { useLocalStorage } from '../hooks/useLocalStorage';

type SubTab = 'QUESTS' | 'DIARIES' | 'CA';

interface Action {
  kind: 'quest' | 'diary';
  sub: SubTab;
  name: string;
  unmet: number;
  firstBlocker?: string;
  diffRank: number;
}

const diffRank = (d: DropSource): number => {
  const s = String(d);
  if (/Grandmaster|Elite/.test(s)) return 5;
  if (/Master|Hard/.test(s)) return 4;
  if (/Experienced/.test(s)) return 3;
  if (/Intermediate|Medium/.test(s)) return 2;
  return 1; // Novice / Easy
};

/**
 * One cross-journal "what should I do next" feed: blends quests + diary tiers,
 * ranked by readiness (doable now first, then one-away, then closest), so the
 * single best next action is at the top regardless of which log it lives in.
 */
export const JournalNextBest: React.FC<{ onPick: (sub: SubTab) => void }> = ({ onPick }) => {
  const { unlocks } = useGame();
  const [open, setOpen] = useLocalStorage<boolean>('jrnl:nextbest:open', true);

  const actions = useMemo<Action[]>(() => {
    const out: Action[] = [];
    for (const q of Object.values(QUEST_DATA)) {
      if (unlocks.quests.includes(q.id)) continue;
      const unmet = questUnmet(q, unlocks);
      out.push({ kind: 'quest', sub: 'QUESTS', name: q.name, unmet: unmet.length, firstBlocker: unmet[0]?.label, diffRank: diffRank(q.difficulty) });
    }
    for (const d of Object.values(DIARY_DATA)) {
      if (unlocks.diaries.includes(d.id)) continue;
      const tasks = ALL_DIARY_TASKS.filter(t => t.tierId === d.id);
      if (tasks.length > 0 && tasks.every(t => unlocks.completedTasks.includes(t.id))) continue; // all done
      const unmet = diaryUnmet(d, unlocks);
      out.push({ kind: 'diary', sub: 'DIARIES', name: d.id, unmet: unmet.length, firstBlocker: unmet[0]?.label, diffRank: diffRank(d.difficulty) });
    }
    // Only surface actionable items (ready or close), easiest first.
    return out
      .filter(a => a.unmet <= 1)
      .sort((a, b) => a.unmet - b.unmet || a.diffRank - b.diffRank || a.name.localeCompare(b.name))
      .slice(0, 8);
  }, [unlocks]);

  if (actions.length === 0) return null;
  const ready = actions.filter(a => a.unmet === 0).length;

  return (
    <div className="shrink-0 border-b border-white/5 bg-[#161616]">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-2 px-3 py-1.5 text-left">
        {open ? <ChevronDown size={12} className="text-gray-500" /> : <ChevronRight size={12} className="text-gray-500" />}
        <Sparkles size={12} className="text-amber-300" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-amber-200/90">Next best actions</span>
        <span className="text-[10px] font-mono text-gray-500">{ready > 0 ? `${ready} ready` : `${actions.length} close`}</span>
      </button>
      {open && (
        <div className="px-2 pb-2 flex flex-wrap gap-1.5">
          {actions.map((a) => {
            const Icon = a.kind === 'quest' ? Scroll : MapIcon;
            const ready = a.unmet === 0;
            return (
              <button
                key={`${a.kind}:${a.name}`}
                onClick={() => onPick(a.sub)}
                title={ready ? `${a.name} — ready now (open ${a.kind === 'quest' ? 'Quests' : 'Diaries'})` : `${a.name} — needs ${a.firstBlocker} (open ${a.kind === 'quest' ? 'Quests' : 'Diaries'})`}
                className={`text-[10px] px-2 py-1 rounded border flex items-center gap-1.5 max-w-[220px] transition-colors ${
                  ready ? 'bg-emerald-900/20 border-emerald-500/30 text-emerald-200 hover:bg-emerald-900/40'
                        : 'bg-amber-900/15 border-amber-500/30 text-amber-200 hover:bg-amber-900/30'}`}
              >
                <Icon size={10} className="shrink-0 opacity-70" />
                <span className="truncate font-semibold">{a.name}</span>
                <span className={`shrink-0 text-[9px] px-1 rounded ${ready ? 'bg-emerald-500/20' : 'bg-amber-500/20'}`}>
                  {ready ? 'ready' : a.firstBlocker}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
