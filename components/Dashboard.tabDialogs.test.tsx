/* @vitest-environment jsdom */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../context/GameContext', async () => {
  const actual = await vi.importActual<typeof import('../context/GameContext')>('../context/GameContext');
  return {
    ...actual,
    useGame: () => ({
      ...actual.initialState,
      // The tab pane only animates (and keeps a transform) with animations on.
      animationsEnabled: true,
      gameModeId: 'vanilla',
      customMode: undefined,
      levelUpSkill: vi.fn(),
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

// Not ready at mount, so the DPS calculator renders its controls once (after
// loading) instead of ready → loading → ready, which swaps the target button.
vi.mock('../services/GearService', () => ({
  gearService: { ready: false, init: vi.fn().mockResolvedValue(undefined), byId: () => undefined },
}));

vi.mock('../services/MonsterService', () => {
  const monster = {
    id: 1, name: 'Test goblin', version: '', imageFile: '', level: 2, hp: 5, maxHit: 1,
    defLevel: 1, magicLevel: 1, def: { stab: 0, slash: 0, crush: 0, magic: 0, ranged: 0 },
    rangedDefence: { light: 0, standard: 0, heavy: 0 }, size: 1, attributes: [],
  };
  return {
    monsterKey: (m: { id: number; name: string; version: string }) => `${m.id}|${m.name}|${m.version}`,
    monsterService: {
      ready: false, init: vi.fn().mockResolvedValue(undefined), byId: () => undefined,
      search: () => [monster], byKey: () => undefined,
    },
  };
});

import { Dashboard } from './Dashboard';

afterEach(cleanup);

// The tab pane's fade-in-up animation fills `both`, so it keeps a transform
// and becomes the containing block for `position: fixed` descendants. A modal
// rendered inside it is clipped to the pane and leaves the rest of the app
// clickable, so tab dialogs must render outside it.
const expectOutsideTabPane = (dialog: HTMLElement) => {
  expect(dialog.closest('.animate-fade-in-up')).toBeNull();
  expect(dialog.parentElement).toBe(document.body);
};

describe('Dashboard tab dialogs', () => {
  it('opens the Equipment Lab slot dialog outside the animated tab pane', () => {
    render(<Dashboard />);
    const slot = screen.getByTitle(/^Head: Tier 0/);
    expect(slot.closest('.animate-fade-in-up')).not.toBeNull();

    fireEvent.click(slot);

    const dialog = screen.getByRole('dialog', { name: 'Head details' });
    expectOutsideTabPane(dialog);
    fireEvent.click(dialog);
    expect(screen.queryByRole('dialog', { name: 'Head details' })).toBeNull();
  }, 15_000);

  it('opens the DPS target picker outside the animated tab pane', async () => {
    render(<Dashboard />);
    fireEvent.click(screen.getByRole('button', { name: 'DPS' }));
    // The calculator is a lazy chunk; importing it is slow on a loaded run.
    const target = await screen.findByRole('button', { name: /Choose a target monster/ }, { timeout: 10_000 });
    expect(target.closest('.animate-fade-in-up')).not.toBeNull();

    fireEvent.click(target);

    const dialog = screen.getByRole('dialog', { name: 'Choose monster' });
    expectOutsideTabPane(dialog);
    fireEvent.click(dialog);
    expect(screen.queryByRole('dialog', { name: 'Choose monster' })).toBeNull();
  }, 15_000);
});
