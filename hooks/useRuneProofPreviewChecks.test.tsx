// @vitest-environment jsdom
import { useLayoutEffect } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { runeProofPreviewStorageKey, type RuneProofStorage } from '../utils/questRoutes/previewChecks';
import { useRuneProofPreviewChecks } from './useRuneProofPreviewChecks';

afterEach(cleanup);

const memoryStorage = (): RuneProofStorage & { values: Map<string, string> } => {
  const values = new Map<string, string>();
  return {
    values,
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: key => { values.delete(key); },
  };
};

describe('useRuneProofPreviewChecks', () => {
  it('loads, persists, and switches confirmation state by run id', () => {
    const storage = memoryStorage();
    storage.values.set(runeProofPreviewStorageKey('run-a'), JSON.stringify({
      "Cook's Assistant": ['egg'],
    }));
    const { result, rerender } = renderHook(
      ({ runId }) => useRuneProofPreviewChecks(runId, storage),
      { initialProps: { runId: 'run-a' } },
    );

    expect([...result.current.confirmedItemKeys("Cook's Assistant")]).toEqual(['egg']);
    act(() => result.current.setItemConfirmed("Cook's Assistant", 'pot of flour', true));
    expect([...result.current.confirmedItemKeys("Cook's Assistant")])
      .toEqual(['egg', 'pot of flour']);
    expect(JSON.parse(storage.values.get(runeProofPreviewStorageKey('run-a'))!))
      .toEqual({ "Cook's Assistant": ['egg', 'pot of flour'] });

    rerender({ runId: 'run-b' });
    expect(result.current.checks).toEqual({});
    act(() => result.current.setItemConfirmed("Doric's Quest", 'clay', true));
    expect(JSON.parse(storage.values.get(runeProofPreviewStorageKey('run-b'))!))
      .toEqual({ "Doric's Quest": ['clay'] });
    expect(JSON.parse(storage.values.get(runeProofPreviewStorageKey('run-a'))!))
      .toEqual({ "Cook's Assistant": ['egg', 'pot of flour'] });
  });

  it('does not display or write prior-run checks before new-run hydration', async () => {
    const storage = memoryStorage();
    storage.values.set(runeProofPreviewStorageKey('run-a'), JSON.stringify({
      "Cook's Assistant": ['egg'],
    }));
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const CheckProbe = ({ runId, writeNewRun }: {
      readonly runId: string;
      readonly writeNewRun: boolean;
    }) => {
      const controls = useRuneProofPreviewChecks(runId, storage);
      useLayoutEffect(() => {
        if (writeNewRun) {
          controls.setItemConfirmed("Cook's Assistant", 'pot of flour', true);
        }
      }, [controls.setItemConfirmed, writeNewRun]);
      return <output>{[...controls.confirmedItemKeys("Cook's Assistant")].join(',')}</output>;
    };

    await act(async () => { root.render(<CheckProbe runId="run-a" writeNewRun={false} />); });
    expect(host.querySelector('output')?.textContent).toBe('egg');

    flushSync(() => { root.render(<CheckProbe runId="run-b" writeNewRun />); });

    expect(host.querySelector('output')?.textContent).toBe('pot of flour');
    expect(JSON.parse(storage.values.get(runeProofPreviewStorageKey('run-b'))!))
      .toEqual({ "Cook's Assistant": ['pot of flour'] });
    expect(JSON.parse(storage.values.get(runeProofPreviewStorageKey('run-a'))!))
      .toEqual({ "Cook's Assistant": ['egg'] });

    await act(async () => { root.unmount(); });
    host.remove();
  });

  it('keeps valid in-memory changes when browser storage rejects writes', () => {
    const storage: RuneProofStorage = {
      getItem: () => null,
      setItem: () => { throw new Error('quota exceeded'); },
      removeItem: () => { throw new Error('quota exceeded'); },
    };
    const { result } = renderHook(() => useRuneProofPreviewChecks('run-a', storage));

    act(() => result.current.setItemConfirmed("Cook's Assistant", 'egg', true));
    expect(result.current.checks).toEqual({ "Cook's Assistant": ['egg'] });
    expect([...result.current.confirmedItemKeys("Cook's Assistant")]).toEqual(['egg']);
  });

  it('ignores unsupported quests, quest-provided items, and unknown keys', () => {
    const storage = memoryStorage();
    const { result } = renderHook(() => useRuneProofPreviewChecks('run-a', storage));

    act(() => {
      result.current.setItemConfirmed('Unknown Quest', 'egg', true);
      result.current.setItemConfirmed("Daddy's Home", 'hammer', true);
      result.current.setItemConfirmed("Cook's Assistant", 'unknown', true);
    });
    expect(result.current.checks).toEqual({});
  });
});
