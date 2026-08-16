import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { RunCardModal } from './RunCard';

const mockGame = vi.hoisted(() => ({
  current: {
    history: [],
    unlocks: {
      regions: [] as string[],
      chunks: [] as string[],
    },
    keys: 0,
    specialKeys: 0,
    chaosKeys: 0,
    fatePoints: 0,
    gameModeId: 'standard',
  },
}));

vi.mock('../context/GameContext', () => ({
  useGame: () => mockGame.current,
}));

vi.mock('../context/ProfileContext', () => ({
  useProfiles: () => ({ activeProfileName: 'Alias debt fixture' }),
}));

vi.mock('../hooks/useFocusTrap', () => ({
  useFocusTrap: () => undefined,
}));

describe('RunCardModal region total', () => {
  it.each([
    {
      label: 'pending overlap refund credits',
      regions: ['Baxtorian Falls', "Otto's Grotto", 'Taverley', "Heroes' Guild"],
      expected: '11/186 regions',
    },
    {
      label: 'ordinary canonical regions',
      regions: ['Baxtorian Falls', 'Taverley'],
      expected: '11/186 regions',
    },
  ])('shows $expected for $label', ({ regions, expected }) => {
    mockGame.current.unlocks.regions = regions;

    const markup = renderToStaticMarkup(<RunCardModal onClose={vi.fn()} embedded />);

    expect(markup).toContain(expected);
    expect(markup).not.toContain("Otto's Grotto");
    expect(markup).not.toContain("Heroes' Guild");
  });
});
