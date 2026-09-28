import { BOSS_KILL_COUNTS, isRaidKey } from '../data/bossKillCounts';
import { DIARY_DATA } from '../data/diaryData';
import { QUEST_DATA } from '../data/questData';

/**
 * What RuneLite needs to name what it notices with the app's own ids
 * (Stage 4): each boss and raid by the names the game prints in its
 * kill-count line, every quest, and every achievement diary tier. The
 * same for every run, so it only changes when the app's lists do.
 */
export interface RulesDetection {
  bosses: { key: string; raid: boolean; killCounts: string[] }[];
  quests: { id: string; name: string }[];
  diaryTiers: string[];
}

const byText = (left: string, right: string) => left.localeCompare(right);

export function rulesDetection(): RulesDetection {
  return {
    bosses: Object.entries(BOSS_KILL_COUNTS)
      .map(([key, killCounts]) => ({ key, raid: isRaidKey(key), killCounts: [...killCounts] }))
      .sort((left, right) => byText(left.key, right.key)),
    quests: Object.values(QUEST_DATA)
      .map((quest) => ({ id: quest.id, name: quest.name }))
      .sort((left, right) => byText(left.id, right.id)),
    diaryTiers: Object.keys(DIARY_DATA).sort(byText),
  };
}
