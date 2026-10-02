// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PersistentStorageStatus } from '../hooks/usePersistentStorage';
import { BackupNagBanner } from './BackupNagBanner';

const backupNag = vi.hoisted(() => ({
  shouldNag: vi.fn(() => true),
  snoozeNag: vi.fn(),
  lastExportLabel: vi.fn(() => 'Never'),
}));
const game = vi.hoisted(() => ({
  history: [{ id: 'event-1' }],
  getExportData: vi.fn(() => '{"safe":"summary"}'),
}));
const profiles = vi.hoisted(() => ({
  storageKeyForActiveProfile: 'FATE_PROFILE_alpha',
}));
const persistent = vi.hoisted(() => ({
  status: 'unknown' as PersistentStorageStatus,
  requestPersistence: vi.fn().mockResolvedValue('granted'),
}));
const onlineBackup = vi.hoisted(() => ({ record: { promptAnsweredAt: 1 } as Record<string, unknown> }));

vi.mock('../utils/backupNag', () => backupNag);
vi.mock('../context/GameContext', () => ({ useGame: () => game }));
vi.mock('../context/ProfileContext', () => ({ useProfiles: () => profiles }));
vi.mock('../hooks/usePersistentStorage', () => ({
  usePersistentStorage: () => persistent,
}));
vi.mock('../utils/fateSaveFile', () => ({
  downloadFateSave: vi.fn(() => ({ ok: true })),
}));
vi.mock('../utils/toast', () => ({ showToast: vi.fn() }));
vi.mock('../utils/onlineBackupRecord', async importOriginal => ({
  ...await importOriginal<typeof import('../utils/onlineBackupRecord')>(),
  readOnlineBackupRecord: () => onlineBackup.record,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  game.history.length = 1;
  backupNag.shouldNag.mockReturnValue(true);
  persistent.status = 'unknown';
  onlineBackup.record = { promptAnsweredAt: 1 };
});

describe('BackupNagBanner', () => {
  it('keeps persistent storage opt-in and offers it beside the file backup', async () => {
    const user = userEvent.setup();
    render(<BackupNagBanner />);

    expect(persistent.requestPersistence).not.toHaveBeenCalled();
    expect(screen.getByText(/reduce\w* automatic eviction/i)).toBeTruthy();
    expect(screen.getByText(/does not survive cleared data or device loss/i)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Enable persistent storage' }));
    expect(persistent.requestPersistence).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Export backup' })).toBeTruthy();
  });

  it('waits while the online backup prompt is unanswered, so one banner shows at a time', () => {
    onlineBackup.record = {};
    render(<BackupNagBanner />);
    expect(screen.queryByRole('button', { name: 'Export backup' })).toBeNull();
  });

  it('waits while online backup has a copy from the last week, and comes back after', () => {
    onlineBackup.record = { code: '0123456789ABCDEFGHJK', lastUploadAt: Date.now() - 6 * 86_400_000 };
    const { unmount } = render(<BackupNagBanner />);
    expect(screen.queryByRole('button', { name: 'Export backup' })).toBeNull();
    unmount();

    onlineBackup.record = { code: '0123456789ABCDEFGHJK', lastUploadAt: Date.now() - 8 * 86_400_000 };
    render(<BackupNagBanner />);
    expect(screen.getByRole('button', { name: 'Export backup' })).toBeTruthy();
  });

  it('does not render a persistence request before meaningful progress', () => {
    game.history.length = 0;
    backupNag.shouldNag.mockReturnValue(false);

    render(<BackupNagBanner />);

    expect(screen.queryByRole('button', { name: 'Enable persistent storage' })).toBeNull();
    expect(persistent.requestPersistence).not.toHaveBeenCalled();
  });

  it.each([
    ['unknown', /can reduce automatic eviction/i],
    ['granted', /is enabled and reduces automatic eviction/i],
    ['denied', /was not enabled.*automatic eviction may still occur/i],
    ['unsupported', /unavailable.*automatic eviction may occur/i],
  ] as const)('explains %s persistence without overstating protection', (status, specificCopy) => {
    persistent.status = status;
    render(<BackupNagBanner />);

    const copy = screen.getByText(/does not survive cleared data or device loss/i);
    expect(copy.textContent).toMatch(specificCopy);
  });

  it('wraps backup controls and copy on narrow screens', () => {
    render(<BackupNagBanner />);

    const copy = screen.getByText(/Your run only lives in this browser/i);
    const layout = copy.parentElement;
    expect(layout?.className).toContain('flex-wrap');
    expect(layout?.querySelector(':scope > span')?.className).toContain('min-w-0');
  });
});
