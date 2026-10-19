import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FateEventEnvelope } from './fateEventProtocol';
import { createRollInboxStore } from './rollInboxStore';
import {
  announceSentEvents,
  listenForSentEvents,
  resetRelayInboxForTest,
  takeSentEvents,
} from './relayInbox';

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const BASE = 'https://relay.test';
const CODE = '0123456789abcdef0123456789abcdef';
const TOKEN = 'a1'.repeat(18);

const event = (eventId: string, overrides: Partial<FateEventEnvelope> = {}): FateEventEnvelope => ({
  protocolVersion: 1,
  eventId,
  runId: 'run-1',
  account: 'Player One',
  runRevision: 1,
  eventType: 'QUEST',
  canonicalLabel: 'Cook’s Assistant',
  occurredAt: Date.now() - 60_000,
  sessionSequence: 1,
  bundleVersion: 4,
  rulesVersion: '1',
  contentVersion: 1,
  detectorId: 'quest-state-v1',
  detectorVersion: 1,
  confidence: 'EXACT',
  evidence: {},
  ...overrides,
});
const inbox = (events: unknown[]) => JSON.stringify({ format: 'fate-locked-runelite-events', events });

describe('takeSentEvents', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let store: ReturnType<typeof createRollInboxStore>;
  const take = (linkedAccount: string | null = 'Player One') =>
    takeSentEvents({ base: BASE, code: CODE, token: TOKEN, store, linkedAccount });
  const requests = () => fetchMock.mock.calls.map(([url, init]) => ({
    url,
    method: (init as RequestInit).method ?? 'GET',
    auth: ((init as RequestInit).headers as Record<string, string>).Authorization,
    body: (init as RequestInit).body ? JSON.parse((init as RequestInit).body as string) : undefined,
  }));
  const reply = (status: number, body: string) => new Response(body, { status });

  beforeEach(() => {
    store = createRollInboxStore(new MemoryStorage(), 'run-1');
    fetchMock = vi.fn(async (url: string) => (url.endsWith('/ack')
      ? reply(200, '{"held":0}')
      : reply(200, inbox([]))));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('adds what RuneLite sent to the Roll Inbox as a paste does, then empties the relay', async () => {
    store.ingest([event('evt-1')]);
    const tooOld = event('evt-old', { occurredAt: Date.now() - 31 * 86_400_000 });
    const unreadable = { eventId: 'evt-bad', occurredAt: Date.now() };
    fetchMock.mockImplementationOnce(async () => reply(200, inbox([event('evt-1'), event('evt-2'), event('evt-3'), tooOld, unreadable])));

    expect(await take()).toEqual({ kind: 'taken', sent: { added: 2, tooOld: 1, unreadable: 1, characters: [] } });

    expect(store.list().map((row) => [row.event.eventId, row.state]))
      .toEqual([['evt-1', 'RECEIVED'], ['evt-2', 'RECEIVED'], ['evt-3', 'RECEIVED']]);
    // Every id it read, those already here and those it couldn't use too, so the relay empties.
    expect(requests()).toEqual([
      { url: `${BASE}/r/${CODE}/inbox`, method: 'GET', auth: `Bearer ${TOKEN}`, body: undefined },
      {
        url: `${BASE}/r/${CODE}/inbox/ack`,
        method: 'POST',
        auth: `Bearer ${TOKEN}`,
        body: { ids: ['evt-1', 'evt-2', 'evt-3', 'evt-old', 'evt-bad'] },
      },
    ]);
  });

  it('names whose events a run linked to no one took', async () => {
    fetchMock.mockImplementationOnce(async () => reply(200, inbox([
      event('evt-1', { account: 'Player Two' }),
      event('evt-2', { account: 'Player One' }),
    ])));
    expect(await take(null)).toEqual({
      kind: 'taken',
      sent: { added: 2, tooOld: 0, unreadable: 0, characters: ['Player Two', 'Player One'] },
    });
  });

  it('says nothing is new when every event was already here, and sends no acknowledgement for an empty inbox', async () => {
    store.ingest([event('evt-1')]);
    fetchMock.mockImplementationOnce(async () => reply(200, inbox([event('evt-1')])));
    expect(await take()).toEqual({ kind: 'taken', sent: null });
    expect(requests()).toHaveLength(2);

    fetchMock.mockClear();
    expect(await take()).toEqual({ kind: 'taken', sent: null });
    expect(requests()).toHaveLength(1);
  });

  it('keeps what it added when the acknowledgement fails', async () => {
    fetchMock
      .mockImplementationOnce(async () => reply(200, inbox([event('evt-1')])))
      .mockImplementationOnce(async () => { throw new TypeError('Failed to fetch'); });
    expect(await take()).toEqual({ kind: 'taken', sent: { added: 1, tooOld: 0, unreadable: 0, characters: [] } });
    expect(store.list()).toHaveLength(1);
  });

  it('reads an old relay’s 404 as no Send to tracker, and a missing profile as a failure to retry', async () => {
    fetchMock.mockImplementationOnce(async () => reply(404, 'not found'));
    expect(await take()).toEqual({ kind: 'unsupported' });
    fetchMock.mockImplementationOnce(async () => reply(404, '{"error":"no profile"}'));
    expect(await take()).toEqual({ kind: 'failed' });
  });

  it('stops for a refused token, and retries a busy or failing relay, the network or a reply it can’t read', async () => {
    fetchMock.mockImplementationOnce(async () => reply(403, 'forbidden'));
    expect(await take()).toEqual({ kind: 'refused' });
    for (const failure of [
      async () => reply(429, 'too many requests'),
      async () => reply(503, 'relay unavailable'),
      async () => { throw new TypeError('Failed to fetch'); },
      async () => reply(200, '<html>captive portal</html>'),
    ]) {
      fetchMock.mockImplementationOnce(failure);
      expect(await take()).toEqual({ kind: 'failed' });
    }
    expect(store.list()).toEqual([]);
  });

  it('gives up on a request that stalls', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementationOnce(() => new Promise(() => {}));
    const outcome = take();
    await vi.advanceTimersByTimeAsync(15_000);
    expect(await outcome).toEqual({ kind: 'failed' });
  });
});

describe('telling the Roll Inbox what arrived', () => {
  afterEach(() => resetRelayInboxForTest());
  const sent = (added: number, characters: string[] = []) => ({ added, tooOld: 0, unreadable: 0, characters });

  it('tells an open inbox at once', () => {
    const heard = vi.fn();
    const stop = listenForSentEvents('run-1', heard);
    announceSentEvents('run-1', sent(2));
    announceSentEvents('run-2', sent(5));
    expect(heard.mock.calls).toEqual([[sent(2)]]);
    stop();
    announceSentEvents('run-1', sent(1));
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it('keeps what arrived while no inbox was open, as one line, for the next one to open', () => {
    announceSentEvents('run-1', sent(2, ['Player One']));
    announceSentEvents('run-1', sent(1, ['Player Two']));
    const heard = vi.fn();
    listenForSentEvents('run-1', heard);
    expect(heard.mock.calls).toEqual([[sent(3, ['Player One', 'Player Two'])]]);

    const later = vi.fn();
    listenForSentEvents('run-1', later);
    expect(later).not.toHaveBeenCalled();
  });
});
