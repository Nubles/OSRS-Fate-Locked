import { describe, expect, it, vi } from 'vitest';
import { initialState } from '../context/GameContext';
import { serializeCurrent } from './gamePersistence';
import type {
  RecoveryCheckpoint,
  RecoveryHead,
  RecoveryRepository,
  RecoveryWriteResult,
} from './recoveryTypes';
import type { SaveWriteAuthorization } from './profileWriterLease';
import { migrateLegacyBackupRing, type LegacyBackupEntry } from './legacyBackupMigration';

const allowWrite = (): SaveWriteAuthorization => ({ ok: true });

const legacy = (keys: number, ts: number): LegacyBackupEntry => ({
  ts,
  reason: `Before import ${keys}`,
  summary: `${keys} keys`,
  data: serializeCurrent({
    ...initialState,
    keys,
    runId: initialState.runId,
    runRevision: keys,
  }),
});

const repositoryHarness = () => {
  const checkpoints: RecoveryCheckpoint[] = [];
  let head: RecoveryHead | null = null;
  let metadata: unknown = null;
  const repository: RecoveryRepository = {
    getHead: async () => head,
    putHead: async (record): Promise<RecoveryWriteResult> => {
      head = record;
      return { stored: true };
    },
    listCheckpoints: async () => [...checkpoints],
    putCheckpoint: async record => {
      checkpoints.push(record);
      return { stored: true };
    },
    deleteCheckpoints: async () => ({ stored: true }),
    getMetadata: async <T,>() => metadata as T | null,
    putMetadata: async <T,>(_key: string, value: T) => {
      metadata = value;
      return { stored: true };
    },
    close: () => undefined,
  };
  return { repository, checkpoints, getMetadata: () => metadata };
};

describe('legacy backup migration', () => {
  it('imports valid unique legacy backups once', async () => {
    const harness = repositoryHarness();
    const input = {
      profileId: 'alpha',
      rawRing: JSON.stringify([
        legacy(3, 1_700_000_000_003),
        legacy(2, 1_700_000_000_002),
        { ts: 1_700_000_000_001, reason: 'corrupt', summary: 'bad', data: '{bad' },
      ]),
      repository: harness.repository,
      authorizeWrite: allowWrite,
      defaults: initialState,
      now: () => 1_700_000_000_010,
    };

    await expect(migrateLegacyBackupRing(input)).resolves.toEqual({
      imported: 2,
      skipped: 1,
      alreadyMigrated: false,
    });
    await expect(migrateLegacyBackupRing(input)).resolves.toMatchObject({
      imported: 0,
      alreadyMigrated: true,
    });
    expect(harness.checkpoints).toHaveLength(2);
    expect(harness.checkpoints.map(record => record.reason)).toEqual([
      'legacy-import',
      'legacy-import',
    ]);
    expect(harness.getMetadata()).toMatchObject({
      version: 1,
      imported: 2,
      skipped: 1,
    });
  });

  it('deduplicates equal legacy bytes against existing checkpoints', async () => {
    const harness = repositoryHarness();
    const existing = legacy(5, 1_700_000_000_005);
    await migrateLegacyBackupRing({
      profileId: 'alpha',
      rawRing: JSON.stringify([existing, legacy(4, 1_700_000_000_004)]),
      repository: harness.repository,
      authorizeWrite: allowWrite,
      defaults: initialState,
    });
    expect(harness.checkpoints).toHaveLength(2);

    // A stale migration marker must not cause a second checkpoint for the
    // same bytes if a prior write completed before its metadata transaction.
    const metadata = harness.getMetadata() as { version: number };
    expect(metadata.version).toBe(1);
    const second = await migrateLegacyBackupRing({
      profileId: 'alpha',
      rawRing: JSON.stringify([existing]),
      repository: harness.repository,
      authorizeWrite: allowWrite,
      defaults: initialState,
    });
    expect(second).toMatchObject({ imported: 0, alreadyMigrated: true });
    expect(harness.checkpoints).toHaveLength(2);
  });

  it('does not publish a checkpoint or migration marker after ownership is lost during hashing', async () => {
    const harness = repositoryHarness();
    let authorized = true;
    const checksumGate = Promise.resolve();
    const authorize = vi.fn(() => authorized
      ? ({ ok: true } as const)
      : ({ ok: false, reason: 'ownership_conflict' } as const));
    authorized = false;

    await expect(migrateLegacyBackupRing({
      profileId: 'alpha',
      rawRing: JSON.stringify([legacy(3, 1_700_000_000_003)]),
      repository: harness.repository,
      authorizeWrite: authorize,
      defaults: initialState,
      checksum: async () => {
        await checksumGate;
        return 'a'.repeat(64);
      },
    })).resolves.toMatchObject({ imported: 0, alreadyMigrated: false });

    expect(harness.checkpoints).toHaveLength(0);
    expect(harness.getMetadata()).toBeNull();
    expect(authorize).toHaveBeenCalled();
  });
});
