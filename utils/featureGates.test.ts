import { describe, it, expect } from 'vitest';
import { visibleFeatures, isFeatureVisible, ALL_FEATURE_IDS, FEATURE_GATES } from './featureGates';
import type { GateInput } from './featureGates';
import type { LogEntry, UnlockState } from '../types';

function emptyUnlocks(over: Partial<UnlockState> = {}): UnlockState {
  return {
    equipment: {}, skills: {}, levels: {}, regions: [], chunks: [],
    mobility: [], arcana: [], housing: [], merchants: [], minigames: [],
    bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [],
    banks: [], quests: [], diaries: [], cas: [], completedTasks: [],
    collectionLog: {},
    ...over,
  };
}

const log = (n: number, type: LogEntry['type'] = 'ROLL_SUCCESS'): LogEntry[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `e${i}`, timestamp: i, type, message: 'x',
  }));

const state = (over: Partial<GateInput> = {}): GateInput => ({
  history: [], unlocks: emptyUnlocks(), fatePoints: 0, ...over,
});

describe('featureGates', () => {
  it('a fresh run reveals nothing beyond the core loop', () => {
    expect(visibleFeatures(state()).size).toBe(0);
  });

  it('first roll reveals History and Journal', () => {
    const v = visibleFeatures(state({ history: log(1) }));
    expect(v.has('ctrl:LOG')).toBe(true);
    expect(v.has('dash:JOURNAL')).toBe(true);
    expect(v.has('dash:COLLECTION')).toBe(false);
  });

  it('first region unlock reveals the World tab', () => {
    expect(isFeatureVisible('dash:WORLD', state({ unlocks: emptyUnlocks({ regions: ['Kandarin'] }) }))).toBe(true);
    expect(isFeatureVisible('dash:WORLD', state())).toBe(false);
  });

  it('chunked-mode chunk unlocks also reveal the World tab', () => {
    expect(isFeatureVisible('dash:WORLD', state({ unlocks: emptyUnlocks({ chunks: ['50,50'] }) }))).toBe(true);
  });

  it('the Altar reveals with the first Fate Point', () => {
    expect(isFeatureVisible('tool:altar', state({ fatePoints: 1 }))).toBe(true);
    expect(isFeatureVisible('tool:altar', state())).toBe(false);
  });

  it('any activity-type unlock reveals Activities & Utility', () => {
    expect(isFeatureVisible('dash:ACTIVITIES', state({ unlocks: emptyUnlocks({ minigames: ['Wintertodt'] }) }))).toBe(true);
    expect(isFeatureVisible('dash:ACTIVITIES', state({ unlocks: emptyUnlocks({ banks: ['12850'] }) }))).toBe(true);
  });

  it('a boss or minigame reveals the Collection Log', () => {
    expect(isFeatureVisible('dash:COLLECTION', state({ unlocks: emptyUnlocks({ bosses: ['Zulrah'] }) }))).toBe(true);
  });

  it('every gate has a history fallback, so a long run reveals everything', () => {
    const v = visibleFeatures(state({ history: log(50) }));
    expect(v.size).toBe(ALL_FEATURE_IDS.length);
  });

  it('revealAllFeatures overrides all gates', () => {
    const v = visibleFeatures(state({ revealAllFeatures: true }));
    expect(v.size).toBe(ALL_FEATURE_IDS.length);
  });

  it('reveals are monotonic in history length (nothing re-hides)', () => {
    let prev = new Set<string>();
    for (let n = 0; n <= 15; n++) {
      const v = visibleFeatures(state({ history: log(n) }));
      for (const id of prev) expect(v.has(id as never)).toBe(true);
      prev = v as unknown as Set<string>;
    }
  });

  it('every gate carries reveal copy', () => {
    for (const g of FEATURE_GATES) expect(g.revealMessage.length).toBeGreaterThan(10);
  });
});
