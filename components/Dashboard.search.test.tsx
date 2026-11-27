/* @vitest-environment jsdom */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const levelUpSkill = vi.hoisted(() => vi.fn());
// Omni-Keys in hand for the run the cards are drawn from; a test sets it.
const run = vi.hoisted(() => ({ specialKeys: 0 }));

vi.mock('../context/GameContext', async () => {
  const actual = await vi.importActual<typeof import('../context/GameContext')>('../context/GameContext');
  return {
    ...actual,
    useGame: () => ({
      settleAchievements: () => {},
      ...actual.initialState,
      unlocks: { ...actual.initialState.unlocks, skills: { Attack: 1 }, levels: { Attack: 5 } },
      specialKeys: run.specialKeys,
      animationsEnabled: false,
      gameModeId: 'vanilla',
      customMode: undefined,
      levelUpSkill,
      unlockContent: vi.fn(),
      toggleAnimations: vi.fn(),
      toggleAdvisors: vi.fn(),
      toggleRevealAll: vi.fn(),
      completeOnboarding: vi.fn(),
      saveNote: vi.fn(),
    }),
  };
});

vi.mock('../services/WikiService', () => ({
  wikiService: { fetchImage: vi.fn(async () => null) },
}));

import { Dashboard } from './Dashboard';


afterEach(() => {
  cleanup();
  localStorage.clear();
});

// own.d1[4]: a phone keyboard adds a space after a suggestion; the Classic
// filters used the text with it, so 'attack ' hid every tile.
describe('Classic search ignores stray spaces', () => {
  const search = (text: string) =>
    fireEvent.change(screen.getByPlaceholderText('Filter unlocks...'), { target: { value: text } });

  it('keeps the Attack tile for "attack "', () => {
    render(<Dashboard suspendModals />);
    search(' attack ');
    expect(document.querySelector('[data-skill-card="Attack"]')).not.toBeNull();
    expect(document.querySelector('[data-skill-card="Strength"]')).toBeNull();
  });

  it('finds an activity for "forestry " and quotes the trimmed text when nothing matches', () => {
    render(<Dashboard suspendModals />);
    fireEvent.click(screen.getByRole('tab', { name: /Activities & Utility/ }));
    search(' forestry ');
    expect(screen.getAllByText('Forestry').length).toBeGreaterThan(0);
    search(' zzzq ');
    expect(screen.getByText('No activities match "zzzq".')).toBeTruthy();
  });

  it('keeps the Asgarnia areas for "falador "', () => {
    render(<Dashboard suspendModals />);
    fireEvent.click(screen.getByRole('tab', { name: /World/ }));
    fireEvent.click(screen.getByTitle('List View'));
    search('falador ');
    expect(document.querySelector('[data-region-card="Asgarnia"]')).not.toBeNull();
  });
});
