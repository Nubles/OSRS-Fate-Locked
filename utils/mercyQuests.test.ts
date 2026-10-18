import { afterAll, describe, expect, it, vi } from 'vitest';
import fullChunkContent from '../public/chunk-content.json';
import { createFreshState } from '../context/GameContext';
import { chunkContentService } from '../services/ChunkContentService';
import { chunkedQuestRows } from '../components/QuestDoabilityPanel';
import { setStartArea } from './freeAreas';
import { doableChunkedQuests, loadDoableChunkedQuests } from './mercyQuests';

// Audit V3 (October 2026): CALL_ON_FATE took the caller's list of doable
// quests, so an empty list opened Mercy whatever quests were doable. The
// provider now lists them itself from the chunk content, and calls nothing
// without it.
afterAll(() => { vi.unstubAllGlobals(); setStartArea('misthalin'); });

describe("Fate's Mercy's doable quests", () => {
  const run = () => ({ ...createFreshState(), gameModeId: 'chunked' });

  it('are not listed, and so Mercy is not called, while the chunk content cannot load', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503 })));
    expect(doableChunkedQuests(run())).toBeNull();
    expect(await loadDoableChunkedQuests(run)).toBeNull();
  });

  it('come from the loaded chunk content, read for the run as it is once loaded', async () => {
    setStartArea('none');
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => structuredClone(fullChunkContent) })));
    const read = vi.fn(run);
    const listed = await loadDoableChunkedQuests(read);
    expect(read).toHaveBeenCalledTimes(1);
    expect(chunkContentService.ready).toBe(true);
    const expected = chunkedQuestRows(run().unlocks, 'chunked').filter(row => row.bucket === 'DOABLE').map(row => row.id);
    expect(listed).toEqual(expected);
    expect(listed).toContain('Learning the Ropes'); // a start-chunk quest: Mercy stays shut on a fresh run
    expect(doableChunkedQuests(run())).toEqual(expected);
  });
});
