import { describe, it, expect } from 'vitest';
import { MINIGAMES_LIST } from './items';
import { MINIGAME_TIERS } from './minigameKeyTiers';
import {
  VANILLA_MINIGAME_KEY_RATES,
  VANILLA_MINIGAME_STANDARD_KEY_TOTAL,
  normalizeMinigameStandardKeysAwarded,
  vanillaMinigameKeyStage,
} from '../config/vanillaKeyEconomy';

describe('minigame key tiers', () => {
  it('classifies every minigame in MINIGAMES_LIST, and nothing else', () => {
    expect(MINIGAMES_LIST.filter(name => !MINIGAME_TIERS[name]), 'minigames with no key tier').toEqual([]);
    const known = new Set(MINIGAMES_LIST);
    expect(Object.keys(MINIGAME_TIERS).filter(name => !known.has(name)), 'tier entries not in MINIGAMES_LIST').toEqual([]);
  });

  it('pays better and longer for longer minigames', () => {
    expect(VANILLA_MINIGAME_KEY_RATES).toEqual({ quick: [10], standard: [20, 10], long: [30, 15] });
    expect(MINIGAME_TIERS['Rat Pits']).toBe('quick');
    expect(MINIGAME_TIERS['Pest Control']).toBe('standard');
    expect(MINIGAME_TIERS['Barbarian Assault']).toBe('long');
  });

  it('holds 65 Keys across every minigame', () => {
    expect(VANILLA_MINIGAME_STANDARD_KEY_TOTAL).toBe(65);
  });

  it('steps through a reserve and stops at its cap', () => {
    expect(vanillaMinigameKeyStage('Barbarian Assault', 0)).toMatchObject({ currentRate: 30, nextRate: 15, cap: 2, capped: false });
    expect(vanillaMinigameKeyStage('Barbarian Assault', 1)).toMatchObject({ currentRate: 15, nextRate: null, remaining: 1 });
    expect(vanillaMinigameKeyStage('Barbarian Assault', 5)).toMatchObject({ awarded: 2, currentRate: null, capped: true });
    expect(() => vanillaMinigameKeyStage('Not A Minigame', 0)).toThrow();
  });

  it('drops unknown names and bad counts, and clamps to the cap', () => {
    expect(normalizeMinigameStandardKeysAwarded({ 'Rat Pits': 4, 'Pest Control': 1, Nope: 1, 'Soul Wars': -1, Mess: 1.5 }))
      .toEqual({ 'Rat Pits': 1, 'Pest Control': 1 });
    expect(normalizeMinigameStandardKeysAwarded(null)).toEqual({});
  });
});
