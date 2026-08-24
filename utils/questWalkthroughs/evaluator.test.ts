import { describe, expect, it } from 'vitest';
import { questWalkthroughFor } from '../../data/questWalkthroughs';
import type { QuestItemRouteAnalysis, QuestRouteAnalysisSnapshot } from '../questRoutes/analyzeQuest';
import type { ChunkKey, ItemRouteState, RouteGate } from '../questRoutes/model';
import { evaluateQuestWalkthrough } from './evaluator';
import { resolveQuestWalkthroughLocations } from './locationResolver';
import type {
  QuestWalkthroughActionDefinition,
  QuestWalkthroughDefinition,
  QuestWalkthroughAnalysis,
  ResolvedQuestWalkthrough,
  WalkthroughLocationDirective,
} from './model';

const source: QuestWalkthroughDefinition['source'] = {
  wikiTitle: 'Test Quest/Quick guide',
  wikiRevision: '1',
  wikiRevisionTimestamp: '2026-07-31T00:00:00Z',
  wikiUrl: 'https://oldschool.runescape.wiki/w/Test_Quest/Quick_guide?oldid=1',
  wikiLicence: 'CC BY-NC-SA 3.0',
  wikiLicenceUrl: 'https://creativecommons.org/licenses/by-nc-sa/3.0/',
  chunkPickerRepository: 'source-chunk/chunk-picker-v2',
  chunkPickerCommit: 'test',
  chunkPickerLicenceStatus: 'UNVERIFIED',
};

const action = (
  id: string,
  location: WalkthroughLocationDirective = { kind: 'EXPLICIT_CHUNKS', chunks: ['46,53'] },
  overrides: Partial<QuestWalkthroughActionDefinition> = {},
): QuestWalkthroughActionDefinition => ({
  id,
  section: 'QUEST',
  sourceOrder: 1,
  kind: 'TALK_TO',
  confidence: 'EXACT',
  displayText: id,
  rawWikiLineIds: [],
  dependsOn: [],
  entities: [],
  items: [],
  gates: [],
  location,
  ...overrides,
});

const quest = (
  actions: readonly QuestWalkthroughActionDefinition[],
  questId = 'Test Quest',
): QuestWalkthroughDefinition => ({
  questId,
  revision: 'walkthrough-revision',
  releaseStatus: 'PREVIEW_ONLY',
  source,
  sourceLines: [],
  actions,
});

const snapshot = (
  unlockedChunks: readonly ChunkKey[] = ['46,53'],
  unlockOverrides: Partial<QuestRouteAnalysisSnapshot['unlocks']> = {},
): QuestRouteAnalysisSnapshot => ({
  chunkDataVersion: 1,
  reviewedRequirements: {
    questId: 'Test Quest',
    wikiRevision: 'fixture-revision',
    reviewedAt: '2026-08-22',
    items: [],
  },
  unlockedChunks,
  unlocks: {
    skills: {}, levels: {}, regions: [], chunks: [], quests: [], guilds: [], merchants: [],
    minigames: [], mobility: [], slayerUnlocks: [], ...unlockOverrides,
  },
  itemSourceRecords: [],
  recipes: [],
  entityLocations: [],
  stationRequirements: [],
  sourceCoverage: [],
  connectGraph: {},
});

const resolved = (
  actions: readonly QuestWalkthroughActionDefinition[],
  entityLocations: QuestRouteAnalysisSnapshot['entityLocations'] = [],
): ResolvedQuestWalkthrough => resolveQuestWalkthroughLocations(
  quest(actions),
  { entityLocations },
);

const resolvedWithExactLocations = (
  definition: QuestWalkthroughDefinition,
  chunk: ChunkKey = '46,53',
): ResolvedQuestWalkthrough => ({
  ...definition,
  source: { ...definition.source },
  sourceLines: definition.sourceLines.map(line => ({ ...line })),
  actions: definition.actions.map(entry => ({
    ...entry,
    rawWikiLineIds: [...entry.rawWikiLineIds],
    dependsOn: [...entry.dependsOn],
    entities: entry.entities.map(entity => ({ ...entity })),
    items: entry.items.map(item => ({ ...item, item: { ...item.item } })),
    gates: entry.gates.map(gate => ({ ...gate })),
    definition: entry,
    location: {
      confidence: 'EXACT',
      evidenceKind: 'EXPLICIT_CHUNK',
      chunks: [chunk],
      candidateChunks: [],
      explanation: 'Test-authoritative chunk.',
    },
  })),
});

const itemAnalysis = (
  itemKey: string,
  state: ItemRouteState = 'OBTAINABLE_NOW',
): QuestItemRouteAnalysis => ({
  requirement: {
    item: { key: itemKey, name: itemKey.replace(/w/g, letter => letter.toUpperCase()) },
    quantity: 1,
    supplyPolicy: 'PLAYER_OBTAINED',
  },
  state,
  currentRoutes: [],
  missingChunkRoutes: [],
  missingChunkOptions: [],
  dataNotes: state === 'DATA_INCOMPLETE' ? ['Source coverage is incomplete.'] : [],
});

describe('quest walkthrough evaluation', () => {
  it('reports all locked action chunks instead of stopping at the first', () => {
    const result = evaluateQuestWalkthrough(resolved([
      action('first', { kind: 'EXPLICIT_CHUNKS', chunks: ['46,53'] }),
      action('second', { kind: 'EXPLICIT_CHUNKS', chunks: ['50,50'] }, { sourceOrder: 2 }),
    ]), snapshot([]), []);

    expect(result.actions.flatMap(entry => entry.blockers)
      .filter(blocker => blocker.kind === 'CHUNK')).toHaveLength(2);
    expect(result.status).toBe('BLOCKED');
  });

  it('accepts exact and reviewed locations when every authoritative chunk is unlocked', () => {
    const result = evaluateQuestWalkthrough(resolved([
      action('exact'),
      action('reviewed', {
        kind: 'REVIEWED_ALIAS',
        alias: 'Reviewed place',
        chunks: ['50,50'],
        reviewer: 'Reviewer',
        reviewedAt: '2026-07-31',
        evidence: 'Pinned evidence.',
        rationale: 'Reviewed mapping.',
      }, { confidence: 'REVIEWED', sourceOrder: 2 }),
    ]), snapshot(['46,53', '50,50']), []);

    expect(result.actions.map(entry => entry.state)).toEqual(['READY_HERE', 'READY_HERE']);
    expect(result.status).toBe('READY');
  });

  it('marks ambiguous and unmapped spatial actions for location review', () => {
    const result = evaluateQuestWalkthrough(resolved([
      action('ambiguous', { kind: 'EXACT_ENTITY', entity: { kind: 'npc', name: 'Doric' } }, {
        entities: [{ kind: 'npc', name: 'Doric' }],
      }),
      action('unmapped', { kind: 'NONE' }, { confidence: 'UNMAPPED', sourceOrder: 2 }),
    ], [{
      name: 'Doric', kind: 'npc', locations: [{ cx: 46, cy: 53 }, { cx: 47, cy: 53 }],
    }]), snapshot(['46,53', '47,53']), []);

    expect(result.actions.map(entry => entry.state)).toEqual([
      'LOCATION_NEEDS_REVIEW',
      'LOCATION_NEEDS_REVIEW',
    ]);
    expect(result.blockers.map(blocker => blocker.kind)).toEqual(['LOCATION', 'LOCATION']);
    expect(result.status).toBe('INCOMPLETE');
    expect(result.hasIncompleteEvidence).toBe(true);
  });

  it('treats non-spatial information without machine requirements as informational', () => {
    const result = evaluateQuestWalkthrough(resolved([
      action('notice', { kind: 'NONE' }, { kind: 'INFORMATION', confidence: 'UNMAPPED' }),
    ]), snapshot([]), []);

    expect(result.actions[0].state).toBe('INFORMATION');
    expect(result.actions[0].blockers).toEqual([]);
    expect(result.status).toBe('READY');
  });

  it('uses canonical skill-tier and method-capped level checks', () => {
    const miningGate: RouteGate = {
      type: 'SKILL', skill: 'Mining', level: 30, label: 'Mining level 30',
    };
    const walkthrough = resolved([action('mine', undefined, { gates: [miningGate] })]);

    const lockedTier = evaluateQuestWalkthrough(walkthrough, snapshot(['46,53'], {
      skills: { Mining: 2 }, levels: { Mining: 30 },
    }), []);
    const unlockedTier = evaluateQuestWalkthrough(walkthrough, snapshot(['46,53'], {
      skills: { Mining: 3 }, levels: { Mining: 30 },
    }), []);

    expect(lockedTier.actions[0]).toMatchObject({
      state: 'REQUIREMENT_MISSING',
      blockers: [{ kind: 'GATE', gate: miningGate }],
    });
    expect(unlockedTier.actions[0].state).toBe('READY_HERE');
  });

  it('uses the shared gate evaluator for quest, unlock, and unresolved manual gates', () => {
    const gates: RouteGate[] = [
      { type: 'QUEST', questId: 'Rune Mysteries', label: 'Rune Mysteries' },
      { type: 'UNLOCK', category: 'merchants', id: 'Sawmill Operators', label: 'Sawmill Operators' },
      { type: 'UNRESOLVED', label: 'Manual proof required', raw: 'Manual proof required' },
    ];
    const result = evaluateQuestWalkthrough(resolved([
      action('gated', undefined, { gates }),
    ]), snapshot(['46,53'], { quests: ['Rune Mysteries'] }), []);

    expect(result.actions[0].blockers).toEqual([
      { kind: 'GATE', gate: gates[1], label: 'Sawmill Operators' },
      { kind: 'GATE', gate: gates[2], label: 'Manual proof required' },
    ]);
    expect(result.actions[0].state).toBe('REQUIREMENT_MISSING');
  });

  it('propagates blockers only from actual dependencies and preserves ready siblings', () => {
    const gate: RouteGate = { type: 'QUEST', questId: 'Rune Mysteries', label: 'Rune Mysteries' };
    const result = evaluateQuestWalkthrough(resolved([
      action('blocked-root', undefined, { gates: [gate] }),
      action('ready-sibling', undefined, { sourceOrder: 2 }),
      action('dependent', undefined, { sourceOrder: 3, dependsOn: ['blocked-root'] }),
    ]), snapshot(), []);

    expect(result.actions.map(entry => [entry.definition.id, entry.state])).toEqual([
      ['blocked-root', 'REQUIREMENT_MISSING'],
      ['ready-sibling', 'READY_HERE'],
      ['dependent', 'REQUIREMENT_MISSING'],
    ]);
    expect(result.actions[2].blockers.filter(blocker => blocker.kind === 'DEPENDENCY'))
      .toEqual([{ kind: 'DEPENDENCY', actionId: 'blocked-root', label: 'blocked-root' }]);
    expect(result.actions[1].blockers.filter(blocker => blocker.kind === 'DEPENDENCY')).toEqual([]);
  });

  it('propagates incomplete prerequisite evidence without inflating known blockers', () => {
    const result = evaluateQuestWalkthrough(resolved([
      action('unmapped-root', { kind: 'NONE' }, { confidence: 'UNMAPPED' }),
      action('dependent', undefined, { sourceOrder: 2, dependsOn: ['unmapped-root'] }),
    ]), snapshot(), []);

    expect(result.actions.map(entry => [entry.definition.id, entry.state])).toEqual([
      ['unmapped-root', 'LOCATION_NEEDS_REVIEW'],
      ['dependent', 'LOCATION_NEEDS_REVIEW'],
    ]);
    expect(result.actions[1].blockers).toEqual([]);
    expect(result.blockers).toEqual([
      expect.objectContaining({ kind: 'LOCATION' }),
    ]);
    expect(result.status).toBe('INCOMPLETE');
    expect(result.hasIncompleteEvidence).toBe(true);
  });

  it("joins every Daddy's Home building prerequisite before returning to Yarlo", () => {
    const definition = questWalkthroughFor("Daddy's Home")!;
    const analyses = ['plank', 'bolt of cloth', 'nails'].map(key => itemAnalysis(
      key,
      key === 'plank' ? 'NO_CURRENT_SOURCE' : 'OBTAINABLE_NOW',
    ));
    const result = evaluateQuestWalkthrough(
      resolvedWithExactLocations(definition),
      snapshot(),
      analyses,
    );
    const returnAction = result.actions.find(
      entry => entry.definition.id === 'daddys-home:return-to-yarlo',
    )!;

    expect(returnAction.blockers.filter(blocker => blocker.kind === 'DEPENDENCY'))
      .toEqual([
        {
          kind: 'DEPENDENCY',
          actionId: 'daddys-home:lay-carpet',
          label: 'Lay the new carpet.',
        },
        {
          kind: 'DEPENDENCY',
          actionId: 'daddys-home:build-furniture',
          label: 'Build the new wooden furniture at the white translucent hotspots.',
        },
        {
          kind: 'DEPENDENCY',
          actionId: 'daddys-home:build-bed',
          label: 'Build the waxwood bed.',
        },
      ]);
    expect(returnAction.state).toBe('REQUIREMENT_MISSING');
  });

  it('keeps a currently obtainable item as preparation, not impossible proof', () => {
    const result = evaluateQuestWalkthrough(resolved([
      action('return-ores', undefined, {
        items: [{
          item: { key: 'iron ore', name: 'Iron ore' },
          quantity: 2,
          supplyPolicy: 'PLAYER_OBTAINED',
        }],
      }),
    ]), snapshot(), [itemAnalysis('iron ore', 'OBTAINABLE_NOW')]);

    expect(result.actions[0]).toMatchObject({
      state: 'READY_HERE',
      itemPreparation: [{
        itemKey: 'iron ore',
        analysisState: 'OBTAINABLE_NOW',
        obtainableNow: true,
      }],
    });
    expect(result.status).toBe('READY');
  });

  it.each(['NO_CURRENT_SOURCE', 'ROUTE_BLOCKED'] as const)(
    'blocks on %s item evidence',
    (state) => {
      const result = evaluateQuestWalkthrough(resolved([
        action('return-ores', undefined, {
          items: [{
            item: { key: 'iron ore', name: 'Iron ore' },
            quantity: 2,
            supplyPolicy: 'PLAYER_OBTAINED',
          }],
        }),
      ]), snapshot(), [itemAnalysis('iron ore', state)]);

      expect(result.status).toBe('BLOCKED');
      expect(result.blockers).toContainEqual(
        expect.objectContaining({ kind: 'ITEM', itemKey: 'iron ore' }),
      );
    },
  );

  it('matches item route evidence by canonical item key', () => {
    const result = evaluateQuestWalkthrough(resolved([
      action('clay', undefined, {
        items: [{
          item: { key: 'clay', name: 'Clay' },
          quantity: 6,
          supplyPolicy: 'PLAYER_OBTAINED',
        }],
      }),
    ]), snapshot(), [
      itemAnalysis('iron ore', 'ROUTE_BLOCKED'),
      itemAnalysis('clay', 'OBTAINABLE_NOW'),
    ]);

    expect(result.actions[0].state).toBe('READY_HERE');
    expect(result.actions[0].itemPreparation).toEqual([
      { itemKey: 'clay', analysisState: 'OBTAINABLE_NOW', obtainableNow: true },
    ]);
  });

  it('keeps incomplete item evidence out of known blockers', () => {
    const result = evaluateQuestWalkthrough(resolved([
      action('clay', undefined, {
        items: [{
          item: { key: 'clay', name: 'Clay' },
          quantity: 6,
          supplyPolicy: 'PLAYER_OBTAINED',
        }],
      }),
    ]), snapshot(), [itemAnalysis('clay', 'DATA_INCOMPLETE')]);

    expect(result.actions[0]).toMatchObject({
      state: 'ITEM_EVIDENCE_INCOMPLETE',
      blockers: [],
      itemPreparation: [{
        itemKey: 'clay',
        analysisState: 'DATA_INCOMPLETE',
        obtainableNow: false,
      }],
    });
    expect(result.status).toBe('INCOMPLETE');
    expect(result.hasIncompleteEvidence).toBe(true);
  });

  it('does not request external acquisition for quest-provided items', () => {
    const result = evaluateQuestWalkthrough(resolved([
      action('receive-saw', undefined, {
        items: [{
          item: { key: 'saw', name: 'Saw' },
          quantity: 1,
          supplyPolicy: 'QUEST_PROVIDED',
        }],
      }),
    ]), snapshot(), []);

    expect(result.actions[0]).toMatchObject({
      state: 'READY_HERE',
      blockers: [],
      itemPreparation: [],
    });
    expect(result.status).toBe('READY');
  });

  it('uses known blockers before incomplete location evidence', () => {
    const result = evaluateQuestWalkthrough(resolved([
      action('locked'),
      action('unmapped', { kind: 'NONE' }, { confidence: 'UNMAPPED', sourceOrder: 2 }),
    ]), snapshot([]), []);

    expect(result.status).toBe('BLOCKED');
    expect(result.hasIncompleteEvidence).toBe(true);
  });

  it('retains blockers in deterministic source and declaration order', () => {
    const gate: RouteGate = {
      type: 'QUEST', questId: 'Rune Mysteries', label: 'Rune Mysteries',
    };
    const result = evaluateQuestWalkthrough(resolved([
      action('later', undefined, { sourceOrder: 2 }),
      action('first', { kind: 'EXPLICIT_CHUNKS', chunks: ['46,53', '50,50'] }, {
        gates: [gate],
      }),
    ]), snapshot([]), []);

    expect(result.actions.map(entry => entry.definition.id)).toEqual(['first', 'later']);
    expect(result.blockers.map(blocker => (
      blocker.kind === 'CHUNK' ? blocker.chunk : blocker.label
    ))).toEqual(['46,53', '50,50', 'Rune Mysteries', '46,53']);
  });

  it('retains every pinned pilot source line for downstream presentation', () => {
    const definition = questWalkthroughFor('Elemental Workshop I')!;
    const result = evaluateQuestWalkthrough(
      resolvedWithExactLocations(definition),
      snapshot(),
      [],
    );

    expect(result.sourceLines).toEqual(definition.sourceLines);
    expect(result.sourceLines.find(line => line.id.endsWith('getting-started-4'))?.rawText)
      .toBe('There is a knife spawn in the house north of the church if you forgot to bring one.');
  });
  it('returns deeply immutable proof analysis', () => {
    const result = evaluateQuestWalkthrough(resolved([
      action('clay', undefined, {
        items: [{
          item: { key: 'clay', name: 'Clay' },
          quantity: 6,
          supplyPolicy: 'PLAYER_OBTAINED',
        }],
      }),
    ]), snapshot(), [itemAnalysis('clay')]);

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.actions)).toBe(true);
    expect(Object.isFrozen(result.actions[0])).toBe(true);
    expect(Object.isFrozen(result.actions[0].definition)).toBe(true);
    expect(Object.isFrozen(result.actions[0].location)).toBe(true);
    expect(Object.isFrozen(result.actions[0].blockers)).toBe(true);
    expect(Object.isFrozen(result.actions[0].itemPreparation)).toBe(true);
  });
  it('preserves the walkthrough release status for presentation attribution', () => {
    const definition: QuestWalkthroughDefinition = {
      ...quest([action('approved')]),
      releaseStatus: 'APPROVED',
    };
    const result = evaluateQuestWalkthrough(
      resolvedWithExactLocations(definition),
      snapshot(),
      [],
    );

    expect((result as QuestWalkthroughAnalysis & { readonly releaseStatus?: string }).releaseStatus)
      .toBe('APPROVED');
  });
});
