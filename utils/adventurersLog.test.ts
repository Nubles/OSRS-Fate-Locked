import { afterEach, describe, expect, it, vi } from 'vitest';
import { initialState } from '../context/GameContext';
import type { UnlockState } from '../types';
import { publicProgress, validProgressSnapshot } from '../workers/fate-relay/progress.js';
import { buildProgressSnapshot } from './progressSnapshot';
import { fetchAdventurersLog, parseAdventurersLog, sinceText } from './adventurersLog';

const RUN = 'AAAAAAAAAAAAAAAAAAAAAA';
const unlocks: UnlockState = { ...structuredClone(initialState.unlocks), regions: ['Falador'] };
const published = (publicLog: boolean) => JSON.stringify(validProgressSnapshot(JSON.parse(JSON.stringify(
  buildProgressSnapshot({
    unlocks,
    history: [{ id: 'u', type: 'UNLOCK', message: 'Unlocked Varrock', timestamp: 5_000, meta: { category: 'Regions' } }],
    gameModeId: 'vanilla',
    linkedAccount: 'Whim',
    publicLog,
  }),
))));

afterEach(() => { vi.unstubAllGlobals(); });

describe('the Adventurer\'s Log', () => {
  it('reads a public summary as the relay serves it, map included', () => {
    const log = parseAdventurersLog({ snapshot: publicProgress(published(true)), updatedAt: 9_000 });
    expect(log).toMatchObject({
      mode: 'Vanilla',
      account: 'Whim',
      recent: [{ text: 'Unlocked Varrock (Areas)', at: 5_000 }],
      updatedAt: 9_000,
    });
    expect(log!.map!.size).toBe(log!.chunks.unlocked);
    expect(log!.map!.size).toBeGreaterThan(0);
  });

  it('shows nothing for a summary that is not public, or not a summary', () => {
    expect(publicProgress(published(false))).toBeNull();
    expect(parseAdventurersLog({ snapshot: JSON.parse(published(false)) })).toBeNull();
    expect(parseAdventurersLog({ snapshot: { v: 1, public: true } })).toBeNull();
    expect(parseAdventurersLog(null)).toBeNull();
  });

  it('fetches by run id and tells a private or missing log from a failure', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await fetchAdventurersLog('https://relay.test', RUN)).toEqual({ kind: 'missing' });
    expect(fetchMock).toHaveBeenCalledWith(`https://relay.test/p/${RUN}`);
    expect(await fetchAdventurersLog('https://relay.test', '../r/x')).toEqual({ kind: 'missing' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockImplementation(async () => new Response('down', { status: 503 }));
    expect(await fetchAdventurersLog('https://relay.test', RUN)).toEqual({ kind: 'error' });
    fetchMock.mockImplementation(async () => Response.json({ snapshot: publicProgress(published(true)), updatedAt: 1 }));
    expect((await fetchAdventurersLog('https://relay.test', RUN)).kind).toBe('found');
  });

  it('says how long ago in words', () => {
    const now = Date.UTC(2026, 9, 26, 12);
    expect(sinceText(now - 10_000, now)).toBe('just now');
    expect(sinceText(now - 60_000, now)).toBe('1 minute ago');
    expect(sinceText(now - 5 * 3_600_000, now)).toBe('5 hours ago');
    expect(sinceText(now - 3 * 86_400_000, now)).toBe('3 days ago');
    expect(sinceText(now - 90 * 86_400_000, now)).toMatch(/2026/);
  });
});
