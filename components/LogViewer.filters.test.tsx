// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LogViewer } from './LogViewer';

vi.mock('../context/GameContext', () => ({
  useGame: () => ({ history: [] }),
}));

afterEach(cleanup);

describe('LogViewer filters', () => {
  it('keeps the same filter button, and its focus, after filtering', () => {
    render(<LogViewer />);
    const rolls = screen.getByRole('button', { name: 'Rolls' });
    rolls.focus();

    fireEvent.click(rolls);

    expect(screen.getByRole('button', { name: 'Rolls' })).toBe(rolls);
    expect(document.activeElement).toBe(rolls);
  });
});
