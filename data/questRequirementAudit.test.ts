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

  it('records concrete source gaps for every generated discrepancy category', () => {
    const byId = new Map(audit.entries.map(entry => [entry.id, entry]));
    const cases = [
      {
        id: 'Cook\'s Assistant',
        discrepancy: ['regions policy', 'Misthalin', 'Lumbridge Castle', '50,50'],
      },
      {
        id: 'Witch\'s Potion',
        discrepancy: ['regions policy', 'Asgarnia', 'no pinned Chunk Picker first/step activity chunk'],
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
