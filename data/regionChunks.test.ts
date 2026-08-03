import { describe, expect, it } from 'vitest';
import { readPinnedChunkSource } from '../scripts/chunk-source.mjs';
import { REGION_CHUNKS } from './regionChunks';

const coord = ({ cx, cy }: { cx: number; cy: number }) => `${cx},${cy}`;

describe('reviewed continent chunk universe', () => {
  it('matches every named/non-ocean numeric walkable source chunk exactly once', async () => {
    const { data } = await readPinnedChunkSource();
    const source = (data.walkableChunks as Array<string | number>)
      .map(String)
      .filter((id) => /^\d+$/.test(id))
      .filter((id) => {
        const chunk = data.chunks[id];
        return (chunk?.Nickname ?? chunk?.Name) !== 'Ocean Chunk';
      })
      .map((id) => `${Number(id) >> 8},${Number(id) & 255}`)
      .sort();
    const authored = Object.values(REGION_CHUNKS).flat().map(coord).sort();

    expect(source).toHaveLength(624);
    expect(new Set(authored).size).toBe(authored.length);
    expect(authored).toEqual(source);
  });

  it('classifies the four newly named islands under The Open Seas', () => {
    const openSeas = new Set(REGION_CHUNKS['The Open Seas'].map(coord));
    expect([...openSeas].filter((key) => [
      '39,34', '39,35', '40,34', '40,35',
    ].includes(key)).sort()).toEqual(['39,34', '39,35', '40,34', '40,35']);
  });
});
