import { describe, expect, it } from 'vitest';
import { questWalkthroughFor } from '../../data/questWalkthroughs.public';
import type { ItemSourceRecord } from '../../services/ChunkContentService';
import {
  materializeQuestRouteSnapshot,
  type RuneProofContentService,
} from './goalPlannerRuneProof';

const contentWith = (records: readonly ItemSourceRecord[]): RuneProofContentService => ({
  init: async () => true,
  itemSourceRecords: itemName => records.filter(record => (
    record.itemName.toLowerCase() === itemName.toLowerCase()
  )),
  itemSourceCoverage: () => 'COMPLETE',
  entityLocations: () => null,
  taskRequirements: () => [],
  chunkEntryRequirements: () => [],
  connectGraph: () => ({}),
});

const account = {
  gameModeId: 'vanilla',
  unlockedChunks: [],
  unlocks: {
    skills: {}, levels: {}, regions: [], chunks: [], quests: [], guilds: [], merchants: [],
    minigames: [], mobility: [], slayerUnlocks: [],
  },
};

describe('materializeQuestRouteSnapshot', () => {
  it('keeps an interior source beside the surface source at the same chunk', () => {
    // The Cyclops at 44,55 has a surface record and a Warriors' Guild#Basement
    // interior record with different access; de-duplication must keep both.
    const surface: ItemSourceRecord = {
      itemName: 'Black bead',
      kind: 'monster',
      hostName: 'Cyclops',
      cx: 44,
      cy: 55,
      rawRequirements: [{ raw: "Access the Warriors' Guild", origin: 'ENTITY' }],
    };
    const interior: ItemSourceRecord = { ...surface, sourceId: '11675', rawRequirements: [] };

    const snapshot = materializeQuestRouteSnapshot(
      'Imp Catcher',
      account,
      contentWith([surface, interior, { ...interior }]),
      1,
      questWalkthroughFor('Imp Catcher')!,
    );

    expect(snapshot.itemSourceRecords.filter(record => record.hostName === 'Cyclops'))
      .toEqual([surface, interior]);
  });
});
