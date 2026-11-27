// @vitest-environment jsdom

// The public Adventurer's Log switch, end to end: the real settings, the real
// ProgressShareDriver, the real publishProgress and the real relay worker on an
// in-memory KV. The relay stores at most one summary a minute (429 otherwise).
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../workers/fate-relay/worker.js';
import { ProgressShareDriver } from './ProgressShareDriver';
import { DiscordSettingsModal } from './DiscordSettingsModal';
import { profileProgressShareKey } from '../utils/profileStorage';
import { readProgressShare } from '../utils/progressShareRecord';
import '../utils/progressShare';
import '../utils/progressSnapshot';

const game = vi.hoisted(() => ({
  unlocks: {}, history: [], gameModeId: 'vanilla', customMode: undefined, linkedAccount: 'Some Name',
  saveOwnershipStatus: 'owner' as 'owner' | 'blocked' | 'checking',
}));
const toasts = vi.hoisted(() => [] as string[]);
vi.mock('../context/GameContext', () => ({ useGame: () => game }));
vi.mock('../context/ProfileContext', () => ({ useProfiles: () => ({ storageKeyForActiveProfile: 'P' }) }));
vi.mock('../hooks/useEscapeKey', () => ({ useEscapeKey: () => undefined }));
vi.mock('../hooks/useFocusTrap', () => ({ useFocusTrap: () => undefined }));
vi.mock('../services/relaySync', () => ({ relaySync: { base: () => 'https://relay.test' } }));
vi.mock('../utils/toast', () => ({ showToast: (message: string) => { toasts.push(message); } }));
vi.mock('../utils/progressSnapshot', () => ({
  buildProgressSnapshot: ({ publicLog }: { publicLog: boolean }) => ({
    v: 1, mode: 'Vanilla', modeId: 'vanilla', account: 'Some Name',
    areas: { unit: 'areas', unlocked: 2, total: 30 }, chunks: { unlocked: 0, total: 0 },
    quests: { done: 1, total: 200 }, diaryTasks: { done: 0, total: 10 }, ca: { points: 0, tier: null },
    recent: [{ text: 'Unlocked Misthalin', at: 1_700_000_000_000 }],
    ...(publicLog ? { public: true } : {}),
  }),
}));

class MemoryKv {
  records = new Map<string, string>();
  metadata = new Map<string, unknown>();
  async get(key: string, options?: { type?: string }) {
    const value = this.records.get(key);
    if (value === undefined) return null;
    return options?.type === 'json' ? JSON.parse(value) : value;
  }
  async getWithMetadata(key: string) {
    const value = this.records.get(key);
    return value === undefined ? { value: null, metadata: null } : { value, metadata: this.metadata.get(key) ?? null };
  }
  async put(key: string, value: string, options?: { metadata?: unknown }) {
    this.records.set(key, value);
    if (options?.metadata !== undefined) this.metadata.set(key, options.metadata);
  }
  async delete(key: string) { this.records.delete(key); this.metadata.delete(key); }
}

const ID = 'AAAAAAAAAAAAAAAAAAAAAA';
const TOKEN = 'T'.repeat(43);
const START = Date.parse('2026-11-23T12:00:00Z');
const realSetTimeout = globalThis.setTimeout;
/** Let real async work (dynamic imports, the worker's crypto) finish without moving the fake clock. */
const settle = async () => { for (let i = 0; i < 5; i++) await act(async () => { await new Promise(r => realSetTimeout(r, 10)); }); };
const advance = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); await settle(); };
const click = async (name: string) => {
  await act(async () => { fireEvent.click(screen.getByRole('button', { name })); });
  for (let i = 0; i < 10; i++) await advance(100);
};

describe('the public Adventurer\'s Log switch', () => {
  let kv: MemoryKv;
  let posts: string[];
  const publicRead = async () => {
    const response = await worker.fetch(new Request(`https://relay.test/p/${ID}`), { RELAY: kv }, { waitUntil: () => {} });
    return { status: response.status, body: await response.text() };
  };

  beforeEach(() => {
    vi.useFakeTimers({ now: START });
    localStorage.clear();
    toasts.length = 0;
    posts = [];
    game.saveOwnershipStatus = 'owner';
    kv = new MemoryKv();
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      const pub = request.method === 'POST' ? JSON.parse(await request.clone().text()).public === true : null;
      const response: Response = await worker.fetch(request, { RELAY: kv }, { waitUntil: () => {} });
      if (request.method === 'POST' && new URL(request.url).pathname === `/p/${ID}`) {
        posts.push(`${Math.round((Date.now() - START) / 1000)}s public=${pub} -> ${response.status}`);
      }
      return response;
    });
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

  const open = async (record: object) => {
    localStorage.setItem(profileProgressShareKey('P'), JSON.stringify(record));
    render(<><ProgressShareDriver /><DiscordSettingsModal onClose={() => undefined} /></>);
    for (let i = 0; i < 10; i++) await advance(300); // the driver's first publish, 2 s after load
  };

  it('ends private on the relay after on and off within a minute, and only says private once it is', async () => {
    await open({ id: ID, token: TOKEN, enabled: true });
    expect(posts).toEqual(['2s public=false -> 200']);
    await advance(5 * 60_000);

    await click('Public: off');
    await advance(20_000); // the player changes their mind 20 s later
    await click('Public: on');
    expect(toasts).toEqual([
      'Your Adventurer\'s Log is public',
      'Your Adventurer\'s Log goes private within a few minutes',
    ]);
    expect(posts.at(-1)).toMatch(/public=false -> 429$/);

    await advance(4 * 60_000);
    expect(posts.at(-1)).toMatch(/public=false -> 200$/);
    expect((await publicRead()).status).toBe(404);
    expect(screen.getByRole('button', { name: /^Public:/ }).textContent).toBe('Public: off');
  }, 30_000);

  it('ends public on the relay after off and on within a minute', async () => {
    await open({ id: ID, token: TOKEN, enabled: true, publicLog: true });
    expect(posts).toEqual(['2s public=true -> 200']);
    await advance(5 * 60_000);

    await click('Public: on');
    await advance(20_000);
    await click('Public: off');
    expect(toasts).toEqual([
      'Your Adventurer\'s Log is private again',
      'Your Adventurer\'s Log goes public within a few minutes',
    ]);

    await advance(4 * 60_000);
    const read = await publicRead();
    expect(read.status).toBe(200);
    expect(JSON.parse(read.body).snapshot.public).toBe(true);
  }, 30_000);

  it('does not publish from a tab that does not own the save: the record waits for the owner tab', async () => {
    game.saveOwnershipStatus = 'blocked';
    await open({ id: ID, token: TOKEN, enabled: true });
    await click('Public: off');
    await advance(10 * 60_000);

    expect(posts).toEqual([]);
    expect(readProgressShare('P')).toEqual({ id: ID, token: TOKEN, enabled: true, publicLog: true });
    expect(toasts).toEqual(['Saved. It goes to the relay from the tab that is saving your progress.']);

    // Asking for a link code here does not publish this tab's progress either.
    await click('Get a link code');
    expect(posts).toEqual([]);
  }, 30_000);
});
