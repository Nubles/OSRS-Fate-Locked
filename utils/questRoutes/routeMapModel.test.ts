import { describe, expect, it } from 'vitest';
import type { ChunkKey } from './model';
import type {
  PresentedQuestAnalysis,
  PresentedQuestItem,
  PresentedRoute,
  PresentedRouteStep,
} from './presenter';
import type {
  PresentedQuestWalkthrough,
  PresentedWalkthroughAction,
} from '../questWalkthroughs/presenter';
import {
  buildQuestRouteMapModel,
  type QuestRouteMapModel,
} from './routeMapModel';

const step = (
  label: string,
  chunk?: ChunkKey,
  overrides: Partial<PresentedRouteStep> = {},
): PresentedRouteStep => ({
  label,
  chunk,
  sourceKind: 'Spawn',
  blockers: [],
  requiresChunkUnlock: false,
  hasDataGap: false,
  ...overrides,
});

const presentedRoute = (
  id: string,
  overrides: Partial<PresentedRoute> = {},
): PresentedRoute => ({
  id,
  label: id,
  sourceKind: 'Spawn',
  outputQuantity: 1,
  isBest: false,
  requiresChunkUnlock: false,
  steps: [],
  blockers: [],
  deterministic: true,
  ...overrides,
});

const presentedItem = (
  overrides: Partial<PresentedQuestItem> & Pick<PresentedQuestItem, 'id'>,
): PresentedQuestItem => ({
  id: overrides.id,
  anchorId: `anchor-${overrides.id}`,
  analysisState: 'OBTAINABLE_NOW',
  supplyPolicy: 'PLAYER_OBTAINED',
  quantity: 1,
  itemName: overrides.id,
  title: overrides.id,
  statusText: 'Obtainable now',
  routes: [],
  missingChunkOptions: [],
  dataNotes: [],
  ...overrides,
});

const presentedQuest = (items: readonly PresentedQuestItem[]): PresentedQuestAnalysis => ({
  questId: "Cook's Assistant",
  heading: 'Ready now',
  items,
});

const presentedAction = (
  overrides: Partial<PresentedWalkthroughAction> & Pick<PresentedWalkthroughAction, 'id' | 'sourceOrder'>,
): PresentedWalkthroughAction => ({
  id: overrides.id,
  anchorId: `anchor-${overrides.id}`,
  section: 'QUEST',
  sourceOrder: overrides.sourceOrder,
  instruction: overrides.id,
  statusText: 'Ready here',
  blockerNotes: [],
  itemNotes: [],
  evidenceText: 'Exact reviewed evidence.',
  sourceWording: [],
  mapChunks: ['46,53'],
  canShowOnMap: true,
  ...overrides,
});

const presentedWalkthrough = (
  actions: readonly PresentedWalkthroughAction[] = [],
  questId = "Cook's Assistant",
): PresentedQuestWalkthrough => ({
  questId,
  prepareActions: [],
  questActions: actions,
  actions,
  attribution: {
    kind: 'CHUNK_PICKER_REVIEW',
    wikiLabel: 'Wiki revision',
    wikiUrl: 'https://example.test/wiki',
    licenceLabel: 'CC BY-NC-SA 3.0',
    licenceUrl: 'https://example.test/licence',
    chunkPickerLabel: 'Chunk Picker',
    chunkPickerCommit: 'abc123',
    reuseStatusText: 'Private preview only.',
  },
});

const preparationLayer = (model: QuestRouteMapModel) => model.layers[1];

if (false) {
  // @ts-expect-error A walkthrough is required to construct the Quest path layer.
  buildQuestRouteMapModel(presentedQuest([]));
}

describe('buildQuestRouteMapModel', () => {
  it('rejects a missing walkthrough instead of constructing an empty Quest path', () => {
    expect(() => buildQuestRouteMapModel(presentedQuest([]), undefined as never)).toThrow();
  });

  it('selects one route using usable, blocked-current, then missing-chunk precedence', () => {
    const model = buildQuestRouteMapModel(presentedQuest([
      presentedItem({
        id: 'egg-0',
        routes: [
          presentedRoute('usable', { requiresChunkUnlock: false, blockers: [], steps: [step('Egg', '19,57')] }),
          presentedRoute('other', { requiresChunkUnlock: false, blockers: [], steps: [step('Other', '20,57')] }),
        ],
      }),
      presentedItem({
        id: 'milk-1',
        routes: [
          presentedRoute('blocked', {
            requiresChunkUnlock: false,
            blockers: [{ category: 'Skill', label: 'Cooking 5' }],
            steps: [step('Dairy cow', '20,48')],
          }),
          presentedRoute('missing', { requiresChunkUnlock: true, steps: [step('Shop', '36,57')] }),
        ],
      }),
      presentedItem({
        id: 'flour-2',
        routes: [
          presentedRoute('missing-only', { requiresChunkUnlock: true, steps: [step('Mill', '21,48')] }),
        ],
      }),
    ]), presentedWalkthrough());

    expect(preparationLayer(model).chunks.map(chunk => chunk.chunk)).toEqual(['19,57', '20,48', '21,48']);
  });

  it('treats a usable route with a data note as incomplete', () => {
    const model = buildQuestRouteMapModel(presentedQuest([
      presentedItem({
        id: 'water-0',
        routes: [presentedRoute('gap', {
          dataNote: 'Route data incomplete for this route.',
          steps: [step('Well', '19,57', { hasDataGap: true })],
        })],
      }),
    ]), presentedWalkthrough());

    expect(preparationLayer(model).chunks).toEqual([expect.objectContaining({
      chunk: '19,57',
      state: 'INCOMPLETE',
      steps: [expect.objectContaining({ state: 'INCOMPLETE' })],
    })]);
  });

  it('merges shared chunks and preserves reviewed item then route-step order', () => {
    const sharedChunkFixture = presentedQuest([
      presentedItem({ id: 'egg-0', itemName: 'Egg', routes: [presentedRoute('egg', { steps: [step('Egg', '19,57')] })] }),
      presentedItem({ id: 'milk-1', itemName: 'Bucket of milk', routes: [presentedRoute('milk', {
        blockers: [{ category: 'Skill', label: 'Cooking 5' }],
        steps: [step('Dairy cow', '19,57', {
          blockers: [{ category: 'Skill', label: 'Cooking 5' }],
        })],
      })] }),
      presentedItem({ id: 'flour-2', itemName: 'Pot of flour', routes: [presentedRoute('flour', {
        dataNote: 'Route data incomplete for this route.',
        steps: [step('Mill', '19,57', { hasDataGap: true })],
      })] }),
    ]);

    const model = buildQuestRouteMapModel(sharedChunkFixture, presentedWalkthrough());

    expect(preparationLayer(model).chunks).toEqual([{
      chunk: '19,57',
      state: 'INCOMPLETE',
      steps: [
        expect.objectContaining({ sequence: 1, itemName: 'Egg', state: 'USABLE' }),
        expect.objectContaining({ sequence: 2, itemName: 'Bucket of milk', state: 'BLOCKED' }),
        expect.objectContaining({ sequence: 3, itemName: 'Pot of flour', state: 'INCOMPLETE' }),
      ],
    }]);
  });

  it('excludes quest-provided items and reports player items without mapped routes', () => {
    const model = buildQuestRouteMapModel(presentedQuest([
      presentedItem({ id: 'provided-0', supplyPolicy: 'QUEST_PROVIDED' }),
      presentedItem({ id: 'no-route-1' }),
      presentedItem({ id: 'no-chunk-2', routes: [presentedRoute('unmapped', { steps: [step('Talk to chef')] })] }),
    ]), presentedWalkthrough());

    expect(preparationLayer(model).chunks).toEqual([]);
    expect(preparationLayer(model).unmappedTargetIds).toEqual(['no-route-1', 'no-chunk-2']);
  });

  it('does not change output when alternatives after the selected route are reversed', () => {
    const item = (alternatives: readonly PresentedRoute[]) => presentedItem({
      id: 'egg-0',
      routes: [
        presentedRoute('selected', { steps: [step('Egg', '19,57')] }),
        ...alternatives,
      ],
    });
    const alternatives = [
      presentedRoute('alternative-a', { steps: [step('A', '20,57')] }),
      presentedRoute('alternative-b', { steps: [step('B', '21,57')] }),
    ];

    expect(buildQuestRouteMapModel(presentedQuest([item(alternatives)]), presentedWalkthrough()))
      .toEqual(buildQuestRouteMapModel(presentedQuest([item([...alternatives].reverse())]), presentedWalkthrough()));
  });

  it('projects recursive ingredient chunks from their own source provenance', () => {
    const model = buildQuestRouteMapModel(presentedQuest([
      presentedItem({
        id: 'plank-0',
        itemName: 'Plank',
        routes: [presentedRoute('recipe-route', {
          label: 'Use Sawmill',
          sourceKind: 'Recipe',
          blockers: [{ category: 'Access / station', label: 'Sawmill access' }],
          steps: [
            step('Use Sawmill', '19,57', {
              sourceKind: 'Recipe',
              blockers: [{ category: 'Access / station', label: 'Sawmill access' }],
            }),
            step('Logs source', '21,48', {
              sourceKind: 'Spawn',
              blockers: [{ category: 'Skill', label: 'Woodcutting 1' }],
            }),
          ],
        })],
      }),
    ]), presentedWalkthrough());

    expect(preparationLayer(model).chunks[1].steps[0]).toMatchObject({
      routeLabel: 'Logs source',
      sourceKind: 'Spawn',
      blockers: [{ category: 'Skill', label: 'Woodcutting 1' }],
    });
    expect(preparationLayer(model).chunks[1].steps[0]).not.toMatchObject({
      routeLabel: 'Use Sawmill',
      sourceKind: 'Recipe',
      blockers: [{ category: 'Access / station', label: 'Sawmill access' }],
    });
  });

  it('keeps missing-chunk causality on blocked steps without named gates', () => {
    const model = buildQuestRouteMapModel(presentedQuest([
      presentedItem({
        id: 'flour-0',
        itemName: 'Pot of flour',
        routes: [presentedRoute('locked-mill', {
          requiresChunkUnlock: true,
          blockers: [],
          steps: [step('Mill Lane Mill', '21,48', { requiresChunkUnlock: true })],
        })],
      }),
    ]), presentedWalkthrough());

    expect(preparationLayer(model).chunks[0].steps[0]).toMatchObject({
      state: 'BLOCKED',
      requiresChunkUnlock: true,
      blockers: [],
    });
  });

  it('projects reachability independently for unlocked and locked steps in one route', () => {
    const model = buildQuestRouteMapModel(presentedQuest([
      presentedItem({
        id: 'mixed-0',
        itemName: 'Mixed route',
        routes: [presentedRoute('mixed', {
          requiresChunkUnlock: true,
          steps: [
            step('Unlocked ingredient', '1,2', {
              requiresChunkUnlock: false,
              hasDataGap: false,
            }),
            step('Locked station', '8,9', {
              requiresChunkUnlock: true,
              hasDataGap: false,
            }),
          ],
        })],
      }),
      presentedItem({
        id: 'shared-1',
        itemName: 'Shared usable route',
        routes: [presentedRoute('shared', {
          steps: [step('Shared unlocked source', '1,2')],
        })],
      }),
    ]), presentedWalkthrough());

    expect(preparationLayer(model).chunks).toEqual([
      expect.objectContaining({
        chunk: '1,2',
        state: 'USABLE',
        steps: [
          expect.objectContaining({ itemName: 'Mixed route', state: 'USABLE', requiresChunkUnlock: false }),
          expect.objectContaining({ itemName: 'Shared usable route', state: 'USABLE', requiresChunkUnlock: false }),
        ],
      }),
      expect.objectContaining({
        chunk: '8,9',
        state: 'BLOCKED',
        steps: [expect.objectContaining({ state: 'BLOCKED', requiresChunkUnlock: true })],
      }),
    ]);
  });

  it('returns fresh readonly-shaped output without mutating the presented analysis', () => {
    const analysis = presentedQuest([
      presentedItem({ id: 'egg-0', routes: [presentedRoute('egg', { steps: [step('Egg', '19,57')] })] }),
    ]);
    const before = structuredClone(analysis);

    const model = buildQuestRouteMapModel(analysis, presentedWalkthrough());

    expect(analysis).toEqual(before);
    expect(model).not.toBe(analysis);
    expect(preparationLayer(model).chunks).not.toBe(analysis.items as unknown as QuestRouteMapModel['layers'][1]['chunks']);
    const firstPreparationStep = preparationLayer(model).chunks[0].steps[0];
    expect(firstPreparationStep.kind).toBe('PREPARATION');
    if (firstPreparationStep.kind !== 'PREPARATION') throw new Error('Expected Preparation');
    expect(firstPreparationStep.blockers).not.toBe(analysis.items[0].routes[0].blockers);
  });
  it('defaults to a numbered Quest path layer and keeps Preparation separate', () => {
    const model = buildQuestRouteMapModel(
      presentedQuest([presentedItem({
        id: 'clay-0',
        routes: [presentedRoute('clay', { steps: [step('Clay rocks', '46,53')] })],
      })]),
      presentedWalkthrough([
        presentedAction({ id: 'doric:talk', sourceOrder: 1 }),
      ], "Doric's Quest"),
    );

    expect(model.defaultLayer).toBe('QUEST_PATH');
    expect(model.layers.map(layer => layer.id)).toEqual(['QUEST_PATH', 'PREPARATION']);
    expect(model.layers[0].chunks.flatMap(chunk => chunk.steps)
      .every(step => step.kind === 'QUEST_ACTION')).toBe(true);
    expect(model.layers[1].chunks.flatMap(chunk => chunk.steps)
      .every(step => step.kind === 'PREPARATION')).toBe(true);
  });

  it('keeps multiple quest actions in one chunk as distinct numbered steps', () => {
    const model = buildQuestRouteMapModel(
      presentedQuest([]),
      presentedWalkthrough([
        presentedAction({ id: 'doric:talk', sourceOrder: 1 }),
        presentedAction({ id: 'doric:return-ores', sourceOrder: 2 }),
      ], "Doric's Quest"),
    );
    const chunk = model.layers[0].chunks.find(candidate => candidate.chunk === '46,53')!;

    expect(chunk.steps.map(step => step.sequence)).toEqual([1, 2]);
    expect(chunk.steps.map(step => step.targetId)).toEqual([
      'doric:talk',
      'doric:return-ores',
    ]);
  });

  it('preserves a mapped Prepare first action as conservative quest-path evidence', () => {
    const model = buildQuestRouteMapModel(
      presentedQuest([]),
      presentedWalkthrough([
        presentedAction({
          id: 'doric:return-ores',
          sourceOrder: 2,
          statusText: 'Prepare first',
          mapChunks: ['46,53'],
          canShowOnMap: true,
        }),
      ], "Doric's Quest"),
    );
    const step = model.layers[0].chunks[0].steps[0];

    expect(step).toMatchObject({
      kind: 'QUEST_ACTION',
      targetId: 'doric:return-ores',
      chunk: '46,53',
      state: 'INCOMPLETE',
      statusText: 'Prepare first',
    });
  });

  it('never gives ambiguous or unmapped actions a Quest path marker', () => {
    const unresolved = presentedAction({
      id: 'elemental-workshop:enter-workshop',
      sourceOrder: 4,
      statusText: 'Location needs review',
      mapChunks: [],
      canShowOnMap: false,
    });
    const model = buildQuestRouteMapModel(
      presentedQuest([]),
      presentedWalkthrough([unresolved], 'Elemental Workshop I'),
    );

    expect(model.layers[0].chunks).toEqual([]);
    expect(model.layers[0].unmappedTargetIds).toContain(
      'elemental-workshop:enter-workshop',
    );
  });
});
