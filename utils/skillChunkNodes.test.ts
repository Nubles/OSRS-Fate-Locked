import { afterEach, describe, expect, it, vi } from 'vitest';
import { chunkContentService, type EntityHit } from '../services/ChunkContentService';
import { skillChunkNodes, trainingReqFor } from './skillChunkNodes';

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

describe('trainingReqFor (Chunked skill facts, content review 8)', () => {
  it('reads farming patches as Farming at their lowest crop level, before any tree rule', () => {
    expect(trainingReqFor('Tree patch', 'object')).toEqual({ skill: 'Farming', level: 15 });
    expect(trainingReqFor('Fruit Tree Patch', 'object')).toEqual({ skill: 'Farming', level: 27 });
    expect(trainingReqFor('Hardwood tree patch', 'object')).toEqual({ skill: 'Farming', level: 35 });
    expect(trainingReqFor('Redwood tree patch', 'object')).toEqual({ skill: 'Farming', level: 90 });
    expect(trainingReqFor('Spirit Tree Patch', 'object')).toEqual({ skill: 'Farming', level: 83 });
    expect(trainingReqFor('Cactus patch', 'object')).toEqual({ skill: 'Farming', level: 55 });
    expect(trainingReqFor('Calquat patch', 'object')).toEqual({ skill: 'Farming', level: 72 });
    expect(trainingReqFor('Herb patch', 'object')).toEqual({ skill: 'Farming', level: 9 });
    expect(trainingReqFor('Allotment patch', 'object')).toEqual({ skill: 'Farming', level: 1 });
    expect(trainingReqFor('Hops Patch', 'object')).toEqual({ skill: 'Farming', level: 3 });
    // Scenery that only looks like a patch.
    for (const name of ['Bush', 'Grapevine', 'Patched Wall', 'Weedy patch']) expect(trainingReqFor(name, 'object'), name).toBeNull();
  });

  it('drops look-alikes that train nothing', () => {
    for (const name of ['Tall tree', 'Tree branch', 'Big Tree space', 'Tree Stump', 'Rocks (Tree Gnome Stronghold)', 'Dig Site specimen rocks', 'Rift', "Shipwrights' Workbench", 'Sawmill', 'Banana Tree']) {
      expect(trainingReqFor(name, 'object'), name).toBeNull();
    }
    expect(trainingReqFor('Butterfly', 'npc')).toBeNull();
    expect(trainingReqFor('Ruby harvest', 'npc')).toEqual({ skill: 'Hunter', level: 15 });
    expect(trainingReqFor('Tree', 'object')).toEqual({ skill: 'Woodcutting', level: 1 });
  });
});
