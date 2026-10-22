// @vitest-environment jsdom

import React, { useRef, useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DropdownMenu } from './DropdownMenu';

/** A header with a blurred backdrop (the case that broke) holding the menu, beside a page button. */
const Harness: React.FC<{ onPage: () => void; onImport: () => void }> = ({ onPage, onImport }) => {
  const [open, setOpen] = useState(false);
  const gear = useRef<HTMLButtonElement>(null);
  return (
    <>
      <header style={{ backdropFilter: 'blur(4px)' }}>
        <button ref={gear} aria-label="Settings" aria-expanded={open} onClick={() => setOpen(v => !v)}>Gear</button>
        {open && (
          <DropdownMenu anchorRef={gear} onClose={() => setOpen(false)} label="Settings" width={224}>
            <button type="button" role="menuitem" onClick={() => { setOpen(false); onImport(); }}>Import save</button>
            <button type="button" role="menuitemcheckbox" aria-checked={false}>Animations</button>
            <button type="button" role="menuitem">Reset all progress</button>
          </DropdownMenu>
        )}
      </header>
      <main><button onClick={onPage}>Add Note</button></main>
    </>
  );
};

afterEach(cleanup);

describe('DropdownMenu', () => {
  it('renders on document.body as a menu, outside the header, and focuses the first item', async () => {
    const user = userEvent.setup();
    render(<Harness onPage={vi.fn()} onImport={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Settings' }));

    const menu = screen.getByRole('menu', { name: 'Settings' });
    expect(menu.parentElement).toBe(document.body);
    expect(menu.closest('header')).toBeNull();
    expect(screen.getByTestId('menu-dismiss').parentElement).toBe(document.body);
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Import save' }));
  });

  it('closes on Escape and gives focus back to the button', async () => {
    const user = userEvent.setup();
    render(<Harness onPage={vi.fn()} onImport={vi.fn()} />);
    const gear = screen.getByRole('button', { name: 'Settings' });
    await user.click(gear);
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(gear);
    expect(gear.getAttribute('aria-expanded')).toBe('false');
  });

  it('closes on a click outside without the click reaching the page underneath', async () => {
    const onPage = vi.fn();
    const user = userEvent.setup();
    render(<Harness onPage={onPage} onImport={vi.fn()} />);
    const gear = screen.getByRole('button', { name: 'Settings' });
    await user.click(gear);

    // The full-window layer sits over the page, so it takes the click.
    fireEvent.click(screen.getByTestId('menu-dismiss'));

    expect(screen.queryByRole('menu')).toBeNull();
    expect(onPage).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(gear);
    expect(screen.queryByTestId('menu-dismiss')).toBeNull();
  });

  it('moves between items with the arrow keys, wrapping, and Tab leaves to the button', async () => {
    const user = userEvent.setup();
    render(<Harness onPage={vi.fn()} onImport={vi.fn()} />);
    const gear = screen.getByRole('button', { name: 'Settings' });
    await user.click(gear);

    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(screen.getByRole('menuitemcheckbox', { name: 'Animations' }));
    await user.keyboard('{End}');
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Reset all progress' }));
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Import save' }));

    await user.keyboard('{Tab}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(gear);
  });

  it('runs an item and closes', async () => {
    const onImport = vi.fn();
    const user = userEvent.setup();
    render(<Harness onPage={vi.fn()} onImport={onImport} />);
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(screen.getByRole('menuitem', { name: 'Import save' }));

    expect(onImport).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
