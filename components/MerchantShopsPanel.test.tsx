/* @vitest-environment jsdom */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MERCHANT_UNLOCK_DETAILS } from '../constants';

const mocks = vi.hoisted(() => ({
  game: {
    unlocks: {
      equipment: {}, skills: {}, levels: {}, regions: [], chunks: [],
      mobility: [], arcana: [], housing: [], merchants: [], minigames: [],
      bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [],
      banks: [], quests: [], diaries: [], cas: [], completedTasks: [], collectionLog: {},
    },
    gameModeId: 'vanilla',
  },
}));

vi.mock('../context/GameContext', () => ({ useGame: () => mocks.game }));
vi.mock('../hooks/useChunkContent', () => ({
  useChunkContent: () => ({ ready: true, error: null, retry: vi.fn() }),
}));
vi.mock('../utils/merchantShops', () => ({
  shopsByCategory: () => new Map([
    ['Jewellery Shops', [
      { name: "Conara's Jewels", kind: 'shop', category: 'Jewellery Shops', locations: [{ cx: 22, cy: 48 }] },
      { name: "Grum's Gold Exchange.", kind: 'shop', category: 'Jewellery Shops', stockStatus: 'zero-stock', locations: [{ cx: 47, cy: 50 }] },
    ]],
    ['Amulet Shops', [
      { name: "Davon's Amulet Store.", kind: 'shop', category: 'Amulet Shops', stockStatus: 'zero-stock', locations: [{ cx: 43, cy: 49 }] },
    ]],
    ['Gem Shops', [
      { name: 'Gem Trader', kind: 'shop', category: 'Gem Shops', locations: [{ cx: 51, cy: 50 }] },
    ]],
  ]),
}));
vi.mock('../utils/chunkLocations', () => ({ summarisePlaces: () => [], showChunkOnMap: vi.fn() }));
vi.mock('../utils/entityAccess', () => ({ evaluateEntityAccess: () => ({ status: 'LOCKED', reasons: [] }) }));

import { MerchantShopsPanel } from './MerchantShopsPanel';

afterEach(cleanup);

const openCategory = (category: string) => {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${category}`) }));
};

describe('MerchantShopsPanel category descriptions', () => {
  it.each(['Jewellery Shops', 'Amulet Shops'])('shows what %s unlocks above its shops', (category) => {
    render(<MerchantShopsPanel />);
    expect(screen.queryByText(MERCHANT_UNLOCK_DETAILS[category])).toBeNull();

    openCategory(category);

    expect(screen.getByText(MERCHANT_UNLOCK_DETAILS[category])).toBeTruthy();
  });

  it('adds no description to categories without one', () => {
    render(<MerchantShopsPanel />);
    openCategory('Gem Shops');

    expect(screen.getByText('Gem Trader')).toBeTruthy();
    for (const detail of Object.values(MERCHANT_UNLOCK_DETAILS)) {
      expect(screen.queryByText(detail)).toBeNull();
    }
  });
});
