import { describe, expect, it } from 'vitest';
import type { ExactEntityHit } from '../../data/questRouteRecipes';
import type { QuestRouteAnalysisSnapshot } from '../questRoutes/analyzeQuest';
import type {
  QuestWalkthroughActionDefinition,
  QuestWalkthroughDefinition,
  WalkthroughEntityKind,
  WalkthroughLocationDirective,
} from './model';
import {
  resolveQuestWalkthroughLocations,
  resolveWalkthroughLocations,
} from './locationResolver';
import { questWalkthroughFor } from '../../data/questWalkthroughs';

const entitySnapshot = (
  entityLocations: readonly ExactEntityHit[],
): Pick<QuestRouteAnalysisSnapshot, 'entityLocations'> => ({ entityLocations });

const action = (
  location: WalkthroughLocationDirective,
  overrides: Partial<QuestWalkthroughActionDefinition> = {},
): QuestWalkthroughActionDefinition => ({
  id: 'test:action',
  section: 'QUEST',
  sourceOrder: 1,
  kind: 'TALK_TO',
  confidence: 'EXACT',
  displayText: 'Perform the action.',
  rawWikiLineIds: [],
  dependsOn: [],
  entities: [],
  items: [],
  gates: [],
  location,
  ...overrides,
});

const exactEntityAction = (
  kind: WalkthroughEntityKind,
  name: string,
): QuestWalkthroughActionDefinition => action({
  kind: 'EXACT_ENTITY',
  entity: { kind, name },
}, {
  entities: [{ kind, name }],
});

const multiLocationSawmillOperator = (): ExactEntityHit[] => [{
  name: 'Sawmill operator',
  kind: 'npc',
  locations: [{ cx: 52, cy: 54 }, { cx: 51, cy: 54 }, { cx: 51, cy: 54 }],
}];

const quest = (
  actions: readonly QuestWalkthroughActionDefinition[],
): QuestWalkthroughDefinition => ({
  questId: 'Test Quest',
  revision: 'test-revision',
  releaseStatus: 'PREVIEW_ONLY',
  source: {
    wikiTitle: 'Test Quest/Quick guide',
    wikiRevision: '1',
    wikiRevisionTimestamp: '2026-07-31T00:00:00Z',
    wikiUrl: 'https://oldschool.runescape.wiki/w/Test_Quest/Quick_guide?oldid=1',
    wikiLicence: 'CC BY-NC-SA 3.0',
    wikiLicenceUrl: 'https://creativecommons.org/licenses/by-nc-sa/3.0/',
    chunkPickerRepository: 'source-chunk/chunk-picker-v2',
    chunkPickerCommit: 'test',
    chunkPickerLicenceStatus: 'UNVERIFIED',
  },
  sourceLines: [],
  actions,
});

describe('walkthrough location resolution', () => {
  it('maps Doric through a unique exact NPC match', () => {
    expect(resolveWalkthroughLocations(
      exactEntityAction('npc', 'Doric'),
      entitySnapshot([{
        name: 'Doric',
        kind: 'npc',
        locations: [{ cx: 46, cy: 53 }],
      }]),
    )).toMatchObject({
      confidence: 'EXACT',
      evidenceKind: 'EXACT_ENTITY',
      chunks: ['46,53'],
    });
  });

  it('narrows a multi-location NPC only with an explicit source chunk', () => {
    expect(resolveWalkthroughLocations(action({
      kind: 'EXPLICIT_CHUNKS',
      chunks: ['51,54'],
    }, {
      entities: [{ kind: 'npc', name: 'Sawmill operator' }],
    }), entitySnapshot(multiLocationSawmillOperator()))).toMatchObject({
      confidence: 'EXACT',
      evidenceKind: 'EXPLICIT_CHUNK',
      chunks: ['51,54'],
    });
  });

  it('rejects an explicit chunk that does not intersect a multi-location entity', () => {
    expect(resolveWalkthroughLocations(action({
      kind: 'EXPLICIT_CHUNKS',
      chunks: ['46,53'],
    }, {
      entities: [{ kind: 'npc', name: 'Sawmill operator' }],
    }), entitySnapshot(multiLocationSawmillOperator()))).toMatchObject({
      confidence: 'AMBIGUOUS',
      chunks: [],
      candidateChunks: ['51,54', '52,54'],
    });
  });

  it('keeps multiple explicit intersections informational rather than authoritative', () => {
    expect(resolveWalkthroughLocations(action({
      kind: 'EXPLICIT_CHUNKS',
      chunks: ['51,54', '52,54'],
    }, {
      entities: [{ kind: 'npc', name: 'Sawmill operator' }],
    }), entitySnapshot(multiLocationSawmillOperator()))).toMatchObject({
      confidence: 'AMBIGUOUS',
      chunks: [],
      candidateChunks: ['51,54', '52,54'],
    });
  });

  it('keeps an unresolved duplicate exact entity ambiguous', () => {
    expect(resolveWalkthroughLocations(
      exactEntityAction('npc', 'Sawmill operator'),
      entitySnapshot(multiLocationSawmillOperator()),
    )).toMatchObject({
      confidence: 'AMBIGUOUS',
      chunks: [],
      candidateChunks: ['51,54', '52,54'],
    });
  });

  it("narrows Cook's reviewed cow and mill entities to their local chunks", () => {
    const walkthrough = questWalkthroughFor("Cook's Assistant")!;
    const resolved = resolveQuestWalkthroughLocations(walkthrough, entitySnapshot([
      {
        name: 'Dairy cow',
        kind: 'object',
        locations: [{ cx: 49, cy: 52 }, { cx: 50, cy: 51 }],
      },
      {
        name: 'Wheat',
        kind: 'object',
        locations: [{ cx: 49, cy: 51 }, { cx: 49, cy: 52 }],
      },
      {
        name: 'Hopper',
        kind: 'object',
        locations: [{ cx: 49, cy: 51 }, { cx: 50, cy: 53 }],
      },
    ]));
    const locationById = new Map(resolved.actions.map(action => [
      action.id,
      {
        confidence: action.location.confidence,
        evidenceKind: action.location.evidenceKind,
        chunks: action.location.chunks,
      },
    ]));

    expect(locationById.get('cooks-assistant:milk-cow')).toEqual({
      confidence: 'REVIEWED',
      evidenceKind: 'REVIEWED_ALIAS',
      chunks: ['50,51'],
    });
    expect(locationById.get('cooks-assistant:pick-grain')).toEqual({
      confidence: 'REVIEWED',
      evidenceKind: 'REVIEWED_ALIAS',
      chunks: ['49,51'],
    });
    expect(locationById.get('cooks-assistant:make-flour')).toEqual({
      confidence: 'REVIEWED',
      evidenceKind: 'REVIEWED_ALIAS',
      chunks: ['49,51'],
    });
  });

  it('inherits only an explicit target from the named source action', () => {
    const start = {
      ...exactEntityAction('npc', 'Doric'),
      id: 'dorics-quest:start',
    };
    const inherited = action({
      kind: 'INHERITED_TARGET',
      targetEntity: { kind: 'npc', name: 'Doric' },
      sourceActionId: start.id,
    }, {
      id: 'dorics-quest:return-ores',
      entities: [{ kind: 'npc', name: 'Doric' }],
      dependsOn: [start.id],
    });
    const resolved = resolveQuestWalkthroughLocations(quest([start, inherited]), entitySnapshot([{
      name: 'Doric',
      kind: 'npc',
      locations: [{ cx: 46, cy: 53 }],
    }]));

    expect(resolved.actions.find(candidate => candidate.id.endsWith('return-ores'))?.location)
      .toMatchObject({
        confidence: 'EXACT',
        evidenceKind: 'INHERITED_TARGET',
        chunks: ['46,53'],
        sourceActionId: 'dorics-quest:start',
        sourceEntity: { kind: 'npc', name: 'Doric' },
      });
  });

  it('does not inherit a differently named target or an ambiguous source', () => {
    const source = {
      ...exactEntityAction('npc', 'Sawmill operator'),
      id: 'test:source',
    };
    const inherited = action({
      kind: 'INHERITED_TARGET',
      targetEntity: { kind: 'npc', name: 'Doric' },
      sourceActionId: source.id,
    }, { id: 'test:inherited' });

    expect(resolveQuestWalkthroughLocations(
      quest([source, inherited]),
      entitySnapshot(multiLocationSawmillOperator()),
    ).actions[1].location).toMatchObject({
      confidence: 'UNMAPPED',
      chunks: [],
      sourceActionId: 'test:source',
    });
  });

  it('does not inherit from a listed entity when exact evidence names a different entity', () => {
    const source = {
      ...exactEntityAction('npc', 'Sawmill operator'),
      id: 'test:mixed-source',
      entities: [
        { kind: 'npc' as const, name: 'Sawmill operator' },
        { kind: 'npc' as const, name: 'Doric' },
      ],
    };
    const inherited = action({
      kind: 'INHERITED_TARGET',
      targetEntity: { kind: 'npc', name: 'Doric' },
      sourceActionId: source.id,
    }, { id: 'test:mixed-inherited' });

    const resolved = resolveQuestWalkthroughLocations(
      quest([source, inherited]),
      entitySnapshot([{
        name: 'Sawmill operator',
        kind: 'npc',
        locations: [{ cx: 51, cy: 54 }],
      }]),
    );

    expect(resolved.actions[1].location).toMatchObject({
      confidence: 'UNMAPPED',
      evidenceKind: 'INHERITED_TARGET',
      chunks: [],
      sourceEntity: { kind: 'npc', name: 'Doric' },
      sourceActionId: 'test:mixed-source',
    });
  });

  it('maps the qualified Lumbridge Cook through exact normalized source evidence', () => {
    expect(resolveWalkthroughLocations(
      exactEntityAction('npc', '  cook   (LUMBRIDGE) '),
      entitySnapshot([{
        name: 'Cook (Lumbridge)',
        kind: 'npc',
        locations: [{ cx: 50, cy: 50 }],
      }]),
    )).toMatchObject({ confidence: 'EXACT', chunks: ['50,50'] });
  });

  it('requires both exact entity kind and exact normalized name', () => {
    const snapshot = entitySnapshot([
      { name: 'Doric', kind: 'object', locations: [{ cx: 46, cy: 53 }] },
      { name: 'Doric Jr', kind: 'npc', locations: [{ cx: 46, cy: 53 }] },
    ]);

    expect(resolveWalkthroughLocations(exactEntityAction('npc', 'doric'), snapshot))
      .toMatchObject({ confidence: 'UNMAPPED', chunks: [], candidateChunks: [] });
  });

  it('deduplicates valid explicit chunks deterministically', () => {
    expect(resolveWalkthroughLocations(action({
      kind: 'EXPLICIT_CHUNKS',
      chunks: ['51,54', '46,53', '51,54'],
    }), entitySnapshot([]))).toMatchObject({
      confidence: 'EXACT',
      evidenceKind: 'EXPLICIT_CHUNK',
      chunks: ['46,53', '51,54'],
    });
  });

  it('retains reviewed alias evidence and review metadata', () => {
    const resolved = resolveWalkthroughLocations(action({
      kind: 'REVIEWED_ALIAS',
      alias: 'Elemental Workshop surface access',
      chunks: ['42,54'],
      reviewer: 'OpenAI Codex',
      reviewedAt: '2026-07-31',
      evidence: 'The pinned task proves the surface access chunk.',
      rationale: '42,54 is surface access evidence, not an interior coordinate.',
    }, { confidence: 'REVIEWED' }), entitySnapshot([]));

    expect(resolved).toMatchObject({
      confidence: 'REVIEWED',
      evidenceKind: 'REVIEWED_ALIAS',
      chunks: ['42,54'],
      review: {
        reviewer: 'OpenAI Codex',
        reviewedAt: '2026-07-31',
        evidence: 'The pinned task proves the surface access chunk.',
        rationale: '42,54 is surface access evidence, not an interior coordinate.',
      },
    });
    expect(resolved.explanation).toContain('surface access');
  });

  it('isolates an invalid or out-of-map chunk to its own action', () => {
    const invalid = action({
      kind: 'EXPLICIT_CHUNKS',
      chunks: ['999,999', 'not-a-chunk'] as any,
    }, { id: 'test:invalid' });
    const valid = action({
      kind: 'EXPLICIT_CHUNKS',
      chunks: ['46,53'],
    }, { id: 'test:valid', sourceOrder: 2 });
    const resolved = resolveQuestWalkthroughLocations(quest([invalid, valid]), entitySnapshot([]));

    expect(resolved.actions[0].location).toMatchObject({ confidence: 'UNMAPPED', chunks: [] });
    expect(resolved.actions[1].location).toMatchObject({ confidence: 'EXACT', chunks: ['46,53'] });
  });

  it('accepts NONE for INFORMATION without inventing a spatial location', () => {
    expect(resolveWalkthroughLocations(action({ kind: 'NONE' }, {
      kind: 'INFORMATION',
    }), entitySnapshot([]))).toMatchObject({
      confidence: 'EXACT',
      evidenceKind: 'NONE',
      chunks: [],
      candidateChunks: [],
    });
  });

  it('keeps NONE on a spatial action unmapped', () => {
    expect(resolveWalkthroughLocations(action({ kind: 'NONE' }), entitySnapshot([])))
      .toMatchObject({ confidence: 'UNMAPPED', evidenceKind: 'NONE', chunks: [] });
  });

  it('deep-freezes the final quest resolution', () => {
    const original = exactEntityAction('npc', 'Doric');
    const resolved = resolveQuestWalkthroughLocations(quest([
      original,
    ]), entitySnapshot([{
      name: 'Doric',
      kind: 'npc',
      locations: [{ cx: 46, cy: 53 }],
    }]));

    expect(resolved.actions[0].definition).toEqual(original);
    expect(resolved.actions[0].definition).not.toBe(original);
    expect(Object.isFrozen(resolved)).toBe(true);
    expect(Object.isFrozen(resolved.actions)).toBe(true);
    expect(Object.isFrozen(resolved.actions[0].definition)).toBe(true);
    expect(Object.isFrozen(resolved.actions[0].definition.location)).toBe(true);
    expect(Object.isFrozen(resolved.actions[0].location.chunks)).toBe(true);
  });
});
