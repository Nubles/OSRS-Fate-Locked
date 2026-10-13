/* @vitest-environment jsdom */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const levelUpSkill = vi.hoisted(() => vi.fn());

vi.mock('../../context/GameContext', async () => {
  const actual = await vi.importActual<typeof import('../../context/GameContext')>('../../context/GameContext');
  return {
    ...actual,
    useGame: () => ({
      ...actual.initialState,
      unlocks: {
        ...actual.initialState.unlocks,
        skills: { Attack: 3 },
        levels: { Attack: 25 },
        equipment: { ...actual.initialState.unlocks.equipment, Head: 2 },
      },
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

vi.mock('../../services/WikiService', () => ({
  wikiService: { fetchImage: vi.fn(async () => null) },
}));

vi.mock('../../services/GearService', () => ({
  gearService: {
    ready: true, error: null,
    init: vi.fn(async () => undefined),
    byId: vi.fn(() => undefined),
    bySlot: vi.fn(() => []),
    tierOf: vi.fn(() => 0),
  },
}));

import { Dashboard } from '../Dashboard';
import { UI_STYLE_KEY, applyUiStyle } from '../../utils/uiStyle';
import { getOsrsNav, openOsrsScreen } from '../../utils/osrsNav';

beforeEach(() => {
  localStorage.setItem(UI_STYLE_KEY, 'osrs');
  applyUiStyle();
});

afterEach(() => {
  cleanup();
  levelUpSkill.mockClear();
  openOsrsScreen('home');
  localStorage.removeItem(UI_STYLE_KEY);
  applyUiStyle();
});

describe('Dashboard in the OSRS layout', () => {
  it('draws the Progression tabs as OSRS tabs, and opens the Journal screen from its tab', { timeout: 20000 }, async () => {
    render(<Dashboard suspendModals />);
    const character = await screen.findByRole('tab', { name: 'Character' }, { timeout: 10000 });
    expect(character.getAttribute('aria-selected')).toBe('true');
    expect(character.className).toContain('osrs-tab');
    expect(screen.getByRole('heading', { name: 'Progression' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Collection' })).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Journal' }));
    expect(getOsrsNav().screen).toBe('journal');
    expect(character.getAttribute('aria-selected')).toBe('true');
  });

  it('widens the Progression window for the full-width tabs only', { timeout: 20000 }, async () => {
    render(<Dashboard suspendModals />);
    await screen.findByRole('tab', { name: 'Character' }, { timeout: 10000 });
    expect(getOsrsNav().progressionWide).toBe(false);
    const activities = screen.queryByRole('tab', { name: 'Activities & Utility' });
    if (activities) {
      fireEvent.click(activities);
      expect(getOsrsNav().progressionWide).toBe(true);
      fireEvent.click(screen.getByRole('tab', { name: 'Character' }));
      expect(getOsrsNav().progressionWide).toBe(false);
    }
  });

  it('levels a skill from its cell, which shows level, tier and trainable range', { timeout: 20000 }, async () => {
    render(<Dashboard suspendModals />);
    const card = await screen.findByRole('button', { name: 'Attack, level 25, tier 3, methods 1-30' }, { timeout: 10000 });
    expect(card.getAttribute('data-skill-card')).toBe('Attack');
    expect(card.textContent).toContain('25');
    expect(card.textContent).toContain('T3 · 1-30');
    expect(card.getAttribute('data-examine-name')).toBe('Attack');
    expect(card.getAttribute('data-examine')).toMatch(/^Level 25\. Tier 3: you can train levels 1-30\. Next Lv 26: .+ Key chance\./);

    fireEvent.click(card);
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(levelUpSkill).toHaveBeenCalledTimes(2);
    expect(levelUpSkill).toHaveBeenCalledWith('Attack');

    // Locked skills do nothing on click and say so.
    const mining = screen.getByRole('button', { name: 'Mining, level 1, locked' });
    expect(mining.textContent).toContain('Locked');
    fireEvent.click(mining);
    expect(levelUpSkill).toHaveBeenCalledTimes(2);
    expect(mining.getAttribute('data-examine')).toBe('Level 1. Locked: no tier unlocked yet.');
  });

  it('shows each worn-equipment slot with its tier, and a slot opens the full Equipment Lab', { timeout: 20000 }, async () => {
    render(<Dashboard suspendModals />);
    const head = await screen.findByRole('button', { name: 'Head: Tier 2. Click for its tier ladder.' }, { timeout: 10000 });
    expect(head.textContent).toContain('T2');
    expect(head.closest('[data-examine]')?.getAttribute('data-examine')).toBe('Head slot. Tier 2 unlocked: up to Steel / Black / White gear.');

    fireEvent.click(head);
    const detail = await screen.findByRole('region', { name: 'Head details' }, { timeout: 10000 });
    expect(detail.textContent).toContain('Next: Tier 3');
    expect(screen.getByRole('region', { name: 'Worn Equipment' })).toBeTruthy();
    expect(getOsrsNav().progressionWide).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Close Equipment Lab' }));
    expect(await screen.findByRole('region', { name: 'Skills' })).toBeTruthy();
    expect(getOsrsNav().progressionWide).toBe(false);
  });
});
