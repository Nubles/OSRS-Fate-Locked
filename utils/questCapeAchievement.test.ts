// Quest Cape keeps one id while the quest roster grows, so a run that earned
// it keeps its boost and title and is never paid for it twice.
import { describe, expect, it } from 'vitest';
import { SKILLS_LIST } from '../constants';
import { QUEST_CAPE_QUEST_IDS } from '../data/questData';
import { ACHIEVEMENTS, achievementPayouts, evaluateAchievements } from './achievements';
import { achievementBoostFor } from './achievementBoosts';
import { settleAchievements } from './achievementRewards';
import { migrateQuestCapeAchievementIds, QUEST_CAPE_ACHIEVEMENT_ID } from './questCapeAchievement';
import type { GameState, UnlockState } from '../types';

const unlocks = (quests: readonly string[]): UnlockState => ({
  equipment: {},
  skills: Object.fromEntries(SKILLS_LIST.map((s) => [s, 0])),
  levels: Object.fromEntries(SKILLS_LIST.map((s) => [s, 1])),
  regions: [], mobility: [], arcana: [], housing: [], merchants: [], minigames: [],
  bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [],
  quests: [...quests], diaries: [], cas: [], completedTasks: [], collectionLog: {},
} as unknown as UnlockState);

const settle = (claimed: string[], quests: readonly string[]) => {
  const run = { unlocks: unlocks(quests), gameModeId: 'vanilla', claimed };
  const state = {
    gameModeId: 'vanilla', runId: 'quest-cape-test', fatePoints: 0, chaosKeys: 0, freeRituals: [],
    achievementsClaimed: claimed,
  } as unknown as GameState;
  let n = 0;
  return settleAchievements(state, achievementPayouts(run), 0, () => `id${n++}`, 9999);
};

describe('Quest Cape achievement id', () => {
  it('does not move when quests are added', () => {
    const cape = ACHIEVEMENTS.find((a) => a.title === 'Quest Cape')!;
    expect(cape.id).toBe(QUEST_CAPE_ACHIEVEMENT_ID);
    expect(QUEST_CAPE_ACHIEVEMENT_ID).toBe('quests-all');
    expect(ACHIEVEMENTS.filter((a) => a.id === `quests-${QUEST_CAPE_QUEST_IDS.length}`)).toEqual([]);
  });

  it('maps the retired roster-size ids of an old save to the stable id, keeping the old ones', () => {
    for (const old of ['quests-193', 'quests-196', 'quests-198', 'quests-212']) {
      expect(migrateQuestCapeAchievementIds(['quests-1', 'quests-150', old])).toEqual(['quests-1', 'quests-150', old, 'quests-all']);
    }
    expect(migrateQuestCapeAchievementIds(['quests-196', 'quests-198'])).toEqual(['quests-196', 'quests-198', 'quests-all']);
    expect(migrateQuestCapeAchievementIds(['quests-198', 'quests-all'])).toEqual(['quests-198', 'quests-all']);
  });

  it('never gives Quest Cape to a run that did not earn it', () => {
    for (const tier of ['quests-1', 'quests-10', 'quests-25', 'quests-50', 'quests-100', 'quests-150', 'qp-250', 'bosses-all']) {
      expect(migrateQuestCapeAchievementIds([tier])).toEqual([tier]);
    }
    expect(migrateQuestCapeAchievementIds([])).toEqual([]);
  });

  it('keeps the boost and does not pay again for a run that claimed it under an older roster', () => {
    const claimed = migrateQuestCapeAchievementIds(['quests-196']);
    expect(achievementBoostFor('Quest (Novice)', claimed)).toBe(0.5);
    // Paid once under both old ids: the boost still counts once.
    expect(achievementBoostFor('Quest (Novice)', migrateQuestCapeAchievementIds(['quests-196', 'quests-198']))).toBe(0.5);
    const settled = settle(claimed, QUEST_CAPE_QUEST_IDS);
    // Other quest tiers settle here; Quest Cape is not among them.
    expect(settled?.entries.some((e) => e.message === 'Achievement: Quest Cape') ?? false).toBe(false);
    expect(settled?.achievementsClaimed.filter((id) => id === 'quests-all')).toEqual(['quests-all']);
  });

  it('stays earned for a run that claimed it before new quests came out', () => {
    const claimed = migrateQuestCapeAchievementIds(['quests-198']);
    const cape = evaluateAchievements({ unlocks: unlocks(QUEST_CAPE_QUEST_IDS.slice(2)), gameModeId: 'vanilla', claimed })
      .find((a) => a.title === 'Quest Cape')!;
    expect(cape.earned).toBe(true);
  });

  it('pays a new run once, under the stable id', () => {
    const settled = settle([], QUEST_CAPE_QUEST_IDS)!;
    expect(settled.achievementsClaimed).toContain('quests-all');
    expect(settled.entries.filter((e) => e.message === 'Achievement: Quest Cape')).toHaveLength(1);
    expect(settle(settled.achievementsClaimed, QUEST_CAPE_QUEST_IDS)).toBeNull();
  });
});
