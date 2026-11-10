/* @vitest-environment jsdom */
import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../context/GameContext', async () => {
  const actual = await vi.importActual<typeof import('../context/GameContext')>('../context/GameContext');
  const unlocks = {
    ...actual.initialState.unlocks,
    equipment: { ...actual.initialState.unlocks.equipment, Head: 2 },
  };
  return {
    ...actual,
    useGame: () => ({
      ...actual.initialState,
      unlocks,
      specialKeys: 0,
      saveNote: vi.fn(),
    }),
  };
});

import { EquipmentLab } from './EquipmentLab';
import { EQUIPMENT_SLOTS } from '../constants';
import { UI_STYLE_KEY, applyUiStyle } from '../utils/uiStyle';

beforeEach(() => {
  localStorage.setItem(UI_STYLE_KEY, 'classic');
  applyUiStyle();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('classic Equipment Lab, Plan', () => {
  // The two step buttons beside each slot's target hold only an icon. Without
  // a label a screen reader said "button" twenty-two times.
  it('names the lower and raise button of every slot', () => {
    render(<EquipmentLab onUpgrade={() => {}} suspendModals />);
    fireEvent.click(screen.getByRole('button', { name: /Plan/ }));

    for (const slot of EQUIPMENT_SLOTS) {
      expect(screen.getByRole('button', { name: `Lower ${slot} target` })).toBeTruthy();
      expect(screen.getByRole('button', { name: `Raise ${slot} target` })).toBeTruthy();
    }
    const plan = screen.getByText('Target loadout').closest('div.space-y-3') as HTMLElement;
    const unnamed = within(plan).getAllByRole('button').filter((b) => !(b.getAttribute('aria-label') || b.textContent || '').trim());
    expect(unnamed).toEqual([]);
  });

  it('raises a slot by its named button and keeps the lower button off at the current tier', () => {
    render(<EquipmentLab onUpgrade={() => {}} suspendModals />);
    fireEvent.click(screen.getByRole('button', { name: /Plan/ }));

    const lower = screen.getByRole('button', { name: 'Lower Head target' }) as HTMLButtonElement;
    expect(lower.disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Raise Head target' }));
    expect(lower.disabled).toBe(false);
    expect(lower.parentElement?.textContent).toContain('T3');
  });
});
