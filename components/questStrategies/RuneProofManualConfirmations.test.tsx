// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { RuneProofManualConfirmations } from './RuneProofManualConfirmations';

afterEach(cleanup);

const confirmation = {
  id: 'manual:preflight',
  prompt: 'I have checked the reviewed one-way consequence.',
  scopes: ['PREFLIGHT'],
  evidenceIds: ['review:manual'],
  confirmed: false,
} as const;

it('writes the exact pending manual requirement ID and prompt', () => {
  const onSetManualConfirmed = vi.fn();
  render(<RuneProofManualConfirmations
    confirmations={[confirmation]}
    onSetManualConfirmed={onSetManualConfirmed}
  />);
  expect(screen.getByText('PREFLIGHT')).toBeTruthy();
  expect(screen.getByText(/review:manual/)).toBeTruthy();
  const checkbox = screen.getByRole('checkbox', {
    name: 'I have checked the reviewed one-way consequence.',
  }) as HTMLInputElement;
  fireEvent.click(checkbox);
  expect(onSetManualConfirmed).toHaveBeenCalledWith('manual:preflight', true);
  expect(checkbox.checked).toBe(false);
});

it('unconfirms only after persisted progress marks the exact prompt confirmed', () => {
  const onSetManualConfirmed = vi.fn();
  const { rerender } = render(<RuneProofManualConfirmations
    confirmations={[confirmation]}
    onSetManualConfirmed={onSetManualConfirmed}
  />);
  rerender(<RuneProofManualConfirmations
    confirmations={[{ ...confirmation, confirmed: true }]}
    onSetManualConfirmed={onSetManualConfirmed}
  />);
  fireEvent.click(screen.getByRole('checkbox', { name: confirmation.prompt }));
  expect(onSetManualConfirmed).toHaveBeenCalledWith('manual:preflight', false);
});
