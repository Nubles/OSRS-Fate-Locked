import { describe, it, expect, beforeEach } from 'vitest';
import { pushBackup, listBackups, getBackupData, summarizeSave } from './backups';

// Isolated in-memory localStorage so the ring tests are deterministic.
beforeEach(() => {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
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

  it('pushes and lists newest-first without the heavy data field', () => {
    pushBackup(KEY, save({ keys: 1 }), 'first');
    pushBackup(KEY, save({ keys: 2 }), 'second');
    const list = listBackups(KEY);
    expect(list.length).toBe(2);
    expect(list[0].reason).toBe('second');
    expect((list[0] as any).data).toBeUndefined();
  });

  it('skips a snapshot identical to the most recent', () => {
    const data = save({ keys: 9 });
    pushBackup(KEY, data, 'a');
    pushBackup(KEY, data, 'b');
    expect(listBackups(KEY).length).toBe(1);
  });

  it('caps the ring at 8, evicting the oldest', () => {
    for (let i = 0; i < 11; i++) pushBackup(KEY, save({ keys: i }), `r${i}`);
    const list = listBackups(KEY);
    expect(list.length).toBe(8);
    expect(list[0].reason).toBe('r10');
    expect(list[7].reason).toBe('r3');
  });

  it('round-trips backup data by timestamp', () => {
    const data = save({ keys: 42 });
    pushBackup(KEY, data, 'keep');
    const ts = listBackups(KEY)[0].ts;
    expect(getBackupData(KEY, ts)).toBe(data);
    expect(getBackupData(KEY, 0)).toBeNull();
  });

  it('ignores empty data', () => {
    pushBackup(KEY, '', 'noop');
    expect(listBackups(KEY).length).toBe(0);
  });
});
