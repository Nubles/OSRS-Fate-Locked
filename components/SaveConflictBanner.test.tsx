// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SaveConflictBannerView } from './SaveConflictBanner';

afterEach(cleanup);

describe('SaveConflictBannerView', () => {
  it('confirms takeover and keeps the warning after a failed claim', async () => {
    const takeOver = vi.fn().mockResolvedValue(false);
    const confirmAction = vi.fn().mockReturnValue(true);
    render(<SaveConflictBannerView
      status="blocked"
      hasPendingChanges
      takeOver={takeOver}
      reloadLatest={() => ({ ok: true, warnings: [] })}
      exportBackup={() => ({ ok: true })}
      confirmAction={confirmAction}
    />);
    expect(screen.getByRole('alert').textContent).toContain('This profile is open in another tab');
    expect(screen.getByRole('alert').textContent).toContain(
      'Changes in this tab are not being saved. Choose which tab should keep the profile before continuing.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Take over and save this tab' }));
    expect(confirmAction).toHaveBeenCalledOnce();
    expect(confirmAction).toHaveBeenCalledWith(
      'Another tab may have newer saved progress. Take over and save this tab instead?',
    );
    expect(takeOver).toHaveBeenCalledOnce();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('does not discard pending changes when confirmation is cancelled', async () => {
    const reloadLatest = vi.fn();
    const confirmAction = vi.fn().mockReturnValue(false);
    render(<SaveConflictBannerView
      status="blocked"
      hasPendingChanges
      takeOver={async () => false}
      reloadLatest={reloadLatest}
      exportBackup={() => ({ ok: true })}
      confirmAction={confirmAction}
    />);
    await userEvent.click(screen.getByRole('button', { name: 'Discard this tab and reload latest' }));
    expect(confirmAction).toHaveBeenCalledOnce();
    expect(confirmAction).toHaveBeenCalledWith(
      "Discard this tab's unsaved changes and reload the latest saved progress?",
    );
    expect(reloadLatest).not.toHaveBeenCalled();
  });

  it('reloads without confirmation when the tab has no pending changes', async () => {
    const reloadLatest = vi.fn().mockReturnValue({ ok: true, warnings: [] });
    const confirmAction = vi.fn().mockReturnValue(true);
    render(
      <SaveConflictBannerView
        status="blocked"
        hasPendingChanges={false}
        takeOver={async () => false}
        reloadLatest={reloadLatest}
        exportBackup={() => ({ ok: true })}
        confirmAction={confirmAction}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Discard this tab and reload latest' }));
    expect(reloadLatest).toHaveBeenCalledOnce();
    expect(confirmAction).not.toHaveBeenCalled();
  });

  it('exports without dismissing or changing ownership', async () => {
    const takeOver = vi.fn().mockResolvedValue(false);
    const reloadLatest = vi.fn().mockReturnValue({ ok: true, warnings: [] });
    const exportBackup = vi.fn().mockReturnValue({ ok: true });
    render(
      <SaveConflictBannerView
        status="blocked"
        hasPendingChanges
        takeOver={takeOver}
        reloadLatest={reloadLatest}
        exportBackup={exportBackup}
        confirmAction={() => true}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Export backup' }));
    expect(exportBackup).toHaveBeenCalledOnce();
    expect(takeOver).not.toHaveBeenCalled();
    expect(reloadLatest).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('renders nothing while checking or owning', () => {
    const props = {
      hasPendingChanges: false,
      takeOver: async () => false,
      reloadLatest: () => ({ ok: true as const, warnings: [] }),
      exportBackup: () => ({ ok: true as const }),
      confirmAction: () => true,
    };
    const { rerender } = render(
      <SaveConflictBannerView status="checking" {...props} />,
    );
    expect(screen.queryByRole('alert')).toBeNull();
    rerender(<SaveConflictBannerView status="owner" {...props} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('blocks repeated reloads while reloading and settles after the queued reload', async () => {
    const reloadLatest = vi.fn().mockReturnValue({ ok: true, warnings: [] });
    render(
      <SaveConflictBannerView
        status="blocked"
        hasPendingChanges={false}
        takeOver={async () => false}
        reloadLatest={reloadLatest}
        exportBackup={() => ({ ok: true })}
        confirmAction={() => true}
      />,
    );

    const reloadButton = screen.getByRole('button', { name: 'Discard this tab and reload latest' });
    fireEvent.click(reloadButton);

    expect((screen.getByRole('button', { name: 'Reloading…' }) as HTMLButtonElement).disabled).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'Take over and save this tab' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.click(reloadButton);
    expect(reloadLatest).not.toHaveBeenCalled();

    await act(async () => {
      await Promise.resolve();
    });

    expect(reloadLatest).toHaveBeenCalledOnce();
    expect(
      (screen.getByRole('button', { name: 'Discard this tab and reload latest' }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it('disables destructive actions and announces takeover progress', async () => {
    let resolveTakeover: ((owned: boolean) => void) | undefined;
    const takeOver = vi.fn(() => new Promise<boolean>(resolve => { resolveTakeover = resolve; }));
    render(
      <SaveConflictBannerView
        status="blocked"
        hasPendingChanges
        takeOver={takeOver}
        reloadLatest={() => ({ ok: true, warnings: [] })}
        exportBackup={() => ({ ok: true })}
        confirmAction={() => true}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Take over and save this tab' }));

    expect(
      (screen.getByRole('button', { name: 'Taking over…' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'Discard this tab and reload latest' }) as HTMLButtonElement).disabled,
    ).toBe(true);

    await act(async () => {
      resolveTakeover?.(false);
      await Promise.resolve();
    });

    expect(
      (screen.getByRole('button', { name: 'Take over and save this tab' }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });
});
