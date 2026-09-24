import { describe, expect, it } from 'vitest';
import { readQuestHelperSource } from '../scripts/quest-helper-source.mjs';
import { QUEST_DATA } from './questData';
import { DropSource } from '../types';

/**
 * Quest difficulty sets a quest's key odds, so it must match OSRS's official
 * rating. Quest Helper lists that rating for every quest it covers; this pins
 * the app to the reviewed, hash-checked snapshot in data/sources.
 */

const OFFICIAL: Record<string, DropSource | 'MINIQUEST'> = {
  NOVICE: DropSource.QUEST_NOVICE,
  INTERMEDIATE: DropSource.QUEST_INTERMEDIATE,
  EXPERIENCED: DropSource.QUEST_EXPERIENCED,
  MASTER: DropSource.QUEST_MASTER,
  GRANDMASTER: DropSource.QUEST_GRANDMASTER,
  MINIQUEST: 'MINIQUEST',
};

/** App quests whose Quest Helper entry is not named after the quest. */
const QUEST_HELPER_NAME: Record<string, string> = {
  'Romeo & Juliet': 'ROMEO__JULIET',
  'Shield of Arrav': 'SHIELD_OF_ARRAV_PHOENIX_GANG',
  'Forgettable Tale of a Drunken Dwarf': 'FORGETTABLE_TALE',
  'Fairytale I - Growing Pains': 'FAIRYTALE_I__GROWING_PAINS',
  'Fairytale II - Cure a Queen': 'FAIRYTALE_II__CURE_A_QUEEN',
  'Desert Treasure II - The Fallen Empire': 'DESERT_TREASURE_II',
  'RFD: The Cook': 'RECIPE_FOR_DISASTER_START',
  'RFD: Dwarf': 'RECIPE_FOR_DISASTER_DWARF',
  'RFD: Goblins': 'RECIPE_FOR_DISASTER_WARTFACE_AND_BENTNOZE',
  'RFD: Pirate Pete': 'RECIPE_FOR_DISASTER_PIRATE_PETE',
  'RFD: Lumbridge Guide': 'RECIPE_FOR_DISASTER_LUMBRIDGE_GUIDE',
  'RFD: Evil Dave': 'RECIPE_FOR_DISASTER_EVIL_DAVE',
  'RFD: Skrach Uglogwee': 'RECIPE_FOR_DISASTER_SKRACH_UGLOGWEE',
  'RFD: Sir Amik Varze': 'RECIPE_FOR_DISASTER_SIR_AMIK_VARZE',
  'RFD: King Awowogei': 'RECIPE_FOR_DISASTER_MONKEY_AMBASSADOR',
  'RFD: Finale': 'RECIPE_FOR_DISASTER_FINALE',
};

/** Released after the pinned snapshot; review their ratings when it is refreshed. */
const NOT_IN_SNAPSHOT = ['A Ruff Situation', 'Crab Quest', 'Learning the Ropes'];

const enumName = (name: string): string => name
  .toUpperCase()
  .replace(/['’&.]/g, '')
  .replace(/[^A-Z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');

const officialDifficulties = async (): Promise<Map<string, string>> => {
  const { data } = await readQuestHelperSource();
  const questList = (data.files as { path: string; content: string }[])
    .find(file => file.path.endsWith('questinfo/QuestHelperQuest.java'));
  const ratings = new Map<string, string>();
  for (const line of questList!.content.split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\(new \w+\(\).*QuestDetails\.Difficulty\.(\w+)\)/.exec(line);
    if (!match) continue;
    ratings.set(match[1], match[2]);
    // Also index RuneLite's quest name, e.g. DESERT_TREASURE -> Quest.DESERT_TREASURE_I.
    const runeLiteName = /\bQuest\.([A-Z0-9_]+)/.exec(line)?.[1];
    if (runeLiteName && !ratings.has(runeLiteName)) ratings.set(runeLiteName, match[2]);
  }
  return ratings;
};

describe('quest difficulty', () => {
  it('matches the official OSRS rating for every quest Quest Helper lists', async () => {
    const ratings = await officialDifficulties();
    expect(ratings.size).toBeGreaterThan(200);

    const mismatched: string[] = [];
    const unlisted: string[] = [];
    for (const quest of Object.values(QUEST_DATA)) {
      const key = QUEST_HELPER_NAME[quest.id] ?? QUEST_HELPER_NAME[quest.name]
        ?? [enumName(quest.name), `THE_${enumName(quest.name)}`, enumName(quest.name).replace(/^THE_/, '')]
          .find(candidate => ratings.has(candidate));
      const rating = key === undefined ? undefined : ratings.get(key);
      if (rating === undefined) {
        unlisted.push(quest.id);
        continue;
      }
      const official = OFFICIAL[rating];
      const actual = quest.kind === 'miniquest' ? 'MINIQUEST' : quest.difficulty;
      // Miniquests have no official difficulty; only their kind is checked.
      if (official === 'MINIQUEST' || quest.kind === 'miniquest') {
        if (official !== actual) mismatched.push(`${quest.id}: ${actual} vs official ${rating}`);
      } else if (official !== quest.difficulty) {
        mismatched.push(`${quest.id}: ${quest.difficulty} vs official ${rating}`);
      }
    }

    expect(mismatched).toEqual([]);
    expect(unlisted.filter(id => QUEST_DATA[id].kind === 'quest').sort()).toEqual(NOT_IN_SNAPSHOT);
  });
});
