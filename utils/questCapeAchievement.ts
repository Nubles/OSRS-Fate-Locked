/**
 * Quest Cape's achievement id. It used to be `quests-<number of quests>`, so
 * every new quest gave it a new id: runs that had claimed it lost its boost
 * and title and were later paid for it again. The id is now fixed, and the
 * old roster-size ids (quests-193, quests-196, quests-198 and earlier) are
 * read as it. No other quest tier is above 150.
 */
export const QUEST_CAPE_ACHIEVEMENT_ID = 'quests-all';

const HIGHEST_QUEST_TIER = 150;

export const isRetiredQuestCapeId = (id: string): boolean => {
  const match = /^quests-(\d+)$/.exec(id);
  return match !== null && Number(match[1]) > HIGHEST_QUEST_TIER;
};

/** Adds the stable id to a claimed list that holds a retired one; the old ids stay for older versions. */
export const migrateQuestCapeAchievementIds = (claimed: readonly string[]): string[] =>
  claimed.some(isRetiredQuestCapeId) && !claimed.includes(QUEST_CAPE_ACHIEVEMENT_ID)
    ? [...claimed, QUEST_CAPE_ACHIEVEMENT_ID]
    : [...claimed];

/** A worn title under a retired id is worn under the stable one. */
export const migrateQuestCapeTitle = (title: string): string =>
  isRetiredQuestCapeId(title) ? QUEST_CAPE_ACHIEVEMENT_ID : title;
