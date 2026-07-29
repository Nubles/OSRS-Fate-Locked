import { describe, expect, it } from 'vitest';
import { QUEST_DATA, type QuestData } from '../../data/questData';
import questAuditJson from '../../data/sources/quest-requirement-audit.json';
import {
  compileItemGoal,
  compileProductionActivityGoals,
  compileProductionDiaryGoals,
  compileProductionQuestGoals,
  compileQuestGoal,
  compileQuestGoals,
  compileStructuredGoal,
  toGoalEvaluationInput,
  type ProofGradeGoalAudit,
  type StructuredGoalDefinition,
} from './goalCompiler';
import { questRequirementFingerprint, type QuestRequirementAuditEntry } from '../../data/questRequirementAudit';

const location = {
  id: 'test-workshop',
  label: 'Test Workshop',
  standardAreas: ['Test Area'],
  chunkOptions: [{ cx: 1, cy: 2 }],
};

function quest(overrides: Partial<QuestData> = {}): QuestData {
  return {
    id: 'Test Quest',
    name: 'Test Quest',
    kind: 'quest',
    accessPolicy: 'locations',
    regions: ['Test Region'],
    locations: [location],
    skills: { Magic: 12, Smithing: 7 },
    prereqs: ['Earlier Quest'],
    items: [{ item: 'Bronze bar', quantity: 2, consumed: true }],
    itemAlternatives: [
      [{ item: 'Knife', quantity: 1, consumed: false }],
      [
        { item: 'Chisel', quantity: 1, consumed: false },
        { item: 'Hammer', quantity: 1, consumed: false },
      ],
    ],
    oneOf: [
      { capabilities: ['Fairy Rings'] },
      { quests: ['Alternative Route'], skills: { Agility: 30 } },
    ],
    points: 1,
    difficulty: QUEST_DATA["Cook's Assistant"].difficulty,
    ...overrides,
  };
}

function verifiedQuestAudit(value: QuestData): QuestRequirementAuditEntry {
  return {
    id: value.id,
    kind: value.kind,
    status: 'verified',
    reviewedAt: '2026-07-29T00:00:00.000Z',
    source: {
      url: 'https://oldschool.runescape.wiki/w/index.php?title=Test_Quest&oldid=123',
      revision: 123,
      revisionTimestamp: '2026-07-28T00:00:00.000Z',
    },
    chunkSourceCommit: 'abc123',
    accessPolicy: value.accessPolicy,
    requirementFingerprint: questRequirementFingerprint(value),
    chunkEvidence: [{
      chunkId: '1,2',
      role: 'first',
      place: 'Test Workshop',
    }],
    notes: { items: [], travel: [], instances: [], partialCompletion: [] },
  };
}

function proofAudit(definition: StructuredGoalDefinition): ProofGradeGoalAudit {
  return {
    status: 'VERIFIED',
    sourceId: 'test-source',
    sourceVersion: 'revision-123',
    requirementFingerprint: JSON.stringify(definition),
  };
}

describe('goal compiler', () => {
  it('compiles a canonical item identity and positive quantity without possession state', () => {
    const goal = compileItemGoal({
      id: 'item:oak-plank',
      label: 'Oak plank',
    }, 4);

    expect(goal).toMatchObject({
      id: 'item:oak-plank',
      kind: 'ITEM',
      label: 'Oak plank',
      coverage: 'VERIFIED',
      requirement: {
        op: 'FACT',
        fact: {
          id: 'item:oak-plank',
          kind: 'ITEM',
          label: 'Oak plank',
          quantity: 4,
        },
      },
    });
    expect(JSON.stringify(goal)).not.toContain('possess');
    expect(() => compileItemGoal({ id: 'item:oak-plank', label: 'Oak plank' }, 0))
      .toThrow(/positive integer/i);
    expect(() => compileItemGoal({ id: 'item:wrong', label: 'Oak plank' }, 1))
      .toThrow(/canonical item identity/i);
  });

  it('compiles exact quest facts into stable ALL and preserves nested ANY alternatives', () => {
    const value = quest();
    const goal = compileQuestGoal(value, verifiedQuestAudit(value));

    expect(goal.coverage).toBe('VERIFIED');
    expect(goal.requirement).toEqual({
      op: 'ALL',
      terms: [
        { op: 'ANY', terms: [
          { op: 'ALL', terms: [
            { op: 'FACT', fact: { id: 'capability:fairy-rings', kind: 'CAPABILITY', label: 'Fairy Rings' } },
          ] },
          { op: 'ALL', terms: [
            { op: 'FACT', fact: { id: 'quest:alternative-route', kind: 'QUEST', label: 'Alternative Route' } },
            { op: 'FACT', fact: { id: 'skill-level:agility', kind: 'SKILL_LEVEL', label: 'Agility', quantity: 30 } },
          ] },
        ] },
        { op: 'ANY', terms: [
          { op: 'ALL', terms: [
            { op: 'FACT', fact: { id: 'item:chisel', kind: 'ITEM', label: 'Chisel' } },
            { op: 'FACT', fact: { id: 'item:hammer', kind: 'ITEM', label: 'Hammer' } },
          ] },
          { op: 'ALL', terms: [
            { op: 'FACT', fact: { id: 'item:knife', kind: 'ITEM', label: 'Knife' } },
          ] },
        ] },
        { op: 'FACT', fact: { id: 'item:bronze-bar', kind: 'ITEM', label: 'Bronze bar', quantity: 2 } },
        { op: 'FACT', fact: { id: 'location:test-workshop', kind: 'LOCATION', label: 'Test Workshop' } },
        { op: 'FACT', fact: { id: 'quest:earlier-quest', kind: 'QUEST', label: 'Earlier Quest' } },
        { op: 'FACT', fact: { id: 'skill-level:magic', kind: 'SKILL_LEVEL', label: 'Magic', quantity: 12 } },
        { op: 'FACT', fact: { id: 'skill-level:smithing', kind: 'SKILL_LEVEL', label: 'Smithing', quantity: 7 } },
      ],
    });

    const reordered = quest({
      skills: { Smithing: 7, Magic: 12 },
      itemAlternatives: [...value.itemAlternatives!].reverse(),
      oneOf: [...value.oneOf!].reverse(),
    });
    expect(JSON.stringify(compileQuestGoal(reordered, verifiedQuestAudit(reordered)).requirement))
      .toBe(JSON.stringify(goal.requirement));
    expect(Object.isFrozen(goal)).toBe(true);
    expect(Object.isFrozen((goal.requirement as { terms: unknown[] }).terms)).toBe(true);
  });

  it('fails quest coverage closed for notes, unresolved, stale, manual, or region-only evidence', () => {
    const value = quest();
    const exact = verifiedQuestAudit(value);
    const cases: Array<[QuestData, QuestRequirementAuditEntry | undefined]> = [
      [value, { ...exact, status: 'verified-with-notes' }],
      [value, { ...exact, status: 'unresolved', discrepancy: 'x', conservativeReason: 'x' }],
      [value, { ...exact, requirementFingerprint: 'stale' }],
      [value, { ...exact, chunkEvidence: [{ chunkId: '9,9', role: 'first', place: 'Wrong' }] }],
      [quest({ manualRequirements: ['Do something unmodelled'] }), undefined],
      [quest({ accessPolicy: 'regions', locations: undefined }), undefined],
    ];
    for (const [input, audit] of cases) {
      expect(compileQuestGoal(input, audit).coverage).toBe('UNKNOWN');
    }
  });

  it('compiles diary and activity definitions through the same exact expression model', () => {
    const definition: StructuredGoalDefinition = {
      id: 'Proof Goal',
      label: 'Proof Goal',
      skills: { Cooking: 20 },
      quests: ['Cook Quest'],
      items: [{ item: 'Raw fish', quantity: 3, consumed: true }],
      capabilities: ['Range access'],
      locations: [{ id: 'proof-kitchen', label: 'Proof Kitchen' }],
      alternatives: [
        { items: [{ item: 'Logs', quantity: 2, consumed: true }] },
        { skills: { Firemaking: 30 } },
      ],
    };
    const diary = compileStructuredGoal('DIARY', definition, proofAudit(definition));
    const activity = compileStructuredGoal('ACTIVITY', definition, proofAudit(definition));

    expect(diary.coverage).toBe('VERIFIED');
    expect(activity.requirement).toEqual(diary.requirement);
    expect(JSON.stringify(diary.requirement)).toContain('"op":"ANY"');
    expect(JSON.stringify(diary.requirement)).toContain('"quantity":3');
    expect(diary.id).toBe('diary:proof-goal');
    expect(activity.id).toBe('activity:proof-goal');
    expect(toGoalEvaluationInput(diary)).toEqual({
      goalId: 'diary:proof-goal',
      requirement: diary.requirement,
      coverage: 'VERIFIED',
      sourceVersion: diary.sourceVersion,
    });
  });

  it('does not verify diary or activity requirements without proof-grade locations', () => {
    const definition: StructuredGoalDefinition = {
      id: 'No Location',
      label: 'No Location',
      skills: { Fishing: 10 },
    };
    expect(compileStructuredGoal('DIARY', definition, proofAudit(definition)).coverage)
      .toBe('UNKNOWN');
    expect(compileStructuredGoal('ACTIVITY', definition, proofAudit(definition)).coverage)
      .toBe('UNKNOWN');
  });
  it('retains PARTIAL only for explicit proof-grade structured audits', () => {
    const definition: StructuredGoalDefinition = {
      id: 'Partial Goal', label: 'Partial Goal',
      locations: [{ id: 'partial-place', label: 'Partial Place' }],
    };
    expect(compileStructuredGoal('DIARY', definition, {
      ...proofAudit(definition), status: 'PARTIAL',
    }).coverage).toBe('PARTIAL');
    expect(compileStructuredGoal('DIARY', {
      ...definition, unstructuredEvidence: ['Missing authored requirement'],
    }, { ...proofAudit(definition), status: 'PARTIAL' }).coverage).toBe('UNKNOWN');
  });
  it('binds sourceVersion and provenance to exact content and audit revisions', () => {
    const value = quest();
    const audit = verifiedQuestAudit(value);
    const first = compileQuestGoal(value, audit);
    const changedRevision = compileQuestGoal(value, {
      ...audit,
      source: { ...audit.source, revision: 124, url: audit.source.url.replace('123', '124') },
    });
    const changedContent = compileQuestGoal(
      quest({ skills: { ...value.skills, Magic: 13 } }),
      undefined,
    );

    expect(first.provenanceIds).toEqual([...first.provenanceIds].sort());
    expect(changedRevision.sourceVersion).not.toBe(first.sourceVersion);
    expect(changedContent.sourceVersion).not.toBe(first.sourceVersion);
  });

  it('rejects malformed duplicate/conflicting definitions and unsupported quest cycles', () => {
    const value = quest({
      prereqs: ['Earlier Quest', 'Earlier-Quest'],
    });
    expect(() => compileQuestGoal(value, undefined)).toThrow(/duplicate/i);
    expect(() => compileStructuredGoal('DIARY', {
      id: 'D',
      label: 'D',
      locations: [
        { id: 'same', label: 'Same' },
        { id: 'same', label: 'Different' },
      ],
    })).toThrow(/location/i);
    expect(() => compileQuestGoals([
      quest({ id: 'A', name: 'A', prereqs: ['B'] }),
      quest({ id: 'B', name: 'B', prereqs: ['A'] }),
    ], [])).toThrow(/cycle/i);
    expect(() => compileQuestGoals([
      quest({ id: 'Alt A', name: 'Alt A', prereqs: [], oneOf: [{ quests: ['Alt B'] }] }),
      quest({ id: 'Alt B', name: 'Alt B', prereqs: [], oneOf: [{ quests: ['Alt A'] }] }),
    ], [])).toThrow(/cycle/i);
    expect(() => compileQuestGoal(quest({ oneOf: [{}] }), undefined))
      .toThrow(/empty/i);
    expect(() => compileStructuredGoal('ACTIVITY', {
      id: 'Empty', label: 'Empty', alternatives: [{}],
    })).toThrow(/empty/i);
    expect(() => compileQuestGoals([
      quest({ id: 'A', name: 'A' }),
      quest({ id: 'A', name: 'Conflicting' }),
    ], [])).toThrow(/duplicate quest/i);
  });

  it('keeps sparse production goals searchable with exact conservative coverage counts', () => {
    const quests = compileProductionQuestGoals();
    const diaries = compileProductionDiaryGoals();
    const activities = compileProductionActivityGoals();

    expect(quests).toHaveLength(209);
    expect(quests.filter(goal => goal.coverage === 'VERIFIED').map(goal => goal.label))
      .toEqual(['Murder Mystery']);
    expect(quests.filter(goal => goal.coverage === 'UNKNOWN')).toHaveLength(208);
    expect(diaries).toHaveLength(48);
    expect(diaries.every(goal => goal.coverage === 'UNKNOWN')).toBe(true);
    expect(activities).toHaveLength(254);
    expect(activities.every(goal => goal.coverage === 'UNKNOWN')).toBe(true);
    expect(new Set(activities.map(goal => goal.id)).size).toBe(activities.length);

    const reversed = compileProductionActivityGoals({ reverseCatalogsForTest: true });
    expect(JSON.stringify(reversed)).toBe(JSON.stringify(activities));
  });

  it('pins production quest audit input rather than trusting similarly named records', () => {
    const audit = questAuditJson.entries as QuestRequirementAuditEntry[];
    expect(audit.filter(entry => entry.status === 'verified').map(entry => entry.id))
      .toEqual(['Murder Mystery']);
    expect(compileProductionQuestGoals().find(goal => goal.label === 'Cook\'s Assistant'))
      .toMatchObject({ coverage: 'UNKNOWN' });
  });
});
