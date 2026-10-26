/* @vitest-environment jsdom */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
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
      settleAchievements: () => {},
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
import { TIER_MARKS_KEY, UI_STYLE_KEY, applyUiStyle, setTierMarks } from '../../utils/uiStyle';
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
  localStorage.removeItem(TIER_MARKS_KEY);
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
    const card = await screen.findByRole('button', { name: 'Attack, level 25, tier 3, methods 1-30, level up' }, { timeout: 10000 });
    expect(card.getAttribute('data-skill-card')).toBe('Attack');
    expect(card.textContent).toContain('25');
    // Tier III: the numeral, three filled notches and the tier line.
    expect(card.textContent).toContain('Tier III · methods to 30');
    expect(card.querySelector('.osrs-char-tiernum')?.textContent).toBe('III');
    expect(card.querySelector('.osrs-char-gem')).toBeNull();
    expect(card.querySelectorAll('.osrs-char-notches > .is-on')).toHaveLength(3);
    expect(card.getAttribute('data-examine-name')).toBe('Attack');
    expect(card.getAttribute('data-examine')).toMatch(/^Level 25\. Tier 3: you can train levels 1-30\. Next Lv 26: .+ Key chance\./);

    fireEvent.click(card);
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(levelUpSkill).toHaveBeenCalledTimes(2);
    expect(levelUpSkill).toHaveBeenCalledWith('Attack');

    // Locked skills do nothing on click and say so; with nothing to press they
    // are a labelled group, not a button, and stay out of the Tab order.
    const mining = screen.getByRole('group', { name: 'Mining, level 1, locked' });
    expect(mining.hasAttribute('tabindex')).toBe(false);
    expect(mining.textContent).toContain('Locked');
    expect(mining.textContent).toContain('Needs a Key to start');
    expect(mining.querySelector('.osrs-char-tiernum')).toBeNull();
    fireEvent.click(mining);
    expect(levelUpSkill).toHaveBeenCalledTimes(2);
    expect(mining.getAttribute('data-examine')).toBe('Level 1. Locked: no tier unlocked yet.');
  });

  it('draws tiers as the older cut gems when Settings > Tier marks is Gems', { timeout: 20000 }, async () => {
    render(<Dashboard suspendModals />);
    const card = await screen.findByRole('button', { name: 'Attack, level 25, tier 3, methods 1-30, level up' }, { timeout: 10000 });
    const head = screen.getByRole('button', { name: 'Head: Tier 2. Click for its tier ladder.' });
    expect(head.querySelector('.osrs-char-slotgem')).toBeNull();
    act(() => setTierMarks('gems'));
    // Tier III is Red topaz; the Head slot's Tier 2 keeps its numeral and gains a Jade gem.
    expect((card.querySelector('.osrs-char-gem') as HTMLElement).style.backgroundImage).toContain('red_topaz');
    expect(card.querySelector('.osrs-char-tiernum')).toBeNull();
    expect(head.querySelector('.osrs-char-slottier')?.textContent).toBe('II');
    expect(head.querySelector('.osrs-char-slotgem')?.getAttribute('src')).toContain('gem-jade');
    act(() => setTierMarks('numerals'));
    expect(card.querySelector('.osrs-char-tiernum')?.textContent).toBe('III');
  });

  it('opens a skill\'s roll odds from the i in its corner instead of a tooltip over the cell', { timeout: 20000 }, async () => {
    render(<Dashboard suspendModals />);
    const card = await screen.findByRole('button', { name: 'Attack, level 25, tier 3, methods 1-30, level up' }, { timeout: 10000 });
    expect(card.getAttribute('title')).toBeNull();
    const info = screen.getByRole('button', { name: 'Attack roll odds' });
    expect(card.contains(info)).toBe(true);
    fireEvent.click(info);
    expect(levelUpSkill).not.toHaveBeenCalled();
    const box = await screen.findByRole('tooltip');
    expect(box.className).toBe('osrs-skill-info-box');
    expect(box.textContent).toContain('Attack: next level 26');
    expect(box.textContent).toContain('Key chance: 5.2%');
    // Locked skills have nothing to roll, so no button.
    expect(screen.queryByRole('button', { name: 'Mining roll odds' })).toBeNull();
  });

  it('shows each worn-equipment slot with its tier, and a slot opens its ladder inside the panel', { timeout: 20000 }, async () => {
    render(<Dashboard suspendModals />);
    const head = await screen.findByRole('button', { name: 'Head: Tier 2. Click for its tier ladder.' }, { timeout: 10000 });
    // Tier 2 is a II numeral on the slot; an empty slot shows its wiki slot icon.
    expect(head.querySelector('.osrs-char-slottier')?.textContent).toBe('II');
    expect(head.querySelector('.osrs-char-slotsil')?.getAttribute('src')).toContain('Head_slot.png');
    const neck = screen.getByRole('button', { name: 'Neck: Tier 0. Click for its tier ladder.' });
    expect(neck.className).toContain('is-dim');
    expect(neck.querySelector('.osrs-char-slotgem')).toBeNull();
    expect(neck.querySelector('.osrs-char-slottier')).toBeNull();
    expect(head.closest('[data-examine]')?.getAttribute('data-examine')).toBe('Head slot. Tier II unlocked: up to Steel / Black / White gear.');

    // The slot's ladder opens inside the Equipment Lab panel: Skills and the left column stay.
    fireEvent.click(head);
    const lab = screen.getByRole('region', { name: 'Equipment Lab' });
    const detail = await screen.findByRole('region', { name: 'Head details' }, { timeout: 10000 });
    expect(lab.contains(detail)).toBe(true);
    expect(detail.textContent).toContain('Next: Tier III');
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
    expect(screen.getByRole('button', { name: 'Head: Tier 2. Click for its tier ladder.' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Skills' })).toBeTruthy();
  });
});
