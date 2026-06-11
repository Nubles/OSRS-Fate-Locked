import { describe, it, expect } from 'vitest';
import { SUB_AREA_CHUNKS } from './subAreaChunks';
import { REGION_CHUNKS } from './regionChunks';
import { REGIONS_LIST, MISTHALIN_AREAS } from './items';

/** Chunks on the map, as "cx,cy" keys. */
function mapChunkKeys(): Set<string> {
  const keys = new Set<string>();
  for (const chunks of Object.values(REGION_CHUNKS)) {
    for (const c of chunks) keys.add(`${c.cx},${c.cy}`);
  }
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
