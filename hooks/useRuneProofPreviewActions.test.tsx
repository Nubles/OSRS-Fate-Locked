// @vitest-environment jsdom
import { useLayoutEffect } from 'react';
import { act, cleanup, render, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { questWalkthroughFor } from '../data/questWalkthroughs';
import { type RuneProofStorage } from '../utils/questRoutes/previewChecks';
import {
  runeProofPreviewActionStorageKey,
} from '../utils/questStrategies/previewActions';
import { questStrategyFromWalkthrough, type QuestStrategyDefinition } from '../utils/questStrategies/model';
import { useRuneProofPreviewActions } from './useRuneProofPreviewActions';

afterEach(cleanup);

type StorageCall = {
  readonly method: 'getItem' | 'setItem' | 'removeItem';
  readonly key: string;
};

const memoryStorage = (): RuneProofStorage & {
  readonly values: Map<string, string>;
  readonly calls: StorageCall[];
} => {
  const values = new Map<string, string>();
  const calls: StorageCall[] = [];
  return {
    values,
    calls,
    getItem: key => {
      calls.push({ method: 'getItem', key });
      return values.get(key) ?? null;
    },
    setItem: (key, value) => {
      calls.push({ method: 'setItem', key });
      values.set(key, value);
    },
    removeItem: key => {
      calls.push({ method: 'removeItem', key });
      values.delete(key);
    },
  };
};

const cookStrategy = (): QuestStrategyDefinition => {
  const walkthrough = questWalkthroughFor("Cook's Assistant");
  const strategy = walkthrough && questStrategyFromWalkthrough(walkthrough);
  if (!strategy) throw new Error("Cook's Assistant strategy fixture did not load.");
  return strategy;
};

const alternateStrategy = (): QuestStrategyDefinition => {
  const cook = cookStrategy();
  return {
    ...cook,
    questId: "Doric's Quest",
    actions: [
      { ...cook.actions[0], id: 'dorics-quest:bring-clay', dependsOn: [] },
      {
        ...cook.actions[1],
        id: 'dorics-quest:complete',
        dependsOn: ['dorics-quest:bring-clay'],
      },
    ],
  };
};

interface ScopeTransitionProbeProps {
  readonly runId: string;
  readonly strategy: QuestStrategyDefinition;
  readonly storage: RuneProofStorage;
  readonly transition: boolean;
  readonly onTransition: (confirmedActionIds: string[]) => void;
}

const ScopeTransitionProbe = ({
  runId,
  strategy,
  storage,
  transition,
  onTransition,
}: ScopeTransitionProbeProps) => {
  const controls = useRuneProofPreviewActions(runId, strategy, storage);

  useLayoutEffect(() => {
    if (!transition) return;
    onTransition([...controls.confirmedActionIds]);
    controls.setActionConfirmed('cooks-assistant:make-flour', true);
  }, [transition]);

  return null;
};

const withThrowingDefaultStorage = (callback: (accessCount: () => number) => void): void => {
  const descriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
  let accesses = 0;
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    get: () => {
      accesses += 1;
      throw new Error('local storage getter is unavailable');
    },
  });

  try {
    callback(() => accesses);
  } finally {
    if (descriptor) Object.defineProperty(window, 'localStorage', descriptor);
    else delete (window as { localStorage?: Storage }).localStorage;
  }
};

describe('useRuneProofPreviewActions', () => {
  it('loads, persists, and switches action progress by run ID', () => {
    const storage = memoryStorage();
    const strategy = cookStrategy();
    storage.values.set(runeProofPreviewActionStorageKey('run-a'), JSON.stringify({
      "Cook's Assistant": ['cooks-assistant:take-egg'],
    }));
    const { result, rerender } = renderHook(
      ({ runId }) => useRuneProofPreviewActions(runId, strategy, storage),
      { initialProps: { runId: 'run-a' } },
    );

    expect([...result.current.confirmedActionIds]).toEqual(['cooks-assistant:take-egg']);
    act(() => result.current.setActionConfirmed('cooks-assistant:make-flour', true));
    expect([...result.current.confirmedActionIds]).toEqual([
      'cooks-assistant:take-egg',
      'cooks-assistant:make-flour',
    ]);
    expect(JSON.parse(storage.values.get(runeProofPreviewActionStorageKey('run-a'))!)).toEqual({
      "Cook's Assistant": ['cooks-assistant:take-egg', 'cooks-assistant:make-flour'],
    });

    rerender({ runId: 'run-b' });
    expect([...result.current.confirmedActionIds]).toEqual([]);
    act(() => result.current.setActionConfirmed('cooks-assistant:take-egg', true));
    expect(JSON.parse(storage.values.get(runeProofPreviewActionStorageKey('run-b'))!)).toEqual({
      "Cook's Assistant": ['cooks-assistant:take-egg'],
    });
    expect(JSON.parse(storage.values.get(runeProofPreviewActionStorageKey('run-a'))!)).toEqual({
      "Cook's Assistant": ['cooks-assistant:take-egg', 'cooks-assistant:make-flour'],
    });
  });

  it('reloads only the reviewed action IDs for the current strategy identity', () => {
    const storage = memoryStorage();
    const cook = cookStrategy();
    const alternate = alternateStrategy();
    storage.values.set(runeProofPreviewActionStorageKey('run-a'), JSON.stringify({
      "Cook's Assistant": ['cooks-assistant:take-egg'],
      "Doric's Quest": ['dorics-quest:bring-clay', 'cooks-assistant:take-egg'],
    }));
    const { result, rerender } = renderHook(
      ({ strategy }) => useRuneProofPreviewActions('run-a', strategy, storage),
      { initialProps: { strategy: cook } },
    );

    expect([...result.current.confirmedActionIds]).toEqual(['cooks-assistant:take-egg']);
    rerender({ strategy: alternate });
    expect([...result.current.confirmedActionIds]).toEqual(['dorics-quest:bring-clay']);
  });

  it('defers all storage access until a strategy loads', () => {
    const storage = memoryStorage();
    const strategy = cookStrategy();
    storage.values.set(runeProofPreviewActionStorageKey('run-a'), JSON.stringify({
      "Cook's Assistant": ['cooks-assistant:take-egg'],
    }));
    const { result, rerender } = renderHook(
      ({ loadedStrategy }) => useRuneProofPreviewActions('run-a', loadedStrategy, storage),
      { initialProps: { loadedStrategy: null as QuestStrategyDefinition | null } },
    );

    expect([...result.current.confirmedActionIds]).toEqual([]);
    act(() => result.current.setActionConfirmed('cooks-assistant:take-egg', true));
    expect(storage.calls).toEqual([]);

    rerender({ loadedStrategy: strategy });
    expect([...result.current.confirmedActionIds]).toEqual(['cooks-assistant:take-egg']);
  });

  it('does not resolve default storage before a strategy loads', () => {
    withThrowingDefaultStorage(accessCount => {
      expect(() => renderHook(() => useRuneProofPreviewActions('run-a', null))).not.toThrow();
      expect(accessCount()).toBe(0);
    });
  });

  it('contains a failing default storage getter once a strategy loads', () => {
    const strategy = cookStrategy();

    withThrowingDefaultStorage(accessCount => {
      expect(() => {
        const { result } = renderHook(() => useRuneProofPreviewActions('run-a', strategy));
        expect([...result.current.confirmedActionIds]).toEqual([]);
      }).not.toThrow();
      expect(accessCount()).toBeGreaterThan(0);
    });
  });

  it('does not expose or persist the previous run during the transition render', () => {
    const storage = memoryStorage();
    const strategy = cookStrategy();
    const transitions: string[][] = [];
    storage.values.set(runeProofPreviewActionStorageKey('run-a'), JSON.stringify({
      "Cook's Assistant": ['cooks-assistant:take-egg'],
    }));
    const { rerender } = render(
      <ScopeTransitionProbe
        runId="run-a"
        strategy={strategy}
        storage={storage}
        transition={false}
        onTransition={confirmedActionIds => transitions.push(confirmedActionIds)}
      />,
    );

    rerender(
      <ScopeTransitionProbe
        runId="run-b"
        strategy={strategy}
        storage={storage}
        transition
        onTransition={confirmedActionIds => transitions.push(confirmedActionIds)}
      />,
    );

    expect(transitions).toEqual([[]]);
    expect(JSON.parse(storage.values.get(runeProofPreviewActionStorageKey('run-b'))!)).toEqual({
      "Cook's Assistant": ['cooks-assistant:make-flour'],
    });
  });

  it('does not expose or persist the previous strategy identity during the transition render', () => {
    const storage = memoryStorage();
    const strategy = cookStrategy();
    const revisedStrategy: QuestStrategyDefinition = { ...strategy, revision: 'revised' };
    const transitions: string[][] = [];
    storage.values.set(runeProofPreviewActionStorageKey('run-a'), JSON.stringify({
      "Cook's Assistant": ['cooks-assistant:take-egg'],
    }));
    const { rerender } = render(
      <ScopeTransitionProbe
        runId="run-a"
        strategy={strategy}
        storage={storage}
        transition={false}
        onTransition={confirmedActionIds => transitions.push(confirmedActionIds)}
      />,
    );

    rerender(
      <ScopeTransitionProbe
        runId="run-a"
        strategy={revisedStrategy}
        storage={storage}
        transition
        onTransition={confirmedActionIds => transitions.push(confirmedActionIds)}
      />,
    );

    expect(transitions).toEqual([[]]);
    expect(JSON.parse(storage.values.get(runeProofPreviewActionStorageKey('run-a'))!)).toEqual({
      "Cook's Assistant": ['cooks-assistant:make-flour'],
    });
  });

  it('keeps valid in-memory action changes when storage rejects writes', () => {
    const strategy = cookStrategy();
    const storage: RuneProofStorage = {
      getItem: () => null,
      setItem: () => { throw new Error('quota exceeded'); },
      removeItem: () => { throw new Error('quota exceeded'); },
    };
    const { result } = renderHook(() => useRuneProofPreviewActions('run-a', strategy, storage));

    act(() => result.current.setActionConfirmed('cooks-assistant:take-egg', true));
    expect([...result.current.confirmedActionIds]).toEqual(['cooks-assistant:take-egg']);
  });

  it('ignores unknown actions', () => {
    const storage = memoryStorage();
    const strategy = cookStrategy();
    const { result } = renderHook(() => useRuneProofPreviewActions('run-a', strategy, storage));

    act(() => result.current.setActionConfirmed('unknown-action', true));
    expect([...result.current.confirmedActionIds]).toEqual([]);
  });
});
