import { describe, expect, it } from 'vitest';
import { DropSource } from '../types';
import {
  nextSlayerFatigue,
  SLAYER_FATIGUE_MAX,
  slayerFatigueCut,
} from './slayerFatigue';

describe('slayer fatigue', () => {
  it('takes fatigue off Vanilla Slayer rolls, never more than half the master’s rate', () => {
    expect(slayerFatigueCut(DropSource.SLAYER_KRYSTILIA, 65, 20, 'vanilla')).toBe(20);
    expect(slayerFatigueCut(DropSource.SLAYER_KRYSTILIA, 65, 40, 'vanilla')).toBe(32.5);
    expect(slayerFatigueCut(DropSource.SLAYER_BEGINNER, 5, 10, 'vanilla')).toBe(2.5);
  });

  it('leaves other sources and other modes alone', () => {
    expect(slayerFatigueCut(DropSource.CLUE_HARD, 35, 20, 'vanilla')).toBe(0);
    expect(slayerFatigueCut(DropSource.SLAYER_KRYSTILIA, 65, 20, 'chunked')).toBe(0);
    expect(nextSlayerFatigue(0, { source: DropSource.SLAYER_DURADEL, success: true, baseChance: 70 }, 'chunked')).toBe(0);
  });

  it('a Slayer Key adds 10 up to the cap; a Slayer miss changes nothing', () => {
    const won = { source: DropSource.SLAYER_KRYSTILIA, success: true, baseChance: 65 };
    expect(nextSlayerFatigue(undefined, won, 'vanilla')).toBe(10);
    expect(nextSlayerFatigue(35, won, 'vanilla')).toBe(SLAYER_FATIGUE_MAX);
    expect(nextSlayerFatigue(20, { ...won, success: false }, 'vanilla')).toBe(20);
  });

  it('level-ups rest 2, other rolls 5, and rolls under 5% rest nothing', () => {
    expect(nextSlayerFatigue(20, { source: 'Attack Level 50', success: false, baseChance: 10 }, 'vanilla')).toBe(18);
    expect(nextSlayerFatigue(20, { source: 'Attack Level 3', success: false, baseChance: 0.6 }, 'vanilla')).toBe(18);
    expect(nextSlayerFatigue(20, { source: DropSource.QUEST_NOVICE, success: false, baseChance: 25 }, 'vanilla')).toBe(15);
    expect(nextSlayerFatigue(20, { source: DropSource.ACTIVITY_MINIGAME, success: false, baseChance: 1 }, 'vanilla')).toBe(20);
    expect(nextSlayerFatigue(3, { source: DropSource.CLUE_BEGINNER, success: true, baseChance: 5 }, 'vanilla')).toBe(0);
  });
});
