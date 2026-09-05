import { describe, expect, it } from 'vitest';
import { ALL_DIARY_TASKS } from './diaryTasks';
import { SKILLS_LIST } from './items';
import { evaluateDiaryTaskEligibility } from '../utils/journalStatus';
import { diaryTaskCompletionDecision } from '../utils/journalCompletion';
import type { UnlockState } from '../types';

const state = (skills: Record<string, number> = {}): UnlockState => ({
  skills, levels: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 99])), equipment: {},
  regions: ['Lumbridge', 'Draynor Village', 'Al Kharid', "Wizards' Tower"],
  quests: ['Rune Mysteries', "Cook's Assistant"], diaries: [], cas: [], completedTasks: [],
  collectionLog: {}, mobility: [], arcana: [], housing: [], merchants: [], minigames: [],
  bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [],
});
const task = (ordinal: number) => ALL_DIARY_TASKS.find(t => t.id === `lum_easy_${ordinal}`)!;

describe('Lumbridge Easy operational requirements', () => {
  it.each([1, 4, 6, 7, 9, 10, 11])('does not let high attained levels bypass the method gate on task %s', ordinal => {
    expect(diaryTaskCompletionDecision(task(ordinal), state(), undefined, { manualConfirmed: true }).ok).toBe(false);
  });
  it('retains task-specific item checks after all machine gates pass', () => {
    const unlocked = state(Object.fromEntries(SKILLS_LIST.map(skill => [skill, 10])));
    for (const ordinal of [2, 4, 7, 9, 10, 11]) {
      const result = evaluateDiaryTaskEligibility(task(ordinal), unlocked);
      expect(result.machineEligible, task(ordinal).description).toBe(true);
      expect(result.eligible).toBe(false);
      expect(result.manualChecks.length).toBeGreaterThan(0);
      expect(diaryTaskCompletionDecision(task(ordinal), unlocked).ok).toBe(false);
      expect(diaryTaskCompletionDecision(task(ordinal), unlocked, undefined, { manualConfirmed: true }).ok).toBe(true);
    }
  });
  it.each([7, 9, 11])('requires tier 2, but no higher method tier, for task %s', ordinal => {
    const unlocked = state(Object.fromEntries(SKILLS_LIST.map(skill => [skill, 1])));
    expect(evaluateDiaryTaskEligibility(task(ordinal), unlocked).machineEligible).toBe(false);
    unlocked.skills = Object.fromEntries(SKILLS_LIST.map(skill => [skill, 2]));
    expect(evaluateDiaryTaskEligibility(task(ordinal), unlocked).machineEligible).toBe(true);
  });
  it('does not require high Slayer method tiers to fight a cave bug', () => {
    expect(evaluateDiaryTaskEligibility(task(2), state()).machineEligible).toBe(true);
  });
  it('does not add method gates or recommended tools to non-training tasks', () => {
    for (const ordinal of [3, 5, 8, 12]) expect(evaluateDiaryTaskEligibility(task(ordinal), state()).eligible).toBe(true);
  });
  it('does not treat Cooking 34 recommended to avoid burning as a hard bread gate', () => {
    const unlocked = state({ Cooking: 1 }); unlocked.levels.Cooking = 1;
    expect(evaluateDiaryTaskEligibility(task(10), unlocked).machineEligible).toBe(true);
  });
});
