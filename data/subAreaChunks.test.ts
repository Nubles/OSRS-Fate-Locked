import { describe, it, expect } from 'vitest';
import { SUB_AREA_CHUNKS } from './subAreaChunks';
import { REGIONS_LIST, MISTHALIN_AREAS } from './items';
import regionMapSrc from '../components/RegionMap.tsx?raw';

/** Chunks listed in the map's REGION_CHUNKS literal, as "cx,cy" keys. */
function mapChunkKeys(): Set<string> {
  const block = regionMapSrc.match(/const REGION_CHUNKS: Record<string, ChunkCoord\[\]> = \{([\s\S]*?)\n\};/)![1];
  const keys = new Set<string>();
  for (const m of block.matchAll(/\{ cx: (\d+), cy: (\d+) \}/g)) keys.add(`${m[1]},${m[2]}`);
  return keys;
}

describe('sub-area chunk assignments', () => {
  it('every sub-area name is one the unlock system tracks', () => {
    const known = new Set([...REGIONS_LIST, ...MISTHALIN_AREAS]);
    const unknown = Object.keys(SUB_AREA_CHUNKS).filter(k => !known.has(k));
    expect(unknown).toEqual([]);
  });

  it('no chunk belongs to two sub-areas', () => {
    const seen = new Map<string, string>();
    const dupes: string[] = [];
    for (const [sub, chunks] of Object.entries(SUB_AREA_CHUNKS)) {
      for (const c of chunks) {
        const k = `${c.cx},${c.cy}`;
        if (seen.has(k)) dupes.push(`${k}: ${seen.get(k)} + ${sub}`);
        seen.set(k, sub);
      }
    }
    expect(dupes).toEqual([]);
  });

  it('every sub-area chunk exists on the map (REGION_CHUNKS)', () => {
    const map = mapChunkKeys();
    const orphans: string[] = [];
    for (const [sub, chunks] of Object.entries(SUB_AREA_CHUNKS)) {
      for (const c of chunks) if (!map.has(`${c.cx},${c.cy}`)) orphans.push(`${sub}: ${c.cx},${c.cy}`);
    }
    expect(orphans).toEqual([]);
  });

  it('covers the flagship example — Falador is a multi-chunk group', () => {
    expect(SUB_AREA_CHUNKS['Falador']?.length).toBeGreaterThanOrEqual(4);
  });
});
