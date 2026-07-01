import { describe, it, expect } from 'vitest';
import { buildRuneliteBundle, RuneliteRunState } from './runeliteBundle';

const state: RuneliteRunState = {
  keys: 3, specialKeys: 0, chaosKeys: 0, fatePoints: 0, activeBuff: 'NONE', pinnedGoals: [],
};

describe('buildRuneliteBundle — unlockedChunks presence', () => {
  it('omits unlockedChunks entirely when not passed (non-chunked mode)', () => {
    const bundle = buildRuneliteBundle([], state) as any;
    expect('unlockedChunks' in bundle).toBe(false);
  });

  it('includes an EMPTY unlockedChunks array for a fresh Chunked run (0 unlocked)', () => {
    // This is the edge case that matters: a Chunked run at the very start has
    // unlocks.chunks === [], same shape as "not chunked at all" — the plugin
    // needs the field's mere PRESENCE (not its length) to tell the two apart,
    // since the free start chunk must still read as unlocked in-game.
    const bundle = buildRuneliteBundle([], state, undefined, undefined, []) as any;
    expect('unlockedChunks' in bundle).toBe(true);
    expect(bundle.unlockedChunks).toEqual([]);
  });

  it('includes a populated unlockedChunks array once chunks are rolled', () => {
    const bundle = buildRuneliteBundle([], state, undefined, undefined, ['50,51', '51,50']) as any;
    expect(bundle.unlockedChunks).toEqual(['50,51', '51,50']);
  });
});
