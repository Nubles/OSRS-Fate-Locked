import { describe, it, expect } from 'vitest';
import {
  SKILLS_LIST, EQUIPMENT_SLOTS, EQUIPMENT_TIER_MAX, REGIONS_LIST,
  MOBILITY_LIST, ARCANA_LIST, ROLLABLE_POH_ITEMS, MERCHANTS_LIST, MINIGAMES_LIST,
  BOSSES_LIST, STORAGE_LIST, GUILDS_LIST, FARMING_PATCH_LIST,
  SLAYER_UNLOCKS_LIST,
} from '../constants';
import { BANK_IDS } from '../data/banks';
import { QUEST_DATA, QUEST_CAPE_QUEST_IDS } from '../data/questData';
import {
  ACHIEVEMENTS, evaluateAchievements, earnedIds, completionPercent,
} from './achievements';
import { UnlockState } from '../types';

function emptyUnlocks(over: Partial<UnlockState> = {}): UnlockState {
  return {
    equipment: {},
    skills: Object.fromEntries(SKILLS_LIST.map((s) => [s, 0])),
    levels: Object.fromEntries(SKILLS_LIST.map((s) => [s, 1])),
    regions: [],
    mobility: [], arcana: [], housing: [], merchants: [], minigames: [],
    bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [],
    quests: [],
    diaries: [],
    cas: [],
    completedTasks: [],
    collectionLog: {},
    ...over,
  };
}

function maxedUnlocks(): UnlockState {
  return emptyUnlocks({
    equipment: Object.fromEntries(EQUIPMENT_SLOTS.map((s) => [s, EQUIPMENT_TIER_MAX])),
    skills: Object.fromEntries(SKILLS_LIST.map((s) => [s, 10])),
    levels: Object.fromEntries(SKILLS_LIST.map((s) => [s, 99])),
    regions: [...REGIONS_LIST],
    mobility: [...MOBILITY_LIST],
    arcana: [...ARCANA_LIST],
    housing: [...ROLLABLE_POH_ITEMS],
    merchants: [...MERCHANTS_LIST],
    minigames: [...MINIGAMES_LIST],
    bosses: [...BOSSES_LIST],
    storage: [...STORAGE_LIST],
    guilds: [...GUILDS_LIST],
    farming: [...FARMING_PATCH_LIST],
    slayerUnlocks: [...SLAYER_UNLOCKS_LIST],
    banks: [...BANK_IDS],
  });
}

describe('achievements engine', () => {
  it('every achievement has a unique id and a positive target', () => {
    const ids = new Set<string>();
    for (const a of ACHIEVEMENTS) {
      expect(ids.has(a.id)).toBe(false);
      ids.add(a.id);
      const { target } = a.progress(emptyUnlocks());
      expect(target).toBeGreaterThan(0);
    }
  });

  it('a fresh run earns nothing', () => {
    const evaluated = evaluateAchievements(emptyUnlocks());
    expect(evaluated.every((a) => !a.earned)).toBe(true);
    expect(earnedIds(emptyUnlocks()).size).toBe(0);
  });

  it('pct is clamped to 0..100 and earned matches current>=target', () => {
    for (const a of evaluateAchievements(maxedUnlocks())) {
      expect(a.pct).toBeGreaterThanOrEqual(0);
      expect(a.pct).toBeLessThanOrEqual(100);
      expect(a.earned).toBe(a.current >= a.target);
    }
  });

  it('completing one quest earns the First Steps milestone', () => {
    const firstQuestId = Object.keys(QUEST_DATA)[0];
    const evaluated = evaluateAchievements(emptyUnlocks({ quests: [firstQuestId] }));
    const firstSteps = evaluated.find((a) => a.id === 'quests-1');
    expect(firstSteps?.earned).toBe(true);
  });

  it('a maxed account reaches 100% completion and earns Fate Conqueror', () => {
    const maxed = maxedUnlocks();
    expect(completionPercent(maxed)).toBe(100);
    const evaluated = evaluateAchievements(maxed);
    const conqueror = evaluated.find((a) => a.id === 'mastery-100');
    expect(conqueror?.earned).toBe(true);
  });

  it('earnedIds grows monotonically as progress is added', () => {
    const base = earnedIds(emptyUnlocks());
    const firstQuestId = Object.keys(QUEST_DATA)[0];
    const after = earnedIds(emptyUnlocks({ quests: [firstQuestId] }));
    expect(after.size).toBeGreaterThan(base.size);
    for (const id of base) expect(after.has(id)).toBe(true);
  });

  it('counts pending overlap refund markers as their two canonical regions', () => {
    const regions = evaluateAchievements(emptyUnlocks({
      regions: ['Baxtorian Falls', "Otto's Grotto", 'Taverley', "Heroes' Guild"],
    })).find((achievement) => achievement.id === 'regions-5');

    expect(regions?.current).toBe(2);
  });

  it('awards the quest cape after every canonical quest without optional miniquests', () => {
    const evaluated = evaluateAchievements(emptyUnlocks({ quests: [...QUEST_CAPE_QUEST_IDS] }), 'vanilla');
    const questCape = evaluated.find(achievement => achievement.title === 'Quest Cape');

    expect(questCape?.current).toBe(QUEST_CAPE_QUEST_IDS.length);
    expect(questCape?.target).toBe(QUEST_CAPE_QUEST_IDS.length);
    expect(questCape?.earned).toBe(true);
  });

  it('does not substitute miniquests or duplicate records for canonical quest milestones', () => {
    const miniquests = Object.values(QUEST_DATA).filter(quest => quest.kind === 'miniquest').map(quest => quest.id);
    expect(miniquests.length).toBeGreaterThan(0);
    const firstSteps = evaluateAchievements(emptyUnlocks({ quests: miniquests }), 'vanilla')
      .find(achievement => achievement.id === 'quests-1');
    expect(firstSteps?.earned).toBe(false);

    const first = QUEST_CAPE_QUEST_IDS[0];
    const withDuplicate = evaluateAchievements(emptyUnlocks({ quests: [first, first, 'Unknown legacy quest', ...miniquests] }), 'vanilla')
      .find(achievement => achievement.id === 'quests-10');
    expect(withDuplicate?.current).toBe(1);
    expect(withDuplicate?.earned).toBe(false);
  });

  it('does not let a retired Aquarium replace a still-missing active unlock', () => {
    const almost = maxedUnlocks();
    almost.banks = almost.banks!.slice(1);
    almost.housing.push('Aquarium');

    expect(completionPercent(almost, 'vanilla')).toBe(99);
    expect(evaluateAchievements(almost, 'vanilla').find(achievement => achievement.id === 'mastery-100')?.earned).toBe(false);
    expect(almost.housing).toContain('Aquarium');
  });
});
