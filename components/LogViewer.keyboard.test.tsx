// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LogViewer } from './LogViewer';

vi.mock('../context/GameContext', () => ({
  useGame: () => ({
    history: [
      { id: 'a', timestamp: 1, type: 'ROLL_SUCCESS', message: 'Key Found!', result: 'SUCCESS', source: 'Attack level 42', rollValue: 3, threshold: 9 },
      { id: 'b', timestamp: 2, type: 'UNLOCK', message: 'Unlocked Varrock', source: 'Areas' },
    ],
  }),
}));
// jsdom has no layout, so the real AutoSizer measures 0 x 0 and draws nothing.
vi.mock('react-virtualized-auto-sizer', () => ({
  default: ({ children }: { children: (size: { height: number; width: number }) => React.ReactNode }) => <>{children({ height: 320, width: 480 })}</>,
}));

afterEach(cleanup);

describe('LogViewer keyboard access', () => {
  it('lets the keyboard reach the list, whose rows hold no controls, to scroll it', () => {
    render(<LogViewer />);
    const list = screen.getByRole('region', { name: 'History entries' });
    expect(list.tabIndex).toBe(0);
    // The virtual list's own class, size and scrolling still land on the same element.
    expect(list.classList.contains('custom-scrollbar')).toBe(true);
    expect(list.style.overflow).toBe('auto');
    expect(list.style.height).toBe('320px');
    expect(list.textContent).toContain('Key Found!');
    expect(list.querySelector('button, a[href], input, select, textarea')).toBeNull();
  });
});
