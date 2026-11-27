/* @vitest-environment jsdom */
// The Activities board opens the chosen unlock's own note, not the previous one's.
// The editor loads the saved note each time it opens (components/NoteTrigger.tsx), so the
// un-keyed Detail in OsrsDashActivities does not carry the first unlock's text over.
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TableType } from '../../types';

const game = vi.hoisted(() => ({
  userNotes: {} as Record<string, string>,
  saveNote: vi.fn(),
}));

vi.mock('../../context/GameContext', async () => {
  const actual = await vi.importActual<typeof import('../../context/GameContext')>('../../context/GameContext');
  return {
    ...actual,
    useGame: () => ({
      ...actual.initialState,
      gameModeId: 'vanilla',
      advisorsEnabled: false,
      hopes: [],
      toggleHope: vi.fn(),
      userNotes: game.userNotes,
      saveNote: game.saveNote,
    }),
  };
});
vi.mock('../../services/WikiService', () => ({ wikiService: { fetchImage: vi.fn(async () => null) } }));

import { OsrsDashActivities, type OsrsActivityCategory } from './OsrsDashActivities';

afterEach(() => { cleanup(); game.userNotes = {}; game.saveNote.mockReset(); });

// Stands in for Dashboard's UnlockCard: the board only reads the props off the element.
const Card: React.FC<{ item: string; isUnlocked: boolean; canUnlock: boolean; onClick: () => void }> = () => null;

const BOSSES: OsrsActivityCategory = { id: 'BOSSES', label: 'Bosses', list: ['Giant Mole', 'Obor'], unlocked: ['Giant Mole', 'Obor'], type: TableType.BOSSES };
const renderGrid = () => (
  <div>
    <Card key="Giant Mole" item="Giant Mole" isUnlocked canUnlock={false} onClick={() => {}} />
    <Card key="Obor" item="Obor" isUnlocked canUnlock={false} onClick={() => {}} />
  </div>
);

describe('OSRS layout Activities board', () => {
  it('opens the chosen unlock\'s own note, and Save does not copy another unlock\'s note over it', () => {
    game.userNotes = { 'Giant Mole': 'GIANT MOLE NOTE', Obor: 'OBOR NOTE' };
    render(<OsrsDashActivities categories={[BOSSES]} activeId="BOSSES" onSelect={() => {}} searchQuery="" specialKeys={0} renderGrid={renderGrid} />);

    // Giant Mole is shown first; pick Obor in the name list.
    fireEvent.click(screen.getByRole('button', { name: 'Obor' }));
    fireEvent.click(screen.getByRole('button', { name: 'View note: Obor' }));
    expect(screen.getByRole('dialog').textContent).toContain('Note: Obor');

    const shown = (document.querySelector('textarea') as HTMLTextAreaElement).value;
    fireEvent.click(screen.getByRole('button', { name: /Save Note/ }));
    expect({ shown, saved: game.saveNote.mock.calls[0] }).toEqual({ shown: 'OBOR NOTE', saved: ['Obor', 'OBOR NOTE'] });
  }, 30_000);
});
