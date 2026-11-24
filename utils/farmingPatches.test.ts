import { beforeAll, describe, expect, it, vi } from 'vitest';
import content from '../public/chunk-content.json';
import { initialState } from '../context/GameContext';
import { ChunkContentService } from '../services/ChunkContentService';
import { buildChunkPermissionSnapshot } from './chunkPermissionSnapshot';
import { farmingPatchFor } from './farmingPatches';

const service = new ChunkContentService();
beforeAll(async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => content })));
  await service.init();
  vi.unstubAllGlobals();
});

const farmingRows = (cx: number, cy: number, farming: string[] = []) => {
  const unlocks = { ...structuredClone(initialState.unlocks), farming, chunks: [`${cx},${cy}`] };
  return buildChunkPermissionSnapshot(service.contentFor(cx, cy)!, { cx, cy }, { unlocks, gameModeId: 'chunked', contentService: service })
    .categories.FARMING ?? [];
};

/**
 * The Vinery is the Hosidius greenhouse's vine patches (Wiki "Vinery" rev 15361773). Aldarin's
 * Grapevines are scenery picked for the Vineyard foreman (Wiki "Grapevine" rev 15329903).
 */
describe('the Vinery farming patch', () => {
  it('is the Hosidius vine patch, not the Aldarin grapevines', () => {
    expect(farmingPatchFor('Vine patch')).toBe('Vinery');
    expect(farmingPatchFor('Grapevine')).toBeNull();
  });

  it('gives the plugin a Vinery row in Hosidius (28,55) and none for the grapevines in Aldarin (21,45)', () => {
    expect(service.contentFor(28, 55)!.objects.map(([name]) => name)).toContain('Vine patch');
    expect(farmingRows(28, 55).map(({ name, status }) => [name, status])).toContainEqual(['Vine patch', 'LOCKED']);
    expect(farmingRows(28, 55, ['Vinery']).find(({ name }) => name === 'Vine patch')?.status).toBe('ALLOWED');
    expect(service.contentFor(21, 45)!.objects.map(([name]) => name)).toContain('Grapevine');
    // Aldarin's only farming row is its real hops patch; the Vinery unlock changes nothing there.
    expect(farmingRows(21, 45).map(({ key }) => key)).toEqual(['farm:hops patch']);
    expect(farmingRows(21, 45, ['Vinery'])).toEqual(farmingRows(21, 45));
  });
});
