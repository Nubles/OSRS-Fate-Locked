// @vitest-environment jsdom

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { relaySync } from '../services/relaySync';
import {
  NOT_SAVING_PUBLISH_MESSAGE, OnlineSyncDriver, PUBLISH_MAX_WAIT_MS, PUBLISH_QUIET_MS,
} from './OnlineSyncDriver';
import { RELAY_REPUBLISH_UNCHANGED_MS } from '../utils/relayPublishFingerprint';

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
  bossStandardKeysAwarded: { Brutus: 1 },
  saveOwnershipStatus: 'owner' as 'checking' | 'owner' | 'blocked',
}));

const buildBundlePayloadMock = vi.hoisted(() => vi.fn());
const RunChangedError = vi.hoisted(() => class RunChangedError extends Error {});

vi.mock('../context/GameContext', () => ({
  useGame: () => stableGameState,
}));

vi.mock('../utils/runeliteExport', () => ({
  buildBundlePayload: buildBundlePayloadMock,
  RunChangedError,
}));

// The publish contract: wait for 15 s without changes, but never more than
// 2 minutes during nonstop changes; pairing and Retry publish at once.
const QUIET_MS = PUBLISH_QUIET_MS;
const MAX_WAIT_MS = PUBLISH_MAX_WAIT_MS;

it('waits 15 s of quiet, and at most 2 minutes, before a publish', () => {
  expect(QUIET_MS).toBe(15_000);
  expect(MAX_WAIT_MS).toBe(120_000);
});

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
    stableGameState.saveOwnershipStatus = 'owner';
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
    relaySync.setActiveProfile(null);
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sends the Keys each boss has given, so RuneLite knows which bosses are spent", async () => {
    expect(relaySync.adoptCode('cccccccccccccccccccccccccccccccc')).toBe(true);
    render(<OnlineSyncDriver />);
    await advance(QUIET_MS);
    expect(buildBundlePayloadMock.mock.calls[0]?.[1]).toMatchObject({ bossStandardKeysAwarded: { Brutus: 1 } });
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

  it('sends the run again when a profile switch overlapped its build', async () => {
    buildBundlePayloadMock.mockRejectedValueOnce(new RunChangedError('run changed'));
    const report = vi.spyOn(relaySync, 'reportPushFailure');
    relaySync.adoptCode('cccccccccccccccccccccccccccccccc');
    render(<OnlineSyncDriver />);

    await advance(QUIET_MS);
    expect(buildBundlePayloadMock).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();

    // No further change arrives: the refusal itself schedules the retry.
    await advance(QUIET_MS);
    expect(buildBundlePayloadMock).toHaveBeenCalledTimes(2);
    expect(sentPayloads()).toEqual(['bundle']);
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

  it('sends a waiting publish at once when the player leaves the tab', async () => {
    relaySync.adoptCode('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    const view = render(<OnlineSyncDriver />);
    await advance(QUIET_MS);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    stableGameState.runRevision = 10;
    view.rerender(<OnlineSyncDriver />);
    await advance(1_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await advance(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(buildBundlePayloadMock.mock.calls[1]?.[1]).toMatchObject({ runRevision: 10 });

    // Nothing is waiting any more, so hiding again sends nothing new.
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await advance(QUIET_MS);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    visibility.mockRestore();
  });

  it('still publishes every 2 minutes while changes never pause', async () => {
    relaySync.adoptCode('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    const view = render(<OnlineSyncDriver />);
    await advance(QUIET_MS);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // A change every 2 s from t=15 s never leaves 15 s of quiet; the first
    // of them is published 2 minutes after it regardless.
    const steps = MAX_WAIT_MS / 2_000;
    for (let step = 1; step <= steps + 5; step += 1) {
      stableGameState.runRevision = 9 + step;
      view.rerender(<OnlineSyncDriver />);
      await advance(2_000);
      if (step === steps - 1) expect(fetchMock).toHaveBeenCalledTimes(1);
    }
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(buildBundlePayloadMock.mock.calls[1]?.[1]).toMatchObject({ runRevision: 9 + steps });

    await advance(QUIET_MS);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(buildBundlePayloadMock.mock.calls[2]?.[1]).toMatchObject({ runRevision: 9 + steps + 5 });
  });

  describe('an unchanged profile', () => {
    const CODE = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const built = (fingerprint: string, compressed = `bundle-${fingerprint}`) => ({ json: '{}', compressed, fingerprint });
    const change = async (view: ReturnType<typeof render>, revision: number) => {
      stableGameState.runRevision = revision;
      view.rerender(<OnlineSyncDriver />);
      await advance(QUIET_MS);
    };

    it('is not sent again: only a change RuneLite would see is', async () => {
      buildBundlePayloadMock.mockResolvedValueOnce(built('A'))
        .mockResolvedValueOnce(built('A'))
        .mockResolvedValueOnce(built('A'))
        .mockResolvedValueOnce(built('B'));
      relaySync.adoptCode(CODE);
      const view = render(<OnlineSyncDriver />);
      await advance(QUIET_MS);
      expect(sentPayloads()).toEqual(['bundle-A']);

      // A note or a ticked task: a new revision, the same profile.
      await change(view, 10);
      await change(view, 11);
      expect(buildBundlePayloadMock).toHaveBeenCalledTimes(3);
      expect(sentPayloads()).toEqual(['bundle-A']);
      expect(relaySync.status).toBe('synced');

      await change(view, 12);
      expect(sentPayloads()).toEqual(['bundle-A', 'bundle-B']);
      expect(JSON.parse(storage.fate_relay_published_v1)).toMatchObject({ code: CODE, fingerprint: 'B', runRevision: 12 });
    });

    it('is not sent after a reload, and the status shows the earlier publish', async () => {
      buildBundlePayloadMock.mockResolvedValue(built('A'));
      relaySync.adoptCode(CODE);
      const first = render(<OnlineSyncDriver />);
      await advance(QUIET_MS);
      const sentAt = relaySync.lastSyncAt;
      expect(fetchMock).toHaveBeenCalledTimes(1);
      first.unmount();

      // A reload: the pairing is read back, nothing has been sent from this page yet.
      relaySync.status = 'off';
      relaySync.lastSyncAt = null;
      render(<OnlineSyncDriver />);
      await advance(QUIET_MS);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(relaySync.status).toBe('synced');
      expect(relaySync.lastSyncAt).toBe(sentAt);
    });

    it('is sent again every six hours, so the relay copy never gets old', async () => {
      buildBundlePayloadMock.mockResolvedValue(built('A'));
      relaySync.adoptCode(CODE);
      const view = render(<OnlineSyncDriver />);
      await advance(QUIET_MS);
      await advance(RELAY_REPUBLISH_UNCHANGED_MS - QUIET_MS - 1_000);
      await change(view, 10);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      await advance(1_000);
      await change(view, 11);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('is sent on Retry and on pairing again, whatever the relay holds', async () => {
      buildBundlePayloadMock.mockResolvedValue(built('A'));
      relaySync.adoptCode(CODE);
      render(<OnlineSyncDriver />);
      await advance(QUIET_MS);
      act(() => { relaySync.requestPush(); });
      await advance(0);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      await act(async () => { relaySync.adoptCode('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'); });
      await advance(0);
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('is sent when the run went back to an earlier revision (a restored save)', async () => {
      buildBundlePayloadMock.mockResolvedValue(built('A'));
      relaySync.adoptCode(CODE);
      const view = render(<OnlineSyncDriver />);
      await advance(QUIET_MS);
      await change(view, 5);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('is sent after a failed publish, and Disconnect forgets what was sent', async () => {
      buildBundlePayloadMock.mockResolvedValue(built('A'));
      fetchMock.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false, status: 503 });
      buildBundlePayloadMock.mockResolvedValueOnce(built('A')).mockResolvedValueOnce(built('B'));
      relaySync.adoptCode(CODE);
      const view = render(<OnlineSyncDriver />);
      await advance(QUIET_MS);
      await change(view, 10);
      expect(relaySync.status).toBe('error');
      // Back to A, which the relay holds, but a publish failed since: send it
      // (here the 15 s retry sends it, built from the run as it is now).
      stableGameState.runRevision = 11;
      view.rerender(<OnlineSyncDriver />);
      await advance(QUIET_MS + 2);
      expect(sentPayloads()).toEqual(['bundle-A', 'bundle-B', 'bundle-A']);
      expect(storage.fate_relay_published_v1).toBeDefined();
      await act(async () => { await relaySync.disconnect(); });
      expect(storage.fate_relay_published_v1).toBeUndefined();
    });

    it('is always sent when the browser could not fingerprint it', async () => {
      buildBundlePayloadMock.mockResolvedValue({ json: '{}', compressed: 'bundle', fingerprint: null });
      relaySync.adoptCode(CODE);
      const view = render(<OnlineSyncDriver />);
      await advance(QUIET_MS);
      await change(view, 10);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
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

  it('does not publish from a tab showing another profile than the paired one', async () => {
    relaySync.setActiveProfile('alt');
    relaySync.adoptCode('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'main');
    const view = render(<OnlineSyncDriver />);
    await advance(QUIET_MS);
    stableGameState.runRevision = 10;
    view.rerender(<OnlineSyncDriver />);
    await advance(MAX_WAIT_MS);

    expect(buildBundlePayloadMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('publishes only from the tab saving this profile, and once it takes over', async () => {
    stableGameState.saveOwnershipStatus = 'blocked';
    relaySync.adoptCode('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    const view = render(<OnlineSyncDriver />);
    await advance(QUIET_MS);
    stableGameState.runRevision = 10;
    view.rerender(<OnlineSyncDriver />);
    await advance(MAX_WAIT_MS);
    expect(buildBundlePayloadMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();

    // Keeping this tab's progress makes it the saving tab, which publishes.
    stableGameState.saveOwnershipStatus = 'owner';
    view.rerender(<OnlineSyncDriver />);
    await advance(QUIET_MS);
    expect(buildBundlePayloadMock).toHaveBeenCalledTimes(1);
    expect(buildBundlePayloadMock.mock.calls[0]?.[1]).toMatchObject({ runRevision: 10 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("says why a tab that isn't saving doesn't publish, also on Retry", async () => {
    stableGameState.saveOwnershipStatus = 'blocked';
    const report = vi.spyOn(relaySync, 'reportPushFailure');
    relaySync.adoptCode('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    render(<OnlineSyncDriver />);
    await advance(QUIET_MS);

    expect(relaySync.status).toBe('error');
    expect(relaySync.lastError).toBe(NOT_SAVING_PUBLISH_MESSAGE);
    expect(report).toHaveBeenCalledTimes(1);

    act(() => {
      expect(relaySync.requestPush()).toBe(true);
    });
    await advance(0);
    expect(relaySync.lastError).toBe(NOT_SAVING_PUBLISH_MESSAGE);
    expect(report).toHaveBeenCalledTimes(2);
    expect(buildBundlePayloadMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('waits while the save lease is still being checked', async () => {
    stableGameState.saveOwnershipStatus = 'checking';
    const report = vi.spyOn(relaySync, 'reportPushFailure');
    relaySync.adoptCode('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    const view = render(<OnlineSyncDriver />);
    await advance(QUIET_MS);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(report).not.toHaveBeenCalled();

    stableGameState.saveOwnershipStatus = 'owner';
    view.rerender(<OnlineSyncDriver />);
    await advance(QUIET_MS);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('stops publishing when another tab disconnects', async () => {
    relaySync.adoptCode('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    const view = render(<OnlineSyncDriver />);
    await advance(QUIET_MS);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      localStorage.removeItem('fate_relay_session_v1');
      window.dispatchEvent(new StorageEvent('storage', { key: 'fate_relay_session_v1' }));
    });
    expect(relaySync.enabled).toBe(false);
    stableGameState.runRevision = 10;
    view.rerender(<OnlineSyncDriver />);
    await advance(MAX_WAIT_MS);
    expect(fetchMock).toHaveBeenCalledTimes(1);
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
    // Send the new profile at once, while the old write is still on its way
    // (it would time out after 15 s, as long as the quiet period).
    act(() => { relaySync.requestPush(); });
    await advance(0);
    expect(buildBundlePayloadMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => { oldNetwork.resolve({ ok: true }); await Promise.resolve(); });
    expect(sentPayloads()).toEqual(['profile-a', 'profile-b']);
    expect(relaySync.status).toBe('synced');
  });

  describe('after a failed publish', () => {
    const failing = (status: number) => ({ ok: false, status });

    it('tries again by itself after 15 s, 1 min, then every 5 min, and starts over once one works', async () => {
      fetchMock.mockResolvedValueOnce(failing(503))
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce(failing(429))
        .mockResolvedValueOnce(failing(502));
      relaySync.adoptCode('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
      render(<OnlineSyncDriver />);
      await advance(QUIET_MS);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(relaySync.status).toBe('error');
      expect(relaySync.retryAt).toBe(Date.now() + 15_000);

      await advance(14_999);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      // The retry publishes on the next tick (fake timers run a 0 ms timeout 1 ms later).
      await advance(2);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      await advance(59_990);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      await advance(12);
      expect(fetchMock).toHaveBeenCalledTimes(3);
      await advance(299_990);
      expect(fetchMock).toHaveBeenCalledTimes(3);
      await advance(12);
      expect(fetchMock).toHaveBeenCalledTimes(4);
      expect(relaySync.failures).toBe(4);
      await advance(300_002);
      expect(fetchMock).toHaveBeenCalledTimes(5);
      expect(relaySync.status).toBe('synced');
      expect(relaySync.failures).toBe(0);
      expect(relaySync.retryAt).toBeNull();

      // Working again: nothing more is sent until the run changes.
      await advance(30 * 60_000);
      expect(fetchMock).toHaveBeenCalledTimes(5);
      // Each retry rebuilds the current run, skipping a failed load's cool-down.
      expect(buildBundlePayloadMock.mock.calls[1]?.[2]).toEqual({ requireRulesData: true, retryFailedLoads: true });
    });

    it("doesn't try again when the relay refused the pairing", async () => {
      fetchMock.mockResolvedValueOnce(failing(403));
      relaySync.adoptCode('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
      render(<OnlineSyncDriver />);
      await advance(QUIET_MS);
      expect(relaySync.status).toBe('error');
      expect(relaySync.retryable).toBe(false);
      expect(relaySync.retryAt).toBeNull();
      await advance(30 * 60_000);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('tries a failed rules-data load again', async () => {
      buildBundlePayloadMock.mockRejectedValueOnce(new Error(
        "Couldn't load chunk data, so the profile wasn't sent. Check your connection and retry.",
      ));
      relaySync.adoptCode('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
      render(<OnlineSyncDriver />);
      await advance(QUIET_MS);
      expect(fetchMock).not.toHaveBeenCalled();
      await advance(15_001);
      expect(buildBundlePayloadMock.mock.calls[1]?.[2]).toEqual({ requireRulesData: true, retryFailedLoads: true });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(relaySync.status).toBe('synced');
    });

    it('lets a run change send first, replacing the scheduled retry', async () => {
      fetchMock.mockResolvedValueOnce(failing(503)).mockResolvedValueOnce(failing(503));
      relaySync.adoptCode('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
      const view = render(<OnlineSyncDriver />);
      await advance(QUIET_MS);
      // The 15 s retry fails too; the next is due a minute later.
      await advance(15_002);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(relaySync.retryAt! - Date.now()).toBeGreaterThan(55_000);
      stableGameState.runRevision = 10;
      view.rerender(<OnlineSyncDriver />);
      await advance(QUIET_MS);
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(relaySync.status).toBe('synced');
      await advance(60_000);
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it("doesn't try again in a tab that isn't saving the profile", async () => {
      stableGameState.saveOwnershipStatus = 'blocked';
      relaySync.adoptCode('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
      render(<OnlineSyncDriver />);
      await advance(QUIET_MS);
      expect(relaySync.retryable).toBe(false);
      expect(relaySync.retryAt).toBeNull();
      await advance(10 * 60_000);
      expect(buildBundlePayloadMock).not.toHaveBeenCalled();
    });
  });
});
