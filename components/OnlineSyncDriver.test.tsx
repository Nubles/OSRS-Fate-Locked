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

// The publish contract: wait for 5 s without changes, but never more than
// 60 s during nonstop changes; pairing and Retry publish at once.
const QUIET_MS = 5_000;
const MAX_WAIT_MS = 60_000;

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const advance = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

describe('OnlineSyncDriver', () => {
  const storage: Record<string, string> = {};
  let fetchMock: ReturnType<typeof vi.fn>;
  const sentPayloads = () => fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body).payload);

  beforeEach(() => {
    vi.useFakeTimers();
    stableGameState.runId = 'run-current';
    stableGameState.runRevision = 9;
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

  it('publishes a new pairing at once, without a run change', async () => {
    const codeA = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const codeB = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    expect(relaySync.adoptCode(codeA)).toBe(true);
    render(<OnlineSyncDriver />);

    await advance(QUIET_MS);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `https://relay.test/r/${codeA}`,
    );

    await act(async () => {
      expect(relaySync.adoptCode(codeB)).toBe(true);
    });
    await advance(0);
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

    await advance(QUIET_MS);
    buildBundlePayloadMock.mockRejectedValueOnce(
      new Error('current build'),
    );
    await act(async () => {
      relaySync.adoptCode(codeB);
      buildA.reject(new Error('stale build'));
      await Promise.resolve();
    });
    await advance(0);
    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'current build' }),
    );
  });

  it('rebuilds current state at once when Retry requests another push', async () => {
    const code = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    relaySync.adoptCode(code);
    render(<OnlineSyncDriver />);
    await advance(QUIET_MS);
    expect(buildBundlePayloadMock).toHaveBeenCalledTimes(1);
    // Relay publishes never go out built from failed rules data.
    expect(buildBundlePayloadMock.mock.calls[0]?.[2]).toEqual({
      requireRulesData: true, retryFailedLoads: false,
    });

    act(() => {
      relaySync.reportPushFailure(new Error('offline'));
      expect(relaySync.requestPush()).toBe(true);
    });
    await advance(0);

    expect(buildBundlePayloadMock).toHaveBeenCalledTimes(2);
    expect(buildBundlePayloadMock.mock.calls[1]?.[1]).toMatchObject({
      runId: 'run-current',
      runRevision: 9,
      linkedAccount: 'Nubles UIM',
      customMode: null,
    });
    // Retry is explicit, so it also skips a failed load's cool-down.
    expect(buildBundlePayloadMock.mock.calls[1]?.[2]).toEqual({
      requireRulesData: true, retryFailedLoads: true,
    });
  });

  it('keeps the last good publish when the rules data fails to load', async () => {
    const report = vi.spyOn(relaySync, 'reportPushFailure');
    buildBundlePayloadMock.mockRejectedValueOnce(new Error(
      "Couldn't load chunk data, so the profile wasn't sent. Check your connection and retry.",
    ));
    relaySync.adoptCode('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    render(<OnlineSyncDriver />);
    await advance(QUIET_MS);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(report).toHaveBeenCalledTimes(1);
    expect(relaySync.status).toBe('error');
    expect(relaySync.lastError).toMatch(/profile wasn't sent/);
  });

  it('coalesces a burst of run changes into one publish of the newest state', async () => {
    relaySync.adoptCode('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    const view = render(<OnlineSyncDriver />);
    await advance(QUIET_MS);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Ten actions two seconds apart, like rolls between reveal animations.
    for (let revision = 10; revision < 20; revision += 1) {
      stableGameState.runRevision = revision;
      view.rerender(<OnlineSyncDriver />);
      await advance(2_000);
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await advance(QUIET_MS);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(buildBundlePayloadMock).toHaveBeenCalledTimes(2);
    expect(buildBundlePayloadMock.mock.calls[1]?.[1]).toMatchObject({ runRevision: 19 });
  });

  it('still publishes once a minute while changes never pause', async () => {
    relaySync.adoptCode('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    const view = render(<OnlineSyncDriver />);
    await advance(QUIET_MS);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // A change every 2 s from t=5 s to t=73 s never leaves 5 s of quiet;
    // the first of them is published by t=65 s regardless.
    for (let step = 1; step <= 35; step += 1) {
      stableGameState.runRevision = 9 + step;
      view.rerender(<OnlineSyncDriver />);
      await advance(2_000);
      if (5_000 + step * 2_000 === QUIET_MS + MAX_WAIT_MS - 2_000) {
        expect(fetchMock).toHaveBeenCalledTimes(1);
      }
    }
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(buildBundlePayloadMock.mock.calls[1]?.[1]).toMatchObject({ runRevision: 39 });

    await advance(QUIET_MS);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(buildBundlePayloadMock.mock.calls[2]?.[1]).toMatchObject({ runRevision: 44 });
  });

  it('keeps one publish in flight, then sends only the newest state', async () => {
    const slow = deferred<{ json: string; compressed: string }>();
    buildBundlePayloadMock.mockReturnValueOnce(slow.promise);
    relaySync.adoptCode('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    const view = render(<OnlineSyncDriver />);
    await advance(QUIET_MS);
    expect(buildBundlePayloadMock).toHaveBeenCalledTimes(1);

    for (const revision of [10, 11, 12]) {
      stableGameState.runRevision = revision;
      view.rerender(<OnlineSyncDriver />);
      await advance(QUIET_MS + 1_000);
    }
    expect(buildBundlePayloadMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      slow.resolve({ json: '{}', compressed: 'revision-9' });
    });
    await advance(0);
    expect(buildBundlePayloadMock).toHaveBeenCalledTimes(2);
    expect(buildBundlePayloadMock.mock.calls[1]?.[1]).toMatchObject({ runRevision: 12 });
    expect(sentPayloads()).toEqual(['revision-9', 'bundle']);
  });

  it('does not publish an old profile build that completes after the new profile', async () => {
    const oldBuild = deferred<{ json: string; compressed: string }>();
    buildBundlePayloadMock.mockReturnValueOnce(oldBuild.promise).mockResolvedValueOnce({ json: '{}', compressed: 'profile-b' });
    relaySync.adoptCode('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    const old = render(<OnlineSyncDriver />);
    await advance(QUIET_MS);
    old.unmount();
    stableGameState.runId = 'run-b';
    render(<OnlineSyncDriver />);
    await advance(QUIET_MS);
    await act(async () => { oldBuild.resolve({ json: '{}', compressed: 'profile-a' }); await Promise.resolve(); });
    expect(sentPayloads()).toEqual(['profile-b']);
  });

  it('serializes an already-sent old profile write before the new profile write', async () => {
    const oldNetwork = deferred<{ ok: boolean }>();
    fetchMock.mockReturnValueOnce(oldNetwork.promise);
    buildBundlePayloadMock.mockResolvedValueOnce({ json: '{}', compressed: 'profile-a' }).mockResolvedValueOnce({ json: '{}', compressed: 'profile-b' });
    relaySync.adoptCode('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    const old = render(<OnlineSyncDriver />);
    await advance(QUIET_MS);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    old.unmount();
    stableGameState.runId = 'run-b';
    render(<OnlineSyncDriver />);
    await advance(QUIET_MS);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => { oldNetwork.resolve({ ok: true }); await Promise.resolve(); });
    expect(sentPayloads()).toEqual(['profile-a', 'profile-b']);
    expect(relaySync.status).toBe('synced');
  });

});
