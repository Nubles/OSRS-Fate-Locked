// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { questWalkthroughFor } from '../../data/questWalkthroughs';
import { questWalkthroughFor as publicWalkthroughFor, questStrategyFor as publicStrategyFor } from '../../data/questWalkthroughs.public';
import { questStrategyFor } from '../../data/questWalkthroughs.preview-boundary';
import { analyzeQuest, type QuestRouteAnalysis, type QuestRouteAnalysisSnapshot } from '../../utils/questRoutes/analyzeQuest';
import { buildRuneProofCoachModel } from '../../utils/questStrategies/coach';
import { RuneProofCoach } from '../questStrategies/RuneProofCoach';
import { QuestRoutePanel } from './QuestRoutePanel';

afterEach(cleanup);

const label = 'Neck T1: Wear the ghostspeak amulet to speak to the ghost';
const definition = questWalkthroughFor('The Restless Ghost')!;
const analysis: QuestRouteAnalysis = {
  questId: definition.questId,
  status: 'CANNOT_COMPLETE_YET',
  equipmentBlockers: [{ kind: 'equipment', slot: 'Neck', tier: 1, label }],
  items: [],
  walkthrough: {
    questId: definition.questId, status: 'READY', releaseStatus: definition.releaseStatus,
    actions: [], blockers: [], hasIncompleteEvidence: false,
    source: definition.source, sourceLines: definition.sourceLines,
  },
  generatedFrom: {
    chunkDataVersion: 1, questRevision: definition.source.wikiRevision,
    accountFingerprint: 'locked-neck', walkthroughRevision: definition.revision,
  },
};

describe('RuneProof equipment blocker presentation', () => {
  it('gates the reviewed wear action while allowing the amulet to be obtained first', () => {
    const walkthrough = publicWalkthroughFor('The Restless Ghost')!;
    const strategy = publicStrategyFor('The Restless Ghost')!;
    const snapshot = (neck: number): QuestRouteAnalysisSnapshot => ({
      gameModeId: 'chunked', chunkDataVersion: 1,
      unlockedChunks: ['50,50', '49,49', '50,49', '48,49'],
      unlocks: {
        equipment: { Neck: neck }, skills: {}, levels: {}, regions: [],
        chunks: ['49,49', '50,49', '48,49'], quests: [], guilds: [], merchants: [],
        minigames: [], mobility: [], slayerUnlocks: [],
      },
      itemSourceRecords: [], recipes: [], entityLocations: [], stationRequirements: [],
      sourceCoverage: [], connectGraph: {},
    });
    const locked = analyzeQuest(walkthrough.questId, snapshot(0), walkthrough);
    const coach = (route: QuestRouteAnalysis, confirmed: string[]) => buildRuneProofCoachModel({
      strategy, analysis: route, confirmedActionIds: new Set(confirmed),
      confirmedItemKeys: new Set(), completedQuestIds: new Set(),
    });
    const start = 'the-restless-ghost:start-with-aereck';
    const getAmulet = 'the-restless-ghost:get-amulet';
    const wear = 'the-restless-ghost:talk-to-ghost';
    expect(coach(locked, []).nextAction).toMatchObject({ id: start, state: 'DO_NOW', confirmationAllowed: true });
    expect(coach(locked, [start]).nextAction).toMatchObject({ id: getAmulet, state: 'DO_NOW', confirmationAllowed: true });
    expect(locked.walkthrough.actions.find(action => action.definition.id === wear)).toMatchObject({
      state: 'REQUIREMENT_MISSING',
      blockers: [expect.objectContaining({ kind: 'GATE', gate: expect.objectContaining({ type: 'EQUIPMENT', slot: 'Neck', tier: 1 }) })],
    });
    const blockedCoach = coach(locked, [start, getAmulet]);
    expect(blockedCoach.nextAction).toMatchObject({ id: wear, state: 'BLOCKED', confirmationAllowed: false });
    expect(blockedCoach.nextAction?.blockerText).toMatch(/Neck T1.*ghostspeak/i);
    render(<QuestRoutePanel questId={definition.questId} analysis={locked}
      checklistRows={[]} confirmedItemKeys={new Set()} onSetItemConfirmed={() => undefined} />);
    expect(screen.getByText('1 known blocker')).toBeTruthy();
    const unlocked = analyzeQuest(walkthrough.questId, snapshot(1), walkthrough);
    expect(unlocked.walkthrough.actions.find(action => action.definition.id === wear)).toMatchObject({ state: 'READY_HERE', blockers: [] });
    expect(coach(unlocked, [start, getAmulet]).nextAction).toMatchObject({ id: wear, state: 'DO_NOW', confirmationAllowed: true });
  });

  it('explains the required slot even with every item confirmed and the walkthrough hidden', () => {
    render(<QuestRoutePanel questId={definition.questId} analysis={analysis}
      checklistRows={[]} confirmedItemKeys={new Set(['ghostspeak amulet'])}
      walkthroughVisible={false} onSetItemConfirmed={() => undefined} />);
    expect(screen.getByRole('heading', { name: 'Cannot complete yet' })).toBeTruthy();
    expect(within(screen.getByRole('list', { name: 'Required equipment unlocks' })).getByText(label)).toBeTruthy();
    expect(screen.getByText('1 known blocker')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Ready now' })).toBeNull();
  });

  it('explains and blocks final coach completion while retaining earlier progress', () => {
    const strategy = questStrategyFor(definition.questId)!;
    const finish = strategy.actions.find(action => action.coach.completion.kind === 'QUEST_COMPLETED')!;
    const confirmedActionIds = new Set(strategy.actions.filter(action => action.id !== finish.id).map(action => action.id));
    const input = {
      strategy, analysis, confirmedActionIds,
      confirmedItemKeys: new Set<string>(), completedQuestIds: new Set<string>(),
    };
    const model = buildRuneProofCoachModel(input);
    expect(buildRuneProofCoachModel({ ...input, confirmedActionIds: new Set() }).recommendationReason)
      .toBe('This quest needs an equipment unlock before it can be completed.');
    expect(model.nextAction).toMatchObject({
      id: finish.id, state: 'BLOCKED', blockerText: label, confirmationAllowed: false,
    });
    expect(model.progress.completed).toBe(strategy.actions.length - 1);
    render(<RuneProofCoach model={model} onConfirmAction={() => undefined} />);
    const requirements = within(screen.getByRole('list', { name: 'Remaining requirements' }));
    expect(requirements.getByText('Neck T1')).toBeTruthy();
    expect(requirements.getByRole('img', { name: 'Neck equipment slot' })).toBeTruthy();
    expect(requirements.getByRole('link', { name: /^Neck T1 .* go to step 7$/ }).getAttribute('href'))
      .toContain(finish.id);
    const currentStep = screen.getByRole('heading', { name: 'Next action' }).closest('section')!;
    expect(within(currentStep).getByText('Requires Neck T1.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Confirm quest complete' })).toBeNull();

    const done = buildRuneProofCoachModel({ ...input, completedQuestIds: new Set([definition.questId]) });
    expect(done.equipmentBlockers).toEqual([]);
    expect(done.actions.every(action => action.state === 'COMPLETED')).toBe(true);
  });
});
