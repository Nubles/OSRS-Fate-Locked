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
import { checksumSave } from './saveIntegrity';
import { resolveSaveRecovery } from './saveRecovery';

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
  return {
    repository,
    checkpoints,
    getMetadata: () => metadata,
    clearMetadata: () => { metadata = null; },
    setHead: (next: RecoveryHead | null) => { head = next; },
  };
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

  it('normalizes missing run metadata before storing and can deduplicate after a restart', async () => {
    const harness = repositoryHarness();
    const rawState = JSON.parse(legacy(7, 1_700_000_000_007).data) as Record<string, unknown>;
    delete rawState.runId;
    const raw = JSON.stringify(rawState);
    const firstDefaults = { ...initialState, runId: '11111111-1111-4111-8111-111111111111' };
    const restartDefaults = { ...initialState, runId: '22222222-2222-4222-8222-222222222222' };
    const input = {
      profileId: 'alpha',
      rawRing: JSON.stringify([{ ...legacy(7, 1_700_000_000_007), data: raw }]),
      repository: harness.repository,
      authorizeWrite: allowWrite,
      defaults: firstDefaults,
    };

    await expect(migrateLegacyBackupRing(input)).resolves.toMatchObject({ imported: 1 });
    const first = harness.checkpoints[0];
    expect(JSON.parse(first.data).runId).toBe(first.runId);
    expect(first.data).not.toBe(raw);

    // Simulate a process restart after the checkpoint transaction but before
    // the migration marker became visible.
    harness.clearMetadata();
    await expect(migrateLegacyBackupRing({ ...input, defaults: restartDefaults }))
      .resolves.toMatchObject({ imported: 0 });
    expect(harness.checkpoints).toHaveLength(1);
  });

  it('uses one stable run id for every missing-runId entry across a restart', async () => {
    const harness = repositoryHarness();
    const first = JSON.parse(legacy(2, 1_700_000_000_002).data) as Record<string, unknown>;
    const second = JSON.parse(legacy(1, 1_700_000_000_001).data) as Record<string, unknown>;
    delete first.runId;
    delete second.runId;
    const rawRing = JSON.stringify([
      { ...legacy(2, 1_700_000_000_002), data: JSON.stringify(first) },
      { ...legacy(1, 1_700_000_000_001), data: JSON.stringify(second) },
    ]);
    const input = {
      profileId: 'alpha',
      rawRing,
      repository: harness.repository,
      authorizeWrite: allowWrite,
      defaults: { ...initialState, runId: 'restart-one' },
    };

    await expect(migrateLegacyBackupRing(input)).resolves.toMatchObject({ imported: 2 });
    expect(new Set(harness.checkpoints.map(record => record.runId)).size).toBe(1);
    expect(harness.checkpoints.map(record => JSON.parse(record.data).runId))
      .toEqual(harness.checkpoints.map(record => record.runId));

    harness.clearMetadata();
    await expect(migrateLegacyBackupRing({
      ...input,
      defaults: { ...initialState, runId: 'restart-two' },
    })).resolves.toMatchObject({ imported: 0 });
    expect(harness.checkpoints).toHaveLength(2);
  });

  it('imports at most eight legacy entries even when the compatibility ring is oversized', async () => {
    const harness = repositoryHarness();
    const rawRing = JSON.stringify(Array.from({ length: 12 }, (_, index) => (
      legacy(index + 1, 1_700_000_000_100 - index)
    )));

    await expect(migrateLegacyBackupRing({
      profileId: 'alpha',
      rawRing,
      repository: harness.repository,
      authorizeWrite: allowWrite,
      defaults: initialState,
    })).resolves.toMatchObject({ imported: 8, skipped: 4 });
    expect(harness.checkpoints).toHaveLength(8);
  });

  it('keeps imported chronology below the current durable head for recovery arbitration', async () => {
    const harness = repositoryHarness();
    const current = legacy(99, 1_700_000_000_500).data;
    const currentHead: RecoveryHead = {
      profileId: 'alpha',
      persistenceRevision: 4,
      runId: initialState.runId,
      runRevision: 99,
      capturedAt: 1_700_000_000_500,
      checksum: await checksumSave(current),
      data: current,
    };
    harness.setHead(currentHead);

    await migrateLegacyBackupRing({
      profileId: 'alpha',
      rawRing: JSON.stringify([
        legacy(3, 1_700_000_000_300),
        legacy(2, 1_700_000_000_200),
        legacy(1, 1_700_000_000_100),
      ]),
      repository: harness.repository,
      authorizeWrite: allowWrite,
      defaults: initialState,
    });

    const chronological = [...harness.checkpoints].sort(
      (a, b) => a.persistenceRevision - b.persistenceRevision,
    );
    expect(chronological.map(record => record.capturedAt)).toEqual([
      1_700_000_000_100,
      1_700_000_000_200,
      1_700_000_000_300,
    ]);
    expect(Math.max(...chronological.map(record => record.persistenceRevision))).toBeLessThanOrEqual(4);

    const decision = await resolveSaveRecovery({
      profileId: 'alpha',
      pendingRaw: null,
      primaryRaw: current,
      mirrorMetadataRaw: null,
      head: currentHead,
      checkpoints: harness.checkpoints,
      defaults: initialState,
    });
    expect(decision.kind).toBe('ready');
    expect(decision.kind === 'ready' ? decision.maxDurablePersistenceRevision : null).toBe(4);
  });

  it('does not let an existing checkpoint revision move legacy history past the head', async () => {
    const harness = repositoryHarness();
    const current = legacy(99, 1_700_000_000_500).data;
    harness.setHead({
      profileId: 'alpha',
      persistenceRevision: 4,
      runId: initialState.runId,
      runRevision: 99,
      capturedAt: 1_700_000_000_500,
      checksum: await checksumSave(current),
      data: current,
    });
    const priorCheckpoint = legacy(88, 1_700_000_000_050);
    harness.checkpoints.push({
      profileId: 'alpha',
      persistenceRevision: 20,
      runId: initialState.runId,
      runRevision: 88,
      capturedAt: priorCheckpoint.ts,
      reason: 'interval',
      checksum: await checksumSave(priorCheckpoint.data),
      data: priorCheckpoint.data,
    });

    await migrateLegacyBackupRing({
      profileId: 'alpha',
      rawRing: JSON.stringify([
        legacy(3, 1_700_000_000_300),
        legacy(2, 1_700_000_000_200),
        legacy(1, 1_700_000_000_100),
      ]),
      repository: harness.repository,
      authorizeWrite: allowWrite,
      defaults: initialState,
    });

    const imported = harness.checkpoints.filter(record => record.reason === 'legacy-import');
    expect(imported).toHaveLength(3);
    expect(Math.max(...imported.map(record => record.persistenceRevision))).toBeLessThanOrEqual(4);
  });

  it('skips legacy entries when no revision at or below the head is available', async () => {
    const harness = repositoryHarness();
    const current = legacy(99, 1_700_000_000_500).data;
    harness.setHead({
      profileId: 'alpha',
      persistenceRevision: 0,
      runId: initialState.runId,
      runRevision: 99,
      capturedAt: 1_700_000_000_500,
      checksum: await checksumSave(current),
      data: current,
    });

    const result = await migrateLegacyBackupRing({
      profileId: 'alpha',
      rawRing: JSON.stringify([
        legacy(3, 1_700_000_000_300),
        legacy(2, 1_700_000_000_200),
        legacy(1, 1_700_000_000_100),
      ]),
      repository: harness.repository,
      authorizeWrite: allowWrite,
      defaults: initialState,
    });

    const imported = harness.checkpoints.filter(record => record.reason === 'legacy-import');
    expect(result).toMatchObject({ imported: 1, skipped: 2 });
    expect(imported).toHaveLength(1);
    expect(imported[0].persistenceRevision).toBe(0);
  });

  it('keeps legacy history below existing checkpoints when the head is absent', async () => {
    const harness = repositoryHarness();
    const prior = legacy(88, 1_700_000_000_050);
    harness.checkpoints.push({
      profileId: 'alpha',
      persistenceRevision: 3,
      runId: initialState.runId,
      runRevision: 88,
      capturedAt: prior.ts,
      reason: 'interval',
      checksum: await checksumSave(prior.data),
      data: prior.data,
    });

    await migrateLegacyBackupRing({
      profileId: 'alpha',
      rawRing: JSON.stringify([
        legacy(2, 1_700_000_000_200),
        legacy(1, 1_700_000_000_100),
      ]),
      repository: harness.repository,
      authorizeWrite: allowWrite,
      defaults: initialState,
    });

    const imported = harness.checkpoints.filter(record => record.reason === 'legacy-import');
    expect(imported).toHaveLength(2);
    expect(Math.max(...imported.map(record => record.persistenceRevision))).toBeLessThan(3);
  });
});
