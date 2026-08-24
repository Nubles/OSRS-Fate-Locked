import { describe, expect, it } from 'vitest';
import questList from '../data/sources/quest-list.json';
import audit from '../data/sources/quest-requirement-audit.json';
import f2p from '../data/sources/f2p-quest-membership.json';
import overrides from '../data/sources/runeproof-complexity-overrides.json';
import { QUEST_DATA } from '../data/questData';
import {
  classifyRuneProofComplexity,
  generateRuneProofCatalogue,
} from './runeproof-catalogue-source.mjs';
import { validateRuneProofQuestCatalogue } from '../data/runeProofQuestCatalogue';

describe('RuneProof catalogue source', () => {
  it('classifies the three unresolved audits into milestone 5', () => {
    for (const questId of ['Bear Your Soul', 'Desert Treasure I', 'The Enchanted Key']) {
      const assessment = classifyRuneProofComplexity({
        quest: { difficulty: 'QUEST_NOVICE', prereqs: [], skills: {}, regions: [] },
        audit: { status: 'unresolved', notes: { items: [], travel: [], instances: [], partialCompletion: [] } },
        prerequisiteDepth: 0,
      });
      expect(assessment.assignedMilestone).toBe(5);
      expect(assessment.flags).toContain('UNRESOLVED_AUDIT');
    }
  });

  it('normalizes script and runtime difficulty spellings identically', () => {
    const base = {
      prereqs: [], skills: {}, regions: [], oneOf: [], manualRequirements: [],
    };
    const reviewed = {
      status: 'verified',
      notes: { items: [], travel: [], instances: [], partialCompletion: [] },
    };
    expect(classifyRuneProofComplexity({
      quest: { ...base, difficulty: 'QUEST_MASTER' },
      audit: reviewed,
      prerequisiteDepth: 0,
    })).toEqual(classifyRuneProofComplexity({
      quest: { ...base, difficulty: 'Quest (Master)' },
      audit: reviewed,
      prerequisiteDepth: 0,
    }));
  });

  it('generates one unique, sourced entry for every normalized identity', () => {
    const snapshot = generateRuneProofCatalogue({
      questList,
      audit,
      f2p,
      overrides,
      questData: QUEST_DATA,
    });
    expect(snapshot.entries).toHaveLength(210);
    expect(snapshot.entries.filter(entry => entry.kind === 'quest')).toHaveLength(191);
    expect(snapshot.entries.filter(entry => entry.kind === 'miniquest')).toHaveLength(19);
    expect(snapshot.entries.filter(entry => entry.membership === 'F2P')).toHaveLength(23);
    expect(snapshot.entries.filter(entry => entry.membership === 'MEMBERS')).toHaveLength(187);
    expect(snapshot.entries.filter(entry => entry.milestone === 1)).toHaveLength(5);
    expect(snapshot.entries.filter(entry => entry.milestone === 2)).toHaveLength(18);
    expect(snapshot.entries.filter(entry => entry.milestone === 3)).toHaveLength(91);
    expect(snapshot.entries.filter(entry => entry.milestone === 4)).toHaveLength(62);
    expect(snapshot.entries.filter(entry => entry.milestone === 5)).toHaveLength(34);
    expect(new Set(snapshot.entries.map(entry => entry.questId)).size).toBe(210);
    expect(new Set(snapshot.entries.map(entry => entry.slug)).size).toBe(210);
    expect(snapshot.entries.map(entry => entry.progressionPriority)).toEqual(
      Array.from({ length: 210 }, (_, index) => index + 1),
    );
    expect(questList.parsedCounts).toEqual({ quests: 192, miniquests: 19 });
    expect(Object.values(QUEST_DATA).reduce(
      (count, quest) => count + quest.prereqs.length, 0,
    )).toBe(258);
    const priority = new Map(snapshot.entries.map(entry =>
      [entry.questId, entry.progressionPriority]));
    for (const quest of Object.values(QUEST_DATA)) {
      for (const prerequisite of quest.prereqs) {
        expect(priority.get(prerequisite)).toBeLessThan(priority.get(quest.id));
      }
    }
    expect(snapshot.entries.filter(entry => entry.questId.startsWith('RFD:'))
      .map(entry => entry.questId).sort()).toEqual([
        'RFD: Dwarf', 'RFD: Evil Dave', 'RFD: Finale', 'RFD: Goblins',
        'RFD: King Awowogei', 'RFD: Lumbridge Guide', 'RFD: Pirate Pete',
        'RFD: Sir Amik Varze', 'RFD: Skrach Uglogwee', 'RFD: The Cook',
      ]);
    expect(snapshot.entries.some(entry => entry.questId === 'Recipe for Disaster')).toBe(false);
  });

  it('generates a runtime-valid snapshot with a reviewed member override', () => {
    const generated = generateRuneProofCatalogue({
      questList,
      audit,
      f2p,
      questData: QUEST_DATA,
      overrides: {
        schemaVersion: 1,
        reviewedAt: '2026-08-22',
        entries: [{
          questId: 'A Porcine of Interest',
          fromMilestone: 3,
          toMilestone: 3,
          reviewer: 'Catalogue reviewer',
          reviewedAt: '2026-08-22',
          reason: 'Positive integration fixture',
        }],
      },
    });

    expect(() => validateRuneProofQuestCatalogue(generated)).not.toThrow();
  });

  it('rejects a member override without a reviewer', () => {
    expect(() => generateRuneProofCatalogue({
      questList,
      audit,
      f2p,
      questData: QUEST_DATA,
      overrides: {
        schemaVersion: 1,
        reviewedAt: '2026-08-22',
        entries: [{
          questId: 'A Porcine of Interest',
          fromMilestone: 3,
          toMilestone: 3,
          reviewer: '',
          reviewedAt: '2026-08-22',
          reason: 'Reviewer is intentionally absent',
        }],
      },
    })).toThrow(/reviewer must be nonblank/);
  });

  it('rejects a member override without a reason', () => {
    expect(() => generateRuneProofCatalogue({
      questList,
      audit,
      f2p,
      questData: QUEST_DATA,
      overrides: {
        schemaVersion: 1,
        reviewedAt: '2026-08-22',
        entries: [{
          questId: 'A Porcine of Interest',
          fromMilestone: 3,
          toMilestone: 3,
          reviewer: 'Catalogue reviewer',
          reviewedAt: '2026-08-22',
          reason: '',
        }],
      },
    })).toThrow(/reason must be nonblank/);
  });

  it('rejects a member override with a dishonest baseline', () => {
    expect(() => generateRuneProofCatalogue({
      questList,
      audit,
      f2p,
      questData: QUEST_DATA,
      overrides: {
        schemaVersion: 1,
        reviewedAt: '2026-08-22',
        entries: [{
          questId: 'A Porcine of Interest',
          fromMilestone: 4,
          toMilestone: 3,
          reviewer: 'Catalogue reviewer',
          reviewedAt: '2026-08-22',
          reason: 'Baseline is intentionally dishonest',
        }],
      },
    })).toThrow(/fromMilestone does not match computed complexity/);
  });

  it('rejects an impossible override review date', () => {
    expect(() => generateRuneProofCatalogue({
      questList,
      audit,
      f2p,
      questData: QUEST_DATA,
      overrides: {
        schemaVersion: 1,
        reviewedAt: '2026-02-31',
        entries: [],
      },
    })).toThrow(/complexity override reviewedAt must be a valid date/);
  });
});
