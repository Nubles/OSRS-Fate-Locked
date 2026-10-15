// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFreshState } from '../context/GameContext';

const game = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock('../context/GameContext', async importOriginal => ({
  ...(await importOriginal<typeof import('../context/GameContext')>()),
  useGame: () => game.current,
}));
vi.mock('../hooks/useFocusTrap', () => ({ useFocusTrap: () => undefined }));
vi.mock('./SectionGuide', () => ({ SectionGuide: () => null }));
vi.mock('../services/ChunkContentService', () => ({
  chunkContentService: { ready: false, contentFor: vi.fn(), hasBank: vi.fn() },
}));

const offeredKeys = () => screen.getAllByText(/^\(\d+,\d+\)$/).map(node => node.textContent);

beforeEach(() => {
  const state = createFreshState();
  let draws = 0;
  game.current = {
    ...state,
    fatePoints: 60,
    gameModeId: 'chunked',
    // An unseeded run: every draw is fresh.
    nextFloat: () => [0.9, 0.1, 0.5, 0.7, 0.3, 0.2][draws++ % 6],
    performRitual: vi.fn(),
    performGambit: vi.fn(),
    performCartographer: vi.fn(),
    castRitual: vi.fn(),
  };
});

afterEach(() => cleanup());

describe('VoidAltar Cartographer', () => {
  it('offers three chunks from a four-chunk frontier and keeps them when reopened', async () => {
    const { VoidAltar } = await import('./VoidAltar');
    render(<VoidAltar onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Ritual of the Cartographer/ }));
    const first = offeredKeys();
    expect(first).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: 'Walk away (no Fate spent)' }));
    fireEvent.click(screen.getByRole('button', { name: /Ritual of the Cartographer/ }));

    expect(offeredKeys()).toEqual(first);
  });
});

describe('VoidAltar header', () => {
  it('says a successful roll resets Fate, which a Pity Key does not', async () => {
    const { VoidAltar } = await import('./VoidAltar');
    render(<VoidAltar onClose={vi.fn()} />);
    expect(screen.getByText('A successful roll resets your Fate to 0, so spend it first.')).toBeTruthy();
    expect(screen.queryByText(/when you find a key/)).toBeNull();
  });
});

describe('VoidAltar buffs', () => {
  it('will not sell a second buff while one is waiting for the next roll', async () => {
    game.current = { ...game.current, gameModeId: 'vanilla', activeBuff: 'LUCK' };
    const { VoidAltar } = await import('./VoidAltar');
    render(<VoidAltar onClose={vi.fn()} />);

    const greed = screen.getByRole('button', { name: /Ritual of Greed/ });
    expect((greed as HTMLButtonElement).disabled).toBe(true);
    expect(within(greed).getByText('Another roll ritual is active')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Close the Void Altar' })).toBeTruthy();
  });
});

describe('VoidAltar Gambit minimum stake', () => {
  it.each([
    ['casual', 10, 9, false],
    ['hardcore', 20, 23, true],
    ['vanilla', 15, 15, false],
  ] as const)('shows and applies the %s minimum', async (gameModeId, fatePoints, minimum, disabled) => {
    game.current = { ...game.current, gameModeId, fatePoints };
    const { VoidAltar } = await import('./VoidAltar');
    render(<VoidAltar onClose={vi.fn()} />);

    const gambit = screen.getByRole('button', { name: /Void Gambit/ }) as HTMLButtonElement;
    expect(within(gambit).getByText(`ALL Fate (min ${minimum})`)).toBeTruthy();
    expect(within(gambit).getByText(new RegExp(`Win: 1 Key per ${minimum} staked`))).toBeTruthy();
    expect(gambit.disabled).toBe(disabled);
  });
});

describe('VoidAltar newer rituals', () => {
  it('offers the Pact for free, and holds it back while Zamorak is still owed', async () => {
    game.current = { ...game.current, gameModeId: 'vanilla', fatePoints: 0 };
    const { VoidAltar } = await import('./VoidAltar');
    const { unmount } = render(<VoidAltar onClose={vi.fn()} />);
    const pact = screen.getByRole('button', { name: /Zamorak's Pact/ }) as HTMLButtonElement;
    expect(within(pact).getByText('Free now, pay later')).toBeTruthy();
    expect(pact.disabled).toBe(false);
    fireEvent.click(pact);
    expect(game.current.castRitual).toHaveBeenCalledWith('PACT');
    unmount();

    game.current = { ...game.current, rituals: { pactDebt: 25 } };
    render(<VoidAltar onClose={vi.fn()} />);
    const owed = screen.getByRole('button', { name: /Zamorak's Pact/ }) as HTMLButtonElement;
    expect(owed.disabled).toBe(true);
    expect(within(owed).getByText('Debt: 25 Fate')).toBeTruthy();
    // The gods don't share: Saradomin waits while Zamorak is owed.
    const ward = screen.getByRole('button', { name: /Saradomin's Ward/ }) as HTMLButtonElement;
    expect(ward.disabled).toBe(true);
    expect(within(ward).getByText('Zamorak is active')).toBeTruthy();
  });

  it('lets the player pick invocations before paying', async () => {
    game.current = { ...game.current, gameModeId: 'vanilla', fatePoints: 30 };
    const { VoidAltar } = await import('./VoidAltar');
    render(<VoidAltar onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Amascut's Invocations/ }));
    const invoke = screen.getByRole('button', { name: /Invoke/ }) as HTMLButtonElement;
    expect(invoke.disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /Blood Price/ }));
    fireEvent.click(screen.getByRole('button', { name: /Walk the Path/ }));
    expect(screen.getByText('Omni-Key chance +2% on your next 3 rolls')).toBeTruthy();
    fireEvent.click(invoke);
    expect(game.current.castRitual).toHaveBeenCalledWith('INVOCATIONS', ['WALK_THE_PATH', 'BLOOD_PRICE']);
  });

  it('keeps Sacrifice locked until the run has made 200 rolls', async () => {
    game.current = { ...game.current, gameModeId: 'vanilla', fatePoints: 30 };
    const { VoidAltar } = await import('./VoidAltar');
    render(<VoidAltar onClose={vi.fn()} />);
    const sacrifice = screen.getByRole('button', { name: /Sacrifice/ }) as HTMLButtonElement;
    expect(sacrifice.disabled).toBe(true);
    expect(within(sacrifice).getByText('Opens after 200 rolls (0 so far)')).toBeTruthy();
  });
});
