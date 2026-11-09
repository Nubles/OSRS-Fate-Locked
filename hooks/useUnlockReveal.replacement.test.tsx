// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { UnlockState } from '../types';
import { useUnlockReveal } from './useUnlockReveal';

const unlocks = (over: Partial<UnlockState> = {}): UnlockState => ({
  equipment: {},
  skills: {},
  levels: {},
  regions: [],
  mobility: [],
  arcana: [],
  housing: [],
  merchants: [],
  minigames: [],
  bosses: [],
  storage: [],
  guilds: [],
  farming: [],
  slayerUnlocks: [],
  quests: [],
  diaries: [],
  cas: [],
  completedTasks: [],
  collectionLog: {},
  ...over,
});

afterEach(cleanup);

describe('useUnlockReveal', () => {
  const fresh = unlocks();
  const mature = unlocks({ quests: ["Cook's Assistant", 'Sheep Shearer'], regions: ['Lumbridge', 'Varrock'] });

  it('announces a quest finished in play', () => {
    const hook = renderHook(
      ({ state, replacements }) => useUnlockReveal(state, 'vanilla', replacements),
      { initialProps: { state: fresh, replacements: 0 } },
    );
    expect(hook.result.current[0]).toBeNull();

    act(() => hook.rerender({ state: unlocks({ quests: ["Cook's Assistant"] }), replacements: 0 }));
    expect(hook.result.current[0]?.completedQuests).toEqual(["Cook's Assistant"]);
  });

  it("does not announce an imported run's quests and areas as just earned", () => {
    const hook = renderHook(
      ({ state, replacements }) => useUnlockReveal(state, 'vanilla', replacements),
      { initialProps: { state: fresh, replacements: 0 } },
    );

    // Import, sync code, restore and reset all bump the replacement count.
    act(() => hook.rerender({ state: mature, replacements: 1 }));
    expect(hook.result.current[0]).toBeNull();

    // The replaced run is the new baseline: play on it still announces.
    act(() => hook.rerender({ state: { ...mature, quests: [...mature.quests, 'Rune Mysteries'] }, replacements: 1 }));
    expect(hook.result.current[0]?.completedQuests).toEqual(['Rune Mysteries']);
  });

  it('clears a reveal still on screen when the run is replaced', () => {
    const hook = renderHook(
      ({ state, replacements }) => useUnlockReveal(state, 'vanilla', replacements),
      { initialProps: { state: fresh, replacements: 0 } },
    );
    act(() => hook.rerender({ state: unlocks({ quests: ["Cook's Assistant"] }), replacements: 0 }));
    expect(hook.result.current[0]).not.toBeNull();

    act(() => hook.rerender({ state: fresh, replacements: 1 }));
    expect(hook.result.current[0]).toBeNull();
  });
});
