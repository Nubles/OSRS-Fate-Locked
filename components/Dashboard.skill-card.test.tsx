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
});
