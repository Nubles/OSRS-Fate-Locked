import { describe, expect, it } from 'vitest';
import { ALL_DIARY_TASKS, type DiaryTask } from './diaryTasks';
import type { UnlockState } from '../types';
import { evaluateDiaryTaskEligibility } from '../utils/journalStatus';

/**
 * A player found that an Ankou in the Wilderness Slayer Cave didn't count for the Wilderness
 * Medium task, though the game counts it. On 4 October 2026 every Diary task's places were
 * checked against the OSRS Wiki for the same kind of mistake: a place the game accepts that the
 * tracker didn't, or the wrong place. The owner approved fixing every wiki-backed one. Places
 * the wiki is silent on stay out until confirmed. Each block pins one kind of fix.
 */

const task = (id: string): DiaryTask => {
  const found = ALL_DIARY_TASKS.find(row => row.id === id);
  if (!found) throw new Error(`No Diary task ${id}`);
  return found;
};

/** An account with nothing unlocked but what a check names, every skill at 99. */
const account = (overrides: Partial<UnlockState> = {}): UnlockState => ({
  equipment: { Head: 1, Body: 1, Legs: 1, Boots: 1, Weapon: 1 },
  skills: { Runecraft: 10, Hunter: 10, Agility: 10, Thieving: 10, Mining: 10 },
  levels: { Runecraft: 99, Hunter: 99, Agility: 99, Thieving: 99, Mining: 99 },
  regions: [], mobility: [], arcana: [], housing: [], merchants: [], minigames: [], bosses: [], storage: [],
  guilds: [], farming: [], slayerUnlocks: [], quests: [], diaries: [], cas: [], completedTasks: [], collectionLog: {},
  chunks: [],
  ...overrides,
} as UnlockState);

/** Whether the machine-checked requirements are met (hand checks such as worn items aside). */
const doable = (id: string, run: UnlockState, mode = 'vanilla') =>
  evaluateDiaryTaskEligibility(task(id), run, mode).machineEligible;

describe('Rune altars reached through the Abyss', () => {
  // The Diary page lists the Abyss as a way into each of these altars. The Mage of Zamorak, in
  // the Wilderness north of Edgeville (48,55), is the Abyss's only way in.
  const ALTARS: readonly (readonly [string, string, readonly string[]])[] = [
    ['lum_easy_4', 'Lumbridge', []],
    ['lum_elite_5', 'Lumbridge', []],
    ['var_easy_12', 'Varrock', []],
    ['var_elite_5', 'Varrock', []],
    ['lum_med_12', 'Al Kharid', []],
    ['fal_easy_7', 'Ice Mountain', []],
    ['fal_hard_1', 'Goblin Village', []],
    ['kar_hard_4', 'Shilo Village', []],
    ['kar_elite_1', 'Shilo Village', []],
    ["ard_hard_12", 'West Ardougne', ["Mourning's End Part II"]],
  ];

  it.each(ALTARS)('%s takes its ruins in %s, or the Abyss', (id, place, quests) => {
    const ways = (task(id).oneOf ?? []).map(option => [option.regions ?? [], option.quests ?? [],
      (option.locations ?? []).flatMap(group => group.chunkOptions.map(({ cx, cy }) => `${cx},${cy}`))]);
    expect(ways.some(([regions]) => regions.includes(place)), 'ruins').toBe(true);
    expect(ways.some(([, needs, chunks]) => needs.includes('Enter the Abyss') && chunks.includes('48,55')), 'Abyss').toBe(true);
    expect(task(id).regions ?? [], 'no area needed on every way').not.toContain(place);
    expect(doable(id, account({ regions: [place], quests: [...quests] })), 'ruins').toBe(true);
    // Misthalin is free in Vanilla, so only the other places show the Abyss alone is enough.
    if (place === 'Lumbridge' || place === 'Varrock') return;
    expect(doable(id, account({ regions: ['Edgeville'], quests: ['Enter the Abyss', ...quests] })), 'Abyss').toBe(true);
    // The Abyss needs its miniquest.
    expect(doable(id, account({ regions: ['Edgeville'], quests: [...quests] })), 'no miniquest').toBe(false);
    // In Chunked, the Mage of Zamorak's own chunk.
    expect(doable(id, account({ chunks: ['48,55'], quests: ['Enter the Abyss', ...quests] }), 'chunked'), 'chunked').toBe(true);
    expect(doable(id, account({ chunks: ['48,56'], quests: ['Enter the Abyss', ...quests] }), 'chunked'), 'chunk beside').toBe(false);
  });

  it("takes the nature runes at Shilo Village's ruins, not from Tai Bwo Wannai", () => {
    // The ruins are at (2868, 3018), chunk 44,47: a Shilo Village chunk, far from Tai Bwo Wannai's.
    for (const id of ['kar_hard_4', 'kar_elite_1']) {
      expect(doable(id, account({ regions: ['Tai Bwo Wannai'] })), id).toBe(false);
    }
  });

  it('keeps the Cosmic altar in Zanaris either way, as the map counts its interior there', () => {
    expect(task('lum_hard_3')).toMatchObject({ quests: ['Lost City'], regions: ['Zanaris'] });
  });
});

describe('Diary tasks the game counts in more than one place', () => {
  it.each([
    // [task, run, why]
    ['west_hard_7', { regions: ['Prifddinas'], quests: ['Song of the Elves'] }, 'adamantite in the Trahaearn mine'],
    ['west_elite_7', { regions: ['Prifddinas'], quests: ['Song of the Elves'] }, 'the elves of Prifddinas'],
    ['west_hard_13', { regions: ['Gnome Village'] }, 'gnomes in Tree Gnome Village'],
    ['west_hard_13', { regions: ['Khazard Battlefield'] }, 'gnomes on the Battlefield of Khazard'],
    ['kar_hard_10', { regions: ['Tai Bwo Wannai'], quests: ['Jungle Potion'], minigames: ['Tai Bwo Wannai Cleanup'], skills: { Woodcutting: 10 }, levels: { Woodcutting: 99 } }, "Banisoch's entrance"],
    ['kar_med_14', { regions: ['Shilo Village'] }, 'the graahk pits in 43,46'],
    ['kan_med_2', { regions: ['Camelot'], quests: ['Druidic Ritual'], skills: { Herblore: 10 }, levels: { Herblore: 99 } }, 'Camelot, between Seers and Catherby'],
    ['kar_med_4', { regions: ['Shilo Village'], quests: ['Shilo Village'] }, "Vigroy's end of the cart"],
    ['kou_med_2', { regions: ['Molch'] }, 'lizardmen at Molch'],
    ['lum_elite_1', { regions: ['Kalphite Lair'], quests: ['Death to the Dorgeshuun'] }, 'Dorgesh-Kaan through the Kalphite Lair'],
    ['lum_hard_6', { regions: ['Kalphite Lair', 'Keldagrim'], quests: ['Another Slice of H.A.M.'] }, 'both ends of the train'],
    ['wild_hard_6', { regions: ["Scorpia's Cave"], bosses: ['Chaos Elemental'] }, 'its spawn west of the castle'],
    ['des_hard_2', { regions: ['Sophanem'] }, 'granite at the Necropolis mine'],
    ['des_easy_5', { regions: ['Sophanem'] }, 'vultures north of Sophanem'],
  ] as const)('%s counts with %j: %s', (id, run, _why) => {
    expect(doable(id, account(run as unknown as Partial<UnlockState>))).toBe(true);
  });

  it.each([
    ['fal_easy_9', ['47,53'], [], "the Dwarven Mine camp's way into the Motherlode Mine"],
    ['mor_med_1', ['57,53'], ['Priest in Peril'], 'swamp lizards north-west of Slepe'],
    ['kar_med_14', ['43,46'], [], 'the graahk pits'],
    ['kar_hard_7', ['44,48'], [], 'the Harpie bug side of the Strong Tree'],
    ['wild_hard_5', ['49,59'], [], 'two Lava Dragon Isle spawns'],
    ['lum_med_11', ['46,53'], [], "the crop circle by Doric's hut"],
  ] as const)('%s counts in Chunked with %j: %s', (id, chunks, quests, _why) => {
    const extra = {
      equipment: { Head: 1, Body: 1, Legs: 1, Boots: 1, Weapon: 1, Ammo: 3 },
      skills: { Hunter: 10, Agility: 10, Ranged: 10, Strength: 10, Mining: 10 },
      levels: { Hunter: 99, Agility: 99, Ranged: 99, Strength: 99, Mining: 99 },
      minigames: ['Impetuous Impulses'],
    };
    expect(doable(id, account({ ...extra, chunks: [...chunks], quests: [...quests] }), 'chunked')).toBe(true);
  });

  it('enters the Edgeville Dungeon from the Varrock Sewers, with 51 Agility', () => {
    // Edgeville and Varrock are both free in Vanilla, so Chunked shows it: Varrock Palace's chunk.
    for (const id of ['var_hard_10', 'var_med_9', 'wild_easy_4', 'wild_med_5']) {
      expect(doable(id, account({ chunks: ['50,54'], skills: { Agility: 10, Magic: 10 }, levels: { Agility: 51, Magic: 99 } }), 'chunked'), id)
        .toBe(true);
      expect(doable(id, account({ chunks: ['50,54'], skills: { Agility: 10, Magic: 10 }, levels: { Agility: 50, Magic: 99 } }), 'chunked'), id)
        .toBe(false);
    }
  });

  it('enters Puro-Puro through a crop circle without Zanaris', () => {
    const impling = task('lum_med_11');
    expect(impling.regions).toBeUndefined();
    expect(impling.oneOf).toHaveLength(4);
    // Crop circles in areas with travel rules (Harmony Island, Mos Le'Harmless, Miscellania) are left out.
    const circles = impling.oneOf!.flatMap(option => option.locations ?? []).flatMap(group => group.chunkOptions);
    expect(circles.some(({ cx, cy }) => cx === 59 && cy === 44)).toBe(false);
  });

  it('names the places with travel rules as areas', () => {
    expect(task('frem_easy_3').anyOfRegions).toEqual(['Rellekka', 'Waterbirth Island']);
    expect(task('kar_med_2').anyOfRegions).toEqual(['Musa Point', 'Crandor']);
    expect(task('des_hard_2').anyOfRegions).toEqual(['Bandit Camp', 'Sophanem', 'The Great Conch']);
  });

  it('keeps the trip from Dorgesh-Kaan to Keldagrim to both ends', () => {
    // The owner's rule: a travel task needs both ends of the trip.
    expect(task('lum_hard_6')).toMatchObject({
      regions: ['Keldagrim'], oneOf: [{ regions: ['Lumbridge'] }, { label: 'Through the Kalphite Lair', regions: ['Kalphite Lair'] }],
    });
  });
});

describe('Diary tasks that named the wrong place', () => {
  it('lands the Trollheim shortcut west of the Ruins, not at the God Wars Dungeon', () => {
    // The rocks at (2945, 3678) land in 46,57; the rocky handholds by the God Wars Dungeon are
    // another shortcut. Both ends of the trip are needed (the owner's rule). Since 7 October
    // 2026, 46,57 belongs to Forgotten Cemetery, so the landing is named by that area.
    expect(task('wild_hard_8')).toMatchObject({ regions: ['Burthorpe', 'Forgotten Cemetery'] });
    expect(task('wild_hard_8').locations).toBeUndefined();
  });

  it.each([
    ['des_med_2', ['52,47', '53,47', '54,47', '52,43'], 'desert lizards along the Elid and west of Ullek'],
    ['frem_easy_10', ['42,57', '40,56', '43,56', '41,56', '42,56'], 'the oaks around Rellekka'],
  ] as const)('%s takes exactly %j: %s', (id, chunks, _why) => {
    const groups = task(id).locations ?? [];
    expect(groups).toHaveLength(1);
    expect(groups[0].chunkOptions.map(({ cx, cy }) => `${cx},${cy}`)).toEqual(chunks);
    expect(task(id).regions).toBeUndefined();
    expect(task(id).anyOfRegions).toBeUndefined();
  });

  it('keeps the Fremennik super defence in or near Rellekka, not on the islands', () => {
    const chunks = (task('frem_hard_3').locations ?? [])[0].chunkOptions.map(({ cx, cy }) => `${cx},${cy}`);
    expect(chunks).toEqual(expect.arrayContaining(['42,57', '41,56', '42,56', '40,56', '43,56']));
    expect(task('frem_hard_3').anyOfRegions).toBeUndefined();
    expect(doable('frem_easy_10', account({ regions: ['Neitiznot'], skills: { Firemaking: 10, Woodcutting: 10 }, levels: { Firemaking: 99, Woodcutting: 99 } })))
      .toBe(false);
  });

  it.each([
    ['des_med_9', { regions: ['Agility Pyramid'], quests: ["Enakhra's Lament"], mobility: ['Camulet'] }, "the Camulet lands in the Desert Quarry (49,45)"],
    ['ard_hard_9', { regions: ['East Ardougne'], skills: { Smithing: 10 }, levels: { Smithing: 99 } }, "West Ardougne's anvil is in 39,52"],
    ['west_hard_1', { regions: ['Iorwerth Camp'], quests: ['Roving Elves'], equipment: { Weapon: 8 }, skills: { Ranged: 10 }, levels: { Ranged: 99 } }, 'elves at Iorwerth Camp'],
  ] as const)('%s counts with %j: %s', (id, run, _why) => {
    expect(doable(id, account(run as unknown as Partial<UnlockState>))).toBe(true);
  });

  it('no longer takes a place with nothing to do there', () => {
    expect(doable('des_med_9', account({ regions: ['Bandit Camp'], quests: ["Enakhra's Lament"], mobility: ['Camulet'] }))).toBe(false);
    expect(doable('west_hard_1', account({ regions: ['Isafdar'], quests: ['Roving Elves'], equipment: { Weapon: 8 }, skills: { Ranged: 10 }, levels: { Ranged: 99 } })))
      .toBe(false);
    expect(doable('des_med_2', account({ regions: ['Shantay Pass'], skills: { Slayer: 10 }, levels: { Slayer: 99 } }))).toBe(false);
  });

  it.each([
    ['des_easy_1', '53,48'], ['des_easy_2', '53,49'], ['des_med_4', '53,49'], ['des_med_10', '52,45'],
    ['des_hard_7', '50,45'], ['des_med_3', '53,48'], ['des_hard_8', '53,44'],
  ] as const)('%s also takes its own desert chunk, %s, which has no area', (id, chunk) => {
    const chunks = (task(id).oneOf ?? []).flatMap(option => option.locations ?? [])
      .flatMap(group => group.chunkOptions.map(({ cx, cy }) => `${cx},${cy}`));
    expect(chunks).toContain(chunk);
    // The area beside it, as the map files the chunk's tasks, still counts.
    expect((task(id).oneOf ?? []).some(option => option.regions?.length)).toBe(true);
  });

  it("starts the eagle to the desert at Eagles' Peak and lands by the Uzer Hunter area", () => {
    expect(task('des_med_6')).toMatchObject({
      regions: ["Eagles' Peak"],
      oneOf: [{ regions: ['Ruins of Uzer'] }, { locations: [{ chunkOptions: [{ cx: 53, cy: 49 }] }] }],
    });
  });
});

describe('Diary tasks that count anywhere in a province', () => {
  // One group of every chunk the task's areas hold, plus the province's chunks that belong to no
  // area, so a Chunked run on open sand, open Wilderness or the Karamja River counts. Areas with
  // travel rules stay as their own options.
  it.each([
    ['des_med_8', '53,49', { quests: ['Druidic Ritual'], skills: { Herblore: 10 }, levels: { Herblore: 99 } }],
    ['des_elite_2', '50,46', { quests: ['Desert Treasure I'], arcana: ['Ancient Magicks'], skills: { Magic: 10 }, levels: { Magic: 99 } }],
    ['des_easy_10', '52,47', {}],
    ['wild_easy_8', '49,58', { equipment: { Cape: 1 } }],
    ['kar_easy_8', '45,47', {}],
    ['frem_easy_10', '41,56', { skills: { Firemaking: 10, Woodcutting: 10 }, levels: { Firemaking: 99, Woodcutting: 99 } }],
  ] as const)('%s counts in Chunked on %s', (id, chunk, run) => {
    expect(doable(id, account({ ...(run as unknown as Partial<UnlockState>), chunks: [chunk] }), 'chunked')).toBe(true);
  });

  it("takes Giants' Plateau's cacti for the waterskin", () => {
    expect(doable('des_easy_10', account({ regions: ["Giants' Plateau"] }))).toBe(true);
  });

  it("counts a team cape in Edgeville's and Varrock's chunks past the ditch", () => {
    const chunks = (task('wild_easy_8').oneOf ?? []).flatMap(option => option.locations ?? [])
      .flatMap(group => group.chunkOptions.map(({ cx, cy }) => `${cx},${cy}`));
    expect(chunks).toEqual(expect.arrayContaining(['48,55', '50,55', '51,55', '46,55']));
    expect(chunks).not.toContain('46,58');
    expect(task('wild_easy_8').oneOf?.[0]).toEqual({ regions: ['Forgotten Cemetery'] });
  });
});

describe('Diary trips that need the end they asked too little of', () => {
  // The owner's rule: a travel task needs both ends of the trip.
  it.each([
    ['lum_hard_4', ['Lumbridge', 'Edgeville'], 'the Waka canoe lands in Edgeville'],
    ['mor_hard_5', ['Burgh de Rott', 'Paterdomus'], 'a temple trek runs from Paterdomus to Burgh de Rott'],
    ['frem_med_2', ['Rellekka', "Eagles' Peak"], "the eagle leaves from the Eagles' Peak Dungeon"],
  ] as const)('%s needs %j: %s', (id, areas, _why) => {
    expect(task(id).regions).toEqual(areas);
  });

  it("needs Eagles' Peak for the eagle to the Snowy Hunter Area", () => {
    const run = { quests: ["Eagles' Peak"], mobility: ['Eagle Transport'] };
    expect(doable('frem_med_2', account({ ...run, regions: ['Rellekka'] }))).toBe(false);
    expect(doable('frem_med_2', account({ ...run, regions: ['Rellekka', "Eagles' Peak"] }))).toBe(true);
  });
});

describe('Diary tasks whose material comes from more than one place', () => {
  // The owner, 4 October 2026: where the action can be done anywhere, accept every place an
  // ironman can get the material, with the wiki's word for each.
  it.each([
    ['43,48', 'jungle spiders by Tai Bwo Wannai'],
    ['45,46', 'jungle spiders in the Kharazi Jungle edge of Shilo Village'],
    ['45,47', 'jungle spiders by the Karamja River'],
    ['41,48', 'the "Yanille Chain" jungle spiders, east of Yanille'],
    ['43,50', 'jungle spiders by Brimhaven'],
  ] as const)('cooks a spider on a stick from a carcass found in %s: %s', (chunk, _why) => {
    const run = account({ chunks: [chunk], skills: { Cooking: 10 }, levels: { Cooking: 99 } });
    expect(doable('kar_med_6', run, 'chunked')).toBe(true);
  });

  it('takes a carcass from Sarachnis too, and no longer needs Tai Bwo Wannai', () => {
    const cook = { skills: { Cooking: 10 }, levels: { Cooking: 99 } };
    expect(doable('kar_med_6', account({ ...cook, regions: ['Hosidius'], bosses: ['Sarachnis'] }))).toBe(true);
    expect(doable('kar_med_6', account({ ...cook, regions: ['Hosidius'] }))).toBe(false);
    expect(doable('kar_med_6', account({ ...cook, regions: ['Yanille'] }))).toBe(true);
  });

  it("collects red spiders' eggs in the Wilderness from every place they spawn", () => {
    // In the Edgeville Dungeon's Wilderness part, through its pipe from the Varrock Sewers, or
    // brought into the Wilderness and dropped and picked up five times (Wilderness Diary note).
    const wild = '49,58';
    expect(doable('wilderness_easy_9', account({ chunks: ['48,54'] }), 'chunked'), 'Edgeville').toBe(true);
    expect(doable('wilderness_easy_9', account({ chunks: ['50,54'] }), 'chunked'), 'pipe').toBe(true);
    expect(doable('wilderness_easy_9', account({ chunks: ['50,54'], levels: { Agility: 50 } }), 'chunked'), 'no Agility, no Wilderness').toBe(false);
    expect(doable('wilderness_easy_9', account({ chunks: ['50,54', wild], levels: { Agility: 50 } }), 'chunked'), 'sewer eggs').toBe(true);
    expect(doable('wilderness_easy_9', account({ chunks: ['36,51', wild] }), 'chunked'), 'Arandar eggs').toBe(true);
    expect(doable('wilderness_easy_9', account({ chunks: ['26,55', wild] }), 'chunked'), 'Forthos eggs').toBe(true);
    expect(doable('wilderness_easy_9', account({ chunks: ['36,51'] }), 'chunked'), 'eggs but no Wilderness').toBe(false);
  });
});
