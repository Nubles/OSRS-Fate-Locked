import { describe, expect, it } from 'vitest';
import official from './sources/quest-list.json';
import audit from './sources/quest-requirement-audit.json';
import { QUEST_DATA } from './questData';
import {
  questRequirementFingerprint,
  validateQuestRequirementAudit,
} from './questRequirementAudit';

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
        id: 'Cook\'s Assistant',
        discrepancy: ['regions policy', 'Misthalin', 'Lumbridge Castle', '50,50'],
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
        id: 'Holy Grail',
        discrepancy: ['prerequisite', 'Merlin\'s Crystal'],
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
    generic.entries[0].discrepancy =
      'Pending review of the permanent Wiki and Chunk Picker sources.';
    generic.entries[0].conservativeReason =
      'Retained until Tasks 6-11 finish the review.';

    expect(validateQuestRequirementAudit(QUEST_DATA, official, generic).errors)
      .toEqual(expect.arrayContaining([
        expect.stringContaining('generic procedural discrepancy'),
        expect.stringContaining('does not explain premature completion/key-roll eligibility'),
      ]));
  });
});
