import { describe, it, expect } from 'vitest';
import { SUB_AREA_CHUNKS } from './subAreaChunks';
import { REGION_CHUNKS } from './regionChunks';
import { REGIONS_LIST, MISTHALIN_AREAS, REGION_GROUPS } from './items';

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

  it('keeps every named sub-area in its canonical parent continent', () => {
    const parent = new Map<string, string>();
    for (const [continent, areas] of Object.entries(REGION_GROUPS)) {
      for (const area of areas) parent.set(area, continent);
    }
    for (const area of MISTHALIN_AREAS) parent.set(area, 'Misthalin');

    const actual = new Map<string, string>();
    for (const [continent, chunks] of Object.entries(REGION_CHUNKS)) {
      for (const chunk of chunks) actual.set(`${chunk.cx},${chunk.cy}`, continent);
    }

    const mismatches = Object.entries(SUB_AREA_CHUNKS).flatMap(([area, chunks]) =>
      chunks.flatMap(({ cx, cy }) => {
        const expected = parent.get(area);
        const found = actual.get(`${cx},${cy}`);
        return expected && found !== expected
          ? [`${area} ${cx},${cy}: ${found} -> ${expected}`]
          : [];
      }),
    );
    expect(mismatches).toEqual([]);
  });

  it('covers the flagship example — Falador is a multi-chunk group', () => {
    expect(SUB_AREA_CHUNKS['Falador']?.length).toBeGreaterThanOrEqual(4);
  });
});
