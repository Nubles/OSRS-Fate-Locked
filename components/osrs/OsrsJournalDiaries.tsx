import React, { useEffect, useMemo } from 'react';
import type { DiaryTier } from '../../data/diaryData';
import { ALL_DIARY_TASKS, type DiaryTask } from '../../data/diaryTasks';
import type { UnlockState } from '../../types';
import type { AreaRoutes } from '../../utils/areaRoutes';
import { DROP_RATES } from '../../config/rules';
import { chunkForPlace, chunkUnlocked, showChunkOnMap } from '../../utils/chunkLocations';
import { effectiveSkillLevel } from '../../utils/slayerReach';
import {
  evaluateDiaryTaskEligibility, evaluateDiaryTierEligibility, type EligibilityBlocker,
} from '../../utils/journalStatus';
import { Legend, SkillIcon, WikiTable, plural, type WikiRow } from './OsrsJournalParts';

/**
 * Achievement Diaries in the OSRS layout: one line per area with the four
 * tiers as columns (green done, yellow started, red not started), as the
 * in-game diary list reads, and the selected tier's tasks as a journal
 * scroll. Selection is DiaryLog's own expanded tier, so the heatmap-style
 * jumps (Next best actions, the feed) land here too. Every button calls
 * DiaryLog's handlers.
 */

const TIERS = ['Easy', 'Medium', 'Hard', 'Elite'] as const;
const SHORT: Record<string, string> = { Easy: 'Easy', Medium: 'Med', Hard: 'Hard', Elite: 'Elite' };

export type OsrsDiaryEntry = DiaryTier & { status: string; eligible: boolean };

interface Props {
  diaries: OsrsDiaryEntry[];
  sortMode: string;
  unlocks: UnlockState;
  gameModeId?: string;
  areaRoutes?: AreaRoutes | null;
  searchTerm: string;
  selectedId: string | null;
  highlightedId: string | null;
  onSelect: (id: string) => void;
  wikiUrl: (tierId: string) => string;
  onTierComplete: (e: React.MouseEvent, diary: DiaryTier) => void;
  onTaskComplete: (task: DiaryTask, e: React.MouseEvent) => void;
  onSkillClick: (skill: string, required: number, current: number, rect: DOMRect) => void;
}

const tasksByTier = (() => {
  const map = new Map<string, DiaryTask[]>();
  for (const task of ALL_DIARY_TASKS) {
    if (!map.has(task.tierId)) map.set(task.tierId, []);
    map.get(task.tierId)!.push(task);
  }
  return map;
})();

interface TierView {
  diary: OsrsDiaryEntry;
  tasks: DiaryTask[];
  done: number;
  doable: number;
  complete: boolean;
}

const areaOf = (tierId: string): string => tierId.replace(/ (Easy|Medium|Hard|Elite)$/, '');

const toneOf = (view: TierView): string =>
  view.complete ? 'ojr-done' : view.done > 0 ? 'ojr-ready' : 'ojr-locked';

const tierExamine = (view: TierView): string => {
  const parts = [`${view.diary.id} diary.`, `${view.done}/${view.tasks.length} tasks done.`];
  if (view.diary.status === 'COMPLETED') parts.push('Complete.');
  else if (view.doable > 0) parts.push(`${plural(view.doable, 'task')} doable now.`);
  return parts.join(' ');
};

export const OsrsJournalDiaries: React.FC<Props> = ({
  diaries, sortMode, unlocks, gameModeId, areaRoutes, searchTerm, selectedId, highlightedId,
  onSelect, wikiUrl, onTierComplete, onTaskComplete, onSkillClick,
}) => {
  const views = useMemo(() => diaries.map((diary): TierView => {
    const tasks = tasksByTier.get(diary.id) ?? [];
    const isCompleted = diary.status === 'COMPLETED';
    const done = isCompleted ? tasks.length : tasks.filter(t => unlocks.completedTasks.includes(t.id)).length;
    const doable = isCompleted ? 0 : tasks.filter(t => !unlocks.completedTasks.includes(t.id)
      && evaluateDiaryTaskEligibility(t, unlocks, gameModeId, areaRoutes).eligible).length;
    return { diary, tasks, done, doable, complete: isCompleted || (tasks.length > 0 && done === tasks.length) };
  }), [diaries, unlocks, gameModeId, areaRoutes]);

  const byId = useMemo(() => new Map(views.map(view => [view.diary.id, view])), [views]);
  // The diary's own area name (Falador, not Asgarnia), as the game and DIARY_DATA ids read.
  const areas = useMemo(() => [...new Set(views.map(view => areaOf(view.diary.id)))].sort(), [views]);

  const selected = (selectedId ? byId.get(selectedId) : undefined)
    ?? views.find(view => view.doable > 0)
    ?? views[0]
    ?? null;

  // Keep the selected cell in view when a jump lands on it.
  useEffect(() => {
    if (!highlightedId) return;
    const el = document.querySelector<HTMLElement>(`.ojr-list [data-journal-id="${CSS.escape(highlightedId)}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlightedId]);

  const totalDone = views.reduce((sum, view) => sum + view.done, 0);
  const totalTasks = views.reduce((sum, view) => sum + view.tasks.length, 0);

  const cell = (view: TierView, label: string) => (
    <button
      key={view.diary.id}
      type="button"
      className={`ojr-dcell ${toneOf(view)}${highlightedId === view.diary.id ? ' is-flash' : ''}`}
      data-journal-id={view.diary.id}
      data-examine={tierExamine(view)}
      data-examine-name={view.diary.id}
      aria-current={selected?.diary.id === view.diary.id ? 'true' : undefined}
      aria-label={`${view.diary.id}: ${view.done} of ${view.tasks.length} tasks done`}
      onClick={() => onSelect(view.diary.id)}
    >
      {label}
    </button>
  );

  return (
    <div className="ojr-split">
      <div className="ojr-list">
        <div className="ojr-topline"><span>Achievement Diaries</span><span>{totalDone}/{totalTasks} tasks</span></div>
        <div className="ojr-list-scroll">
          {sortMode === 'PROGRESS' ? (
            // "Closest first": one line per tier, in DiaryLog's order.
            views.map(view => (
              <button
                key={view.diary.id}
                type="button"
                className={`ojr-row ${toneOf(view)}${highlightedId === view.diary.id ? ' is-flash' : ''}`}
                data-journal-id={view.diary.id}
                data-examine={tierExamine(view)}
                data-examine-name={view.diary.id}
                aria-current={selected?.diary.id === view.diary.id ? 'true' : undefined}
                onClick={() => onSelect(view.diary.id)}
              >
                <span className="ojr-row-name">{view.diary.id}</span>
                <span className="ojr-row-key">{view.done}/{view.tasks.length}{view.doable > 0 ? ` · ${view.doable} now` : ''}</span>
              </button>
            ))
          ) : (
            <>
              <div className="ojr-dgrid">
                <span />
                {TIERS.map(tier => <span key={tier} className="ojr-dhdr">{SHORT[tier]}</span>)}
              </div>
              {areas.map(area => (
                <div key={area} className="ojr-dgrid">
                  <span className="ojr-darea">{area}</span>
                  {TIERS.map(tier => {
                    const view = byId.get(`${area} ${tier}`);
                    return view ? cell(view, `${view.done}/${view.tasks.length}`) : <span key={tier} />;
                  })}
                </div>
              ))}
            </>
          )}
          {views.length === 0 && <div className="ojr-empty">No diaries found matching filter.</div>}
        </div>
        <Legend items={[
          { label: 'Done', cls: 'ojr-done' },
          { label: 'Started', cls: 'ojr-ready' },
          { label: 'Not started', cls: 'ojr-locked' },
        ]} />
      </div>

      {selected
        ? <DiaryDetail
            key={selected.diary.id}
            view={selected}
            unlocks={unlocks}
            gameModeId={gameModeId}
            areaRoutes={areaRoutes}
            searchTerm={searchTerm}
            wikiUrl={wikiUrl}
            onTierComplete={onTierComplete}
            onTaskComplete={onTaskComplete}
            onSkillClick={onSkillClick}
          />
        : <div className="ojr-detail" />}
    </div>
  );
};

/** Where a task happens, as map links: its areas, and a chunk of each place. */
const placesOf = (task: DiaryTask, unlocks: UnlockState, gameModeId?: string) => {
  const out: Array<{ label: string; cx: number; cy: number }> = [];
  const seen = new Set<string>();
  const regions = [...new Set([
    ...(task.regions ?? []), ...(task.anyOfRegions ?? []), ...(task.oneOf ?? []).flatMap(option => option.regions ?? []),
  ])];
  for (const region of regions) {
    const chunk = chunkForPlace(region);
    if (chunk && !seen.has(region)) { seen.add(region); out.push({ label: region, ...chunk }); }
  }
  for (const location of [task, ...(task.oneOf ?? [])].flatMap(requirement => requirement.locations ?? [])) {
    if (seen.has(location.label) || location.chunkOptions.length === 0) continue;
    seen.add(location.label);
    const target = location.chunkOptions.find(({ cx, cy }) => !chunkUnlocked(cx, cy, unlocks, gameModeId)) ?? location.chunkOptions[0];
    out.push({ label: location.label, ...target });
  }
  return out;
};

const blockerChunk = (b: EligibilityBlocker): { cx: number; cy: number } | null => {
  if (b.kind === 'region') return b.chunk ?? b.location?.chunks[0] ?? chunkForPlace(b.label);
  if (b.kind === 'alternative' && b.travel) return chunkForPlace(b.travel);
  return null;
};

const DiaryDetail: React.FC<{
  view: TierView;
  unlocks: UnlockState;
  gameModeId?: string;
  areaRoutes?: AreaRoutes | null;
  searchTerm: string;
  wikiUrl: Props['wikiUrl'];
  onTierComplete: Props['onTierComplete'];
  onTaskComplete: Props['onTaskComplete'];
  onSkillClick: Props['onSkillClick'];
}> = ({ view, unlocks, gameModeId, areaRoutes, searchTerm, wikiUrl, onTierComplete, onTaskComplete, onSkillClick }) => {
  const { diary, tasks } = view;
  const isCompleted = diary.status === 'COMPLETED';
  const allTasksDone = tasks.length === 0 || view.done === tasks.length;
  const isActionable = isCompleted || allTasksDone;
  const tier = evaluateDiaryTierEligibility(diary, unlocks, gameModeId, areaRoutes);
  const rate = DROP_RATES[diary.difficulty];
  const term = searchTerm.toLowerCase();
  const shown = term && !diary.id.toLowerCase().includes(term)
    ? tasks.filter(task => task.description.toLowerCase().includes(term))
    : tasks;

  const rows: WikiRow[] = [
    { label: 'Tier', value: `${diary.id}, ${view.done}/${tasks.length} tasks done` },
    { label: 'Doable now', value: isCompleted ? 'Tier complete' : plural(view.doable, 'task') },
    {
      label: 'Tier requirements',
      value: tier.blockers.length === 0
        ? <span className="ojr-good">All met</span>
        : <span className="ojr-bad">{tier.blockers.map(b => b.label).join(', ')}</span>,
    },
  ];
  if (!isCompleted && tier.manualChecks.length > 0) rows.push({ label: 'Needs confirmation', value: tier.manualChecks.join(', ') });
  if (rate !== undefined) rows.push({ label: 'Fate Locked roll', value: `${rate}% base Key chance per task` });

  return (
    <div className="ojr-detail">
      <div className="ojr-scroll" aria-label={`${diary.id} diary journal`}>
        <div className="ojr-scroll-title">{diary.id}</div>
        {isCompleted && <div className="ojr-red" style={{ textAlign: 'center', marginBottom: 6 }}>DIARY TIER COMPLETE!</div>}
        {tasks.length === 0 && <div>No tasks are listed for this tier.</div>}
        {shown.map(task => {
          const isTaskDone = unlocks.completedTasks.includes(task.id);
          const done = isCompleted || isTaskDone;
          const eligibility = done ? null : evaluateDiaryTaskEligibility(task, unlocks, gameModeId, areaRoutes);
          const ready = !!eligibility?.eligible;
          const places = done ? [] : placesOf(task, unlocks, gameModeId);
          const examine = done ? `${diary.id} task. Done.`
            : ready ? `${diary.id} task. Doable now.`
            : eligibility?.blockers[0] ? `${diary.id} task. Missing: ${eligibility.blockers[0].label}.`
            : `${diary.id} task. Needs confirmation: ${eligibility?.manualChecks[0] ?? ''}.`;
          return (
            <div
              key={task.id}
              data-diary-task-row={task.id}
              data-examine={examine}
              data-examine-name={task.description}
              className={`ojr-task${ready ? ' is-ready' : ''}`}
            >
              <div className="ojr-task-body">
                <div className={done ? 'ojr-met' : ready ? undefined : 'ojr-red'}>
                  {task.description}
                  {ready && <span className="ojr-note"> &lt; can do now</span>}
                </div>
                {eligibility && !ready && (eligibility.blockers.length > 0 || eligibility.manualChecks.length > 0) && (
                  <div className="ojr-task-reqs">
                    Needs:{' '}
                    {eligibility.blockers.map((b, i) => {
                      const sep = i > 0 ? ', ' : '';
                      if (b.kind === 'skill' && b.requirement?.type === 'single') {
                        const { skill, level } = b.requirement;
                        const current = effectiveSkillLevel(unlocks, skill);
                        return <React.Fragment key={'b' + i}>{sep}<button type="button" className="ojr-link" title={`Training guide: ${skill}`}
                          onClick={(e) => onSkillClick(skill, level, current, e.currentTarget.getBoundingClientRect())}>
                          <SkillIcon skill={skill} />{skill} {level} (you are {current})</button></React.Fragment>;
                      }
                      const chunk = blockerChunk(b);
                      const label = b.kind === 'alternative' && b.travel ? `a way to reach ${b.travel}` : b.label;
                      return chunk
                        ? <React.Fragment key={'b' + i}>{sep}<button type="button" className="ojr-link" title={`Show ${b.label} on the map`}
                            onClick={() => showChunkOnMap(chunk.cx, chunk.cy)}>{label}</button></React.Fragment>
                        : <React.Fragment key={'b' + i}>{sep}{label}</React.Fragment>;
                    })}
                    {eligibility.manualChecks.map((check, i) => (
                      <React.Fragment key={'m' + i}>{eligibility.blockers.length + i > 0 ? ', ' : ''}confirm {check}</React.Fragment>
                    ))}
                  </div>
                )}
                {places.length > 0 && (
                  <div className="ojr-task-reqs" style={{ color: '#000080' }}>
                    Map:{' '}
                    {places.map((place, i) => (
                      <React.Fragment key={place.label}>{i > 0 ? ', ' : ''}<button type="button" className="ojr-link" style={{ color: '#000080' }}
                        aria-label={`Show ${place.label} on the map`} onClick={() => showChunkOnMap(place.cx, place.cy)}>{place.label}</button></React.Fragment>
                    ))}
                  </div>
                )}
              </div>
              {!done && (
                <button
                  type="button"
                  className="ojr-mini"
                  aria-label={task.description ? `Complete diary task: ${task.description}` : 'Complete diary task'}
                  onClick={(e) => onTaskComplete(task, e)}
                >
                  Complete
                </button>
              )}
            </div>
          );
        })}
        {!isCompleted && rate !== undefined && tasks.length > 0 && (
          <div className="ojr-gap ojr-red">Each task rolls once for a Key at {rate}% base chance.</div>
        )}
      </div>

      <WikiTable href={wikiUrl(diary.id)} rows={rows} />

      <div className="ojr-actions">
        <button
          type="button"
          className="ojr-bigbtn is-main"
          disabled={isCompleted}
          title={isCompleted ? 'Completed' : isActionable ? 'Complete Full Section' : 'Complete all tasks first'}
          onClick={(e) => onTierComplete(e, diary)}
        >
          {isCompleted ? 'Tier complete' : 'Complete full section'}
        </button>
      </div>
    </div>
  );
};

export default OsrsJournalDiaries;
