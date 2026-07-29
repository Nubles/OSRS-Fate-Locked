// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RUNELITE_PAIRING_SUCCESS_COPY } from '../utils/runelitePairing';
import { RunelitePairingDialog, RunelitePairingDialogProps } from './RunelitePairingDialog';

afterEach(cleanup);

const renderDialog = (
  overrides: Partial<RunelitePairingDialogProps> = {},
) => {
  const props: RunelitePairingDialogProps = {
    code: '0123456789abcdef0123456789abcdef',
    replacing: false,
    profileName: 'Main profile',
    linkedAccount: 'Nubles UIM',
    proofCount: 0,
    proofSourceVersion: 'No current proof source',
    phase: 'confirm',
    onConfirm: vi.fn(),
    onRetry: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<RunelitePairingDialog {...props} />) };
};

describe('RunelitePairingDialog', () => {
  it('confirms the selected profile and warns before replacement', async () => {
    const user = userEvent.setup();
    const { props } = renderDialog({ replacing: true });

    expect(screen.getByText('Main profile')).toBeTruthy();
    expect(screen.getByText('Nubles UIM')).toBeTruthy();
    expect(screen.getByText(/replace the current RuneLite connection/i))
      .toBeTruthy();
    expect(screen.getByText(/RuneLite does not upload gameplay data/i))
      .toBeTruthy();

    await user.click(screen.getByRole('button', {
      name: /connect tracker/i,
    }));
    expect(props.onConfirm).toHaveBeenCalledTimes(1);
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('shows the compact proof count and exact source version being synced', () => {
    renderDialog({
      proofCount: 3,
      proofSourceVersion: 'sha256-3fdaffad',
    } as any);
    expect(screen.getByText('3 current proofs')).toBeTruthy();
    expect(screen.getByText('sha256-3fdaffad')).toBeTruthy();
  });
  it('shows the unbound-account fallback', () => {
    renderDialog({ linkedAccount: null });
    expect(screen.getByText('No bound account')).toBeTruthy();
  });

  it('renders uploading, success, and retryable error phases', async () => {
    const user = userEvent.setup();
    const uploading = renderDialog({ phase: 'uploading' });
    expect(screen.getByText(/sending profile/i)).toBeTruthy();
    expect((screen.getByRole('button', {
      name: /sending/i,
    }) as HTMLButtonElement).disabled).toBe(true);
    uploading.unmount();

    const success = renderDialog({ phase: 'success' });
    expect(screen.getByText(RUNELITE_PAIRING_SUCCESS_COPY)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(success.props.onClose).toHaveBeenCalledTimes(1);
    success.unmount();

    const failure = renderDialog({
      phase: 'error',
      error: 'relay offline',
    });
    expect(screen.getByText('relay offline')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(failure.props.onRetry).toHaveBeenCalledTimes(1);
  });

  it('cancels from the button or backdrop without inner propagation', async () => {
    const user = userEvent.setup();
    const button = renderDialog();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(button.props.onClose).toHaveBeenCalledTimes(1);
    button.unmount();

    const backdrop = renderDialog();
    fireEvent.click(screen.getByRole('dialog'));
    expect(backdrop.props.onClose).toHaveBeenCalledTimes(1);
    backdrop.unmount();

    const inner = renderDialog();
    fireEvent.click(screen.getByText('Main profile'));
    expect(inner.props.onClose).not.toHaveBeenCalled();
  });
});
