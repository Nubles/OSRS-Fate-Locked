// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { wikiUrlFor } from '../constants';
import { OracleSearch } from './OracleSearch';

vi.mock('../context/GameContext', () => ({
  useGame: () => ({
    unlocks: {
      equipment: {}, skills: {}, levels: {}, regions: [], chunks: [], mobility: [], arcana: [],
      housing: [], merchants: [], minigames: [], bosses: [], storage: [], guilds: [],
      farming: [], slayerUnlocks: [], quests: [], diaries: [], cas: [],
      completedTasks: [], collectionLog: {},
    },
    gameModeId: 'standard',
  }),
}));

vi.mock('../hooks/useFocusTrap', () => ({ useFocusTrap: () => undefined }));
vi.mock('./SectionGuide', () => ({ SectionGuide: () => null }));
vi.mock('./TestSuiteRunner', () => ({ TestSuiteRunner: () => null }));
vi.mock('../services/ChunkContentService', () => ({
  chunkContentService: { ready: true, init: vi.fn(), searchEntities: vi.fn(() => []) },
}));
vi.mock('./EntityLocations', () => ({ EntityLocations: () => null }));

afterEach(() => cleanup());

describe('OracleSearch area map actions', () => {
  it.each([
    ["Otto's Grotto", "Otto's Grotto", { cx: 39, cy: 54 }],
    ['Baxtorian Falls', 'Baxtorian Falls', { cx: 39, cy: 53 }],
    ['Elf Camp', 'Elf Camp', { cx: 33, cy: 50 }],
  ])('maps %s through its exact %s chunk and keeps its Wiki link', (
    query,
    place,
    expectedChunk,
  ) => {
    const onChunk = vi.fn();
    window.addEventListener('fate:show-chunk', onChunk as EventListener);

    try {
      render(<OracleSearch onClose={vi.fn()} />);
      fireEvent.change(screen.getByPlaceholderText('Ask the Oracle... (Search Content)'), {
        target: { value: query },
      });

      fireEvent.click(screen.getByRole('button', { name: `Show ${place} on the map` }));
      expect(onChunk).toHaveBeenCalledTimes(1);
      expect((onChunk.mock.calls[0][0] as CustomEvent).detail).toEqual(expectedChunk);

      expect((screen.getByRole(
        'link', { name: `Open ${place} on OSRS Wiki` },
      ) as HTMLAnchorElement).getAttribute('href')).toBe(wikiUrlFor(place));
    } finally {
      window.removeEventListener('fate:show-chunk', onChunk as EventListener);
    }
  });
});
