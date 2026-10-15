import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from './achievements';
import { ACTIVITY_BOOSTS, achievementBoostFor, activeBoosts, boostActivityOf, boostLabel, type BoostActivity } from './achievementBoosts';
import { rewardLabel } from './achievementRewards';
import { DropSource } from '../types';
import { initialState, prepareKeyRollAction } from '../context/GameContext';

describe('activity Key boosts', () => {
  it('names only achievements that exist, three per activity', () => {
    const ids = new Set(ACHIEVEMENTS.map((a) => a.id));
    for (const [activity, { ids: milestones }] of Object.entries(ACTIVITY_BOOSTS)) {
      expect(milestones, activity).toHaveLength(3);
      for (const id of milestones) expect(ids.has(id), id).toBe(true);
    }
  });

  it('sorts every roll source into its activity', () => {
    const expected: Array<[string, BoostActivity | null]> = [
      ['Attack Level 42', 'skills'],
      [DropSource.LEVEL_UP, 'skills'],
      [DropSource.QUEST_MASTER, 'quests'],
      [DropSource.DIARY_ELITE, 'diaries'],
      [DropSource.CA_HARD, 'ca'],
      [DropSource.COLLECTION_LOG, 'collection'],
      ['Col. Log: Abyssal whip', 'collection'],
      [DropSource.SLAYER_DURADEL, 'slayer'],
      [DropSource.CLUE_MASTER, 'clues'],
      [DropSource.BOSS_HIGH, 'bosses'],
      [DropSource.RAID, 'bosses'],
      [DropSource.ACTIVITY_MINIGAME, 'minigames'],
      [DropSource.PET, null],
      [DropSource.CUSTOM, null],
    ];
    for (const [source, activity] of expected) expect(boostActivityOf(source), source).toBe(activity);
  });

  it('adds 1% for each milestone earned, up to 3%, and only to its own activity', () => {
    expect(achievementBoostFor(DropSource.SLAYER_KONAR, undefined)).toBe(0);
    expect(achievementBoostFor(DropSource.SLAYER_KONAR, ['slayer-tasks-50'])).toBe(1);
    const all = ['slayer-tasks-50', 'slayer-tasks-200', 'slayer-tasks-500', 'slayer-tasks-1'];
    expect(achievementBoostFor(DropSource.SLAYER_KONAR, all)).toBe(3);
    expect(achievementBoostFor(DropSource.CLUE_HARD, all)).toBe(0);
    expect(activeBoosts([...all, 'quests-10'])).toEqual([
      { activity: 'quests', label: 'quest', percent: 1 },
      { activity: 'slayer', label: 'Slayer', percent: 3 },
    ]);
  });

  it('shows the boost with the reward', () => {
    expect(boostLabel('quests-25')).toBe('+1% quest Key chance');
    expect(boostLabel('quests-1')).toBeNull();
    expect(rewardLabel({ id: 'quests-25', fate: 10, freeRituals: 0, chaosKeys: 0 })).toBe('+10 Fate · +1% quest Key chance');
  });

  it('raises the Key roll for that activity only', () => {
    const run = { ...initialState, runId: 'boost-run', runRevision: 0, lastEvent: null };
    const boosted = { ...run, achievementsClaimed: ['diaries-1', 'diaries-12'] };
    const dice = () => 500;
    const threshold = (s: typeof run, source: string) => prepareKeyRollAction(s, source, 20, 1, dice).payload.threshold;
    expect(threshold(boosted, DropSource.DIARY_HARD)).toBe(threshold(run, DropSource.DIARY_HARD) + 2);
    expect(threshold(boosted, DropSource.QUEST_MASTER)).toBe(threshold(run, DropSource.QUEST_MASTER));
  });
});
