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
  ] as const)('%s counts with %j: %s', (id, run) => {
    expect(doable(id, account(run as Partial<UnlockState>))).toBe(true);
  });

  it.each([
    ['fal_easy_9', ['47,53'], [], "the Dwarven Mine camp's way into the Motherlode Mine"],
    ['mor_med_1', ['57,53'], ['Priest in Peril'], 'swamp lizards north-west of Slepe'],
    ['kar_med_14', ['43,46'], [], 'the graahk pits'],
    ['kar_hard_7', ['44,48'], [], 'the Harpie bug side of the Strong Tree'],
    ['wild_hard_5', ['49,59'], [], 'two Lava Dragon Isle spawns'],
    ['lum_med_11', ['46,53'], [], "the crop circle by Doric's hut"],
  ] as const)('%s counts in Chunked with %j: %s', (id, chunks, quests) => {
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
    expect(task('des_hard_2').anyOfRegions).toEqual(['Agility Pyramid', 'Sophanem', 'The Great Conch']);
  });

  it('keeps the trip from Dorgesh-Kaan to Keldagrim to both ends', () => {
    // The owner's rule: a travel task needs both ends of the trip.
    expect(task('lum_hard_6')).toMatchObject({
      regions: ['Keldagrim'], oneOf: [{ regions: ['Lumbridge'] }, { label: 'Through the Kalphite Lair', regions: ['Kalphite Lair'] }],
    });
  });
});
