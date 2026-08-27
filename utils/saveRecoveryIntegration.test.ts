import { describe, expect, it } from 'vitest';
import type { GameState } from '../types';
import type { SaveStorage } from './pendingSaves';
import { archiveCorruptSave } from './profileStorage';
import {
  mutateProfileMetadata,
  type ProfileTransactionDependencies,
} from './profileMetadataTransaction';
import {
  PROFILE_METADATA_BACKUP_KEY,
  PROFILES_KEY,
} from './profileMetadata';
import type {
  RecoveryCheckpoint,
  RecoveryHead,
  RecoveryRepository,
} from './recoveryTypes';
import type { SaveValidationResult } from './saveSchema';
import type { SaveWriteAuthorization } from './profileWriterLease';
import { createSaveCoordinator } from './saveCoordinator';
import {
  profileCorruptArchiveKey,
  profileMirrorMetadataKey,
} from './storageRecovery';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

const deferred = <T,>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(resolvePromise => { resolve = resolvePromise; });
  return { promise, resolve };
};

const save = (note: string): string => JSON.stringify({
  note,
  runId: 'run-alpha',
  runRevision: 1,
});

const noteFromData = (data: string): string => JSON.parse(data).note as string;

const stateFor = (data: string): GameState => ({
  ...JSON.parse(data) as Record<string, unknown>,
  runId: 'run-alpha',
  runRevision: 1,
} as unknown as GameState);

const waitUntil = async (predicate: () => boolean): Promise<void> => {
  for (let attempt = 0; attempt < 100 && !predicate(); attempt += 1) {
    await Promise.resolve();
  }
  expect(predicate()).toBe(true);
};

type IntegrationStorage = SaveStorage & Pick<Storage, 'length' | 'key' | 'removeItem'> & {
  values: Map<string, string>;
};

const createStorage = (): IntegrationStorage => {
  const values = new Map<string, string>();
  return {
    values,
    get length() { return values.size; },
    key: index => [...values.keys()][index] ?? null,
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: key => { values.delete(key); },
  };
};

describe('crash-safe save cross-store arbitration', () => {
  it('blocks stale head, checkpoint, mirror, sidecar, archive, and deletion writes before takeover flushes newest bytes', async () => {
    const storage = createStorage();
    const events: string[] = [];
    const raceStorageKey = 'FATE_PROFILE_race';
    const raceMirrorKey = profileMirrorMetadataKey(raceStorageKey);
    const raceArchiveKey = profileCorruptArchiveKey(raceStorageKey);
    let activeOwner: 'tab-a' | 'tab-b' = 'tab-a';
    const authorize = (ownerId: 'tab-a' | 'tab-b') => (): SaveWriteAuthorization => (
      activeOwner === ownerId
        ? { ok: true }
        : { ok: false, reason: 'ownership_conflict' }
    );

    const headGate = deferred<void>();
    const checkpointGate = deferred<void>();
    let headAttempts = 0;
    let checkpointAttempts = 0;
    let head: RecoveryHead | null = null;
    const checkpoints: RecoveryCheckpoint[] = [];
    const metadata = new Map<string, unknown>();
    const repository: RecoveryRepository = {
      getHead: async () => head,
      putHead: async (record, authorizeWrite) => {
        headAttempts += 1;
        events.push(`head-attempt:${noteFromData(record.data)}`);
        if (headAttempts === 1) await headGate.promise;
        const ownership = authorizeWrite();
        if (ownership.ok === false) return { stored: false, reason: ownership.reason };
        head = record;
        events.push(`head-stored:${noteFromData(record.data)}`);
        return { stored: true };
      },
      listCheckpoints: async profileId => checkpoints.filter(record => record.profileId === profileId),
      putCheckpoint: async (record, authorizeWrite) => {
        checkpointAttempts += 1;
        events.push(`checkpoint-attempt:${noteFromData(record.data)}`);
        if (checkpointAttempts === 1) await checkpointGate.promise;
        const ownership = authorizeWrite();
        if (ownership.ok === false) return { stored: false, reason: ownership.reason };
        checkpoints.push(record);
        events.push(`checkpoint-stored:${noteFromData(record.data)}`);
        return { stored: true };
      },
      deleteCheckpoints: async (_profileId, _revisions, authorizeWrite) => {
        const ownership = authorizeWrite();
        if (ownership.ok === false) return { stored: false, reason: ownership.reason };
        return { stored: true };
      },
      getMetadata: async <T>(key: string) => (metadata.get(key) as T | undefined) ?? null,
      putMetadata: async <T>(key: string, value: T, authorizeWrite) => {
        const ownership = authorizeWrite();
        if (ownership.ok === false) return { stored: false, reason: ownership.reason };
        metadata.set(key, value);
        return { stored: true };
      },
      close: () => undefined,
    };

    const instrumentedStorage: SaveStorage = {
      getItem: storage.getItem,
      setItem: (key, data) => {
        storage.setItem(key, data);
        if (key === raceStorageKey) events.push(`mirror:${noteFromData(data)}`);
        if (key === raceMirrorKey) {
          events.push(`sidecar:${JSON.parse(data).checksum.replace('checksum-', '')}`);
        }
      },
      removeItem: storage.removeItem,
    };

    const validate = (data: string): SaveValidationResult => ({
      ok: true,
      state: stateFor(data),
      sourceVersion: 1,
      warnings: [],
    });
    const checksum = async (data: string): Promise<string> => `checksum-${noteFromData(data)}`;
    const coordinator = (ownerId: 'tab-a' | 'tab-b') => createSaveCoordinator({
      profileId: 'race',
      storageKey: raceStorageKey,
      storage: instrumentedStorage,
      repository,
      authorizeWrite: authorize(ownerId),
      validate,
      checksum,
      now: () => 1_700_000_000_000,
      initialPersistenceRevision: 0,
    });

    const stale = coordinator('tab-a');
    const takeover = coordinator('tab-b');

    stale.stage(save('tab-a-head'));
    const staleFlush = stale.flush();
    await waitUntil(() => headAttempts === 1);
    activeOwner = 'tab-b';
    headGate.resolve();
    await expect(staleFlush).resolves.toMatchObject({
      primary: 'failed',
      recovery: 'degraded',
      failureReason: 'ownership_conflict',
    });
    expect(head).toBeNull();
    expect(storage.values.has(raceStorageKey)).toBe(false);
    expect(storage.values.has(raceMirrorKey)).toBe(false);

    activeOwner = 'tab-a';
    const staleCheckpoint = stale.createCheckpoint(save('tab-a-checkpoint'), 'interval');
    await waitUntil(() => checkpointAttempts === 1);
    activeOwner = 'tab-b';
    checkpointGate.resolve();
    await expect(staleCheckpoint).resolves.toEqual({
      stored: false,
      reason: 'ownership_conflict',
    });
    expect(checkpoints).toEqual([]);

    activeOwner = 'tab-a';
    const archiveHashGate = deferred<void>();
    let archiveHashStarted = false;
    const staleArchive = archiveCorruptSave(
      instrumentedStorage,
      raceStorageKey,
      { primary: 'stale-corrupt-evidence', mirrorMetadata: null },
      {
        maxBytes: 0,
        checksum: async () => {
          archiveHashStarted = true;
          await archiveHashGate.promise;
          return 'stale-archive-hash';
        },
        authorizeWrite: authorize('tab-a'),
      },
    );
    await waitUntil(() => archiveHashStarted);
    activeOwner = 'tab-b';
    archiveHashGate.resolve();
    await expect(staleArchive).resolves.toEqual({
      ok: false,
      message: 'Save ownership changed before recovery evidence could be archived.',
    });
    expect(storage.values.has(raceArchiveKey)).toBe(false);

    const expectedDeletedKeys = [
      'FATE_PROFILE_alpha',
      'FATE_PROFILE_alpha__backups',
      'FATE_PROFILE_alpha__exportNag',
      'FATE_PROFILE_alpha__discord',
      'FATE_PROFILE_alpha__discordCursor',
      'fate_features_seen_v1_alpha',
      'FATE_PROFILE_alpha__writer',
      'FATE_PROFILE_alpha__mirrorMeta',
      'FATE_PROFILE_alpha__corruptArchive',
    ] as const;
    const metadataBeforeDelete = {
      version: 1 as const,
      revision: 3,
      profiles: [
        { id: 'alpha', name: 'Alpha', createdAt: 1 },
        { id: 'beta', name: 'Beta', createdAt: 2 },
      ],
      activeProfileId: 'beta',
    };
    storage.values.set(PROFILES_KEY, JSON.stringify(metadataBeforeDelete));
    for (const key of expectedDeletedKeys) storage.values.set(key, `alpha:${key}`);
    storage.values.set('FATE_PROFILE_alpha__writer', JSON.stringify({
      version: 1,
      ownerId: 'tab-a',
      expiresAt: 900,
    }));
    const originalSetItem = storage.setItem;
    let deletionTakeover = false;
    storage.setItem = (key, value) => {
      originalSetItem(key, value);
      if (key === PROFILE_METADATA_BACKUP_KEY && !deletionTakeover) {
        deletionTakeover = true;
        activeOwner = 'tab-b';
        storage.values.set('FATE_PROFILE_alpha__writer', JSON.stringify({
          version: 1,
          ownerId: 'tab-b',
          expiresAt: 10_000,
        }));
      }
    };
    activeOwner = 'tab-a';
    const deletionDependencies: ProfileTransactionDependencies = {
      storage,
      ownerId: 'tab-a',
      now: () => 1_000,
      wait: async () => undefined,
      validateGameSave: raw => raw.startsWith('valid:'),
      createProfileId: () => 'new-profile',
    };
    const staleDeletion = await mutateProfileMetadata(deletionDependencies, {
      type: 'delete',
      profileId: 'alpha',
    });
    expect(staleDeletion).toMatchObject({
      ok: false,
      reason: 'profile_in_use',
      deleteDetails: { removedEntries: 0, removalFailures: 0, rollbackFailures: 0 },
    });
    expect(deletionTakeover).toBe(true);
    expect(storage.values.get(PROFILES_KEY)).toBe(JSON.stringify(metadataBeforeDelete));
    for (const key of expectedDeletedKeys) expect(storage.values.has(key)).toBe(true);

    activeOwner = 'tab-a';
    takeover.stage(save('tab-b-newest'));
    await expect(takeover.flush()).resolves.toMatchObject({
      primary: 'failed',
      recovery: 'degraded',
      failureReason: 'ownership_conflict',
    });
    expect(head).toBeNull();
    expect(storage.values.has(raceStorageKey)).toBe(false);
    expect(storage.values.has(raceMirrorKey)).toBe(false);

    activeOwner = 'tab-b';
    await expect(takeover.retry()).resolves.toMatchObject({
      primary: 'saved',
      recovery: 'protected',
    });
    expect(head?.data).toBe(save('tab-b-newest'));
    expect(storage.values.get(raceStorageKey)).toBe(save('tab-b-newest'));
    expect(events.filter(event => event.startsWith('mirror:'))).toEqual(['mirror:tab-b-newest']);
    expect(events.filter(event => event.startsWith('sidecar:'))).toEqual(['sidecar:tab-b-newest']);
    expect(events).not.toContain('head-stored:tab-a-head');
    expect(events).not.toContain('checkpoint-stored:tab-a-checkpoint');
    expect(storage.values.has(raceArchiveKey)).toBe(false);
    expect(storage.values.get('FATE_PROFILE_alpha__writer')).toContain('tab-b');
  });
});
