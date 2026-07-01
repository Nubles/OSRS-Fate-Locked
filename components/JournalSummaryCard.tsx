import React, { useMemo } from 'react';
import { BookOpen, Map as MapIcon, Swords, ChevronRight, Sparkles, Target, PartyPopper } from 'lucide-react';
import { WikiIcon } from './WikiIcon';
import { useGame } from '../context/GameContext';
import { QUEST_DATA } from '../data/questData';
import { DIARY_DATA } from '../data/diaryData';
import { ALL_DIARY_TASKS, DiaryTask } from '../data/diaryTasks';
import { CA_DATA } from '../data/caData';
import { ALL_CA_TASKS } from '../data/caTasks';
import { getQuestStatus, getDiaryStatus } from '../utils/journalStatus';
import { isAreaReachable } from '../utils/reachability';

/**
 * Compact "what can I do right now?" summary card for the Dashboard CHARACTER
 * tab.  A "recommended next action" headline picks the single highest-value
 * thing to do, followed by three rows — Quests / Diaries / Combat Achievements
 * — each showing a count and progress bar.  Clicking anything navigates
 * straight to the relevant Journal sub-tab.
 */

interface Props {
  /** Called when the player clicks a row.  Parent should switch to the Journal
   *  and open the indicated sub-tab. */
  onNavClick: (tab: 'QUESTS' | 'DIARIES' | 'CA') => void;
}

/** Mirrors the per-task doability check from DiaryLog.tsx (kept in sync). */
function countDoableDiaryTasks(unlocks: any, gameModeId?: string): number {
  return ALL_DIARY_TASKS.filter((task: DiaryTask) => {
    if (unlocks.completedTasks.includes(task.id)) return false;
    if (task.skills && !Object.entries(task.skills).every(
      ([skill, lvl]) => (unlocks.skills[skill] || 0) > 0 && (unlocks.levels[skill] || 1) >= (lvl as number),
    )) return false;
    if (task.quests && !task.quests.every((q: string) => unlocks.quests.includes(q))) return false;
    if (task.regions && !task.regions.every(
      (r: string) => isAreaReachable(r, unlocks, gameModeId),
    )) return false;
    // Also check the tier isn't already fully completed.
    if (unlocks.diaries.includes(task.tierId)) return false;
    return true;
  }).length;
}

interface Recommendation {
  tab: 'QUESTS' | 'DIARIES' | 'CA' | null;
  headline: string;
  detail: string;
}

/**
 * Picks the single best next action. Prefers the available quest with the
 * highest DIRECT unlock impact (cheap 1-step simulation), then doable diary
 * tasks, then any available quest, then CA grind. Returns a celebratory state
 * when nothing is left.
 */
function recommendNextAction(unlocks: any, diaryDoable: number, caLeft: number, gameModeId?: string): Recommendation {
  const allQuests = Object.values(QUEST_DATA);
  const allDiaries = Object.values(DIARY_DATA);

  // Base statuses once — reused across the candidate loop.
  const baseQ = new Map(allQuests.map((q) => [q.id, getQuestStatus(q, unlocks, gameModeId)]));
  const baseD = new Map(allDiaries.map((d) => [d.id, getDiaryStatus(d, unlocks, gameModeId)]));
  const wasOpen = (s: string | undefined) => s === 'AVAILABLE' || s === 'COMPLETED';

  const available = allQuests.filter((q) => baseQ.get(q.id) === 'AVAILABLE');

  let best: { name: string; nq: number; nd: number; impact: number } | null = null;
  for (const q of available) {
    const sim = { ...unlocks, quests: [...unlocks.quests, q.id] };
    let nq = 0;
    for (const oq of allQuests) {
      if (oq.id === q.id) continue;
      if (wasOpen(baseQ.get(oq.id))) continue;
      if (getQuestStatus(oq, sim, gameModeId) === 'AVAILABLE') nq++;
    }
    let nd = 0;
    for (const d of allDiaries) {
      if (wasOpen(baseD.get(d.id))) continue;
      if (getDiaryStatus(d, sim, gameModeId) === 'AVAILABLE') nd++;
    }
    const impact = nq * 2 + nd;
    if (!best || impact > best.impact) best = { name: q.name, nq, nd, impact };
  }

  if (best && best.impact > 0) {
    const parts: string[] = [];
    if (best.nq > 0) parts.push(`${best.nq} quest${best.nq !== 1 ? 's' : ''}`);
    if (best.nd > 0) parts.push(`${best.nd} diary tier${best.nd !== 1 ? 's' : ''}`);
    return { tab: 'QUESTS', headline: `Complete ${best.name}`, detail: `unlocks ${parts.join(' · ')}` };
  }
  if (diaryDoable > 0) {
    return { tab: 'DIARIES', headline: `Knock out diary tasks`, detail: `${diaryDoable} doable right now` };
  }
  if (best) {
    return { tab: 'QUESTS', headline: `Complete ${best.name}`, detail: `available now` };
  }
  if (caLeft > 0) {
    return { tab: 'CA', headline: `Grind combat achievements`, detail: `${caLeft} tasks remaining` };
  }
  return { tab: null, headline: `Everything's done!`, detail: `No actionable journal content left` };
}

export const JournalSummaryCard: React.FC<Props> = ({ onNavClick }) => {
  const { unlocks, advisorsEnabled, gameModeId } = useGame();

  const stats = useMemo(() => {
    // ── Quests available ─────────────────────────────────────────────────────
    const allQuests = Object.values(QUEST_DATA);
    const questsAvailable = allQuests.filter(
      (q) => getQuestStatus(q, unlocks, gameModeId) === 'AVAILABLE',
    ).length;
    const questsTotal    = allQuests.length;
    const questsDone     = unlocks.quests.length;

    // ── Diary tasks doable ───────────────────────────────────────────────────
    const diaryTasksDoable = countDoableDiaryTasks(unlocks, gameModeId);
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
  }, [unlocks, gameModeId]);

  // The single best next action — computed once per unlocks change.
  const recommendation = useMemo(
    () => recommendNextAction(unlocks, stats.diaries.doable, stats.ca.left, gameModeId),
    [unlocks, stats.diaries.doable, stats.ca.left, gameModeId],
  );

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
      icon: <WikiIcon file="Quest_point_icon.png" alt="Quests" Fallback={BookOpen} size={13} />,
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
      icon: <WikiIcon file="Achievement_Diaries_icon.png" alt="Diary Tasks" Fallback={MapIcon} size={13} />,
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
      icon: <WikiIcon file="Combat_Achievements_icon.png" alt="Combat Achievements" Fallback={Swords} size={13} />,
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

  const noneLeft = recommendation.tab === null;

  return (
    <section className="bg-[#151515] border border-white/10 rounded-xl p-4" aria-label="Journal summary">
      <div className="flex items-center gap-2 mb-3">
        <WikiIcon file="Quest_list_icon.png" alt="" Fallback={Sparkles} size={14} />
        <h3 className="text-xs font-bold text-amber-300 uppercase tracking-widest">Journal Summary</h3>
        <span className="ml-auto text-[10px] text-gray-600">click to jump</span>
      </div>

      {/* ── Recommended next action (advisory — hidden when advisors are off) ── */}
      {advisorsEnabled && (noneLeft ? (
        <div className="mb-3 rounded-lg border border-emerald-500/25 bg-emerald-900/15 px-3 py-2.5 flex items-center gap-2.5">
          <PartyPopper size={15} className="text-emerald-400 shrink-0" aria-hidden />
          <div>
            <p className="text-[11px] font-bold text-emerald-300">{recommendation.headline}</p>
            <p className="text-[10px] text-emerald-500/70">{recommendation.detail}</p>
          </div>
        </div>
      ) : (
        <button
          onClick={() => recommendation.tab && onNavClick(recommendation.tab)}
          aria-label={`Recommended: ${recommendation.headline} — ${recommendation.detail}`}
          className="mb-3 w-full text-left rounded-lg border border-amber-500/30 bg-gradient-to-r from-amber-900/20 to-transparent px-3 py-2.5 flex items-center gap-2.5 hover:from-amber-900/35 hover:border-amber-400/50 transition-all group outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
        >
          <Target size={15} className="text-amber-400 shrink-0 group-hover:scale-110 transition-transform" aria-hidden />
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-widest text-amber-500/70 mb-0.5">Do this next</p>
            <p className="text-[12px] font-bold text-amber-200 truncate">{recommendation.headline}</p>
            <p className="text-[10px] text-amber-400/70 truncate">{recommendation.detail}</p>
          </div>
          <ChevronRight size={13} className="text-amber-600 group-hover:text-amber-300 transition-colors shrink-0" aria-hidden />
        </button>
      ))}

      <div className="space-y-2" role="list">
        {rows.map((row, idx) => (
          <button
            key={row.key}
            role="listitem"
            onClick={() => onNavClick(row.key)}
            aria-label={`${row.label}: ${row.headline}, ${row.sub}`}
            style={{ animationDelay: `${idx * 40}ms` }}
            className="w-full text-left bg-[#1a1a1a] border border-white/5 rounded-lg px-3 py-2 hover:bg-white/5 hover:border-white/10 transition-all group outline-none focus-visible:ring-2 focus-visible:ring-white/30 animate-in fade-in slide-in-from-bottom-1 duration-300 fill-mode-both"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className={row.accent} aria-hidden>{row.icon}</span>
              <span className={`text-[11px] font-semibold ${row.accent}`}>{row.label}</span>
              {row.badgeValue > 0 && (
                <span className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${row.badgeColor}`}>
                  {row.badgeValue}
                </span>
              )}
              <ChevronRight
                size={10}
                aria-hidden
                className={`text-gray-700 group-hover:text-gray-400 transition-colors ${row.badgeValue > 0 ? '' : 'ml-auto'}`}
              />
            </div>

            {/* Progress bar */}
            <div
              className="h-[3px] bg-black/40 rounded-full overflow-hidden mb-1"
              title={`${row.pct}% complete`}
            >
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
    </section>
  );
};
