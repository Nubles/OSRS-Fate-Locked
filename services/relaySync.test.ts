import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// @ts-expect-error Node types are intentionally excluded from the browser app.
import { readFileSync } from 'node:fs';

const SESSION_KEY = 'fate_relay_session_v1';

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

describe('RelaySyncService', () => {
  const storage: Record<string, string> = {};
  let tokenByte = 7;
  let setItem: ReturnType<typeof vi.fn>;
  let removeItem: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    for (const key of Object.keys(storage)) delete storage[key];
    tokenByte = 7;
    setItem = vi.fn((key: string, value: string) => {
      storage[key] = value;
    });
    removeItem = vi.fn((key: string) => {
      delete storage[key];
    });
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage[key] ?? null,
      setItem,
      removeItem,
    });
    vi.stubGlobal('crypto', {
      getRandomValues: (values: Uint8Array) => {
        values.fill(tokenByte++);
        return values;
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('atomically adopts and replaces strict RuneLite sessions', async () => {
    const { RelaySyncService } = await import('./relaySync');
    const service = new RelaySyncService();
    const listener = vi.fn();
    service.subscribe(listener);

    expect(service.adoptCode('invalid')).toBe(false);
    expect(service.enabled).toBe(false);
    expect(service.pushRequestRevision).toBe(0);
    expect(listener).not.toHaveBeenCalled();

    const firstCode = '0123456789abcdef0123456789abcdef';
    expect(service.adoptCode(firstCode)).toBe(true);
    expect(service.code).toBe(firstCode);
    expect(service.status).toBe('syncing');
    expect(service.lastError).toBeNull();
    expect(service.lastSyncAt).toBeNull();
    expect(service.pushRequestRevision).toBe(1);
    expect(JSON.parse(storage[SESSION_KEY])).toEqual({
      code: firstCode,
      token: '070707070707070707070707070707070707',
    });

    const secondCode = 'fedcba9876543210fedcba9876543210';
    expect(service.adoptCode(secondCode)).toBe(true);
    expect(service.pushRequestRevision).toBe(2);
    expect(JSON.parse(storage[SESSION_KEY])).toEqual({
      code: secondCode,
      token: '080808080808080808080808080808080808',
    });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('retains the previous session when adoption cannot be persisted', async () => {
    const { RelaySyncService } = await import('./relaySync');
    const service = new RelaySyncService();
    const firstCode = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    expect(service.adoptCode(firstCode)).toBe(true);
    const revision = service.pushRequestRevision;

    setItem.mockImplementationOnce(() => {
      throw new Error('storage blocked');
    });

    expect(service.adoptCode('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'))
      .toBe(false);
    expect(service.code).toBe(firstCode);
    expect(service.pushRequestRevision).toBe(revision);
    expect(JSON.parse(storage[SESSION_KEY]).code).toBe(firstCode);
  });

  it('uses a revision signal for retry and reports current build failures', async () => {
    const { RelaySyncService } = await import('./relaySync');
    const service = new RelaySyncService();
    const listener = vi.fn();
    service.subscribe(listener);

    expect(service.requestPush()).toBe(false);
    expect(listener).not.toHaveBeenCalled();

    expect(service.adoptCode('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'))
      .toBe(true);
    service.reportPushFailure(new Error('bundle failed'));
    expect(service.status).toBe('error');
    expect(service.lastError).toBe('bundle failed');
    const revision = service.pushRequestRevision;
    listener.mockClear();

    expect(service.requestPush()).toBe(true);
    expect(service.status).toBe('syncing');
    expect(service.lastError).toBeNull();
    expect(service.pushRequestRevision).toBe(revision + 1);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('ignores a completed POST after replacement or disable', async () => {
    const { RelaySyncService } = await import('./relaySync');
    const service = new RelaySyncService();
    localStorage.setItem('fate_relay_base', 'https://relay.test');
    const first = deferred<{ ok: boolean }>();
    const second = deferred<{ ok: boolean }>();
    const fetchMock = vi.fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    vi.stubGlobal('fetch', fetchMock);

    const codeA = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const codeB = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    service.adoptCode(codeA);
    const pushA = service.push('bundle-a');
    await Promise.resolve();
    const firstBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(fetchMock.mock.calls[0][0]).toBe(
      `https://relay.test/r/${codeA}`,
    );
    expect(firstBody.token).toBe(
      '070707070707070707070707070707070707',
    );

    service.adoptCode(codeB);
    first.resolve({ ok: true });
    await expect(pushA).resolves.toBe(false);
    expect(service.code).toBe(codeB);
    expect(service.status).toBe('syncing');
    expect(service.lastSyncAt).toBeNull();

    const pushB = service.push('bundle-b');
    await Promise.resolve();
    service.disable();
    second.reject(new Error('offline'));
    await expect(pushB).resolves.toBe(false);
    expect(service.status).toBe('off');
    expect(service.lastError).toBeNull();
  });

  it('times out a stalled POST as a failed publish and lets the queue continue', async () => {
    vi.useFakeTimers();
    try {
      const { RelaySyncService } = await import('./relaySync');
      const service = new RelaySyncService();
      localStorage.setItem('fate_relay_base', 'https://relay.test');
      const fetchMock = vi.fn()
        .mockReturnValueOnce(new Promise(() => {}))
        .mockResolvedValueOnce({ ok: true });
      vi.stubGlobal('fetch', fetchMock);
      service.adoptCode('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
      const seen: string[] = [];
      service.subscribe(() => seen.push(`${service.status}:${service.lastError ?? ''}`));

      const stalled = service.push('bundle-a');
      const queued = service.push('bundle-b');
      await vi.advanceTimersByTimeAsync(14_999);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(service.status).toBe('syncing');

      await vi.advanceTimersByTimeAsync(1);
      expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
      await expect(stalled).resolves.toBe(false);
      await expect(queued).resolves.toBe(true);
      expect(seen).toContain('error:relay timed out');
      expect(JSON.parse(fetchMock.mock.calls[1][1].body).payload).toBe('bundle-b');
      expect(service.status).toBe('synced');
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps legacy enable and disable compatibility', async () => {
    const { RelaySyncService } = await import('./relaySync');
    const service = new RelaySyncService();

    const code = service.enable();
    expect(code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{8}$/);
    expect(service.enabled).toBe(true);
    expect(storage[SESSION_KEY]).toBeTruthy();

    service.disable();
    expect(service.enabled).toBe(false);
    expect(service.status).toBe('off');
    expect(removeItem).toHaveBeenCalledWith(SESSION_KEY);
  });

  describe('shared by tabs that each show their own profile', () => {
    const CODE = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    let tabs: EventTarget;
    let fetchMock: ReturnType<typeof vi.fn>;
    // Every service below shares one window. A browser fires `storage` only
    // in the other tabs, but each tab re-reads the stored session, so the
    // writing tab ignores its own change.
    const storageEvent = () => tabs.dispatchEvent(
      Object.assign(new Event('storage'), { key: SESSION_KEY }),
    );
    const openTab = async (profileId: string) => {
      const { RelaySyncService } = await import('./relaySync');
      const tab = new RelaySyncService();
      tab.setActiveProfile(profileId);
      return tab;
    };
    const sent = () => fetchMock.mock.calls.map(
      ([url, init]) => [url, JSON.parse(init.body).payload],
    );

    beforeEach(() => {
      tabs = new EventTarget();
      vi.stubGlobal('window', tabs);
      localStorage.setItem('fate_relay_base', 'https://relay.test');
      fetchMock = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', fetchMock);
    });

    it('publishes only from a tab showing the paired profile', async () => {
      const main = await openTab('main');
      expect(main.adoptCode(CODE, 'main')).toBe(true);
      // A second tab, opened on another profile after the pairing.
      const alt = await openTab('alt');

      await expect(alt.push('alt-profile')).resolves.toBe(false);
      await expect(main.push('main-profile')).resolves.toBe(true);
      expect(sent()).toEqual([[`https://relay.test/r/${CODE}`, 'main-profile']]);
      expect(alt.enabled).toBe(false);
      expect(alt.code).toBeNull();
      expect(alt.requestPush()).toBe(false);
      expect(JSON.parse(storage[SESSION_KEY]).profileId).toBe('main');
    });

    it('picks up pairing and Disconnect from another tab', async () => {
      const first = await openTab('main');
      const second = await openTab('main');
      const listener = vi.fn();
      second.subscribe(listener);

      first.adoptCode(CODE, 'main');
      storageEvent();
      expect(second.code).toBe(CODE);
      expect(second.status).toBe('syncing');
      expect(listener).toHaveBeenCalledTimes(1);

      await expect(second.push('second-tab')).resolves.toBe(true);
      first.disable();
      storageEvent();
      expect(second.enabled).toBe(false);
      expect(second.status).toBe('off');
      await expect(second.push('after-disconnect')).resolves.toBe(false);
      expect(sent()).toEqual([[`https://relay.test/r/${CODE}`, 'second-tab']]);
    });

    it('binds a pairing saved without a profile to the first tab that publishes', async () => {
      storage[SESSION_KEY] = JSON.stringify({ code: CODE, token: 'legacy-token' });
      const main = await openTab('main');
      const alt = await openTab('alt');
      expect(main.enabled).toBe(true);
      expect(alt.enabled).toBe(true);

      await expect(main.push('main-profile')).resolves.toBe(true);
      expect(JSON.parse(storage[SESSION_KEY])).toEqual({
        code: CODE, token: 'legacy-token', profileId: 'main',
      });
      // Alt publishes before its storage event arrives: it finds the binding
      // instead of overwriting it.
      await expect(alt.push('alt-profile')).resolves.toBe(false);
      expect(alt.enabled).toBe(false);
      expect(JSON.parse(storage[SESSION_KEY]).profileId).toBe('main');
      expect(sent()).toEqual([[`https://relay.test/r/${CODE}`, 'main-profile']]);
    });
  });
});

describe('current RuneLite connection source boundary', () => {
  it('contains no plugin heartbeat read or connected claim', () => {
    const service = readFileSync('services/relaySync.ts', 'utf8');
    const onboarding = readFileSync(
      'components/RuneLiteOnboarding.tsx', 'utf8',
    );
    expect(service).not.toContain('/state');
    expect(service).not.toContain('fetchPluginState');
    expect(onboarding).not.toContain('Plugin connected');
  });
});
