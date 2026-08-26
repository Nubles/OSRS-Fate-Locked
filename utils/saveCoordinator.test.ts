import { describe, expect, it } from 'vitest';
import type { GameState } from '../types';
import type { SaveStorage } from './pendingSaves';
import type {
  MirrorMetadata,
  RecoveryCheckpoint,
  RecoveryHead,
  RecoveryRepository,
  RecoveryWriteResult,
  SaveDurabilitySnapshot,
} from './recoveryTypes';
import type { SaveValidationResult } from './saveSchema';
import type { SaveWriteAuthorization } from './profileWriterLease';
import { createSaveCoordinator, type SaveCoordinator } from './saveCoordinator';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

const deferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(value => { resolve = value; });
  return { promise, resolve };
};

const noteFromData = (data: string): string => JSON.parse(data).note as string;

const save = (note: string): string => JSON.stringify({
  note,
  runId: 'run-alpha',
  runRevision: 1,
});

const stateFor = (data: string): GameState => ({
  ...JSON.parse(data) as Record<string, unknown>,
  runId: 'run-alpha',
  runRevision: 1,
} as unknown as GameState);

type HarnessOptions = {
  events?: string[];
  journalGate?: Deferred<void>;
  journalGates?: Deferred<void>[];
  journalResult?: RecoveryWriteResult;
  journalResults?: RecoveryWriteResult[];
  journalResultFor?: (record: RecoveryHead) => RecoveryWriteResult;
  mirrorResult?: 'success' | 'failure';
  metadataResult?: RecoveryWriteResult;
  initialPersistenceRevision?: number;
  initialHead?: RecoveryHead | null;
  initialMetadata?: MirrorMetadata | null;
  authorize?: () => SaveWriteAuthorization;
  checksum?: (data: string) => Promise<string>;
  validate?: (data: string) => SaveValidationResult;
  now?: () => number;
};

type Harness = {
  coordinator: SaveCoordinator;
  storage: SaveStorage;
  events: string[];
  writtenNotes: () => string[];
  journalRevisions: () => number[];
  checkpointRecords: () => RecoveryCheckpoint[];
  setJournalResult: (result: RecoveryWriteResult) => void;
  setMirrorResult: (result: 'success' | 'failure') => void;
};

const harness = (options: HarnessOptions = {}): Harness => {
  const events = options.events ?? [];
  const values = new Map<string, string>();
  const journalWrites: string[] = [];
  const journalRecords: RecoveryHead[] = [];
  const checkpointWrites: RecoveryCheckpoint[] = [];
  let journalResult = options.journalResult ?? { stored: true };
  const journalResults = [...(options.journalResults ?? [])];
  const journalGates = [...(options.journalGates ?? [])];
  let mirrorResult = options.mirrorResult ?? 'success';
  let metadataResult = options.metadataResult ?? { stored: true };

  const storage: SaveStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, data) => {
      if (key.endsWith('__mirrorMeta')) {
        const checksum = (JSON.parse(data) as MirrorMetadata).checksum;
        events.push(`mirror-meta:${checksum.replace('checksum-', '')}`);
      }
      else events.push(`mirror:${noteFromData(data)}`);
      if (mirrorResult === 'failure') throw new Error('mirror unavailable');
      values.set(key, data);
    },
    removeItem: key => { values.delete(key); },
  };

  const repository: RecoveryRepository = {
    getHead: async () => options.initialHead ?? null,
    putHead: async record => {
      journalRecords.push(record);
      journalWrites.push(noteFromData(record.data));
      events.push(`journal:${noteFromData(record.data)}`);
      const gate = journalGates.shift() ?? options.journalGate;
      if (gate) await gate.promise;
      return options.journalResultFor?.(record)
        ?? journalResults.shift()
        ?? journalResult;
    },
    listCheckpoints: async () => [],
    putCheckpoint: async record => {
      checkpointWrites.push(record);
      return { stored: true };
    },
    deleteCheckpoints: async () => ({ stored: true }),
    getMetadata: async <T>() => (options.initialMetadata ?? null) as T | null,
    putMetadata: async () => metadataResult,
    close: () => undefined,
  };

  const defaultValidate = (data: string): SaveValidationResult => {
    events.push(`validate:${noteFromData(data)}`);
    return {
      ok: true,
      state: stateFor(data),
      sourceVersion: 1,
      warnings: [],
    };
  };
  const validate = options.validate ?? defaultValidate;
  const checksum = options.checksum ?? (async data => {
    events.push(`hash:${noteFromData(data)}`);
    return `checksum-${noteFromData(data)}`;
  });
  const now = options.now ?? (() => 1_700_000_000_000);

  const coordinator = createSaveCoordinator({
    profileId: 'alpha',
    storageKey: 'FATE_PROFILE_alpha',
    storage,
    repository,
    authorizeWrite: options.authorize ?? (() => ({ ok: true })),
    validate,
    checksum,
    now,
    initialPersistenceRevision: options.initialPersistenceRevision ?? 0,
  });

  return {
    coordinator,
    storage,
    events,
    writtenNotes: () => [...journalWrites],
    journalRevisions: () => journalRecords.map(record => record.persistenceRevision),
    checkpointRecords: () => [...checkpointWrites],
    setJournalResult: result => { journalResult = result; },
    setMirrorResult: result => { mirrorResult = result; },
  };
};

describe('coalescing journal-first save coordinator', () => {
  it('commits the journal before mirroring identical bytes', async () => {
    const events: string[] = [];
    const { coordinator } = harness({ events });

    coordinator.stage(save('newest'));
    await coordinator.flush();

    expect(events).toEqual([
      'validate:newest',
      'hash:newest',
      'journal:newest',
      'mirror:newest',
      'mirror-meta:newest',
    ]);
  });

  it('runs one follow-up flush with the newest state', async () => {
    const gate = deferred<void>();
    const testHarness = harness({ journalGate: gate });
    testHarness.coordinator.stage(save('first'));
    const flushing = testHarness.coordinator.flush();

    testHarness.coordinator.stage(save('second'));
    testHarness.coordinator.stage(save('third'));
    gate.resolve();

    await flushing;
    await testHarness.coordinator.whenIdle();

    expect(testHarness.writtenNotes()).toEqual(['first', 'third']);
  });

  it('does not journal a candidate superseded while its checksum is pending', async () => {
    const checksumGate = deferred<void>();
    let firstChecksum = true;
    const testHarness = harness({
      checksum: async data => {
        if (firstChecksum) {
          firstChecksum = false;
          await checksumGate.promise;
        }
        return `checksum-${noteFromData(data)}`;
      },
    });

    testHarness.coordinator.stage(save('old'));
    const flushing = testHarness.coordinator.flush();
    testHarness.coordinator.stage(save('new'));
    checksumGate.resolve();

    await flushing;
    await testHarness.coordinator.whenIdle();

    expect(testHarness.writtenNotes()).toEqual(['new']);
    expect(testHarness.journalRevisions()).toEqual([1]);
  });

  it('does not publish a stale saved timestamp while the newer candidate fails', async () => {
    let clock = 0;
    const priorJournal = deferred<void>();
    priorJournal.resolve();
    const candidateJournal = deferred<void>();
    const testHarness = harness({
      now: () => ++clock,
      journalGates: [priorJournal, candidateJournal],
      journalResultFor: record => noteFromData(record.data) === 'candidate-b'
        ? { stored: false, reason: 'storage_unavailable' }
        : { stored: true },
      mirrorResult: 'failure',
    });

    testHarness.coordinator.stage(save('prior'));
    await testHarness.coordinator.flush();
    expect(testHarness.coordinator.getSnapshot().savedAt).toBe(2);

    testHarness.coordinator.stage(save('candidate-a'));
    const flushing = testHarness.coordinator.flush();
    testHarness.coordinator.stage(save('candidate-b'));
    candidateJournal.resolve();

    await flushing;
    await testHarness.coordinator.whenIdle();

    expect(testHarness.coordinator.getSnapshot()).toEqual({
      primary: 'failed',
      recovery: 'degraded',
      savedAt: 2,
      failureReason: 'storage_unavailable',
    });
  });

  it('starts at the revision immediately after the verified initial revision', async () => {
    const testHarness = harness({ initialPersistenceRevision: 9 });
    testHarness.coordinator.stage(save('revision-ten'));

    await testHarness.coordinator.flush();

    expect(testHarness.journalRevisions()).toEqual([10]);
  });

  it('does not write after ownership is lost following the checksum boundary', async () => {
    let ownsWrite = true;
    const events: string[] = [];
    const testHarness = harness({
      events,
      authorize: () => ownsWrite
        ? { ok: true }
        : { ok: false, reason: 'ownership_conflict' },
      checksum: async data => {
        events.push(`hash:${noteFromData(data)}`);
        ownsWrite = false;
        return `checksum-${noteFromData(data)}`;
      },
    });

    testHarness.coordinator.stage(save('blocked'));
    const snapshot = await testHarness.coordinator.flush();

    expect(snapshot).toEqual({
      primary: 'failed',
      recovery: 'degraded',
      savedAt: null,
      failureReason: 'ownership_conflict',
    });
    expect(testHarness.events).toEqual(['validate:blocked', 'hash:blocked']);
  });

  it('preserves a journal ownership failure after the lease is restored before classification', async () => {
    let ownsWrite = true;
    const authorize = () => ownsWrite
      ? { ok: true as const }
      : { ok: false as const, reason: 'ownership_conflict' as const };
    const testHarness = harness({
      mirrorResult: 'failure',
      authorize,
      journalResultFor: () => {
        ownsWrite = false;
        const result = authorize();
        ownsWrite = true;
        return result.ok
          ? { stored: true as const }
          : { stored: false as const, reason: result.reason };
      },
    });

    const result = await testHarness.coordinator.writeReplacement(save('ownership-reason'), 'replacement');

    expect(result).toEqual({
      primary: 'failed',
      recovery: 'degraded',
      savedAt: null,
      failureReason: 'ownership_conflict',
    });
    expect(testHarness.coordinator.getSnapshot()).toEqual(result);
    expect(ownsWrite).toBe(true);
  });

  it('reports a journal-only success as a saved but degraded primary', async () => {
    const testHarness = harness({ mirrorResult: 'failure' });
    testHarness.coordinator.stage(save('journal-only'));

    await expect(testHarness.coordinator.flush()).resolves.toEqual({
      primary: 'saved',
      recovery: 'degraded',
      savedAt: 1_700_000_000_000,
    });
  });

  it('reports a mirror-only success as a saved but degraded primary', async () => {
    const testHarness = harness({ journalResult: { stored: false, reason: 'storage_unavailable' } });
    testHarness.coordinator.stage(save('mirror-only'));

    await expect(testHarness.coordinator.flush()).resolves.toEqual({
      primary: 'saved',
      recovery: 'degraded',
      savedAt: 1_700_000_000_000,
      failureReason: 'storage_unavailable',
    });
  });

  it('keeps the newest state pending after both stores fail', async () => {
    const testHarness = harness({
      journalResult: { stored: false, reason: 'storage_unavailable' },
      mirrorResult: 'failure',
    });
    testHarness.coordinator.stage(save('pending'));

    await expect(testHarness.coordinator.flush()).resolves.toEqual({
      primary: 'failed',
      recovery: 'degraded',
      savedAt: null,
      failureReason: 'storage_unavailable',
    });
    testHarness.setJournalResult({ stored: true });
    testHarness.setMirrorResult('success');

    await expect(testHarness.coordinator.retry()).resolves.toEqual({
      primary: 'saved',
      recovery: 'protected',
      savedAt: 1_700_000_000_000,
    });
  });

  it('can retry a degraded one-store save to restore recovery protection', async () => {
    const testHarness = harness({ mirrorResult: 'failure' });
    testHarness.coordinator.stage(save('repairable'));

    await expect(testHarness.coordinator.flush()).resolves.toMatchObject({
      primary: 'saved',
      recovery: 'degraded',
    });
    testHarness.setMirrorResult('success');

    await expect(testHarness.coordinator.retry()).resolves.toEqual({
      primary: 'saved',
      recovery: 'protected',
      savedAt: 1_700_000_000_000,
    });
  });

  it('does not let a stale completion publish the older mirror', async () => {
    const gate = deferred<void>();
    const testHarness = harness({ journalGate: gate });
    testHarness.coordinator.stage(save('old'));
    const flushing = testHarness.coordinator.flush();
    testHarness.coordinator.stage(save('new'));
    gate.resolve();

    await flushing;
    await testHarness.coordinator.whenIdle();

    expect(testHarness.events.filter(event => event.startsWith('mirror:'))).toEqual(['mirror:new']);
  });

  it('keeps a newer lifecycle mirror ahead of an older journal completion', async () => {
    const gate = deferred<void>();
    const testHarness = harness({ journalGate: gate });
    testHarness.coordinator.stage(save('old'));
    const flushing = testHarness.coordinator.flush();

    expect(testHarness.coordinator.mirrorLifecycle(save('lifecycle-new'))).toBe(true);
    gate.resolve();
    await flushing;
    await testHarness.coordinator.whenIdle();

    expect(testHarness.events.filter(event => event.startsWith('mirror:'))).toEqual([
      'mirror:lifecycle-new',
      'mirror:lifecycle-new',
    ]);
  });

  it('treats a primary readback mismatch as a mirror failure', async () => {
    const events: string[] = [];
    const testHarness = harness({ events });
    testHarness.storage.getItem = key => key.endsWith('__mirrorMeta')
      ? null
      : 'different-bytes';
    testHarness.coordinator.stage(save('mismatch'));

    await expect(testHarness.coordinator.flush()).resolves.toMatchObject({
      primary: 'saved',
      recovery: 'degraded',
    });
    expect(events).toContain('journal:mismatch');
  });

  it('writes and verifies a checkpoint with a monotonic revision', async () => {
    const testHarness = harness({ initialPersistenceRevision: 4 });
    const result = await testHarness.coordinator.createCheckpoint(save('checkpoint'), 'interval');

    expect(result).toEqual({ stored: true });
    expect(testHarness.checkpointRecords()).toHaveLength(1);
    expect(testHarness.checkpointRecords()[0]).toMatchObject({
      profileId: 'alpha',
      persistenceRevision: 5,
      reason: 'interval',
      data: save('checkpoint'),
    });
  });

  it('mirrors lifecycle bytes synchronously without waiting for the journal', () => {
    const testHarness = harness();

    expect(testHarness.coordinator.mirrorLifecycle(save('lifecycle'))).toBe(true);
    expect(testHarness.events).toEqual(['mirror:lifecycle']);
  });

  it('does not discard a staged snapshot when disposed', () => {
    const testHarness = harness();
    testHarness.coordinator.stage(save('still-pending'));
    testHarness.coordinator.dispose();

    expect(testHarness.coordinator.getSnapshot()).toEqual({
      primary: 'saving',
      recovery: 'checking',
      savedAt: null,
    });
  });

  it('does not report an in-flight replacement as saved after disposal', async () => {
    const gate = deferred<void>();
    const testHarness = harness({ journalGate: gate });
    testHarness.coordinator.stage(save('before-dispose'));
    const firstFlush = testHarness.coordinator.flush();
    const replacement = testHarness.coordinator.writeReplacement(save('replacement'), 'reset');

    testHarness.coordinator.dispose();
    gate.resolve();

    await firstFlush;
    await expect(replacement).resolves.toMatchObject({
      primary: 'failed',
      recovery: 'degraded',
    });
  });

  it('does not claim a replacement durable after a newer staged edit wins', async () => {
    const gate = deferred<void>();
    const testHarness = harness({ journalGate: gate });
    testHarness.coordinator.stage(save('before-replacement'));
    const firstFlush = testHarness.coordinator.flush();
    const replacement = testHarness.coordinator.writeReplacement(save('replacement'), 'import');

    testHarness.coordinator.stage(save('newer-edit'));
    gate.resolve();

    await firstFlush;
    await expect(replacement).resolves.toMatchObject({
      primary: 'failed',
      recovery: 'degraded',
    });
    await testHarness.coordinator.whenIdle();
    expect(testHarness.writtenNotes()).toEqual(['before-replacement', 'newer-edit']);
  });
});
