import { describe, expect, it } from 'vitest';
import { chunkLabel } from './chunkAdjacency';
import { chunkLabelWithCoords } from './chunkLabelWithCoords';
import { chunkPlaceLabel } from './chunkPlaceLabel';

describe('chunk labels', () => {
  it('log a chunk by its area and coordinates, never the bare key', () => {
    expect(chunkLabelWithCoords('49,50')).toBe('Lumbridge (49, 50)');
    // A chunk no area names already ends in its coordinates: not added twice.
    expect(chunkLabelWithCoords('0,0')).toBe(chunkLabel('0,0'));
    expect(chunkLabelWithCoords('0,0').match(/\(0, 0\)/g)).toHaveLength(1);
  });

  it("show the chunk's own name on screens, so chunks of one area read apart", () => {
    expect(chunkPlaceLabel('49,50')).toBe('Lumbridge Castle Backyard (49, 50)');
    expect(chunkPlaceLabel('50,49')).toBe('East Lumbridge Swamp (50, 49)');
    expect(chunkPlaceLabel('0,0')).toBe(chunkLabelWithCoords('0,0'));
  });
});
