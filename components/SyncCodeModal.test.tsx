// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SyncCodeModal } from './SyncCodeModal';
import type { BackupMeta } from '../utils/backups';
import { decodeAndValidateSyncCode } from '../utils/syncCode';
import { ensureChain } from '../utils/integrity';
import type { GameState } from '../types';

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
  createFreshState: () => ({
    unlocks: { skills: {}, regions: [], quests: [] },
    keys: 0,
    specialKeys: 0,
    chaosKeys: 0,
    history: [],
    gameModeId: 'Vanilla',
  }),
  useGame: () => game,
}));
vi.mock('../hooks/useEscapeKey', () => ({ useEscapeKey: () => undefined }));
vi.mock('./SectionGuide', () => ({ SectionGuide: () => null }));
vi.mock('../utils/syncCode', () => ({
  encodeSyncCode: vi.fn(async () => 'encoded-code'),
  decodeAndValidateSyncCode: vi.fn(async (_code: string, state: unknown) => ({
    ok: true as const,
    state,
    warnings: [],
  })),
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

  it('ignores a restore completion after the modal is closed', async () => {
    const pending = deferred<{ ok: true; warnings: [] }>();
    game.listBackups.mockResolvedValueOnce([{
      id: 'late-restore',
      ts: 200,
      reason: 'interval',
      summary: 'late restore',
    }]);
    game.restoreBackup.mockReturnValueOnce(pending.promise);
    const onClose = vi.fn();
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<SyncCodeModal onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Backups' }));
    expect(await screen.findByText('late restore')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Restore' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));

    pending.resolve({ ok: true, warnings: [] });
    await Promise.resolve();
    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.queryByText('Fate restored successfully')).toBeNull();
  });

  it('ignores a restore completion after the active profile action changes', async () => {
    const pending = deferred<{ ok: true; warnings: [] }>();
    game.listBackups.mockResolvedValueOnce([{
      id: 'profile-switch',
      ts: 200,
      reason: 'interval',
      summary: 'profile switch',
    }]);
    const oldRestore = game.restoreBackup;
    oldRestore.mockReturnValueOnce(pending.promise);
    const onClose = vi.fn();
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const rendered = render(<SyncCodeModal onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Backups' }));
    expect(await screen.findByText('profile switch')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Restore' }));

    game.restoreBackup = vi.fn(async () => ({ ok: true as const, warnings: [] }));
    rendered.rerender(<SyncCodeModal onClose={onClose} />);
    expect((screen.getByRole('button', { name: 'Restore' }) as HTMLButtonElement).disabled).toBe(false);
    pending.resolve({ ok: true, warnings: [] });
    await Promise.resolve();

    expect(screen.queryByText('Fate restored successfully')).toBeNull();
  });

  it('locks restore while the first restore is still pending', async () => {
    const pending = deferred<{ ok: true; warnings: [] }>();
    game.listBackups.mockResolvedValueOnce([{
      id: 'locked',
      ts: 200,
      reason: 'interval',
      summary: 'locked restore',
    }]);
    game.restoreBackup.mockReturnValueOnce(pending.promise);
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<SyncCodeModal onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Backups' }));
    expect(await screen.findByText('locked restore')).toBeTruthy();
    const restore = screen.getByRole('button', { name: 'Restore' });
    await user.click(restore);
    await user.click(restore);

    expect(game.restoreBackup).toHaveBeenCalledTimes(1);
    pending.resolve({ ok: true, warnings: [] });
  });

  it('locks import while the first import is still pending', async () => {
    const pending = deferred<{ ok: true; warnings: [] }>();
    game.importSave.mockReturnValueOnce(pending.promise);
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<SyncCodeModal onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    fireEvent.change(screen.getByPlaceholderText('FLSYNC.g1.…'), {
      target: { value: 'import-lock-code' },
    });
    await user.click(screen.getByRole('button', { name: 'Verify code' }));
    await user.click(await screen.findByRole('button', { name: 'Import & overwrite this profile' }));
    await user.click(screen.getByRole('button', { name: 'Import & overwrite this profile' }));

    expect(game.importSave).toHaveBeenCalledTimes(1);
    pending.resolve({ ok: true, warnings: [] });
  });
});

describe('SyncCodeModal tabs', () => {
  it('keeps the same tab button, and its focus, after switching tab', () => {
    render(<SyncCodeModal onClose={vi.fn()} />);
    const importTab = screen.getByRole('button', { name: 'Import' });
    importTab.focus();

    fireEvent.click(importTab);

    expect(screen.getByRole('button', { name: 'Import' })).toBe(importTab);
    expect(document.activeElement).toBe(importTab);
  });
});

describe('SyncCodeModal import verdict', () => {
  it("checks an imported run's Fate against that run's own mode", async () => {
    // Legacy Hardcore has no pity, so 30 failures at +2 legitimately reach 60 Fate.
    const history = ensureChain(Array.from({ length: 30 }, (_, index) => ({
      id: `hardcore-fail-${index}`,
      timestamp: index + 1,
      type: 'ROLL_FAIL' as const,
      message: 'No Key.',
      meta: { fatePointsEarned: 2 },
    })));
    vi.mocked(decodeAndValidateSyncCode).mockResolvedValueOnce({
      ok: true,
      state: {
        unlocks: { skills: {}, regions: [], quests: [] },
        keys: 3, specialKeys: 0, chaosKeys: 0, fatePoints: 60,
        history,
        gameModeId: 'hardcore',
      } as unknown as GameState,
      checksumOk: true,
      warnings: [],
    });
    const user = userEvent.setup();
    render(<SyncCodeModal onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    fireEvent.change(screen.getByPlaceholderText('FLSYNC.g1.…'), {
      target: { value: 'hardcore-code' },
    });
    await user.click(screen.getByRole('button', { name: 'Verify code' }));

    expect(await screen.findByText('Verified run')).toBeTruthy();
    expect(screen.queryByText('Loadable, with warnings')).toBeNull();
  });
});
