// @ts-expect-error Node types are intentionally excluded from the browser app.
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { chunkContentService } from '../services/ChunkContentService';
import { REGION_CHUNKS } from '../data/regionChunks';
import { itemObtainability } from './itemObtainability';
import type { UnlockState } from '../types';

// A Kandarin chunk; Chunked runs own chunks and never get region unlocks.
const source = (REGION_CHUNKS as Record<string, { cx: number; cy: number }[]>).Kandarin[0];
const chunkedState = (chunks: string[]) => ({ chunks, regions: [] } as unknown as UnlockState);

const stubSources = () => {
  vi.spyOn(chunkContentService, 'ready', 'get').mockReturnValue(true);
  vi.spyOn(chunkContentService, 'itemSourceChunks').mockReturnValue([{ cx: source.cx, cy: source.cy }] as never);
};

afterEach(() => vi.restoreAllMocks());

describe('itemObtainability in Chunked mode', () => {
  it('reads an item sold or dropped in an owned chunk as obtainable', () => {
    stubSources();
    expect(itemObtainability('Test item', chunkedState([`${source.cx},${source.cy}`]), 'chunked')).toBe('obtainable');
  });

  it('reads it as locked when the run does not own that chunk', () => {
    stubSources();
    expect(itemObtainability('Test item', chunkedState([]), 'chunked')).toBe('locked');
  });

  it('is given the run\'s game mode by both gear pickers', () => {
    for (const file of ['../components/GearView.tsx', '../components/osrs/OsrsCharGear.tsx']) {
      const text = readFileSync(new URL(file, import.meta.url), 'utf8');
      const calls = text.match(/itemObtainability\(([^)]*)\)/g) ?? [];
      expect(calls.length, file).toBeGreaterThan(0);
      for (const call of calls) expect(call, file).toMatch(/,\s*gameModeId\s*\)$/);
    }
  });
});
