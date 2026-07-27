import React, { useMemo } from 'react';
import { ChevronDown, ChevronRight, Award, BookOpen, Map as MapIcon } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { QUEST_DATA } from '../data/questData';
import { DIARY_DATA } from '../data/diaryData';
import { ALL_DIARY_TASKS, DiaryTask } from '../data/diaryTasks';
import { ALL_CA_TASKS, CATask } from '../data/caTasks';
import {
  CA_TASK_POINTS,
  CA_TIER_ORDER,
  completedCAPoints,
  earnedCATiers,
  isCATierId,
} from '../utils/caProgress';
import { DropSource, UnlockState } from '../types';
import { countDoableDiaryTasks } from '../utils/journalStatus';

/**
 * Collapsible "insights" band for each Journal sub-tab: the at-a-glance
 * numbers the flat lists can't show — quest points and per-difficulty
 * completion, per-area diary progress with the closest finishable tier,
 * and CA points with per-tier breakdowns.
 */

const Bar: React.FC<{ label: string; done: number; total: number; color: string; suffix?: string }> =
  ({ label, done, total, color, suffix }) => {
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    return (
      <div className="min-w-0">
        <div className="flex justify-between text-[9px] mb-0.5">
          <span className="text-gray-400 font-semibold truncate">{label}</span>
          <span className="text-gray-600 font-mono shrink-0">{done}/{total}{suffix ?? ''}</span>
        </div>
        <div className="h-1 bg-black/50 rounded-full overflow-hidden">
          <div className={`h-full ${pct === 100 ? 'bg-green-500' : color}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  };

const Shell: React.FC<{ storageKey: string; title: string; icon: React.ReactNode; summary: string; children: React.ReactNode }> =
  ({ storageKey, title, icon, summary, children }) => {
    const [open, setOpen] = useLocalStorage<boolean>(storageKey, true);
    return (
      <div className="border-b border-white/10 bg-[#171717] shrink-0">
        <button
          onClick={() => setOpen(o => !o)}
          className="w-full px-3 py-1.5 flex items-center gap-2 text-left hover:bg-white/[0.03] transition-colors"
        >
          {open ? <ChevronDown size={12} className="text-gray-500" /> : <ChevronRight size={12} className="text-gray-500" />}
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">{icon}{title}</span>
          <span className="ml-auto text-[10px] text-gray-500 font-mono truncate">{summary}</span>
        </button>
        {open && <div className="px-3 pb-2.5">{children}</div>}
      </div>
    );
  };

// ── Quests ────────────────────────────────────────────────────────────────
const QUEST_DIFFS: { label: string; src: DropSource; color: string }[] = [
  { label: 'Novice', src: DropSource.QUEST_NOVICE, color: 'bg-green-600' },
  { label: 'Intermediate', src: DropSource.QUEST_INTERMEDIATE, color: 'bg-cyan-600' },
  { label: 'Experienced', src: DropSource.QUEST_EXPERIENCED, color: 'bg-blue-600' },
  { label: 'Master', src: DropSource.QUEST_MASTER, color: 'bg-purple-600' },
  { label: 'Grandmaster', src: DropSource.QUEST_GRANDMASTER, color: 'bg-amber-500' },
];

export const QuestInsights: React.FC = () => {
  const { unlocks } = useGame();
  const stats = useMemo(() => {
    const done = new Set(unlocks.quests);
    let qpEarned = 0, qpTotal = 0;
    const byDiff = QUEST_DIFFS.map(d => ({ ...d, done: 0, total: 0 }));
    for (const q of Object.values(QUEST_DATA)) {
      qpTotal += q.points;
      if (done.has(q.id)) qpEarned += q.points;
      const bucket = byDiff.find(d => d.src === q.difficulty);
      if (bucket) { bucket.total++; if (done.has(q.id)) bucket.done++; }
    }
    return { qpEarned, qpTotal, byDiff };
  }, [unlocks.quests]);

  return (
    <Shell storageKey="jrnl:insights:quests" title="Quest insights" icon={<BookOpen size={11} />}
      summary={`${stats.qpEarned}/${stats.qpTotal} QP`}>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1.5">
        <Bar label="Quest Points" done={stats.qpEarned} total={stats.qpTotal} color="bg-yellow-500" suffix=" QP" />
        {stats.byDiff.map(d => (
          <Bar key={d.label} label={d.label} done={d.done} total={d.total} color={d.color} />
        ))}
      </div>
    </Shell>
  );
};

// ── Diaries ───────────────────────────────────────────────────────────────
export const calculateDiaryInsightStats = (
  allTasks: readonly DiaryTask[],
  tierIds: readonly string[],
  unlocks: UnlockState,
  gameModeId?: string,
) => {
  const doneTasks = new Set(unlocks.completedTasks);
  const completedTiers = new Set(unlocks.diaries);
  const tasksByTier = new Map<string, DiaryTask[]>();
  for (const task of allTasks) {
    if (!tasksByTier.has(task.tierId)) tasksByTier.set(task.tierId, []);
    tasksByTier.get(task.tierId)!.push(task);
  }

  const areas = new Map<string, { done: number; total: number }>();
  let closest: {
    tier: string; left: number; doable: number; key: [number, number, number];
  } | null = null;
  for (const tier of tierIds) {
    const area = tier.replace(/ (Easy|Medium|Hard|Elite)$/, '');
    const tasks = tasksByTier.get(tier) ?? [];
    const tierComplete = completedTiers.has(tier);
    const done = tierComplete
      ? tasks.length
      : tasks.filter(task => doneTasks.has(task.id)).length;
    const areaProgress = areas.get(area) ?? { done: 0, total: 0 };
    areaProgress.done += done;
    areaProgress.total += tasks.length;
    areas.set(area, areaProgress);
    const left = tasks.length - done;
    if (tierComplete || left === 0) continue;
    const doable = countDoableDiaryTasks(tasks, unlocks, gameModeId);
    const key: [number, number, number] = [doable > 0 ? 0 : 1, left, -doable];
    if (!closest
      || key[0] < closest.key[0]
      || (key[0] === closest.key[0]
        && (key[1] < closest.key[1]
          || (key[1] === closest.key[1] && key[2] < closest.key[2])))) {
      closest = { tier, left, doable, key };
    }
  }
  const sorted = [...areas.entries()].sort(
    (left, right) => (right[1].done / Math.max(1, right[1].total))
      - (left[1].done / Math.max(1, left[1].total)),
  );
  return { sorted, closest };
};

export const DiaryInsights: React.FC = () => {
  const { unlocks, gameModeId } = useGame();
  const stats = useMemo(
    () => calculateDiaryInsightStats(
      ALL_DIARY_TASKS, Object.keys(DIARY_DATA), unlocks, gameModeId,
    ),
    [unlocks, gameModeId],
  );

  return (
    <Shell storageKey="jrnl:insights:diaries" title="Diary insights" icon={<MapIcon size={11} />}
      summary={stats.closest ? `closest: ${stats.closest.tier} (${stats.closest.doable}/${stats.closest.left} doable)` : 'all tasks complete'}>
      {stats.closest && (
        <div className="mb-2 text-[10px] text-emerald-300/90">
          Closest tier: <span className="font-bold">{stats.closest.tier}</span> — {stats.closest.doable} of {stats.closest.left} remaining task{stats.closest.left === 1 ? '' : 's'} doable now
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1.5">
        {stats.sorted.map(([area, v]) => (
          <Bar key={area} label={area} done={v.done} total={v.total} color="bg-emerald-600" />
        ))}
      </div>
    </Shell>
  );
};

// ── Combat Achievements ───────────────────────────────────────────────────
const CA_COLORS: Record<string, string> = {
  Easy: 'bg-green-600', Medium: 'bg-cyan-600', Hard: 'bg-blue-600',
  Elite: 'bg-purple-600', Master: 'bg-rose-600', Grandmaster: 'bg-amber-500',
};

export const calculateCAInsightStats = (
  tasks: readonly Pick<CATask, 'id' | 'tierId'>[],
  unlocks: Pick<UnlockState, 'completedTasks' | 'cas'>,
) => {
  const done = new Set(unlocks.completedTasks);
  const presentTiers = new Set(tasks.map(task => task.tierId));
  const tiers = CA_TIER_ORDER
    .filter(tier => presentTiers.has(tier))
    .map(tier => {
      const tierTasks = tasks.filter(task => task.tierId === tier);
      return {
        tier,
        done: tierTasks.filter(task => done.has(task.id)).length,
        total: tierTasks.length,
        points: CA_TASK_POINTS[tier],
      };
    });
  const pointsEarned = completedCAPoints(unlocks.completedTasks, tasks);
  const pointsTotal = tasks.reduce(
    (sum, task) => sum + (isCATierId(task.tierId) ? CA_TASK_POINTS[task.tierId] : 0),
    0,
  );
  return {
    tiers,
    pointsEarned,
    pointsTotal,
    earnedTiers: earnedCATiers(pointsEarned, unlocks.cas),
  };
};

export const CAInsights: React.FC = () => {
  const { unlocks } = useGame();
  const stats = useMemo(
    () => calculateCAInsightStats(ALL_CA_TASKS, unlocks),
    [unlocks.completedTasks, unlocks.cas],
  );

  return (
    <Shell storageKey="jrnl:insights:ca" title="CA insights" icon={<Award size={11} />}
      summary={`${stats.pointsEarned}/${stats.pointsTotal} points · ${stats.earnedTiers.length}/6 rewards`}>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1.5">
        <Bar label="CA Points" done={stats.pointsEarned} total={stats.pointsTotal} color="bg-yellow-500" suffix=" pts" />
        {stats.tiers.map(t => (
          <Bar key={t.tier} label={`${t.tier} (${t.points}pt)`} done={t.done} total={t.total} color={CA_COLORS[t.tier] ?? 'bg-gray-600'} />
        ))}
      </div>
    </Shell>
  );
};
