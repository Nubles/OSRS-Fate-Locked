// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

describe('GuidedTour focus', () => {
  const openTourFrom = (label: string) => {
    render(<><button>{label}</button><GuidedTour /><button>After the tour</button></>);
    const opener = screen.getByRole('button', { name: label });
    opener.focus();
    act(() => { window.dispatchEvent(new Event('fate:start-tour')); });
    return opener;
  };

  it('moves focus into the card and keeps Tab and Shift+Tab inside it', async () => {
    const user = userEvent.setup();
    openTourFrom('Start the tour');
    const next = screen.getByRole('button', { name: /Next/ });
    const end = screen.getByRole('button', { name: 'End tour' });
    expect(document.activeElement).toBe(next);

    await user.tab();
    expect(document.activeElement).toBe(end);
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(next);

    await user.click(next);
    expect(screen.getByText('1 · Farm keys')).toBeTruthy();
    expect(document.activeElement).toBe(next);
    await user.tab();
    expect(document.activeElement).toBe(end);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /Back/ }));
  });

  it('refocuses the primary button when a step change removes the focused control', async () => {
    const user = userEvent.setup();
    openTourFrom('Start the tour');
    await user.click(screen.getByRole('button', { name: /Next/ }));

    // Back disappears on the first step, taking focus with it.
    await user.click(screen.getByRole('button', { name: /Back/ }));

    expect(screen.getByText('Welcome to Fate Locked')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /Next/ }));
  });

  it('hands focus back to what had it when the tour closes', async () => {
    const user = userEvent.setup();
    const opener = openTourFrom('Start the tour');

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Guided tour' })).toBeNull();
    expect(document.activeElement).toBe(opener);

    opener.focus();
    act(() => { window.dispatchEvent(new Event('fate:start-tour')); });
    await user.click(screen.getByRole('button', { name: 'End tour' }));
    expect(document.activeElement).toBe(opener);
  });
});
