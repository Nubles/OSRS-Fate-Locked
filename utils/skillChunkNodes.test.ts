import { afterEach, describe, expect, it, vi } from 'vitest';
import { chunkContentService, type EntityHit } from '../services/ChunkContentService';
import { skillChunkNodes } from './skillChunkNodes';

describe('skillChunkNodes Wyrmscraig resources', () => {
  afterEach(() => vi.restoreAllMocks());

  it('groups Sunstone rocks and the monolith by their Mining requirement', () => {
    const objects: EntityHit[] = [
      {
        name: 'Sunstone rocks',
        kind: 'object',
        locations: [
          { cx: 40, cy: 34 }, // Wyrmscraig Goat Pasture
          { cx: 40, cy: 35 }, // Auchrie
        ],
      },
      {
        name: 'Sunstone monolith',
        kind: 'object',
        locations: [{ cx: 40, cy: 35 }], // Auchrie
      },
    ];

    vi.spyOn(chunkContentService, 'ready', 'get').mockReturnValue(true);
    vi.spyOn(chunkContentService, 'entitiesOfKind').mockImplementation((kind) =>
      kind === 'object' ? objects : [],
    );

    expect(skillChunkNodes('Mining')).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Sunstone rocks', level: 53, tier: 6, chunks: 2 }),
      expect.objectContaining({ name: 'Sunstone monolith', level: 53, tier: 6, chunks: 1 }),
    ]));
  });
});
