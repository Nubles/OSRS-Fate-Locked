import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from './achievements';
import { achievementBoost, achievementBoostFor, activeBoosts, boostActivityOf, boostLabel, type BoostActivity } from './achievementBoosts';
import { rewardLabel } from './achievementRewards';
import { DropSource } from '../types';
import { initialState, prepareKeyRollAction } from '../context/GameContext';

/** The achievements of each activity, by id. */
const ACTIVITY_IDS: Record<BoostActivity, RegExp> = {
  skills: /^(skills-start-|total-level-|skill-tiers-|skills-99-)/,
  quests: /^(quests-|qp-)/,
  diaries: /^diar(ies|y)-/,
  ca: /^ca-/,
  collection: /^collection-/,
  slayer: /^slayer-tasks-/,
  clues: /^clues-/,
  bosses: /^bosses-/,
  minigames: /^(minigames-|minigame-runs-)/,
};

describe('activity Key boosts', () => {
  it('gives every tier of an activity 0.2%, 0.3% or 0.5% by its Fate, and nothing else a boost', () => {
    for (const a of ACHIEVEMENTS) {
      const activity = (Object.keys(ACTIVITY_IDS) as BoostActivity[]).find((k) => ACTIVITY_IDS[k].test(a.id)) ?? null;
      const expected = activity ? { activity, percent: a.fate === 0 ? 0.2 : a.fate === 10 ? 0.3 : 0.5 } : null;
      expect(achievementBoost(a.id), a.id).toEqual(expected);
    }
  });

  it('lets each activity reach at least 3%', () => {
    const all = ACHIEVEMENTS.map((a) => a.id);
    for (const b of activeBoosts(all)) expect(b.percent, b.activity).toBeGreaterThanOrEqual(3);
    expect(activeBoosts(all)).toHaveLength(9);
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

  it('adds up the earned tiers for their own activity only', () => {
    expect(achievementBoostFor(DropSource.SLAYER_KONAR, undefined)).toBe(0);
    const slayer = ['slayer-tasks-1', 'slayer-tasks-10', 'slayer-tasks-25', 'slayer-tasks-100'];
    expect(achievementBoostFor(DropSource.SLAYER_KONAR, slayer)).toBe(1.2);
    expect(achievementBoostFor(DropSource.SLAYER_KONAR, [...slayer, 'slayer-tasks-1'])).toBe(1.2);
    expect(achievementBoostFor(DropSource.CLUE_HARD, slayer)).toBe(0);
    expect(activeBoosts([...slayer, 'quests-10'])).toEqual([
      { activity: 'quests', label: 'quest', percent: 0.3 },
      { activity: 'slayer', label: 'Slayer', percent: 1.2 },
    ]);
  });

  it('shows the boost with the reward', () => {
    expect(boostLabel('quests-25')).toBe('+0.3% quest Key chance');
    expect(boostLabel('quests-1')).toBe('+0.2% quest Key chance');
    expect(boostLabel('rolls-1')).toBeNull();
    expect(rewardLabel({ id: 'quests-50', fate: 15, freeRituals: 0, chaosKeys: 0 })).toBe('+15 Fate · +0.5% quest Key chance');
  });

  it('raises the Key roll for that activity only', () => {
    const run = { ...initialState, runId: 'boost-run', runRevision: 0, lastEvent: null };
    const boosted = { ...run, achievementsClaimed: ['diaries-1', 'diaries-12'] };
    const dice = () => 500;
    const threshold = (s: typeof run, source: string) => prepareKeyRollAction(s, source, 20, 1, dice).payload.threshold;
    expect(threshold(boosted, DropSource.DIARY_HARD)).toBe(threshold(run, DropSource.DIARY_HARD) + 0.7);
    expect(threshold(boosted, DropSource.QUEST_MASTER)).toBe(threshold(run, DropSource.QUEST_MASTER));
  });

  it('leaves Vanilla minigame reserves at their own pace', () => {
    const minigames = ['minigames-1', 'minigames-3', 'minigames-5'];
    expect(boostLabel('minigames-5', 'vanilla')).toBeNull();
    expect(boostLabel('minigames-5', 'chunked')).toBe('+0.3% minigame Key chance');
    expect(activeBoosts([...minigames, 'quests-10'], 'vanilla')).toEqual([{ activity: 'quests', label: 'quest', percent: 0.3 }]);
    const vanilla = {
      ...initialState, runId: 'boost-run', runRevision: 0, lastEvent: null, gameModeId: 'vanilla',
      unlocks: { ...initialState.unlocks, minigames: ['Castle Wars'] },
    };
    const roll = (s: typeof vanilla) => prepareKeyRollAction(s, DropSource.ACTIVITY_MINIGAME, 0, 1, () => 5000, undefined, undefined, undefined,
      { kind: 'minigame', minigameName: 'Castle Wars' })!.payload.threshold;
    expect(roll({ ...vanilla, achievementsClaimed: minigames })).toBe(roll(vanilla));
    const chunked = { ...initialState, runId: 'boost-run', runRevision: 0, lastEvent: null, gameModeId: 'chunked', achievementsClaimed: minigames };
    expect(prepareKeyRollAction(chunked, DropSource.ACTIVITY_MINIGAME, 10, 1, () => 500).payload.threshold).toBe(10.7);
  });
});
