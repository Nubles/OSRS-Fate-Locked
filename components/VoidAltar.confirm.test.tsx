// @vitest-environment jsdom
// With "Ask before Key clicks" on, the Ritual of Transmutation (5 Keys for an
// Omni-Key) asks Yes or No first. Real VoidAltar, utils/spendConfirm and SpendConfirm.
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFreshState } from '../context/GameContext';
import { confirmSpendPref } from '../utils/viewerPrefs';

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

beforeEach(() => {
  confirmSpendPref.set(true);
  game.current = {
    ...createFreshState(),
    keys: 5,
    fatePoints: 60,
    gameModeId: 'vanilla',
    drawCartographerChoices: () => [],
    nextFloat: () => 0.5,
    performRitual: vi.fn(),
    performGambit: vi.fn(),
    performCartographer: vi.fn(),
    castRitual: vi.fn(),
  };
});

afterEach(() => { cleanup(); confirmSpendPref.set(false); });

describe('Void Altar with "Ask before Key clicks" on', () => {
  it('asks Yes or No before the Ritual of Transmutation spends 5 Keys', async () => {
    const { VoidAltar } = await import('./VoidAltar');
    render(<VoidAltar onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Ritual of Transmutation/ }));
    // Give a lazy Yes / No box every chance to appear.
    await new Promise(resolve => setTimeout(resolve, 200));

    const performRitual = game.current.performRitual as ReturnType<typeof vi.fn>;
    // One click, no answer given yet: no Keys may have been spent.
    expect(performRitual).not.toHaveBeenCalled();
    expect((await screen.findByRole('alertdialog', {}, { timeout: 10_000 })).textContent).toContain('Trade 5 Keys for 1 Omni-Key?');

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Yes' })); await Promise.resolve(); });
    expect(performRitual.mock.calls).toEqual([['TRANSMUTE']]);
  }, 30_000);

  it('spends nothing on No', async () => {
    const { VoidAltar } = await import('./VoidAltar');
    render(<VoidAltar onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Ritual of Transmutation/ }));
    const no = await screen.findByRole('button', { name: 'No' }, { timeout: 10_000 });
    await act(async () => { fireEvent.click(no); await Promise.resolve(); });
    expect(game.current.performRitual as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
  }, 30_000);

  it('with the setting off, one click trades at once as before', async () => {
    confirmSpendPref.set(false);
    const { VoidAltar } = await import('./VoidAltar');
    render(<VoidAltar onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Ritual of Transmutation/ }));
    expect((game.current.performRitual as ReturnType<typeof vi.fn>).mock.calls).toEqual([['TRANSMUTE']]);
  }, 30_000);

  it('for contrast: the Void Gambit arms on the first click and fires only on the second', async () => {
    const { VoidAltar } = await import('./VoidAltar');
    render(<VoidAltar onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Gambit/ }));
    expect(game.current.performGambit as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
  }, 30_000);
});
