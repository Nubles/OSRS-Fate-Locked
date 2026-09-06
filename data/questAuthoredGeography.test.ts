import { describe, expect, it } from 'vitest';
import review from './sources/quest-authored-geography-review.json';
import { QUEST_DATA } from './questData';
import { ALL_CHUNK_KEYS, chunkKey } from '../utils/chunkAdjacency';
import { evaluateChunkQuestGeography } from '../utils/questChunkGeography';

describe('authored quest completion geography reconciliation', () => {
  it('accounts for all 56 authored records and preserves Standard geography', () => {
    expect(review.entries).toHaveLength(56);
    expect(new Set(review.scope).size).toBe(56);
    for (const entry of review.entries) {
      const quest = QUEST_DATA[entry.id];
      expect({ accessPolicy: quest.accessPolicy, regions: quest.regions,
        locations: quest.locations ?? null, oneOf: quest.oneOf ?? null }, entry.id)
        .toEqual(entry.standardBaseline);
      expect(quest.chunkedGeography ?? null, entry.id).toEqual(entry.model);
    }
  });

  it('uses canonical destination chunks and prevents empty alternatives from passing', () => {
    for (const entry of review.entries) {
      const model = QUEST_DATA[entry.id].chunkedGeography;
      if (!model) continue;
      for (const location of [...model.locations, ...model.groups.flatMap(g => g.routes.flatMap(r => r.locations))]) {
        for (const point of location.chunkOptions) expect(ALL_CHUNK_KEYS, `${entry.id}: ${location.label}`).toContain(chunkKey(point));
      }
      for (const group of model.groups) for (const route of group.routes) {
        if (!route.locations.length) expect(route.unknowns?.length, entry.id).toBeGreaterThan(0);
      }
    }
  });

  it.each([
    ['Plague City', '40,52'], ['Below Ice Mountain', '48,53'],
    ['Dwarf Cannon', '40,53'], ['A Porcine of Interest', '49,52'],
    ['A Porcine of Interest', '48,51'], ['Scrambled!', '19,48'],
    ['Ethically Acquired Antiquities', '51,54'], ['Devious Minds', '53,54'],
    ['Devious Minds', '46,53'], ['Devious Minds', '44,52'],
    ['Devious Minds', '46,52'], ['Family Crest', '47,53'],
  ])('%s blocks the missing mandatory destination %s', (id, missing) => {
    const result = evaluateChunkQuestGeography(QUEST_DATA[id].chunkedGeography!, {
      chunks: ALL_CHUNK_KEYS.filter(key => key !== missing),
    });
    expect(result.blockers.length).toBeGreaterThan(0);
  });

  it('does not require the Lava Maze for Heroes or unrelated southern Varrock for Below Ice Mountain', () => {
    for (const [id, excluded] of [["Heroes' Quest", '47,59'], ['Below Ice Mountain', '50,52']]) {
      const model = QUEST_DATA[id].chunkedGeography!;
      expect(model.locations.flatMap(l => l.chunkOptions.map(chunkKey))).not.toContain(excluded);
    }
  });

  it('retains explicit unresolved acquisition, identity and sailing conditions even with every chunk', () => {
    for (const id of ['Prince Ali Rescue', 'Family Crest', "Heroes' Quest", 'Fairytale II - Cure a Queen', 'Pandemonium', 'Prying Times', 'Into the Tombs']) {
      const result = evaluateChunkQuestGeography(QUEST_DATA[id].chunkedGeography!, { chunks: ALL_CHUNK_KEYS });
      expect(result.unknowns.length, id).toBeGreaterThan(0);
    }
  });

  it('requires the entire three-mage route and keeps other combinations unresolved', () => {
    const model = QUEST_DATA['Enter the Abyss'].chunkedGeography!;
    const full = evaluateChunkQuestGeography(model, { chunks: ALL_CHUNK_KEYS });
    expect(full.unknowns).toEqual([]);
    for (const missing of ['50,53', '48,49', '41,51']) {
      const result = evaluateChunkQuestGeography(model, { chunks: ALL_CHUNK_KEYS.filter(key => key !== missing) });
      expect(result.unknowns.length).toBeGreaterThan(0);
    }
  });
});
