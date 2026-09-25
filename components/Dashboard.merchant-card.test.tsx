/* @vitest-environment jsdom */
import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UnlockState } from '../types';
import { MERCHANT_UNLOCK_DETAILS } from '../constants';

const freshUnlocks = (): UnlockState => ({
  equipment: {}, skills: {}, levels: {}, regions: [], chunks: [],
  mobility: [], arcana: [], housing: [], merchants: [], minigames: [],
  bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [],
  banks: [], quests: [], diaries: [], cas: [], completedTasks: [], collectionLog: {},
});

vi.mock('../context/GameContext', async () => {
  const actual = await vi.importActual<typeof import('../context/GameContext')>('../context/GameContext');
  return {
    ...actual,
    useGame: () => ({
      ...actual.initialState,
      unlocks: freshUnlocks(),
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

// The shop directory loads chunk data; its own test covers it.
vi.mock('./MerchantShopsPanel', () => ({ MerchantShopsPanel: () => null }));

import { Dashboard } from './Dashboard';

afterEach(cleanup);

const merchantCard = async (category: string) => {
  const user = userEvent.setup();
  render(<Dashboard suspendModals />);
  await user.click(screen.getByRole('button', { name: /Activities & Utility/ }));
  await user.click(screen.getByRole('button', { name: /^Merchants/ }));
  return screen.getByText(category).closest('div.relative') as HTMLElement;
};

describe('Dashboard merchant cards', () => {
  it.each([
    ['Jewellery Shops', 'https://oldschool.runescape.wiki/w/Jewellery_shop'],
    ['Amulet Shops', 'https://oldschool.runescape.wiki/w/Amulet_shop'],
  ])('%s names the shops it unlocks and links to their wiki page', async (category, wiki) => {
    const card = await merchantCard(category);

    expect(within(card).getByText(MERCHANT_UNLOCK_DETAILS[category])).toBeTruthy();
    expect(within(card).getByTitle('Open Wiki').getAttribute('href')).toBe(wiki);
  });

  it('keeps other merchant cards free of a description line', async () => {
    const card = await merchantCard('Gem Shops');

    for (const detail of Object.values(MERCHANT_UNLOCK_DETAILS)) {
      expect(within(card).queryByText(detail)).toBeNull();
    }
  });
});
