import { questWalkthroughFor } from '../../data/questWalkthroughs';
import { describe, expect, it } from 'vitest';
import type { QuestRouteAnalysis } from './analyzeQuest';
import type { ItemRoute, QuestItemRequirement, RouteGate } from './model';
import { presentQuestAnalysis } from './presenter';

const requirement = (
  name: string,
  quantity = 1,
  supplyPolicy: QuestItemRequirement['supplyPolicy'] = 'PLAYER_OBTAINED',
): QuestItemRequirement => ({
  item: { key: name.toLocaleLowerCase('en-GB').replace(/\s+/g, '-'), name },
  quantity,
  supplyPolicy,
});

const route = (
  id: string,
  sourceLabel: string,
  overrides: Partial<ItemRoute> = {},
): ItemRoute => ({
  id,
  item: { key: 'egg', name: 'Egg' },
  outputQuantity: 1,
  sourceKind: 'SPAWN',
  sourceLabel,
  chunks: ['1,2'],
  steps: [{
    id: `${id}:source`,
    label: sourceLabel,
    chunk: '1,2',
    gates: [],
    quantity: 1,
    requiresChunkUnlock: false,
    hasDataGap: false,
  }],
  blockers: [],
  deterministic: true,
  recursiveCost: 0,
  consumedIngredientCost: 0,
  skillUnlockCost: 0,
  skillLevelCost: 0,
  travelCost: 0,
  hasDataGap: false,
  ...overrides,
});

const analysis = (
  status: QuestRouteAnalysis['status'],
  items: QuestRouteAnalysis['items'] = [],
): QuestRouteAnalysis => ({
  walkthrough: {
    questId: "Cook's Assistant",
    releaseStatus: 'PREVIEW_ONLY',
    status: 'READY',
    actions: [],
    blockers: [],
    hasIncompleteEvidence: false,
    sourceLines: questWalkthroughFor("Cook's Assistant")!.sourceLines,
    source: questWalkthroughFor("Cook's Assistant")!.source,
  },
  questId: "Cook's Assistant",
  status,
  items,
  generatedFrom: {
    chunkDataVersion: 17,
    walkthroughRevision: questWalkthroughFor("Cook's Assistant")!.revision,
    questRevision: '15240921',
    accountFingerprint: 'account',
  },
});

const blockedGates: RouteGate[] = [
  { type: 'SKILL', skill: 'Cooking', level: 25, label: '25 Cooking' },
  { type: 'QUEST', questId: 'priest-in-peril', label: 'Priest in Peril' },
  { type: 'UNLOCK', category: 'merchants', id: 'cook-shop', label: 'Cookery shop access' },
  { type: 'UNRESOLVED', label: 'Access to the sealed kitchen', raw: 'internal raw requirement' },
];

const ready = analysis('READY_NOW');
const blocked = analysis('CANNOT_COMPLETE_YET');
const incomplete = analysis('ANALYSIS_INCOMPLETE');

describe('presentQuestAnalysis', () => {
  it('uses the source-bearing gathering step instead of exposing an internal recipe id', () => {
    const presented = presentQuestAnalysis(analysis('READY_NOW', [{
      requirement: requirement('Bucket of milk'),
      state: 'OBTAINABLE_NOW',
      currentRoutes: [route('recipe:milk-cow', 'milk-cow', {
        sourceKind: 'GATHER',
        steps: [
          {
            id: 'recipe:milk-cow:bucket',
            label: 'Obtain Bucket',
            gates: [],
            quantity: 1,
            consumed: false,
            requiresChunkUnlock: false,
            hasDataGap: false,
          },
          {
            id: 'recipe:milk-cow:cow',
            label: 'Use Dairy cow',
            chunk: '50,51',
            gates: [],
            sourceKind: 'GATHER',
            requiresChunkUnlock: false,
            hasDataGap: false,
          },
        ],
      })],
      missingChunkRoutes: [],
      missingChunkOptions: [],
      dataNotes: [],
    }]));

    expect(presented.items[0].routes[0].label).toBe('Use Dairy cow');
    expect(presented.items[0].routes[0].label).not.toContain('milk-cow');
  });

  it('phrases a spawn dependency as an explicit ground-item pickup', () => {
    const presented = presentQuestAnalysis(analysis('READY_NOW', [{
      requirement: requirement('Clay', 6),
      state: 'OBTAINABLE_NOW',
      currentRoutes: [route('mine-clay', 'mine-clay', {
        sourceKind: 'GATHER',
        steps: [
          {
            id: 'mine-clay:dependency',
            label: 'Obtain Bronze pickaxe',
            gates: [],
            quantity: 1,
            consumed: false,
            requiresChunkUnlock: false,
            hasDataGap: false,
          },
          {
            id: 'mine-clay:pickaxe-source',
            label: 'Bronze pickaxe',
            chunk: '50,50',
            gates: [],
            sourceKind: 'SPAWN',
            quantity: 1,
            requiresChunkUnlock: false,
            hasDataGap: false,
          },
        ],
      })],
      missingChunkRoutes: [],
      missingChunkOptions: [],
      dataNotes: [],
    }]));

    expect(presented.items[0].routes[0].steps.map(step => step.label)).toEqual([
      'Obtain Bronze pickaxe',
      'Pick up Bronze pickaxe (ground spawn)',
    ]);
  });
  it('uses exact, non-terminal player-facing quest status language', () => {
    expect(presentQuestAnalysis(ready).heading).toBe('Ready now');
    expect(presentQuestAnalysis(blocked).heading).toBe('Cannot complete yet');
    expect(presentQuestAnalysis(incomplete).heading).toBe('Analysis incomplete');
    expect(JSON.stringify(presentQuestAnalysis(incomplete))).not.toMatch(/\bimpossible\b/i);
  });

  it('presents every reviewed requirement with quantity and exact item status language', () => {
    const presented = presentQuestAnalysis(analysis('CANNOT_COMPLETE_YET', [
      {
        requirement: requirement('Egg', 2),
        state: 'OBTAINABLE_NOW',
        currentRoutes: [route('ready', 'Lumbridge chicken coop')],
        missingChunkRoutes: [],
        missingChunkOptions: [],
        dataNotes: [],
      },
      {
        requirement: requirement('Bucket of milk'),
        state: 'ROUTE_BLOCKED',
        currentRoutes: [route('blocked', 'Dairy cow', { blockers: blockedGates })],
        missingChunkRoutes: [],
        missingChunkOptions: [],
        dataNotes: [],
      },
      {
        requirement: requirement('Pot of flour'),
        state: 'NO_CURRENT_SOURCE',
        currentRoutes: [],
        missingChunkRoutes: [route('outside', 'Mill Lane Mill', {
          chunks: ['4,5'],
          steps: [{ id: 'outside:source', label: 'Mill Lane Mill', chunk: '4,5', gates: [], requiresChunkUnlock: true, hasDataGap: false }],
        })],
        missingChunkOptions: [{ chunks: ['4,5'], routeIds: ['outside'], remainingGates: [] }],
        dataNotes: [],
      },
      {
        requirement: requirement('Bowl of hot water'),
        state: 'DATA_INCOMPLETE',
        currentRoutes: [route('gap', 'Kitchen range', { hasDataGap: true })],
        missingChunkRoutes: [],
        missingChunkOptions: [],
        dataNotes: ['Station access has not been reviewed.'],
      },
      {
        requirement: requirement('Empty pot', 1, 'QUEST_PROVIDED'),
        state: 'OBTAINABLE_NOW',
        currentRoutes: [],
        missingChunkRoutes: [],
        missingChunkOptions: [],
        dataNotes: [],
      },
    ]));

    expect(presented.items.map(item => [item.quantity, item.itemName, item.statusText])).toEqual([
      [2, 'Egg', 'Obtainable now'],
      [1, 'Bucket of milk', 'Route exists — requirement missing'],
      [1, 'Pot of flour', 'No source in current chunks'],
      [1, 'Bowl of hot water', 'Route data incomplete'],
      [1, 'Empty pot', 'Obtainable now'],
    ]);
    expect(presented.items[4].supplyNote).toBe('Provided during the quest');
  });

  it('keeps Task 8 route order, exposes source steps and categorises player-facing blockers', () => {
    const best = route('best', 'Lumbridge chicken coop', {
      chunks: ['1,2', '2,2'],
      steps: [
        {
          id: 'best:source',
          label: 'Lumbridge chicken coop',
          chunk: '1,2',
          gates: [],
          sourceKind: 'SPAWN',
          blockers: [blockedGates[0]],
          requiresChunkUnlock: false,
          hasDataGap: false,
        },
        {
          id: 'best:station',
          label: 'Use the cooking range',
          chunk: '2,2',
          gates: [],
          sourceKind: 'RECIPE',
          blockers: [blockedGates[3]],
          requiresChunkUnlock: false,
          hasDataGap: false,
        },
      ],
      blockers: blockedGates,
      travelCost: 1,
      travelCostEstimated: true,
    });
    const other = route('other', 'Fred the Farmer');
    const item = presentQuestAnalysis(analysis('CANNOT_COMPLETE_YET', [{
      requirement: requirement('Egg'),
      state: 'ROUTE_BLOCKED',
      currentRoutes: [best, other],
      missingChunkRoutes: [],
      missingChunkOptions: [],
      dataNotes: [],
    }])).items[0];

    expect(item.routes.map(candidate => candidate.id)).toEqual(['best', 'other']);
    expect(item.routes[0].isBest).toBe(true);
    expect(item.routes[0].steps).toEqual([
      {
        label: 'Pick up Lumbridge chicken coop (ground spawn)',
        sourceKind: 'Spawn',
        chunk: '1,2',
        quantity: undefined,
        consumed: undefined,
        blockers: [{ category: 'Skill', label: '25 Cooking' }],
        requiresChunkUnlock: false,
        hasDataGap: false,
      },
      {
        label: 'Use the cooking range',
        sourceKind: 'Recipe',
        chunk: '2,2',
        quantity: undefined,
        consumed: undefined,
        blockers: [{ category: 'Access / station', label: 'Access to the sealed kitchen' }],
        requiresChunkUnlock: false,
        hasDataGap: false,
      },
    ]);
    expect(item.routes[0].blockers).toEqual([
      { category: 'Skill', label: '25 Cooking' },
      { category: 'Quest', label: 'Priest in Peril' },
      { category: 'Unlock', label: 'Cookery shop access' },
      { category: 'Access / station', label: 'Access to the sealed kitchen' },
    ]);
    expect(item.routes[0].travelNote).toBe('Travel: 1 chunk (geometric estimate)');
    expect(JSON.stringify(item.routes[0])).not.toContain('priest-in-peril');
    expect(JSON.stringify(item.routes[0])).not.toContain('internal raw requirement');
  });

  it('phrases missing chunks as route advice and localises incomplete evidence', () => {
    const presented = presentQuestAnalysis(analysis('CANNOT_COMPLETE_YET', [
      {
        requirement: requirement('Pot of flour'),
        state: 'NO_CURRENT_SOURCE',
        currentRoutes: [],
        missingChunkRoutes: [route('mill', 'Mill Lane Mill', {
          chunks: ['4,5'],
          steps: [{ id: 'mill:source', label: 'Mill Lane Mill', chunk: '4,5', gates: [], requiresChunkUnlock: true, hasDataGap: false }],
        })],
        missingChunkOptions: [{
          chunks: ['4,5'],
          routeIds: ['mill'],
          remainingGates: [{ type: 'QUEST', questId: 'the-restless-ghost', label: 'The Restless Ghost' }],
        }],
        dataNotes: [],
      },
      {
        requirement: requirement('Bowl of hot water'),
        state: 'DATA_INCOMPLETE',
        currentRoutes: [route('range', 'Kitchen range', { hasDataGap: true })],
        missingChunkRoutes: [],
        missingChunkOptions: [],
        dataNotes: ['Range access evidence is incomplete.'],
      },
      {
        requirement: requirement('Egg'),
        state: 'OBTAINABLE_NOW',
        currentRoutes: [route('coop', 'Lumbridge chicken coop')],
        missingChunkRoutes: [],
        missingChunkOptions: [],
        dataNotes: [],
      },
    ]));

    expect(presented.items[0].missingChunkOptions).toEqual([{
      chunks: ['4,5'],
      advice: 'Unlock chunk 4,5 to gain a known route.',
      remainingBlockers: [{ category: 'Quest', label: 'The Restless Ghost' }],
    }]);
    expect(presented.items[1].dataNotes).toEqual(['Range access evidence is incomplete.']);
    expect(presented.items[1].routes[0].dataNote).toBe('Route data incomplete for this route.');
    expect(presented.items[2].dataNotes).toEqual([]);
    expect(presented.items[2].routes[0].dataNote).toBeUndefined();
  });
  it('hides missing chunk advice only for an obtainable item', () => {
    const presented = presentQuestAnalysis(analysis('CANNOT_COMPLETE_YET', [
      {
        requirement: requirement('Egg'),
        state: 'OBTAINABLE_NOW',
        currentRoutes: [route('coop', 'Chicken coop', {
          chunks: ['19,57'],
          steps: [{ id: 'coop:source', label: 'Chicken coop', chunk: '19,57', gates: [], requiresChunkUnlock: false, hasDataGap: false }],
        })],
        missingChunkRoutes: [route('remote-egg', 'Remote egg', { chunks: ['19,57'] })],
        missingChunkOptions: [{ chunks: ['19,57'], routeIds: ['remote-egg'], remainingGates: [] }],
        dataNotes: [],
      },
      {
        requirement: requirement('Flour'),
        state: 'NO_CURRENT_SOURCE',
        currentRoutes: [],
        missingChunkRoutes: [route('mill', 'Mill', { chunks: ['20,48'] })],
        missingChunkOptions: [{ chunks: ['20,48'], routeIds: ['mill'], remainingGates: [] }],
        dataNotes: [],
      },
    ]));

    expect(presented.items[0].missingChunkOptions).toEqual([]);
    expect(presented.items[1].missingChunkOptions).toHaveLength(1);
    expect(presented.items[0]).toMatchObject({
      anchorId: 'runeproof-item-1-egg',
      analysisState: 'OBTAINABLE_NOW',
      supplyPolicy: 'PLAYER_OBTAINED',
    });
    expect(presented.items[0].routes[0].steps[0].chunk).toBe('19,57');
  });
});
