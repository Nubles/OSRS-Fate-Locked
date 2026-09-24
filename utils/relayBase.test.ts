import { describe, expect, it } from 'vitest';
import { RelaySyncService } from '../services/relaySync';
import { DEFAULT_RELAY_BASE, parseRelayBase, streamOverlayUrl } from './relayBase';

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
