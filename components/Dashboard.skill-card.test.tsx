/* @vitest-environment jsdom */
import React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const levelUpSkill = vi.hoisted(() => vi.fn());

vi.mock('../context/GameContext', async () => {
  const actual = await vi.importActual<typeof import('../context/GameContext')>('../context/GameContext');
  return {
    ...actual,
    useGame: () => ({
      settleAchievements: () => {},
      ...actual.initialState,
      unlocks: { ...actual.initialState.unlocks, skills: { Attack: 1 }, levels: { Attack: 5 } },
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
  levelUpSkill.mockClear();
});

describe('Dashboard skill cards', () => {
  it('levels a skill from the keyboard like a button', () => {
    render(<Dashboard suspendModals />);
    const card = document.querySelector<HTMLElement>('[data-skill-card="Attack"]')!;
    expect(card.getAttribute('role')).toBe('button');

    fireEvent.keyDown(card, { key: 'Enter' });
    fireEvent.keyDown(card, { key: ' ' });

    expect(levelUpSkill).toHaveBeenCalledTimes(2);
    expect(levelUpSkill).toHaveBeenCalledWith('Attack');
  });

  it('names the card for screen readers and leaves locked cards out of the Tab order', () => {
    render(<Dashboard suspendModals />);
    const card = document.querySelector<HTMLElement>('[data-skill-card="Attack"]')!;
    expect(card.tabIndex).toBe(0);
    expect(card.getAttribute('aria-label')).toBe('Attack, level 5, tier 1, methods 1-10, level up');

    // Strength is locked and there is no Omni-Key: nothing to press, so it is
    // a labelled group rather than a button that does nothing.
    const locked = document.querySelector<HTMLElement>('[data-skill-card="Strength"]')!;
    expect(locked.getAttribute('role')).toBe('group');
    expect(locked.hasAttribute('tabindex')).toBe(false);
    expect(locked.getAttribute('aria-label')).toBe('Strength, locked');
  });
});
