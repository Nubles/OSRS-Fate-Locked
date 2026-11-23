// @vitest-environment jsdom

// The sharing record lives in per-profile localStorage, so a second tab of the
// same profile changes it under this tab's driver. These cases play that second
// tab with the real record module: the browser writes localStorage and fires a
// StorageEvent in every OTHER tab of the origin.
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProgressShareDriver } from './ProgressShareDriver';
import { profileProgressShareKey } from '../utils/profileStorage';
import { readProgressShare, writeProgressShare } from '../utils/progressShareRecord';

const game = vi.hoisted(() => ({
  unlocks: { regions: ['Misthalin'] } as { regions: string[] },
  history: [],
  gameModeId: 'vanilla',
  customMode: undefined,
  linkedAccount: undefined,
  saveOwnershipStatus: 'owner' as 'owner' | 'blocked' | 'checking',
}));
const accepted = vi.hoisted(() => new Map<string, string>());
const publishProgress = vi.hoisted(() => vi.fn());

vi.mock('../context/GameContext', () => ({ useGame: () => game }));
vi.mock('../context/ProfileContext', () => ({ useProfiles: () => ({ storageKeyForActiveProfile: 'P' }) }));
vi.mock('../utils/progressSnapshot', () => ({
  buildProgressSnapshot: ({ unlocks, publicLog }: { unlocks: { regions: string[] }; publicLog: boolean }) =>
    ({ areas: unlocks.regions.length, publicLog }),
}));
vi.mock('../utils/progressShare', () => ({
  publishProgress,
  replaceRefusedShare: vi.fn(),
  lastAcceptedSummary: (id: string) => accepted.get(id),
}));

const ID = 'AAAAAAAAAAAAAAAAAAAAAA';
const TOKEN = 'T'.repeat(43);
const KEY = profileProgressShareKey('P');
const advance = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };

/** What THIS tab sees when ANOTHER tab of the profile writes the record. */
const otherTabWrites = (record: object | null, { event = true } = {}) => {
  const newValue = record ? JSON.stringify(record) : null;
  if (newValue) localStorage.setItem(KEY, newValue); else localStorage.removeItem(KEY);
  if (event) window.dispatchEvent(new StorageEvent('storage', { key: KEY, newValue, storageArea: localStorage }));
};

describe('ProgressShareDriver and a second tab of the same profile', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    accepted.clear();
    game.unlocks = { regions: ['Misthalin'] };
    game.saveOwnershipStatus = 'owner';
    publishProgress.mockReset();
    publishProgress.mockImplementation(async (_base: string, record: { id: string }, snapshot: unknown) => {
      accepted.set(record.id, JSON.stringify(snapshot));
      return { ok: true };
    });
    localStorage.setItem(KEY, JSON.stringify({ id: ID, token: TOKEN, enabled: true, publicLog: true }));
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  const unlock = async (view: ReturnType<typeof render>, area: string) => {
    game.unlocks = { regions: [...game.unlocks.regions, area] };
    view.rerender(<ProgressShareDriver />);
  };

  it('publishes nothing more after Stop sharing in another tab', async () => {
    const view = render(<ProgressShareDriver />);
    await advance(2_000);
    expect(publishProgress).toHaveBeenCalledTimes(1);

    otherTabWrites({ id: ID, token: TOKEN, enabled: false });
    await unlock(view, 'Asgarnia');
    await advance(10 * 60_000);
    expect(publishProgress).toHaveBeenCalledTimes(1);
  });

  it('publishes the Log as private after Public: off in another tab', async () => {
    const view = render(<ProgressShareDriver />);
    await advance(2_000);
    expect(publishProgress.mock.calls[0][2]).toEqual({ areas: 1, publicLog: true });

    otherTabWrites({ id: ID, token: TOKEN, enabled: true });
    await unlock(view, 'Asgarnia');
    await advance(10 * 60_000);
    expect(publishProgress).toHaveBeenCalledTimes(2);
    expect(publishProgress.mock.calls[1][1]).not.toHaveProperty('publicLog');
    expect(publishProgress.mock.calls[1][2]).toEqual({ areas: 2, publicLog: false });
  });

  it('reads the stored record when it publishes, even if no event reached this tab', async () => {
    const view = render(<ProgressShareDriver />);
    await advance(2_000);
    expect(publishProgress).toHaveBeenCalledTimes(1);

    otherTabWrites({ id: ID, token: TOKEN, enabled: false }, { event: false });
    await unlock(view, 'Asgarnia');
    await advance(10 * 60_000);
    expect(publishProgress).toHaveBeenCalledTimes(1);
  });

  it('publishes again when the other tab turns sharing back on, with no progress in between', async () => {
    render(<ProgressShareDriver />);
    await advance(2_000);
    otherTabWrites({ id: ID, token: TOKEN, enabled: false });
    await advance(60_000);
    otherTabWrites({ id: ID, token: TOKEN, enabled: true, publicLog: true });
    // Within the 3 minutes the driver keeps between publishes.
    for (let i = 0; i < 5; i++) await advance(60_000);
    // The relay dropped the summary at Stop sharing, so the same summary goes out again.
    expect(publishProgress).toHaveBeenCalledTimes(2);
    expect(publishProgress.mock.calls[1][2]).toEqual({ areas: 1, publicLog: true });
  });

  it('never publishes from a tab that does not own the save, even when its settings change', async () => {
    game.saveOwnershipStatus = 'blocked';
    const view = render(<ProgressShareDriver />);
    await advance(2_000);
    expect(publishProgress).not.toHaveBeenCalled();

    // Public: off in this held tab (DiscordSettingsModal writes the record here).
    act(() => writeProgressShare('P', { id: ID, token: TOKEN, enabled: true }));
    await unlock(view, 'Asgarnia');
    await advance(10 * 60_000);
    expect(publishProgress).not.toHaveBeenCalled();
    expect(readProgressShare('P')).toEqual({ id: ID, token: TOKEN, enabled: true });

    // Once it owns the save again (Take over), it publishes what the record says.
    game.saveOwnershipStatus = 'owner';
    view.rerender(<ProgressShareDriver />);
    await advance(2_000);
    expect(publishProgress).toHaveBeenCalledTimes(1);
    expect(publishProgress.mock.calls[0][2]).toEqual({ areas: 2, publicLog: false });
  });
});
