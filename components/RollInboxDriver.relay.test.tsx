// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  game: {
    runId: 'run-1',
    runRevision: 1,
    linkedAccount: 'Player One' as string | undefined,
    saveOwnershipStatus: 'owner',
  },
}));

vi.mock('../context/GameContext', () => ({
  useGame: () => harness.game,
}));

import RollInboxDriver from './RollInboxDriver';
import { relaySync } from '../services/relaySync';
import { clearRollInboxRuntimeForTest, getRollInboxStore } from '../services/rollInboxRuntime';
import { listenForSentEvents, resetRelayInboxForTest } from '../services/relayInbox';

const NOW = Date.UTC(2026, 9, 19, 12);
const inboxOf = (...ids: string[]) => JSON.stringify({
  format: 'fate-locked-runelite-events',
  events: ids.map((eventId) => ({
    protocolVersion: 1,
    eventId,
    runId: 'run-1',
    account: 'Player One',
    runRevision: 1,
    eventType: 'QUEST',
    canonicalLabel: 'Cook’s Assistant',
    occurredAt: NOW - 60_000,
    sessionSequence: 1,
    bundleVersion: 4,
    rulesVersion: '1',
    contentVersion: 1,
    detectorId: 'quest-state-v1',
    detectorVersion: 1,
    confidence: 'EXACT',
    evidence: {},
  })),
});

let visibility: DocumentVisibilityState = 'visible';
const setVisibility = (next: DocumentVisibilityState) => {
  visibility = next;
  act(() => { document.dispatchEvent(new Event('visibilitychange')); });
};

describe('RollInboxDriver taking what RuneLite sent', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let replies: Array<() => Response>;
  const reads = () => fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/inbox')).length;
  const acks = () => fetchMock.mock.calls
    .filter(([url]) => String(url).endsWith('/inbox/ack'))
    .map(([, init]) => JSON.parse((init as RequestInit).body as string));

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    vi.setSystemTime(NOW);
    localStorage.clear();
    clearRollInboxRuntimeForTest();
    resetRelayInboxForTest();
    harness.game.saveOwnershipStatus = 'owner';
    harness.game.linkedAccount = 'Player One';
    visibility = 'visible';
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
    replies = [];
    fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/ack')) return new Response('{"held":0}');
      const next = replies.shift();
      return next ? next() : new Response(inboxOf());
    });
    vi.stubGlobal('fetch', fetchMock);
    relaySync.enable();
  });

  afterEach(() => {
    cleanup();
    relaySync.disable();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  const mount = async () => {
    const view = render(<RollInboxDriver />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    return view;
  };
  const wait = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

  it('takes what RuneLite sent on start, adds it to the Roll Inbox unrolled, and empties the relay', async () => {
    const heard = vi.fn();
    listenForSentEvents('run-1', heard);
    replies.push(() => new Response(inboxOf('evt-1', 'evt-2')));

    await mount();

    expect(reads()).toBe(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${relaySync.base()}/r/${relaySync.code}/inbox`);
    expect((init as RequestInit).headers).toEqual({ Authorization: `Bearer ${relaySync.token}` });
    expect(getRollInboxStore('run-1').list().map((row) => [row.event.eventId, row.state]))
      .toEqual([['evt-1', 'RECEIVED'], ['evt-2', 'RECEIVED']]);
    expect(acks()).toEqual([{ ids: ['evt-1', 'evt-2'] }]);
    expect(heard).toHaveBeenCalledWith({ added: 2, tooOld: 0, unreadable: 0, characters: [] });
  });

  it('asks again every minute while the tab shows', async () => {
    await mount();
    await wait(59_000);
    expect(reads()).toBe(1);
    await wait(1_000);
    expect(reads()).toBe(2);
    await wait(60_000);
    expect(reads()).toBe(3);
  });

  it('stops while the tab is hidden and asks at once when it shows again, never twice in 10 seconds', async () => {
    await mount();
    setVisibility('hidden');
    await wait(5 * 60_000);
    expect(reads()).toBe(1);

    setVisibility('visible');
    await wait(0);
    expect(reads()).toBe(2);

    setVisibility('hidden');
    setVisibility('visible');
    await wait(9_000);
    expect(reads()).toBe(2);
    await wait(1_000);
    expect(reads()).toBe(3);
  });

  it('backs off after failures: 15 s, then 1 min', async () => {
    replies.push(() => new Response('relay unavailable', { status: 503 }));
    replies.push(() => new Response('relay unavailable', { status: 503 }));
    await mount();
    await wait(14_000);
    expect(reads()).toBe(1);
    await wait(1_000);
    expect(reads()).toBe(2);
    // Showing the tab again doesn't cut the backoff short.
    setVisibility('hidden');
    setVisibility('visible');
    await wait(59_000);
    expect(reads()).toBe(2);
    await wait(1_000);
    expect(reads()).toBe(3);
    // It worked: back to every minute.
    await wait(60_000);
    expect(reads()).toBe(4);
  });

  it('stops quietly until the page reloads when the relay has no Send to tracker yet', async () => {
    replies.push(() => new Response('not found', { status: 404 }));
    const first = await mount();
    await wait(10 * 60_000);
    expect(reads()).toBe(1);

    first.unmount();
    await mount();
    setVisibility('hidden');
    setVisibility('visible');
    await wait(10 * 60_000);
    expect(reads()).toBe(1);
  });

  it('leaves the relay alone in a tab that isn’t saving the run, or once disconnected', async () => {
    harness.game.saveOwnershipStatus = 'blocked';
    const view = await mount();
    await wait(5 * 60_000);
    expect(reads()).toBe(0);

    harness.game.saveOwnershipStatus = 'owner';
    view.rerender(<RollInboxDriver />);
    await wait(0);
    expect(reads()).toBe(1);

    act(() => { relaySync.disable(); });
    await wait(5 * 60_000);
    expect(reads()).toBe(1);
  });
});
