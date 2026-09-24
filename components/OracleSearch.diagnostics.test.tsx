// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const resetGame = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock('../context/GameContext', () => ({
  useGame: () => ({
    unlocks: {
      equipment: {}, skills: {}, levels: {}, regions: [], chunks: [], mobility: [], arcana: [],
      housing: [], merchants: [], minigames: [], bosses: [], storage: [], guilds: [],
      farming: [], slayerUnlocks: [], quests: [], diaries: [], cas: [],
      completedTasks: [], collectionLog: {},
    },
    gameModeId: 'vanilla',
    keys: 3,
    fatePoints: 0,
    resetGame,
    getExportData: () => '{}',
  }),
}));
vi.mock('../hooks/useFocusTrap', () => ({ useFocusTrap: () => undefined }));
vi.mock('./SectionGuide', () => ({ SectionGuide: () => null }));
vi.mock('../services/ChunkContentService', () => ({
  chunkContentService: { ready: true, init: vi.fn(), searchEntities: vi.fn(() => []) },
}));
vi.mock('./EntityLocations', () => ({ EntityLocations: () => null }));

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.resetModules();
  resetGame.mockClear();
});

const renderOracle = async () => {
  const { OracleSearch } = await import('./OracleSearch');
  render(<OracleSearch onClose={vi.fn()} />);
  const input = screen.getByPlaceholderText('Ask the Oracle... (Search Content)');
  fireEvent.change(input, { target: { value: 'test' } });
  fireEvent.keyDown(input, { key: 'Enter' });
};

describe('OracleSearch diagnostics', () => {
  it('cannot reset a player run from a production build', async () => {
    vi.stubEnv('DEV', false);
    vi.resetModules();

    await renderOracle();

    expect(screen.queryByText('Void System Diagnostics')).toBeNull();
    expect(screen.queryByText('[Press Enter to run Diagnostics]')).toBeNull();
    expect(resetGame).not.toHaveBeenCalled();
  });

  it('remains available to development builds', async () => {
    vi.stubEnv('DEV', true);
    vi.resetModules();

    await renderOracle();

    expect(await screen.findByText('Void System Diagnostics')).toBeTruthy();
  });
});
