import { describe, it, expect } from 'vitest';
import { fuzzyScore, buildIndex } from '../components/CommandPalette';
import { QUEST_DATA } from '../data/questData';
import { DIARY_DATA } from '../data/diaryData';
import { SKILLS_LIST, REGION_GROUPS } from '../constants';

describe('fuzzyScore', () => {
  it('matches subsequences and rejects non-subsequences', () => {
    expect(fuzzyScore('drt', 'Desert Treasure')).not.toBeNull();
    expect(fuzzyScore('xyz', 'Desert Treasure')).toBeNull();
  });

  it('an empty query matches everything with score 0', () => {
    expect(fuzzyScore('', 'anything')).toBe(0);
  });

  it('rewards a prefix match over a scattered match', () => {
    const prefix = fuzzyScore('cook', 'Cook\'s Assistant')!;
    const scattered = fuzzyScore('cook', 'Recipe for Disaster: Cook')!;
    expect(prefix).toBeGreaterThan(scattered);
  });

  it('rewards consecutive runs over gaps', () => {
    const consecutive = fuzzyScore('mage', 'Mage Training Arena')!;
    const gappy = fuzzyScore('mage', 'Monkey Madness After Grind Ends')!;
    expect(consecutive).toBeGreaterThan(gappy ?? -1);
  });
});

describe('buildIndex', () => {
  const index = buildIndex();

  it('covers quests, diaries, regions, and skills', () => {
    const kinds = new Set(index.map((c) => c.kind));
    expect(kinds.has('quest')).toBe(true);
    expect(kinds.has('diary')).toBe(true);
    expect(kinds.has('region')).toBe(true);
    expect(kinds.has('skill')).toBe(true);
    expect(kinds.has('ca')).toBe(true);
    expect(kinds.has('activity')).toBe(true);
  });

  it('indexes every quest, diary tier, skill, and region group', () => {
    const count = (k: string) => index.filter((c) => c.kind === k).length;
    expect(count('quest')).toBe(Object.keys(QUEST_DATA).length);
    expect(count('diary')).toBe(Object.keys(DIARY_DATA).length);
    expect(count('skill')).toBe(SKILLS_LIST.length);
    // Region groups + sub-areas both indexed as 'region'.
    expect(count('region')).toBeGreaterThanOrEqual(Object.keys(REGION_GROUPS).length);
  });

  it('every command carries a destination tab and unique id', () => {
    const ids = new Set<string>();
    for (const c of index) {
      expect(c.tab).toBeTruthy();
      expect(ids.has(c.id)).toBe(false);
      ids.add(c.id);
    }
  });

  it('quest commands route to the Journal quests sub-tab', () => {
    for (const c of index.filter((x) => x.kind === 'quest')) {
      expect(c.tab).toBe('JOURNAL');
      expect(c.subTab).toBe('QUESTS');
    }
  });
});
