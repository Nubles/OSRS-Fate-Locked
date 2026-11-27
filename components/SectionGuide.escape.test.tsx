// @vitest-environment jsdom
import React, { useEffect } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OracleSearch } from './OracleSearch';
import { SectionGuide } from './SectionGuide';
import { useEscapeKey } from '../hooks/useEscapeKey';

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
afterEach(() => cleanup());

const ORACLE_GUIDE_TEXT = 'Search every unlockable to find anything fast.';

/** A window that closes on Escape the way App.tsx and most windows do (useEscapeKey). */
const HookWindow: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  useEscapeKey(onClose, true);
  return <div role="dialog" aria-label="Strategy">Fate Strategy Guide <SectionGuide id="STRATEGY" /></div>;
};

/** A window that closes on a document Escape listener (OsrsKeysTabs, the journal menus). */
const DocumentWindow: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return <div role="dialog" aria-label="Share">Share Run <SectionGuide id="SHARE" /></div>;
};

describe('SectionGuide popover inside a window', () => {
  it('Escape closes only the guide in the Oracle, focus goes back to "?", and a second Escape closes the Oracle', () => {
    const onClose = vi.fn();
    render(<OracleSearch onClose={onClose} />);
    const guideButton = screen.getByRole('button', { name: 'Guide: The Oracle' });
    fireEvent.click(guideButton);
    expect(screen.getByText(ORACLE_GUIDE_TEXT)).toBeTruthy();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByText(ORACLE_GUIDE_TEXT)).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(guideButton);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['a useEscapeKey window', HookWindow, 'Guide: Fate Strategy Guide'],
    ['a document-listener window', DocumentWindow, 'Guide: Share Run'],
  ])('Escape closes only the guide in %s, then closes the window', (_label, Host, guideName) => {
    const onClose = vi.fn();
    render(<Host onClose={onClose} />);
    const guideButton = screen.getByRole('button', { name: guideName });
    fireEvent.click(guideButton);
    expect(screen.getAllByRole('button', { name: 'Close' }).length).toBe(1);

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(guideButton);

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
