// @ts-expect-error Node types are intentionally excluded from the browser app.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CHUNK_NAMES } from './chunkNames';

const source = JSON.parse(readFileSync('public/chunk-content.json', 'utf8')) as {
  chunks: Record<string, { n?: string }>;
};

describe('generated chunk place names', () => {
  it('preserves every named surface chunk without inventing names for unnamed chunks', () => {
    const expected = Object.fromEntries(Object.entries(source.chunks)
      .filter(([, entry]) => entry.n)
      .map(([id, entry]) => [`${Number(id) >> 8},${Number(id) & 255}`, entry.n]));
    expect(CHUNK_NAMES).toEqual(expected);
    expect(Object.values(CHUNK_NAMES).every(name => name.trim().length > 0)).toBe(true);
  });

  it('distinguishes nearby destinations and transit chunks in the public guides', () => {
    expect([
      '50,50', '49,49', '50,49', '49,50', '48,50',
      '48,49', '50,51', '49,51', '50,52', '50,53',
    ].map(chunk => CHUNK_NAMES[chunk])).toEqual([
      'Lumbridge Castle', 'West Lumbridge Swamp', 'East Lumbridge Swamp',
      'Lumbridge Castle Backyard', 'South Draynor', "Wizards' Tower",
      "Groats' Farm", 'Lumbridge Mill', 'Varrock South Gate', 'Varrock Center/Square',
    ]);
  });
});
