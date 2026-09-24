// @vitest-environment jsdom
import React from 'react';
// @ts-expect-error Node types are intentionally excluded from the browser app.
import { gzipSync } from 'node:zlib';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StreamOverlay, inflate, toState } from './StreamOverlay';

const icon = vi.hoisted(() => ({ fail: false }));
vi.mock('./WikiIcon', () => ({
  WikiIcon: () => {
    if (icon.fail) throw new Error('icon failed to render');
    return null;
  },
}));

// jsdom's Blob has no stream(); browsers' does.
if (!('stream' in Blob.prototype)) {
  Object.defineProperty(Blob.prototype, 'stream', {
    configurable: true,
    value(this: Blob) {
      const blob = this;
      return new ReadableStream<Uint8Array>({
        async start(controller) {
          controller.enqueue(new Uint8Array(await blob.arrayBuffer()));
          controller.close();
        },
      });
    },
  });
}

const POLL_MS = 30_000;
const CODE = 'ABCD2345';

/**
 * Answers like the relay Worker: the stored record with its version as the
 * ETag, 304 when If-None-Match matches that version, and 404 once the record
 * has expired.
 */
class FakeRelay {
  record: { version: number; payload: string } | null = null;
  /** Cut the next 200 response short, like a dropped connection. */
  truncateNext = false;
  /** The If-None-Match header of each request, in order. */
  sentEtags: (string | null)[] = [];

  publish(version: number, payload: string) {
    this.record = { version, payload };
  }

  fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    const sent = new Headers(init?.headers).get('If-None-Match');
    this.sentEtags.push(sent);
    if (!this.record) return new Response('{}', { status: 404 });
    const etag = String(this.record.version);
    if (sent === etag) return new Response(null, { status: 304, headers: { ETag: etag } });
    const body = JSON.stringify(this.record);
    const truncated = this.truncateNext;
    this.truncateNext = false;
    return new Response(truncated ? body.slice(0, 20) : body, { status: 200, headers: { ETag: etag } });
  });
}

const bundle = (keys: number, unlockedRegions = ['Misthalin']) => ({
  state: { keys, specialKeys: 0, chaosKeys: 0, fatePoints: 1, activeBuff: 'NONE', pinnedGoals: [] },
  unlockedRegions,
});
const json = (value: unknown) => JSON.stringify(value);
const flgz = (text: string) => `FLGZ:${gzipSync(text).toString('base64')}`;

/** The value shown on the badge with this label. */
const badge = (label: string) => screen.getByText(label).previousElementSibling?.textContent;

const nextPoll = () => act(() => vi.advanceTimersByTimeAsync(POLL_MS));

let relay: FakeRelay;

beforeEach(() => {
  relay = new FakeRelay();
  icon.fail = false;
  vi.stubGlobal('fetch', relay.fetch);
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  window.location.hash = `#/overlay?code=${CODE}`;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.location.hash = '';
});

describe('StreamOverlay', () => {
  it('forgets the ETag of an expired record, so a republish at that version still shows', async () => {
    relay.publish(2, json(bundle(3)));
    render(<StreamOverlay />);
    await screen.findByText('keys');
    expect(badge('keys')).toBe('3');

    relay.record = null; // the relay record expired
    await nextPoll();
    await screen.findByText(/Nothing is published yet/);

    relay.publish(2, json(bundle(5))); // a republish that reuses the held version
    await nextPoll();
    await screen.findByText('keys');
    expect(badge('keys')).toBe('5');
    expect(relay.sentEtags.at(-1)).toBeNull();
  });

  it('keeps the last good frame when a field has the wrong type', async () => {
    relay.publish(1, json(bundle(3)));
    render(<StreamOverlay />);
    await screen.findByText('keys');

    relay.publish(2, json({ ...bundle(3), state: { ...bundle(3).state, keys: {} } }));
    await nextPoll();
    relay.publish(3, json(bundle(4)));
    await nextPoll();

    await vi.waitFor(() => expect(badge('keys')).toBe('4'));
    // The rejected version was never cached: the next request still sent 1.
    expect(relay.sentEtags).toEqual([null, '1', '1']);
  });

  it('fetches a version again when its response failed to parse', async () => {
    relay.publish(7, json(bundle(3)));
    relay.truncateNext = true;
    render(<StreamOverlay />);
    await vi.waitFor(() => expect(relay.sentEtags).toHaveLength(1));
    expect(screen.getByText('Connecting to the run…')).toBeTruthy();

    await nextPoll();
    await screen.findByText('keys');
    expect(badge('keys')).toBe('3');
    expect(relay.sentEtags).toEqual([null, null]);
  });

  it('shows a notice instead of going blank when the badges fail to render, then recovers', async () => {
    // React reports the caught error; keep jsdom and the console quiet.
    const quiet = (event: ErrorEvent) => event.preventDefault();
    window.addEventListener('error', quiet);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      relay.publish(1, json(bundle(3)));
      render(<StreamOverlay />);
      await screen.findByText('keys');

      icon.fail = true; // the NEW UNLOCK pop's icon throws
      relay.publish(2, json(bundle(3, ['Misthalin', 'Asgarnia'])));
      await nextPoll();
      await screen.findByText(/couldn't show the latest update/);

      icon.fail = false;
      relay.publish(3, json(bundle(4, ['Misthalin', 'Asgarnia', 'Kandarin'])));
      await nextPoll();
      await screen.findByText('keys');
      expect(badge('keys')).toBe('4');
    } finally {
      window.removeEventListener('error', quiet);
    }
  });

  it('shows a compressed bundle', async () => {
    relay.publish(1, flgz(json(bundle(6))));
    render(<StreamOverlay />);
    await screen.findByText('keys');
    expect(badge('keys')).toBe('6');
  });

  it('polls the public relay unless the URL names another', async () => {
    relay.publish(1, json(bundle(3)));
    render(<StreamOverlay />);
    await screen.findByText('keys');
    expect(relay.fetch.mock.calls[0][0])
      .toBe(`https://fate-relay.fatelocked.workers.dev/r/${CODE}`);

    cleanup();
    window.location.hash = `#/overlay?code=${CODE}&relay=${encodeURIComponent('https://relay.example.test/')}`;
    render(<StreamOverlay />);
    await vi.waitFor(() => expect(relay.fetch).toHaveBeenCalledTimes(2));
    expect(relay.fetch.mock.calls[1][0]).toBe(`https://relay.example.test/r/${CODE}`);
  });

  it.each([
    'http://relay.example.test',
    'javascript:alert(1)',
    'https://user:secret@relay.example.test',
  ])('refuses to poll the relay address %s', async (address) => {
    window.location.hash = `#/overlay?code=${CODE}&relay=${encodeURIComponent(address)}`;
    render(<StreamOverlay />);

    expect(screen.getByText(/relay address in this overlay URL/)).toBeTruthy();
    await nextPoll();
    expect(relay.fetch).not.toHaveBeenCalled();
  });
});

describe('StreamOverlay payload checks', () => {
  it('inflates a compressed bundle', async () => {
    await expect(inflate(flgz(json(bundle(6))))).resolves.toEqual(bundle(6));
  });

  it('refuses a payload that inflates past the size cap', async () => {
    // Valid JSON behind 9 MiB of whitespace: a few KiB compressed.
    const bomb = flgz(' '.repeat(9 * 1024 * 1024) + json(bundle(9)));
    expect(bomb.length).toBeLessThan(64 * 1024);
    await expect(inflate(bomb)).rejects.toThrow('relay payload is too large');
  });

  it('reads a well-formed bundle, treating absent fields as empty', () => {
    expect(toState(bundle(3))?.state).toMatchObject({ keys: 3, fatePoints: 1, territory: 1 });
    expect(toState({})?.state).toMatchObject({ keys: 0, territory: 0, goal: undefined });
    expect(toState({ state: { pinnedGoals: ['Fire cape'] }, unlockedChunks: ['50,50'] })?.state)
      .toMatchObject({ goal: 'Fire cape', territory: 1, territoryLabel: 'chunks' });
  });

  it.each([
    ['a non-object bundle', 'bundle'],
    ['a non-object state', { state: [] }],
    ['an object count', { state: { keys: {} } }],
    ['a string count', { state: { fatePoints: '5' } }],
    ['a non-string buff', { state: { activeBuff: { name: 'x' } } }],
    ['a non-string goal', { state: { pinnedGoals: [{ title: 'x' }] } }],
    ['a non-array goal list', { state: { pinnedGoals: 'Fire cape' } }],
    ['a non-string area', { unlockedRegions: [{}] }],
    ['a non-string chunk', { unlockedChunks: [[50, 50]] }],
  ])('rejects %s', (_case, value) => {
    expect(toState(value)).toBeNull();
  });
});
