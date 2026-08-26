// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SaveDurabilitySnapshot } from '../utils/recoveryTypes';
import { SaveFailureBannerView } from './SaveFailureBanner';

afterEach(cleanup);

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
