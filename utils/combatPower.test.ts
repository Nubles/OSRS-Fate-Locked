import { describe, it, expect } from 'vitest';
import { SKILLS_LIST, EQUIPMENT_SLOTS, EQUIPMENT_TIER_MAX } from '../constants';
import { computeCombatPower, overallCombatPower, POWER_AXES, TIER_LABELS } from './combatPower';
import { UnlockState } from '../types';

function unlocks(over: Partial<UnlockState> = {}): UnlockState {
  return {
    equipment: Object.fromEntries(EQUIPMENT_SLOTS.map((s) => [s, 0])),
    skills: Object.fromEntries(SKILLS_LIST.map((s) => [s, 0])),
    levels: Object.fromEntries(SKILLS_LIST.map((s) => [s, 1])),
    regions: [], mobility: [], arcana: [], housing: [], merchants: [], minigames: [],
    bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [], agilityShortcuts: [], quests: [], diaries: [], cas: [],
    completedTasks: [], collectionLog: {},
    ...over,
  };
}

const maxed = () => unlocks({
  equipment: Object.fromEntries(EQUIPMENT_SLOTS.map((s) => [s, EQUIPMENT_TIER_MAX])),
  skills: Object.fromEntries(SKILLS_LIST.map((s) => [s, 10])),
});

describe('combat power', () => {
  it('has a tier label for every equipment tier', () => {
    expect(TIER_LABELS.length).toBe(EQUIPMENT_TIER_MAX);
  });

  it('is all zero for a fresh run', () => {
    expect(computeCombatPower(unlocks()).every((r) => r.value === 0)).toBe(true);
    expect(overallCombatPower(unlocks())).toBe(0);
  });

  it('is 100 across the board for a maxed account', () => {
    const ratings = computeCombatPower(maxed());
    expect(ratings.every((r) => r.value === 100)).toBe(true);
    expect(overallCombatPower(maxed())).toBe(100);
  });

  it('clamps every axis to 0..100', () => {
    for (const r of computeCombatPower(maxed())) {
      expect(r.value).toBeGreaterThanOrEqual(0);
      expect(r.value).toBeLessThanOrEqual(100);
    }
  });

  it('weights gear and skills 50/50 (gear-only maxed ⇒ 50)', () => {
    const gearOnly = unlocks({
      equipment: Object.fromEntries(EQUIPMENT_SLOTS.map((s) => [s, EQUIPMENT_TIER_MAX])),
    });
    expect(computeCombatPower(gearOnly).every((r) => r.value === 50)).toBe(true);
  });

  it('raising a relevant skill lifts the right axis', () => {
    const before = computeCombatPower(unlocks()).find((r) => r.key === 'magic')!.value;
    const after = computeCombatPower(unlocks({
      skills: { ...unlocks().skills, Magic: 10 },
    })).find((r) => r.key === 'magic')!.value;
    expect(after).toBeGreaterThan(before);
  });

  it('exposes a stable set of named axes', () => {
    expect(POWER_AXES.map((a) => a.key)).toEqual(['melee', 'ranged', 'magic', 'defence', 'prayer']);
  });
});
