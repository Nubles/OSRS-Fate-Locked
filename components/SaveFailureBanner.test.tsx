// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SaveDurabilitySnapshot } from '../utils/recoveryTypes';
import { SaveFailureBannerView } from './SaveFailureBanner';

const toast = vi.hoisted(() => ({ showToast: vi.fn() }));

vi.mock('../utils/toast', () => toast);

afterEach(() => {
  cleanup();
  toast.showToast.mockClear();
});

describe('SaveFailureBannerView', () => {
  const failedSnapshot: SaveDurabilitySnapshot = {
    primary: 'failed',
    recovery: 'degraded',
    savedAt: null,
  };

  it('keeps recovery actions visible after a failed retry', async () => {
    const retrySave = vi.fn().mockResolvedValue(false);
    const exportBackup = vi.fn().mockReturnValue({ ok: true });
    const user = userEvent.setup();

    render(
      <SaveFailureBannerView
        saveDurability={failedSnapshot}
        ownershipBlockReason={null}
        retrySave={retrySave}
        exportBackup={exportBackup}
      />,
    );

    expect(screen.getByRole('alert').textContent).toContain("Progress isn't being saved");
    expect(screen.getByRole('alert').textContent).toContain(
      'Your latest changes are safe in this tab, but they may be lost if the browser closes.',
    );
    await user.click(screen.getByRole('button', { name: 'Retry save' }));

    expect(retrySave).toHaveBeenCalledOnce();
    expect(screen.getByRole('alert')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Export backup' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('exports a backup without dismissing the storage failure', async () => {
    const exportBackup = vi.fn().mockReturnValue({ ok: true });
    const user = userEvent.setup();

    render(
      <SaveFailureBannerView
        saveDurability={failedSnapshot}
        ownershipBlockReason={null}
        retrySave={() => false}
        exportBackup={exportBackup}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Export backup' }));

    expect(exportBackup).toHaveBeenCalledOnce();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('renders nothing after browser storage recovers', () => {
    const { rerender } = render(
      <SaveFailureBannerView
        saveDurability={failedSnapshot}
        ownershipBlockReason={null}
        retrySave={() => false}
        exportBackup={() => ({ ok: true })}
      />,
    );
    expect(screen.getByRole('alert')).toBeTruthy();

    rerender(
      <SaveFailureBannerView
        saveDurability={{ primary: 'saved', recovery: 'protected', savedAt: 1 }}
        ownershipBlockReason={null}
        retrySave={() => true}
        exportBackup={() => ({ ok: true })}
      />,
    );

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('suppresses the storage warning for a foreign owner conflict', () => {
    render(
      <SaveFailureBannerView
        saveDurability={failedSnapshot}
        ownershipBlockReason="foreign_owner"
        retrySave={() => false}
        exportBackup={() => ({ ok: true })}
      />,
    );

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('keeps the storage warning for unavailable ownership storage', () => {
    render(
      <SaveFailureBannerView
        saveDurability={failedSnapshot}
        ownershipBlockReason="storage_unavailable"
        retrySave={() => false}
        exportBackup={() => ({ ok: true })}
      />,
    );

    expect(screen.getByRole('alert').textContent).toContain("Progress isn't being saved");
    expect(screen.getByRole('alert').textContent).not.toContain('another tab');
  });

  it('does not let a failed legacy status be masked by the coordinator bootstrap snapshot', () => {
    render(
      <SaveFailureBannerView
        saveDurability={{ primary: 'saved', recovery: 'checking', savedAt: null }}
        saveStatus="failed"
        ownershipBlockReason="storage_unavailable"
        retrySave={() => false}
        exportBackup={() => ({ ok: true })}
      />,
    );

    expect(screen.getByRole('alert').textContent).toContain("Progress isn't being saved");
  });

  it('keeps an actionable failure banner when a blocked edit is still staged as saving', () => {
    render(
      <SaveFailureBannerView
        saveDurability={{ primary: 'saving', recovery: 'checking', savedAt: null }}
        saveStatus="failed"
        ownershipBlockReason="storage_unavailable"
        retrySave={() => false}
        exportBackup={() => ({ ok: true })}
      />,
    );

    expect(screen.getByRole('alert').textContent).toContain("Progress isn't being saved");
    expect(screen.getByRole('button', { name: 'Retry save' })).toBeTruthy();
    expect(screen.queryByText('Saving…')).toBeNull();
  });

  it('uses the durability failure reason when ownership state is stale', () => {
    const { rerender } = render(
      <SaveFailureBannerView
        saveDurability={{
          ...failedSnapshot,
          failureReason: 'ownership_conflict',
        }}
        ownershipBlockReason={null}
        retrySave={() => false}
        exportBackup={() => ({ ok: true })}
      />,
    );

    expect(screen.queryByRole('alert')).toBeNull();

    rerender(
      <SaveFailureBannerView
        saveDurability={{
          ...failedSnapshot,
          failureReason: 'storage_unavailable',
        }}
        ownershipBlockReason="foreign_owner"
        retrySave={() => false}
        exportBackup={() => ({ ok: true })}
      />,
    );

    expect(screen.getByRole('alert').textContent).toContain("Progress isn't being saved");
  });

  it('describes a degraded retry from the returned durability snapshot', async () => {
    const retrySave = vi.fn().mockResolvedValue({
      primary: 'saved',
      recovery: 'degraded',
      savedAt: 2,
    } satisfies SaveDurabilitySnapshot);
    const user = userEvent.setup();
    render(
      <SaveFailureBannerView
        saveDurability={failedSnapshot}
        ownershipBlockReason={null}
        retrySave={retrySave}
        exportBackup={() => ({ ok: true })}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Retry save' }));

    expect(toast.showToast).toHaveBeenCalledWith(
      'Progress saved, but backup protection remains unavailable',
    );
  });

  it('shows safe feedback when a retry rejects without exposing the error', async () => {
    const retrySave = vi.fn().mockRejectedValue(new Error('raw save bytes'));
    const user = userEvent.setup();
    render(
      <SaveFailureBannerView
        saveDurability={failedSnapshot}
        ownershipBlockReason={null}
        retrySave={retrySave}
        exportBackup={() => ({ ok: true })}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Retry save' }));

    expect(toast.showToast).toHaveBeenCalledWith(
      'Unable to save progress in this browser',
    );
    expect(toast.showToast).not.toHaveBeenCalledWith(expect.stringContaining('raw save bytes'));
  });

  it('does not toast after a retry finishes for an unmounted profile', async () => {
    let resolveRetry: ((result: SaveDurabilitySnapshot) => void) | undefined;
    const retrySave = vi.fn(() => new Promise<SaveDurabilitySnapshot>(resolve => {
      resolveRetry = resolve;
    }));
    const user = userEvent.setup();
    const rendered = render(
      <SaveFailureBannerView
        saveDurability={failedSnapshot}
        ownershipBlockReason={null}
        retrySave={retrySave}
        exportBackup={() => ({ ok: true })}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Retry save' }));
    rendered.unmount();
    await act(async () => {
      resolveRetry?.({ primary: 'saved', recovery: 'protected', savedAt: 3 });
      await Promise.resolve();
    });

    expect(toast.showToast).not.toHaveBeenCalled();
  });

  it('does not use the red failure banner for a saved but degraded backup', () => {
    render(
      <SaveFailureBannerView
        saveDurability={{ primary: 'saved', recovery: 'degraded', savedAt: 1 }}
        ownershipBlockReason={null}
        retrySave={async () => true}
        exportBackup={() => ({ ok: true })}
      />,
    );

    expect(screen.queryByRole('alert')).toBeNull();
  });
});
