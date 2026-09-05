import { describe, expect, it } from 'vitest';
import { evaluatePredicate, type RequirementPredicate } from './requirementPredicates';
import { evaluateDiaryTaskEligibility, evaluateDiaryTierEligibility, meetsSkillRequirement } from './journalStatus';
import { evaluateActivityReadiness } from './activityReadiness';
import { ALL_DIARY_TASKS } from '../data/diaryTasks';
import { slayerReachability } from './slayerReach';
import { actualSkillLevel, usableMethodLevel } from './skillLevels';
import type { UnlockState } from '../types';

const unlocks: UnlockState = {
  equipment: {}, skills: { Defence: 1, Slayer: 1 }, levels: { Defence: 70, Slayer: 70 },
  regions: [], quests: [], diaries: [], cas: [], completedTasks: [], collectionLog: {},
  mobility: [], arcana: [], housing: [], merchants: [], minigames: [], bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [],
};
const unknown: RequirementPredicate = { kind: 'unknown', key: 'new-rule', label: 'Unclassified entry rule' };
describe('shared requirement semantics', () => {
  it('uses attained levels across journal, activity and Slayer without opening methods', () => {
    expect(actualSkillLevel(unlocks, 'Defence')).toBe(70);
    expect(usableMethodLevel(unlocks, 'Defence')).toBe(10);
    expect(meetsSkillRequirement(unlocks, 'Defence', 70)).toBe(true);
    expect(evaluateDiaryTaskEligibility({ id: 'level', skills: { Defence: 70 } }, unlocks).eligible).toBe(true);
    expect(evaluateActivityReadiness(true, { skills: { Defence: 70 } }, unlocks).status).toBe('READY');
    expect(slayerReachability({ Test: { Monster: { slayer: 70, weight: 1 } } }, unlocks, () => ({ cx: 1, cy: 1, unlocked: true })).masters[0].ready).toBe(1);
    expect(evaluatePredicate({ kind: 'method', skill: 'Defence', tier: 7 }, { unlocks }).status).toBe('LOCKED');
  });
  it('never promotes unknown requirements or empty alternatives to ready', () => {
    for (const predicate of [unknown, { kind: 'any', of: [] } as const]) {
      expect(evaluatePredicate(predicate as RequirementPredicate, { unlocks }).status).toBe('UNKNOWN');
    }
    expect(evaluateActivityReadiness(true, { predicates: [unknown] }, unlocks).status).toBe('UNKNOWN');
    expect(evaluateDiaryTaskEligibility({ id: 'label', oneOf: [{ label: 'Exemption' }] }, unlocks).eligible).toBe(false);
  });
  it('allows a proven OR route but retains an unproven AND condition', () => {
    const met: RequirementPredicate = { kind: 'skill', skill: 'Defence', level: 70 };
    expect(evaluatePredicate({ kind: 'any', of: [unknown, met] }, { unlocks }).status).toBe('READY');
    expect(evaluatePredicate({ kind: 'all', of: [unknown, met] }, { unlocks }).status).toBe('UNKNOWN');
  });
  it('requires item availability and legality to be explicitly confirmed', () => {
    const item: RequirementPredicate = { kind: 'item', id: 'cape', label: 'Cape', usage: 'equip' };
    expect(evaluatePredicate(item, { unlocks }).status).toBe('NEEDS_CONFIRMATION');
    expect(evaluatePredicate(item, { unlocks, confirmations: { 'item:cape:equip': false } }).status).toBe('LOCKED');
    expect(evaluatePredicate(item, { unlocks, confirmations: { 'item:cape:equip': true } }).status).toBe('READY');
    expect(evaluateDiaryTaskEligibility({ id: 'item', items: ['Cape'] }, unlocks).eligible).toBe(false);
  });
  it('keeps manual checks in the diary tier until the task is completed', () => {
    const task = ALL_DIARY_TASKS.find(t => t.manualRequirements?.length)!;
    const state = { ...unlocks, completedTasks: ALL_DIARY_TASKS.filter(t => t.id !== task.id).map(t => t.id) };
    const tier = evaluateDiaryTierEligibility({ id: task.tierId }, state);
    expect(tier.eligible).toBe(false);
    expect(tier.unverifiedTaskIds).toContain(task.id);
    expect(tier.manualChecks.length).toBeGreaterThan(0);
  });
  it('does not silently pass unknown Slayer requirements', () => {
    const result = slayerReachability({ Test: { Monster: { weight: 1, req: ['new external gate'] } } }, unlocks, () => ({ cx: 1, cy: 1, unlocked: true }));
    expect(result.masters[0].rows[0].status).toBe('unknown');
    expect(result.masters[0].ready).toBe(0);
  });
});


it('keeps unreviewed activity metadata unknown', () => {
  expect(evaluateActivityReadiness(true, undefined, unlocks).status).toBe('UNKNOWN');
  expect(evaluateActivityReadiness(true, { note: 'A new hard entry condition' }, unlocks).status).toBe('UNKNOWN');
});

it('preserves the Ardougne Elite alternative geography', () => {
  const task = ALL_DIARY_TASKS.find(t => t.description.includes('Witchaven or Yanille'))!;
  expect(task.regions).toBeUndefined();
  expect(task.anyOfRegions).toEqual(['Witchaven', 'Yanille']);
});
