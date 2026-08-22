import { describe, expect, it } from 'vitest';
import { questWalkthroughFor } from '../../data/questWalkthroughs';
import type { ChunkKey } from '../questRoutes/model';
import type {
  EvaluatedWalkthroughAction,
  QuestWalkthroughAnalysis,
  WalkthroughLocationEvidenceKind,
  WalkthroughProofActionState,
} from './model';
import { presentQuestWalkthrough } from './presenter';

const source: QuestWalkthroughAnalysis['source'] = {
  wikiTitle: 'Doric\'s Quest/Quick guide',
  wikiRevision: '14457895',
  wikiRevisionTimestamp: '2023-08-26T20:09:15Z',
  wikiUrl: 'https://oldschool.runescape.wiki/w/Doric%27s_Quest/Quick_guide?oldid=14457895',
  wikiLicence: 'CC BY-NC-SA 3.0',
  wikiLicenceUrl: 'https://creativecommons.org/licenses/by-nc-sa/3.0/',
  chunkPickerRepository: 'source-chunk/chunk-picker-v2',
  chunkPickerCommit: 'ba2fcebf8b26c84c74f8d9ab328a0ede802be926',
  chunkPickerLicenceStatus: 'UNVERIFIED',
};

const action = (
  id: string,
  sourceOrder: number,
  state: WalkthroughProofActionState,
  evidenceKind: WalkthroughLocationEvidenceKind = 'EXPLICIT_CHUNK',
  overrides: Partial<EvaluatedWalkthroughAction> = {},
): EvaluatedWalkthroughAction => ({
  definition: {
    id,
    section: 'QUEST',
    sourceOrder,
    kind: 'TALK_TO',
    confidence: 'EXACT',
    displayText: `Do ${id}.`,
    rawWikiLineIds: [`${id}-line-a`, `${id}-line-b`],
    dependsOn: [],
    entities: [],
    items: [],
    gates: [],
    location: { kind: 'EXPLICIT_CHUNKS', chunks: ['46,53'] },
  },
  location: {
    confidence: 'EXACT',
    evidenceKind,
    chunks: ['46,53'],
    candidateChunks: [],
    explanation: 'The tested authoritative location.',
  },
  state,
  blockers: [],
  itemPreparation: [],
  ...overrides,
});

const analysis = (actions: readonly EvaluatedWalkthroughAction[]): QuestWalkthroughAnalysis => ({
  questId: 'Doric\'s Quest',
  releaseStatus: 'PREVIEW_ONLY',
  status: 'READY',
  actions,
  blockers: actions.flatMap(entry => entry.blockers),
  hasIncompleteEvidence: actions.some(entry => (
    entry.state === 'LOCATION_NEEDS_REVIEW' || entry.state === 'ITEM_EVIDENCE_INCOMPLETE'
  )),
  sourceLines: actions.flatMap(entry => entry.definition.rawWikiLineIds.map((id, index) => ({
    id,
    section: 'Walkthrough',
    sourceOrder: entry.definition.sourceOrder + index,
    rawText: `Pinned source wording for ${id}.`,
  }))),
  source,
});

const doricAnalysis = (): QuestWalkthroughAnalysis => analysis([
  action('dorics-quest:prepare-ores', 1, 'READY_HERE', 'EXACT_ENTITY', {
    definition: {
      ...action('unused', 0, 'READY_HERE').definition,
      id: 'dorics-quest:prepare-ores',
      section: 'PREPARE',
      sourceOrder: 1,
      displayText: 'Mine the required ores.',
      items: [
        { item: { key: 'clay', name: 'Clay' }, quantity: 6, supplyPolicy: 'PLAYER_OBTAINED' },
        { item: { key: 'copper ore', name: 'Copper ore' }, quantity: 4, supplyPolicy: 'PLAYER_OBTAINED' },
        { item: { key: 'iron ore', name: 'Iron ore' }, quantity: 2, supplyPolicy: 'PLAYER_OBTAINED' },
      ],
      rawWikiLineIds: ['dorics-quest-walkthrough-2', 'dorics-quest-walkthrough-3'],
    },
    location: {
      confidence: 'EXACT', evidenceKind: 'EXACT_ENTITY', chunks: ['46,53'], candidateChunks: [],
      explanation: 'An exact NPC match for Doric.', sourceEntity: { kind: 'npc', name: 'Doric' },
    },
    itemPreparation: [
      { itemKey: 'clay', analysisState: 'OBTAINABLE_NOW', obtainableNow: true },
      { itemKey: 'copper ore', analysisState: 'OBTAINABLE_NOW', obtainableNow: true },
      { itemKey: 'iron ore', analysisState: 'OBTAINABLE_NOW', obtainableNow: true },
    ],
  }),
  action('dorics-quest:return-ores', 2, 'READY_HERE', 'INHERITED_TARGET', {
    definition: {
      ...action('unused', 0, 'READY_HERE').definition,
      id: 'dorics-quest:return-ores', sourceOrder: 2,
      displayText: 'Return to Doric with the ores.',
      items: [
        { item: { key: 'clay', name: 'Clay' }, quantity: 6, supplyPolicy: 'PLAYER_OBTAINED' },
        { item: { key: 'copper ore', name: 'Copper ore' }, quantity: 4, supplyPolicy: 'PLAYER_OBTAINED' },
        { item: { key: 'iron ore', name: 'Iron ore' }, quantity: 2, supplyPolicy: 'PLAYER_OBTAINED' },
      ],
    },
    location: {
      confidence: 'EXACT', evidenceKind: 'INHERITED_TARGET', chunks: ['46,53'], candidateChunks: [],
      explanation: 'Inherits the exact location from the quest start.',
      sourceActionId: 'dorics-quest:start-quest', sourceEntity: { kind: 'npc', name: 'Doric' },
    },
    itemPreparation: [
      { itemKey: 'clay', analysisState: 'OBTAINABLE_NOW', obtainableNow: true },
      { itemKey: 'copper ore', analysisState: 'OBTAINABLE_NOW', obtainableNow: true },
      { itemKey: 'iron ore', analysisState: 'OBTAINABLE_NOW', obtainableNow: true },
    ],
  }),
]);

const mixedAnalysis = (): QuestWalkthroughAnalysis => analysis([
  action('mapped', 1, 'READY_HERE'),
  action('blocked', 2, 'CHUNK_LOCKED', 'EXPLICIT_CHUNK', {
    blockers: [
      { kind: 'CHUNK', chunk: '46,53', label: 'First locked chunk' },
      { kind: 'CHUNK', chunk: '50,50', label: 'Second locked chunk' },
    ],
  }),
  action('notice', 3, 'INFORMATION', 'NONE', {
    definition: {
      ...action('unused', 0, 'READY_HERE').definition,
      id: 'notice', sourceOrder: 3, kind: 'INFORMATION',
    },
    location: { confidence: 'UNMAPPED', evidenceKind: 'NONE', chunks: [], candidateChunks: [], explanation: 'Informational.' },
  }),
  action('ambiguous', 4, 'LOCATION_NEEDS_REVIEW', 'EXACT_ENTITY', {
    location: {
      confidence: 'AMBIGUOUS', evidenceKind: 'EXACT_ENTITY', chunks: [], candidateChunks: ['46,53', '47,53'],
      explanation: 'Several NPC locations match.', sourceEntity: { kind: 'npc', name: 'Doric' },
    },
  }),
]);

describe('quest walkthrough presentation', () => {
  it('keeps mapped, blocked, informational, and unmapped source lines in order', () => {
    const presented = presentQuestWalkthrough(mixedAnalysis(), new Set());
    expect(presented.actions.map(entry => entry.sourceOrder)).toEqual([1, 2, 3, 4]);
    expect(presented.actions.map(entry => entry.statusText)).toEqual([
      'Ready here', 'Chunk locked', 'Information', 'Location needs review',
    ]);
  });

  it('shows explicit ground preparation wording instead of joining unrelated nouns', () => {
    const presented = presentQuestWalkthrough(doricAnalysis(), new Set());
    expect(presented.actions.find(entry => entry.id.endsWith('prepare-ores'))?.itemNotes)
      .toContain('Obtain 6 Clay using the Preparation routes.');
  });

  it('changes obtainable unconfirmed items to Prepare first without changing proof status', () => {
    const walkthrough = doricAnalysis();
    expect(presentQuestWalkthrough(walkthrough, new Set()).actions
      .find(entry => entry.id.endsWith('return-ores'))?.statusText).toBe('Prepare first');
    expect(presentQuestWalkthrough(walkthrough, new Set(['clay', 'copper ore', 'iron ore'])).actions
      .find(entry => entry.id.endsWith('return-ores'))?.statusText).toBe('Ready here');
    expect(walkthrough.status).toBe('READY');
  });

  it('lists every blocker and keeps raw coordinates out of the instruction', () => {
    const presented = presentQuestWalkthrough(mixedAnalysis(), new Set());
    const blocked = presented.actions.find(entry => entry.id === 'blocked')!;
    expect(blocked.blockerNotes).toEqual(['First locked chunk', 'Second locked chunk']);
    expect(blocked.instruction).not.toContain('46,53');
    expect(blocked.instruction).not.toContain('50,50');
  });

  it('distinguishes evidence kinds, preserves ambiguous candidates, and only maps authoritative chunks', () => {
    const walkthrough = analysis([
      action('explicit', 1, 'READY_HERE', 'EXPLICIT_CHUNK'),
      action('entity', 2, 'READY_HERE', 'EXACT_ENTITY', {
        location: { confidence: 'EXACT', evidenceKind: 'EXACT_ENTITY', chunks: ['46,53'], candidateChunks: [], explanation: 'Exact entity.', sourceEntity: { kind: 'npc', name: 'Doric' } },
      }),
      action('inherited', 3, 'READY_HERE', 'INHERITED_TARGET', {
        location: { confidence: 'EXACT', evidenceKind: 'INHERITED_TARGET', chunks: ['46,53'], candidateChunks: [], explanation: 'Inherited.', sourceEntity: { kind: 'npc', name: 'Doric' }, sourceActionId: 'start' },
      }),
      action('reviewed', 4, 'READY_HERE', 'REVIEWED_ALIAS', {
        location: { confidence: 'REVIEWED', evidenceKind: 'REVIEWED_ALIAS', chunks: ['46,53'], candidateChunks: [], explanation: 'Reviewed.', review: { reviewer: 'A reviewer', reviewedAt: '2026-07-31', evidence: 'Pinned proof.', rationale: 'Alias verified.' } },
      }),
      mixedAnalysis().actions[3],
    ]);
    const presented = presentQuestWalkthrough(walkthrough, new Set());
    expect(presented.actions.slice(0, 4).map(entry => entry.evidenceText)).toEqual(expect.arrayContaining([
      expect.stringContaining('explicit chunk'), expect.stringContaining('exact entity'),
      expect.stringContaining('inherited target'), expect.stringContaining('reviewed alias'),
    ]));
    const ambiguous = presented.actions[4];
    expect(ambiguous.evidenceText).toContain('46,53, 47,53');
    expect(ambiguous.mapChunks).toEqual([]);
    expect(ambiguous.canShowOnMap).toBe(false);
    expect(presented.actions.slice(0, 4).every(entry => entry.canShowOnMap)).toBe(true);
  });

  it('separates Prepare and Quest actions, retains folded source lines, and attributes reusable sources', () => {
    const presented = presentQuestWalkthrough(doricAnalysis(), new Set());
    expect(presented.prepareActions.map(entry => entry.id)).toEqual(['dorics-quest:prepare-ores']);
    expect(presented.questActions.map(entry => entry.id)).toEqual(['dorics-quest:return-ores']);
    expect(presented.actions[0].evidenceText).toContain('dorics-quest-walkthrough-2, dorics-quest-walkthrough-3');
    expect(presented.attribution).toMatchObject({
      wikiUrl: source.wikiUrl, licenceUrl: source.wikiLicenceUrl,
      chunkPickerCommit: source.chunkPickerCommit,
    });
    expect(presented.attribution.reuseStatusText).toContain('PREVIEW_ONLY');
    expect(presented.attribution.reuseStatusText).toContain('UNVERIFIED');
  });

  it('presents an independently authored public guide without Chunk Picker attribution', () => {
    const independent = {
      ...analysis([action('public-guide', 1, 'READY_HERE')]),
      questId: "Cook's Assistant",
      releaseStatus: 'APPROVED' as const,
      source: {
        kind: 'INDEPENDENT_REVIEW' as const,
        author: 'Fate Locked',
        authoredAt: '2026-08-22',
        methodology: 'Independently authored quest steps and F2P chunk locations.',
        wikiTitle: "Cook's Assistant/Quick guide",
        wikiRevision: '15240921',
        wikiRevisionTimestamp: '2026-08-22T00:00:00Z',
        wikiUrl: 'https://oldschool.runescape.wiki/w/Cook%27s_Assistant/Quick_guide?oldid=15240921',
        wikiLicence: 'CC BY-NC-SA 3.0' as const,
        wikiLicenceUrl: 'https://creativecommons.org/licenses/by-nc-sa/3.0/',
      },
    } as QuestWalkthroughAnalysis;

    const presented = presentQuestWalkthrough(independent, new Set());

    expect(presented.attribution).toMatchObject({
      kind: 'INDEPENDENT_REVIEW',
      author: 'Fate Locked',
      authoredAt: '2026-08-22',
      methodology: 'Independently authored quest steps and F2P chunk locations.',
    });
    expect('chunkPickerLabel' in presented.attribution).toBe(false);
    expect('chunkPickerCommit' in presented.attribution).toBe(false);
  });

  it('presents every folded Elemental Workshop source line as pinned human-readable wording', () => {
    const definition = questWalkthroughFor('Elemental Workshop I')!;
    const makeKey = definition.actions.find(
      entry => entry.id === 'elemental-workshop-i:make-battered-key',
    )!;
    const walkthrough: QuestWalkthroughAnalysis = {
      ...analysis([action('placeholder', 1, 'LOCATION_NEEDS_REVIEW')]),
      questId: definition.questId,
      source: definition.source,
      sourceLines: definition.sourceLines,
      actions: [action(makeKey.id, makeKey.sourceOrder, 'LOCATION_NEEDS_REVIEW', 'NONE', {
        definition: makeKey,
        location: {
          confidence: 'UNMAPPED',
          evidenceKind: 'NONE',
          chunks: [],
          candidateChunks: [],
          explanation: 'This spatial action has no authoritative location evidence.',
        },
      })],
    };

    expect(presentQuestWalkthrough(walkthrough, new Set()).actions[0].sourceWording).toEqual([
      {
        id: 'elemental-workshop-i-getting-started-3',
        text: 'Read the book, then use a [[knife]] on it to get a [[Battered key]].',
      },
      {
        id: 'elemental-workshop-i-getting-started-4',
        text: 'There is a knife spawn in the house north of the church if you forgot to bring one.',
      },
      {
        id: 'elemental-workshop-i-getting-started-5',
        text: "'''Note:''' You'll need the book later, so don't get rid of it.",
      },
    ]);
  });

  it('does not present a dependency with incomplete location evidence as ready', () => {
    const presented = presentQuestWalkthrough(analysis([
      action('dependent', 2, 'LOCATION_NEEDS_REVIEW'),
    ]), new Set()).actions[0];

    expect(presented.statusText).toBe('Location needs review');
    expect(presented.blockerNotes).toEqual([]);
  });

  it('uses approved and permission-recorded attribution without claiming preview-only reuse', () => {
    const approved = {
      ...doricAnalysis(),
      releaseStatus: 'APPROVED' as const,
      source: { ...source, chunkPickerLicenceStatus: 'PERMISSION_RECORDED' as const },
    } as QuestWalkthroughAnalysis & { readonly releaseStatus: 'APPROVED' };
    const presented = presentQuestWalkthrough(approved, new Set());

    expect(presented.attribution.reuseStatusText).toContain('APPROVED');
    expect(presented.attribution.reuseStatusText).toContain('PERMISSION_RECORDED');
    expect(presented.attribution.reuseStatusText).not.toContain('PREVIEW_ONLY');
  });
  it('presents incomplete acquisition evidence as Prepare first without claiming readiness', () => {
    const incomplete = analysis([action('incomplete-item', 1, 'ITEM_EVIDENCE_INCOMPLETE', 'EXPLICIT_CHUNK', {
      definition: {
        ...action('unused', 0, 'READY_HERE').definition, id: 'incomplete-item',
        items: [{ item: { key: 'clay', name: 'Clay' }, quantity: 6, supplyPolicy: 'PLAYER_OBTAINED' }],
      },
      itemPreparation: [{ itemKey: 'clay', analysisState: 'DATA_INCOMPLETE', obtainableNow: false }],
    })]);
    const presented = presentQuestWalkthrough(incomplete, new Set(['clay'])).actions[0];
    expect(presented.statusText).toBe('Prepare first');
    expect(presented.statusText).not.toBe('Ready here');
    expect(presented.itemNotes.join(' ')).toContain('Acquisition data is incomplete');
  });

  it('returns deterministic deeply immutable presentation without changing analysis', () => {
    const walkthrough = doricAnalysis();
    const first = presentQuestWalkthrough(walkthrough, new Set());
    const second = presentQuestWalkthrough(walkthrough, new Set());
    expect(first).toEqual(second);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.actions)).toBe(true);
    expect(Object.isFrozen(first.actions[0])).toBe(true);
    expect(Object.isFrozen(first.actions[0].itemNotes)).toBe(true);
    expect(walkthrough.actions[0].state).toBe('READY_HERE');
  });
});
