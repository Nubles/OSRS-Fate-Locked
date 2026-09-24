// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UnlockState } from '../types';
import { JournalNextBest } from './JournalNextBest';

const unlocks: UnlockState = {
  equipment: {}, skills: {}, levels: {},
  regions: [], mobility: [], arcana: [], housing: [], merchants: [], minigames: [],
  bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [],
  quests: [], diaries: [], cas: [], completedTasks: [], collectionLog: {},
};
vi.mock('../context/GameContext', () => ({
  useGame: () => ({ unlocks, gameModeId: 'vanilla' }),
}));

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  localStorage.clear();
});

const openFirstMenu = () => {
  render(
    <div>
      <p>Elsewhere on the page</p>
      <JournalNextBest onPick={vi.fn()} />
    </div>,
  );
  const chip = screen.getAllByRole('button').find(button => button.textContent !== ''
    && !/Next best actions/.test(button.textContent ?? ''))!;
  fireEvent.click(chip);
  expect(screen.getByText('Open in the list')).toBeTruthy();
  return chip;
};

describe('Next Best action menu', () => {
  it('closes on a press anywhere outside it, not only inside its pane', () => {
    openFirstMenu();

    fireEvent.pointerDown(screen.getByText('Open in the list'));
    expect(screen.queryByText('Open in the list')).not.toBeNull();

    fireEvent.pointerDown(screen.getByText('Elsewhere on the page'));
    expect(screen.queryByText('Open in the list')).toBeNull();
  });

  it('closes on Escape, and its chip still toggles it', () => {
    const chip = openFirstMenu();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('Open in the list')).toBeNull();

    fireEvent.click(chip);
    expect(screen.queryByText('Open in the list')).not.toBeNull();
    fireEvent.pointerDown(chip);
    fireEvent.click(chip);
    expect(screen.queryByText('Open in the list')).toBeNull();
  });

  it('leaves no full-screen layer behind the menu', () => {
    openFirstMenu();
    expect(document.querySelector('.fixed.inset-0')).toBeNull();
  });
});
