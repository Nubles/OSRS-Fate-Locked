import { describe, it, expect } from 'vitest';
import { chunkReachability } from './chunkReach';
import { chunkForPlace } from './chunkLocations';
import { UnlockState } from '../types';

const base = (over: Partial<UnlockState> = {}): UnlockState => ({
  equipment: {}, skills: {}, levels: {}, regions: [], mobility: [], arcana: [],
  housing: [], merchants: [], minigames: [], bosses: [], storage: [], guilds: [],
  farming: [], slayerUnlocks: [], quests: [], diaries: [], cas: [],
  completedTasks: [], collectionLog: {},
  ...over,
});

describe('chunkReachability', () => {
  it('with default unlocks (Misthalin free), home is owned and reachable', () => {
    const home = chunkForPlace('Lumbridge');
    const r = chunkReachability({}, base(), home);
    expect(r.ownedCount).toBeGreaterThan(0);
    // Lumbridge + its walkable Misthalin neighbours form one connected blob,
    // so with no transport graph at all nothing should be stranded by walking.
    expect(r.reachable.size).toBeGreaterThan(0);
  });

  it('returns everything stranded when home is not owned', () => {
    // A fake home far outside any region → not owned → nothing anchored.
    const r = chunkReachability({}, base(), { cx: 0, cy: 0 });
    expect(r.reachable.size).toBe(0);
    expect(r.stranded.size).toBe(r.ownedCount);
  });

  it('reachable + stranded partition the owned set', () => {
    const r = chunkReachability({}, base(), chunkForPlace('Lumbridge'));
    expect(r.reachable.size + r.stranded.size).toBe(r.ownedCount);
  });
});
