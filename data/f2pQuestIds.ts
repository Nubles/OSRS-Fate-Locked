/**
 * The 24 free-to-play quests, in the reviewed order of
 * data/sources/f2p-quest-membership.json (data/f2pQuestMembership.ts checks
 * it). Kept on its own so the app's first download can tell members quests
 * apart without the full membership records.
 */
export const F2P_QUEST_IDS = [
  "Cook's Assistant",
  "Sheep Shearer",
  "The Restless Ghost",
  "Rune Mysteries",
  "Imp Catcher",
  "X Marks the Spot",
  "Romeo & Juliet",
  "Demon Slayer",
  "Ernest the Chicken",
  "Doric's Quest",
  "Goblin Diplomacy",
  "Witch's Potion",
  "The Knight's Sword",
  "Black Knights' Fortress",
  "Vampyre Slayer",
  "Prince Ali Rescue",
  "Pirate's Treasure",
  "Misthalin Mystery",
  "Below Ice Mountain",
  "The Corsair Curse",
  "Shield of Arrav",
  "Dragon Slayer I",
  "Learning the Ropes",
  "The Ides of Milk"
] as const;

const F2P_QUEST_ID_SET = new Set<string>(F2P_QUEST_IDS);

/** Whether a quest can be done on free-to-play worlds. */
export const isF2PQuest = (questId: string): boolean => F2P_QUEST_ID_SET.has(questId);
