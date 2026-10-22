import { describe, expect, it } from 'vitest';
import { areaMapCut, chunksForArea } from './areaMapCut';
import { SUB_AREA_CHUNKS } from '../data/subAreaChunks';
import { REGIONS_LIST } from '../data/items';

describe('areaMapCut', () => {
  it('crops one chunk with a chunk of land around it', () => {
    // Chunk 48,53 (Barbarian Village): 192px chunks, x from chunk 15, y down from chunk 65.
    const cut = areaMapCut([{ cx: 48, cy: 53 }])!;
    expect(cut).toMatchObject({ x: (47 - 15) * 192, y: (65 - 54) * 192, width: 3 * 192, height: 3 * 192 });
    expect(cut.edges).toHaveLength(4);
  });

  it('outlines only the outside edges of a multi-chunk area', () => {
    const cut = areaMapCut([{ cx: 30, cy: 50 }, { cx: 31, cy: 50 }])!;
    expect(cut.edges).toHaveLength(6);
    expect(cut.width).toBe(4 * 192);
  });

  it('stays inside the map image at its edges', () => {
    const cut = areaMapCut([{ cx: 15, cy: 65 }])!;
    expect(cut.x).toBe(0);
    expect(cut.y).toBe(0);
  });

  it('finds chunks for named areas and Chunked-mode chunk keys', () => {
    expect(chunksForArea('Barbarian Village')).toEqual(SUB_AREA_CHUNKS['Barbarian Village']);
    expect(chunksForArea('48,53')).toEqual([{ cx: 48, cy: 53 }]);
    expect(chunksForArea('Nowhere')).toEqual([]);
  });

  it('has a picture for most area unlocks', () => {
    const covered = REGIONS_LIST.filter(name => chunksForArea(name).length > 0);
    expect(covered.length / REGIONS_LIST.length).toBeGreaterThan(0.8);
  });
});
