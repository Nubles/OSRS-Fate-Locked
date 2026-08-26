// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
  status: 'unknown' as const,
  requestPersistence: vi.fn().mockResolvedValue('granted'),
}));

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

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('BackupNagBanner', () => {
  it('keeps persistent storage opt-in and offers it beside the file backup', async () => {
    const user = userEvent.setup();
    render(<BackupNagBanner />);

    expect(persistent.requestPersistence).not.toHaveBeenCalled();
    expect(screen.getByText(/reduces automatic eviction/i)).toBeTruthy();
    expect(screen.getByText(/does not survive cleared data or device loss/i)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Enable persistent storage' }));
    expect(persistent.requestPersistence).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Export backup' })).toBeTruthy();
  });

  it('does not render a persistence request before meaningful progress', () => {
    game.history.length = 0;
    backupNag.shouldNag.mockReturnValue(false);

    render(<BackupNagBanner />);

    expect(screen.queryByRole('button', { name: 'Enable persistent storage' })).toBeNull();
    expect(persistent.requestPersistence).not.toHaveBeenCalled();
  });
});
