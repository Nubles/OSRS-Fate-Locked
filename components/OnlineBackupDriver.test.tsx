// @vitest-environment jsdom

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { writeOnlineBackupRecord, requestOnlineBackupNow } from '../utils/onlineBackupRecord';
import {
  OnlineBackupDriver,
  ONLINE_BACKUP_HIDDEN_MIN_MS,
  ONLINE_BACKUP_INTERVAL_MS,
  ONLINE_BACKUP_SETTLE_MS,
  nextUploadDelay,
} from './OnlineBackupDriver';

const game = vi.hoisted(() => ({
  current: {
    history: [] as unknown[],
    unlocks: {},
    keys: 3,
    specialKeys: 0,
    chaosKeys: 0,
    fatePoints: 0,
    runRevision: 1,
    stateReplacements: 0,
    saveOwnershipStatus: 'owner' as 'owner' | 'checking' | 'blocked',
    getExportData: () => '{"runId":"run-1"}',
  },
}));
const backupRun = vi.hoisted(() => vi.fn(async () => ({ kind: 'uploaded', updatedAt: Date.now() })));

vi.mock('../context/GameContext', () => ({ useGame: () => game.current }));
vi.mock('../context/ProfileContext', () => ({ useProfiles: () => ({ storageKeyForActiveProfile: 'P' }) }));
vi.mock('../services/relaySync', () => ({ relaySync: { base: () => 'https://relay.test' } }));
vi.mock('../utils/onlineBackup', () => ({ backupRun }));

const change = (rerender: (ui: React.ReactElement) => void) => {
  game.current = { ...game.current, runRevision: game.current.runRevision + 1 };
  rerender(<OnlineBackupDriver />);
};

describe('OnlineBackupDriver', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2026, 9, 2, 12));
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
      setItem: (key: string, value: string) => { store.set(key, value); },
      removeItem: (key: string) => { store.delete(key); },
      clear: () => store.clear(),
    });
    game.current = { ...game.current, runRevision: 1, saveOwnershipStatus: 'owner' };
    backupRun.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('waits for changes to settle, then backs up at most every 15 minutes', async () => {
    writeOnlineBackupRecord('P', { code: '0123456789ABCDEFGHJK' });
    const { rerender } = render(<OnlineBackupDriver />);
    await act(async () => { await vi.advanceTimersByTimeAsync(ONLINE_BACKUP_SETTLE_MS - 1); });
    expect(backupRun).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(backupRun).toHaveBeenCalledTimes(1);
    expect(backupRun).toHaveBeenLastCalledWith('P', '{"runId":"run-1"}', 'https://relay.test', { force: false });

    writeOnlineBackupRecord('P', { code: '0123456789ABCDEFGHJK', lastUploadAt: Date.now() });
    change(rerender);
    await act(async () => { await vi.advanceTimersByTimeAsync(ONLINE_BACKUP_INTERVAL_MS - 1); });
    expect(backupRun).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(backupRun).toHaveBeenCalledTimes(2);
  });

  it('never uploads while online backup is off', async () => {
    const { rerender } = render(<OnlineBackupDriver />);
    change(rerender);
    await act(async () => { await vi.advanceTimersByTimeAsync(ONLINE_BACKUP_INTERVAL_MS * 2); });
    expect(backupRun).not.toHaveBeenCalled();
  });

  it('backs up at once when asked, and only in the tab that owns the save', async () => {
    writeOnlineBackupRecord('P', { code: '0123456789ABCDEFGHJK' });
    game.current = { ...game.current, saveOwnershipStatus: 'blocked' };
    const { rerender } = render(<OnlineBackupDriver />);
    await act(async () => { requestOnlineBackupNow('P'); await vi.advanceTimersByTimeAsync(ONLINE_BACKUP_INTERVAL_MS); });
    expect(backupRun).not.toHaveBeenCalled();

    game.current = { ...game.current, saveOwnershipStatus: 'owner' };
    rerender(<OnlineBackupDriver />);
    await act(async () => { requestOnlineBackupNow('P'); await Promise.resolve(); });
    expect(backupRun).toHaveBeenCalledWith('P', '{"runId":"run-1"}', 'https://relay.test', { force: true });
    await act(async () => { requestOnlineBackupNow('another profile'); await Promise.resolve(); });
    expect(backupRun).toHaveBeenCalledTimes(1);
  });

  it('sends a waiting change when the page is hidden, at most every 5 minutes', async () => {
    const hide = async () => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      await act(async () => { document.dispatchEvent(new Event('visibilitychange')); await Promise.resolve(); });
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    };
    writeOnlineBackupRecord('P', { code: '0123456789ABCDEFGHJK', lastUploadAt: Date.now() - ONLINE_BACKUP_HIDDEN_MIN_MS + 1 });
    render(<OnlineBackupDriver />);
    await hide();
    expect(backupRun).not.toHaveBeenCalled();

    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    await hide();
    expect(backupRun).toHaveBeenCalledTimes(1);
  });

  it('retries when the relay asks it to', async () => {
    writeOnlineBackupRecord('P', { code: '0123456789ABCDEFGHJK' });
    backupRun.mockResolvedValueOnce({ kind: 'retry', afterMs: 60_000 } as never);
    render(<OnlineBackupDriver />);
    await act(async () => { await vi.advanceTimersByTimeAsync(ONLINE_BACKUP_SETTLE_MS); });
    expect(backupRun).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(backupRun).toHaveBeenCalledTimes(2);
  });
});

describe('nextUploadDelay', () => {
  it('lets changes settle for 30 seconds, and keeps 15 minutes between uploads', () => {
    expect(nextUploadDelay(undefined, 1_000_000)).toBe(ONLINE_BACKUP_SETTLE_MS);
    expect(nextUploadDelay(1_000_000, 1_000_000)).toBe(ONLINE_BACKUP_INTERVAL_MS);
    expect(nextUploadDelay(1_000_000, 1_000_000 + ONLINE_BACKUP_INTERVAL_MS)).toBe(ONLINE_BACKUP_SETTLE_MS);
  });
});
