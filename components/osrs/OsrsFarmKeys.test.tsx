/* @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { DropSource } from '../../types';
import { MINIGAMES_LIST } from '../../constants';
import { vanillaMinigameKeyStage } from '../../config/vanillaKeyEconomy';

const rollForKey = vi.fn();
const game: { current: Record<string, unknown> } = { current: {} };

vi.mock('../../context/GameContext', async () => {
  const actual = await vi.importActual<typeof import('../../context/GameContext')>('../../context/GameContext');
  return { ...actual, useGame: () => game.current };
});
vi.mock('../../services/WikiService', () => ({
  wikiService: { getImage: vi.fn(() => Promise.resolve(null)), getCachedImage: vi.fn(() => null) },
}));

const [open, spent] = MINIGAMES_LIST;
const cardFor = (name: string) => document.querySelector(`.okf-card[data-examine-name="${name}"]`) as HTMLElement;

describe('OSRS Farm Keys in Vanilla', () => {
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  beforeEach(async () => {
    vi.useRealTimers();
    rollForKey.mockReset();
    const { initialState } = await vi.importActual<typeof import('../../context/GameContext')>('../../context/GameContext');
    game.current = {
      ...initialState,
      gameModeId: 'vanilla',
      unlocks: { ...initialState.unlocks, minigames: [open, spent] },
      minigameStandardKeysAwarded: { [spent]: vanillaMinigameKeyStage(spent, 0).cap },
      history: [],
      rollForKey,
      claimPet: vi.fn(),
    };
    const { setFarmTab } = await import('./OsrsKeysState');
    setFarmTab('ACTIVITIES');
  });

  it('rolls each unlocked minigame from its own Key stash, like the classic cards', async () => {
    const { OsrsFarmKeys } = await import('./OsrsFarmKeys');
    render(<OsrsFarmKeys wide />);

    const stage = vanillaMinigameKeyStage(open, 0);
    const card = cardFor(open);
    expect(within(card).getByText(`Minigame · stash ${stage.cap} Key${stage.cap === 1 ? '' : 's'}`)).toBeTruthy();
    // No generic "every finished game" activity cards in Vanilla.
    expect(screen.queryByText(/Every finished game rolls/)).toBeNull();

    vi.useFakeTimers();
    fireEvent.click(within(card).getByRole('button', { name: 'Roll' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(700); });
    expect(rollForKey).toHaveBeenCalledWith(
      DropSource.ACTIVITY_MINIGAME, stage.currentRate, expect.any(Number), expect.any(Number), expect.any(Number),
      undefined, { kind: 'minigame', minigameName: open },
    );
  });

  it('stops an empty stash from rolling', async () => {
    const { OsrsFarmKeys } = await import('./OsrsFarmKeys');
    render(<OsrsFarmKeys wide />);
    const card = cardFor(spent);
    const btn = within(card).getByRole('button', { name: 'Spent' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(within(card).getByText('Stash empty: games no longer roll')).toBeTruthy();
  });
});
