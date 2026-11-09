import { describe, expect, it } from 'vitest';
import type { GameState } from '../types';
import type { RecoveryHead, RecoveryRepository } from './recoveryTypes';
import { lifecycleMarkMatches, profileLifecycleMarkKey } from './lifecycleMark';
import { createSaveCoordinator } from './saveCoordinator';
import { profileMirrorMetadataKey } from './storageRecovery';

/**
 * A browser whose storage is full of old backup copies. A long run got there
 * for real: two copies of a 1.6 MB save fill the 5 MB a site is allowed, and
 * from then on the save beside them could not be written (the journal kept
 * the progress, the browser save silently stayed days behind).
 */
const KEY = 'FATE_PROFILE_alpha';
const RING = `${KEY}__backups`;
const save = (note: string, size = 0): string => JSON.stringify({ note, pad: 'x'.repeat(size) });

const fullBrowser = (capacity: number) => {
  const values = new Map<string, string>();
  const used = (): number => [...values].reduce((sum, [key, value]) => sum + key.length + value.length, 0);
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      const before = values.has(key) ? key.length + values.get(key)!.length : 0;
      if (used() - before + key.length + value.length > capacity) {
        throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      }
      values.set(key, value);
    },
    removeItem: (key: string) => { values.delete(key); },
  };
  return { values, storage, used };
};

const tab = (
  storage: ReturnType<typeof fullBrowser>['storage'],
  reclaimStorage?: () => boolean,
) => {
  let head: RecoveryHead | null = null;
  const repository: RecoveryRepository = {
    getHead: async () => head,
    putHead: async record => { head = record; return { stored: true }; },
    listCheckpoints: async () => [],
    putCheckpoint: async () => ({ stored: true }),
    deleteCheckpoints: async () => ({ stored: true }),
    getMetadata: async () => null,
    putMetadata: async () => ({ stored: true }),
    close: () => undefined,
  };
  const coordinator = createSaveCoordinator({
    profileId: 'alpha',
    storageKey: KEY,
    storage,
    repository,
    authorizeWrite: () => ({ ok: true }),
    validate: data => ({
      ok: true,
      state: { ...JSON.parse(data), runId: 'run-alpha', runRevision: 1 } as unknown as GameState,
      sourceVersion: 1,
      warnings: [],
    }),
    checksum: async data => `${data.length}`.padStart(64, '0'),
    now: () => 1_700_000_000_000,
    initialPersistenceRevision: 0,
    ...(reclaimStorage === undefined ? {} : { reclaimStorage }),
  });
  return { coordinator, head: () => head };
};

/** Drops the oldest ring copy, as utils/backups.ts reclaimBackupSpace does. */
const ringReclaim = (values: Map<string, string>) => {
  let calls = 0;
  const reclaim = (): boolean => {
    calls += 1;
    const copies = JSON.parse(values.get(RING) ?? '[]') as string[];
    if (copies.length === 0) return false;
    if (copies.length === 1) values.delete(RING);
    else values.set(RING, JSON.stringify(copies.slice(0, -1)));
    return true;
  };
  return { reclaim, calls: () => calls };
};

describe('saving when old backup copies have filled the browser storage', () => {
  it('gives up only as many old copies as the save needs', async () => {
    const browser = fullBrowser(4_000);
    browser.values.set(RING, JSON.stringify(['a'.repeat(1_000), 'b'.repeat(1_000), 'c'.repeat(1_000)]));
    const { reclaim, calls } = ringReclaim(browser.values);
    const { coordinator, head } = tab(browser.storage, reclaim);
    const data = save('newest', 1_500);

    coordinator.stage(data);
    await expect(coordinator.flush()).resolves.toMatchObject({ primary: 'saved', recovery: 'protected' });

    expect(browser.values.get(KEY)).toBe(data);
    expect(head()?.data).toBe(data);
    expect(JSON.parse(browser.values.get(profileMirrorMetadataKey(KEY))!).persistenceRevision).toBe(1);
    // One copy made room; the two newer ones stay.
    expect(calls()).toBe(1);
    expect(JSON.parse(browser.values.get(RING)!)).toHaveLength(2);
  });

  it('keeps the progress in the journal and says so when nothing can be given up', async () => {
    const browser = fullBrowser(4_000);
    browser.values.set(RING, JSON.stringify(['a'.repeat(3_500)]));
    const earlier = save('earlier');
    browser.values.set(KEY, earlier);
    const { coordinator, head } = tab(browser.storage);
    const data = save('newest', 1_500);

    coordinator.stage(data);
    await expect(coordinator.flush()).resolves.toMatchObject({ primary: 'saved', recovery: 'degraded' });

    expect(head()?.data).toBe(data);
    expect(browser.values.get(KEY)).toBe(earlier);
  });

  it('makes room for the save written as the page closes, and for its mark', () => {
    const browser = fullBrowser(4_000);
    browser.values.set(RING, JSON.stringify(['a'.repeat(1_300), 'b'.repeat(1_300), 'c'.repeat(1_300)]));
    const { reclaim } = ringReclaim(browser.values);
    const { coordinator } = tab(browser.storage, reclaim);
    const data = save('closing', 2_000);

    expect(coordinator.mirrorLifecycle(data)).toBe(true);

    expect(browser.values.get(KEY)).toBe(data);
    expect(lifecycleMarkMatches(browser.values.get(profileLifecycleMarkKey(KEY)) ?? null, data)).toBe(true);
  });

  it('stops when giving something up frees nothing', async () => {
    const browser = fullBrowser(1_000);
    let calls = 0;
    const { coordinator } = tab(browser.storage, () => { calls += 1; return true; });

    coordinator.stage(save('too big', 5_000));
    await expect(coordinator.flush()).resolves.toMatchObject({ primary: 'saved', recovery: 'degraded' });

    expect(browser.values.has(KEY)).toBe(false);
    expect(calls).toBeGreaterThan(0);
    expect(calls).toBeLessThan(200);
  });

  it('treats a reclaim step that throws as nothing left to give up', async () => {
    const browser = fullBrowser(1_000);
    const { coordinator } = tab(browser.storage, () => { throw new Error('ring unreadable'); });

    coordinator.stage(save('too big', 5_000));
    await expect(coordinator.flush()).resolves.toMatchObject({ primary: 'saved', recovery: 'degraded' });
  });
});
