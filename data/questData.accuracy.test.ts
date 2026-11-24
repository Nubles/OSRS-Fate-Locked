import { describe, expect, it } from 'vitest';
import { DropSource } from '../types';
import { QUEST_DATA } from './questData';
import * as questDataModule from './questData';
import chunkDoc from '../public/chunk-content.json';
import type { UnlockState } from '../types';
import { evaluateQuestEligibility, questRequirementOptionMet } from '../utils/journalStatus';

describe('audited current quest requirements', () => {
  it("puts A Ruff Situation's Outlaw Camp fight in 48,54, not the Grand Exchange chunk", () => {
    // OSRS Wiki 'Outlaw Camp' (rev 15394973): map x=3123 y=3472 r=6, all inside chunk 48,54.
    expect(QUEST_DATA['A Ruff Situation'].locations?.find(location => location.id === 'outlaw-camp'))
      .toMatchObject({ standardAreas: ['Edgeville'], chunkOptions: [{ cx: 48, cy: 54 }] });
    const chunks = chunkDoc.chunks as Record<string, { q?: Record<string, string> }>;
    expect(chunks['12342'].q?.['A Ruff Situation']).toBe('step');
    expect(chunks['12598'].q?.['A Ruff Situation']).toBeUndefined();
  });

  it("pins Witch's Potion to Rimmington without enforcing all Asgarnia", () => {
    expect(QUEST_DATA["Witch's Potion"]).toMatchObject({
      kind: 'quest',
      accessPolicy: 'locations',
      regions: ['Asgarnia'],
    });
    expect(QUEST_DATA["Witch's Potion"].locations?.map(location => location.id))
      .toEqual(['rimmington']);
  });

  it("pins Doric's hut to Falador's northern gate chunk, not Goblin Village", () => {
    expect(QUEST_DATA["Doric's Quest"].locations).toEqual([
      expect.objectContaining({
        id: 'dorics-hut',
        standardAreas: ['Falador'],
        chunkOptions: [{ cx: 46, cy: 53 }],
      }),
    ]);
  });

  it("pins Murder Mystery to Sinclair Mansion and Seers' Village", () => {
    expect(QUEST_DATA['Murder Mystery']).toMatchObject({
      kind: 'quest',
      accessPolicy: 'locations',
      regions: ['Kandarin'],
    });
    expect(QUEST_DATA['Murder Mystery'].locations?.map(location => location.id))
      .toEqual(['sinclair-mansion', 'seers-village']);
  });
  it('uses the real Porcine route', () => {
    const q = QUEST_DATA['A Porcine of Interest'];
    expect(q.regions).not.toContain('Port Sarim');
    expect(q.locations?.map(x => x.id)).toEqual([
      'draynor-village', 'south-falador-farm', 'sourhog-cave', 'spria',
    ]);
    expect(q.locations?.[1].chunkOptions).toEqual([{ cx: 47, cy: 51 }]);
  });

  it("lists The Fremennik Exiles' Mining 60, as the wiki does", () => {
    expect(QUEST_DATA['The Fremennik Exiles'].skills).toMatchObject({ Mining: 60 });
  });

  it('words the Biohazard priest gown and the Brain Robbery workshop as the wiki has them', () => {
    expect(QUEST_DATA['Biohazard'].equipmentRequirements).toContainEqual(
      { slot: 'Legs', tier: 1, reason: 'Wear the priest gown to see Guidor in Varrock' });
    expect(QUEST_DATA['The Great Brain Robbery'].manualRequirements)
      .toEqual(['Access to a player-owned house workshop and crafting table']);
  });

  it('pins Fallen From Grace to canonical Wyrmscraig access points', () => {
    expect(QUEST_DATA['Fallen From Grace']).toMatchObject({
      kind: 'quest',
      accessPolicy: 'locations',
      regions: ['The Open Seas'],
      skills: { Sailing: 62, Crafting: 60, Runecraft: 47, Mining: 53 },
      prereqs: ['Pandemonium'],
      points: 2,
      difficulty: DropSource.QUEST_EXPERIENCED,
    });
    expect(QUEST_DATA['Fallen From Grace'].locations).toEqual([
      { id: 'auchrie', label: 'Auchrie', standardAreas: ['Wyrmscraig'], chunkOptions: [{ cx: 40, cy: 35 }] },
      { id: 'wyrmscraig-goat-pasture', label: 'Wyrmscraig Goat Pasture', standardAreas: ['Wyrmscraig'], chunkOptions: [{ cx: 40, cy: 34 }] },
      { id: 'ardeaglais', label: 'Ardeaglais', standardAreas: ['Wyrmscraig'], chunkOptions: [{ cx: 39, cy: 34 }] },
    ]);
  });
});

describe('18 November 2026 quests (OSRS Wiki, 22 Nov revisions)', () => {
  it('lists A New Leaf with its quest points, difficulty and requirements', () => {
    expect(QUEST_DATA['A New Leaf']).toMatchObject({
      kind: 'quest', points: 2, difficulty: DropSource.QUEST_INTERMEDIATE,
      skills: { Farming: 45, Cooking: 35, Herblore: 32 }, prereqs: ['Priest in Peril'],
      manualRequirements: ['Completed at least one farming contract'],
      oneOf: [{ guilds: ['Farming Guild'], regions: ['Farming Guild'] }],
    });
    expect(QUEST_DATA['A New Leaf'].series).toBeUndefined();
    expect(QUEST_DATA['A New Leaf'].locations?.[0]).toMatchObject({ id: 'hosidius-cabbage-field', chunkOptions: [{ cx: 27, cy: 55 }] });
  });

  it('lists Rag and Bone Man III as the third of its series, started in Silvarea', () => {
    expect(QUEST_DATA['Rag and Bone Man III']).toMatchObject({
      kind: 'quest', points: 3, difficulty: DropSource.QUEST_EXPERIENCED, series: 'Rag and Bone Man',
      skills: { Slayer: 58 },
      prereqs: ['Rag and Bone Man II', 'Dragon Slayer I', 'The Great Brain Robbery', 'Defender of Varrock', 'Tower of Life', "A Soul's Bane"],
      locations: [expect.objectContaining({ standardAreas: ['Silvarea'], chunkOptions: [{ cx: 52, cy: 54 }] })],
    });
    expect(QUEST_DATA['Rag and Bone Man III'].equipmentRequirements?.map(requirement => requirement.slot)).toEqual(['Head', 'Weapon']);
  });

  it('adds up to the Wiki total of 354 quest points', () => {
    expect(Object.values(QUEST_DATA).reduce((total, quest) => total + quest.points, 0)).toBe(354);
  });
});

describe('quest series', () => {
  it('tags all three Twisted Tales quests, as the Wiki infoboxes do', () => {
    expect(Object.values(QUEST_DATA)
      .filter(quest => quest.series === 'Twisted Tales')
      .map(quest => quest.id)
      .sort())
      .toEqual(['Getting Ahead', 'The Garden of Death', "The Writing's on the Wall"]);
  });

  it('spells the Fairytale series as the Wiki does', () => {
    expect(Object.values(QUEST_DATA)
      .filter(quest => quest.series === 'Fairytale')
      .map(quest => quest.id)
      .sort())
      .toEqual(['Fairytale I - Growing Pains', 'Fairytale II - Cure a Queen']);
    expect(Object.values(QUEST_DATA).some(quest => quest.series === 'Fairy Tale')).toBe(false);
  });

  it('gives no series to the related story quests the Wiki lists as series = None', () => {
    // Wiki infoboxes (Nov 2026): Cook's Assistant, Waterfall Quest, Priest in Peril and
    // Nature Spirit are standalone quests, only named as lead-ins on Quests/Series.
    for (const id of ["Cook's Assistant", 'Waterfall Quest', 'Priest in Peril', 'Nature Spirit']) {
      expect(QUEST_DATA[id].series, id).toBeUndefined();
    }
  });
});

describe('quest cape eligibility', () => {
  it('exports only quest-point-cape quests and excludes optional miniquests', () => {
    const questCapeIds = (questDataModule as any).QUEST_CAPE_QUEST_IDS as string[] | undefined;

    expect(questCapeIds).toBeDefined();
    expect(questCapeIds).toContain("Cook's Assistant");
    expect(questCapeIds).toContain('The Ides of Milk');
    expect(questCapeIds).not.toContain('Barbarian Training');
    expect(questCapeIds).not.toContain("Alfred Grimhand's Barcrawl");
    expect(questCapeIds).not.toContain('Mage Arena II');
    expect(questCapeIds?.every(id => QUEST_DATA[id].points > 0)).toBe(true);
  });
});

describe('quest item gates checked on the Wiki (23 Nov 2026)', () => {
  const unlocks = (patch: Partial<UnlockState> = {}): UnlockState => ({
    equipment: {}, skills: {}, levels: {}, regions: [], chunks: [], mobility: [],
    arcana: [], housing: [], merchants: [], minigames: [], bosses: [], storage: [],
    guilds: [], farming: [], slayerUnlocks: [], quests: [], diaries: [], cas: [],
    completedTasks: [], collectionLog: {}, ...patch,
  });

  it("gates Enakhra's Lament's sandstone and granite on Mining 45", () => {
    // Wiki Enakhra's Lament (rev 15411975): ironman field "Mining 45 to mine granite";
    // sandstone needs Mining 35. Neither stone has a shop or monster source.
    expect(QUEST_DATA["Enakhra's Lament"].skills).toEqual({ Crafting: 50, Magic: 39, Prayer: 43, Mining: 45 });
  });

  it("gates Enakhra's Lament's normal, oak, willow and maple logs on a route for each", () => {
    // Wiki Enakhra's Lament (rev 15411975): maple from Woodcutting 45, Managing Miscellania or the
    // Wintertodt reward cart; willow needs Woodcutting 30, which also covers oak and normal logs.
    expect(QUEST_DATA["Enakhra's Lament"].oneOf).toEqual([
      { skills: { Woodcutting: 45 } },
      { skills: { Woodcutting: 30 }, regions: ['Miscellania & Etceteria'], quests: ['Throne of Miscellania'] },
      { skills: { Woodcutting: 30, Firemaking: 50 }, regions: ['Wintertodt Camp'] },
    ]);
  });

  it('gates The Fremennik Isles on the Woodcutting and Crafting it makes you use', () => {
    // Wiki The Fremennik Isles (rev 15413385): ironman field Woodcutting 56 (split logs, Neitiznot
    // shield) and Crafting 46 (yak-hide armour); no shop or monster gives any of them.
    expect(QUEST_DATA['The Fremennik Isles'].skills).toEqual({ Construction: 20, Woodcutting: 56, Crafting: 46 });
  });

  it.each(['Observatory Quest', 'Horror from the Deep', 'Desert Treasure I'])(
    '%s asks for Crafting 1 to make its molten glass, as Sheep Shearer does for spinning', id => {
      // Wiki Molten glass (rev 15288555): "cannot be bought in any shop"; made at Crafting 1.
      expect(QUEST_DATA[id].preparationRequirements).toEqual([{
        skill: 'Crafting', level: 1, action: 'make molten glass',
        alternative: 'molten glass from the Thermonuclear smoke devil, the Phantom Muspah or the Monumental chest',
      }]);
    });

  it('does not call Observatory Quest ready while Crafting is locked', () => {
    const quest = QUEST_DATA['Observatory Quest'];
    const regions = [...quest.regions, ...(quest.locations ?? []).flatMap(location => location.standardAreas)];
    const locked = evaluateQuestEligibility(quest, unlocks({ regions }), 'vanilla');
    expect(locked.eligible).toBe(false);
    expect(locked.manualChecks).toContainEqual(expect.stringContaining('Crafting (level 1) to make molten glass'));
    const open = evaluateQuestEligibility(quest, unlocks({ regions, skills: { Crafting: 1 }, levels: { Crafting: 1 } }), 'vanilla');
    expect(open).toMatchObject({ eligible: true, manualChecks: [] });
  });
});

describe('quest item routes checked on the Wiki (23 Nov 2026, part 2)', () => {
  const unlocks = (patch: Partial<UnlockState> = {}): UnlockState => ({
    equipment: {}, skills: {}, levels: {}, regions: [], chunks: [], mobility: [],
    arcana: [], housing: [], merchants: [], minigames: [], bosses: [], storage: [],
    guilds: [], farming: [], slayerUnlocks: [], quests: [], diaries: [], cas: [],
    completedTasks: [], collectionLog: {}, ...patch,
  });
  const at = (levels: Record<string, number>) => ({
    skills: Object.fromEntries(Object.entries(levels).map(([skill, level]) => [skill, Math.ceil(level / 10)])),
    levels,
  });
  const routes = (id: string, state: UnlockState) =>
    (QUEST_DATA[id].oneOf ?? []).filter(option => questRequirementOptionMet(option, state, 'vanilla'));

  it('gates the blessed holy symbol for Animal Magnetism on Prayer 31', () => {
    // Wiki Animal Magnetism (rev 15395095) ironman field: "Holy symbol (Prayer 31, not boostable)";
    // Wiki Holy symbol (rev 15295070): Brother Jered is upstairs in the monastery (Prayer 31 to enter),
    // a god book needs Prayer 50, and Davon's Amulet Store stocks none.
    expect(QUEST_DATA['Animal Magnetism'].skills).toEqual({ Slayer: 18, Crafting: 19, Ranged: 30, Woodcutting: 35, Prayer: 31 });
  });

  it('lets Animal Magnetism buy its mithril axe only from Lunami in Auburnvale', () => {
    // Wiki Lunami's Axe Shop (rev 15211381): "the only way to buy a mithril or adamant axe without the
    // 60 Woodcutting requirement to enter the Woodcutting Guild".
    const axeShopRoutes = (QUEST_DATA['Animal Magnetism'].oneOf ?? []).filter(option => option.merchants?.includes('Axe Shops'));
    expect(axeShopRoutes).toHaveLength(4);
    expect(axeShopRoutes.every(option => option.regions?.includes('Auburnvale'))).toBe(true);
  });

  it('gives Tears of Guthix a route to the bullseye lantern for its sapphire lantern', () => {
    // Wiki Tears of Guthix (rev 15292296) ironman field lists Miltog, Smithing 49, Tarn's Lair
    // skeletons, cave goblins (Thieving 36), wall beasts (Slayer 35) and the Darkmeyer spawn.
    const quest = QUEST_DATA['Tears of Guthix'];
    expect(quest.oneOf).toHaveLength(6);
    expect(routes('Tears of Guthix', unlocks())).toEqual([]);
    expect(routes('Tears of Guthix', unlocks(at({ Smithing: 49 })))).toHaveLength(1);
    expect(routes('Tears of Guthix', unlocks(at({ Slayer: 35 })))).toHaveLength(1);
    expect(routes('Tears of Guthix', unlocks({ merchants: ['Candle Shops'], quests: ['Death to the Dorgeshuun'] }))).toHaveLength(1);
  });

  it("gives Icthlarin's Little Helper and Sleeping Giants a route to their logs", () => {
    // Wiki Icthlarin's Little Helper (rev 15401465): willow log from Woodcutting 30, Vampyre Juvinates
    // (In Aid of the Myreque) or swamp crabs (Priest in Peril). Wiki Sleeping Giants (rev 15241064):
    // 3 oak logs from Woodcutting 15, small salvage at Sailing 15, or Brutus after The Ides of Milk.
    expect(QUEST_DATA["Icthlarin's Little Helper"].oneOf).toEqual([
      { skills: { Woodcutting: 30 } }, { quests: ['In Aid of the Myreque'] }, { quests: ['Priest in Peril'] },
    ]);
    expect(QUEST_DATA['Sleeping Giants'].oneOf).toEqual([
      { skills: { Woodcutting: 15 } }, { skills: { Sailing: 15 }, quests: ['Pandemonium'] }, { quests: ['The Ides of Milk'] },
    ]);
    expect(routes("Icthlarin's Little Helper", unlocks(at({ Woodcutting: 29 })))).toEqual([]);
    expect(routes('Sleeping Giants', unlocks(at({ Woodcutting: 14 })))).toEqual([]);
  });

  it('asks The Giant Dwarf for a redberry pie route, and Prying Times for Cam Torum with Food Shops', () => {
    // Wiki The Giant Dwarf (rev 15412711) items: Redberry pie (earlier quests' pies do not count).
    // Wiki Redberry pie: Cooking 10, or the Pie Shop (Cooks' Guild, Cooking 32) or Yarnio (Cam Torum).
    const gems = { merchants: ['Gem Shops', 'Ore Merchants'] };
    expect(routes('The Giant Dwarf', unlocks(gems))).toEqual([]);
    expect(routes('The Giant Dwarf', unlocks({ merchants: [...gems.merchants, 'Food Shops'] }))).toEqual([]);
    expect(routes('The Giant Dwarf', unlocks({ merchants: [...gems.merchants, 'Food Shops'], regions: ['Cam Torum'] }))).toHaveLength(1);
    expect(routes('The Giant Dwarf', unlocks({ ...gems, ...at({ Cooking: 10 }) }))).toHaveLength(1);
    expect(QUEST_DATA['Prying Times'].oneOf).toEqual([
      { skills: { Cooking: 10 } }, { merchants: ['Food Shops'], regions: ['Cam Torum'] },
    ]);
  });

  it("does not take a guild route the player cannot enter (Cooks' Guild Cooking 32, Warriors' Guild door)", () => {
    // Wiki Cooks' Guild (rev 15394637): Cooking 32. Wiki Warriors' Guild (rev 15366588): combined Attack
    // and Strength of 130, or 99 in either.
    const plague = unlocks({ guilds: ["Cooks' Guild"], regions: ['Rimmington'], ...at({ Farming: 99, Cooking: 31 }) });
    expect(routes('Plague City', plague)).toEqual([]);
    expect(routes('Plague City', { ...plague, ...at({ Farming: 99, Cooking: 32 }) })).toHaveLength(2);
    const dave = unlocks({ guilds: ["Warriors' Guild"], merchants: ['Food Shops'], ...at({ Attack: 60, Strength: 60 }) });
    expect(routes('RFD: Evil Dave', dave)).toEqual([]);
    expect(routes('RFD: Evil Dave', { ...dave, ...at({ Attack: 70, Strength: 60 }) })).toHaveLength(1);
    expect(routes('RFD: Evil Dave', { ...dave, ...at({ Strength: 99 }) })).toHaveLength(1);
  });

  it('keeps Nature Spirit locked behind Crafting 18 when Weapon Shops is all the run has', () => {
    // Wiki Silver sickle (rev 15322375): sold only by Ivan's, Efaritay's and Old Man Ral's Supplies,
    // which open after Sins of the Father or The Blood Moon Rises; both need Nature Spirit.
    expect(QUEST_DATA['Nature Spirit'].oneOf).toEqual([{ skills: { Crafting: 18 } }]);
    expect(routes('Nature Spirit', unlocks({ merchants: ['Weapon Shops'] }))).toEqual([]);
  });

  it('asks Dragon Slayer I for an inn or the Lighthouse store as well as Durrik\'s Goods', () => {
    // Wiki storeline bucket for Wizard's mind bomb (23 Nov; page rev 15404365): sold by four inns and
    // The Lighthouse Store (rev 15318804, after Horror from the Deep). Durrik's Goods sells silk but no mind bomb.
    const deepfin = unlocks({
      ...at({ Smithing: 34, Sailing: 67 }),
      regions: ['Varrock', 'Edgeville', 'Draynor Village', 'Lumbridge', 'Rimmington', 'Port Sarim', 'Crandor', 'Dwarven Mine', 'Deepfin Point'],
      quests: ['Pandemonium'],
      merchants: ['General Stores'],
    });
    expect(routes('Dragon Slayer I', deepfin)).toEqual([]);
    expect(routes('Dragon Slayer I', { ...deepfin, merchants: ['General Stores', 'Bars & Inns'] })).toHaveLength(1);
    expect(routes('Dragon Slayer I', {
      ...deepfin,
      regions: [...deepfin.regions, 'Lighthouse'],
      quests: ['Pandemonium', 'Horror from the Deep'],
    })).toHaveLength(1);
  });

  it.each<[string, string, Partial<UnlockState>?]>([
    // Durrik's Goods (rev 15372124) in the Deepfin Mine (Sailing 67) is the only General Store with silk or spice.
    ['Dragon Slayer I', 'General Stores'], ['Ghosts Ahoy', 'General Stores'], ['Enlightened Journey', 'General Stores'],
    // Every Desert Treasure I route also needs its magic logs, so the case brings Woodcutting 75.
    ['Cold War', 'General Stores'], ['Desert Treasure I', 'General Stores', at({ Woodcutting: 75 })],
    // Frankie's Fishing Emporium (Port Piscarilius) is the only fishmonger with raw shark.
    ['The Fremennik Trials', 'Fishing Shops'],
    // Razmire Builders Merchants (Mort'ton, after Shades of Mort'ton) is the only limestone seller.
    ['Regicide', 'Real Estate Agents'],
    // The Lighthouse Store (after Horror from the Deep) is the only General Store with vodka.
    ["Eadgar's Ruse", 'General Stores'], ['Bone Voyage', 'General Stores'],
    // Stew in a Food Shop: only Prifddinas Foodstuffs and the Warriors' Guild food shop.
    ['The Queen of Thieves', 'Food Shops'],
    // No shop sells cooked shrimps.
    ['Family Crest', 'Food Shops'],
    // ~ Uglug's stuffsies ~ (Jiggig, after Zogre Flesh Eaters) is the only bow string seller.
    ['Devious Minds', 'Archery Shops'],
  ])('%s does not count %s alone as a route for its item', (id, merchant, extra = {}) => {
    const quest = QUEST_DATA[id];
    const extraMerchants = [...new Set((quest.oneOf ?? []).flatMap(option => option.merchants ?? []))];
    // Every merchant the quest's routes name, and nothing else: no region, quest or guild, and no level
    // beyond what the case adds.
    const state = unlocks({ ...extra, merchants: extraMerchants });
    const met = routes(id, state).filter(option => option.merchants?.includes(merchant));
    expect(met).toEqual([]);
  });
});

describe('quest places checked on the Wiki (24 Nov 2026)', () => {
  const unlocks = (patch: Partial<UnlockState> = {}): UnlockState => ({
    equipment: {}, skills: { Slayer: 40 }, levels: { Slayer: 40 }, regions: [], chunks: [], mobility: [],
    arcana: [], housing: [], merchants: [], minigames: [], bosses: [], storage: [],
    guilds: [], farming: [], slayerUnlocks: [], quests: [], diaries: [], cas: [],
    completedTasks: [], collectionLog: {}, ...patch,
  });

  it("asks Rag and Bone Man II for the only areas that hold some of its bones", () => {
    // Wiki Rag and Bone Man II (rev 15413780) ==List== and the monster pages' LocLines:
    // Mogre only at Mudskipper Point (46,48); Undead cow only at Alice's farm (56,55, Port
    // Phasmatys); Ghoul only in 53,54 (Paterdomus). Bats also stand at the Slayer Tower entrance
    // and in the Haunted Woods, so those two stay.
    expect(QUEST_DATA['Rag and Bone Man II'].regions).toEqual([
      'Silvarea', 'Draynor Village', 'Taverley', 'Tree Gnome Stronghold', 'Feldip Hills', 'Nardah', 'Rellekka',
      'Canifis', 'Haunted Woods', "Fenkenstrain's Castle", 'Slayer Tower',
      'Mudskipper Point', 'Port Phasmatys', 'Paterdomus',
    ]);
  });

  it("names Rag and Bone Man II's either-or bone areas as checks the player confirms", () => {
    // Vulture: north of Sophanem (51,44), the Agility Pyramid (52,44) or Menaphos (50,44).
    // Troll: Death Plateau, Troll Stronghold and Trollheim (Burthorpe), the Keldagrim entrance
    // (43,58, Mountain Camp), south of Mount Quidamortem, Wyrmscraig Cavern. Basilisk: the
    // Fremennik Slayer Dungeon (2797,3616, Mountain Camp) or Jormungand's Prison. Dagannoth:
    // Lighthouse, Waterbirth Island, Catacombs of Kourend, Jormungand's Prison. Jogre: Tai Bwo
    // Wannai (45,47), Shilo Village (45,46), the Ardougne Zoo (40,51) or the God Wars Dungeon.
    const manual = QUEST_DATA['Rag and Bone Man II'].manualRequirements ?? [];
    expect(manual).toEqual(expect.arrayContaining([
      'Reached vultures north of Sophanem, the Agility Pyramid or Menaphos',
      'Reached trolls in Burthorpe (Death Plateau, Trollheim, Troll Stronghold), Mountain Camp (the Keldagrim entrance), Mount Quidamortem or Wyrmscraig',
      "Reached basilisks in the Fremennik Slayer Dungeon (Mountain Camp) or Jormungand's Prison after The Fremennik Exiles",
      "Reached dagannoths at the Lighthouse after Horror from the Deep, Waterbirth Island after starting The Fremennik Trials, the Catacombs of Kourend or Jormungand's Prison",
      'Reached jogres in Tai Bwo Wannai, Shilo Village, the God Wars Dungeon or the Ardougne Zoo in East Ardougne (with Telekinetic Grab)',
    ]));
    expect(manual.filter(line => line.includes('dagannoth'))).toHaveLength(1);
  });

  it('does not call Rag and Bone Man II available without Mudskipper Point and Port Phasmatys', () => {
    const quest = QUEST_DATA['Rag and Bone Man II'];
    const oldRegions = ['Silvarea', 'Draynor Village', 'Taverley', 'Tree Gnome Stronghold', 'Feldip Hills', 'Nardah',
      'Rellekka', 'Canifis', 'Haunted Woods', "Fenkenstrain's Castle", 'Slayer Tower', 'Port Sarim', 'Musa Point'];
    const state = { quests: ['Rag and Bone Man I', 'Skippy and the Mogres'], merchants: ['Wine Traders', 'Slayer Equipment'] };
    const locked = evaluateQuestEligibility(quest, unlocks({ ...state, regions: oldRegions }), 'vanilla');
    expect(locked.blockers.filter(blocker => blocker.kind === 'region').map(blocker => blocker.label))
      .toEqual(['Mudskipper Point', 'Port Phasmatys']);
    const open = evaluateQuestEligibility(quest,
      unlocks({ ...state, regions: [...oldRegions, 'Mudskipper Point', 'Port Phasmatys'] }), 'vanilla');
    expect(open.blockers.filter(blocker => blocker.kind === 'region')).toEqual([]);
    expect(open.manualChecks).toContainEqual('Reached vultures north of Sophanem, the Agility Pyramid or Menaphos');
  });
});
