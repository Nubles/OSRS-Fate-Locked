import { describe, it, expect } from 'vitest';
import {
  isAreaReachable,
  isNamedAreaReachableViaChunks,
  isRegionUnlocked,
} from './reachability';
import { setStartArea, isFreeArea } from './freeAreas';
import { UnlockState } from '../types';

const baseUnlocks: UnlockState = {
  equipment: {},
  skills: {},
  levels: {},
  regions: [],
  chunks: [],
  mobility: [],
  arcana: [],
  housing: [],
  merchants: [],
  minigames: [],
  bosses: [],
  storage: [],
  guilds: [],
  farming: [],
  slayerUnlocks: [],
  quests: [],
  diaries: [],
  cas: [],
  completedTasks: [],
  collectionLog: {},
};

describe('isNamedAreaReachableViaChunks', () => {
  it('a sub-area overlapping the free start chunk (50,50) is reachable with no unlocked chunks', () => {
    // Lumbridge's chunk list includes {cx:50, cy:50}, the always-free start chunk.
    expect(isNamedAreaReachableViaChunks('Lumbridge', [])).toBe(true);
  });

  it('a sub-area with no overlapping chunk is unreachable', () => {
    // Al Kharid's chunks do not include the start chunk (50,50).
    expect(isNamedAreaReachableViaChunks('Al Kharid', [])).toBe(false);
  });

  it('becomes reachable once one of its chunks is added to unlockedChunkKeys', () => {
    expect(isNamedAreaReachableViaChunks('Al Kharid', ['51,50'])).toBe(true);
  });

  it('returns false for an unknown area name', () => {
    expect(isNamedAreaReachableViaChunks('Not A Real Place', [])).toBe(false);
  });
});

describe('isAreaReachable', () => {
  it('chunked mode: reachable via overlapping start chunk with empty unlocks.chunks', () => {
    expect(isAreaReachable('Lumbridge', { ...baseUnlocks, chunks: [] }, 'chunked')).toBe(true);
  });

  it('chunked mode: unreachable when no chunk overlaps', () => {
    expect(isAreaReachable('Al Kharid', { ...baseUnlocks, chunks: [] }, 'chunked')).toBe(false);
  });

  it('chunked mode: reachable after adding an overlapping chunk to unlocks.chunks', () => {
    expect(isAreaReachable('Al Kharid', { ...baseUnlocks, chunks: ['51,50'] }, 'chunked')).toBe(true);
  });

  it('non-chunked mode (vanilla) pins old isFreeArea || regions.includes behavior, unaffected by chunk state', () => {
    setStartArea('misthalin');
    try {
      // Lumbridge is a free Misthalin area regardless of unlocks.regions/chunks.
      expect(isAreaReachable('Lumbridge', { ...baseUnlocks, chunks: [] }, 'vanilla')).toBe(
        isFreeArea('Lumbridge') || baseUnlocks.regions.includes('Lumbridge'),
      );
      expect(isAreaReachable('Lumbridge', { ...baseUnlocks, chunks: ['51,50'] }, 'vanilla')).toBe(true);

      // Al Kharid is not free by default; only unlocked via unlocks.regions, never via chunks.
      expect(isAreaReachable('Al Kharid', { ...baseUnlocks, regions: [], chunks: [] }, 'vanilla')).toBe(false);
      expect(isAreaReachable('Al Kharid', { ...baseUnlocks, regions: [], chunks: ['51,50'] }, 'vanilla')).toBe(false);
      expect(isAreaReachable('Al Kharid', { ...baseUnlocks, regions: ['Al Kharid'], chunks: [] }, 'vanilla')).toBe(true);
    } finally {
      setStartArea(undefined);
    }
  });

  it('gameModeId undefined behaves the same as non-chunked', () => {
    setStartArea('misthalin');
    try {
      expect(isAreaReachable('Lumbridge', { ...baseUnlocks, chunks: [] }, undefined)).toBe(true);
      expect(isAreaReachable('Al Kharid', { ...baseUnlocks, regions: [], chunks: ['51,50'] }, undefined)).toBe(false);
    } finally {
      setStartArea(undefined);
    }
  });
});

describe('canonical Tirannwn completion', () => {
  it('completes without the removed Elf Camp duplicate', () => {
    const canonicalChildren = [
      'Prifddinas',
      'Lletya',
      'Tyras Camp',
      'Isafdar',
      'Zul-Andra',
      'Arandar',
      'Gwenith',
      'Iorwerth Camp',
      'Poison Waste',
    ];
    expect(isRegionUnlocked('Tirannwn', canonicalChildren)).toBe(true);
  });
});
