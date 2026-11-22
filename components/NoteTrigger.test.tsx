/* @vitest-environment jsdom */
// The note editor always opens on the saved note of the entry it names (a new
// id, a replaced run or a cancelled draft never carries over), and it cannot
// produce a note longer than the save validator's MAX_NOTE_CHARS.
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const game = vi.hoisted(() => ({
  userNotes: {} as Record<string, string>,
  saveNote: vi.fn(),
}));

vi.mock('../context/GameContext', async () => {
  const actual = await vi.importActual<typeof import('../context/GameContext')>('../context/GameContext');
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

import { NoteTrigger } from './NoteTrigger';
import { OsrsWorldList } from './osrs/OsrsWorldList';
import { MAX_NOTE_CHARS } from '../utils/saveSchema';

afterEach(() => {
  cleanup();
  game.userNotes = {};
  game.saveNote.mockReset();
});

const editor = () => document.querySelector('textarea') as HTMLTextAreaElement;

describe('NoteTrigger', () => {
  it('shows the note of the id it is given now, not the one it was mounted with', () => {
    game.userNotes = { Misthalin: 'MISTHALIN NOTE', Asgarnia: 'ASGARNIA NOTE' };
    const view = render(<NoteTrigger id="Misthalin" title="Misthalin" />);
    // The parent now shows another region in the same place (no key).
    view.rerender(<NoteTrigger id="Asgarnia" title="Asgarnia" />);

    fireEvent.click(screen.getByRole('button', { name: 'View note: Asgarnia' }));
    expect(screen.getByRole('dialog').textContent).toContain('Note: Asgarnia');
    expect(editor().value).toBe('ASGARNIA NOTE');
  });

  it('drops an unsaved draft on Cancel', () => {
    game.userNotes = { Attack: 'SAVED NOTE' };
    render(<NoteTrigger id="Attack" title="Attack" />);
    fireEvent.click(screen.getByRole('button', { name: 'View note: Attack' }));
    fireEvent.change(editor(), { target: { value: 'half-typed draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(game.saveNote).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'View note: Attack' }));
    expect(editor().value).toBe('SAVED NOTE');
  });

  it('shows the new run\'s note after the run is replaced under it (import, reset)', () => {
    game.userNotes = { Attack: 'OLD RUN NOTE' };
    const view = render(<NoteTrigger id="Attack" title="Attack" />);
    // Import / sync code / restore / reset replace the state; the tree stays mounted.
    game.userNotes = { Attack: 'IMPORTED RUN NOTE' };
    view.rerender(<NoteTrigger id="Attack" title="Attack" />);

    fireEvent.click(screen.getByRole('button', { name: 'View note: Attack' }));
    expect(editor().value).toBe('IMPORTED RUN NOTE');
  });
});

describe('OSRS layout World list', () => {
  it('opens the chosen region\'s own note, and Save does not copy another region\'s note over it', () => {
    game.userNotes = { Misthalin: 'MISTHALIN NOTE', Asgarnia: 'ASGARNIA NOTE' };
    render(<OsrsWorldList searchQuery="" showOnlyActionable={false} onUnlockArea={() => {}} suspendModals={false} viewButtons={null} />);

    // Misthalin is selected first; choose Asgarnia in the region directory.
    fireEvent.click(document.querySelector('[data-region-card="Asgarnia"]') as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: 'View note: Asgarnia' }));
    expect(screen.getByRole('dialog').textContent).toContain('Note: Asgarnia');

    const shown = editor().value;
    fireEvent.click(screen.getByRole('button', { name: /Save Note/ }));
    // What the player sees, and what a plain Save writes back:
    expect({ shown, saved: game.saveNote.mock.calls[0] }).toEqual({ shown: 'ASGARNIA NOTE', saved: ['Asgarnia', 'ASGARNIA NOTE'] });
  });
});

describe('NoteTrigger length limit', () => {
  it('caps the editor at MAX_NOTE_CHARS, says so near the limit, and never saves a longer note', () => {
    render(<NoteTrigger id="Attack" title="Attack" />);
    fireEvent.click(screen.getByRole('button', { name: 'Add note: Attack' }));
    expect(editor().maxLength).toBe(MAX_NOTE_CHARS);
    expect(screen.queryByText(/Notes are capped/)).toBeNull();

    // A paste the browser did not cut (maxLength is not enforced on scripted changes).
    fireEvent.change(editor(), { target: { value: 'x'.repeat(MAX_NOTE_CHARS + 5) } });
    expect(screen.getByText(/Notes are capped at this length/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Save Note/ }));
    expect(game.saveNote).toHaveBeenCalledTimes(1);
    expect(game.saveNote.mock.calls[0][1]).toHaveLength(MAX_NOTE_CHARS);
  });
});
