import { describe, expect, it } from 'vitest';
import { questStrategyFor, questWalkthroughFor } from '../../data/questWalkthroughs.public';
import type { UnlockState } from '../../types';
import { analyzeQuest, type QuestRouteAnalysisSnapshot } from '../questRoutes/analyzeQuest';
import { materializeRuneProofAccount } from '../questRoutes/goalPlannerRuneProof';
import { buildRuneProofCoachModel, type RuneProofCoachAction, type RuneProofCoachModel } from './coach';
import { guideReadiness, stepWarnings } from './guidePresentation';

const action = (overrides: Partial<RuneProofCoachAction> = {}): RuneProofCoachAction => ({
  id: 'first', instruction: 'Talk to the quest giver.', state: 'DO_NOW', mapChunks: ['50,50'],
  chunkAccess: [{ chunk: '50,50', status: 'UNLOCKED' }], confirmationAllowed: true,
  travel: { status: 'START', chunks: ['50,50'], missingChunks: [], requirements: [] }, ...overrides,
});
const model = (actions: readonly RuneProofCoachAction[], overrides: Partial<RuneProofCoachModel> = {}): RuneProofCoachModel => ({
  questId: 'Example quest', actions, nextAction: actions.find(step => step.state !== 'COMPLETED'),
  progress: { completed: actions.filter(step => step.state === 'COMPLETED').length, total: actions.length },
  recommendationReason: '', alternativeSources: [], mainJourneyText: '',
  proof: { source: questWalkthroughFor('The Restless Ghost')!.source, sourceLines: [], diagnostics: [] }, ...overrides,
});
const equipmentStep = action({ id: 'wear', instruction: 'Equip the amulet.', state: 'BLOCKED', confirmationAllowed: false,
  blockers: [{ kind: 'GATE', label: 'Neck T1: Wear the amulet', gate: { type: 'EQUIPMENT', slot: 'Neck', tier: 1, label: 'Neck T1: Wear the amulet' } }],
});
const vanillaGhost = (neck: number, confirmed: string[] = []) => {
  const unlocks: UnlockState = {
    equipment: { Neck: neck }, skills: {}, levels: {}, regions: ['Lumbridge', 'Draynor'], chunks: [],
    quests: [], guilds: [], merchants: [], minigames: [], mobility: [], slayerUnlocks: [],
    arcana: [], housing: [], bosses: [], storage: [], farming: [], diaries: [], cas: [], completedTasks: [], collectionLog: {},
  };
  const snapshot: QuestRouteAnalysisSnapshot = {
    ...materializeRuneProofAccount(unlocks, 'vanilla'), chunkDataVersion: 1,
    itemSourceRecords: [], recipes: [], entityLocations: [], stationRequirements: [], sourceCoverage: [], connectGraph: {},
  };
  const strategy = questStrategyFor('The Restless Ghost')!;
  return buildRuneProofCoachModel({ strategy, account: snapshot,
    analysis: analyzeQuest(strategy.questId, snapshot, questWalkthroughFor(strategy.questId)!),
    confirmedActionIds: new Set(confirmed), confirmedItemKeys: new Set(), completedQuestIds: new Set(),
  });
};

describe('simple guide presentation', () => {
  it('allows the real Vanilla quest start while explaining the later equipment unlock', () => {
    const ghost = vanillaGhost(0);
    expect(ghost.nextAction?.state).toBe('DO_NOW');
    expect(guideReadiness(ghost)).toBe('You can start this quest. Finishing requires Neck T1.');
    expect(stepWarnings(ghost.actions[0])).toEqual([]);
    expect(stepWarnings(ghost.actions[2])).toEqual(['Requires Neck T1.']);
    expect(stepWarnings(ghost.actions[6])).toEqual(['Requires Neck T1.']);
  });

  it('distinguishes continuing preparation from the currently blocked wear step in Vanilla', () => {
    const start = 'the-restless-ghost:start-with-aereck';
    const amulet = 'the-restless-ghost:get-amulet';
    expect(guideReadiness(vanillaGhost(0, [start]))).toBe('You can continue this quest. Finishing requires Neck T1.');
    expect(guideReadiness(vanillaGhost(0, [start, amulet]))).toBe('Before the next step: Requires Neck T1.');
    expect(guideReadiness(vanillaGhost(1, [start, amulet]))).toBe('You can continue this quest.');
  });

  it('does not call the whole quest ready just because the first action is allowed', () => {
    expect(guideReadiness(model([action()]))).toBe('You can start this quest.');
    expect(guideReadiness(model([action(), equipmentStep], { equipmentBlockers: ['Neck T1: Wear the amulet'] })))
      .toBe('You can start this quest. Finishing requires Neck T1.');
  });

  it('mentions later unmet requirements as well as equipment', () => {
    const later = action({ id: 'later', state: 'BLOCKED', blockers: [{ kind: 'ITEM', itemKey: 'rope', label: 'Rope' }] });
    expect(guideReadiness(model([action(), equipmentStep, later])))
      .toBe('You can start this quest. Finishing requires Neck T1. Other requirements are shown beside their steps.');
  });

  it('keeps unknown future locations unknown even when manual confirmation is allowed', () => {
    const later = action({ id: 'unknown', state: 'AVAILABLE_NEXT', chunkAccess: [{ chunk: '50,50', status: 'UNKNOWN' }] });
    expect(guideReadiness(model([action(), equipmentStep, later])))
      .toBe('You can start this quest. Finishing requires Neck T1. Some later steps still need checking.');
    expect(stepWarnings(later)).toEqual(['The location for this step needs checking.']);
    expect(guideReadiness(model([later]))).toMatch(/^The next step needs checking\./);
  });

  it('shows named areas and items without dependency or positive route noise', () => {
    const warnings = stepWarnings(action({ state: 'BLOCKED', blockers: [
      { kind: 'CHUNK', chunk: '48,49', label: 'Chunk 48,49' },
      { kind: 'ITEM', itemKey: 'rope', label: 'Rope' },
      { kind: 'DEPENDENCY', actionId: 'prior', label: 'Finish the prior step' },
    ] }));
    expect(warnings).toContain("Unlock Wizards' Tower before this step.");
    expect(warnings).toContain('Get Rope before this step.');
    expect(warnings.join(' ')).not.toMatch(/48,49|prior step|available/i);
  });

  it('keeps specific unresolved gates and travel conditions visible', () => {
    const unknown = action({ state: 'NEEDS_CONFIRMATION', blockers: [
      { kind: 'GATE', label: 'A source condition', gate: { type: 'UNRESOLVED', label: 'A source condition', raw: 'condition' } },
    ], travel: { status: 'UNRESOLVED', chunks: [], missingChunks: [], requirements: ['Bring a fare'], explanation: 'The source does not confirm this crossing.' } });
    expect(stepWarnings(unknown)).toEqual(['Check requirement: A source condition.', 'Check travel requirement: Bring a fare.', 'The source does not confirm this crossing.']);
    expect(guideReadiness(model([action(), unknown]))).toBe('You can start this quest. Some later steps still need checking.');
  });

  it('restores coordinates in warnings and readiness only when requested', () => {
    const step = action({ state: 'BLOCKED', blockers: [{ kind: 'CHUNK', chunk: '48,49', label: 'Chunk 48,49' }],
      travel: { status: 'UNRESOLVED', chunks: [], missingChunks: ['48,50'], requirements: ['Access to chunk 48,49'], explanation: 'Check the crossing at chunk 48,50' } });
    expect(stepWarnings(step).join(' ')).not.toMatch(/48,49|48,50/);
    expect(stepWarnings(step, true)).toEqual([
      "Unlock Wizards' Tower (48,49) before this step.",
      'The walking route needs South Draynor (48,50) unlocked.',
      "Check travel requirement: Access to Wizards' Tower (48,49).",
      'Check the crossing at South Draynor (48,50).',
    ]);
    expect(guideReadiness(model([step]), true)).toBe("Before the next step: Unlock Wizards' Tower (48,49) before this step.");
    expect(guideReadiness(model([step]))).not.toContain('48,49');
  });

  it('warns only about blocked travel and does not repeat a locked destination', () => {
    const step = action({ blockers: [{ kind: 'CHUNK', chunk: '48,49', label: 'Chunk 48,49' }],
      travel: { status: 'NEEDS_CHUNKS', chunks: ['48,50', '48,49'], missingChunks: ['48,50', '48,49'], requirements: [] } });
    expect(stepWarnings(step)).toEqual(["Unlock Wizards' Tower before this step.", 'The walking route needs South Draynor unlocked.']);
    expect(stepWarnings(action({ travel: { status: 'AVAILABLE', chunks: ['50,50'], missingChunks: [], requirements: [] } }))).toEqual([]);
  });

  it('does not lose aggregate equipment requirements when their wear step was already checked', () => {
    const complete = action({ id: 'finish', state: 'BLOCKED', blockerText: 'Neck T1: Wear the amulet', confirmationAllowed: false });
    expect(stepWarnings(complete)).toEqual(['Requires Neck T1.']);
    expect(guideReadiness(model([{ ...equipmentStep, state: 'COMPLETED' }, complete])))
      .toBe('Before the next step: Requires Neck T1.');
    expect(stepWarnings({ ...complete, chunkAccess: [{ chunk: '50,50', status: 'UNKNOWN' }] }))
      .toEqual(['The location for this step needs checking.', 'Requires Neck T1.']);
  });

  it('handles empty and fully checked guides without claiming Journal completion', () => {
    expect(guideReadiness(model([]))).toBe('No walkthrough is available for this quest yet.');
    const done = { ...equipmentStep, state: 'COMPLETED' as const };
    expect(stepWarnings(done)).toEqual([]);
    expect(guideReadiness(model([done], { equipmentBlockers: ['Neck T1'] }))).toBe('All guide steps are checked off.');
  });
});
