// @vitest-environment jsdom

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { relaySync } from '../services/relaySync';
import { OnlineSyncDriver } from './OnlineSyncDriver';

const stableGameState = vi.hoisted(() => ({
  unlocks: {},
  runId: 'run-current',
  runRevision: 9,
  keys: 3,
  specialKeys: 1,
  chaosKeys: 0,
  fatePoints: 2,
  activeBuff: 'NONE',
  pinnedGoals: [],
  linkedAccount: 'Nubles UIM',
  gameModeId: 'standard',
  customMode: null,
}));

const buildBundlePayloadMock = vi.hoisted(() => vi.fn());

vi.mock('../context/GameContext', () => ({
  useGame: () => stableGameState,
}));

vi.mock('../utils/runeliteExport', () => ({
  buildBundlePayload: buildBundlePayloadMock,
}));

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

describe('OnlineSyncDriver', () => {
  const storage: Record<string, string> = {};
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    for (const key of Object.keys(storage)) delete storage[key];
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => {
        storage[key] = value;
      },
      removeItem: (key: string) => {
        delete storage[key];
      },
    });
    relaySync.disable();
    localStorage.setItem(
      'fate_relay_base', 'https://relay.test',
    );
    buildBundlePayloadMock.mockReset();
    buildBundlePayloadMock.mockResolvedValue({
      json: '{}',
      compressed: 'bundle',
    });
    fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    cleanup();
    relaySync.disable();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('publishes again when pairing is replaced without a run change', async () => {
    const codeA = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const codeB = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    expect(relaySync.adoptCode(codeA)).toBe(true);
    render(<OnlineSyncDriver />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `https://relay.test/r/${codeA}`,
    );

    await act(async () => {
      expect(relaySync.adoptCode(codeB)).toBe(true);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      `https://relay.test/r/${codeB}`,
    );
  });

  it('reports current build failures but ignores stale-code failures', async () => {
    const codeA = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const codeB = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    const buildA = deferred<{ json: string; compressed: string }>();
    buildBundlePayloadMock.mockReturnValueOnce(buildA.promise);
    const report = vi.spyOn(relaySync, 'reportPushFailure');
    relaySync.adoptCode(codeA);
    render(<OnlineSyncDriver />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    await act(async () => {
      relaySync.adoptCode(codeB);
      buildA.reject(new Error('stale build'));
      await Promise.resolve();
    });
    expect(report).not.toHaveBeenCalled();

    buildBundlePayloadMock.mockRejectedValueOnce(
      new Error('current build'),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'current build' }),
    );
  });

  it('rebuilds current state when Retry requests another push', async () => {
    const code = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    relaySync.adoptCode(code);
    render(<OnlineSyncDriver />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(buildBundlePayloadMock).toHaveBeenCalledTimes(1);

    act(() => {
      relaySync.reportPushFailure(new Error('offline'));
      expect(relaySync.requestPush()).toBe(true);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(buildBundlePayloadMock).toHaveBeenCalledTimes(2);
    expect(buildBundlePayloadMock.mock.calls[1]?.[1]).toMatchObject({
      runId: 'run-current',
      runRevision: 9,
      linkedAccount: 'Nubles UIM',
      customMode: null,
    });
  });
});
