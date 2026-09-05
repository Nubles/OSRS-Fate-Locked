import { describe, expect, it } from 'vitest';
import { ALL_DIARY_TASKS } from './diaryTasks';
import { SKILLS_LIST } from './items';
import { evaluateDiaryTaskEligibility } from '../utils/journalStatus';
import { diaryTaskCompletionDecision } from '../utils/journalCompletion';
import type { UnlockState } from '../types';
import { QUEST_DATA } from './questData';
import { ARCANA_LIST, GUILDS_LIST, MOBILITY_LIST, MINIGAMES_LIST, BOSSES_LIST, FARMING_PATCH_LIST } from './items';

const state = (skills: Record<string, number> = {}): UnlockState => ({
  skills, levels: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 99])), equipment: {},
  regions: ['Lumbridge', 'Draynor Village', 'Al Kharid', "Wizards' Tower"],
  quests: ['Rune Mysteries', "Cook's Assistant"], diaries: [], cas: [], completedTasks: [],
  collectionLog: {}, mobility: [], arcana: [], housing: [], merchants: [], minigames: [],
  bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [],
});

describe('complete diary inventory operational semantics', () => {
  const ready = (): UnlockState => ({
    ...state(Object.fromEntries(SKILLS_LIST.map(skill => [skill, 10]))),
    quests: Object.keys(QUEST_DATA), arcana: [...ARCANA_LIST], guilds: [...GUILDS_LIST],
    mobility: [...MOBILITY_LIST], minigames: [...MINIGAMES_LIST], bosses: [...BOSSES_LIST], farming: [...FARMING_PATCH_LIST],
    regions: [...new Set(ALL_DIARY_TASKS.flatMap(task => [...(task.regions ?? []), ...(task.anyOfRegions ?? []), ...(task.oneOf ?? []).flatMap(route => route.regions ?? [])]))],
  });
  const byId = (id: string) => ALL_DIARY_TASKS.find(task => task.id === id)!;
  it.each([['fal_hard_1', 56, 1], ['fal_elite_1', 88, 1], ['lum_hard_3', 59, 3], ['frem_elite_2', 82, 4], ['kar_elite_1', 91, 5]])(
    'does not turn the multiplied rune output level into a method tier for %s', (id, level, tier) => {
      const u = ready(); u.levels.Runecraft = Number(level); u.skills.Runecraft = Number(tier);
      expect(evaluateDiaryTaskEligibility(byId(String(id)), u).machineEligible).toBe(true);
      u.skills.Runecraft = Number(tier) - 1;
      expect(evaluateDiaryTaskEligibility(byId(String(id)), u).machineEligible).toBe(false);
    },
  );
  it('blocks missing tracked spellbook permission even after manual attestation', () => {
    const u = ready(); u.arcana = [];
    expect(diaryTaskCompletionDecision(byId('mor_elite_3'), u, undefined, { manualConfirmed: true }).ok).toBe(false);
  });
  it('permits confirmed quest progress without demanding full completion', () => {
    const u = ready(); u.quests = u.quests.filter(q => q !== 'Sea Slug');
    const result = evaluateDiaryTaskEligibility(byId('ard_med_7'), u);
    expect(result.machineEligible).toBe(true);
    expect(result.manualChecks.join(' ')).toContain('Sea Slug progressed');
    expect(diaryTaskCompletionDecision(byId('ard_med_7'), u).ok).toBe(false);
  });
  it('does not require gathering levels for legally pre-owned task materials', () => {
    const u = ready(); u.levels.Farming = 1;
    expect(evaluateDiaryTaskEligibility(byId('fal_med_13'), u).machineEligible).toBe(true);
  });
  it('enforces Wilderness diary ownership separately from boss-entry confirmations', () => {
    const u = ready();
    expect(diaryTaskCompletionDecision(byId('wild_elite_1'), u, undefined, { manualConfirmed: true }).ok).toBe(false);
    u.diaries = ['Wilderness Medium'];
    expect(evaluateDiaryTaskEligibility(byId('wild_elite_1'), u).machineEligible).toBe(true);
  });
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

// Explicit target locations must not inherit every child of a broad continent.
describe('Wilderness green-dragon diary geography', () => {
  const dragon = ALL_DIARY_TASKS.find(task => task.id === 'wild_med_2')!;
  it.each(['Mage Arena', 'Ferox Enclave', 'Fountain of Rune'])(
    'does not let %s ownership or manual confirmation substitute for a dragon location', region => {
      const u = { ...state(), regions: [region] };
      expect(evaluateDiaryTaskEligibility(dragon, u).machineEligible).toBe(false);
      expect(diaryTaskCompletionDecision(dragon, u, undefined, { manualConfirmed: true }).ok).toBe(false);
    });
  it('accepts the mapped Graveyard spawn but retains the legal-combat check', () => {
    const u = { ...state(), regions: ['Graveyard of Shadows'] };
    expect(evaluateDiaryTaskEligibility(dragon, u).machineEligible).toBe(true);
    expect(evaluateDiaryTaskEligibility(dragon, u).eligible).toBe(false);
    expect(diaryTaskCompletionDecision(dragon, u, undefined, { manualConfirmed: true }).ok).toBe(true);
  });
  it.each(['46,56', '48,59', '49,57', '52,57', '50,57', '51,58'])(
    'accepts the actual spawn or reviewed cave entrance chunk %s independently of area unlocks', chunk => {
      const u = { ...state(), regions: [], chunks: [chunk] };
      expect(evaluateDiaryTaskEligibility(dragon, u, 'chunked').machineEligible).toBe(true);
    });
  it('rejects Mage Arena chunks despite Wilderness ownership', () => {
    const u = { ...state(), regions: ['Wilderness'], chunks: ['48,61', '49,61'] };
    expect(diaryTaskCompletionDecision(dragon, u, 'chunked', { manualConfirmed: true }).ok).toBe(false);
  });
  it('offers the cave route via Chaos Temple with explicit legal-route confirmation', () => {
    const u = { ...state(), regions: ['Chaos Temple'] };
    const result = evaluateDiaryTaskEligibility(dragon, u);
    expect(result.machineEligible).toBe(true);
    expect(result.manualChecks.join(' ')).toContain('dragon room');
    expect(result.eligible).toBe(false);
  });
});
