import { describe, expect, it } from 'vitest';
import { ALL_DIARY_TASKS, type DiaryTask } from './diaryTasks';
import { ACTIVITY_ACCESS_AREAS } from './activityAccess';

/**
 * Players reported wrong Achievement Diary data, so every task was checked
 * against the game: the OSRS Wiki's diary pages and the app's own map. The
 * owner approved the fixes on 2 October 2026. Each block below pins a fix;
 * the checks at the end catch the same kind of mistake in any task.
 */

const task = (id: string): DiaryTask => {
  const found = ALL_DIARY_TASKS.find(row => row.id === id);
  if (!found) throw new Error(`No Diary task ${id}`);
  return found;
};

describe('Diary tasks are in the areas the game has them in', () => {
  it('puts the Jaldraocht Pyramid altar beside the pyramid, not in Sophanem', () => {
    // The pyramid's chunk (50,45) has no area of its own; Bandit Camp and Pollnivneach border it.
    expect(task('des_hard_7')).toMatchObject({ anyOfRegions: ['Bandit Camp', 'Pollnivneach'] });
    expect(task('des_hard_7').regions).toBeUndefined();
  });

  it('puts the Shadow Dungeon at Baxtorian Falls, where it is entered', () => {
    expect(task('kan_hard_7').regions).toEqual(['Baxtorian Falls']);
  });

  it('puts the Nature Altar in Shilo Village’s chunk, reached from Tai Bwo Wannai', () => {
    for (const id of ['kar_hard_4', 'kar_elite_1']) {
      expect(task(id), id).toMatchObject({ anyOfRegions: ['Shilo Village', 'Tai Bwo Wannai'] });
      expect(task(id).regions, id).toBeUndefined();
    }
  });

  it('puts the Thermonuclear Smoke Devil, and its roll, in the Feldip Hills', () => {
    // The Smoke Devil Dungeon is entered in Jiggig Swamp (37,47), not at Castle Wars.
    expect(task('west_elite_2')).toMatchObject({
      regions: ['Feldip Hills'], bosses: ['Thermonuclear Smoke Devil'],
    });
    expect(ACTIVITY_ACCESS_AREAS['Thermonuclear Smoke Devil']).toEqual(['Feldip Hills']);
  });

  it('needs the Kharazi Jungle to eat an oomlie wrap, as for its palm leaves', () => {
    expect(task('kar_hard_3')).toMatchObject({
      regions: ['Kharazi Jungle'],
      questProgress: [expect.objectContaining({ quest: "Legends' Quest" })],
    });
    expect(task('kar_hard_8')).toMatchObject({
      regions: ['Kharazi Jungle'],
      questProgress: [expect.objectContaining({ quest: "Legends' Quest" })],
    });
  });

  it('needs Falador to buy the Isafdar painting from Sir Renitee', () => {
    expect(task('west_hard_10').regions).toEqual(['Falador']);
  });
});

describe('Diary tasks name the area that owns their chunk on the map', () => {
  // The owner kept the map and moved the tasks: each place is in a chunk the
  // map gives to the area beside the one the task names.
  it.each([
    ['kan_med_8', 'Camelot', 'the Catherby farming patches are in 43,54'],
    ['kan_elite_2', 'Camelot', 'the Catherby herb patch is in 43,54'],
    ['des_hard_2', 'Agility Pyramid', 'the granite quarry is in 49,45'],
    ['kar_easy_4', 'Port Sarim', 'the dock east of Musa Point is in 46,49'],
    ['ard_hard_11', 'East Ardougne', 'the anvil near West Ardougne is in 39,52'],
    ['lum_hard_10', 'Mage Training Arena', 'the altar at Emir’s Arena is in 52,51'],
  ])('tags %s with %s, because %s', (id, area) => {
    expect(task(id).regions).toEqual([area]);
  });

  it('still needs Plague City progress to smith the shield in West Ardougne', () => {
    expect(task('ard_hard_11').questProgress).toEqual([expect.objectContaining({ quest: 'Plague City' })]);
  });
});
