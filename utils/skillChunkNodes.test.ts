import { afterEach, describe, expect, it, vi } from 'vitest';
import { chunkContentService, type EntityHit } from '../services/ChunkContentService';
import { skillChunkNodes, trainingReqFor } from './skillChunkNodes';
import { chunkFactLevel } from './chunkedSkillPool';
import { buildChunkSkillNodes } from './chunkSkillNodesBuild';

type RawInterior = NonNullable<Parameters<typeof buildChunkSkillNodes>[0]['interiors']>[string];

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

describe('Chunked object rules: Blurite rocks (deep audit chunk-sample.d1[2])', () => {
  it('reads Blurite rocks at 10 Mining and leaves the gated Infernal shale rocks out', () => {
    // OSRS Wiki 'Blurite rocks', fetched 24 Nov 2026: "It can be mined by a player with level 10 Mining", |level = 10.
    expect(trainingReqFor('Blurite rocks', 'object')).toEqual({ skill: 'Mining', level: 10 });
    // 'Infernal shale rocks': "The rocks can only be accessed after speaking to Yama and agreeing to sign his
    // contract", a gate the tracker does not record.
    expect(trainingReqFor('Infernal shale rocks', 'object')).toBeNull();
    // The Asgarnian Ice Dungeon is entered from 47,49 with no requirement.
    expect(chunkFactLevel('47,49', 'Mining')).toBe(10);
    expect(chunkFactLevel('22,57', 'Mining')).toBeUndefined();
  });
});

describe('Chunked object rules: ore veins (deep audit chunk-sample.d2[1])', () => {
  it('reads the Abandoned Mine and Motherlode Mine veins at their Mining levels', () => {
    // OSRS Wiki, fetched 24 Nov 2026, each vein's own page (options = Mine, quest = No): 'Copper ore vein',
    // 'Tin ore vein', 'Clay ore vein' |level = 1; 'Iron ore vein' 15; 'Coal ore vein' 30; 'Mithril ore vein' 55;
    // 'Adamant ore vein' 70; 'Ore vein' (Motherlode Mine) |level = 30.
    const cases: [string, number][] = [['Copper vein', 1], ['Tin vein', 1], ['Clay vein', 1], ['Iron vein', 15],
      ['Coal vein', 30], ['Mithril vein', 55], ['Adamantite vein', 70], ['Ore vein', 30]];
    for (const [name, level] of cases) expect(trainingReqFor(name, 'object'), name).toEqual({ skill: 'Mining', level });
    // Dondakan's mine veins belong to Between a Rock... and stay out.
    expect(trainingReqFor('Mineral vein', 'object')).toBeNull();
    expect(trainingReqFor('Gold vein', 'object')).toBeNull();
    expect(chunkFactLevel('53,50', 'Mining')).toBe(1);
    expect(chunkFactLevel('47,52', 'Mining')).toBe(1);
  });

  it("leaves the Abandoned Mine's plain 'Ore vein' rows uncounted and counts the Motherlode Mine's", () => {
    const interior = (name: string): RawInterior => ({ name, content: { o: [['Ore vein', 3]] }, entrances: [{ chunkId: '13618', requirements: [] }] });
    const facts = (name: string) => buildChunkSkillNodes({ chunks: {}, interiors: { a: interior(name) } }).nodes['53,50']?.Mining;
    expect(facts('Abandoned Mine')).toBeUndefined();
    expect(facts('Motherlode Mine')).toBe(30);
  });
});

describe('Chunked object rules: fishing spots (deep audit chunk-sample.d3[1])', () => {
  it('reads the swamp and Camdozaal spots at their level and the quest spots as nothing', () => {
    // OSRS Wiki, fetched 24 Nov 2026: 'Fishing spot (swamp)' |level = 28; 'Fishing spot (Camdozaal)' small net
    // |level = 7; 'Fishing spot (Hemenster)' "they can only be used to catch whitefish" (a Land of the Goblins
    // item); 'Ominous Fishing Spot' "used to disturb Mogres"; 'Fishing spot (Braindeath Island)' "used during the
    // Rum Deal quest in order to catch Sluglings", |xp = 0; 'Fishing spot (Enchanted Valley)' "Nothing can be
    // fished from these spots".
    expect(trainingReqFor('Fishing spot (swamp)', 'object')).toEqual({ skill: 'Fishing', level: 28 });
    expect(trainingReqFor('Fishing spot (Camdozaal)', 'object')).toEqual({ skill: 'Fishing', level: 7 });
    for (const name of ['Fishing spot (Hemenster)', 'Ominous Fishing Spot', 'Fishing spot (Braindeath Island)', 'Fishing spot (Enchanted Valley)']) {
      expect(trainingReqFor(name, 'object'), name).toBeNull();
    }
    expect(trainingReqFor('Fishing spot', 'object')).toEqual({ skill: 'Fishing', level: 1 });
  });

  it('gives Hemenster, Mudskipper Point and Braindeath Island no Fishing and the swamp 28', () => {
    // 57,55 also counts the second Braindeath Island record, whose spots are named plain "Fishing spot".
    for (const chunk of ['41,53', '46,48', '57,55']) expect(chunkFactLevel(chunk, 'Fishing'), chunk).toBeUndefined();
    for (const chunk of ['53,51', '53,53', '54,53']) expect(chunkFactLevel(chunk, 'Fishing'), chunk).toBe(28);
  });
});

describe('Chunked Thieving: chests, sea pirates and Yanille watchmen (deep audit quest-routes.d2[0])', () => {
  it('reads the thievable chests, Pirate (Thieving) and the Watchman at their Wiki levels', () => {
    // OSRS Wiki, fetched 24 Nov 2026, each chest's own page: 'Chest (10 coins)' |level = 13; '(nature runes)' 28;
    // '(50 coins)' 43; '(steel arrowtips)' 47; '(Aldarin Villas)' 36; '(Ardougne Castle)' 72; '(Rogues' Castle)'
    // "They require 84 Thieving"; '(Dorgesh-Kaan Average)' 52; '(Dorgesh-Kaan Rich)' 78; '(Isle of Souls Dungeon)' 28.
    const chests: [string, number][] = [['Chest (10 coins)', 13], ['Chest (nature runes)', 28], ['Chest (50 coins)', 43],
      ['Chest (steel arrowtips)', 47], ['Chest (Aldarin Villas)', 36], ['Chest (Ardougne Castle)', 72],
      ["Chest (Rogues' Castle)", 84], ['Chest (Dorgesh-Kaan Average)', 52], ['Chest (Dorgesh-Kaan Rich)', 78],
      ['Chest (Isle of Souls Dungeon)', 28]];
    for (const [name, level] of chests) expect(trainingReqFor(name, 'object'), name).toEqual({ skill: 'Thieving', level });
    for (const name of ["Chest (Rogues' Castle, inside)", 'Chest (Tombs of Amascut)', 'Chest', 'Closed chest', 'Bank chest']) {
      expect(trainingReqFor(name, 'object'), name).toBeNull();
    }
    // 'Pirate (Thieving)': "pickpocketed at level 60 Thieving"; 'Watchman': "pickpocketed at level 65 Thieving".
    expect(trainingReqFor('Pirate (Thieving)', 'monster')).toEqual({ skill: 'Thieving', level: 60 });
    expect(trainingReqFor('Watchman', 'monster')).toEqual({ skill: 'Thieving', level: 65 });
    expect(trainingReqFor('Pirate', 'monster')).toBeNull();
  });

  it('gives the chest and pirate chunks their Thieving fact', () => {
    const cases: [string, number][] = [['47,61', 13], ['49,61', 13], ['36,45', 28], ['18,43', 60], ['32,57', 60], ['46,35', 60], ['39,48', 65]];
    for (const [chunk, level] of cases) expect(chunkFactLevel(chunk, 'Thieving'), chunk).toBe(level);
  });

  it("keeps the Rogues' Den maze chest out of Burthorpe's Thieving floor", () => {
    // OSRS Wiki 'Rogues' Den': entering the maze "requires level 50 in both Thieving and Agility"; the 10-coin
    // chest ('Chest (10 coins)', 3053,5037) is in the maze. The 32 this test pinned before came from the maze's
    // Rogue Guards, who cannot be pickpocketed (chunk-sample.d3[2]), so 45,55 has no Thieving fact at all.
    expect(chunkFactLevel('45,55', 'Thieving')).toBeUndefined();
    expect(chunkFactLevel('41,57', 'Thieving')).toBe(13);
  });
});

describe('pickpocket targets the Wiki confirms (deep audit chunk-sample.d3[2])', () => {
  it('drops the NPCs the Wiki says cannot be pickpocketed', () => {
    // OSRS Wiki, fetched 24 Nov 2026: 'Guard (Mistrock)' "they cannot be pickpocketed or attacked"; 'Man (The
    // Warrens)' "cannot be attacked or pickpocketed"; 'Woman (West Ardougne)' "not pickpocketed"; 'Town Guard'
    // "cannot be spoken to or battled"; 'Rogue Guard' patrols the Rogues' Den maze; Talk-to only for the rest.
    const npcs = [
      'Guard (Mistrock)', 'Guard (Cam Torum)', 'Market Guard (Draynor)', 'Town Guard', 'Bank guard', 'Jail Guard',
      'Guard Vemmeldo', 'Guard (Sinclair Mansion)', 'Guard (Carnillean)', 'Guard (Colosseum)', 'Guard (Prifddinas)',
      'Man (The Warrens)', 'Man (West Ardougne)', 'Man (Hosidius)', 'Man (Catacombs of Kourend)', 'Woman (West Ardougne)',
      'Poor looking man', 'Poor looking woman', 'Well-dressed man', 'Chief Farmer', 'Fred the Farmer', 'Farmer Brumty',
      'Farmer Fromund', 'Farmer Gricoller', 'Farmer Hayfield', 'Farmer (Shayzien)', 'Rogue Guard', 'Cave goblin child',
      'Gnome Waiter', 'Gnome soldier', 'Gnome traveller', 'Gnome emissary', 'Gnome baller', 'Gnome winger', 'Local Gnome',
      'Terrorchick gnome', 'Scout (Tree Gnome Stronghold)', 'TzHaar-Hur-Lek', 'TzHaar-Hur-Tel', 'TzHaar-Hur-Zal',
      'TzHaar-Hur-Rin', 'Vyrewatch', 'Vyrelord', 'Vyrelady',
    ];
    for (const name of npcs) expect(trainingReqFor(name, 'npc'), name).toBeNull();
    const monsters = [
      'Guard (Burthorpe)', 'Guard (dwarf)', 'Guard (Ranging Guild)', 'Guard (Desert Mining Camp)', 'Guard (Cave goblin)',
      'Guard Bandit', 'Jail guard', 'Man (level 4)', 'Cave goblin (monster)', 'Cave goblin guard', 'Cave goblin miner',
      'Vyrewatch', 'Vyrewatch Sentinel',
    ];
    for (const name of monsters) expect(trainingReqFor(name, 'monster'), name).toBeNull();
  });

  it('keeps the real pickpocket targets', () => {
    const keep: [string, 'npc' | 'monster', number][] = [
      ['Guard', 'monster', 40], ['Guard (Hosidius)', 'monster', 40], ['Guard (Shayzien)', 'monster', 40],
      ['Gnome', 'monster', 75], ['Gnome woman', 'monster', 75], ['Farmer', 'npc', 10], ['Farmer (Varlamore)', 'npc', 10],
      ['Master Farmer', 'npc', 38], ['Martin the Master Gardener', 'npc', 38], ['Man', 'npc', 1], ['Woman', 'npc', 1],
      ['Man (East Ardougne)', 'monster', 1], ['Woman (East Ardougne)', 'monster', 1], ['Rogue', 'monster', 32],
      ['Cave goblin', 'npc', 36], ['Cave goblin (Dorgesh-Kaan)', 'npc', 36], ['TzHaar-Hur', 'monster', 90],
      // Wiki 'Vyre': "Vyres that can be pickpocketed include" these Darkmeyer citizens (options Talk-to, Pickpocket).
      ['Vampyressa van Von', 'npc', 82], ['Nakasa Jovkai', 'npc', 82], ['Vormar Vakan', 'npc', 82],
    ];
    for (const [name, kind, level] of keep) expect(trainingReqFor(name, kind), name).toEqual({ skill: 'Thieving', level });
  });

  it('gives the chunks only the Thieving content they hold', () => {
    for (const chunk of ['21,44', '28,48', '28,54', '28,55', '38,52', '41,56', '42,55', '49,49', '56,49', '56,50', '57,50', '58,52']) {
      expect(chunkFactLevel(chunk, 'Thieving'), chunk).toBeUndefined();
    }
    const raised: [string, number][] = [['21,45', 10], ['25,57', 5], ['27,55', 40], ['38,51', 55], ['38,53', 75], ['40,52', 25]];
    for (const [chunk, level] of raised) expect(chunkFactLevel(chunk, 'Thieving'), chunk).toBe(level);
    // Darkmeyer keeps 82 from its named vyres.
    for (const chunk of ['56,51', '56,52', '56,53', '57,52']) expect(chunkFactLevel(chunk, 'Thieving'), chunk).toBe(82);
  });
});

describe('bandit pickpocket rule (deep audit quest-routes.d2[1])', () => {
  it('counts only the Bandit Camp and Pollnivneach bandits', () => {
    // Wiki 'Thieving' pickpocket table: Bearded Pollnivnian Bandit 45, Bandit (Bandit Camp) 53, Bandit
    // (Pollnivneach) 55. 'Bandit (Varlamore)', 'Bandit (Shayzien)' and 'Bandit' (Wilderness) never mention it.
    expect(trainingReqFor('Bandit (Bandit Camp)', 'monster')).toEqual({ skill: 'Thieving', level: 53 });
    expect(trainingReqFor('Bandit (Pollnivneach)', 'monster')).toEqual({ skill: 'Thieving', level: 45 });
    for (const name of ['Bandit (Varlamore)', 'Bandit (Shayzien)', 'Bandit']) expect(trainingReqFor(name, 'monster'), name).toBeNull();
    expect(trainingReqFor('Bandit (The Big Heist Lodge)', 'npc')).toBeNull();
  });

  it('leaves the Varlamore bandit chunks without a Thieving fact', () => {
    for (const chunk of ['22,47', '22,51', '23,49', '47,57']) expect(chunkFactLevel(chunk, 'Thieving'), chunk).toBeUndefined();
    expect(chunkFactLevel('52,46', 'Thieving')).toBe(45);
    expect(chunkFactLevel('49,46', 'Thieving')).toBe(53);
    expect(chunkFactLevel('24,56', 'Thieving')).toBe(40);
  });
});
