// @vitest-environment jsdom
import React, { act } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameProvider } from '../context/GameContext';
import { CommandPalette } from './CommandPalette';
import { RIVAL_ENABLED } from '../config/rules';
import { useEscapeKey } from '../hooks/useEscapeKey';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const storedValues = new Map<string, string>();

beforeEach(() => {
  storedValues.clear();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storedValues.get(key) ?? null,
    setItem: (key: string, value: string) => storedValues.set(key, String(value)),
    removeItem: (key: string) => storedValues.delete(key),
    clear: () => storedValues.clear(),
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('CommandPalette RuneLite guide command', () => {
  it('finds the guide by support keywords and dispatches its navigation target', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    window.addEventListener('fate:nav', onNavigate);

    render(
      <GameProvider storageKey="command-palette-runelite-guide">
        <CommandPalette />
      </GameProvider>,
    );

    await act(async () => {
      window.dispatchEvent(new Event('fate:open-palette'));
    });
    const input = screen.getByRole('textbox');
    await user.type(input, 'strict mode alerts display');

    const command = await screen.findByRole('button', {
      name: /RuneLite Plugin Guide.*Install, connect, configure and troubleshoot RuneLite/i,
    });
    expect(command).toBeTruthy();

    await user.click(command);
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect((onNavigate.mock.calls[0]?.[0] as CustomEvent).detail).toEqual({
      target: 'open:runelite-guide',
    });

    window.removeEventListener('fate:nav', onNavigate);
  });
});

describe('CommandPalette Rival command', () => {
  it('lists the Rival only while it is switched on', async () => {
    const user = userEvent.setup();
    render(
      <GameProvider storageKey="command-palette-rival">
        <CommandPalette />
      </GameProvider>,
    );

    await act(async () => {
      window.dispatchEvent(new Event('fate:open-palette'));
    });
    await user.type(screen.getByRole('textbox'), 'rival');

    const rival = screen.queryByRole('button', { name: /Race a rival ghost/i });
    if (RIVAL_ENABLED) expect(rival).not.toBeNull();
    else expect(rival).toBeNull();
  });
});

// One Escape closes one layer (the same rule as the Yes / No box in SpendConfirm.tsx).
const RulesUnderPalette = () => {
  const [open, setOpen] = React.useState(true);
  useEscapeKey(() => setOpen(false), open);
  return open ? <div role="dialog" aria-label="Rules"><button type="button">inside rules</button></div> : null;
};

describe('CommandPalette Escape and focus', () => {
  const openPalette = async () => {
    await act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true })); });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 40)); });
    return screen.getByPlaceholderText(/Jump to a tab/);
  };

  it('closes only the palette on Escape and leaves the window under it open', async () => {
    render(
      <GameProvider storageKey="command-palette-escape-layer">
        <RulesUnderPalette />
        <CommandPalette />
      </GameProvider>,
    );
    const input = await openPalette();
    await act(async () => { fireEvent.keyDown(input, { key: 'Escape' }); });
    expect(screen.queryByRole('dialog', { name: 'Command palette' })).toBeNull();
    expect(screen.queryByRole('dialog', { name: 'Rules' })).not.toBeNull();
    // A second Escape, with the palette shut, reaches the window again.
    await act(async () => { fireEvent.keyDown(document.body, { key: 'Escape' }); });
    expect(screen.queryByRole('dialog', { name: 'Rules' })).toBeNull();
  });

  it('returns focus to the trigger after Escape or a backdrop click', async () => {
    render(
      <GameProvider storageKey="command-palette-escape-focus">
        <button type="button" data-tour="palette">open palette</button>
        <CommandPalette />
      </GameProvider>,
    );
    const trigger = screen.getByText('open palette');
    trigger.focus();
    let input = await openPalette();
    expect(document.activeElement).toBe(input);
    await act(async () => { fireEvent.keyDown(input, { key: 'Escape' }); });
    expect(document.activeElement).toBe(trigger);

    input = await openPalette();
    await act(async () => { fireEvent.mouseDown(screen.getByRole('dialog', { name: 'Command palette' })); });
    expect(screen.queryByRole('dialog', { name: 'Command palette' })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('keeps Tab inside the palette while it is open', async () => {
    // jsdom has no layout: treat attached elements as visible, as useFocusTrap.test.tsx does.
    const offsetParent = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetParent');
    Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
      configurable: true,
      get() { return (this as HTMLElement).parentNode; },
    });
    try {
    render(
      <GameProvider storageKey="command-palette-tab-trap">
        <button type="button" data-tour="palette">open palette</button>
        <CommandPalette />
      </GameProvider>,
    );
    const input = await openPalette();
    const dialog = screen.getByRole('dialog', { name: 'Command palette' });
    const focusables = Array.from(dialog.querySelectorAll<HTMLElement>('button, input'));
    const last = focusables[focusables.length - 1];
    last.focus();
    await act(async () => { fireEvent.keyDown(last, { key: 'Tab' }); });
    expect(document.activeElement).toBe(input);
    await act(async () => { fireEvent.keyDown(input, { key: 'Tab', shiftKey: true }); });
    expect(document.activeElement).toBe(last);
    } finally {
      if (offsetParent) Object.defineProperty(HTMLElement.prototype, 'offsetParent', offsetParent);
    }
  });
});
