import { describe, expect, it } from 'vitest';
import {
  BRUTUS_BOSS_NAME,
  VANILLA_BOSS_STANDARD_KEY_TOTAL,
  effectiveVanillaClueRate,
  vanillaBossKeyStage,
  vanillaBossKeySchedule,
} from './vanillaKeyEconomy';

describe('Vanilla key economy', () => {
  it('exposes the approved finite reserve', () => {
    expect(VANILLA_BOSS_STANDARD_KEY_TOTAL).toBe(114);
  });

  it('uses the approved Brutus and tier schedules', () => {
    expect(vanillaBossKeyStage(BRUTUS_BOSS_NAME, 0).rates).toEqual([10]);
    expect(vanillaBossKeyStage('Obor', 0).rates).toEqual([15]);
    expect(vanillaBossKeyStage('Zulrah', 0).rates).toEqual([30, 15]);
    expect(vanillaBossKeyStage('Vardorvis', 0).rates).toEqual([50, 25]);
    expect(vanillaBossKeyStage('Theatre of Blood', 0).rates).toEqual([65, 32.5, 16.25]);
  });

  it('reports progress, next rate, and capped state', () => {
    expect(vanillaBossKeyStage('Zulrah', 1)).toMatchObject({
      awarded: 1,
      cap: 2,
      currentRate: 15,
      remaining: 1,
      capped: false,
    });
    expect(vanillaBossKeyStage('Zulrah', 2)).toMatchObject({
      awarded: 2,
      currentRate: null,
      remaining: 0,
      capped: true,
    });
  });

  it('shares clue onboarding floors across all clue tiers', () => {
    expect(effectiveVanillaClueRate(2.5, 0)).toBe(25);
    expect(effectiveVanillaClueRate(5, 1)).toBe(15);
    expect(effectiveVanillaClueRate(8, 2)).toBe(10);
    expect(effectiveVanillaClueRate(20, 3)).toBe(20);
  });

  it('rejects an ordinary unknown boss name', () => {
    expect(() => vanillaBossKeySchedule('Unknown')).toThrow('Missing boss key tier for "Unknown".');
  });

  it.each(['constructor', 'toString'])('rejects inherited property name %s', (bossName) => {
    expect(() => vanillaBossKeySchedule(bossName)).toThrow(
      `Missing boss key tier for "${bossName}".`,
    );
  });
});
