// @vitest-environment jsdom

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PROGRESS_MIN_GAP_MS, PROGRESS_SETTLE_MS, ProgressShareDriver } from './ProgressShareDriver';

const game = vi.hoisted(() => ({
  unlocks: { regions: ['Misthalin'] } as { regions: string[] },
  history: [],
  gameModeId: 'vanilla',
  customMode: undefined,
  linkedAccount: undefined,
  saveOwnershipStatus: 'owner',
}));
const publishProgress = vi.hoisted(() => vi.fn());
const replaceRefusedShare = vi.hoisted(() => vi.fn());
/** The stored record, and the summaries the relay accepted (utils/progressShare.ts keeps those). */
const stored = vi.hoisted(() => ({ record: null as null | { id: string; token: string; enabled: boolean } }));
const accepted = vi.hoisted(() => new Map<string, string>());

vi.mock('../context/GameContext', () => ({ useGame: () => game }));
vi.mock('../context/ProfileContext', () => ({ useProfiles: () => ({ storageKeyForActiveProfile: 'P' }) }));
vi.mock('../utils/progressShareRecord', () => ({
  PROGRESS_SHARE_EVENT: 'fate:progress-share',
  readProgressShare: () => stored.record,
}));
// The summary shows the areas, so each new area is a new summary.
vi.mock('../utils/progressSnapshot', () => ({
  buildProgressSnapshot: ({ unlocks }: { unlocks: { regions: string[] } }) => ({ areas: unlocks.regions.length }),
}));
vi.mock('../utils/progressShare', () => ({
  publishProgress, replaceRefusedShare, lastAcceptedSummary: (id: string) => accepted.get(id),
}));

const advance = async (ms: number) => {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
};

describe('ProgressShareDriver', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    game.unlocks = { regions: ['Misthalin'] };
    stored.record = { id: 'AAAAAAAAAAAAAAAAAAAAAA', token: 'T'.repeat(43), enabled: true };
    accepted.clear();
    publishProgress.mockReset();
    publishProgress.mockImplementation(async (_base: string, record: { id: string }, snapshot: unknown) => {
      accepted.set(record.id, JSON.stringify(snapshot));
      return { ok: true };
    });
    replaceRefusedShare.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  const unlock = async (view: ReturnType<typeof render>, area: string) => {
    game.unlocks = { regions: [...game.unlocks.regions, area] };
    view.rerender(<ProgressShareDriver />);
  };

  it('waits a minute after changes, and sends a run of unlocks as one publish at most every 3 minutes', async () => {
    expect(PROGRESS_SETTLE_MS).toBe(60_000);
    expect(PROGRESS_MIN_GAP_MS).toBe(180_000);
    const view = render(<ProgressShareDriver />);
    // The first publish after loading goes out quickly, so a link code can be asked for.
    await advance(2_000);
    expect(publishProgress).toHaveBeenCalledTimes(1);

    // Three unlocks 20 s apart, then quiet.
    for (const area of ['Asgarnia', 'Kandarin', 'Morytania']) {
      await unlock(view, area);
      await advance(20_000);
    }
    // Together, 3 minutes after the first publish (they settled a minute before that).
    await advance(PROGRESS_MIN_GAP_MS - 2_000 - 60_000 - 1_000);
    expect(publishProgress).toHaveBeenCalledTimes(1);
    await advance(PROGRESS_SETTLE_MS);
    expect(publishProgress).toHaveBeenCalledTimes(2);
    expect(publishProgress.mock.calls[1][2]).toEqual({ areas: 4 });

    // An unchanged summary is not sent again.
    view.rerender(<ProgressShareDriver />);
    await advance(PROGRESS_MIN_GAP_MS * 2);
    expect(publishProgress).toHaveBeenCalledTimes(2);
  });

  it('moves a run whose id another token holds to a new id once, and never loops on refusals', async () => {
    const moved = { id: 'BBBBBBBBBBBBBBBBBBBBBB', token: 'U'.repeat(43), enabled: true };
    publishProgress.mockResolvedValue({ ok: false, error: 'forbidden' });
    // replaceRefusedShare stores the new record and returns it.
    replaceRefusedShare.mockImplementationOnce(() => { stored.record = moved; return moved; }).mockReturnValue(null);
    render(<ProgressShareDriver />);
    await advance(2_000);
    expect(replaceRefusedShare).toHaveBeenCalledTimes(1);
    expect(replaceRefusedShare.mock.calls[0]).toEqual(['P', { id: 'AAAAAAAAAAAAAAAAAAAAAA', token: 'T'.repeat(43), enabled: true }]);

    // The new id is published; the relay refuses it as well, and nothing more is tried.
    await advance(PROGRESS_MIN_GAP_MS);
    expect(publishProgress.mock.calls.map(([, sent]) => sent.id)).toEqual(['AAAAAAAAAAAAAAAAAAAAAA', moved.id]);
    expect(replaceRefusedShare).toHaveBeenCalledTimes(2);
    await advance(PROGRESS_MIN_GAP_MS * 5);
    expect(publishProgress).toHaveBeenCalledTimes(2);
    expect(replaceRefusedShare).toHaveBeenCalledTimes(2);
  });
});
