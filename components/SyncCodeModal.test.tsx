// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SyncCodeModal } from './SyncCodeModal';
import type { BackupMeta } from '../utils/backups';

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(value => { resolve = value; });
  return { promise, resolve };
};

const game = vi.hoisted(() => ({
  getExportData: vi.fn(() => '{}'),
  importSave: vi.fn(async () => ({ ok: true as const, warnings: [] })),
  listBackups: vi.fn(async () => []),
  restoreBackup: vi.fn(async () => ({ ok: true as const, warnings: [] })),
}));

vi.mock('../context/GameContext', () => ({
  initialState: {},
  useGame: () => game,
}));
vi.mock('../hooks/useEscapeKey', () => ({ useEscapeKey: () => undefined }));
vi.mock('./SectionGuide', () => ({ SectionGuide: () => null }));
vi.mock('../utils/syncCode', () => ({
  encodeSyncCode: vi.fn(async () => 'encoded-code'),
  decodeAndValidateSyncCode: vi.fn(async () => ({ ok: false, error: 'not used' })),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('SyncCodeModal backup browser', () => {
  it('shows asynchronous loading and ignores a late list after close', async () => {
    const pending = deferred<BackupMeta[]>();
    game.listBackups.mockReturnValueOnce(pending.promise);
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<SyncCodeModal onClose={onClose} />);

    const backupsButton = screen.getByRole('button', { name: 'Backups' });
    fireEvent.click(backupsButton);
    expect(screen.getByText('Loading backups…')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledOnce();

    pending.resolve([{
      id: 'late',
      ts: 1,
      reason: 'late',
      summary: 'late result',
    }]);
    await Promise.resolve();
    expect(screen.queryByText('late result')).toBeNull();
  });

  it('passes a stable backup id to the asynchronous restore action', async () => {
    game.listBackups.mockResolvedValueOnce([{
      id: 'checkpoint:test:9',
      ts: 200,
      reason: 'interval',
      summary: '11 keys · 1 regions · 1 events',
    }]);
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<SyncCodeModal onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Backups' }));
    expect(await screen.findByText('11 keys · 1 regions · 1 events')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Restore' }));

    expect(game.restoreBackup).toHaveBeenCalledWith('checkpoint:test:9');
  });
});
