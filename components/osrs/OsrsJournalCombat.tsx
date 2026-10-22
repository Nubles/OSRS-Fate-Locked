import React, { useEffect, useMemo, useState } from 'react';
import type { CATier } from '../../data/caData';
import { ALL_CA_TASKS, type CATask } from '../../data/caTasks';
import type { UnlockState } from '../../types';
import { useSourceKeyChance } from '../../hooks/useSourceKeyChance';
import { CA_TASK_POINTS, caTaskLockedBoss, isCATierId } from '../../utils/caProgress';
import { EntityLocations } from '../EntityLocations';
import { Legend, WikiTable, plural, type WikiRow } from './OsrsJournalParts';

/**
 * Combat Achievements in the OSRS layout: the reward tiers as list headings
 * with their tasks beneath (green done, yellow boss unlocked, red boss
 * locked), and the selected tier or task as a journal scroll with OSRS Wiki
 * style details. Selection follows CALog's expanded tier; every button calls
 * CALog's handlers.
 */

interface Props {
  tiers: CATier[];
  unlocks: UnlockState;
  totalPoints: number;
  nextTier?: string;
  searchTerm: string;
  selectedTierId: string | null;
  highlightedId: string | null;
  onSelectTier: (id: string) => void;
  monsterWikiUrl: (monster: string) => string;
  onTierComplete: (e: React.MouseEvent, tier: CATier) => void;
  onTaskComplete: (task: CATask, e: React.MouseEvent) => void;
}

const pointsOf = (tierId: string): number => (isCATierId(tierId) ? CA_TASK_POINTS[tierId] : 0);
const wiki = (name: string) => `https://oldschool.runescape.wiki/w/${encodeURIComponent(name.replace(/ /g, '_'))}`;

const taskTone = (task: CATask, unlocks: UnlockState): string =>
  unlocks.completedTasks.includes(task.id) ? 'ojr-done'
    : caTaskLockedBoss(task, unlocks.bosses) ? 'ojr-locked' : 'ojr-ready';

const taskExamine = (task: CATask, unlocks: UnlockState): string => {
  const points = pointsOf(task.tierId);
  const state = unlocks.completedTasks.includes(task.id) ? 'Done.'
    : caTaskLockedBoss(task, unlocks.bosses) ? `${caTaskLockedBoss(task, unlocks.bosses)} is not unlocked.` : 'Not done yet.';
  return `${task.tierId} combat achievement, ${plural(points, 'point')}. ${task.monster}. ${state}`;
};

export const OsrsJournalCombat: React.FC<Props> = ({
  tiers, unlocks, totalPoints, nextTier, searchTerm, selectedTierId, highlightedId,
  onSelectTier, monsterWikiUrl, onTierComplete, onTaskComplete,
}) => {
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const term = searchTerm.toLowerCase();
  const isSearching = term.length > 0;

  const tasksOf = useMemo(() => {
    const map = new Map<string, CATask[]>();
    for (const task of ALL_CA_TASKS) {
      if (!map.has(task.tierId)) map.set(task.tierId, []);
      map.get(task.tierId)!.push(task);
    }
    return map;
  }, []);

  const tier = tiers.find(t => t.id === selectedTierId) ?? tiers.find(t => !unlocks.cas.includes(t.id)) ?? tiers[0] ?? null;
  const visibleTasks = (ca: CATier) => (tasksOf.get(ca.id) ?? []).filter(task => !isSearching
    || task.description.toLowerCase().includes(term) || task.monster.toLowerCase().includes(term) || ca.id.toLowerCase().includes(term));

  // A jump to a tier selects it and shows the tier itself, not a stale task.
  useEffect(() => { if (highlightedId) setSelectedTask(null); }, [highlightedId]);

  const task = selectedTask ? ALL_CA_TASKS.find(t => t.id === selectedTask) ?? null : null;

  return (
    <div className="ojr-split">
      <div className="ojr-list">
        <div className="ojr-topline"><span>Combat Achievements</span><span>{totalPoints.toLocaleString()} pts</span></div>
        <div className="ojr-list-scroll">
          {tiers.map(ca => {
            const all = tasksOf.get(ca.id) ?? [];
            const done = all.filter(t => unlocks.completedTasks.includes(t.id)).length;
            const recorded = unlocks.cas.includes(ca.id);
            const open = isSearching || tier?.id === ca.id;
            const tone = recorded ? 'ojr-done' : totalPoints >= ca.pointsRequired ? 'ojr-ready' : '';
            return (
              <React.Fragment key={ca.id}>
                <button
                  type="button"
                  className={`ojr-row ${tone}${highlightedId === ca.id ? ' is-flash' : ''}`}
                  style={{ fontFamily: 'RSBold, sans-serif', color: tone ? undefined : '#ffffff', paddingTop: 4 }}
                  data-journal-id={ca.id}
                  data-examine={`${ca.id} Combat Achievements tier. ${done}/${all.length} tasks done, ${plural(pointsOf(ca.id), 'point')} each. Reward at ${ca.pointsRequired.toLocaleString()} points.${recorded ? ' Reward recorded.' : ''}`}
                  data-examine-name={`${ca.id} tier`}
                  aria-current={tier?.id === ca.id && !task ? 'true' : undefined}
                  aria-expanded={open}
                  onClick={() => { onSelectTier(ca.id); setSelectedTask(null); }}
                >
                  <span className="ojr-row-name">{ca.id} tier</span>
                  <span className="ojr-row-key">{done}/{all.length}</span>
                </button>
                {open && visibleTasks(ca).map(t => (
                  <button
                    key={t.id}
                    type="button"
                    className={`ojr-row ojr-sub ${taskTone(t, unlocks)}`}
                    data-examine={taskExamine(t, unlocks)}
                    data-examine-name={t.name ?? t.monster}
                    aria-current={task?.id === t.id ? 'true' : undefined}
                    onClick={() => { onSelectTier(ca.id); setSelectedTask(t.id); }}
                  >
                    <span className="ojr-row-name">{t.name ?? t.description}</span>
                    <span className="ojr-row-key">{t.monster}</span>
                  </button>
                ))}
              </React.Fragment>
            );
          })}
          {tiers.length === 0 && <div className="ojr-empty">No tiers found matching filter.</div>}
        </div>
        <Legend items={[
          { label: 'Done', cls: 'ojr-done' },
          { label: 'Boss unlocked', cls: 'ojr-ready' },
          { label: 'Boss locked', cls: 'ojr-locked' },
        ]} />
      </div>

      {task
        ? <TaskDetail key={task.id} task={task} unlocks={unlocks} monsterWikiUrl={monsterWikiUrl} onTaskComplete={onTaskComplete} />
        : tier
          ? <TierDetail key={tier.id} tier={tier} tasks={tasksOf.get(tier.id) ?? []} unlocks={unlocks} totalPoints={totalPoints} nextTier={nextTier} onTierComplete={onTierComplete} />
          : <div className="ojr-detail" />}
    </div>
  );
};

const TierDetail: React.FC<{
  tier: CATier;
  tasks: CATask[];
  unlocks: UnlockState;
  totalPoints: number;
  nextTier?: string;
  onTierComplete: Props['onTierComplete'];
}> = ({ tier, tasks, unlocks, totalPoints, nextTier, onTierComplete }) => {
  const isRecorded = unlocks.cas.includes(tier.id);
  const isActionable = isRecorded || totalPoints >= tier.pointsRequired;
  const done = tasks.filter(t => unlocks.completedTasks.includes(t.id)).length;
  // The chance the roll is made against, the run's boosts included.
  const chanceOf = useSourceKeyChance();
  const rate = chanceOf(tier.difficulty);
  const rows: WikiRow[] = [
    { label: 'Tasks done', value: `${done}/${tasks.length}` },
    { label: 'Points per task', value: String(pointsOf(tier.id)) },
    { label: 'Reward tier', value: `${tier.pointsRequired.toLocaleString()} cumulative points` },
    { label: 'Your points', value: <span className={totalPoints >= tier.pointsRequired ? 'ojr-good' : 'ojr-bad'}>{totalPoints.toLocaleString()}</span> },
  ];
  if (nextTier) rows.push({ label: 'Next reward', value: nextTier });
  if (rate !== undefined) rows.push({ label: 'Fate Locked roll', value: `${rate}% Key chance per task` });

  return (
    <div className="ojr-detail">
      <div className="ojr-scroll" aria-label={`${tier.id} Combat Achievements`}>
        <div className="ojr-scroll-title">{tier.id} Tier</div>
        {isRecorded && <div className="ojr-red" style={{ textAlign: 'center', marginBottom: 6 }}>REWARD TIER RECORDED</div>}
        <div className={totalPoints >= tier.pointsRequired ? 'ojr-met' : undefined}>
          {tier.pointsRequired.toLocaleString()} cumulative points
          {totalPoints < tier.pointsRequired && <span className="ojr-note"> (you have {totalPoints.toLocaleString()})</span>}
        </div>
        <div className="ojr-gap">Recommended: {tier.recommendedStats}</div>
        {tier.keyUnlocks.length > 0 && <div className="ojr-gap">Key bosses for this tier:</div>}
        {tier.keyUnlocks.map(boss => {
          const unlocked = unlocks.bosses.includes(boss);
          return (
            <div key={boss}>
              <span className={unlocked ? 'ojr-met' : undefined}>{boss}</span>
              {!unlocked && <span className="ojr-note"> (not unlocked)</span>}
            </div>
          );
        })}
        {rate !== undefined && <div className="ojr-gap ojr-red">Each task rolls once for a Key at {rate}% base chance.</div>}
      </div>

      <WikiTable href="https://oldschool.runescape.wiki/w/Combat_Achievements" rows={rows} />

      <div className="ojr-actions">
        <button
          type="button"
          className="ojr-bigbtn is-main"
          disabled={isRecorded}
          title={isRecorded ? 'Reward tier recorded' : isActionable ? 'Record earned reward tier' : `Requires ${tier.pointsRequired} cumulative points`}
          onClick={(e) => onTierComplete(e, tier)}
        >
          {isRecorded ? 'Reward tier recorded' : 'Record reward tier'}
        </button>
      </div>
    </div>
  );
};

const TaskDetail: React.FC<{
  task: CATask;
  unlocks: UnlockState;
  monsterWikiUrl: Props['monsterWikiUrl'];
  onTaskComplete: Props['onTaskComplete'];
}> = ({ task, unlocks, monsterWikiUrl, onTaskComplete }) => {
  const isDone = unlocks.completedTasks.includes(task.id);
  const lockedBoss = caTaskLockedBoss(task, unlocks.bosses);
  const rows: WikiRow[] = [
    { label: 'Tier', value: task.tierId },
    { label: 'Points', value: String(pointsOf(task.tierId)) },
    { label: 'Monster', value: <a className="ojr-wlink" href={monsterWikiUrl(task.monster)} target="_blank" rel="noopener noreferrer">{task.monster}</a> },
  ];
  if (!isDone) rows.push({ label: 'Where', value: <EntityLocations name={task.monster} kinds={['monster']} cap={3} /> });

  return (
    <div className="ojr-detail">
      <div className="ojr-scroll" aria-label={`${task.name ?? task.monster} combat achievement`}>
        <div className="ojr-scroll-title">{task.name ?? task.monster}</div>
        {isDone && <div className="ojr-red" style={{ textAlign: 'center', marginBottom: 6 }}>TASK COMPLETE!</div>}
        <div className={isDone ? 'ojr-met' : undefined}>{task.description}</div>
        <div className="ojr-gap">{task.monster}, {task.tierId} tier, {plural(pointsOf(task.tierId), 'point')}.</div>
        {!isDone && lockedBoss && (
          <div className="ojr-gap ojr-red">Unlock {lockedBoss} to fight here. You can still log the task by hand.</div>
        )}
      </div>

      <WikiTable href={task.name ? wiki(task.name) : monsterWikiUrl(task.monster)} rows={rows} />

      <div className="ojr-actions">
        <button
          type="button"
          className="ojr-bigbtn is-main"
          disabled={isDone}
          onClick={(e) => onTaskComplete(task, e)}
        >
          {isDone ? 'Completed' : 'Complete and roll for a Key'}
        </button>
      </div>
    </div>
  );
};

export default OsrsJournalCombat;
