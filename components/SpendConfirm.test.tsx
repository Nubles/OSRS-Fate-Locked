// @vitest-environment jsdom
// The Yes / No box Ask before Key clicks shows (components/SpendConfirm.tsx):
// Esc closes only the box, a held key can't answer it, and Tab stays inside it.
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { confirmSpendPref } from '../utils/viewerPrefs';
import { confirmThen } from '../utils/spendConfirm';
import { useEscapeKey } from '../hooks/useEscapeKey';

afterEach(async () => {
  const no = screen.queryByRole('button', { name: 'No' });
  if (no) await act(async () => { no.click(); await new Promise(resolve => setTimeout(resolve, 20)); });
  cleanup();
  confirmSpendPref.set(false);
});

const Window: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  useEscapeKey(onClose);
  return <div role="dialog" aria-label="Skill detail"><button type="button">Roll 5 levels</button></div>;
};

const openBox = async (act_: () => void = () => {}) => {
  confirmSpendPref.set(true);
  confirmThen('Spend a Key on Skills?', act_);
  const yes = await screen.findByRole('button', { name: 'Yes' }, { timeout: 10_000 });
  // The box takes the keys in the same effect that focuses Yes, and on a busy machine that effect
  // can run a moment after the button shows. A key sent before it reaches the page behind.
  await waitFor(() => expect(document.activeElement).toBe(yes));
  return yes;
};

describe('the Yes / No box', () => {
  it('answers No on Esc and leaves the window that asked open', async () => {
    const onClose = vi.fn();
    const spend = vi.fn();
    render(<Window onClose={onClose} />);
    screen.getByRole('button', { name: 'Roll 5 levels' }).focus();
    const yes = await openBox(spend);

    await act(async () => { fireEvent.keyDown(yes, { key: 'Escape' }); await Promise.resolve(); });
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(spend).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    // With the box gone, Esc closes the window as before.
    fireEvent.keyDown(document.activeElement ?? window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  }, 30_000);

  it('does not take an auto-repeat of the key that opened it as an answer', async () => {
    const yes = await openBox();
    expect(document.activeElement).toBe(yes);
    // The browser activates a focused button on a keydown nobody prevented.
    expect(fireEvent.keyDown(yes, { key: 'Enter', repeat: true })).toBe(false);
    expect(fireEvent.keyDown(yes, { key: ' ', repeat: true })).toBe(false);
    // A fresh press still says Yes.
    expect(fireEvent.keyDown(yes, { key: 'Enter' })).toBe(true);
  }, 30_000);

  it('keeps Tab and Shift+Tab between Yes and No', async () => {
    render(<div><button type="button">Page button before</button><button type="button">Page button after</button></div>);
    screen.getByRole('button', { name: 'Page button before' }).focus();
    const yes = await openBox();
    const no = screen.getByRole('button', { name: 'No' });
    const user = userEvent.setup();
    await user.tab();
    expect(document.activeElement).toBe(no);
    await user.tab();
    expect(document.activeElement).toBe(yes);
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(no);
  }, 30_000);
});
