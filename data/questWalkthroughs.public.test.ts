import { describe, expect, it } from 'vitest';
import { loadQuestWalkthroughFor } from './questWalkthroughLoader';
import { questWalkthroughFor } from './questWalkthroughs.public';

const PUBLIC_QUEST_IDS = [
  "Cook's Assistant",
  'Sheep Shearer',
  'The Restless Ghost',
  'Rune Mysteries',
  'Imp Catcher',
] as const;

const PUBLIC_QUICK_GUIDE_REVISIONS = {
  "Cook's Assistant": {
    revision: '15238952',
    timestamp: '2026-06-24T23:03:17Z',
  },
  'Sheep Shearer': {
    revision: '14457888',
    timestamp: '2023-08-26T20:09:01Z',
  },
  'The Restless Ghost': {
    revision: '15070492',
    timestamp: '2025-11-28T02:58:15Z',
  },
  'Rune Mysteries': {
    revision: '15205463',
    timestamp: '2026-05-03T11:22:42Z',
  },
  'Imp Catcher': {
    revision: '14649872',
    timestamp: '2024-05-05T03:30:56Z',
  },
} as const;

describe('public RuneProof walkthrough catalogue', () => {
  it('contains exactly the five independently authored launch guides', () => {
    expect(PUBLIC_QUEST_IDS.map(questId => questWalkthroughFor(questId)?.questId)).toEqual(PUBLIC_QUEST_IDS);
    expect(questWalkthroughFor("Daddy's Home")).toBeUndefined();
    expect(questWalkthroughFor("Doric's Quest")).toBeUndefined();
    expect(questWalkthroughFor('Elemental Workshop I')).toBeUndefined();
  });

  it('does not carry Chunk Picker task or provenance data into the public guides', () => {
    const guides = PUBLIC_QUEST_IDS
      .map(questId => questWalkthroughFor(questId))
      .filter((guide): guide is NonNullable<typeof guide> => guide !== undefined);

    expect(guides).toHaveLength(PUBLIC_QUEST_IDS.length);
    expect(guides.every(guide => guide.releaseStatus === 'APPROVED')).toBe(true);
    expect(guides.every(guide => guide.source.kind === 'INDEPENDENT_REVIEW')).toBe(true);
    expect(guides.every(guide => !('chunkPickerRepository' in guide.source))).toBe(true);
    expect(guides.every(guide => guide.actions.every(action => action.chunkPickerTaskId === undefined))).toBe(true);
    expect(guides.every(guide => guide.actions.every(action => action.location.kind === 'EXPLICIT_CHUNKS'))).toBe(true);
    expect(guides.every(guide => guide.sourceLines.length === 0)).toBe(true);
  });

  it('pins every public step to the reviewed Wave 1 chunk sequence', () => {
    const route = (questId: string) => questWalkthroughFor(questId)?.actions.map(action => (
      action.location.kind === 'EXPLICIT_CHUNKS' ? action.location.chunks[0] : null
    ));

    expect(route("Cook's Assistant")).toEqual([
      '50,50', '50,50', '50,50', '50,51', '50,51', '49,51', '49,51', '50,50', '50,50',
    ]);
    expect(route('Sheep Shearer')).toEqual(['49,51', '49,51', '50,50', '49,51', '49,51']);
    expect(route('The Restless Ghost')).toEqual([
      '50,50', '49,49', '50,49', '48,49', '50,49', '50,49', '50,49',
    ]);
    expect(route('Rune Mysteries')).toEqual(['50,50', '48,49', '50,53', '48,49', '48,49']);
    expect(route('Imp Catcher')).toEqual(['48,50', '48,50', '48,50', '48,50', '48,49', '48,49']);
  });

  it('keeps Cook\'s Assistant on the local mill route', () => {
    const guideText = questWalkthroughFor("Cook's Assistant")?.actions
      .map(action => action.displayText)
      .join(' ');

    expect(guideText).toMatch(/Mill Lane Mill/i);
    expect(guideText).not.toMatch(/Black Knight/i);
  });

  it('attributes each public guide to its pinned Quick guide revision', () => {
    for (const questId of PUBLIC_QUEST_IDS) {
      const guide = questWalkthroughFor(questId);
      const expected = PUBLIC_QUICK_GUIDE_REVISIONS[questId];
      expect(guide?.source).toMatchObject({
        wikiRevision: expected.revision,
        wikiRevisionTimestamp: expected.timestamp,
      });
      expect(guide?.source.wikiUrl).toContain(`oldid=${expected.revision}`);
    }
  });

  it('makes clear that the Restless Ghost altar skeleton does not need to be fought', () => {
    const skullStep = questWalkthroughFor('The Restless Ghost')?.actions.find(
      action => action.id === 'the-restless-ghost:take-skull',
    );

    expect(skullStep?.displayText).toBe(
      "Search the altar in the Wizards' Tower basement for the ghost's skull, then leave without fighting the skeleton.",
    );
  });

  it('loads an approved public guide only when the release revision agrees', async () => {
    const release = {
      questId: "Cook's Assistant",
      revision: 'runeproof-public-cooks-assistant-v1',
      releaseStatus: 'APPROVED' as const,
    };

    await expect(loadQuestWalkthroughFor('PUBLIC', release)).resolves.toMatchObject({
      questId: "Cook's Assistant",
      revision: release.revision,
      releaseStatus: 'APPROVED',
    });
    await expect(loadQuestWalkthroughFor('PUBLIC', {
      ...release,
      revision: 'stale-public-release',
    })).resolves.toBeUndefined();
  });
});
