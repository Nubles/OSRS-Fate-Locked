import { describe, expect, it } from 'vitest';
import type { F2PQuestMembership } from '../../data/f2pQuestMembership';
import { questWalkthroughReleaseFor } from '../../data/questWalkthroughRelease';
import * as previewBoundary from '../../data/questWalkthroughs.preview-boundary';
import * as walkthroughLoader from '../../data/questWalkthroughLoader';
import type { QuestWalkthroughDefinition } from '../questWalkthroughs/model';
import type { QuestItemRequirement } from '../questRoutes/model';
import {
  questStrategyFromWalkthrough,
  type QuestStrategyContext,
  type QuestStrategyDefinition,
} from './model';

const item = (key: string, name: string) => ({ key, name });

const membership = (): F2PQuestMembership => ({
  questId: "Cook's Assistant",
  slug: 'cooks-assistant',
  kind: 'quest',
  wave: 1,
  progressionPriority: 1,
  wikiTitle: "Cook's Assistant/Quick guide",
  evidenceQuestId: "Cook's Assistant",
});

const rootRequirements = (): readonly QuestItemRequirement[] => [
  { item: item('bucket of milk', 'Bucket of milk'), quantity: 1, supplyPolicy: 'PLAYER_OBTAINED' },
  { item: item('egg', 'Egg'), quantity: 1, supplyPolicy: 'PLAYER_OBTAINED' },
  { item: item('pot of flour', 'Pot of flour'), quantity: 1, supplyPolicy: 'PLAYER_OBTAINED' },
];

const strategyContext = (overrides: Partial<QuestStrategyContext> = {}): QuestStrategyContext => ({
  membership: membership(),
  rootRequirements: rootRequirements(),
  ...overrides,
});

const reviewedLocation = {
  kind: 'REVIEWED_ALIAS',
  alias: 'Lumbridge',
  chunks: ['50,50'],
  reviewer: 'Reviewer',
  reviewedAt: '2026-08-20',
  evidence: 'Reviewed walkthrough evidence.',
  rationale: 'Reviewed action location.',
} as const;

const coach = (overrides: Record<string, unknown> = {}) => ({
  consumes: [],
  fulfils: [],
  completion: { kind: 'MANUAL' },
  fallbackPolicy: 'NONE',
  ...overrides,
});

const reviewedAction = (
  id: string,
  sourceOrder: number,
  dependsOn: readonly string[] = [],
  actionCoach = coach(),
) => ({
  id,
  section: sourceOrder < 3 ? 'PREPARE' : 'QUEST',
  sourceOrder,
  kind: 'INFORMATION',
  confidence: 'REVIEWED',
  displayText: id,
  rawWikiLineIds: [`line-${sourceOrder}`],
  dependsOn,
  entities: [],
  items: [],
  gates: [],
  location: reviewedLocation,
  coach: actionCoach,
});

const strategyWalkthroughFixture = (): QuestWalkthroughDefinition => ({
  questId: "Cook's Assistant",
  revision: 'a'.repeat(64),
  releaseStatus: 'PREVIEW_ONLY',
  source: {
    wikiTitle: "Cook's Assistant/Quick guide",
    wikiRevision: '1',
    wikiRevisionTimestamp: '2026-08-20T00:00:00Z',
    wikiUrl: 'https://oldschool.runescape.wiki/w/Cook%27s_Assistant/Quick_guide?oldid=1',
    wikiLicence: 'CC BY-NC-SA 3.0',
    wikiLicenceUrl: 'https://creativecommons.org/licenses/by-nc-sa/3.0/',
    chunkPickerRepository: 'source-chunk/chunk-picker-v2',
    chunkPickerCommit: 'reviewed-commit',
    chunkPickerLicenceStatus: 'UNVERIFIED',
  },
  sourceLines: Array.from({ length: 9 }, (_value, index) => ({
    id: `line-${index + 1}`,
    section: 'Walkthrough',
    sourceOrder: index + 1,
    rawText: `Line ${index + 1}`,
  })),
  actions: [
    reviewedAction('cooks-assistant:start-quest', 1),
    reviewedAction('cooks-assistant:take-pot', 2, ['cooks-assistant:start-quest'], coach({
      fulfils: [{ item: item('pot', 'Pot'), quantity: 1, supplyPolicy: 'PLAYER_OBTAINED' }],
      completion: { kind: 'MANUAL' },
      preferredMethod: { kind: 'DIRECT_SOURCE', itemKey: 'pot', sourceLabel: 'Pot' },
    })),
    reviewedAction('cooks-assistant:take-bucket', 3, ['cooks-assistant:take-pot'], coach({
      fulfils: [{ item: item('bucket', 'Bucket'), quantity: 1, supplyPolicy: 'PLAYER_OBTAINED' }],
      completion: { kind: 'MANUAL' },
      preferredMethod: { kind: 'DIRECT_SOURCE', itemKey: 'bucket', sourceLabel: 'Bucket' },
    })),
    reviewedAction('cooks-assistant:milk-cow', 4, ['cooks-assistant:take-bucket'], coach({
      consumes: [{ item: item('bucket', 'Bucket'), quantity: 1, supplyPolicy: 'PLAYER_OBTAINED' }],
      fulfils: [{ item: item('bucket of milk', 'Bucket of milk'), quantity: 1, supplyPolicy: 'PLAYER_OBTAINED' }],
      completion: { kind: 'ITEM_CONFIRMED', itemKey: 'bucket of milk' },
      fallbackPolicy: 'BLOCK_THEN_ALTERNATIVES',
      preferredMethod: { kind: 'TRANSFORMATION', recipeId: 'milk-cow' },
    })),
    reviewedAction('cooks-assistant:take-egg', 5, ['cooks-assistant:milk-cow'], coach({
      fulfils: [{ item: item('egg', 'Egg'), quantity: 1, supplyPolicy: 'PLAYER_OBTAINED' }],
      completion: { kind: 'ITEM_CONFIRMED', itemKey: 'egg' },
      fallbackPolicy: 'BLOCK_THEN_ALTERNATIVES',
      preferredMethod: { kind: 'DIRECT_SOURCE', itemKey: 'egg', sourceLabel: 'Egg' },
    })),
    reviewedAction('cooks-assistant:pick-grain', 6, ['cooks-assistant:take-egg'], coach({
      fulfils: [{ item: item('grain', 'Grain'), quantity: 1, supplyPolicy: 'PLAYER_OBTAINED' }],
      completion: { kind: 'MANUAL' },
      preferredMethod: { kind: 'TRANSFORMATION', recipeId: 'pick-wheat' },
    })),
    reviewedAction('cooks-assistant:make-flour', 7, ['cooks-assistant:pick-grain'], coach({
      consumes: [
        { item: item('grain', 'Grain'), quantity: 1, supplyPolicy: 'PLAYER_OBTAINED' },
        { item: item('pot', 'Pot'), quantity: 1, supplyPolicy: 'PLAYER_OBTAINED' },
      ],
      fulfils: [{ item: item('pot of flour', 'Pot of flour'), quantity: 1, supplyPolicy: 'PLAYER_OBTAINED' }],
      completion: { kind: 'ITEM_CONFIRMED', itemKey: 'pot of flour' },
      fallbackPolicy: 'BLOCK_THEN_ALTERNATIVES',
      preferredMethod: { kind: 'TRANSFORMATION', recipeId: 'grain-to-flour' },
    })),
    reviewedAction('cooks-assistant:return-to-cook', 8, ['cooks-assistant:make-flour'], coach({
      consumes: [
        { item: item('bucket of milk', 'Bucket of milk'), quantity: 1, supplyPolicy: 'PLAYER_OBTAINED' },
        { item: item('egg', 'Egg'), quantity: 1, supplyPolicy: 'PLAYER_OBTAINED' },
        { item: item('pot of flour', 'Pot of flour'), quantity: 1, supplyPolicy: 'PLAYER_OBTAINED' },
      ],
    })),
    reviewedAction('cooks-assistant:complete', 9, ['cooks-assistant:return-to-cook'], coach({
      completion: { kind: 'QUEST_COMPLETED', questId: "Cook's Assistant" },
    })),
  ],
} as unknown as QuestWalkthroughDefinition);

const clone = (walkthrough: QuestWalkthroughDefinition): any => structuredClone(walkthrough);

const walkthroughWithoutCoachMetadata = (): QuestWalkthroughDefinition => {
  const walkthrough = clone(strategyWalkthroughFixture());
  delete walkthrough.actions[0].coach;
  return walkthrough;
};

const walkthroughWithMissingStrategyDependency = (): QuestWalkthroughDefinition => {
  const walkthrough = clone(strategyWalkthroughFixture());
  walkthrough.actions[1].dependsOn = ['missing-action'];
  return walkthrough;
};

const walkthroughWithDuplicateStrategyAction = (): QuestWalkthroughDefinition => {
  const walkthrough = clone(strategyWalkthroughFixture());
  walkthrough.actions[1].id = walkthrough.actions[0].id;
  return walkthrough;
};

const walkthroughWithUnknownCompletionItem = (): QuestWalkthroughDefinition => {
  const walkthrough = clone(strategyWalkthroughFixture());
  walkthrough.actions[1].coach.completion = { kind: 'ITEM_CONFIRMED', itemKey: 'unknown item' };
  return walkthrough;
};

const walkthroughWithBlankPreferredMethod = (): QuestWalkthroughDefinition => {
  const walkthrough = clone(strategyWalkthroughFixture());
  walkthrough.actions[3].coach.preferredMethod = { kind: 'TRANSFORMATION', recipeId: '   ' };
  return walkthrough;
};

describe('questStrategyFromWalkthrough', () => {
  it('accepts a complete reviewed pack with membership metadata and static map chunks', () => {
    const strategy = questStrategyFromWalkthrough(strategyWalkthroughFixture(), strategyContext());
    expect(strategy).toMatchObject({
      questId: "Cook's Assistant",
      kind: 'quest',
      rolloutWave: 1,
      progressionPriority: 1,
    });
    expect(strategy?.actions.every(action => action.mapChunks.length > 0)).toBe(true);
    expect(strategy?.actions.at(-1)?.coach.completion).toEqual({
      kind: 'QUEST_COMPLETED',
      questId: "Cook's Assistant",
    });
    expect(strategy?.actions.map(action => action.id)).toEqual([
      'cooks-assistant:start-quest',
      'cooks-assistant:take-pot',
      'cooks-assistant:take-bucket',
      'cooks-assistant:milk-cow',
      'cooks-assistant:take-egg',
      'cooks-assistant:pick-grain',
      'cooks-assistant:make-flour',
      'cooks-assistant:return-to-cook',
      'cooks-assistant:complete',
    ]);
    expect(strategy?.actions.map(action => ({
      id: action.id,
      completion: action.coach.completion,
      fallbackPolicy: action.coach.fallbackPolicy,
    }))).toEqual([
      { id: 'cooks-assistant:start-quest', completion: { kind: 'MANUAL' }, fallbackPolicy: 'NONE' },
      { id: 'cooks-assistant:take-pot', completion: { kind: 'MANUAL' }, fallbackPolicy: 'NONE' },
      { id: 'cooks-assistant:take-bucket', completion: { kind: 'MANUAL' }, fallbackPolicy: 'NONE' },
      { id: 'cooks-assistant:milk-cow', completion: { kind: 'ITEM_CONFIRMED', itemKey: 'bucket of milk' }, fallbackPolicy: 'BLOCK_THEN_ALTERNATIVES' },
      { id: 'cooks-assistant:take-egg', completion: { kind: 'ITEM_CONFIRMED', itemKey: 'egg' }, fallbackPolicy: 'BLOCK_THEN_ALTERNATIVES' },
      { id: 'cooks-assistant:pick-grain', completion: { kind: 'MANUAL' }, fallbackPolicy: 'NONE' },
      { id: 'cooks-assistant:make-flour', completion: { kind: 'ITEM_CONFIRMED', itemKey: 'pot of flour' }, fallbackPolicy: 'BLOCK_THEN_ALTERNATIVES' },
      { id: 'cooks-assistant:return-to-cook', completion: { kind: 'MANUAL' }, fallbackPolicy: 'NONE' },
      { id: 'cooks-assistant:complete', completion: { kind: 'QUEST_COMPLETED', questId: "Cook's Assistant" }, fallbackPolicy: 'NONE' },
    ]);
  });

  it('fails closed when any strategy action lacks static reviewed or explicit chunks', () => {
    const walkthrough = clone(strategyWalkthroughFixture());
    walkthrough.actions[0].confidence = 'EXACT';
    walkthrough.actions[0].location = {
      kind: 'EXACT_ENTITY',
      entity: { kind: 'npc', name: 'Cook' },
    };

    expect(questStrategyFromWalkthrough(walkthrough, strategyContext())).toBeNull();
  });

  it('fails closed when a static map chunk list repeats a chunk', () => {
    const walkthrough = clone(strategyWalkthroughFixture());
    walkthrough.actions[0].location.chunks = ['50,50', '50,50'];

    expect(questStrategyFromWalkthrough(walkthrough, strategyContext())).toBeNull();
  });

  it('fails closed when a strategy action has a malformed item entry', () => {
    const walkthrough = clone(strategyWalkthroughFixture());
    walkthrough.actions[1].items = [{
      item: { key: 'Pot', name: 'Pot' },
      quantity: 1,
      supplyPolicy: 'PLAYER_OBTAINED',
    }];

    expect(questStrategyFromWalkthrough(walkthrough, strategyContext())).toBeNull();
  });

  it('rejects a direct source action without reviewed confidence', () => {
    const walkthrough = clone(strategyWalkthroughFixture());
    walkthrough.actions[1].confidence = 'EXACT';

    expect(questStrategyFromWalkthrough(walkthrough, strategyContext())).toBeNull();
  });

  it('accepts a consume declared by the reviewed root requirements', () => {
    const walkthrough = clone(strategyWalkthroughFixture());
    walkthrough.actions[0].coach.consumes = [
      { item: item('egg', 'Egg'), quantity: 1, supplyPolicy: 'PLAYER_OBTAINED' },
    ];

    expect(questStrategyFromWalkthrough(walkthrough, strategyContext())).not.toBeNull();
  });

  it.each([
    ['missing consumes', (walkthrough: any) => { delete walkthrough.actions[0].coach.consumes; }],
    ['unknown consumed item', (walkthrough: any) => {
      walkthrough.actions[3].coach.consumes = [
        { item: item('unreviewed item', 'Unreviewed item'), quantity: 1, supplyPolicy: 'PLAYER_OBTAINED' },
      ];
    }],
    ['multiple quest completion actions', (walkthrough: any) => {
      walkthrough.actions[7].coach.completion = { kind: 'QUEST_COMPLETED', questId: "Cook's Assistant" };
    }],
    ['quest completion before the final action', (walkthrough: any) => {
      walkthrough.actions[7].coach.completion = { kind: 'QUEST_COMPLETED', questId: "Cook's Assistant" };
      walkthrough.actions[8].coach.completion = { kind: 'MANUAL' };
    }],
    ['final quest completion ID mismatch', (walkthrough: any) => {
      walkthrough.actions[8].coach.completion = { kind: 'QUEST_COMPLETED', questId: 'Sheep Shearer' };
    }],
  ])('fails closed for %s', (_label, mutate) => {
    const walkthrough = clone(strategyWalkthroughFixture());
    mutate(walkthrough);

    expect(questStrategyFromWalkthrough(walkthrough, strategyContext())).toBeNull();
  });

  it('fails closed when the context membership does not match the walkthrough', () => {
    const mismatchedMembership: F2PQuestMembership = {
      ...membership(),
      questId: 'Sheep Shearer',
      slug: 'sheep-shearer',
      progressionPriority: 2,
      wikiTitle: 'Sheep Shearer/Quick guide',
      evidenceQuestId: 'Sheep Shearer',
    };

    expect(questStrategyFromWalkthrough(
      strategyWalkthroughFixture(),
      strategyContext({ membership: mismatchedMembership }),
    )).toBeNull();
  });

  it('fails closed when an explicit context omits membership', () => {
    expect(questStrategyFromWalkthrough(
      strategyWalkthroughFixture(),
      { rootRequirements: rootRequirements() } as QuestStrategyContext,
    )).toBeNull();
  });

  it.each([
    ['missing coach metadata', walkthroughWithoutCoachMetadata()],
    ['missing dependency', walkthroughWithMissingStrategyDependency()],
    ['duplicate action ID', walkthroughWithDuplicateStrategyAction()],
    ['unknown completion item', walkthroughWithUnknownCompletionItem()],
    ['blank preferred method', walkthroughWithBlankPreferredMethod()],
  ])('fails closed for %s', (_label, walkthrough) => {
    expect(questStrategyFromWalkthrough(walkthrough, strategyContext())).toBeNull();
  });

  it.each([
    ['malformed items', (walkthrough: any) => { walkthrough.actions[1].items = null; }],
    ['malformed dependencies', (walkthrough: any) => { walkthrough.actions[1].dependsOn = null; }],
  ])('fails closed without throwing for %s', (_label, mutate) => {
    const walkthrough = clone(strategyWalkthroughFixture());
    mutate(walkthrough);

    expect(questStrategyFromWalkthrough(walkthrough, strategyContext())).toBeNull();
  });
});

describe('preview strategy boundary', () => {
  it('exposes only exact-release compiled preview strategies', async () => {
    const boundary = previewBoundary as {
      questStrategyCatalogue?: readonly QuestStrategyDefinition[];
      questStrategyFor?: (questId: string) => QuestStrategyDefinition | undefined;
    };
    const loader = walkthroughLoader as {
      loadQuestStrategyFor?: (
        availability: 'OFF' | 'PREVIEW',
        release: { readonly questId: string; readonly revision: string; readonly releaseStatus: 'PREVIEW_ONLY' | 'APPROVED' },
      ) => Promise<QuestStrategyDefinition | undefined>;
      loadQuestStrategyCatalogue?: (
        availability: 'OFF' | 'PREVIEW',
      ) => Promise<readonly QuestStrategyDefinition[]>;
    };
    const release = questWalkthroughReleaseFor("Cook's Assistant")!;
    const sheepRelease = questWalkthroughReleaseFor('Sheep Shearer')!;
    const restlessRelease = questWalkthroughReleaseFor('The Restless Ghost')!;
    const runeMysteriesRelease = questWalkthroughReleaseFor('Rune Mysteries')!;

    expect(boundary.questStrategyFor).toBeTypeOf('function');
    expect(loader.loadQuestStrategyFor).toBeTypeOf('function');
    expect(loader.loadQuestStrategyCatalogue).toBeTypeOf('function');

    expect(boundary.questStrategyCatalogue?.map(strategy => strategy.questId)).toEqual([
      "Cook's Assistant",
      'Sheep Shearer',
      'The Restless Ghost',
      'Rune Mysteries',
    ]);
    expect(Object.isFrozen(boundary.questStrategyCatalogue)).toBe(true);
    expect(boundary.questStrategyFor?.("Cook's Assistant")?.revision).toBe(release.revision);
    expect(boundary.questStrategyFor?.('Sheep Shearer')?.revision).toBe(sheepRelease.revision);
    expect(boundary.questStrategyFor?.('The Restless Ghost')?.revision).toBe(restlessRelease.revision);
    expect(boundary.questStrategyFor?.('Rune Mysteries')?.revision).toBe(runeMysteriesRelease.revision);
    expect(boundary.questStrategyFor?.("Daddy's Home")).toBeUndefined();
    await expect(loader.loadQuestStrategyFor!('OFF', release)).resolves.toBeUndefined();
    await expect(loader.loadQuestStrategyFor!('PREVIEW', release)).resolves.toMatchObject({
      questId: release.questId,
      revision: release.revision,
    });
    await expect(loader.loadQuestStrategyFor!('PREVIEW', sheepRelease)).resolves.toMatchObject({
      questId: sheepRelease.questId,
      revision: sheepRelease.revision,
    });
    await expect(loader.loadQuestStrategyFor!('PREVIEW', restlessRelease)).resolves.toMatchObject({
      questId: restlessRelease.questId,
      revision: restlessRelease.revision,
    });
    await expect(loader.loadQuestStrategyFor!('PREVIEW', runeMysteriesRelease)).resolves.toMatchObject({
      questId: runeMysteriesRelease.questId,
      revision: runeMysteriesRelease.revision,
    });
    await expect(loader.loadQuestStrategyFor!('PREVIEW', {
      ...release,
      revision: 'stale-release-revision',
    })).resolves.toBeUndefined();
    await expect(loader.loadQuestStrategyCatalogue!('OFF')).resolves.toEqual([]);
    await expect(loader.loadQuestStrategyCatalogue!('PREVIEW')).resolves.toEqual(
      boundary.questStrategyCatalogue,
    );
  });
});
