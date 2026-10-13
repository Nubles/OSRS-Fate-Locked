// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const DEFAULT_BASE = 'https://fate-relay.fatelocked.workers.dev';
/** Let the reporter's dynamic import and its send run. */
const flush = async () => {
  await vi.dynamicImportSettled();
  await new Promise((resolve) => setTimeout(resolve, 0));
};

type Beacon = typeof import('./errorBeacon');

/** A fresh copy of the beacon and its reporter, so limits and dedupe start over. */
async function loadBeacon(production: boolean): Promise<Beacon> {
  vi.resetModules();
  vi.unstubAllEnvs();
  // Imported as in tests, so its own install on import adds no listener that
  // outlives the test; installErrorBeacon() below installs and uninstalls.
  const beacon = await import('./errorBeacon');
  if (production) {
    vi.stubEnv('PROD', true);
    vi.stubEnv('DEV', false);
    vi.stubEnv('MODE', 'production');
  }
  return beacon;
}

let sendBeacon: ReturnType<typeof vi.fn>;
let fetchMock: ReturnType<typeof vi.fn>;
const sentBodies = () => sendBeacon.mock.calls.map(([, body]) => JSON.parse(body as string));

// Vitest turns a dispatched ErrorEvent nobody listens to into a failure.
const swallow = (event: ErrorEvent) => event.preventDefault();

beforeEach(() => {
  window.addEventListener('error', swallow);
  localStorage.clear();
  sessionStorage.clear();
  sendBeacon = vi.fn(() => true);
  fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
  Object.defineProperty(navigator, 'sendBeacon', { value: sendBeacon, configurable: true, writable: true });
  vi.stubGlobal('fetch', fetchMock);
  history.replaceState(null, '', '/OSRS-Fate-Locked/');
});

afterEach(() => {
  window.removeEventListener('error', swallow);
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('error beacon', () => {
  it('sends nothing in dev or tests', async () => {
    const { reportError, installErrorBeacon } = await loadBeacon(false);
    const uninstall = installErrorBeacon();
    reportError('boundary', new Error('boom'));
    window.dispatchEvent(new ErrorEvent('error', { error: new Error('uncaught'), message: 'uncaught' }));
    await flush();
    uninstall();
    expect(sendBeacon).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts build, kind, message, stack and path to the relay', async () => {
    const { reportError } = await loadBeacon(true);
    const error = new Error('boom');
    reportError('panel', error);
    await flush();

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(sendBeacon.mock.calls[0][0]).toBe(`${DEFAULT_BASE}/e`);
    expect(sentBodies()[0]).toEqual({
      build: __BUILD_ID__,
      kind: 'panel',
      message: 'Error: boom',
      stack: expect.stringContaining('boom'),
      path: '/OSRS-Fate-Locked/',
    });
  });

  it('uses the relay the rest of the app publishes to, ignoring the dev override in production', async () => {
    localStorage.setItem('fate_relay_base', 'http://localhost:8787/');
    const { reportError } = await loadBeacon(true);
    reportError('boundary', new Error('boom'));
    await flush();
    expect(sendBeacon.mock.calls[0][0]).toBe(`${DEFAULT_BASE}/e`);
  });

  it('never sends the query or hash, which can carry a pairing code', async () => {
    history.replaceState(null, '', '/OSRS-Fate-Locked/?open=runelite-guide#/overlay?code=ABCD2345');
    const { reportError } = await loadBeacon(true);
    const error = new Error('Failed at https://nubles.github.io/OSRS-Fate-Locked/?sync=SECRETCODE#pair=ABCD2345');
    error.stack = `${error.message}\n    at https://nubles.github.io/OSRS-Fate-Locked/#/overlay?code=ABCD2345:12:3`;
    reportError('boundary', error);
    await flush();

    const body = sendBeacon.mock.calls[0][1] as string;
    expect(sentBodies()[0].path).toBe('/OSRS-Fate-Locked/');
    expect(body).not.toContain('ABCD2345');
    expect(body).not.toContain('SECRETCODE');
    expect(body).not.toContain('runelite-guide');
    expect(sentBodies()[0].message).toBe('Error: Failed at https://nubles.github.io/OSRS-Fate-Locked/');
  });

  it('blanks double-quoted text, where JSON.parse quotes its input', async () => {
    const { reportError } = await loadBeacon(true);
    let parseError: unknown;
    try {
      JSON.parse('{"rsn":"Zezima", oops}');
    } catch (error) {
      parseError = error;
    }
    reportError('error', parseError);
    await flush();
    expect(sendBeacon.mock.calls[0][1]).not.toContain('Zezima');
  });

  it('sends at most 5 reports per page load', async () => {
    const { reportError } = await loadBeacon(true);
    for (let i = 0; i < 8; i++) reportError('error', new Error(`boom ${i}`));
    await flush();
    expect(sendBeacon).toHaveBeenCalledTimes(5);
  });

  it('sends an identical message and stack once', async () => {
    const { reportError } = await loadBeacon(true);
    const error = new Error('same');
    reportError('boundary', error);
    reportError('error', error);
    reportError('rejection', error);
    await flush();
    expect(sendBeacon).toHaveBeenCalledTimes(1);
  });

  it('keeps the stack to 4 KB and the body under 8 KB', async () => {
    const { reportError } = await loadBeacon(true);
    const error = new Error('x'.repeat(5000));
    error.stack = 'é'.repeat(20000);
    reportError('boundary', error);
    await flush();
    const body = sendBeacon.mock.calls[0][1] as string;
    expect(sentBodies()[0].stack.length).toBeLessThanOrEqual(4000);
    expect(sentBodies()[0].message.length).toBeLessThanOrEqual(1000);
    expect(new Blob([body]).size).toBeLessThanOrEqual(8000);
  });

  it('falls back to a keepalive fetch when sendBeacon refuses or is missing', async () => {
    sendBeacon.mockReturnValue(false);
    let beacon = await loadBeacon(true);
    beacon.reportError('boundary', new Error('queued'));
    await flush();
    expect(fetchMock).toHaveBeenCalledWith(`${DEFAULT_BASE}/e`, expect.objectContaining({ method: 'POST', keepalive: true }));

    Object.defineProperty(navigator, 'sendBeacon', { value: undefined, configurable: true, writable: true });
    beacon = await loadBeacon(true);
    beacon.reportError('boundary', new Error('no beacon'));
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('never throws, even when sending does', async () => {
    sendBeacon.mockImplementation(() => { throw new Error('blocked'); });
    fetchMock.mockImplementation(() => { throw new Error('offline'); });
    const { reportError } = await loadBeacon(true);
    expect(() => reportError('boundary', new Error('boom'))).not.toThrow();
    expect(() => reportError('rejection', { weird: true })).not.toThrow();
    await flush();
  });

  it('leaves stale-deploy chunk errors to the reload, unless the reload just happened', async () => {
    const { reportError } = await loadBeacon(true);
    const chunkError = new TypeError('Failed to fetch dynamically imported module: https://x/assets/Map-abc.js');
    reportError('panel', chunkError);
    await flush();
    expect(sendBeacon).not.toHaveBeenCalled();

    sessionStorage.setItem('fate_chunk_reload_at', String(Date.now()));
    reportError('panel', chunkError);
    await flush();
    expect(sendBeacon).toHaveBeenCalledTimes(1);
  });

  it('reports uncaught errors and unhandled rejections, but not opaque "Script error."', async () => {
    const { installErrorBeacon } = await loadBeacon(true);
    const uninstall = installErrorBeacon();
    window.dispatchEvent(new ErrorEvent('error', { error: new Error('uncaught'), message: 'uncaught' }));
    window.dispatchEvent(new ErrorEvent('error', { message: 'Script error.' }));
    const rejection = new Event('unhandledrejection') as PromiseRejectionEvent;
    Object.defineProperty(rejection, 'reason', { value: new Error('rejected') });
    window.dispatchEvent(rejection);
    await flush();
    uninstall();

    expect(sentBodies().map(({ kind, message }) => [kind, message])).toEqual([
      ['error', 'Error: uncaught'],
      ['rejection', 'Error: rejected'],
    ]);
  });
});
