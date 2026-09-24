// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StreamOverlay } from './StreamOverlay';

const POLL_MS = 30_000;
const CODE = 'ABCD2345';

/**
 * Answers like the relay Worker: the stored record with its version as the
 * ETag, 304 when If-None-Match matches that version, and 404 once the record
 * has expired.
 */
class FakeRelay {
  record: { version: number; payload: string } | null = null;
  /** The If-None-Match header of each request, in order. */
  sentEtags: (string | null)[] = [];

  publish(version: number, bundle: unknown) {
    this.record = { version, payload: JSON.stringify(bundle) };
  }

  fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    const sent = new Headers(init?.headers).get('If-None-Match');
    this.sentEtags.push(sent);
    if (!this.record) return new Response('{}', { status: 404 });
    const etag = String(this.record.version);
    if (sent === etag) return new Response(null, { status: 304, headers: { ETag: etag } });
    return new Response(JSON.stringify(this.record), { status: 200, headers: { ETag: etag } });
  });
}

const bundle = (keys: number) => ({
  state: { keys, specialKeys: 0, chaosKeys: 0, fatePoints: 1, activeBuff: 'NONE', pinnedGoals: [] },
  unlockedRegions: ['Misthalin'],
});

/** The value shown on the badge with this label. */
const badge = (label: string) => screen.getByText(label).previousElementSibling?.textContent;

const nextPoll = () => act(() => vi.advanceTimersByTimeAsync(POLL_MS));

let relay: FakeRelay;

beforeEach(() => {
  relay = new FakeRelay();
  vi.stubGlobal('fetch', relay.fetch);
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  window.location.hash = `#/overlay?code=${CODE}`;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  window.location.hash = '';
});

describe('StreamOverlay', () => {
  it('forgets the ETag of an expired record, so a republish at that version still shows', async () => {
    relay.publish(2, bundle(3));
    render(<StreamOverlay />);
    await screen.findByText('keys');
    expect(badge('keys')).toBe('3');

    relay.record = null; // the relay record expired
    await nextPoll();
    await screen.findByText(/Nothing is published yet/);

    relay.publish(2, bundle(5)); // a republish that reuses the held version
    await nextPoll();
    await screen.findByText('keys');
    expect(badge('keys')).toBe('5');
    expect(relay.sentEtags.at(-1)).toBeNull();
  });
});
