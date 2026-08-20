import { describe, expect, it } from 'vitest';
import {
  collectWalkthroughEntityRequests,
  questWalkthroughFor,
  validateQuestWalkthroughCatalogue,
} from './questWalkthroughs';
import generatedCatalogue from './questWalkthroughs.generated.json';
import { loadQuestWalkthroughFor } from './questWalkthroughLoader';
import { questWalkthroughReleaseFor } from './questWalkthroughRelease';
import { questStrategyFromWalkthrough } from '../utils/questStrategies/model';

const PILOT_QUEST_IDS = [
  "Cook's Assistant",
  "Daddy's Home",
  "Doric's Quest",
  'Elemental Workshop I',
] as const;

const validFixture = (): any => ({
  phase: 'REVIEWED',
  walkthroughs: [{
    questId: "Doric's Quest",
    revision: 'revision-is-checked-after-structure',
    releaseStatus: 'PREVIEW_ONLY',
    source: {
      wikiTitle: "Doric's Quest/Quick guide",
      wikiRevision: '14457895',
      wikiRevisionTimestamp: '2023-08-26T20:09:15Z',
      wikiUrl: 'https://oldschool.runescape.wiki/w/Doric%27s_Quest/Quick_guide?oldid=14457895',
      wikiLicence: 'CC BY-NC-SA 3.0',
      wikiLicenceUrl: 'https://creativecommons.org/licenses/by-nc-sa/3.0/',
      chunkPickerRepository: 'source-chunk/chunk-picker-v2',
      chunkPickerCommit: 'ba2fcebf8b26c84c74f8d9ab328a0ede802be926',
      chunkPickerLicenceStatus: 'UNVERIFIED',
    },
    sourceLines: [
      { id: 'line-1', section: 'Walkthrough', sourceOrder: 1, rawText: 'Talk to Doric.' },
      { id: 'line-2', section: 'Walkthrough', sourceOrder: 2, rawText: 'Bring him ore.' },
    ],
    actions: [
      {
        id: 'talk-doric', section: 'QUEST', sourceOrder: 1, kind: 'TALK_TO', confidence: 'EXACT',
        displayText: 'Talk to Doric.', rawWikiLineIds: ['line-1'], chunkPickerTaskId: 'doric',
        dependsOn: [], entities: [{ kind: 'npc', name: 'Doric' }], items: [], gates: [],
        location: { kind: 'EXACT_ENTITY', entity: { kind: 'npc', name: 'Doric' } },
      },
      {
        id: 'bring-ore', section: 'QUEST', sourceOrder: 2, kind: 'INFORMATION', confidence: 'EXACT',
        displayText: 'Bring him ore.', rawWikiLineIds: ['line-2'], dependsOn: ['talk-doric'],
        entities: [{ kind: 'npc', name: 'Doric' }, { kind: 'object', name: 'Ore chest' }],
        items: [], gates: [], location: { kind: 'NONE' },
      },
    ],
  }],
});

describe('local walkthrough loader', () => {
  it('loads only matching reviewed definitions in explicit preview mode', async () => {
    const release = questWalkthroughReleaseFor("Cook's Assistant")!;

    await expect(loadQuestWalkthroughFor('OFF', release)).resolves.toBeUndefined();
    await expect(loadQuestWalkthroughFor('PREVIEW', release)).resolves.toMatchObject({
      questId: release.questId,
      revision: release.revision,
    });
    await expect(loadQuestWalkthroughFor('PREVIEW', {
      ...release,
      revision: 'stale-review-revision',
    })).resolves.toBeUndefined();
  });

  it("materializes Cook's Assistant as the reviewed nine-action coach route", async () => {
    const release = questWalkthroughReleaseFor("Cook's Assistant")!;
    const walkthrough = await loadQuestWalkthroughFor('PREVIEW', release);
    const strategy = walkthrough && questStrategyFromWalkthrough(walkthrough);

    expect(strategy?.actions.map(action => ({
      id: action.id,
      instruction: action.displayText,
      method: action.coach.preferredMethod,
    }))).toEqual([
      { id: 'cooks-assistant:start-quest', instruction: 'Talk to the Cook in Lumbridge Castle.', method: undefined },
      { id: 'cooks-assistant:take-pot', instruction: 'Pick up the empty pot beside the Cook in Lumbridge Castle.', method: { kind: 'DIRECT_SOURCE', itemKey: 'pot', sourceLabel: 'Pot' } },
      { id: 'cooks-assistant:take-bucket', instruction: 'Pick up the bucket from the Lumbridge Castle cellar.', method: { kind: 'DIRECT_SOURCE', itemKey: 'bucket', sourceLabel: 'Bucket' } },
      { id: 'cooks-assistant:milk-cow', instruction: 'Use the bucket on a dairy cow in the Lumbridge cow field.', method: { kind: 'TRANSFORMATION', recipeId: 'milk-cow' } },
      { id: 'cooks-assistant:take-egg', instruction: 'Pick up the egg at the chicken farm beside the cow field.', method: { kind: 'DIRECT_SOURCE', itemKey: 'egg', sourceLabel: 'Egg' } },
      { id: 'cooks-assistant:pick-grain', instruction: 'Pick grain outside Mill Lane Mill.', method: { kind: 'TRANSFORMATION', recipeId: 'pick-wheat' } },
      { id: 'cooks-assistant:make-flour', instruction: 'Use the grain in Mill Lane Mill and collect the flour in the pot.', method: { kind: 'TRANSFORMATION', recipeId: 'grain-to-flour' } },
      { id: 'cooks-assistant:return-to-cook', instruction: 'Return to the Cook with the bucket of milk, egg, and pot of flour.', method: undefined },
      { id: 'cooks-assistant:complete', instruction: "Cook's Assistant complete.", method: undefined },
    ]);
  });

  it("preserves Cook's Assistant's canonical source-line ownership", () => {
    const walkthrough = questWalkthroughFor("Cook's Assistant")!;

    expect(Object.fromEntries(walkthrough.actions.map(action => [
      action.id,
      action.rawWikiLineIds,
    ]))).toEqual({
      'cooks-assistant:start-quest': ['cooks-assistant-walkthrough-6'],
      'cooks-assistant:take-pot': ['cooks-assistant-walkthrough-2'],
      'cooks-assistant:take-bucket': [],
      'cooks-assistant:milk-cow': ['cooks-assistant-walkthrough-3'],
      'cooks-assistant:take-egg': ['cooks-assistant-walkthrough-4'],
      'cooks-assistant:pick-grain': ['cooks-assistant-walkthrough-5'],
      'cooks-assistant:make-flour': [],
      'cooks-assistant:return-to-cook': ['cooks-assistant-walkthrough-1'],
      'cooks-assistant:complete': ['cooks-assistant-walkthrough-7'],
    });
  });

  it("pins Cook's local cow and mill actions to reviewed chunk aliases with provenance", () => {
    const walkthrough = questWalkthroughFor("Cook's Assistant")!;
    const actionById = new Map(walkthrough.actions.map(action => [action.id, action]));

    expect([
      'cooks-assistant:milk-cow',
      'cooks-assistant:pick-grain',
      'cooks-assistant:make-flour',
    ].map(id => {
      const action = actionById.get(id)!;
      return {
        id,
        confidence: action.confidence,
        entities: action.entities,
        location: action.location,
      };
    })).toEqual([
      {
        id: 'cooks-assistant:milk-cow',
        confidence: 'REVIEWED',
        entities: [{ kind: 'object', name: 'Dairy cow' }],
        location: {
          kind: 'REVIEWED_ALIAS',
          alias: "Groats' Farm",
          chunks: ['50,51'],
          reviewer: 'OpenAI Codex',
          reviewedAt: '2026-08-20',
          evidence: "Pinned Wiki source line cooks-assistant-walkthrough-3 names the Lumbridge cow field; the pinned Chunk Picker content entry Groats' Farm (50,51) lists Dairy cow.",
          rationale: 'Only chunk precision is claimed for the quest-local dairy cow; the review does not claim an exact tile.',
        },
      },
      {
        id: 'cooks-assistant:pick-grain',
        confidence: 'REVIEWED',
        entities: [{ kind: 'object', name: 'Wheat' }],
        location: {
          kind: 'REVIEWED_ALIAS',
          alias: 'Mill Lane Mill',
          chunks: ['49,51'],
          reviewer: 'OpenAI Codex',
          reviewedAt: '2026-08-20',
          evidence: 'Pinned Wiki source line cooks-assistant-walkthrough-5 names Mill Lane Mill and grain outside; the pinned Chunk Picker content entry Lumbridge Mill (49,51) lists Wheat and Hopper.',
          rationale: 'Only chunk precision is claimed for the quest-local grain; the review does not claim an exact plant or tile.',
        },
      },
      {
        id: 'cooks-assistant:make-flour',
        confidence: 'REVIEWED',
        entities: [{ kind: 'object', name: 'Hopper' }],
        location: {
          kind: 'REVIEWED_ALIAS',
          alias: 'Mill Lane Mill',
          chunks: ['49,51'],
          reviewer: 'OpenAI Codex',
          reviewedAt: '2026-08-20',
          evidence: 'Pinned Wiki source line cooks-assistant-walkthrough-5 names the hopper inside Mill Lane Mill; the pinned Chunk Picker content entry Lumbridge Mill (49,51) lists Wheat and Hopper.',
          rationale: 'Only chunk precision is claimed for the quest-local hopper; the review does not claim an exact floor or tile.',
        },
      },
    ]);
  });
});

const duplicateActionFixture = () => {
  const fixture = validFixture();
  fixture.walkthroughs[0].actions[1].id = 'talk-doric';
  return fixture;
};

const missingDependencyFixture = () => {
  const fixture = validFixture();
  fixture.walkthroughs[0].actions[1].dependsOn = ['missing-action'];
  return fixture;
};

const cyclicFixture = () => {
  const fixture = validFixture();
  fixture.walkthroughs[0].actions[0].dependsOn = ['bring-ore'];
  return fixture;
};

describe('quest walkthrough catalogue', () => {
  it('contains exactly the four reviewed pilot quests', () => {
    expect([
      "Cook's Assistant",
      "Daddy's Home",
      "Doric's Quest",
      'Elemental Workshop I',
    ].map(questId => questWalkthroughFor(questId)?.questId)).toEqual([
      "Cook's Assistant",
      "Daddy's Home",
      "Doric's Quest",
      'Elemental Workshop I',
    ]);
  });

  it('rejects duplicate action IDs, missing dependency targets, and cycles', () => {
    expect(() => validateQuestWalkthroughCatalogue(duplicateActionFixture())).toThrow(
      /duplicate action id/i,
    );
    expect(() => validateQuestWalkthroughCatalogue(missingDependencyFixture())).toThrow(
      /missing dependency/i,
    );
    expect(() => validateQuestWalkthroughCatalogue(cyclicFixture())).toThrow(/cycle/i);
  });

  it('returns deduplicated exact entity requests for snapshot materialization', () => {
    expect(collectWalkthroughEntityRequests(validFixture().walkthroughs[0] as any)).toEqual([
      { kind: 'npc', name: 'Doric' },
      { kind: 'object', name: 'Ore chest' },
    ]);
  });

  for (const questId of PILOT_QUEST_IDS) {
    it(`${questId} preserves every source line exactly once`, () => {
      const walkthrough = questWalkthroughFor(questId)!;
      const used = walkthrough.actions.flatMap(action => action.rawWikiLineIds).sort();
      expect(used).toEqual(walkthrough.sourceLines.map(line => line.id).sort());
      expect(walkthrough.actions.length).toBeGreaterThan(0);
    });
  }

  it("preserves Daddy's Home parallel construction branches before their join", () => {
    const quest = questWalkthroughFor("Daddy's Home")!;
    const yarloReturn = quest.actions.find(action => action.id === 'daddys-home:return-to-yarlo')!;
    expect(yarloReturn.dependsOn).toEqual(expect.arrayContaining([
      'daddys-home:lay-carpet',
      'daddys-home:build-furniture',
      'daddys-home:build-bed',
    ]));
  });

  it('does not silently map the Elemental Workshop instance', () => {
    const quest = questWalkthroughFor('Elemental Workshop I')!;
    expect(quest.actions.some(action => (
      action.location.kind === 'REVIEWED_ALIAS'
      && action.location.alias === 'Elemental Workshop'
    ))).toBe(true);
  });
});
describe('quest walkthrough catalogue validation', () => {
  const expectRejected = (mutate: (fixture: any) => void, message: RegExp) => {
    const fixture = validFixture();
    mutate(fixture);
    expect(() => validateQuestWalkthroughCatalogue(fixture)).toThrow(message);
  };

  it('rejects unsupported quest IDs and invalid source-line coverage', () => {
    expectRejected(fixture => { fixture.walkthroughs[0].questId = 'Unsupported Quest'; }, /unsupported quest/i);
    expectRejected(fixture => { fixture.walkthroughs[0].sourceLines[1].id = 'line-1'; }, /duplicate.*wiki line/i);
    expectRejected(fixture => { fixture.walkthroughs[0].actions[1].rawWikiLineIds = []; }, /used by zero actions/i);
    expectRejected(fixture => { fixture.walkthroughs[0].actions[1].rawWikiLineIds = ['line-1']; }, /more than one action/i);
  });

  it('rejects invalid action and source metadata', () => {
    expectRejected(fixture => { fixture.walkthroughs[0].actions[0].kind = 'NOT_A_KIND'; }, /action kind/i);
    expectRejected(fixture => { fixture.walkthroughs[0].source.wikiRevision = ''; }, /wiki revision/i);
    expectRejected(fixture => { fixture.walkthroughs[0].source.wikiUrl = 'https://oldschool.runescape.wiki/w/Doric%27s_Quest/Quick_guide'; }, /permanent.*url/i);
    expectRejected(fixture => { fixture.walkthroughs[0].source.wikiLicence = ''; }, /wiki licence/i);
    expectRejected(fixture => { fixture.walkthroughs[0].source.wikiLicenceUrl = ''; }, /wiki licence url/i);
  });

  it('rejects invalid chunk and confidence claims', () => {
    expectRejected(fixture => {
      fixture.walkthroughs[0].actions[0].location = { kind: 'EXPLICIT_CHUNKS', chunks: ['not-a-chunk'] };
    }, /chunk/i);
    expectRejected(fixture => {
      fixture.walkthroughs[0].actions[0].confidence = 'REVIEWED';
      fixture.walkthroughs[0].actions[0].location = { kind: 'EXPLICIT_CHUNKS', chunks: ['27,48'] };
    }, /reviewed.*reviewer/i);
    expectRejected(fixture => {
      fixture.walkthroughs[0].actions[0].confidence = 'AMBIGUOUS';
      fixture.walkthroughs[0].actions[0].location = { kind: 'EXPLICIT_CHUNKS', chunks: ['27,48'] };
    }, /ambiguous.*authoritative/i);
    expectRejected(fixture => {
      fixture.walkthroughs[0].actions[0].location = { kind: 'INHERITED_TARGET' };
    }, /inherited target/i);
  });

  it('rejects public unlicensed chunk-picker data', () => {
    expectRejected(fixture => { fixture.walkthroughs[0].releaseStatus = 'APPROVED'; }, /permission/i);
  });

  it('keeps non-information actions without locations visibly unmapped', () => {
    expectRejected(fixture => {
      fixture.walkthroughs[0].actions[0].kind = 'ACQUIRE';
      fixture.walkthroughs[0].actions[0].entities = [];
      fixture.walkthroughs[0].actions[0].location = { kind: 'NONE' };
    }, /spatial action.*ambiguous or unmapped/i);
  });
});

describe('quest walkthrough catalogue review fixes', () => {
  const expectRejected = (mutate: (fixture: any) => void, message: RegExp) => {
    const fixture = validFixture();
    mutate(fixture);
    expect(() => validateQuestWalkthroughCatalogue(fixture)).toThrow(message);
  };
  it('requires the complete pilot quest-ID set', () => {
    const catalogue = structuredClone(generatedCatalogue) as any;
    catalogue.walkthroughs.pop();
    expect(() => validateQuestWalkthroughCatalogue(catalogue)).toThrow(/exactly.*pilot quests/i);
  });

  it('rejects the temporary source-bootstrap runtime phase', () => {
    const catalogue = structuredClone(generatedCatalogue) as any;
    catalogue.phase = 'SOURCE_BOOTSTRAP';
    expect(() => validateQuestWalkthroughCatalogue(catalogue)).toThrow(/phase.*reviewed/i);
  });

  it('requires an evidence record for every reviewed alias', () => {
    expectRejected(fixture => {
      fixture.walkthroughs[0].actions[0].confidence = 'REVIEWED';
      fixture.walkthroughs[0].actions[0].location = {
        kind: 'REVIEWED_ALIAS',
        alias: "Doric's hut",
        chunks: ['46,53'],
        reviewer: 'Reviewer',
        reviewedAt: '2026-07-31',
        rationale: 'Doric is the exact quest target.',
      };
    }, /reviewed evidence/i);
  });

  it('rejects malformed walkthrough item references', () => {
    expectRejectedItem({ item: { key: ' ', name: 'Clay' }, quantity: 1, supplyPolicy: 'PLAYER_OBTAINED' }, /item key/i);
    expectRejectedItem({ item: { key: 'clay', name: 'Clay' }, quantity: 0, supplyPolicy: 'PLAYER_OBTAINED' }, /item quantity/i);
    expectRejectedItem({ item: { key: 'clay', name: 'Clay' }, quantity: 1, supplyPolicy: 'ANYWHERE' }, /supply policy/i);
  });

  it('rejects malformed walkthrough route gates', () => {
    expectRejectedGate({ type: 'QUEST', label: 'Quest' }, /quest gate id/i);
    expectRejectedGate({ type: 'SKILL', label: 'Mining', skill: 'Mining', level: 0 }, /skill gate level/i);
    expectRejectedGate({ type: 'UNLOCK', label: 'Unlock', category: 'invalid', id: 'gate' }, /unlock gate category/i);
    expectRejectedGate({ type: 'UNRESOLVED', label: 'Unknown' }, /unresolved gate raw/i);
  });

  it('requires a permanent Wiki URL to match its Wiki title and origin', () => {
    expectRejected(fixture => {
      fixture.walkthroughs[0].source.wikiUrl = 'https://example.com/w/Doric%27s_Quest/Quick_guide?oldid=14457895';
    }, /wiki url.*origin/i);
    expectRejected(fixture => {
      fixture.walkthroughs[0].source.wikiUrl = 'https://oldschool.runescape.wiki/w/Cook%27s_Assistant/Quick_guide?oldid=14457895';
    }, /wiki url.*title/i);
  });

  const expectRejectedItem = (item: unknown, message: RegExp) => {
    expectRejected(fixture => { fixture.walkthroughs[0].actions[0].items = [item]; }, message);
  };

  const expectRejectedGate = (gate: unknown, message: RegExp) => {
    expectRejected(fixture => { fixture.walkthroughs[0].actions[0].gates = [gate]; }, message);
  };
});
