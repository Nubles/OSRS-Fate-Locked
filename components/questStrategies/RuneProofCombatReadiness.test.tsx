// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { RuneProofCombatReadiness } from './RuneProofCombatReadiness';

afterEach(cleanup);

const model = {
  actionId: 'guardian:encounter',
  id: 'guardian',
  title: 'Guardian readiness',
  encounterSummary: 'One reviewed encounter.',
  phases: ['Opening'],
  mandatoryMechanics: ['Avoid the marked tile.'],
  recommendedCapabilities: ['A reviewed damage option'],
  recommendedSupplies: ['Food'],
  deathEscapeReentryNotes: ['Escape through the entrance.', 'Re-enter there.'],
  deterministicBlockers: ['Raise Mining to 99.'],
  confirmationId: 'combat:guardian:ready',
  confirmed: false,
} as const;

it('shows every reviewed combat field and records only the explicit readiness ID', () => {
  const onSetConfirmed = vi.fn();
  render(<RuneProofCombatReadiness
    model={model}
    onSetConfirmed={onSetConfirmed}
  />);
  expect(screen.getByText('One reviewed encounter.')).toBeTruthy();
  expect(screen.getByText('Opening')).toBeTruthy();
  expect(screen.getByText('Avoid the marked tile.')).toBeTruthy();
  expect(screen.getByText('A reviewed damage option')).toBeTruthy();
  expect(screen.getByText('Food')).toBeTruthy();
  expect(screen.getByText('Escape through the entrance.')).toBeTruthy();
  expect(screen.getByText('Re-enter there.')).toBeTruthy();
  expect(screen.getByText('Raise Mining to 99.')).toBeTruthy();
  expect(screen.queryByText(/impossible/i)).toBeNull();
  fireEvent.click(screen.getByRole('checkbox', {
    name: 'I am ready to follow this reviewed guide. This confirms my choice; it does not prove my gear, reflexes, combat skill, or risk tolerance.',
  }));
  expect(onSetConfirmed).toHaveBeenCalledWith('combat:guardian:ready', true);
});

it('stays controlled until the persisted combat model changes', () => {
  const onSetConfirmed = vi.fn();
  const { rerender } = render(<RuneProofCombatReadiness
    model={model}
    onSetConfirmed={onSetConfirmed}
  />);
  const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
  fireEvent.click(checkbox);
  expect(checkbox.checked).toBe(false);

  rerender(<RuneProofCombatReadiness
    model={{ ...model, confirmed: true }}
    onSetConfirmed={onSetConfirmed}
  />);
  expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true);
  fireEvent.click(screen.getByRole('checkbox'));
  expect(onSetConfirmed).toHaveBeenLastCalledWith('combat:guardian:ready', false);
});
