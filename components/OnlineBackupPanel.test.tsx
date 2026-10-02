// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ONLINE_BACKUP_EVENT,
  readOnlineBackupRecord,
  writeOnlineBackupRecord,
  type OnlineBackupEventDetail,
} from '../utils/onlineBackupRecord';
import { OnlineBackupPanel, ONLINE_BACKUP_ERRORS } from './OnlineBackupPanel';

const CODE = '0123456789ABCDEFGHJK';
const WRITER = 'Wr'.repeat(11);

const game = vi.hoisted(() => ({
  importSave: vi.fn(async (_state: unknown) => ({ ok: true as const, warnings: [] })),
}));
const backup = vi.hoisted(() => ({
  generateBackupCode: vi.fn(() => '01234-56789-ABCDE-FGHJK'),
  generateBackupWriter: vi.fn(() => 'Wr'.repeat(11)),
  deriveBackupKeys: vi.fn(async (code: string) => ({ id: `id-${code}`, writeToken: 'token', key: {} as CryptoKey })),
  fetchBackup: vi.fn(async (_base: string, _keys: unknown, _copy: 'latest' | 'previous') =>
    ({ ok: false, reason: 'not-found' }) as
      | { ok: true; envelope: string; updatedAt: number }
      | { ok: false; reason: 'network' | 'unavailable' | 'not-found' }),
  decryptBackup: vi.fn(async (envelope: string) => `FLSYNC.${envelope}`),
  deleteBackup: vi.fn(async () => true),
}));
const decode = vi.hoisted(() => vi.fn(async (syncCode: string) => ({
  ok: true as const,
  state: { history: syncCode.includes('older') ? [1, 2, 3, 4] : [1, 2, 3], keys: 5 },
  warnings: [] as { message: string }[],
})));
const toast = vi.hoisted(() => vi.fn());

vi.mock('../context/GameContext', () => ({ useGame: () => game, createFreshState: () => ({}) }));
vi.mock('../context/ProfileContext', () => ({
  useProfiles: () => ({ storageKeyForActiveProfile: 'P', activeProfileName: 'Main run' }),
}));
vi.mock('../services/relaySync', () => ({ relaySync: { base: () => 'https://relay.test' } }));
vi.mock('../utils/onlineBackup', () => backup);
vi.mock('../utils/syncCode', () => ({ decodeAndValidateSyncCode: decode }));
vi.mock('../utils/toast', () => ({ showToast: toast }));

const nowRequests = () => {
  const seen: OnlineBackupEventDetail[] = [];
  const listener = (event: Event) => seen.push((event as CustomEvent<OnlineBackupEventDetail>).detail);
  window.addEventListener(ONLINE_BACKUP_EVENT, listener);
  return {
    count: () => seen.filter(detail => detail.action === 'now' && detail.storageKey === 'P').length,
    stop: () => window.removeEventListener(ONLINE_BACKUP_EVENT, listener),
  };
};

describe('OnlineBackupPanel', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
      setItem: (key: string, value: string) => { store.set(key, value); },
      removeItem: (key: string) => { store.delete(key); },
      clear: () => store.clear(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    // Back to each mock's own implementation, for the next test.
    vi.resetAllMocks();
  });

  it('turns backup on only once the player says they kept the new code, then backs up at once', async () => {
    const requests = nowRequests();
    const user = userEvent.setup();
    render(<OnlineBackupPanel />);

    await user.click(screen.getByRole('button', { name: 'Turn on online backup' }));
    expect(screen.getByTestId('backup-code').textContent).toBe('01234-56789-ABCDE-FGHJK');
    const start = screen.getByRole('button', { name: 'Start backing up' }) as HTMLButtonElement;
    expect(start.disabled).toBe(true);
    expect(readOnlineBackupRecord('P').code).toBeUndefined();

    await user.click(screen.getByRole('checkbox', { name: /kept my backup code somewhere safe/ }));
    await user.click(start);
    expect(readOnlineBackupRecord('P')).toMatchObject({
      code: CODE,
      writer: WRITER,
      enabledAt: expect.any(Number),
      promptAnsweredAt: expect.any(Number),
    });
    expect(requests.count()).toBe(1);
    expect(screen.getByRole('status').textContent).toMatch(/Waiting for the first backup/);
    requests.stop();
  });

  it('says when the run was last backed up and why the last backup failed, and backs up now', async () => {
    writeOnlineBackupRecord('P', { code: CODE, writer: WRITER, lastUploadAt: Date.now() - 5 * 60_000, lastError: 'network' });
    const requests = nowRequests();
    const user = userEvent.setup();
    render(<OnlineBackupPanel />);

    expect(screen.getByRole('status').textContent).toMatch(/Last backed up 5 minutes ago/);
    expect(screen.getByRole('alert').textContent).toBe(ONLINE_BACKUP_ERRORS.network);
    await user.click(screen.getByRole('button', { name: 'Back up now' }));
    expect(requests.count()).toBe(1);
    await user.click(screen.getByRole('button', { name: 'Show backup code' }));
    expect(screen.getByTestId('backup-code').textContent).toBe('01234-56789-ABCDE-FGHJK');
    requests.stop();
  });

  it('turns backup off only when confirmed, deleting the relay copy and forgetting the code', async () => {
    writeOnlineBackupRecord('P', { code: CODE, writer: WRITER, promptAnsweredAt: 7 });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    const user = userEvent.setup();
    render(<OnlineBackupPanel />);

    await user.click(screen.getByRole('button', { name: 'Turn off' }));
    expect(backup.deleteBackup).not.toHaveBeenCalled();
    expect(readOnlineBackupRecord('P').code).toBe(CODE);

    await user.click(screen.getByRole('button', { name: 'Turn off' }));
    expect(confirm).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(readOnlineBackupRecord('P')).toEqual({ promptAnsweredAt: 7 }));
    expect(backup.deleteBackup).toHaveBeenCalledWith('https://relay.test', expect.objectContaining({ id: `id-${CODE}` }));
    expect(toast).toHaveBeenCalledWith(expect.stringMatching(/relay’s copy is deleted/));
    expect(screen.getByRole('button', { name: 'Turn on online backup' })).toBeTruthy();
  });

  it('restores a run from its code, however it was typed, and keeps backing it up as this browser’s copy', async () => {
    backup.fetchBackup.mockImplementation(async (_base, _keys, copy) => copy === 'latest'
      ? { ok: true, envelope: 'newest', updatedAt: Date.now() - 2 * 3_600_000 }
      : { ok: false, reason: 'not-found' });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    render(<OnlineBackupPanel />);

    await user.type(screen.getByRole('textbox', { name: 'Backup code' }), 'o1234 56789 abcde fghjk');
    await user.click(screen.getByRole('button', { name: 'Find backup' }));
    const found = await screen.findByTestId('online-backup-found-latest');
    expect(found.textContent).toMatch(/Backed up 2 hours ago: 3 History\s+entries, 5 Keys\./);
    expect(screen.queryByText('Newest copy')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Restore this run' }));
    await waitFor(() => expect(game.importSave).toHaveBeenCalledWith({ history: [1, 2, 3], keys: 5 }));
    await waitFor(() => expect(readOnlineBackupRecord('P')).toMatchObject({
      code: CODE,
      writer: WRITER,
      lastUploadAt: expect.any(Number),
    }));
    expect(toast).toHaveBeenCalledWith('Fate restored successfully');
  });

  it('offers both copies when another browser backed the run up, and restores the one chosen', async () => {
    backup.fetchBackup.mockImplementation(async (_base, _keys, copy) => copy === 'latest'
      ? { ok: true, envelope: 'newest', updatedAt: Date.now() - 3_600_000 }
      : { ok: true, envelope: 'older', updatedAt: Date.now() - 3 * 86_400_000 });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    render(<OnlineBackupPanel />);

    await user.type(screen.getByRole('textbox', { name: 'Backup code' }), '01234-56789-ABCDE-FGHJK');
    await user.click(screen.getByRole('button', { name: 'Find backup' }));
    expect((await screen.findByTestId('online-backup-found-latest')).textContent).toMatch(/Newest copy/);
    const older = screen.getByTestId('online-backup-found-previous');
    expect(older.textContent).toMatch(/Older copy, kept when another browser backed this run up/);
    expect(older.textContent).toMatch(/Backed up 3 days ago: 4 History\s+entries/);

    const [, restoreOlder] = screen.getAllByRole('button', { name: 'Restore this copy' });
    await user.click(restoreOlder);
    await waitFor(() => expect(game.importSave).toHaveBeenCalledWith({ history: [1, 2, 3, 4], keys: 5 }));
  });

  it('explains a code that finds nothing, a relay out of reach, and a mistyped code', async () => {
    const user = userEvent.setup();
    render(<OnlineBackupPanel />);
    const input = screen.getByRole('textbox', { name: 'Backup code' });

    await user.type(input, '01234-56789-ABCDE-FGHJK');
    await user.click(screen.getByRole('button', { name: 'Find backup' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/No backup was found for that code/);

    backup.fetchBackup.mockResolvedValue({ ok: false, reason: 'network' });
    await user.click(screen.getByRole('button', { name: 'Find backup' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/couldn’t be reached/);

    await user.clear(input);
    await user.type(input, 'ABCDE-FGHJK');
    await user.click(screen.getByRole('button', { name: 'Find backup' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/A backup code has 20 letters and digits/);
    expect(game.importSave).not.toHaveBeenCalled();
  });
});
