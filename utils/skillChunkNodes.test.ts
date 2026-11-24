import { afterEach, describe, expect, it, vi } from 'vitest';
import { chunkContentService, type EntityHit } from '../services/ChunkContentService';
import { skillChunkNodes, trainingReqFor } from './skillChunkNodes';
import { chunkFactLevel } from './chunkedSkillPool';

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
  it('reads Wealthy citizens at 50 Thieving and Fremennik citizens at 45', () => {
    // OSRS Wiki 'Wealthy citizen' (rev 15286220): pickpocketed at 50 Thieving; Fremennik citizens at 45.
    expect(trainingReqFor('Wealthy citizen', 'npc')).toEqual({ skill: 'Thieving', level: 50 });
    expect(trainingReqFor('Fremennik citizen', 'npc')).toEqual({ skill: 'Thieving', level: 45 });
  });

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

  it('reads the deep audit d3[0] nodes at the level the game needs', () => {
    // OSRS Wiki, fetched 23 Nov 2026: 'Fishing spot (lantern)' harpoon |level = 52 (swordtip squid);
    // 'Fishing spot (cage, harpoon)' harpoon |level = 35 (tuna), cage 40; 'Daeyalt rocks' 20 Mining;
    // 'Bloodwood tree' and 'Engorged bloodwood tree' |level = 77; 'Menaphite guard' |options = None.
    expect(trainingReqFor('Fishing spot (lantern)', 'object')).toEqual({ skill: 'Fishing', level: 52 });
    expect(trainingReqFor('Fishing spot (cage, harpoon)', 'object')).toEqual({ skill: 'Fishing', level: 35 });
    expect(trainingReqFor('Fishing spot (dark crab)', 'object')).toEqual({ skill: 'Fishing', level: 85 });
    expect(trainingReqFor('Daeyalt rocks', 'object')).toEqual({ skill: 'Mining', level: 20 });
    expect(trainingReqFor('Daeyalt Essence', 'object')).toEqual({ skill: 'Mining', level: 60 });
    expect(trainingReqFor('Bloodwood tree', 'object')).toEqual({ skill: 'Woodcutting', level: 77 });
    expect(trainingReqFor('Engorged bloodwood tree', 'object')).toEqual({ skill: 'Woodcutting', level: 77 });
    expect(trainingReqFor('Menaphite Thug', 'npc')).toEqual({ skill: 'Thieving', level: 65 });
    expect(trainingReqFor('Menaphite Guard', 'npc')).toBeNull();
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

describe('Chunked object rules: scenery that trains nothing (deep audit chunk-sample.d1[1])', () => {
  it('reads palm, Hunter, quest and shortcut trees, the Lighthouse stepping stones and non-stall stalls as nothing', () => {
    // OSRS Wiki, fetched 24 Nov 2026: 'Leafy Palm Tree' "Leafy palm trees cannot be cut"; 'Grotto tree' options
    // Look-at, Search; 'Young tree' options1 = Set-trap; 'Windswept tree' quest = Olaf's Quest, |xp = 0; 'Palm tree'
    // location = Fruit tree patch; 'Tropical tree (Al Kharid Rooftop Course)' Swing-across and '(Ape Atoll Agility
    // Course)' Climb; 'Strong tree' "strong trees may not be cut"; 'Stymphike tree' "Rather than chopping them, they
    // are used in the Hunter skill"; 'Broken dead tree' options Investigate; 'Fallen Tree (Weiss)' options Pass;
    // 'Evergreen tree (Mac)' |level = 99 |xp = 0; 'Basalt rock' options Jump-across; 'Antiques Shop Stall' Ring-bell;
    // 'Market stall (Pollnivneach Rooftop Course)' Jump-on; 'Craft stall' "there is no option to steal";
    // 'Boulder (dense essence mine)' "a shortcut ... requiring 49 Agility".
    for (const name of ['Leafy Palm Tree', 'Grotto tree', 'Young tree', 'Windswept tree', 'Palm tree', 'Tropical tree',
      'Strong tree', 'Strong Tree', 'Stymphike tree', 'Broken dead tree', 'Fallen Tree', 'Evergreen tree (Mac)',
      'Basalt rock', 'Basalt rocks', 'Antiques Shop Stall', 'Market stall', 'Craft stall', 'Boulder (dense essence mine)']) {
      expect(trainingReqFor(name, 'object'), name).toBeNull();
    }
    // 'Dense runestone': "only 38 Mining is required to mine the essence"; 'Basalt rocks (mining)' |level = 72.
    expect(trainingReqFor('Dense runestone', 'object')).toEqual({ skill: 'Mining', level: 38 });
    expect(trainingReqFor('Basalt rock (mining)', 'object')).toEqual({ skill: 'Mining', level: 72 });
    expect(trainingReqFor('Market stall (wine)', 'object')).toEqual({ skill: 'Thieving', level: 22 });
    expect(trainingReqFor('Crafting Stall', 'object')).toEqual({ skill: 'Thieving', level: 5 });
    expect(trainingReqFor('Evergreen tree', 'object')).toEqual({ skill: 'Woodcutting', level: 1 });
    expect(trainingReqFor('Palm tree patch', 'object')?.skill).toBe('Farming');
  });

  it('gives the Lighthouse no Mining and Darkmeyer its Blisterwood level', () => {
    expect(chunkFactLevel('39,56', 'Mining')).toBeUndefined();
    expect(chunkFactLevel('27,60', 'Mining')).toBe(38);
    expect(chunkFactLevel('56,52', 'Woodcutting')).toBe(62);
    expect(chunkFactLevel('41,49', 'Thieving')).toBeUndefined();
    expect(chunkFactLevel('51,43', 'Thieving')).toBe(65);
    for (const chunk of ['41,37', '48,39', '51,42', '53,52']) expect(chunkFactLevel(chunk, 'Woodcutting'), chunk).toBeUndefined();
  });
});
