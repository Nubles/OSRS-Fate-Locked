// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { UnlockState } from '../types';
import { QUEST_DATA } from '../data/questData';
import { evaluateQuestEligibility } from '../utils/journalStatus';
import { getUnlockRevealTransition, useUnlockReveal } from './useUnlockReveal';

const unlocks = (over: Partial<UnlockState> = {}): UnlockState => ({
  equipment: { Head: 1 }, skills: { Slayer: 10 }, levels: { Slayer: 99 },
  regions: [], mobility: [], arcana: [], housing: [], merchants: [],
  minigames: [], bosses: [], storage: [], guilds: [], farming: [],
  slayerUnlocks: [], quests: [], diaries: [], cas: [],
  completedTasks: [], collectionLog: {}, ...over,
});

// Three chunks around Draynor; '47,51' is where A Porcine of Interest starts.
const held = unlocks({ chunks: ['48,50', '49,52', '48,51'] });
const withPorcineChunk = { ...held, chunks: [...held.chunks!, '47,51'] };
// A chunk far out at sea that opens no quest or diary tier.
const withEmptyChunk = { ...held, chunks: [...held.chunks!, '20,20'] };

afterEach(cleanup);

describe('Chunked: the unlock reveal for a new chunk', () => {
  it('lists a quest the new chunk makes available', () => {
    const quest = QUEST_DATA['A Porcine of Interest'];
    expect(evaluateQuestEligibility(quest, held, 'chunked').eligible).toBe(false);
    expect(evaluateQuestEligibility(quest, withPorcineChunk, 'chunked').eligible).toBe(true);

    const reveal = getUnlockRevealTransition(held, withPorcineChunk, 'chunked');
    expect(reveal?.newQuestsAvailable.map(q => q.id)).toContain('A Porcine of Interest');
    expect(reveal?.completedQuests).toEqual([]);
    expect(reveal?.newRegions).toEqual([]);
  });

  it('shows nothing for a chunk that opens no quest or diary tier', () => {
    expect(getUnlockRevealTransition(held, withEmptyChunk, 'chunked')).toBeNull();
  });

  it('shows nothing when a chunk is taken away', () => {
    expect(getUnlockRevealTransition(withPorcineChunk, held, 'chunked')).toBeNull();
  });

  it('leaves Vanilla as it was: a chunks list change there shows nothing', () => {
    expect(getUnlockRevealTransition(held, withPorcineChunk, 'vanilla')).toBeNull();
    const rimmington = unlocks({ regions: ['Rimmington'] });
    const reveal = getUnlockRevealTransition(rimmington, { ...rimmington, regions: ['Rimmington', 'Asgarnia'] }, 'vanilla');
    expect(reveal?.newRegions).toContain('Falador');
    expect(reveal?.newQuestsAvailable.map(q => q.id)).toContain("Doric's Quest");
  });

  it('starts the reveal when a chunk is gained in play', () => {
    const hook = renderHook(
      ({ state, replacements }) => useUnlockReveal(state, 'chunked', replacements),
      { initialProps: { state: held, replacements: 0 } },
    );
    expect(hook.result.current[0]).toBeNull();
    act(() => hook.rerender({ state: withPorcineChunk, replacements: 0 }));
    expect(hook.result.current[0]?.newQuestsAvailable.map(q => q.id)).toContain('A Porcine of Interest');
  });

  it('shows nothing on loading a save or switching profile (a fresh mount)', () => {
    const hook = renderHook(() => useUnlockReveal(withPorcineChunk, 'chunked', 0));
    expect(hook.result.current[0]).toBeNull();
  });

  it('shows nothing when an import, sync code or restore brings more chunks', () => {
    const hook = renderHook(
      ({ state, replacements }) => useUnlockReveal(state, 'chunked', replacements),
      { initialProps: { state: held, replacements: 0 } },
    );
    act(() => hook.rerender({ state: withPorcineChunk, replacements: 1 }));
    expect(hook.result.current[0]).toBeNull();
  });
});
