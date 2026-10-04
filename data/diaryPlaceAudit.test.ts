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
