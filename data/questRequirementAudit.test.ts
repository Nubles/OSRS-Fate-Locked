import { describe, expect, it } from 'vitest';
import official from './sources/quest-list.json';
import audit from './sources/quest-requirement-audit.json';
import { QUEST_DATA } from './questData';
import {
  questRequirementFingerprint,
  validateQuestRequirementAudit,
} from './questRequirementAudit';

const expectReviewedBatch = (start: string, end?: string) => {
  const rows = audit.entries.filter(entry =>
    entry.kind === 'quest' &&
    entry.id.localeCompare(start) >= 0 &&
    (end === undefined || entry.id.localeCompare(end) < 0));

  expect(rows.length).toBeGreaterThan(0);
  expect(rows.flatMap(entry => {
    const quest = QUEST_DATA[entry.id];
    if (!quest) return [`${entry.id}:missing-runtime`];
    if (!entry.source.url.startsWith('https://oldschool.runescape.wiki/w/')) {
      return [`${entry.id}:unstable-source-url`];
    }
    if (!Number.isInteger(entry.source.revision) || entry.source.revision <= 0) {
      return [`${entry.id}:missing-source-revision`];
    }
    if (entry.chunkSourceCommit !== 'ba2fcebf8b26c84c74f8d9ab328a0ede802be926') {
      return [`${entry.id}:wrong-chunk-source`];
    }
    if (entry.requirementFingerprint !== questRequirementFingerprint(quest)) {
      return [`${entry.id}:stale-fingerprint`];
    }
    if (entry.status === 'unresolved' &&
        (!entry.discrepancy || !entry.conservativeReason)) {
      return [`${entry.id}:unexplained-unresolved`];
    }
    return [];
  })).toEqual([]);
};

describe('official quest and miniquest audit coverage', () => {
  it('matches official, runtime, and audit IDs one-to-one', () => {
    expect(validateQuestRequirementAudit(QUEST_DATA, official, audit).errors)
      .toEqual([]);
  });

  it('pins the current reviewed baseline by explicit kind', () => {
    expect(official.entries.filter(entry => entry.kind === 'quest')).toHaveLength(188);
    expect(official.entries.filter(entry => entry.kind === 'miniquest')).toHaveLength(19);
    expect(Object.values(QUEST_DATA).filter(entry => entry.kind === 'quest')).toHaveLength(188);
    expect(Object.values(QUEST_DATA).filter(entry => entry.kind === 'miniquest')).toHaveLength(19);
  });

  it('matches every runtime requirement fingerprint', () => {
    const byId = new Map(audit.entries.map(entry => [entry.id, entry]));
    expect(Object.values(QUEST_DATA).flatMap(quest => {
      const entry = byId.get(quest.id);
      return entry?.requirementFingerprint === questRequirementFingerprint(quest)
        ? []
        : [quest.id];
    })).toEqual([]);
  });

  it('reviews every A-F quest', () => expectReviewedBatch('A', 'G'));

  it('reviews every G-M quest', () => expectReviewedBatch('G', 'N'));

  it('leaves no unexplained G-M review placeholders', () => {
    expect(audit.entries
      .filter(entry =>
        entry.kind === 'quest' &&
        entry.id.localeCompare('G') >= 0 &&
        entry.id.localeCompare('N') < 0 &&
        entry.status === 'unresolved')
      .map(entry => entry.id))
      .toEqual([]);
  });

  it('leaves only the concrete A-F alternative-requirement conflict unresolved', () => {
    expect(audit.entries
      .filter(entry =>
        entry.kind === 'quest' &&
        entry.id.localeCompare('A') >= 0 &&
        entry.id.localeCompare('G') < 0 &&
        entry.status === 'unresolved')
      .map(entry => entry.id))
      .toEqual(['Desert Treasure I']);
  });

  it('has reviewed evidence and matching requirements for all 19 miniquests', () => {
    const rows = audit.entries.filter(entry => entry.kind === 'miniquest');
    expect(rows).toHaveLength(19);
    expect(rows.flatMap(entry => {
      if (entry.status !== 'unresolved') return [];
      return entry.discrepancy && entry.conservativeReason ? [] : [entry.id];
    })).toEqual([]);
    expect(rows.flatMap(entry => {
      const quest = QUEST_DATA[entry.id];
      return entry.requirementFingerprint === questRequirementFingerprint(quest)
        ? []
        : [entry.id];
    })).toEqual([]);
  });

  it('leaves only the two concrete miniquest evidence conflicts unresolved', () => {
    expect(audit.entries
      .filter(entry => entry.kind === 'miniquest' && entry.status === 'unresolved')
      .map(entry => entry.id))
      .toEqual(['Bear Your Soul', 'The Enchanted Key']);
  });

  it('records concrete source gaps for every generated discrepancy category', () => {
    const byId = new Map(audit.entries.map(entry => [entry.id, entry]));
    const cases = [
      {
        id: 'Desert Treasure I',
        discrepancy: ['regions policy', 'Kharidian Desert', 'Bedabin Camp', '49,47', 'The Dig Site'],
      },
      {
        id: 'Pandemonium',
        discrepancy: ['locations policy', 'Port Sarim', '47,50'],
      },
      {
        id: 'Prying Times',
        discrepancy: ['manual requirement', 'One open Sailing task slot'],
      },
      {
        id: 'Nature Spirit',
        discrepancy: ['prerequisite', 'Priest in Peril'],
      },
    ];

    for (const example of cases) {
      const entry = byId.get(example.id)!;
      for (const detail of example.discrepancy) {
        expect(entry.discrepancy, `${example.id}: ${detail}`).toContain(detail);
      }
      expect(entry.conservativeReason, example.id).toContain(example.id);
      expect(entry.conservativeReason, example.id).toContain(`${entry.accessPolicy} policy`);
      expect(entry.conservativeReason, example.id).toMatch(/premature completion\/key-roll eligibility/i);
    }
  });

  it("pins reviewed Witch's Potion and Murder Mystery source evidence", () => {
    const byId = new Map(audit.entries.map(entry => [entry.id, entry]));

    expect(byId.get("Witch's Potion")).toMatchObject({
      status: 'verified-with-notes',
      accessPolicy: 'locations',
      source: { revision: 15166776 },
      chunkEvidence: [{ chunkId: '46,50', role: 'first', place: 'Rimmington' }],
    });
    expect(byId.get("Witch's Potion")?.notes.items).toEqual([
      'An eye of newt may be obtained before the quest; Port Sarim travel and item possession are not machine-enforced.',
    ]);
    expect(byId.get('Murder Mystery')).toMatchObject({
      status: 'verified',
      accessPolicy: 'locations',
      source: { revision: 15271664 },
      chunkEvidence: [
        { chunkId: '42,55', role: 'first', place: 'Sinclair Mansion' },
        { chunkId: '42,54', role: 'step', place: "Seers' Village" },
      ],
    });
  });

  it('rejects generic procedural unresolved placeholders', () => {
    const generic = structuredClone(audit);
    const unresolved = generic.entries.find(entry => entry.id === 'Desert Treasure I')!;
    unresolved.discrepancy =
      'Pending review of the permanent Wiki and Chunk Picker sources.';
    unresolved.conservativeReason =
      'Retained until Tasks 6-11 finish the review.';

    expect(validateQuestRequirementAudit(QUEST_DATA, official, generic).errors)
      .toEqual(expect.arrayContaining([
        expect.stringContaining('generic procedural discrepancy'),
        expect.stringContaining('does not explain premature completion/key-roll eligibility'),
      ]));
  });
});
