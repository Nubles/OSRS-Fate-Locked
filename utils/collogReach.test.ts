import { describe, it, expect } from 'vitest';
import { collogReachability } from './collogReach';
import { BOSSES_LIST, MINIGAMES_LIST } from '../data/items';
import { UnlockState } from '../types';

const base = (over: Partial<UnlockState> = {}): UnlockState => ({
  equipment: {}, skills: {}, levels: {}, regions: [], mobility: [], arcana: [],
  housing: [], merchants: [], minigames: [], bosses: [], storage: [], guilds: [],
  farming: [], slayerUnlocks: [], quests: [], diaries: [], cas: [],
  completedTasks: [], collectionLog: {},
  ...over,
});

describe('collogReachability', () => {
  it('with nothing unlocked, only baseline (Clues/Other) + unknown pages are obtainable', () => {
    const r = collogReachability(base());
    expect(r.obtainable).toBeGreaterThan(0);
    expect(r.obtainable).toBeLessThan(r.total);
    expect(r.gatedObtainable).toBe(0);
    expect(r.gatedTotal).toBeGreaterThan(0);
    expect(r.pct).toBeGreaterThan(0);
    expect(r.pct).toBeLessThan(100);
  });

  it('with every boss + minigame unlocked, 100% is obtainable', () => {
    const r = collogReachability(base({ bosses: [...BOSSES_LIST], minigames: [...MINIGAMES_LIST] }));
    expect(r.obtainable).toBe(r.total);
    expect(r.pct).toBe(100);
    expect(r.gatedObtainable).toBe(r.gatedTotal);
    expect(r.suggestions).toEqual([]);
  });

  it('suggestions are ranked by slot count and name real locked sources', () => {
    const r = collogReachability(base());
    expect(r.suggestions.length).toBeGreaterThan(0);
    // monotonic non-increasing item counts
    for (let i = 1; i < r.suggestions.length; i++) {
      expect(r.suggestions[i - 1].items).toBeGreaterThanOrEqual(r.suggestions[i].items);
    }
    // unlocking the top suggestion's boss raises the obtainable count
    const top = r.suggestions.find(s => s.kind === 'boss');
    if (top) {
      const after = collogReachability(base({ bosses: [top.unlock] }));
      expect(after.obtainable).toBeGreaterThan(collogReachability(base()).obtainable);
    }
  });

  it('gated tabs are Bosses/Raids/Minigames; Clues/Other are baseline', () => {
    const r = collogReachability(base());
    const gated = r.tabs.filter(t => t.gated).map(t => t.tab).sort();
    expect(gated).toEqual(['Bosses', 'Minigames', 'Raids']);
    for (const t of r.tabs.filter(t => !t.gated)) expect(t.obtainable).toBe(t.total);
  });
});
