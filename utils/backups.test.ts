import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getBackupData,
  listBackups,
  listCombinedBackups,
  pushBackup,
  summarizeSave,
} from './backups';
import { checksumSave } from './saveIntegrity';
import type { RecoveryCheckpoint, RecoveryRepository } from './recoveryTypes';

beforeEach(() => {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => store.clear(),
  };
});

const KEY = 'FATE_PROFILE_test';
const save = (over: Record<string, unknown> = {}) =>
  JSON.stringify({ keys: 5, unlocks: { regions: ['Varrock'], skills: { Attack: 3 } }, history: [{ id: 'a' }], ...over });

describe('backup ring', () => {
  it('summarizes a save into a readable line', () => {
    expect(summarizeSave(save())).toBe('5 keys · 1 regions · 1 events');
    expect(summarizeSave('not json')).toBe('Unknown run');
  });

  it('does not expose pending overlap credits in backup region summaries', () => {
    const pending = JSON.stringify({ keys: 5, unlocks: { regions: ['Baxtorian Falls', "Otto's Grotto", 'Taverley', "Heroes' Guild"] }, history: [{ id: 'a' }] });
    expect(summarizeSave(pending)).toContain('2 regions');
  });

  it('pushes and lists newest-first without the heavy data field', () => {
    expect(pushBackup(KEY, save({ keys: 1 }), 'first', () => ({ ok: true }))).toEqual({ stored: true });
    expect(pushBackup(KEY, save({ keys: 2 }), 'second', () => ({ ok: true }))).toEqual({ stored: true });
    const list = listBackups(KEY);
    expect(list.length).toBe(2);
    expect(list[0].reason).toBe('second');
    expect((list[0] as any).data).toBeUndefined();
  });

  it('skips a snapshot identical to the most recent', () => {
    const data = save({ keys: 9 });
    pushBackup(KEY, data, 'a', () => ({ ok: true }));
    expect(pushBackup(KEY, data, 'b', () => ({ ok: true }))).toEqual({ stored: false, reason: 'duplicate' });
    expect(listBackups(KEY).length).toBe(1);
  });

  it('caps the ring at 8, evicting the oldest', () => {
    for (let i = 0; i < 11; i++) pushBackup(KEY, save({ keys: i }), `r${i}`, () => ({ ok: true }));
    const list = listBackups(KEY);
    expect(list.length).toBe(8);
    expect(list[0].reason).toBe('r10');
    expect(list[7].reason).toBe('r3');
  });

  it('round-trips backup data by timestamp', () => {
    const data = save({ keys: 42 });
    pushBackup(KEY, data, 'keep', () => ({ ok: true }));
    const ts = listBackups(KEY)[0].ts;
    expect(getBackupData(KEY, ts)).toBe(data);
    expect(getBackupData(KEY, 0)).toBeNull();
  });

  it('reports empty data as an observable no-op', () => {
    expect(pushBackup(KEY, '', 'noop', () => ({ ok: true }))).toEqual({ stored: false, reason: 'empty' });
    expect(listBackups(KEY).length).toBe(0);
  });

  it('reports storage failure when both the quota write and retry fail', () => {
    (globalThis as any).localStorage.setItem = () => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    };
    expect(pushBackup(KEY, save(), 'quota', () => ({ ok: true }))).toEqual({ stored: false, reason: 'storage_unavailable' });
  });

  it('reports success when the smaller-ring quota retry succeeds', () => {
    const writes: string[] = [];
    let attempt = 0;
    (globalThis as any).localStorage.setItem = (_key: string, value: string) => {
      attempt += 1;
      if (attempt === 1) throw new DOMException('Quota exceeded', 'QuotaExceededError');
      writes.push(value);
    };
    expect(pushBackup(KEY, save(), 'retry', () => ({ ok: true }))).toEqual({ stored: true });
    expect(attempt).toBe(2);
    expect(JSON.parse(writes[0])).toHaveLength(1);
  });

  it('reports authorization storage denial without reading or writing the backup ring', () => {
    const getItem = vi.spyOn(localStorage, 'getItem');
    const setItem = vi.spyOn(localStorage, 'setItem');

    expect(pushBackup(
      KEY,
      save(),
      'blocked',
      () => ({ ok: false, reason: 'storage_unavailable' }),
    )).toEqual({
      stored: false,
      reason: 'storage_unavailable',
    });
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });

  it('does not read or write the backup ring without ownership', () => {
    const getItem = vi.spyOn(localStorage, 'getItem');
    const setItem = vi.spyOn(localStorage, 'setItem');
    expect(pushBackup(
      KEY,
      save(),
      'blocked',
      () => ({ ok: false, reason: 'ownership_conflict' }),
    )).toEqual({
      stored: false,
      reason: 'ownership_conflict',
    });
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });

  it('does not write when ownership is lost after reading the ring', () => {
    const canWrite = vi.fn()
      .mockReturnValueOnce({ ok: true })
      .mockReturnValueOnce({ ok: false, reason: 'ownership_conflict' });
    const getItem = vi.spyOn(localStorage, 'getItem');
    const setItem = vi.spyOn(localStorage, 'setItem');

    expect(pushBackup(KEY, save(), 'lost-before-write', canWrite)).toEqual({
      stored: false,
      reason: 'ownership_conflict',
    });
    expect(getItem).toHaveBeenCalledTimes(1);
    expect(setItem).not.toHaveBeenCalled();
    expect(canWrite).toHaveBeenCalledTimes(2);
  });

  it('does not retry a quota write after ownership is lost', () => {
    const canWrite = vi.fn()
      .mockReturnValueOnce({ ok: true })
      .mockReturnValueOnce({ ok: true })
      .mockReturnValueOnce({ ok: false, reason: 'ownership_conflict' });
    const getItem = vi.spyOn(localStorage, 'getItem');
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementationOnce(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });

    expect(pushBackup(KEY, save(), 'lost-before-retry', canWrite)).toEqual({
      stored: false,
      reason: 'ownership_conflict',
    });
    expect(getItem).toHaveBeenCalledTimes(1);
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(canWrite).toHaveBeenCalledTimes(3);
  });

  it('lists journal checkpoints and legacy entries once by checksum, newest first', async () => {
    const older = save({ keys: 10 });
    const newer = save({ keys: 11 });
    const oldChecksum = await checksumSave(older);
    const newChecksum = await checksumSave(newer);
    (globalThis as any).localStorage.setItem(
      'FATE_PROFILE_test__backups',
      JSON.stringify([
        { ts: 100, reason: 'Before import', summary: 'legacy summary', data: older },
      ]),
    );
    const checkpoint: RecoveryCheckpoint = {
      profileId: 'test',
      persistenceRevision: 9,
      runId: 'run-test',
      runRevision: 2,
      capturedAt: 200,
      checksum: newChecksum,
      data: newer,
      reason: 'interval',
    };
    const duplicate: RecoveryCheckpoint = {
      ...checkpoint,
      persistenceRevision: 8,
      capturedAt: 99,
      checksum: oldChecksum,
      data: older,
      reason: 'legacy-import',
    };
    const repository: RecoveryRepository = {
      getHead: async () => null,
      putHead: async () => ({ stored: true }),
      listCheckpoints: async () => [checkpoint, duplicate],
      putCheckpoint: async () => ({ stored: true }),
      deleteCheckpoints: async () => ({ stored: true }),
      getMetadata: async () => null,
      putMetadata: async () => ({ stored: true }),
      close: () => undefined,
    };

    const list = await listCombinedBackups(KEY, {
      profileId: 'test',
      repository,
    });

    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({
      reason: 'interval',
      summary: '11 keys · 1 regions · 1 events',
      id: 'checkpoint:test:9',
      checksum: newChecksum,
    });
    expect(list[1]).toMatchObject({
      reason: 'Before import',
      summary: 'legacy summary',
      checksum: oldChecksum,
    });
    expect(new Set(list.map(item => item.id)).size).toBe(2);
  });

  it('falls back to the unchanged legacy ring when the journal is unavailable', async () => {
    const data = save({ keys: 12 });
    (globalThis as any).localStorage.setItem(
      'FATE_PROFILE_test__backups',
      JSON.stringify([{ ts: 300, reason: 'legacy', summary: 'legacy only', data }]),
    );
    const repository = {
      listCheckpoints: vi.fn(async () => { throw new Error('IndexedDB unavailable'); }),
    } as unknown as RecoveryRepository;

    await expect(listCombinedBackups(KEY, {
      profileId: 'test',
      repository,
    })).resolves.toMatchObject([
      { reason: 'legacy', summary: 'legacy only', ts: 300 },
    ]);
    expect(JSON.parse(localStorage.getItem('FATE_PROFILE_test__backups')!)).toHaveLength(1);
  });
});
