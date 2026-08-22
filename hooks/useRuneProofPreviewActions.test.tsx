// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { type RuneProofStorage } from '../utils/questRoutes/previewChecks';
import {
  runeProofPreviewActionStorageKey,
} from '../utils/questStrategies/previewActions';
import { type QuestStrategyDefinition } from '../utils/questStrategies/model';
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

const cookActionIds = [
  'cooks-assistant:start-quest',
  'cooks-assistant:take-pot',
  'cooks-assistant:take-bucket',
  'cooks-assistant:milk-cow',
  'cooks-assistant:take-egg',
  'cooks-assistant:pick-grain',
  'cooks-assistant:make-flour',
  'cooks-assistant:return-to-cook',
  'cooks-assistant:complete',
] as const;

const strategy = (
  questId: string,
  actionIds: readonly string[],
  progressionPriority: number,
): QuestStrategyDefinition => ({
  questId,
  kind: 'quest',
  rolloutWave: 1,
  progressionPriority,
  revision: questId.toLowerCase().replaceAll(' ', '-'),
  source: {},
  sourceLines: [],
  actions: actionIds.map((id, index) => ({
    id,
    mapChunks: ['50,50'],
    coach: {
      consumes: [],
      fulfils: [],
      completion: index === actionIds.length - 1
        ? { kind: 'QUEST_COMPLETED', questId }
        : { kind: 'MANUAL' },
      fallbackPolicy: 'NONE',
    },
  })) as unknown as QuestStrategyDefinition['actions'],
} as unknown as QuestStrategyDefinition);

const strategies = (): readonly QuestStrategyDefinition[] => [
  strategy("Cook's Assistant", cookActionIds, 1),
  strategy('Sheep Shearer', ['sheep-shearer:start-with-fred', 'sheep-shearer:complete'], 2),
];

const emptyCatalogue: readonly QuestStrategyDefinition[] = [];

const confirmedActionIdsFor = (controls: unknown, questId: string): string[] => {
  const reader = (controls as {
    confirmedActionIdsFor?: (quest: string) => ReadonlySet<string>;
  }).confirmedActionIdsFor;
  return typeof reader === 'function' ? [...reader(questId)] : [];
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
  it('preserves Cook 9/9 and Sheep progress across active-quest switches and remount', () => {
    const storage = memoryStorage();
    const catalogue = strategies();
    const key = runeProofPreviewActionStorageKey('run-a');
    storage.values.set(key, JSON.stringify({
      "Cook's Assistant": cookActionIds,
    }));
    const { result, rerender, unmount } = renderHook(
      ({ activeQuest }) => {
        const controls = useRuneProofPreviewActions('run-a', catalogue, storage);
        return {
          controls,
          activeActionIds: confirmedActionIdsFor(controls, activeQuest),
        };
      },
      { initialProps: { activeQuest: "Cook's Assistant" } },
    );

    expect(result.current.activeActionIds).toEqual(cookActionIds);
    expect((result.current.controls.actionsByQuest ?? {})["Cook's Assistant"]).toEqual(cookActionIds);
    act(() => result.current.controls.setActionConfirmed(
      'Sheep Shearer',
      'sheep-shearer:start-with-fred',
      true,
    ));
    rerender({ activeQuest: 'Sheep Shearer' });
    expect(result.current.activeActionIds).toEqual(['sheep-shearer:start-with-fred']);
    rerender({ activeQuest: "Cook's Assistant" });
    expect(result.current.activeActionIds).toEqual(cookActionIds);
    rerender({ activeQuest: 'Sheep Shearer' });
    expect(result.current.activeActionIds).toEqual(['sheep-shearer:start-with-fred']);
    unmount();

    const remounted = renderHook(() => useRuneProofPreviewActions('run-a', catalogue, storage));
    expect(confirmedActionIdsFor(remounted.result.current, "Cook's Assistant")).toEqual(cookActionIds);
    expect(confirmedActionIdsFor(remounted.result.current, 'Sheep Shearer')).toEqual([
      'sheep-shearer:start-with-fred',
    ]);
    expect(JSON.parse(storage.values.get(key)!)).toEqual({
      "Cook's Assistant": cookActionIds,
      'Sheep Shearer': ['sheep-shearer:start-with-fred'],
    });
    expect(storage.calls.every(call => call.key === key)).toBe(true);
  });

  it('does not expose or persist previous-run actions during a run transition', () => {
    const storage = memoryStorage();
    const catalogue = strategies();
    storage.values.set(runeProofPreviewActionStorageKey('run-a'), JSON.stringify({
      "Cook's Assistant": ['cooks-assistant:take-egg'],
    }));
    const { result, rerender } = renderHook(
      ({ runId }) => useRuneProofPreviewActions(runId, catalogue, storage),
      { initialProps: { runId: 'run-a' } },
    );

    expect(confirmedActionIdsFor(result.current, "Cook's Assistant")).toEqual([
      'cooks-assistant:take-egg',
    ]);
    rerender({ runId: 'run-b' });
    expect(confirmedActionIdsFor(result.current, "Cook's Assistant")).toEqual([]);
    act(() => result.current.setActionConfirmed(
      "Cook's Assistant",
      'cooks-assistant:make-flour',
      true,
    ));
    expect(JSON.parse(storage.values.get(runeProofPreviewActionStorageKey('run-b'))!)).toEqual({
      "Cook's Assistant": ['cooks-assistant:make-flour'],
    });
    expect(JSON.parse(storage.values.get(runeProofPreviewActionStorageKey('run-a'))!)).toEqual({
      "Cook's Assistant": ['cooks-assistant:take-egg'],
    });
  });

  it('defers default storage until the catalogue contains a strategy', () => {
    withThrowingDefaultStorage(accessCount => {
      expect(() => renderHook(() => useRuneProofPreviewActions('run-a', emptyCatalogue))).not.toThrow();
      expect(accessCount()).toBe(0);
    });
  });

  it('keeps valid in-memory action changes when storage rejects writes', () => {
    const catalogue = strategies();
    const storage: RuneProofStorage = {
      getItem: () => null,
      setItem: () => { throw new Error('quota exceeded'); },
      removeItem: () => { throw new Error('quota exceeded'); },
    };
    const { result } = renderHook(() => useRuneProofPreviewActions('run-a', catalogue, storage));

    act(() => result.current.setActionConfirmed(
      "Cook's Assistant",
      'cooks-assistant:take-egg',
      true,
    ));
    expect(confirmedActionIdsFor(result.current, "Cook's Assistant")).toEqual([
      'cooks-assistant:take-egg',
    ]);
  });

  it('ignores unknown quest and action confirmations', () => {
    const storage = memoryStorage();
    const catalogue = strategies();
    const { result } = renderHook(() => useRuneProofPreviewActions('run-a', catalogue, storage));

    act(() => result.current.setActionConfirmed('Unknown Quest', 'unknown-action', true));
    act(() => result.current.setActionConfirmed("Cook's Assistant", 'unknown-action', true));
    expect(result.current.actionsByQuest).toEqual({});
  });
});
