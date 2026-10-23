/* @vitest-environment jsdom */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
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
import { setSkillOddsHover } from '../utils/skillOddsPref';

afterEach(() => {
  cleanup();
  levelUpSkill.mockClear();
  setSkillOddsHover(false);
  localStorage.clear();
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

  it('opens the roll odds from the i in the corner, outside the card, without levelling', async () => {
    render(<Dashboard suspendModals />);
    const card = document.querySelector<HTMLElement>('[data-skill-card="Attack"]')!;
    expect(card.querySelector('[role="tooltip"]')).toBeNull();
    const info = screen.getByRole('button', { name: 'Attack roll odds' });
    fireEvent.click(info);
    expect(levelUpSkill).not.toHaveBeenCalled();
    const box = await screen.findByRole('tooltip');
    expect(card.contains(box)).toBe(false);
    expect(box.textContent).toContain('Next Lv 6');
    expect(box.textContent).toContain('1.2%');
  });

  it('brings back the hover box, and drops the button, when Settings turns it on', () => {
    render(<Dashboard suspendModals />);
    act(() => { setSkillOddsHover(true); });
    const card = document.querySelector<HTMLElement>('[data-skill-card="Attack"]')!;
    expect(screen.queryByRole('button', { name: 'Attack roll odds' })).toBeNull();
    const box = card.querySelector('[role="tooltip"]')!;
    expect(box.className).toContain('group-hover:opacity-100');
    expect(box.className).not.toContain('group-focus-within');
  });
});
