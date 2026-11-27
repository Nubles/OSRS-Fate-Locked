// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OracleSearch } from './OracleSearch';

vi.mock('../context/GameContext', () => ({
  useGame: () => ({
    unlocks: {
      equipment: {}, skills: {}, levels: {}, regions: [], chunks: [], mobility: [], arcana: [],
      housing: [], merchants: [], minigames: [], bosses: [], storage: [], guilds: [],
      farming: [], slayerUnlocks: [], quests: [], diaries: [], cas: [],
      completedTasks: [], collectionLog: {},
    },
    gameModeId: 'vanilla',
  }),
}));
vi.mock('../hooks/useFocusTrap', () => ({ useFocusTrap: () => undefined }));
vi.mock('./TestSuiteRunner', () => ({ TestSuiteRunner: () => null }));
vi.mock('../services/ChunkContentService', () => ({
  chunkContentService: { ready: true, init: vi.fn(), searchEntities: vi.fn(() => []) },
}));
vi.mock('./EntityLocations', () => ({ EntityLocations: () => null }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const footerHint = () => screen.getByText('command palette', { exact: false });

describe('Oracle footer hint', () => {
  it('names the command palette shortcut on Windows', () => {
    vi.stubGlobal('navigator', { platform: 'Win32', userAgent: 'Windows' });
    render(<OracleSearch onClose={() => {}} />);
    expect(footerHint().textContent).toBe('Ctrl+K command palette');
    expect(screen.queryByText('to open', { exact: false })).toBeNull();
  });

  it('names the Mac key on a Mac', () => {
    vi.stubGlobal('navigator', { platform: 'MacIntel', userAgent: 'Macintosh' });
    render(<OracleSearch onClose={() => {}} />);
    expect(footerHint().textContent).toBe('⌘K command palette');
  });
});
