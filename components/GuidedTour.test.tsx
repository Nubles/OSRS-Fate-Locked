// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { GuidedTour } from './GuidedTour';

afterEach(() => cleanup());

describe('GuidedTour keyboard', () => {
  it('advances one step when Enter activates the focused Next button', () => {
    render(<GuidedTour />);
    act(() => { window.dispatchEvent(new Event('fate:start-tour')); });
    expect(screen.getByText('Welcome to Fate Locked')).toBeTruthy();

    const next = screen.getByRole('button', { name: /Next/ });
    next.focus();
    // A browser delivers the keydown (which bubbles to window) and then
    // activates the focused button with a click.
    fireEvent.keyDown(next, { key: 'Enter' });
    fireEvent.click(next);

    expect(screen.getByText('1 · Farm keys')).toBeTruthy();
  });

  it('still advances on Enter when no control has focus', () => {
    render(<GuidedTour />);
    act(() => { window.dispatchEvent(new Event('fate:start-tour')); });

    fireEvent.keyDown(window, { key: 'Enter' });

    expect(screen.getByText('1 · Farm keys')).toBeTruthy();
  });
});
