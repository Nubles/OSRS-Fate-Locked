// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SaveDurabilitySnapshot } from '../utils/recoveryTypes';
import { SaveDurabilityStatus } from './SaveDurabilityStatus';

const NOW = 1_700_000_000_000;
const toast = vi.hoisted(() => ({ showToast: vi.fn() }));

vi.mock('../utils/toast', () => toast);

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  toast.showToast.mockClear();
});

const snapshot = (
  primary: SaveDurabilitySnapshot['primary'],
  recovery: SaveDurabilitySnapshot['recovery'],
  savedAt: number | null = null,
): SaveDurabilitySnapshot => ({ primary, recovery, savedAt });

describe('SaveDurabilityStatus', () => {
  it.each([
    [snapshot('saving', 'checking'), 'Saving…'],
    [snapshot('saving', 'protected'), 'Saving…'],
    [snapshot('saving', 'degraded'), 'Saving…'],
    [snapshot('saved', 'checking', NOW), 'Saved just now'],
    [snapshot('saved', 'protected', NOW), 'Saved just now'],
    [snapshot('saved', 'degraded', NOW), 'Saved, backup protection unavailable'],
    [snapshot('failed', 'degraded'), "Progress isn't being saved"],
    [snapshot('failed', 'checking'), "Progress isn't being saved"],
    [snapshot('failed', 'protected'), "Progress isn't being saved"],
  ] as const)('renders every durability combination %s as %s', (current, label) => {
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

  it('refreshes relative saved time on a bounded timer and clears it on unmount', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const rendered = render(
      <SaveDurabilityStatus snapshot={snapshot('saved', 'protected', NOW)} />,
    );

    expect(screen.getByText('Saved just now')).toBeTruthy();
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByText('Saved 1m ago')).toBeTruthy();

    rendered.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('describes a degraded retry from its full durability snapshot', async () => {
    const retrySave = vi.fn().mockResolvedValue(
      snapshot('saved', 'degraded', NOW),
    );
    const user = userEvent.setup();
    render(
      <SaveDurabilityStatus
        snapshot={snapshot('saved', 'degraded', NOW)}
        now={NOW}
        retrySave={retrySave}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Retry protection' }));

    expect(toast.showToast).toHaveBeenCalledWith(
      'Progress saved, but backup protection remains unavailable',
    );
  });

  it('does not toast after a retry finishes for an unmounted profile', async () => {
    let resolveRetry: ((result: SaveDurabilitySnapshot) => void) | undefined;
    const retrySave = vi.fn(() => new Promise<SaveDurabilitySnapshot>(resolve => {
      resolveRetry = resolve;
    }));
    const user = userEvent.setup();
    const rendered = render(
      <SaveDurabilityStatus
        snapshot={snapshot('saved', 'degraded', NOW)}
        now={NOW}
        retrySave={retrySave}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Retry protection' }));
    rendered.unmount();
    await act(async () => {
      resolveRetry?.(snapshot('saved', 'protected', NOW));
      await Promise.resolve();
    });

    expect(toast.showToast).not.toHaveBeenCalled();
  });

  it('shows safe feedback when a retry rejects without exposing the error', async () => {
    const retrySave = vi.fn().mockRejectedValue(new Error('raw save bytes'));
    const user = userEvent.setup();
    render(
      <SaveDurabilityStatus
        snapshot={snapshot('saved', 'degraded', NOW)}
        now={NOW}
        retrySave={retrySave}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Retry protection' }));

    expect(toast.showToast).toHaveBeenCalledWith(
      'Backup protection is still unavailable',
    );
    expect(toast.showToast).not.toHaveBeenCalledWith(expect.stringContaining('raw save bytes'));
  });
});
