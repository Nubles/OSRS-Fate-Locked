// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setUiStyle } from '../../utils/uiStyle';
import { OSRS_EXAMINE_EVENT, OsrsContextMenu } from './OsrsContextMenu';

const stored = new Map<string, string>();

beforeEach(() => {
  stored.clear();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => { stored.set(key, value); },
    removeItem: (key: string) => { stored.delete(key); },
  });
  setUiStyle('osrs');
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const renderWithTarget = () => render(
  <>
    <button type="button" data-examine="The beginner Slayer master." data-examine-name="Turael" data-examine-kind="npc">Turael</button>
    <span>Plain text</span>
    <OsrsContextMenu />
  </>,
);

describe('OSRS right-click menu', () => {
  it('opens on an examinable element with Examine <name> and Cancel', () => {
    renderWithTarget();
    const opened = fireEvent.contextMenu(screen.getByText('Turael', { selector: 'button' }), { clientX: 100, clientY: 80 });
    expect(opened).toBe(false); // browser menu suppressed
    expect(screen.getByRole('menu', { name: 'Choose Option' })).toBeTruthy();
    const items = screen.getAllByRole('menuitem').map((item) => item.textContent);
    expect(items).toEqual(['Examine Turael', 'Cancel']);
  });

  it('leaves the browser menu alone over anything else', () => {
    renderWithTarget();
    expect(fireEvent.contextMenu(screen.getByText('Plain text'))).toBe(true);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('does nothing in the classic layout', () => {
    renderWithTarget();
    act(() => setUiStyle('classic'));
    expect(fireEvent.contextMenu(screen.getByText('Turael', { selector: 'button' }))).toBe(true);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('Examine dispatches the examine event and shows the game message', () => {
    renderWithTarget();
    const seen = vi.fn();
    window.addEventListener(OSRS_EXAMINE_EVENT, seen);
    fireEvent.contextMenu(screen.getByText('Turael', { selector: 'button' }), { clientX: 100, clientY: 80 });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Examine Turael' }));
    window.removeEventListener(OSRS_EXAMINE_EVENT, seen);
    expect(seen).toHaveBeenCalledTimes(1);
    expect((seen.mock.calls[0][0] as CustomEvent).detail).toEqual({ name: 'Turael', text: 'The beginner Slayer master.' });
    expect(screen.getByRole('status').textContent).toBe('The beginner Slayer master.');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('skips its own toast when a listener prints the line itself', () => {
    renderWithTarget();
    const handle = (event: Event) => event.preventDefault();
    window.addEventListener(OSRS_EXAMINE_EVENT, handle);
    fireEvent.contextMenu(screen.getByText('Turael', { selector: 'button' }), { clientX: 100, clientY: 80 });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Examine Turael' }));
    window.removeEventListener(OSRS_EXAMINE_EVENT, handle);
    expect(screen.getByRole('status', { hidden: true }).textContent).toBe('');
  });

  it('closes on Escape and returns focus to the target', () => {
    renderWithTarget();
    const target = screen.getByText('Turael', { selector: 'button' });
    fireEvent.contextMenu(target, { clientX: 100, clientY: 80 });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(target);
  });

  it('closes on a click elsewhere and on Cancel', () => {
    renderWithTarget();
    const target = screen.getByText('Turael', { selector: 'button' });
    fireEvent.contextMenu(target, { clientX: 100, clientY: 80 });
    fireEvent.pointerDown(screen.getByText('Plain text'));
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.contextMenu(target, { clientX: 100, clientY: 80 });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Cancel' }));
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
