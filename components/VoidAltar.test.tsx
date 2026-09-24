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

describe('VoidAltar buffs', () => {
  it('will not sell a second buff while one is waiting for the next roll', async () => {
    game.current = { ...game.current, gameModeId: 'vanilla', activeBuff: 'LUCK' };
    const { VoidAltar } = await import('./VoidAltar');
    render(<VoidAltar onClose={vi.fn()} />);

    const greed = screen.getByRole('button', { name: /Ritual of Greed/ });
    expect((greed as HTMLButtonElement).disabled).toBe(true);
    expect(within(greed).getByText('Other buff active')).toBeTruthy();
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
    expect(gambit.disabled).toBe(disabled);
  });
});
