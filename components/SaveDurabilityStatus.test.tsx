// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SaveDurabilitySnapshot } from '../utils/recoveryTypes';
import { SaveDurabilityStatus } from './SaveDurabilityStatus';

const NOW = 1_700_000_000_000;

afterEach(cleanup);

const snapshot = (
  primary: SaveDurabilitySnapshot['primary'],
  recovery: SaveDurabilitySnapshot['recovery'],
  savedAt: number | null = null,
): SaveDurabilitySnapshot => ({ primary, recovery, savedAt });

describe('SaveDurabilityStatus', () => {
  it.each([
    [snapshot('saving', 'checking'), 'Saving…'],
    [snapshot('saved', 'protected', NOW), 'Saved just now'],
    [snapshot('saved', 'degraded', NOW), 'Saved, backup protection unavailable'],
    [snapshot('failed', 'degraded'), "Progress isn't being saved"],
  ] as const)('renders the durable status %s as %s', (current, label) => {
    render(<SaveDurabilityStatus snapshot={current} now={NOW} />);
    expect(screen.getByText(label)).toBeTruthy();
  });

  it('shows a useful relative saved time without exposing save bytes', () => {
    render(
      <SaveDurabilityStatus
        snapshot={snapshot('saved', 'protected', NOW - 90_000)}
        now={NOW}
      />,
    );

    expect(screen.getByText('Saved 2m ago')).toBeTruthy();
    expect(screen.queryByText(/FATE_PROFILE|\{"/)).toBeNull();
  });

  it('offers degraded recovery actions and awaits a retry while disabling it', async () => {
    let resolveRetry: ((result: boolean) => void) | undefined;
    const retrySave = vi.fn(() => new Promise<boolean>(resolve => {
      resolveRetry = resolve;
    }));
    const exportBackup = vi.fn(() => ({ ok: true as const }));
    const user = userEvent.setup();

    render(
      <SaveDurabilityStatus
        snapshot={snapshot('saved', 'degraded', NOW)}
        now={NOW}
        retrySave={retrySave}
        exportBackup={exportBackup}
      />,
    );

    const retry = screen.getByRole('button', { name: 'Retry protection' });
    await user.click(retry);
    expect((retry as HTMLButtonElement).disabled).toBe(true);
    expect(retrySave).toHaveBeenCalledOnce();

    await act(async () => {
      resolveRetry?.(true);
      await Promise.resolve();
    });

    expect((retry as HTMLButtonElement).disabled).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Export backup' }));
    expect(exportBackup).toHaveBeenCalledOnce();
  });

  it('announces a state transition but not a saved timestamp refresh', () => {
    const { rerender } = render(
      <SaveDurabilityStatus
        snapshot={snapshot('saved', 'protected', NOW)}
        now={NOW}
      />,
    );

    const announcement = screen.getByRole('status');
    expect(announcement.textContent).toContain('Progress saved');

    rerender(
      <SaveDurabilityStatus
        snapshot={snapshot('saved', 'protected', NOW - 120_000)}
        now={NOW}
      />,
    );
    expect(announcement.textContent).toContain('Progress saved');
    expect(announcement.textContent).not.toContain('2m ago');

    rerender(
      <SaveDurabilityStatus
        snapshot={snapshot('saved', 'degraded', NOW - 120_000)}
        now={NOW}
      />,
    );
    expect(screen.getByRole('status').textContent).toContain(
      'backup protection is unavailable',
    );
  });
});
