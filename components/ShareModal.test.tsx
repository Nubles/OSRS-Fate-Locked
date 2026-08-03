// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShareModal } from './ShareModal';

const mockGame = vi.hoisted(() => ({
  current: {
    gameModeId: 'standard',
    keys: 0,
    specialKeys: 0,
    chaosKeys: 0,
    unlocks: {
      regions: [] as string[],
      chunks: [] as string[],
      skills: {},
      equipment: {},
      levels: {},
      bosses: [],
      minigames: [],
      arcana: [],
      housing: [],
      merchants: [],
      storage: [],
      banks: [],
    },
  },
}));

vi.mock('../context/GameContext', () => ({
  useGame: () => mockGame.current,
}));

vi.mock('../hooks/useFocusTrap', () => ({
  useFocusTrap: () => undefined,
}));

vi.mock('../hooks/useEscapeKey', () => ({
  useEscapeKey: () => undefined,
}));

vi.mock('./SectionGuide', () => ({
  SectionGuide: () => null,
}));

describe('ShareModal region summary', () => {
  const writeText = vi.fn<(_: string) => Promise<void>>().mockResolvedValue(undefined);

  beforeEach(() => {
    writeText.mockClear();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
  });

  afterEach(cleanup);

  it.each([
    {
      label: 'pending overlap refund credits',
      regions: ['Baxtorian Falls', "Otto's Grotto", 'Taverley', "Heroes' Guild"],
      expected: 2,
    },
    {
      label: 'ordinary canonical regions',
      regions: ['Baxtorian Falls', 'Taverley'],
      expected: 2,
    },
  ])('reports $expected visible regions for $label', async ({ regions, expected }) => {
    mockGame.current.unlocks.regions = regions;
    const view = render(<ShareModal onClose={vi.fn()} />);

    fireEvent.click(view.getByRole('button', { name: 'Copy Summary' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const summary = writeText.mock.calls[0][0];
    expect(summary).toContain(`Regions: ${expected} Unlocked`);
    expect(summary).not.toContain("Otto's Grotto");
    expect(summary).not.toContain("Heroes' Guild");
  });
});
