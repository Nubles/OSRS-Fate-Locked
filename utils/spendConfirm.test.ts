// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { confirmThen } from './spendConfirm';
import { confirmSpendPref } from './viewerPrefs';

describe('confirmThen', () => {
  afterEach(() => { confirmSpendPref.set(false); document.body.innerHTML = ''; });

  it('acts straight away while Ask before Key clicks is off', () => {
    confirmSpendPref.set(false);
    const act = vi.fn();
    confirmThen('Level up Attack and roll for a Key?', act);
    expect(act).toHaveBeenCalledTimes(1);
  });

  it('acts only after a Yes while it is on, and never after a No', async () => {
    confirmSpendPref.set(true);
    const act = vi.fn();
    confirmThen('Level up Attack and roll for a Key?', act);
    fireEvent.click(await screen.findByRole('button', { name: 'No' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(act).not.toHaveBeenCalled();

    confirmThen('Level up Attack and roll for a Key?', act);
    expect(await screen.findByText('Level up Attack and roll for a Key?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    await waitFor(() => expect(act).toHaveBeenCalledTimes(1));
  });

  it('counts a second click while the box is open as a No', async () => {
    confirmSpendPref.set(true);
    const first = vi.fn();
    const second = vi.fn();
    confirmThen('Roll for a Key from Clue (Easy)?', first);
    confirmThen('Roll for a Key from Clue (Easy)?', second);
    fireEvent.click(await screen.findByRole('button', { name: 'Yes' }));
    await waitFor(() => expect(first).toHaveBeenCalledTimes(1));
    expect(second).not.toHaveBeenCalled();
    expect(screen.queryAllByRole('alertdialog')).toHaveLength(0);
  });
});
