import { describe, it, expect } from 'vitest';
import { MINIGAMES_LIST } from './items';
import { MINIGAME_KEY_RESERVES, minigameReserveRates, minigameReserveSize } from './minigameKeyReserves';
import {
  VANILLA_MINIGAME_STANDARD_KEY_TOTAL,
  minigameMissPaysFate,
  normalizeMinigameStandardKeysAwarded,
  vanillaMinigameKeySchedule,
  vanillaMinigameKeyStage,
} from '../config/vanillaKeyEconomy';

describe('minigame key reserves', () => {
  it('lists every minigame in MINIGAMES_LIST, and nothing else', () => {
    expect(MINIGAMES_LIST.filter(name => !MINIGAME_KEY_RESERVES[name]), 'minigames with no key reserve').toEqual([]);
    const known = new Set(MINIGAMES_LIST);
    expect(Object.keys(MINIGAME_KEY_RESERVES).filter(name => !known.has(name)), 'reserves not in MINIGAMES_LIST').toEqual([]);
  });

  it('tops the Collection Log up to about 3 Keys, never below 1', () => {
    expect(minigameReserveSize(MINIGAME_KEY_RESERVES['Gnome Ball'])).toBe(3);
    expect(minigameReserveSize(MINIGAME_KEY_RESERVES['Pest Control'])).toBe(2);
    expect(minigameReserveSize(MINIGAME_KEY_RESERVES['Castle Wars'])).toBe(1);
    expect(minigameReserveSize(MINIGAME_KEY_RESERVES['Rat Pits'])).toBe(0);
  });

  it('sets the first Key at about an hour of play and halves each next one, in whole percents from 1%', () => {
    expect(vanillaMinigameKeySchedule('Blast Furnace')).toEqual([1, 1, 1]);
    expect(vanillaMinigameKeySchedule('Rogues\' Den')).toEqual([5, 3, 1]);
    expect(vanillaMinigameKeySchedule('Pest Control')).toEqual([8, 4]);
    expect(vanillaMinigameKeySchedule('Nightmare Zone')).toEqual([50, 25, 13]);
    expect(vanillaMinigameKeySchedule('Mage Arena')).toEqual([100]);
    expect(vanillaMinigameKeySchedule('Tears of Guthix')).toEqual([100]);
    expect(vanillaMinigameKeySchedule('Rat Pits')).toEqual([]);
    for (const spec of Object.values(MINIGAME_KEY_RESERVES)) {
      const rates = minigameReserveRates(spec);
      rates.forEach(rate => expect(Number.isInteger(rate) && rate >= 1).toBe(true));
    }
  });

  it('holds 103 Keys across every minigame', () => {
    expect(VANILLA_MINIGAME_STANDARD_KEY_TOTAL).toBe(103);
  });

  it('pays Fate for a miss only at 5% or more', () => {
    expect(minigameMissPaysFate(4.99)).toBe(false);
    expect(minigameMissPaysFate(5)).toBe(true);
  });

  it('steps through a reserve and stops at its cap', () => {
    expect(vanillaMinigameKeyStage('Pest Control', 0)).toMatchObject({ currentRate: 8, nextRate: 4, cap: 2, capped: false });
    expect(vanillaMinigameKeyStage('Pest Control', 1)).toMatchObject({ currentRate: 4, nextRate: null, remaining: 1 });
    expect(vanillaMinigameKeyStage('Pest Control', 5)).toMatchObject({ awarded: 2, currentRate: null, capped: true });
    expect(vanillaMinigameKeyStage('Rat Pits', 0)).toMatchObject({ cap: 0, capped: true });
    expect(() => vanillaMinigameKeyStage('Not A Minigame', 0)).toThrow();
  });

  it('drops unknown names and bad counts, and clamps to the cap', () => {
    expect(normalizeMinigameStandardKeysAwarded({ 'Castle Wars': 4, 'Pest Control': 1, Nope: 1, 'Soul Wars': -1, Mess: 1.5 }))
      .toEqual({ 'Castle Wars': 1, 'Pest Control': 1 });
    expect(normalizeMinigameStandardKeysAwarded(null)).toEqual({});
  });
});
