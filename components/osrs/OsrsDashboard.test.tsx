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

import { Dashboard } from '../Dashboard';
import { UI_STYLE_KEY, applyUiStyle } from '../../utils/uiStyle';

beforeEach(() => {
  localStorage.setItem(UI_STYLE_KEY, 'osrs');
  applyUiStyle();
});

afterEach(() => {
  cleanup();
  levelUpSkill.mockClear();
  localStorage.removeItem(UI_STYLE_KEY);
  applyUiStyle();
});

describe('Dashboard in the OSRS layout', () => {
  it('draws the dashboard tabs as OSRS tabs', { timeout: 20000 }, async () => {
    render(<Dashboard suspendModals />);
    const character = await screen.findByRole('tab', { name: 'Character' }, { timeout: 10000 });
    expect(character.getAttribute('aria-selected')).toBe('true');
    expect(character.className).toContain('osrs-tab');
  });

  it('levels a skill from its cell, and carries examine text with the tier gem', { timeout: 20000 }, async () => {
    render(<Dashboard suspendModals />);
    const card = await screen.findByRole('button', { name: 'Attack' }, { timeout: 10000 });
    expect(card.getAttribute('data-skill-card')).toBe('Attack');
    expect(card.getAttribute('data-examine-name')).toBe('Attack');
    expect(card.getAttribute('data-examine')).toBe('Level 25. Tier III (Red topaz) unlocked: methods 1-30.');

    fireEvent.click(card);
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(levelUpSkill).toHaveBeenCalledTimes(2);
    expect(levelUpSkill).toHaveBeenCalledWith('Attack');

    // Locked skills do nothing on click and say so.
    const mining = screen.getByRole('button', { name: 'Mining' });
    fireEvent.click(mining);
    expect(levelUpSkill).toHaveBeenCalledTimes(2);
    expect(mining.getAttribute('data-examine')).toBe('Level 1. Locked: no tier unlocked yet.');
  });

  it('shows each worn-equipment slot with its tier and examine text', { timeout: 20000 }, async () => {
    render(<Dashboard suspendModals />);
    const head = await screen.findByRole('button', { name: 'Head: Tier 2, click for details' }, { timeout: 10000 });
    expect(head.textContent).toContain('Head · T2');
    expect(head.closest('[data-examine]')?.getAttribute('data-examine')).toBe('Head slot. Tier 2 unlocked: up to Steel / Black / White gear.');
  });
});
