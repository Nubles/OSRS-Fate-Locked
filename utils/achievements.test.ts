import { describe, it, expect } from 'vitest';
import {
  SKILLS_LIST, EQUIPMENT_SLOTS, EQUIPMENT_TIER_MAX, REGIONS_LIST,
  MOBILITY_LIST, ARCANA_LIST, POH_LIST, MERCHANTS_LIST, MINIGAMES_LIST,
  BOSSES_LIST, STORAGE_LIST, GUILDS_LIST, FARMING_PATCH_LIST,
} from '../constants';
import { QUEST_DATA } from '../data/questData';
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
    bosses: [], storage: [], guilds: [], farming: [],
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
    housing: [...POH_LIST],
    merchants: [...MERCHANTS_LIST],
    minigames: [...MINIGAMES_LIST],
    bosses: [...BOSSES_LIST],
    storage: [...STORAGE_LIST],
    guilds: [...GUILDS_LIST],
    farming: [...FARMING_PATCH_LIST],
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
});
