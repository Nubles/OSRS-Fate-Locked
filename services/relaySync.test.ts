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
    service.disable();
    second.reject(new Error('offline'));
    await expect(pushB).resolves.toBe(false);
    expect(service.status).toBe('off');
    expect(service.lastError).toBeNull();
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
