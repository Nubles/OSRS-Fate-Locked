// @vitest-environment jsdom
import React, { act } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameProvider } from '../context/GameContext';
import { CommandPalette } from './CommandPalette';

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
    await user.type(input, 'guardian warnings rendering');

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
