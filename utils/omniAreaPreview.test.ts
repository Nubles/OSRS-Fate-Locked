import { describe, expect, it } from 'vitest';
import type { UnlockState } from '../types';
import { previewOmniArea } from './omniAreaPreview';
import { chunkUnlocked } from './chunkLocations';

const emptyUnlocks = (): UnlockState => ({
  equipment: {}, skills: {}, levels: {}, regions: [], chunks: [],
  mobility: [], arcana: [], housing: [], merchants: [], minigames: [],
  bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [],
  banks: [], quests: [], diaries: [], cas: [], completedTasks: [],
  collectionLog: {},
} as UnlockState);

describe('previewOmniArea', () => {
  it('lists exactly the chunks an Omni-Key on the area would open', () => {
    const unlocks = emptyUnlocks();
    const preview = previewOmniArea('Taverley', unlocks, 'vanilla');
    expect(preview.eligible).toBe(true);
    const keys = preview.chunks.map(c => `${c.cx},${c.cy}`);
    expect(keys).toEqual(expect.arrayContaining(['45,53', '44,54', '45,54']));
    const after = { ...unlocks, regions: ['Taverley'] };
    for (const c of preview.chunks) {
      expect(chunkUnlocked(c.cx, c.cy, unlocks, 'vanilla')).toBe(false);
      expect(chunkUnlocked(c.cx, c.cy, after, 'vanilla')).toBe(true);
    }
  });

  it('is not offered for an area already unlocked', () => {
    const preview = previewOmniArea('Taverley', { ...emptyUnlocks(), regions: ['Taverley'] }, 'vanilla');
    expect(preview).toMatchObject({ eligible: false, chunks: [] });
  });

  it('is never offered in Chunked mode', () => {
    expect(previewOmniArea('Taverley', emptyUnlocks(), 'chunked').eligible).toBe(false);
  });
});
