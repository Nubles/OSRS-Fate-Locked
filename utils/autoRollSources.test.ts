import { describe, it, expect } from 'vitest';
import { buildKeyFaucets, bossTierForMetric, DEFAULT_ROLL_CAP } from './autoRollSources';
import { DropSource } from '../types';

describe('bossTierForMetric', () => {
  it('classifies cleanly-named bosses by normalisation', () => {
    expect(bossTierForMetric('zulrah')).toBe('mid');
    expect(bossTierForMetric('abyssal_sire')).toBe('mid');
    expect(bossTierForMetric('the_gauntlet')).toBe('high');
    expect(bossTierForMetric('chambers_of_xeric')).toBe('raid');
  });

  it('resolves aliased metrics', () => {
    expect(bossTierForMetric('kreearra')).toBe('mid');
    expect(bossTierForMetric('tzkal_zuk')).toBe('high'); // Inferno
    expect(bossTierForMetric('dagannoth_rex')).toBe('low'); // Dagannoth Kings
    expect(bossTierForMetric('theatre_of_blood_hard_mode')).toBe('raid');
  });

  it('returns null for unknown metrics', () => {
    expect(bossTierForMetric('lunar_chests')).toBeNull();
    expect(bossTierForMetric('not_a_boss')).toBeNull();
  });
});

describe('buildKeyFaucets', () => {
  it('aggregates boss kills into tier buckets and caps rolls', () => {
    const bosses = {
      zulrah: { kills: 500 },          // mid
      vorkath: { kills: 50 },          // mid
      chambers_of_xeric: { kills: 8 }, // raid
      kraken: { kills: -1 },           // unranked → ignored
    };
    const groups = buildKeyFaucets(bosses, {}, 20);
    const mid = groups.find(g => g.key === 'boss-mid')!;
    const raid = groups.find(g => g.key === 'boss-raid')!;
    expect(mid.real).toBe(550);
    expect(mid.rolls).toBe(20); // capped
    expect(mid.source).toBe(DropSource.BOSS_MID);
    expect(raid.real).toBe(8);
    expect(raid.rolls).toBe(8); // under cap
  });

  it('maps clue tiers to their sources', () => {
    const groups = buildKeyFaucets({}, {
      clue_scrolls_master: { score: 3 },
      clue_scrolls_easy: { score: 0 }, // skipped
    });
    const master = groups.find(g => g.key === 'clue_scrolls_master')!;
    expect(master.source).toBe(DropSource.CLUE_MASTER);
    expect(master.rolls).toBe(3);
    expect(groups.some(g => g.key === 'clue_scrolls_easy')).toBe(false);
  });

  it('buckets minigame metrics together and skips empty input', () => {
    const groups = buildKeyFaucets({}, { soul_wars_zeal: { score: 1000 }, last_man_standing: { score: 200 } });
    const mini = groups.find(g => g.key === 'minigames')!;
    expect(mini.real).toBe(1200);
    expect(mini.rolls).toBe(DEFAULT_ROLL_CAP);
    expect(buildKeyFaucets({}, {})).toEqual([]);
  });
});
