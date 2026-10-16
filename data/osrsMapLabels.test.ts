import { describe, expect, it } from 'vitest';
import { OSRS_MAP_LABELS } from './osrsMapLabels';
import { SUB_AREA_CHUNKS } from './subAreaChunks';
import { REGION_CHUNKS } from './regionChunks';

describe('OSRS map place-name labels', () => {
  it.each(OSRS_MAP_LABELS.map(l => [l.area, l] as const))('%s sits inside its own area', (_area, l) => {
    const chunks = SUB_AREA_CHUNKS[l.area] ?? REGION_CHUNKS[l.area];
    expect(chunks, `${l.area} has no chunks`).toBeDefined();
    const cx = Math.floor(l.tile[0] / 64);
    const cy = Math.floor(l.tile[1] / 64);
    expect(chunks.some(c => c.cx === cx && c.cy === cy), `${l.area} label tile is in chunk ${cx},${cy}`).toBe(true);
  });
});
