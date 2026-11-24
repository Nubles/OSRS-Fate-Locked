// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import * as C from '../constants';
import type { GameState, LogEntry, UnlockState } from '../types';
import { BANK_IDS } from '../data/banks';
import { unlockableAreas } from '../utils/freeAreas';
import { settleAchievements, type AchievementPayout } from '../utils/achievementRewards';
import { loadAchievementCatalog, useAchievementReveal } from './useAchievementReveal';

// Every skill at tier `attackTier` for Attack and 10 for the rest: tier 10
// everywhere earns Uncapped (skill-tiers-240), and one tier less loses it,
// as a Sacrifice that takes Attack's top tier would.
const progress = (attackTier: number, quests: string[] = []): UnlockState => ({
  skills: Object.fromEntries(C.SKILLS_LIST.map((s) => [s, s === 'Attack' ? attackTier : 10])),
  levels: Object.fromEntries(C.SKILLS_LIST.map((s) => [s, 50])),
  equipment: Object.fromEntries(C.EQUIPMENT_SLOTS.map((s) => [s, 1])),
  regions: [...unlockableAreas('vanilla')].slice(0, 3),
  chunks: [], mobility: [], arcana: [], housing: [], merchants: [], minigames: [], bosses: [], storage: [],
  guilds: [], farming: [], slayerUnlocks: [], banks: [BANK_IDS[0]],
  quests, diaries: [], cas: [], completedTasks: [], collectionLog: {},
} as unknown as UnlockState);

const UNCAPPED = 'skill-tiers-240';

beforeAll(() => loadAchievementCatalog());
afterEach(cleanup);

/**
 * The hook wired to the real settlement, as the game wires it: each settle
 * pays through settleAchievements and hands the new claimed list back.
 */
function playRun(steps: UnlockState[]) {
  let state = {
    runId: 'run-reveal-test', gameModeId: 'vanilla', customMode: undefined,
    fatePoints: 0, chaosKeys: 0, freeRituals: [], achievementsClaimed: [] as string[],
  } as unknown as GameState;
  const paid: LogEntry[] = [];
  const revealed: string[][] = [];
  const settle = (earned: AchievementPayout[]) => {
    const settled = settleAchievements(state, earned, 0, () => `e${paid.length}`, 99);
    if (!settled) return;
    paid.push(...settled.entries);
    state = { ...state, ...settled };
  };
  const hook = renderHook(
    ({ unlocks, claimed }) => useAchievementReveal({ unlocks, history: [], gameModeId: 'vanilla' }, { claimed, settle, replacements: 0 }),
    { initialProps: { unlocks: steps[0], claimed: state.achievementsClaimed } },
  );
  for (const unlocks of steps.slice(1)) {
    act(() => hook.rerender({ unlocks, claimed: state.achievementsClaimed }));
    // Let the settlement's new claimed list reach the hook, as a dispatch would.
    act(() => hook.rerender({ unlocks, claimed: state.achievementsClaimed }));
    const [shown, dismiss] = hook.result.current;
    revealed.push((shown ?? []).map((a) => a.id));
    act(() => dismiss());
  }
  return { paid, revealed, state: () => state };
}

describe('useAchievementReveal', () => {
  it('does not announce an achievement again when it is lost and earned back', () => {
    const run = playRun([progress(9), progress(10), progress(9), progress(10)]);
    expect(run.revealed[0]).toContain(UNCAPPED); // earned in play: announced
    expect(run.revealed[1]).toEqual([]); // lost to a Sacrifice: nothing
    expect(run.revealed[2]).not.toContain(UNCAPPED); // earned back: already paid, no second pop-up
  });

  it('pays every achievement once, the same as a run that never lost it', () => {
    const bumpy = playRun([progress(9), progress(10), progress(9), progress(10)]);
    const smooth = playRun([progress(9), progress(10)]);
    const ids = (entries: LogEntry[]) => entries.map((e) => e.meta?.achievementId);
    // Uncapped pays its 25 Fate and Chaos Key once, and nothing is paid twice or left out.
    expect(ids(bumpy.paid).filter((id) => id === UNCAPPED)).toHaveLength(1);
    expect(new Set(ids(bumpy.paid)).size).toBe(bumpy.paid.length);
    expect(bumpy.paid.map((e) => [e.meta?.achievementId, e.meta?.fateAwarded, e.meta?.chaosKeysAwarded ?? 0]))
      .toEqual(smooth.paid.map((e) => [e.meta?.achievementId, e.meta?.fateAwarded, e.meta?.chaosKeysAwarded ?? 0]));
    expect(bumpy.state().fatePoints).toBe(smooth.state().fatePoints);
    expect(bumpy.state().chaosKeys).toBe(smooth.state().chaosKeys);
    const uncapped = bumpy.paid.find((e) => e.meta?.achievementId === UNCAPPED);
    expect(uncapped?.meta?.chaosKeysAwarded).toBe(1);
    expect(uncapped?.details).toContain('+25 Fate');
  });

  it('still announces and pays an achievement earned for the first time after one was lost', () => {
    const run = playRun([progress(9), progress(10), progress(9), progress(10, ["Cook's Assistant"])]);
    expect(run.revealed[2]).toContain('quests-1');
    expect(run.revealed[2]).not.toContain(UNCAPPED);
    expect(run.paid.filter((e) => e.meta?.achievementId === 'quests-1')).toHaveLength(1);
  });
});
