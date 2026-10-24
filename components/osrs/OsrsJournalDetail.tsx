import React from 'react';
import type { QuestData } from '../../data/questData';
import type { QuestCardQuest } from '../QuestLog';
import { DIARY_DATA, type DiaryTier } from '../../data/diaryData';
import { ALL_DIARY_TASKS, type DiaryTask } from '../../data/diaryTasks';
import { CA_DATA, type CATier } from '../../data/caData';
import type { CATask } from '../../data/caTasks';
import type { UnlockState } from '../../types';
import type { AreaRoutes } from '../../utils/areaRoutes';
import { useSourceKeyChance } from '../../hooks/useSourceKeyChance';
import { failureFateForSource } from '../../config/economy';
import { questLocations } from '../../utils/questLocations';
import { showChunkOnMap, summarisePlaces } from '../../utils/chunkLocations';
import { effectiveSkillLevel } from '../../utils/slayerReach';
import { evaluateDiaryTaskEligibility, evaluateDiaryTierEligibility } from '../../utils/journalStatus';
import { formatDiaryChecks } from '../../utils/diaryCheckFormat';
import { CA_TASK_POINTS, isCATierId } from '../../utils/caProgress';
import { caTaskBlocker, caTaskBlockerText } from '../../utils/caTaskAccess';
import { chunkContentService } from '../../services/ChunkContentService';
import { findEntityLocations } from '../../utils/entityLocationLookup';
import { placeFor } from '../JournalNextBest';
import { EntityLocations } from '../EntityLocations';
import { questLines, LineView, type Line } from './OsrsJournalQuests';
import { placesOf, blockerChunk } from './OsrsJournalDiaries';
import { SkillIcon, WikiTable, plural, type WikiRow } from './OsrsJournalParts';
import { compileJournalQuery, journalMatches, diaryTaskSearchFields } from './OsrsJournalSearch';

/**
 * The right half of the OSRS Journal window (board: Journal.dc.html): the
 * parchment journal scroll, the OSRS Wiki style Details table and the two
 * buttons, for whichever entry the list has selected. Every line reads the
 * entry's canonical eligibility; every button calls the classic log's own
 * handler (passed in by OsrsJournalScreen from the shared journal hooks).
 */

export type JournalSel =
  | { kind: 'quest'; id: string }
  | { kind: 'task'; id: string }
  | { kind: 'tier'; id: string }
  | { kind: 'caTask'; id: string }
  | { kind: 'caTier'; id: string };

export const selKey = (sel: JournalSel): string => `${sel.kind}:${sel.id}`;

export interface MapTarget { cx: number; cy: number; label: string }

/** "50% Key chance, or 1 Fate Point on a miss": `rate` is the chance the roll is made against (useSourceKeyChance). */
export const rollFact = (source: QuestData['difficulty'], rate: number, each = ''): string => {
  const fate = failureFateForSource(source);
  return `${rate}% Key chance${each}, or ${plural(fate, 'Fate Point')} on a miss`;
};

export const tasksOfTier = (() => {
  const map = new Map<string, DiaryTask[]>();
  for (const task of ALL_DIARY_TASKS) {
    if (!map.has(task.tierId)) map.set(task.tierId, []);
    map.get(task.tierId)!.push(task);
  }
  return (tierId: string): DiaryTask[] => map.get(tierId) ?? [];
})();

export const caPoints = (tierId: string): number => (isCATierId(tierId) ? CA_TASK_POINTS[tierId] : 0);
const caWiki = (name: string) => `https://oldschool.runescape.wiki/w/${encodeURIComponent(name.replace(/ /g, '_'))}`;

/* ── Map targets for "Show on map" (the board's second button). ───────────── */

export const questMapTarget = (quest: QuestData, unlocks: UnlockState, gameModeId?: string): MapTarget | null => {
  const loc = questLocations(quest.name, unlocks, gameModeId);
  const p = loc.startPlaces[0] ?? loc.places[0];
  return p ? { cx: p.cx, cy: p.cy, label: p.label } : null;
};

export const taskMapTarget = (task: DiaryTask, unlocks: UnlockState, gameModeId?: string): MapTarget | null =>
  placesOf(task, unlocks, gameModeId)[0] ?? null;

export const tierMapTarget = (tierId: string, unlocks: UnlockState): MapTarget | null => {
  const p = placeFor({ kind: 'diary', sub: 'DIARIES', id: tierId, name: tierId, unmet: 0, diffRank: 0 }, unlocks);
  return p ? { ...p, label: tierId } : null;
};

export const caTaskMapTarget = (task: CATask, unlocks: UnlockState, gameModeId?: string): MapTarget | null => {
  if (!chunkContentService.ready) return null;
  const hit = findEntityLocations(chunkContentService, task.monster, ['monster']);
  const place = hit ? summarisePlaces(hit.locations, unlocks, gameModeId)[0] : undefined;
  return place ? { cx: place.cx, cy: place.cy, label: place.label } : null;
};

/* ── The shared pane: scroll, Details, the two buttons. ───────────────────── */

export interface MainAction {
  label: string;
  title?: string;
  disabled?: boolean;
  /** Clickable, but drawn greyed out: the entry isn't ready yet. */
  muted?: boolean;
  onClick: (e: React.MouseEvent) => void;
}

const Pane: React.FC<{
  title: string;
  label: string;
  children: React.ReactNode;
  facts: WikiRow[];
  wiki: string;
  main: MainAction;
  map: MapTarget | null;
}> = ({ title, label, children, facts, wiki, main, map }) => (
  <div className="ojs-detail">
    <div className="ojs-detail-body">
      <div className="ojr-scroll ojs-scroll" aria-label={label}>
        <div className="ojr-scroll-title">{title}</div>
        {children}
      </div>
      <WikiTable href={wiki} rows={facts} />
    </div>
    <div className="ojs-actions">
      <button type="button" className={`ojs-btn is-main${main.muted ? ' is-muted' : ''}`} disabled={main.disabled} title={main.title} onClick={main.onClick}>
        {main.label}
      </button>
      <button
        type="button"
        className="ojs-btn"
        disabled={!map}
        title={map ? `Show ${map.label} on the map` : 'No map location'}
        onClick={() => map && showChunkOnMap(map.cx, map.cy)}
      >
        Show on map
      </button>
    </div>
  </div>
);

/* ── Quest ────────────────────────────────────────────────────────────────── */

export const QuestDetail: React.FC<{
  quest: QuestCardQuest;
  unlocks: UnlockState;
  gameModeId?: string;
  currentQP: number;
  wikiUrl: (name: string) => string;
  difficultyLabel: (quest: QuestData) => string;
  routeCheck?: string | null;
  onComplete: (e: React.MouseEvent, quest: QuestData) => void;
  onPrereqClick: (questId: string) => void;
  onSkillClick: (skill: string, required: number, current: number, rect: DOMRect) => void;
}> = ({ quest, unlocks, gameModeId, currentQP, wikiUrl, difficultyLabel, routeCheck, onComplete, onPrereqClick, onSkillClick }) => {
  const isCompleted = quest.status === 'COMPLETED';
  const isAvailable = !isCompleted && quest.eligibility.eligible;
  const needsConfirmation = !isCompleted && quest.eligibility.machineEligible && !quest.eligibility.eligible;
  const { game, fate, checks } = questLines(quest, unlocks, currentQP, onPrereqClick, onSkillClick);
  // The chance the roll is made against, the run's boosts included.
  const chanceOf = useSourceKeyChance();
  const rate = chanceOf(quest.difficulty);
  const loc = questLocations(quest.name, unlocks, gameModeId);
  const start = loc.startPlaces[0] ?? null;
  const map = questMapTarget(quest, unlocks, gameModeId);

  // The Fate Locked unlocks already met read as one struck line, as on the board.
  const fateMet = fate.filter(line => line.met).map(line => line.text);
  const fateLines: Line[] = [
    ...(fateMet.length > 0 ? [{ key: 'fate-met', text: `Fate Locked: ${joinAnd(fateMet)} unlocked`, met: true }] : []),
    ...fate.filter(line => !line.met).map(line => ({ ...line, text: `Fate Locked: ${line.text}` })),
  ];
  const need = [...game, ...fateLines];

  const facts: WikiRow[] = [
    { label: 'Official difficulty', value: difficultyLabel(quest) },
    quest.kind === 'quest' ? { label: 'Quest points', value: String(quest.points) } : { label: 'Type', value: 'Miniquest' },
  ];
  if (start) facts.push({ label: 'Start point', value: start.label });
  if (quest.series) facts.push({ label: 'Series', value: quest.series });
  if (routeCheck && !isCompleted) facts.push({ label: 'Route check', value: routeCheck });
  if (rate !== undefined) facts.push({ label: 'Fate Locked roll', value: rollFact(quest.difficulty, rate) });

  const main: MainAction = isCompleted
    ? { label: 'Completed', disabled: true, title: 'Completed', onClick: () => {} }
    : {
        label: isAvailable ? 'Complete and roll for a Key' : needsConfirmation ? 'Confirm and complete' : 'Not ready yet',
        muted: !isAvailable && !needsConfirmation,
        title: needsConfirmation ? 'Confirm & Complete' : 'Complete & Roll',
        onClick: (e) => onComplete(e, quest),
      };

  return (
    <Pane title={quest.name} label={`${quest.name} quest journal`} facts={facts} wiki={wikiUrl(quest.name)} main={main} map={map}>
      {isCompleted && <div className="ojs-red" style={{ textAlign: 'center' }}>QUEST COMPLETE!</div>}
      {!isCompleted && (
        <div>
          {start ? `I can start this quest at ${start.label}.`
            : isAvailable ? 'I can start this quest.'
            : "I can't start this quest yet."}
        </div>
      )}
      {need.length > 0 && <div className="ojr-gap">To start this quest I need:</div>}
      {need.map(line => <LineView key={line.key} line={line} />)}
      {checks.length > 0 && <div className="ojr-gap">I need to confirm:</div>}
      {checks.map(line => <LineView key={line.key} line={line} />)}
      {need.length === 0 && checks.length === 0 && <div className="ojr-gap">There are no requirements to start this quest.</div>}
      {!isCompleted && rate !== undefined && <div className="ojr-gap ojs-red">Completing it rolls once for a Key at {rate}%.</div>}
    </Pane>
  );
};

const joinAnd = (items: string[]): string =>
  items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

/* ── Diary task and tier ──────────────────────────────────────────────────── */

/** What still blocks a diary task, as links: skills open the training guide, places the map. */
const TaskNeeds: React.FC<{
  task: DiaryTask;
  unlocks: UnlockState;
  gameModeId?: string;
  areaRoutes?: AreaRoutes | null;
  onSkillClick: (skill: string, required: number, current: number, rect: DOMRect) => void;
}> = ({ task, unlocks, gameModeId, areaRoutes, onSkillClick }) => {
  const e = evaluateDiaryTaskEligibility(task, unlocks, gameModeId, areaRoutes);
  if (e.blockers.length === 0 && e.manualChecks.length === 0) return null;
  return (
    <div className="ojr-task-reqs">
      Needs:{' '}
      {e.blockers.map((b, i) => {
        const sep = i > 0 ? ', ' : '';
        if (b.kind === 'skill' && b.requirement?.type === 'single') {
          const { skill, level } = b.requirement;
          const current = effectiveSkillLevel(unlocks, skill);
          return <React.Fragment key={'b' + i}>{sep}<button type="button" className="ojr-link" title={`Training guide: ${skill}`}
            onClick={(ev) => onSkillClick(skill, level, current, ev.currentTarget.getBoundingClientRect())}>
            <SkillIcon skill={skill} />{skill} {level} (you are {current})</button></React.Fragment>;
        }
        const chunk = blockerChunk(b);
        const label = b.kind === 'alternative' && b.travel ? `a way to reach ${b.travel}` : b.label;
        return chunk
          ? <React.Fragment key={'b' + i}>{sep}<button type="button" className="ojr-link" title={`Show ${b.label} on the map`}
              onClick={() => showChunkOnMap(chunk.cx, chunk.cy)}>{label}</button></React.Fragment>
          : <React.Fragment key={'b' + i}>{sep}{label}</React.Fragment>;
      })}
      {formatDiaryChecks(e.manualChecks, task.description).map((check, i) => (
        <React.Fragment key={'m' + i}>{e.blockers.length + i > 0 ? '; ' : ''}{check}</React.Fragment>
      ))}
    </div>
  );
};

/** How many of the tier's tasks show around the selected one before "...and N more". */
const TASK_WINDOW = 6;

export const DiaryTaskDetail: React.FC<{
  task: DiaryTask;
  unlocks: UnlockState;
  gameModeId?: string;
  areaRoutes?: AreaRoutes | null;
  wikiUrl: (tierId: string) => string;
  onTaskComplete: (task: DiaryTask, e: React.MouseEvent) => void;
  onSkillClick: (skill: string, required: number, current: number, rect: DOMRect) => void;
  onSelect: (sel: JournalSel) => void;
}> = ({ task, unlocks, gameModeId, areaRoutes, wikiUrl, onTaskComplete, onSkillClick, onSelect }) => {
  const diary = DIARY_DATA[task.tierId];
  const tierDone = unlocks.diaries.includes(task.tierId);
  const tasks = tasksOfTier(task.tierId);
  const isDoneOf = (t: DiaryTask) => tierDone || unlocks.completedTasks.includes(t.id);
  const done = tasks.filter(isDoneOf).length;
  const isDone = isDoneOf(task);
  const ready = !isDone && evaluateDiaryTaskEligibility(task, unlocks, gameModeId, areaRoutes).eligible;
  // The chance the roll is made against, the run's boosts included.
  const chanceOf = useSourceKeyChance();
  const rate = diary ? chanceOf(diary.difficulty) : undefined;

  const at = Math.max(0, tasks.findIndex(t => t.id === task.id));
  const from = Math.max(0, Math.min(at - 2, tasks.length - TASK_WINDOW));
  const shown = tasks.slice(from, from + TASK_WINDOW);
  const more = tasks.length - shown.length;

  const facts: WikiRow[] = [{ label: 'Tier', value: `${task.tierId}, ${done}/${tasks.length} tasks done` }];
  const where = [...new Set([...(task.regions ?? []), ...(task.anyOfRegions ?? [])])];
  if (where.length > 0) facts.push({ label: 'Area', value: where.join(', ') });
  else if (diary) facts.push({ label: 'Area', value: diary.region });
  facts.push({ label: 'Status', value: isDone ? 'Done' : ready ? 'Doable now' : 'Not yet' });
  if (diary && rate !== undefined) facts.push({ label: 'Fate Locked roll', value: rollFact(diary.difficulty, rate, ' per task') });

  return (
    <Pane
      title={task.description}
      label={`${task.description}, ${task.tierId} diary task`}
      facts={facts}
      wiki={wikiUrl(task.tierId)}
      main={isDone
        ? { label: 'Completed', disabled: true, onClick: () => {} }
        : { label: ready ? 'Complete and roll for a Key' : 'Not ready yet', muted: !ready, onClick: (e) => onTaskComplete(task, e) }}
      map={taskMapTarget(task, unlocks, gameModeId)}
    >
      <div style={{ textAlign: 'center', marginTop: -6, marginBottom: 6 }}>
        <button type="button" className="ojr-link" title={`Show every ${task.tierId} task`} onClick={() => onSelect({ kind: 'tier', id: task.tierId })}>
          {task.tierId}
        </button>
      </div>
      {shown.map(t => {
        const tDone = isDoneOf(t);
        const sel = t.id === task.id;
        const tReady = !tDone && evaluateDiaryTaskEligibility(t, unlocks, gameModeId, areaRoutes).eligible;
        return (
          <div key={t.id} className={sel ? 'ojs-task is-sel' : 'ojs-task'}>
            <button
              type="button"
              className={`ojr-link ${tDone ? 'ojr-met' : tReady ? '' : 'ojs-red'}`}
              onClick={() => onSelect({ kind: 'task', id: t.id })}
            >
              {t.description}
            </button>
            {sel && !tDone && ready && <span className="ojs-red">{'  < ready now'}</span>}
            {sel && !tDone && !ready && <TaskNeeds task={t} unlocks={unlocks} gameModeId={gameModeId} areaRoutes={areaRoutes} onSkillClick={onSkillClick} />}
          </div>
        );
      })}
      {more > 0 && (
        <button type="button" className="ojr-link ojs-red ojs-small" onClick={() => onSelect({ kind: 'tier', id: task.tierId })}>
          ...and {more} more
        </button>
      )}
      {!isDone && rate !== undefined && <div className="ojr-gap ojs-red">Each task rolls once for a Key at {rate}%.</div>}
    </Pane>
  );
};

export const DiaryTierDetail: React.FC<{
  diary: DiaryTier & { status: string };
  unlocks: UnlockState;
  gameModeId?: string;
  areaRoutes?: AreaRoutes | null;
  searchTerm: string;
  wikiUrl: (tierId: string) => string;
  onTierComplete: (e: React.MouseEvent, diary: DiaryTier) => void;
  onTaskComplete: (task: DiaryTask, e: React.MouseEvent) => void;
  onSkillClick: (skill: string, required: number, current: number, rect: DOMRect) => void;
  onSelect: (sel: JournalSel) => void;
}> = ({ diary, unlocks, gameModeId, areaRoutes, searchTerm, wikiUrl, onTierComplete, onTaskComplete, onSkillClick, onSelect }) => {
  const tasks = tasksOfTier(diary.id);
  const isCompleted = diary.status === 'COMPLETED';
  const done = isCompleted ? tasks.length : tasks.filter(t => unlocks.completedTasks.includes(t.id)).length;
  const doable = isCompleted ? 0 : tasks.filter(t => !unlocks.completedTasks.includes(t.id)
    && evaluateDiaryTaskEligibility(t, unlocks, gameModeId, areaRoutes).eligible).length;
  const allTasksDone = tasks.length === 0 || done === tasks.length;
  const tier = evaluateDiaryTierEligibility(diary, unlocks, gameModeId, areaRoutes);
  // The chance the roll is made against, the run's boosts included.
  const chanceOf = useSourceKeyChance();
  const rate = chanceOf(diary.difficulty);
  // The Journal's search narrows the tier's tasks the way it narrows the list (OsrsJournalSearch).
  const query = compileJournalQuery(searchTerm);
  const shown = query ? tasks.filter(task => journalMatches(query, diaryTaskSearchFields(task))) : tasks;

  const facts: WikiRow[] = [
    { label: 'Tier', value: `${diary.id}, ${done}/${tasks.length} tasks done` },
    { label: 'Doable now', value: isCompleted ? 'Tier complete' : plural(doable, 'task') },
    {
      label: 'Tier requirements',
      value: tier.blockers.length === 0
        ? <span className="ojr-good">All met</span>
        : <span className="ojr-bad">{tier.blockers.map(b => b.label).join(', ')}</span>,
    },
  ];
  if (!isCompleted && tier.manualChecks.length > 0) facts.push({ label: 'Needs confirmation', value: tier.manualChecks.join(', ') });
  if (rate !== undefined) facts.push({ label: 'Fate Locked roll', value: rollFact(diary.difficulty, rate, ' per task') });

  return (
    <Pane
      title={diary.id}
      label={`${diary.id} diary journal`}
      facts={facts}
      wiki={wikiUrl(diary.id)}
      main={{
        label: isCompleted ? 'Tier complete' : 'Complete full section',
        disabled: isCompleted,
        title: isCompleted ? 'Completed' : allTasksDone ? 'Complete Full Section' : 'Complete all tasks first',
        onClick: (e) => onTierComplete(e, diary),
      }}
      map={tierMapTarget(diary.id, unlocks)}
    >
      {isCompleted && <div className="ojs-red" style={{ textAlign: 'center', marginBottom: 6 }}>DIARY TIER COMPLETE!</div>}
      {tasks.length === 0 && <div>No tasks are listed for this tier.</div>}
      {shown.map(task => {
        const taskDone = isCompleted || unlocks.completedTasks.includes(task.id);
        const ready = !taskDone && evaluateDiaryTaskEligibility(task, unlocks, gameModeId, areaRoutes).eligible;
        return (
          <div key={task.id} data-diary-task-row={task.id} className={`ojs-task ojs-task-row${ready ? ' is-ready' : ''}`}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <button type="button" className={`ojr-link ${taskDone ? 'ojr-met' : ready ? '' : 'ojs-red'}`} onClick={() => onSelect({ kind: 'task', id: task.id })}>
                {task.description}
              </button>
              {ready && <span className="ojs-red">{'  < ready now'}</span>}
              {!taskDone && !ready && <TaskNeeds task={task} unlocks={unlocks} gameModeId={gameModeId} areaRoutes={areaRoutes} onSkillClick={onSkillClick} />}
            </div>
            {!taskDone && (
              <button type="button" className="ojr-mini" aria-label={task.description ? `Complete diary task: ${task.description}` : 'Complete diary task'}
                onClick={(e) => onTaskComplete(task, e)}>
                Complete
              </button>
            )}
          </div>
        );
      })}
      {!isCompleted && rate !== undefined && tasks.length > 0 && <div className="ojr-gap ojs-red">Each task rolls once for a Key at {rate}%.</div>}
    </Pane>
  );
};

/* ── Combat Achievements ──────────────────────────────────────────────────── */

export const CATaskDetail: React.FC<{
  task: CATask;
  unlocks: UnlockState;
  gameModeId?: string;
  areaRoutes?: AreaRoutes | null;
  monsterWikiUrl: (monster: string) => string;
  onTaskComplete: (task: CATask, e: React.MouseEvent) => void;
  onSelect: (sel: JournalSel) => void;
}> = ({ task, unlocks, gameModeId, areaRoutes, monsterWikiUrl, onTaskComplete, onSelect }) => {
  const isDone = unlocks.completedTasks.includes(task.id);
  const blocker = caTaskBlocker(task, unlocks, gameModeId, areaRoutes);
  const tier = CA_DATA[task.tierId];
  // The chance the roll is made against, the run's boosts included.
  const chanceOf = useSourceKeyChance();
  const rate = tier ? chanceOf(tier.difficulty) : undefined;
  const facts: WikiRow[] = [
    { label: 'Tier', value: task.tierId },
    { label: 'Points', value: String(caPoints(task.tierId)) },
    { label: 'Monster', value: <a className="ojr-wlink" href={monsterWikiUrl(task.monster)} target="_blank" rel="noopener noreferrer">{task.monster}</a> },
  ];
  if (!isDone) facts.push({ label: 'Where', value: <EntityLocations name={task.monster} kinds={['monster']} cap={3} /> });
  if (tier && rate !== undefined) facts.push({ label: 'Fate Locked roll', value: rollFact(tier.difficulty, rate) });

  return (
    <Pane
      title={task.name ?? task.monster}
      label={`${task.name ?? task.monster} combat achievement`}
      facts={facts}
      wiki={task.name ? caWiki(task.name) : monsterWikiUrl(task.monster)}
      main={isDone
        ? { label: 'Completed', disabled: true, onClick: () => {} }
        : { label: 'Complete and roll for a Key', onClick: (e) => onTaskComplete(task, e) }}
      map={caTaskMapTarget(task, unlocks, gameModeId)}
    >
      {isDone && <div className="ojs-red" style={{ textAlign: 'center', marginBottom: 6 }}>TASK COMPLETE!</div>}
      <div className={isDone ? 'ojr-met' : undefined}>{task.description}</div>
      <div className="ojr-gap">
        {task.monster},{' '}
        <button type="button" className="ojr-link" onClick={() => onSelect({ kind: 'caTier', id: task.tierId })}>{task.tierId} tier</button>
        , {plural(caPoints(task.tierId), 'point')}.
      </div>
      {blocker && <div className="ojr-gap ojs-red">{caTaskBlockerText(blocker)} You can still log the task by hand.</div>}
      {!isDone && rate !== undefined && <div className="ojr-gap ojs-red">Completing it rolls once for a Key at {rate}%.</div>}
    </Pane>
  );
};

export const CATierDetail: React.FC<{
  tier: CATier;
  tasks: CATask[];
  unlocks: UnlockState;
  totalPoints: number;
  nextTier?: string;
  onTierComplete: (e: React.MouseEvent, tier: CATier) => void;
}> = ({ tier, tasks, unlocks, totalPoints, nextTier, onTierComplete }) => {
  const isRecorded = unlocks.cas.includes(tier.id);
  const isActionable = isRecorded || totalPoints >= tier.pointsRequired;
  const done = tasks.filter(t => unlocks.completedTasks.includes(t.id)).length;
  // The chance the roll is made against, the run's boosts included.
  const chanceOf = useSourceKeyChance();
  const rate = chanceOf(tier.difficulty);
  const facts: WikiRow[] = [
    { label: 'Tasks done', value: `${done}/${tasks.length}` },
    { label: 'Points per task', value: String(caPoints(tier.id)) },
    { label: 'Reward tier', value: `${tier.pointsRequired.toLocaleString()} cumulative points` },
    { label: 'Your points', value: <span className={totalPoints >= tier.pointsRequired ? 'ojr-good' : 'ojr-bad'}>{totalPoints.toLocaleString()}</span> },
  ];
  if (nextTier) facts.push({ label: 'Next reward', value: nextTier });
  if (rate !== undefined) facts.push({ label: 'Fate Locked roll', value: rollFact(tier.difficulty, rate, ' per task') });

  return (
    <Pane
      title={`${tier.id} Tier`}
      label={`${tier.id} Combat Achievements`}
      facts={facts}
      wiki="https://oldschool.runescape.wiki/w/Combat_Achievements"
      main={{
        label: isRecorded ? 'Reward tier recorded' : 'Record reward tier',
        disabled: isRecorded,
        title: isRecorded ? 'Reward tier recorded' : isActionable ? 'Record earned reward tier' : `Requires ${tier.pointsRequired} cumulative points`,
        onClick: (e) => onTierComplete(e, tier),
      }}
      map={null}
    >
      {isRecorded && <div className="ojs-red" style={{ textAlign: 'center', marginBottom: 6 }}>REWARD TIER RECORDED</div>}
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
      {rate !== undefined && <div className="ojr-gap ojs-red">Each task rolls once for a Key at {rate}%.</div>}
    </Pane>
  );
};
