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

describe('OSRS Farm Keys cards on a narrow screen', () => {
  afterEach(() => { cleanup(); });

  beforeEach(async () => {
    const { initialState } = await vi.importActual<typeof import('../../context/GameContext')>('../../context/GameContext');
    game.current = {
      ...initialState,
      gameModeId: 'vanilla',
      unlocks: { ...initialState.unlocks, minigames: [open] },
      history: [],
      rollForKey,
      claimPet: vi.fn(),
    };
    const { setFarmTab } = await import('./OsrsKeysState');
    setFarmTab('SLAYER');
  });

  it('names the most columns and leaves the count to the stylesheet', async () => {
    const { OsrsFarmKeys } = await import('./OsrsFarmKeys');
    render(<OsrsFarmKeys wide />);
    const grid = document.querySelector('.okf-grid') as HTMLElement;
    // A fixed five squeezed a tablet's cards to 143 px and cut the chance off.
    expect(grid.style.getPropertyValue('--okf-cols')).toBe('5');
    expect(grid.style.gridTemplateColumns).toBe('');
  });

  it('gives a blocked card that has never rolled a status that can take its tally line', async () => {
    const { OsrsFarmKeys } = await import('./OsrsFarmKeys');
    render(<OsrsFarmKeys wide />);
    // A fresh run has no Slayer, so every master is blocked and unrolled.
    const turael = cardFor('Turael');
    const status = turael.querySelector('.okf-card-foot > .okf-two') as HTMLElement;
    expect(status.getAttribute('title')).toBe('Unlock Slayer first');
    expect(status.firstElementChild!.textContent).toBe('Unlock Slayer first');
    // The spacer that holds the slot at two lines is not read out.
    expect(status.lastElementChild!.getAttribute('aria-hidden')).toBe('true');
    // The line it takes over on a narrow card is the empty tally, and only that.
    const tally = turael.querySelector('.okf-card-foot > .okf-zero') as HTMLElement;
    expect(tally.textContent).toBe('0 rolled');
    expect(status.compareDocumentPosition(tally) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // Spria's line says whose odds she shares, so it stays and her status keeps to one line.
    const spria = cardFor('Spria');
    expect(spria.querySelector('.okf-two')).toBeNull();
    expect(spria.querySelector('.okf-zero')).toBeNull();
    expect(within(spria).getByText("Shares Turael's odds")).toBeTruthy();
  });

  it('keeps to characters the RuneScape fonts have on a card', async () => {
    const { OsrsFarmKeys } = await import('./OsrsFarmKeys');
    render(<OsrsFarmKeys wide />);
    // Curly quotes, the en dash, the minus sign and the arrow are not in the
    // fonts. Another typeface draws them, and its taller line (18 px for 12)
    // put Spria's picture 6 px above the rest of her row.
    for (const card of document.querySelectorAll<HTMLElement>('.okf-card')) {
      for (const line of card.querySelectorAll(':scope > .okf-card-foot > span')) {
        expect(line.textContent, card.dataset.examineName).not.toMatch(/[\u2018\u2019\u201c\u201d\u2013\u2212\u2192]/);
      }
    }
  });

  it('leaves a card that can roll as it was', async () => {
    const { setFarmTab } = await import('./OsrsKeysState');
    const { OsrsFarmKeys } = await import('./OsrsFarmKeys');
    setFarmTab('ACTIVITIES');
    render(<OsrsFarmKeys wide />);
    const card = cardFor(open);
    expect(within(card).getByRole('button', { name: 'Roll' })).toBeTruthy();
    expect(card.querySelector('.okf-two')).toBeNull();
    expect(card.querySelector('.okf-zero')).toBeNull();
  });

  it('sets the word "Tier" apart, so a narrow card can drop it and keep the numeral', async () => {
    const { setFarmTab } = await import('./OsrsKeysState');
    const { OsrsFarmKeys } = await import('./OsrsFarmKeys');
    setFarmTab('ACTIVITIES');
    render(<OsrsFarmKeys wide />);
    const tier = cardFor(open).querySelector('.okf-card-head .tier') as HTMLElement;
    expect(tier.textContent).toMatch(/^Tier [IVX]+$/);
    expect(tier.querySelector('.okf-tier-word')!.textContent).toBe('Tier ');
  });
});

describe('OSRS Farm Keys in Chunked (play review 8)', () => {
  afterEach(() => { cleanup(); });

  const start = async (chunks: string[]) => {
    const { initialState } = await vi.importActual<typeof import('../../context/GameContext')>('../../context/GameContext');
    game.current = {
      ...initialState,
      gameModeId: 'chunked',
      unlocks: { ...initialState.unlocks, chunks },
      history: [],
      rollForKey,
      claimPet: vi.fn(),
    };
  };

  it('offers no Slayer master and no Brutus from the start chunk', async () => {
    await start([]);
    const { setFarmTab } = await import('./OsrsKeysState');
    const { OsrsFarmKeys } = await import('./OsrsFarmKeys');
    const { FARM_NO_BOSS, FARM_NO_SLAYER_MASTER } = await import('../ActionSection');
    setFarmTab('SLAYER');
    const { unmount } = render(<OsrsFarmKeys wide />);
    expect(screen.getByText(FARM_NO_SLAYER_MASTER)).toBeTruthy();
    expect(cardFor('Turael')).toBeNull();
    unmount();
    setFarmTab('BOSSING');
    render(<OsrsFarmKeys wide />);
    expect(cardFor('Brutus')).toBeNull();
    expect(screen.getByText(FARM_NO_BOSS)).toBeTruthy();
  });

  it('offers a master or Brutus once their own chunk is owned', async () => {
    await start(['50,51', '45,55']);
    const { setFarmTab } = await import('./OsrsKeysState');
    const { OsrsFarmKeys } = await import('./OsrsFarmKeys');
    setFarmTab('SLAYER');
    const { unmount } = render(<OsrsFarmKeys wide />);
    expect(cardFor('Turael')).toBeTruthy();
    expect(cardFor('Spria')).toBeNull();
    unmount();
    setFarmTab('BOSSING');
    render(<OsrsFarmKeys wide />);
    expect(cardFor('Brutus')).toBeTruthy();
  });
});
