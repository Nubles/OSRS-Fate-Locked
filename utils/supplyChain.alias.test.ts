import { describe, expect, it } from 'vitest';
import type { GameState } from '../types';
import { RESOURCE_MAP } from '../data/resourceData';
import { calculateSupplyChain } from './supplyChain';

const stateWith = (
  gameModeId: string,
  regions: string[] = [],
  chunks: string[] = [],
): GameState => ({
  keys: 0, specialKeys: 0, chaosKeys: 0, fatePoints: 0,
  unlocks: {
    equipment: {}, skills: {}, levels: {}, regions, chunks,
    mobility: [], arcana: [], housing: [], merchants: [], minigames: [],
    bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [],
    quests: [], diaries: [], cas: [], completedTasks: [], collectionLog: {},
  },
  history: [], pinnedGoals: [], userNotes: {}, activeBuff: 'NONE',
  animationsEnabled: true, hasSeenOnboarding: true,
  gameModeId, gameModeLocked: false, customMode: undefined, version: 1,
} as GameState);

describe('supply-chain authored region aliases', () => {
  it.each([
    ["Otto's Grotto", 'Baxtorian Falls', '39,53'],
    ['Elf Camp', 'Iorwerth Camp', '33,50'],
  ])('uses canonical ownership for %s in Standard and Chunked modes', (
    authoredRegion,
    canonicalRegion,
    canonicalChunk,
  ) => {
    const item = `__supply_alias_${authoredRegion}`;
    RESOURCE_MAP[item] = [{ type: 'DROP', name: 'Alias fixture', regions: [authoredRegion] }];

    try {
      expect(calculateSupplyChain(item, stateWith('standard', [canonicalRegion]))
        ?.sources[0].status.isAvailable).toBe(true);
      expect(calculateSupplyChain(item, stateWith('chunked', [], [canonicalChunk]))
        ?.sources[0].status.isAvailable).toBe(true);
    } finally {
      delete RESOURCE_MAP[item];
    }
  });
});
