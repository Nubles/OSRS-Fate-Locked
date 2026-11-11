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
import { setSkillOddsHover } from '../utils/skillOddsPref';

afterEach(() => {
  cleanup();
  levelUpSkill.mockClear();
  run.specialKeys = 0;
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

  // jsdom has no layout, so these pin where the card puts the button in the
  // page's structure; the measured sizes are in the pull request that moved it.
  it('puts the Omni-Key upgrade under the skill icon, clear of the name, and asks before spending', () => {
    run.specialKeys = 1;
    render(<Dashboard />);
    const card = document.querySelector<HTMLElement>('[data-skill-card="Attack"]')!;
    const upgrade = screen.getByRole('button', { name: 'Unlock Tier 2 of Attack (1 Omni-Key)' });
    const icon = screen.getByRole('button', { name: 'Attack details' });
    const info = screen.getByRole('button', { name: 'Attack roll odds' });
    expect(card.contains(upgrade)).toBe(true);

    // It shares the icon's column, straight after the icon. It used to float
    // in the top corner (absolute top-1 right-8), over the end of the name on
    // a phone and in a window of 1280 to 1536px.
    expect(icon.nextElementSibling).toBe(upgrade);
    expect(upgrade.parentElement!.className).toContain('flex-col');
    expect(upgrade.className).not.toContain('absolute');
    // The name is in the next column, not under the button's.
    const name = Array.from(card.querySelectorAll('div')).find((el) => el.textContent === 'Attack' && el.children.length === 0)!;
    expect(upgrade.parentElement!.contains(name)).toBe(false);
    // The tier bar keeps the length it has without an Omni-Key.
    expect(card.querySelector('.h-1\\.5')!.className).toContain('w-[calc(100%-1.25rem)]');
    // Tab reaches the icon, then the upgrade, then the "i".
    expect(icon.compareDocumentPosition(upgrade) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(upgrade.compareDocumentPosition(info) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.click(upgrade);
    expect(levelUpSkill).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog', { name: 'Confirm Unlock' });
    expect(dialog.textContent).toContain('1 Omni-Key');
    expect(dialog.textContent).toContain('Attack');
  });

  it('leaves the icon alone in its column without an Omni-Key', () => {
    render(<Dashboard suspendModals />);
    expect(screen.queryByRole('button', { name: /Unlock Tier/ })).toBeNull();
    const icon = screen.getByRole('button', { name: 'Attack details' });
    expect(icon.parentElement!.childElementCount).toBe(1);
  });
});
