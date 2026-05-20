import React, { useMemo } from 'react';
import { BookOpen, Map, Swords, ChevronRight, Sparkles } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { QUEST_DATA } from '../data/questData';
import { DIARY_DATA } from '../data/diaryData';
import { ALL_DIARY_TASKS, DiaryTask } from '../data/diaryTasks';
import { CA_DATA } from '../data/caData';
import { ALL_CA_TASKS } from '../data/caTasks';
import { getQuestStatus } from '../utils/journalStatus';
import { MISTHALIN_AREAS } from '../data/items';

/**
 * Compact "what can I do right now?" summary card for the Dashboard CHARACTER
 * tab.  Three rows — Quests / Diaries / Combat Achievements — each showing a
 * quick count and a coloured progress bar.  Clicking a row fires onNavClick
 * so the parent can switch the Journal tab directly.
 */

interface Props {
  /** Called when the player clicks a row.  Parent should switch to the Journal
   *  and open the indicated sub-tab. */
  onNavClick: (tab: 'QUESTS' | 'DIARIES' | 'CA') => void;
}

/** Mirrors the per-task doability check from DiaryLog.tsx (kept in sync). */
function countDoableDiaryTasks(unlocks: any): number {
  return ALL_DIARY_TASKS.filter((task: DiaryTask) => {
    if (unlocks.completedTasks.includes(task.id)) return false;
    if (task.skills && !Object.entries(task.skills).every(
      ([skill, lvl]) => (unlocks.skills[skill] || 0) > 0 && (unlocks.levels[skill] || 1) >= (lvl as number),
    )) return false;
    if (task.quests && !task.quests.every((q: string) => unlocks.quests.includes(q))) return false;
    if (task.regions && !task.regions.every(
      (r: string) => r === 'Misthalin' || MISTHALIN_AREAS.includes(r) || unlocks.regions.includes(r),
    )) return false;
    // Also check the tier isn't already fully completed.
    if (unlocks.diaries.includes(task.tierId)) return false;
    return true;
  }).length;
}

export const JournalSummaryCard: React.FC<Props> = ({ onNavClick }) => {
  const { unlocks } = useGame();

  const stats = useMemo(() => {
    // ── Quests available ─────────────────────────────────────────────────────
    const allQuests = Object.values(QUEST_DATA);
    const questsAvailable = allQuests.filter(
      (q) => getQuestStatus(q, unlocks) === 'AVAILABLE',
    ).length;
    const questsTotal    = allQuests.length;
    const questsDone     = unlocks.quests.length;

    // ── Diary tasks doable ───────────────────────────────────────────────────
    const diaryTasksDoable = countDoableDiaryTasks(unlocks);
    const diaryTasksTotal  = ALL_DIARY_TASKS.length;
    const diaryTasksDone   = unlocks.completedTasks.filter((id: string) =>
      ALL_DIARY_TASKS.some((t) => t.id === id),
    ).length;

    // ── CA tasks remaining ───────────────────────────────────────────────────
    const caTiersTotal   = Object.keys(CA_DATA).length;
    const caTiersDone    = unlocks.cas.length;
    const caTasksTotal   = ALL_CA_TASKS.length;
    const caTasksDone    = unlocks.completedTasks.filter((id: string) =>
      ALL_CA_TASKS.some((t) => t.id === id),
    ).length;
    const caTasksLeft    = caTasksTotal - caTasksDone;

    return {
      quests: { available: questsAvailable, done: questsDone, total: questsTotal },
      diaries: { doable: diaryTasksDoable, done: diaryTasksDone, total: diaryTasksTotal },
      ca: { left: caTasksLeft, done: caTiersDone, total: caTiersTotal, tasksDone: caTasksDone, tasksTotal: caTasksTotal },
    };
  }, [unlocks]);

  const rows: Array<{
    key: 'QUESTS' | 'DIARIES' | 'CA';
    icon: React.ReactNode;
    label: string;
    accent: string;
    barColor: string;
    badgeColor: string;
    headline: string;
    sub: string;
    pct: number;
    badgeValue: number;
  }> = [
    {
      key: 'QUESTS',
      icon: <BookOpen size={12} />,
      label: 'Quests',
      accent: 'text-blue-300',
      barColor: 'bg-blue-500/50',
      badgeColor: 'bg-blue-900/40 text-blue-300 border-blue-500/30',
      headline: `${stats.quests.done}/${stats.quests.total} done`,
      sub: stats.quests.available > 0
        ? `${stats.quests.available} ready to complete`
        : 'None available yet',
      pct: Math.round((stats.quests.done / stats.quests.total) * 100),
      badgeValue: stats.quests.available,
    },
    {
      key: 'DIARIES',
      icon: <Map size={12} />,
      label: 'Diary Tasks',
      accent: 'text-green-300',
      barColor: 'bg-green-500/50',
      badgeColor: 'bg-green-900/40 text-green-300 border-green-500/30',
      headline: `${stats.diaries.done}/${stats.diaries.total} tasks done`,
      sub: stats.diaries.doable > 0
        ? `${stats.diaries.doable} task${stats.diaries.doable !== 1 ? 's' : ''} doable now`
        : 'No new tasks accessible yet',
      pct: Math.round((stats.diaries.done / stats.diaries.total) * 100),
      badgeValue: stats.diaries.doable,
    },
    {
      key: 'CA',
      icon: <Swords size={12} />,
      label: 'Combat Achievements',
      accent: 'text-red-300',
      barColor: 'bg-red-500/50',
      badgeColor: 'bg-red-900/40 text-red-300 border-red-500/30',
      headline: `${stats.ca.tasksDone}/${stats.ca.tasksTotal} tasks · ${stats.ca.done}/${stats.ca.total} tiers`,
      sub: stats.ca.left > 0
        ? `${stats.ca.left} task${stats.ca.left !== 1 ? 's' : ''} remaining`
        : 'All tasks complete!',
      pct: Math.round((stats.ca.tasksDone / stats.ca.tasksTotal) * 100),
      badgeValue: stats.ca.left,
    },
  ];

  return (
    <div className="bg-[#151515] border border-white/10 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={13} className="text-amber-400" />
        <h3 className="text-xs font-bold text-amber-300 uppercase tracking-widest">Journal Summary</h3>
        <span className="ml-auto text-[10px] text-gray-600">click to jump</span>
      </div>

      <div className="space-y-2">
        {rows.map((row) => (
          <button
            key={row.key}
            onClick={() => onNavClick(row.key)}
            className="w-full text-left bg-[#1a1a1a] border border-white/5 rounded-lg px-3 py-2 hover:bg-white/5 hover:border-white/10 transition-all group"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className={row.accent}>{row.icon}</span>
              <span className={`text-[11px] font-semibold ${row.accent}`}>{row.label}</span>
              {row.badgeValue > 0 && (
                <span className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${row.badgeColor}`}>
                  {row.badgeValue}
                </span>
              )}
              <ChevronRight
                size={10}
                className={`text-gray-700 group-hover:text-gray-400 transition-colors ${row.badgeValue > 0 ? '' : 'ml-auto'}`}
              />
            </div>

            {/* Progress bar */}
            <div className="h-[3px] bg-black/40 rounded-full overflow-hidden mb-1">
              <div
                className={`h-full ${row.barColor} rounded-full transition-all duration-500`}
                style={{ width: `${row.pct}%` }}
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-500">{row.headline}</span>
              <span className={`text-[10px] ${row.badgeValue > 0 ? row.accent : 'text-gray-700'}`}>
                {row.sub}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
