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
}));
const publishProgress = vi.hoisted(() => vi.fn());

vi.mock('../context/GameContext', () => ({ useGame: () => game }));
vi.mock('../context/ProfileContext', () => ({ useProfiles: () => ({ storageKeyForActiveProfile: 'P' }) }));
vi.mock('../utils/progressShareRecord', () => ({
  PROGRESS_SHARE_EVENT: 'fate:progress-share',
  readProgressShare: () => ({ id: 'AAAAAAAAAAAAAAAAAAAAAA', token: 'T'.repeat(43), enabled: true }),
}));
// The summary shows the areas, so each new area is a new summary.
vi.mock('../utils/progressSnapshot', () => ({
  buildProgressSnapshot: ({ unlocks }: { unlocks: { regions: string[] } }) => ({ areas: unlocks.regions.length }),
}));
vi.mock('../utils/progressShare', () => ({ publishProgress }));

const advance = async (ms: number) => {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
};

describe('ProgressShareDriver', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    game.unlocks = { regions: ['Misthalin'] };
    publishProgress.mockReset();
    publishProgress.mockResolvedValue({ ok: true });
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
});
