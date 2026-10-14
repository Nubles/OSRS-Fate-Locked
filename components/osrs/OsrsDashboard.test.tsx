/* @vitest-environment jsdom */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const levelUpSkill = vi.hoisted(() => vi.fn());

vi.mock('../../context/GameContext', async () => {
  const actual = await vi.importActual<typeof import('../../context/GameContext')>('../../context/GameContext');
  // One unlocks object, as the real context keeps between renders (the DPS
  // view copies unlocks.levels into its own state whenever it changes).
  const unlocks = {
    ...actual.initialState.unlocks,
    skills: { Attack: 3 },
    levels: { Attack: 25 },
    equipment: { ...actual.initialState.unlocks.equipment, Head: 2 },
  };
  return {
    ...actual,
    useGame: () => ({
      ...actual.initialState,
      unlocks,
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

// The DPS view's monster list stays empty here (the real catalogue is large).
vi.mock('../../services/MonsterService', () => ({
  monsterKey: (m: { id: number; name: string; version?: string }) => `${m.id}:${m.name}:${m.version ?? ''}`,
  monsterService: {
    ready: true, error: null,
    init: vi.fn(async () => undefined),
    search: vi.fn(() => []),
    byKey: vi.fn(() => undefined),
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
    // Tier III is Red topaz: the gem, three filled notches and the tier line.
    expect(card.textContent).toContain('Tier III · methods to 30');
    expect((card.querySelector('.osrs-char-gem') as HTMLElement).style.backgroundImage).toContain('red_topaz');
    expect(card.querySelectorAll('.osrs-char-notches > .is-on')).toHaveLength(3);
    expect(card.getAttribute('data-examine-name')).toBe('Attack');
    expect(card.getAttribute('data-examine')).toMatch(/^Level 25\. Tier 3: you can train levels 1-30\. Next Lv 26: .+ Key chance\./);

    fireEvent.click(card);
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(levelUpSkill).toHaveBeenCalledTimes(2);
    expect(levelUpSkill).toHaveBeenCalledWith('Attack');

    // Locked skills do nothing on click and say so.
    const mining = screen.getByRole('button', { name: 'Mining, level 1, locked' });
    expect(mining.textContent).toContain('Locked');
    expect(mining.textContent).toContain('Needs a Key to start');
    expect(mining.querySelector('.osrs-char-gem')).toBeNull();
    fireEvent.click(mining);
    expect(levelUpSkill).toHaveBeenCalledTimes(2);
    expect(mining.getAttribute('data-examine')).toBe('Level 1. Locked: no tier unlocked yet.');
  });

  it('shows each worn-equipment slot with its tier, and a slot opens its ladder inside the panel', { timeout: 20000 }, async () => {
    render(<Dashboard suspendModals />);
    const head = await screen.findByRole('button', { name: 'Head: Tier 2. Click for its tier ladder.' }, { timeout: 10000 });
    // Tier 2 is a Jade gem in the slot's corner; an empty slot shows its OSRS silhouette.
    expect(head.querySelector('.osrs-char-slotgem')?.getAttribute('src')).toContain('gem-jade');
    expect(head.querySelector('.osrs-char-slotsil')?.getAttribute('src')).toContain('slots/head.png');
    const neck = screen.getByRole('button', { name: 'Neck: Tier 0. Click for its tier ladder.' });
    expect(neck.className).toContain('is-dim');
    expect(neck.querySelector('.osrs-char-slotgem')).toBeNull();
    expect(screen.getByRole('list', { name: 'Tier per slot' }).textContent).toContain('Tier II · Steel / Black / White');
    expect(head.closest('[data-examine]')?.getAttribute('data-examine')).toBe('Head slot. Tier 2 unlocked: up to Steel / Black / White gear.');

    // The slot's ladder opens inside the Equipment Lab panel: Skills and the left column stay.
    fireEvent.click(head);
    const lab = screen.getByRole('region', { name: 'Equipment Lab' });
    const detail = await screen.findByRole('region', { name: 'Head details' }, { timeout: 10000 });
    expect(lab.contains(detail)).toBe(true);
    expect(detail.textContent).toContain('Next: Tier 3');
    expect(screen.getByRole('button', { name: 'Head: Tier 2. Click for its tier ladder.' }).className).toContain('is-sel');
    expect(screen.getByRole('button', { name: 'Tiers' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('region', { name: 'Skills' })).toBeTruthy();
    expect(getOsrsNav().progressionWide).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Close Equipment Lab view' }));
    expect(screen.queryByRole('region', { name: 'Head details' })).toBeNull();
    expect(screen.getByRole('group', { name: /^Equipment Stats/ })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Skills' })).toBeTruthy();
  });

  it('switches the Equipment Lab panel between Plan, Gear and DPS without widening the window', { timeout: 20000 }, async () => {
    render(<Dashboard suspendModals />);
    await screen.findByRole('region', { name: 'Equipment Lab' }, { timeout: 10000 });
    const lab = screen.getByRole('region', { name: 'Equipment Lab' });

    fireEvent.click(screen.getByRole('button', { name: 'Plan' }));
    expect(screen.getByRole('button', { name: 'Plan' }).getAttribute('aria-pressed')).toBe('true');
    const plan = screen.getByRole('region', { name: 'Target loadout' });
    expect(lab.contains(plan)).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Raise Neck target' }));
    expect(plan.textContent).toContain('1needed');

    fireEvent.click(screen.getByRole('button', { name: 'Gear' }));
    expect(screen.queryByRole('region', { name: 'Target loadout' })).toBeNull();
    expect(screen.getByRole('list', { name: 'Worn items' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Weapon: empty, unlocked up to Tier 0. Choose Weapon' }));
    expect(lab.contains(screen.getByRole('region', { name: 'Choose Weapon' }))).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('region', { name: 'Choose Weapon' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'DPS' }));
    expect(lab.contains(screen.getByRole('region', { name: 'DPS calculator' }))).toBe(true);
    expect(getOsrsNav().progressionWide).toBe(false);

    // The pressed mode button closes its view again.
    fireEvent.click(screen.getByRole('button', { name: 'DPS' }));
    expect(screen.queryByRole('region', { name: 'DPS calculator' })).toBeNull();
    expect(screen.getByRole('list', { name: 'Tier per slot' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Skills' })).toBeTruthy();
  });
});
