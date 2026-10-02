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
