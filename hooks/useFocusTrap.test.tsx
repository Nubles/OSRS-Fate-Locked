// @vitest-environment jsdom
import React, { useRef, useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { useFocusTrap } from './useFocusTrap';

// jsdom has no layout, so every element reports a null offsetParent and would
// count as hidden. Treat attached elements as visible for these tests.
const offsetParent = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetParent');
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    configurable: true,
    get() { return (this as HTMLElement).parentNode; },
  });
});
afterAll(() => {
  if (offsetParent) Object.defineProperty(HTMLElement.prototype, 'offsetParent', offsetParent);
});
afterEach(() => cleanup());

const Dialog: React.FC<{ autoFocusSearch?: boolean }> = ({ autoFocusSearch }) => {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref);
  return (
    <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Test dialog">
      <button type="button">First</button>
      <input aria-label="Search" autoFocus={autoFocusSearch} />
      <button type="button">Last</button>
    </div>
  );
};

const Host: React.FC<{ autoFocusSearch?: boolean }> = ({ autoFocusSearch }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(o => !o)}>Opener</button>
      {open && <Dialog autoFocusSearch={autoFocusSearch} />}
    </>
  );
};

describe('useFocusTrap', () => {
  it('moves focus in, wraps Tab at both ends, and returns focus to the opener', () => {
    render(<Host />);
    const opener = screen.getByRole('button', { name: 'Opener' });
    opener.focus();
    fireEvent.click(opener);

    const first = screen.getByRole('button', { name: 'First' });
    const last = screen.getByRole('button', { name: 'Last' });
    expect(document.activeElement).toBe(first);

    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(document.activeElement).toBe(first);

    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);

    act(() => { opener.click(); });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('keeps an autoFocus field focused and still returns focus to the opener', () => {
    render(<Host autoFocusSearch />);
    const opener = screen.getByRole('button', { name: 'Opener' });
    opener.focus();
    fireEvent.click(opener);

    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Search' }));

    act(() => { opener.click(); });
    expect(document.activeElement).toBe(opener);
  });
});
