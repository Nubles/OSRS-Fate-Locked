import { describe, expect, it } from 'vitest';
import { questStrategyFor, questWalkthroughFor } from '../../data/questWalkthroughs.public';
import type { UnlockState } from '../../types';
import { analyzeQuest, type QuestRouteAnalysisSnapshot } from '../questRoutes/analyzeQuest';
import { materializeRuneProofAccount } from '../questRoutes/goalPlannerRuneProof';
import { buildRuneProofCoachModel, type RuneProofCoachAction, type RuneProofCoachModel } from './coach';
import { guideNeeds } from './guideNeeds';

const action = (id: string, overrides: Partial<RuneProofCoachAction> = {}): RuneProofCoachAction => ({
  id, instruction: 'Follow this step.', state: 'DO_NOW', mapChunks: ['50,50'],
  chunkAccess: [{ chunk: '50,50', status: 'UNLOCKED' }], confirmationAllowed: true,
  travel: { status: 'START', chunks: ['50,50'], missingChunks: [], requirements: [] }, ...overrides,
});
const model = (actions: readonly RuneProofCoachAction[], overrides: Partial<RuneProofCoachModel> = {}): RuneProofCoachModel => ({
  questId: 'Example quest', actions, nextAction: actions.find(step => step.state !== 'COMPLETED'),
  progress: { completed: actions.filter(step => step.state === 'COMPLETED').length, total: actions.length },
  recommendationReason: '', alternativeSources: [], mainJourneyText: '',
  proof: { source: questWalkthroughFor('The Restless Ghost')!.source, sourceLines: [], diagnostics: [] }, ...overrides,
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

describe('at-a-glance guide needs', () => {
  it('links one Vanilla Neck T1 need to the actual wear step, not the completion guard', () => {
    expect(guideNeeds(vanillaGhost(0))).toEqual([
      { id: 'equipment:Neck:1', kind: 'UNLOCK', label: 'Neck T1', actionIds: ['the-restless-ghost:talk-to-ghost'], visual: { type: 'EQUIPMENT', slot: 'Neck' } },
    ]);
    expect(guideNeeds(vanillaGhost(1))).toEqual([]);
  });

  it('retains the Vanilla completion guard after the equipment action was checked', () => {
    expect(guideNeeds(vanillaGhost(0, ['the-restless-ghost:talk-to-ghost']))).toEqual([
      { id: 'equipment:Neck:1', kind: 'UNLOCK', label: 'Neck T1', actionIds: ['the-restless-ghost:complete'], visual: { type: 'EQUIPMENT', slot: 'Neck' } },
    ]);
    expect(guideNeeds(vanillaGhost(0, ['the-restless-ghost:complete']))).toEqual([]);
  });

  it('deduplicates known gates and items while preserving every remaining affected step', () => {
    const blockers: RuneProofCoachAction['blockers'] = [
      { kind: 'GATE', gate: { type: 'SKILL', skill: 'Magic', level: 10, label: 'Magic level 10' }, label: 'Magic level 10' },
      { kind: 'ITEM', itemKey: 'rope', label: 'Rope' },
    ];
    expect(guideNeeds(model([
      action('done', { state: 'COMPLETED', blockers }),
      action('first', { state: 'BLOCKED', blockers }),
      action('later', { state: 'BLOCKED', blockers: [...blockers,
        { kind: 'GATE', gate: { type: 'QUEST', questId: 'Example prerequisite', label: 'Example prerequisite' }, label: 'Example prerequisite' },
      ] }),
    ]))).toEqual([
      { id: 'skill:Magic:10', kind: 'UNLOCK', label: 'Magic level 10', actionIds: ['first', 'later'], visual: { type: 'SKILL', skill: 'Magic' } },
      { id: 'item:rope', kind: 'ITEM', label: 'Rope', actionIds: ['first', 'later'], visual: { type: 'ITEM', itemKey: 'rope' } },
      { id: 'quest:Example prerequisite', kind: 'UNLOCK', label: 'Example prerequisite', actionIds: ['later'], visual: { type: 'QUEST' } },
    ]);
  });

  it('keeps unresolved source conditions separate from unlocks and merges repeated checks', () => {
    const gate = { type: 'UNRESOLVED' as const, raw: 'unknown', label: 'A crossing condition needs checking' };
    const needs = guideNeeds(model([
      action('first', { blockers: [{ kind: 'GATE', gate, label: gate.label }, { kind: 'LOCATION', label: 'The cellar entrance needs checking' }],
        chunkAccess: [{ chunk: '48,49', status: 'UNKNOWN' }] }),
      action('second', { travel: { status: 'UNRESOLVED', chunks: [], missingChunks: [], requirements: [gate.label] } }),
    ]));
    expect(needs).toEqual([
      { id: `check:${gate.label.toLowerCase()}`, kind: 'CHECK', label: gate.label, actionIds: ['first', 'second'] },
      { id: 'check:the cellar entrance needs checking', kind: 'CHECK', label: 'The cellar entrance needs checking', actionIds: ['first'] },
    ]);
  });

  it('uses friendly area names, deduplicates travel and destination locks, and keeps IDs stable', () => {
    const subject = model([action('first', { blockers: [{ kind: 'CHUNK', chunk: '48,49', label: 'Chunk 48,49' }],
      chunkAccess: [{ chunk: '48,49', status: 'LOCKED' }],
      travel: { status: 'NEEDS_CHUNKS', chunks: ['48,50', '48,49'], missingChunks: ['48,50', '48,49'], requirements: [] } }),
    action('second', { blockers: [{ kind: 'CHUNK', chunk: '48,49', label: 'Chunk 48,49' }] })]);
    const needs = guideNeeds(subject);
    expect(needs).toEqual([
      { id: 'chunk:48,49', kind: 'UNLOCK', label: "Wizards' Tower", actionIds: ['first', 'second'], visual: { type: 'CHUNK', chunk: '48,49' } },
      { id: 'chunk:48,50', kind: 'UNLOCK', label: 'South Draynor', actionIds: ['first'], visual: { type: 'CHUNK', chunk: '48,50' } },
    ]);
    expect(guideNeeds(subject, true)).toEqual(needs.map(need => ({ ...need, label: `${need.label} (${need.id.slice(6)})` })));
  });

  it('does not describe a travel fare or an unknown candidate location as an unlock', () => {
    const needs = guideNeeds(model([action('step', {
      chunkAccess: [{ chunk: '48,49', status: 'UNKNOWN' }], confirmationAllowed: true,
      travel: { status: 'NEEDS_REQUIREMENTS', chunks: [], missingChunks: [], requirements: ['Bring 10 coins'] },
    })]));
    expect(needs).toEqual([
      { id: 'location:48,49', kind: 'CHECK', label: "Location needs checking: Wizards' Tower", actionIds: ['step'] },
      { id: 'check:bring 10 coins', kind: 'CHECK', label: 'Bring 10 coins', actionIds: ['step'] },
    ]);
  });

  it('orders aggregate completion needs after earlier directly affected steps', () => {
    const subject = model([
      action('item', { blockers: [{ kind: 'ITEM', itemKey: 'rope', label: 'Rope' }] }),
      action('finish', { state: 'BLOCKED', blockerText: 'Neck T1: Wear the amulet', confirmationLabel: 'Confirm quest complete' }),
    ], { equipmentBlockers: ['Neck T1: Wear the amulet'] });
    expect(guideNeeds(subject).map(need => [need.label, need.actionIds])).toEqual([
      ['Rope', ['item']], ['Neck T1', ['finish']],
    ]);
  });

  it('retains an unrelated completion condition after deduplicating aggregate equipment', () => {
    const subject = model([
      action('wear', { blockers: [{ kind: 'GATE', gate: { type: 'EQUIPMENT', slot: 'Neck', tier: 1, label: 'Neck T1' }, label: 'Neck T1' }] }),
      action('finish', { state: 'BLOCKED', blockerText: 'Neck T1: Wear the amulet; Confirm the final dialogue', confirmationLabel: 'Confirm quest complete' }),
    ], { equipmentBlockers: ['Neck T1: Wear the amulet'] });
    expect(guideNeeds(subject)).toEqual([
      { id: 'equipment:Neck:1', kind: 'UNLOCK', label: 'Neck T1', actionIds: ['wear'], visual: { type: 'EQUIPMENT', slot: 'Neck' } },
      { id: 'check:confirm the final dialogue', kind: 'CHECK', label: 'Confirm the final dialogue', actionIds: ['finish'] },
    ]);
  });

  it('treats quest-stage evidence as a check rather than a definite missing unlock', () => {
    const label = 'Started Example quest';
    const needs = guideNeeds(model([action('stage', { blockers: [{ kind: 'GATE', label,
      gate: { type: 'QUEST_PROGRESS', questId: 'Example quest', completion: 'satisfies', raw: 'started', label },
    }] })]));
    expect(needs).toEqual([{ id: 'quest-progress:Example quest:satisfies:started', kind: 'CHECK', label, actionIds: ['stage'], visual: { type: 'QUEST' } }]);
  });

  it('retains a structured unlock identity even when its display label differs', () => {
    const needs = guideNeeds(model([action('travel', { blockers: [{ kind: 'GATE', label: 'Fairy ring travel',
      gate: { type: 'UNLOCK', category: 'mobility', id: 'Fairy Rings', label: 'Fairy ring travel' },
    }] })]));
    expect(needs).toEqual([{ id: 'unlock:mobility:Fairy Rings', kind: 'UNLOCK', label: 'Fairy ring travel', actionIds: ['travel'],
      visual: { type: 'UNLOCK', category: 'mobility', id: 'Fairy Rings' },
    }]);
  });

  it('does not give unresolved locations or requirements a precise visual identity', () => {
    const subject = model([
      action('candidate', { chunkAccess: [{ chunk: '48,49', status: 'UNKNOWN' }] }),
      action('location', { blockers: [{ kind: 'LOCATION', label: 'An entrance needs checking' }] }),
      action('gate', { blockers: [{ kind: 'GATE', label: 'An unknown condition',
        gate: { type: 'UNRESOLVED', raw: 'unknown', label: 'An unknown condition' },
      }] }),
    ]);
    expect(guideNeeds(subject).map(need => need.visual)).toEqual([undefined, undefined, undefined]);
  });

  it('preserves missing evidence while omitting healthy routes and dependencies', () => {
    expect(guideNeeds(model([action('healthy', { blockers: [{ kind: 'DEPENDENCY', actionId: 'prior', label: 'Prior step' }],
      travel: { status: 'AVAILABLE', chunks: ['50,50'], missingChunks: [], requirements: [] } })]))).toEqual([]);
    expect(guideNeeds(model([action('unknown', { state: 'NEEDS_CONFIRMATION' })]))[0]).toMatchObject({
      kind: 'CHECK', actionIds: ['unknown'],
    });
    expect(guideNeeds(model([]))).toEqual([]);
  });
});
