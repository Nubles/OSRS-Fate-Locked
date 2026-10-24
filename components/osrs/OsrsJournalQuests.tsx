import React, { useEffect, useMemo, useState } from 'react';
import type { QuestData } from '../../data/questData';
import type { QuestCardQuest } from '../QuestLog';
import type { UnlockState } from '../../types';
import { useSourceKeyChance } from '../../hooks/useSourceKeyChance';
import { questLocations } from '../../utils/questLocations';
import { chunkForPlace, showChunkOnMap } from '../../utils/chunkLocations';
import { enforcedQuestAreas } from '../../utils/questGeographyDisplay';
import { effectiveSkillLevel } from '../../utils/slayerReach';
import { withSkillGateQuests, type EligibilityBlocker } from '../../utils/journalStatus';
import { Legend, SkillIcon, WikiTable, plural, type WikiRow } from './OsrsJournalParts';

/**
 * The Quest Journal in the OSRS layout: the in-game quest list on the left
 * (red not yet, yellow can do now, green done) and, for the selected quest,
 * the quest journal scroll plus OSRS Wiki style details on the right. Every
 * line is read from the quest's canonical eligibility (met requirements are
 * struck through, as in game); every button calls QuestLog's own handlers.
 */

export interface OsrsQuestSection { key: string; title: string; entries: QuestCardQuest[] }

interface Props {
  sections: OsrsQuestSection[];
  unlocks: UnlockState;
  gameModeId?: string;
  currentQP: number;
  maxQP: number;
  highlightedId: string | null;
  wikiUrl: (name: string) => string;
  difficultyLabel: (quest: QuestData) => string;
  onComplete: (e: React.MouseEvent, quest: QuestData) => void;
  onPrereqClick: (questId: string) => void;
  onSkillClick: (skill: string, required: number, current: number, rect: DOMRect) => void;
}

type Tone = 'done' | 'ready' | 'locked';

const toneOf = (quest: QuestCardQuest): Tone =>
  quest.status === 'COMPLETED' ? 'done' : quest.eligibility.eligible ? 'ready' : 'locked';

const TONE_CLASS: Record<Tone, string> = { done: 'ojr-done', ready: 'ojr-ready', locked: 'ojr-locked' };

/** Factual examine text for the right-click menu. */
export const questExamine = (quest: QuestCardQuest, difficulty: string): string => {
  const kind = quest.kind === 'miniquest' ? 'Miniquest' : `${difficulty} quest`;
  const points = quest.kind === 'quest' ? ` ${plural(quest.points, 'quest point')}.` : '';
  const e = quest.eligibility;
  const state = quest.status === 'COMPLETED' ? 'Completed.'
    : e.eligible ? 'Ready to start.'
    : e.machineEligible ? `Needs confirmation: ${e.manualChecks[0]}.`
    : e.blockers.length === 1 ? `Missing: ${e.blockers[0].label}.`
    : `Missing ${e.blockers.length} requirements, first ${e.blockers[0]?.label}.`;
  return `${kind}.${points} ${state}`;
};

export interface Line {
  key: string;
  text: string;
  met: boolean;
  icon?: string;
  note?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  title?: string;
}

const isTravel = (b: EligibilityBlocker): b is Extract<EligibilityBlocker, { kind: 'alternative' }> =>
  b.kind === 'alternative' && b.travel !== undefined;

const chunkOfBlocker = (b: EligibilityBlocker): { cx: number; cy: number } | null => {
  if (b.kind === 'region') return b.chunk ?? b.location?.chunks[0] ?? chunkForPlace(b.label);
  if (b.kind === 'alternative' && b.travel) return chunkForPlace(b.travel);
  return null;
};

/** The journal's requirement lines: quests and levels, then the Fate Locked unlocks. */
export const questLines = (
  quest: QuestCardQuest,
  unlocks: UnlockState,
  currentQP: number,
  onPrereqClick: Props['onPrereqClick'],
  onSkillClick: Props['onSkillClick'],
): { game: Line[]; fate: Line[]; checks: Line[] } => {
  const prereqs = withSkillGateQuests(quest.prereqs, quest.skills, quest.id);
  const skills = Object.entries(quest.skills as Record<string, number>);
  const game: Line[] = [];
  const fate: Line[] = [];
  const checks: Line[] = [];

  if (quest.status === 'COMPLETED') {
    prereqs.forEach(id => game.push({ key: 'q:' + id, text: id, met: true }));
    skills.forEach(([skill, level]) => game.push(skill === 'Quest Points'
      ? { key: 's:' + skill, text: `${level} Quest Points`, met: true }
      : { key: 's:' + skill, text: `Level ${level} ${skill}`, met: true, icon: skill }));
    if (quest.combatLevel !== undefined) game.push({ key: 'combat', text: `Combat level ${quest.combatLevel}`, met: true });
    enforcedQuestAreas(quest).forEach(area => fate.push({ key: 'a:' + area, text: area, met: true }));
    return { game, fate, checks };
  }

  const { evidence, blockers, manualChecks } = quest.eligibility;
  const used = new Set<string>();
  const usedBlockers = new Set<EligibilityBlocker>();

  for (const id of prereqs) {
    if (evidence.includes(id)) { used.add(id); game.push({ key: 'q:' + id, text: id, met: true }); continue; }
    const blocker = blockers.find(b => b.kind === 'quest' && b.label === id);
    if (blocker) usedBlockers.add(blocker);
    game.push({
      key: 'q:' + id, text: id, met: false,
      title: `Jump to ${id} in the list`,
      onClick: () => onPrereqClick(id),
    });
  }
  for (const [skill, level] of skills) {
    const label = `${skill} ${level}`;
    if (skill === 'Quest Points') {
      const met = evidence.includes(label);
      if (met) used.add(label);
      const blocker = blockers.find(b => b.kind === 'quest' && b.label === label);
      if (blocker) usedBlockers.add(blocker);
      game.push({ key: 's:' + skill, text: `${level} Quest Points`, met, note: met ? undefined : `(you have ${currentQP})` });
      continue;
    }
    if (evidence.includes(label)) { used.add(label); game.push({ key: 's:' + skill, text: `Level ${level} ${skill}`, met: true, icon: skill }); continue; }
    const blocker = blockers.find(b => b.kind === 'skill' && b.requirement?.type === 'single' && b.requirement.skill === skill);
    // Accepted alternative route: the confirmation below replaces the level.
    if (!blocker) continue;
    usedBlockers.add(blocker);
    const current = effectiveSkillLevel(unlocks, skill);
    const locked = (unlocks.skills[skill] || 0) === 0;
    game.push({
      key: 's:' + skill, text: `Level ${level} ${skill}`, met: false, icon: skill,
      note: locked ? '(skill locked)' : `(you are ${current})`,
      title: blocker.label === label ? `Training guide: ${skill}` : blocker.label,
      onClick: (e) => onSkillClick(skill, level, current, e.currentTarget.getBoundingClientRect()),
    });
  }
  if (quest.combatLevel !== undefined) {
    const label = 'Combat level ' + quest.combatLevel;
    const met = evidence.includes(label);
    if (met) used.add(label);
    const blocker = blockers.find(b => b.kind === 'combat');
    if (blocker) usedBlockers.add(blocker);
    game.push({ key: 'combat', text: label, met });
  }

  evidence.filter(item => !used.has(item)).forEach(item => fate.push({ key: 'e:' + item, text: item, met: true }));
  blockers.filter(b => !usedBlockers.has(b)).forEach((b, i) => {
    const chunk = chunkOfBlocker(b);
    fate.push({
      key: `b:${i}:${b.label}`,
      text: isTravel(b) ? `A way to reach ${b.travel}` : b.label,
      met: false,
      note: isTravel(b) ? '(owned, but no route reaches it)' : undefined,
      title: chunk ? `Show ${b.label} on the map` : undefined,
      onClick: chunk ? () => showChunkOnMap(chunk.cx, chunk.cy) : undefined,
    });
  });
  manualChecks.forEach(check => checks.push({ key: 'm:' + check, text: check, met: false, note: '(confirm before completing)' }));
  return { game, fate, checks };
};

export const LineView: React.FC<{ line: Line }> = ({ line }) => {
  const body = (
    <>
      {line.icon && <SkillIcon skill={line.icon} />}
      <span className={line.met ? 'ojr-met' : undefined}>{line.text}</span>
      {line.note && <span className="ojr-note"> {line.note}</span>}
    </>
  );
  if (line.onClick && !line.met) {
    return <div><button type="button" className="ojr-link" title={line.title} onClick={line.onClick}>{body}</button></div>;
  }
  return <div>{body}</div>;
};

export const OsrsJournalQuests: React.FC<Props> = ({
  sections, unlocks, gameModeId, currentQP, maxQP, highlightedId,
  wikiUrl, difficultyLabel, onComplete, onPrereqClick, onSkillClick,
}) => {
  const visible = useMemo(() => sections.flatMap(section => section.entries), [sections]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Jumps from a prerequisite, Next best actions or the feed select the quest.
  useEffect(() => { if (highlightedId) setSelectedId(highlightedId); }, [highlightedId]);

  const selected = visible.find(q => q.id === selectedId)
    ?? visible.find(q => toneOf(q) === 'ready')
    ?? visible[0]
    ?? null;

  return (
    <div className="ojr-split">
      <div className="ojr-list">
        <div className="ojr-topline"><span>Quest Points:</span><span>{currentQP}/{maxQP}</span></div>
        <div className="ojr-list-scroll" role="group" aria-label="Quest list">
          {sections.map(section => section.entries.length > 0 && (
            <React.Fragment key={section.key}>
              <div className="ojr-head" role="presentation">
                {section.title}
                <span className="ojr-count">
                  {section.entries.filter(q => q.status === 'COMPLETED').length}/{section.entries.length}
                </span>
              </div>
              {section.entries.map(quest => {
                const tone = toneOf(quest);
                const isSel = selected?.id === quest.id;
                return (
                  <button
                    key={quest.id}
                    type="button"
                    data-journal-id={quest.id}
                    data-examine={questExamine(quest, difficultyLabel(quest))}
                    data-examine-name={quest.name}
                    aria-current={isSel ? 'true' : undefined}
                    className={`ojr-row ${TONE_CLASS[tone]}${highlightedId === quest.id ? ' is-flash' : ''}`}
                    onClick={() => setSelectedId(quest.id)}
                  >
                    <span className="ojr-row-name">{quest.name}</span>
                  </button>
                );
              })}
            </React.Fragment>
          ))}
          {visible.length === 0 && <div className="ojr-empty">No quests found matching filter.</div>}
        </div>
        <Legend items={[
          { label: 'Done', cls: 'ojr-done' },
          { label: 'Can do now', cls: 'ojr-ready' },
          { label: 'Not yet', cls: 'ojr-locked' },
        ]} />
      </div>

      {selected
        ? <QuestDetail
            key={selected.id}
            quest={selected}
            unlocks={unlocks}
            gameModeId={gameModeId}
            currentQP={currentQP}
            wikiUrl={wikiUrl}
            difficultyLabel={difficultyLabel}
            onComplete={onComplete}
            onPrereqClick={onPrereqClick}
            onSkillClick={onSkillClick}
          />
        : <div className="ojr-detail" />}
    </div>
  );
};

const QuestDetail: React.FC<{
  quest: QuestCardQuest;
  unlocks: UnlockState;
  gameModeId?: string;
  currentQP: number;
  wikiUrl: Props['wikiUrl'];
  difficultyLabel: Props['difficultyLabel'];
  onComplete: Props['onComplete'];
  onPrereqClick: Props['onPrereqClick'];
  onSkillClick: Props['onSkillClick'];
}> = ({ quest, unlocks, gameModeId, currentQP, wikiUrl, difficultyLabel, onComplete, onPrereqClick, onSkillClick }) => {
  const isCompleted = quest.status === 'COMPLETED';
  const isAvailable = !isCompleted && quest.eligibility.eligible;
  const needsConfirmation = !isCompleted && quest.eligibility.machineEligible && !quest.eligibility.eligible;
  const { game, fate, checks } = questLines(quest, unlocks, currentQP, onPrereqClick, onSkillClick);
  const all = [...game, ...fate, ...checks];
  const metCount = all.filter(line => line.met).length;
  // The chance the roll is made against, the run's boosts included.
  const chanceOf = useSourceKeyChance();
  const rate = chanceOf(quest.difficulty);

  const loc = questLocations(quest.name, unlocks, gameModeId);
  const start = loc.startPlaces[0] ?? loc.places[0] ?? null;

  const rows: WikiRow[] = [
    { label: 'Official difficulty', value: difficultyLabel(quest) },
    quest.kind === 'quest'
      ? { label: 'Quest points', value: String(quest.points) }
      : { label: 'Type', value: 'Miniquest' },
  ];
  if (quest.series) rows.push({ label: 'Series', value: quest.series });
  if (loc.startPlaces[0]) rows.push({ label: 'Start point', value: loc.startPlaces[0].label });
  if (all.length > 0) {
    rows.push({
      label: 'Requirements met',
      value: isCompleted ? 'Quest complete' : <span className={metCount === all.length ? 'ojr-good' : 'ojr-bad'}>{metCount}/{all.length}</span>,
    });
  }
  if (rate !== undefined) rows.push({ label: 'Fate Locked roll', value: `${rate}% Key chance on completion` });

  const mainLabel = isCompleted ? 'Completed' : needsConfirmation ? 'Confirm and complete' : 'Complete and roll for a Key';
  const mainTitle = isCompleted ? 'Completed' : needsConfirmation ? 'Confirm & Complete' : 'Complete & Roll';

  return (
    <div className="ojr-detail">
      <div className="ojr-scroll" aria-label={`${quest.name} quest journal`}>
        <div className="ojr-scroll-title">{quest.name}</div>
        {isCompleted
          ? <div className="ojr-red">QUEST COMPLETE!</div>
          : <div>{isAvailable ? 'I can start this quest.'
              : needsConfirmation ? 'I can start this quest once I confirm the checks below.'
              : "I can't start this quest yet."}</div>}
        {game.length > 0 && <div className="ojr-gap">To start this quest I need:</div>}
        {game.map(line => <LineView key={line.key} line={line} />)}
        {fate.length > 0 && <div className="ojr-gap">Fate Locked also needs:</div>}
        {fate.map(line => <LineView key={line.key} line={line} />)}
        {checks.length > 0 && <div className="ojr-gap">I need to confirm:</div>}
        {checks.map(line => <LineView key={line.key} line={line} />)}
        {all.length === 0 && <div className="ojr-gap">There are no requirements to start this quest.</div>}
        {!isCompleted && rate !== undefined && (
          <div className="ojr-gap ojr-red">Completing it rolls once for a Key at {rate}% base chance.</div>
        )}
      </div>

      <WikiTable href={wikiUrl(quest.name)} rows={rows} />

      <div className="ojr-actions">
        <button
          type="button"
          className="ojr-bigbtn is-main"
          disabled={isCompleted}
          title={mainTitle}
          onClick={(e) => onComplete(e, quest)}
        >
          {mainLabel}
        </button>
        <button
          type="button"
          className="ojr-bigbtn"
          disabled={!start}
          title={start ? `Show ${start.label} on the map` : 'No map location'}
          onClick={() => start && showChunkOnMap(start.cx, start.cy)}
        >
          Show on map
        </button>
      </div>
    </div>
  );
};

export default OsrsJournalQuests;
