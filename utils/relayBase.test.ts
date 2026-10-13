import { afterEach, describe, expect, it, vi } from 'vitest';
import { RelaySyncService } from '../services/relaySync';
import { DEFAULT_RELAY_BASE, parseRelayBase, resolveRelayBase, streamOverlayUrl } from './relayBase';

describe('parseRelayBase', () => {
  it.each([
    ['https://fate-relay.fatelocked.workers.dev', 'https://fate-relay.fatelocked.workers.dev'],
    ['https://relay.example.test/', 'https://relay.example.test'],
    ['https://example.test/fate/relay//', 'https://example.test/fate/relay'],
    ['http://localhost:8787', 'http://localhost:8787'],
    ['http://127.0.0.1:8787/', 'http://127.0.0.1:8787'],
    ['http://[::1]:8787', 'http://[::1]:8787'],
  ])('accepts %s', (raw, expected) => {
    expect(parseRelayBase(raw)).toBe(expected);
  });

  it.each([
    'http://relay.example.test',
    'javascript:alert(1)',
    'data:text/plain,relay',
    'ftp://relay.example.test',
    'https://user:secret@relay.example.test',
    'https://relay.example.test/?next=1',
    'https://relay.example.test/#frag',
    'relay.example.test',
    '',
  ])('refuses %s', (raw) => {
    expect(parseRelayBase(raw)).toBeNull();
  });
});

describe('streamOverlayUrl', () => {
  const app = 'https://nubles.github.io/OSRS-Fate-Locked/';

  it('leaves the public relay out of the URL', () => {
    expect(streamOverlayUrl(app, 'CODE', DEFAULT_RELAY_BASE)).toBe(`${app}#/overlay?code=CODE`);
    expect(streamOverlayUrl(app, 'CODE', `${DEFAULT_RELAY_BASE}/`)).toBe(`${app}#/overlay?code=CODE`);
  });

  it('names any other relay in a form the overlay reads back', () => {
    const url = streamOverlayUrl(app, 'CODE', 'https://relay.example.test/fate&co/');
    const params = new URLSearchParams(url.split('#/overlay?')[1]);

    expect(params.get('code')).toBe('CODE');
    expect(parseRelayBase(params.get('relay')!)).toBe('https://relay.example.test/fate&co');
  });

  it('agrees with the relay the app publishes to by default', () => {
    expect(new RelaySyncService().base()).toBe(DEFAULT_RELAY_BASE);
  });
});

// SEC-1: other pages on nubles.github.io can write this localStorage key, and
// every relay call carries a write token, so production never reads it.
describe('resolveRelayBase', () => {
  it('ignores the localStorage override in production builds', () => {
    expect(resolveRelayBase({ override: 'https://evil.example', dev: false })).toBe(DEFAULT_RELAY_BASE);
    expect(resolveRelayBase({ override: 'https://other.fatelocked.workers.dev', dev: false })).toBe(DEFAULT_RELAY_BASE);
  });

  it('honours a valid override in development, and refuses an unsafe one', () => {
    expect(resolveRelayBase({ override: 'http://localhost:8787/', dev: true })).toBe('http://localhost:8787');
    expect(resolveRelayBase({ override: 'https://relay.test', dev: true })).toBe('https://relay.test');
    expect(resolveRelayBase({ override: 'http://evil.example', dev: true })).toBe(DEFAULT_RELAY_BASE);
    expect(resolveRelayBase({ override: 'javascript:alert(1)', dev: true })).toBe(DEFAULT_RELAY_BASE);
  });

  it('prefers the build-time relay', () => {
    expect(resolveRelayBase({ env: 'https://built.example/', override: 'https://relay.test', dev: true }))
      .toBe('https://built.example');
    expect(resolveRelayBase({ env: 'https://built.example', dev: false })).toBe('https://built.example');
  });
});

describe('RelaySyncService.base', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    try { localStorage.removeItem('fate_relay_base'); } catch { /* no storage here */ }
  });

  it('never sends relay calls to a localStorage override in a production build', () => {
    const store = new Map<string, string>([['fate_relay_base', 'https://evil.example']]);
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); },
      removeItem: (key: string) => { store.delete(key); },
    });
    try {
      vi.stubEnv('DEV', false);
      expect(new RelaySyncService().base()).toBe(DEFAULT_RELAY_BASE);
      vi.stubEnv('DEV', true);
      expect(new RelaySyncService().base()).toBe('https://evil.example');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
