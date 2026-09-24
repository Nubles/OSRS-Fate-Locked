// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runeProofGuideStorageKey, useRuneProofGuideSession } from './useRuneProofGuideSession';

const quests = new Set(["Cook's Assistant", 'The Restless Ghost']);
const storage = new Map<string, string>();
beforeEach(() => {
  storage.clear();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => { storage.set(key, value); },
      clear: () => storage.clear(),
    },
  });
});

afterEach(() => { cleanup(); window.localStorage.clear(); vi.restoreAllMocks(); });

describe('useRuneProofGuideSession', () => {
  it('remembers only catalogue quests and gives an explicit target priority', () => {
    window.localStorage.setItem(runeProofGuideStorageKey('run-a'), 'The Restless Ghost');
    const first = renderHook(() => useRuneProofGuideSession('run-a', quests, "Cook's Assistant"));
    expect(first.result.current.questId).toBe("Cook's Assistant");
    act(() => first.result.current.selectQuest('Unknown quest'));
    expect(first.result.current.questId).toBe("Cook's Assistant");
    act(() => first.result.current.selectQuest('The Restless Ghost'));
    first.unmount();
    expect(renderHook(() => useRuneProofGuideSession('run-a', quests)).result.current.questId)
      .toBe('The Restless Ghost');
  });

  it('never exposes or writes the previous selection into a different run', () => {
    window.localStorage.setItem(runeProofGuideStorageKey('run-a'), "Cook's Assistant");
    window.localStorage.setItem(runeProofGuideStorageKey('run-b'), 'The Restless Ghost');
    const observed: Array<{ run: string; quest: string | null }> = [];
    const view = renderHook(({ run }) => {
      const session = useRuneProofGuideSession(run, quests);
      observed.push({ run, quest: session.questId });
      return session;
    }, { initialProps: { run: 'run-a' } });
    view.rerender({ run: 'run-b' });
    expect(observed.filter(row => row.run === 'run-b').map(row => row.quest))
      .not.toContain("Cook's Assistant");
    expect(view.result.current.questId).toBe('The Restless Ghost');
    expect(window.localStorage.getItem(runeProofGuideStorageKey('run-b'))).toBe('The Restless Ghost');
  });

  it('keeps an unreviewed stored quest hidden and works when storage fails', () => {
    window.localStorage.setItem(runeProofGuideStorageKey('run-a'), 'Unreviewed quest');
    const view = renderHook(() => useRuneProofGuideSession('run-a', quests));
    expect(view.result.current.questId).toBeNull();
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => { throw new Error('Storage denied'); });
    act(() => view.result.current.selectQuest('The Restless Ghost'));
    expect(view.result.current.questId).toBe('The Restless Ghost');
  });
});
