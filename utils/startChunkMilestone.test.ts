import { describe, expect, it } from 'vitest';
import { startChunkMilestone, startChunkMilestoneText } from './startChunkMilestone';

describe('startChunkMilestone', () => {
  it('counts to the next 25 total levels while a Chunked run holds only its start chunk', () => {
    expect(startChunkMilestone('chunked', { chunks: [] }, 32)).toEqual({ nextAt: 50, levelsToGo: 18, interval: 25 });
    expect(startChunkMilestone('chunked', {}, 50)).toEqual({ nextAt: 75, levelsToGo: 25, interval: 25 });
    expect(startChunkMilestoneText(startChunkMilestone('chunked', { chunks: [] }, 49)!))
      .toBe('While you hold only your start chunk, every 25 total levels gives a guaranteed Key. Next at total level 50: 1 level to go.');
  });

  it('shows nothing once another chunk is unlocked, or outside Chunked', () => {
    expect(startChunkMilestone('chunked', { chunks: ['49,50'] }, 32)).toBeNull();
    expect(startChunkMilestone('vanilla', { chunks: [] }, 32)).toBeNull();
  });
});
