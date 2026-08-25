import { describe, expect, it } from 'vitest';
import { initialState } from '../context/GameContext';
import type { GameState } from '../types';
import { checksumSave } from './saveIntegrity';
import {
  resolveSaveRecovery,
  type SaveRecoveryInput,
} from './saveRecovery';
import type {
  MirrorMetadata,
  RecoveryCheckpoint,
  RecoveryHead,
} from './recoveryTypes';

const PROFILE_ID = 'alpha';
const RUN_A = '123e4567-e89b-42d3-a456-426614174000';
const RUN_B = '123e4567-e89b-42d3-a456-426614174001';
const BASE_CAPTURED_AT = 1_752_000_000_000;

const defaultsFixture = (): GameState => ({
  ...structuredClone(initialState),
  runId: RUN_A,
  runRevision: 0,
});

type SaveOptions = {
  runId?: string;
  runRevision?: number;
  note?: string;
  version?: number;
};

const rawSave = ({
  runId = RUN_A,
  runRevision = 1,
  note = 'safe',
  version = 4,
}: SaveOptions = {}): string => {
  const state = structuredClone(initialState);
  state.version = version;
  state.runId = runId;
  state.runRevision = runRevision;
  state.userNotes = { recovery: note };
  return JSON.stringify(state);
};

type RecordOptions = SaveOptions & Partial<Omit<RecoveryHead, 'data' | 'checksum'>> & {
  data?: string;
  checksum?: string;
};

const record = async (options: RecordOptions = {}): Promise<RecoveryHead> => {
  const data = options.data ?? rawSave(options);
  return {
    profileId: PROFILE_ID,
    persistenceRevision: options.persistenceRevision ?? options.runRevision ?? 1,
    runId: options.runId ?? RUN_A,
    runRevision: options.runRevision ?? options.persistenceRevision ?? 1,
    capturedAt: options.capturedAt ?? BASE_CAPTURED_AT,
    checksum: options.checksum ?? await checksumSave(data),
    data,
  };
};

const checkpoint = async (options: RecordOptions = {}): Promise<RecoveryCheckpoint> => ({
  ...(await record(options)),
  reason: 'interval',
});

const metadata = async (
  options: Partial<MirrorMetadata> & { data: string },
): Promise<string> => JSON.stringify({
  version: 1,
  persistenceRevision: options.persistenceRevision ?? 1,
  capturedAt: options.capturedAt ?? BASE_CAPTURED_AT,
  checksum: options.checksum ?? await checksumSave(options.data),
});

const fixture = (
  overrides: Partial<SaveRecoveryInput> = {},
): SaveRecoveryInput => ({
  profileId: PROFILE_ID,
  pendingRaw: null,
  primaryRaw: null,
  mirrorMetadataRaw: null,
  head: null,
  checkpoints: [],
  defaults: defaultsFixture(),
  ...overrides,
});

describe('pure startup save recovery arbitration', () => {
  it('selects a newer valid journal head after an interrupted mirror', async () => {
    const mirror = await record({ persistenceRevision: 4, runRevision: 4, note: 'older' });
    const head = await record({ persistenceRevision: 5, runRevision: 5, note: 'newest' });

    const decision = await resolveSaveRecovery(fixture({
      primaryRaw: mirror.data,
      mirrorMetadataRaw: await metadata({ data: mirror.data, ...mirror }),
      head,
    }));

    expect(decision).toMatchObject({
      kind: 'ready',
      source: 'journal',
      reason: 'interrupted_mirror',
      persistenceRevision: 5,
      data: head.data,
    });
  });

  it('requires confirmation when corrupt primary falls back to a checkpoint', async () => {
    const safe = await checkpoint({ persistenceRevision: 3, runRevision: 3, note: 'safe' });

    const decision = await resolveSaveRecovery(fixture({
      primaryRaw: '{bad',
      checkpoints: [safe],
    }));

    expect(decision).toMatchObject({
      kind: 'recovery_required',
      cause: 'corrupt_primary',
      primaryRaw: '{bad',
      candidates: [expect.objectContaining({
        source: 'checkpoint',
        persistenceRevision: 3,
        data: safe.data,
      })],
    });
  });

  it('prefers a valid pending snapshot from the current lifetime', async () => {
    const primary = await record({ persistenceRevision: 4, runRevision: 4, note: 'durable' });
    const pending = rawSave({ runRevision: 5, note: 'pending' });

    const decision = await resolveSaveRecovery(fixture({
      pendingRaw: pending,
      primaryRaw: primary.data,
      mirrorMetadataRaw: await metadata({ data: primary.data, ...primary }),
    }));

    expect(decision).toMatchObject({
      kind: 'ready',
      source: 'pending',
      reason: 'normal',
      data: pending,
      needsJournalImport: true,
    });
  });

  it('loads a verified mirror newer than the journal for lifecycle import', async () => {
    const mirror = await record({ persistenceRevision: 6, runRevision: 6, note: 'lifecycle' });
    const head = await record({ persistenceRevision: 5, runRevision: 5, note: 'older' });

    const decision = await resolveSaveRecovery(fixture({
      primaryRaw: mirror.data,
      mirrorMetadataRaw: await metadata({ data: mirror.data, ...mirror }),
      head,
    }));

    expect(decision).toMatchObject({
      kind: 'ready',
      source: 'mirror',
      reason: 'lifecycle_mirror',
      persistenceRevision: 6,
      needsJournalImport: true,
      data: mirror.data,
    });
  });

  it('preserves a higher verified mirror revision when mirror and head bytes match', async () => {
    const shared = await record({ persistenceRevision: 5, runRevision: 5, note: 'same bytes' });
    const mirror = { ...shared, persistenceRevision: 6, capturedAt: BASE_CAPTURED_AT + 1 };

    const decision = await resolveSaveRecovery(fixture({
      primaryRaw: mirror.data,
      mirrorMetadataRaw: await metadata({ data: mirror.data, ...mirror }),
      head: shared,
    }));

    expect(decision).toMatchObject({
      kind: 'ready',
      source: 'mirror',
      reason: 'lifecycle_mirror',
      persistenceRevision: 6,
      needsJournalImport: true,
      data: shared.data,
    });
  });

  it('preserves a higher verified mirror revision when mirror and checkpoint bytes match', async () => {
    const shared = await record({ persistenceRevision: 5, runRevision: 5, note: 'same bytes' });
    const safeCheckpoint: RecoveryCheckpoint = {
      ...shared,
      reason: 'interval',
    };
    const mirror = { ...shared, persistenceRevision: 6, capturedAt: BASE_CAPTURED_AT + 1 };

    const decision = await resolveSaveRecovery(fixture({
      primaryRaw: mirror.data,
      mirrorMetadataRaw: await metadata({ data: mirror.data, ...mirror }),
      checkpoints: [safeCheckpoint],
    }));

    expect(decision).toMatchObject({
      kind: 'ready',
      source: 'mirror',
      reason: 'lifecycle_mirror',
      persistenceRevision: 6,
      needsJournalImport: true,
      data: shared.data,
    });
  });

  it('recognizes a lifecycle mirror whose stale sidecar still matches the head', async () => {
    const head = await record({ persistenceRevision: 5, runRevision: 5, note: 'head' });
    const primary = await record({ persistenceRevision: 6, runRevision: 6, note: 'same-batch lifecycle' });

    const decision = await resolveSaveRecovery(fixture({
      primaryRaw: primary.data,
      mirrorMetadataRaw: await metadata({ data: head.data, ...head }),
      head,
    }));

    expect(decision).toMatchObject({
      kind: 'ready',
      source: 'mirror',
      reason: 'lifecycle_mirror',
      persistenceRevision: 6,
      needsJournalImport: true,
      data: primary.data,
    });
  });

  it('keeps a valid older checkpoint when a newer journal head checksum mismatches', async () => {
    const safe = await checkpoint({ persistenceRevision: 3, runRevision: 3, note: 'safe checkpoint' });
    const corruptHead = await record({
      persistenceRevision: 5,
      runRevision: 5,
      note: 'do not trust',
      checksum: '0'.repeat(64),
    });

    const decision = await resolveSaveRecovery(fixture({
      primaryRaw: '{bad',
      head: corruptHead,
      checkpoints: [safe],
    }));

    expect(decision).toMatchObject({
      kind: 'recovery_required',
      cause: 'corrupt_primary',
      candidates: [expect.objectContaining({
        source: 'checkpoint',
        persistenceRevision: 3,
      })],
    });
    expect(decision.kind === 'recovery_required'
      ? decision.candidates.some(candidate => candidate.data === corruptHead.data)
      : false).toBe(false);
  });

  it('rejects an invalid-schema head independently of a valid checkpoint', async () => {
    const safe = await checkpoint({ persistenceRevision: 3, runRevision: 3 });
    const invalid = await record({ data: '{"version":4,"keys":"wrong"}' });

    const decision = await resolveSaveRecovery(fixture({
      primaryRaw: '{bad',
      head: invalid,
      checkpoints: [safe],
    }));

    expect(decision).toMatchObject({
      kind: 'recovery_required',
      candidates: [expect.objectContaining({ persistenceRevision: 3 })],
    });
  });

  it('rejects a too-large journal candidate without suppressing a safe checkpoint', async () => {
    const safe = await checkpoint({ persistenceRevision: 3, runRevision: 3 });
    const oversized = await record({
      persistenceRevision: 9,
      runRevision: 9,
      data: '"' + 'x'.repeat(5 * 1024 * 1024) + '"',
    });

    const decision = await resolveSaveRecovery(fixture({
      primaryRaw: '{bad',
      head: oversized,
      checkpoints: [safe],
    }));

    expect(decision).toMatchObject({
      kind: 'recovery_required',
      candidates: [expect.objectContaining({ persistenceRevision: 3 })],
    });
  });

  it('preserves future-version evidence as unsupported instead of choosing current data', async () => {
    const future = await record({
      persistenceRevision: 8,
      runRevision: 8,
      version: 99,
      note: 'future',
    });
    const current = await record({ persistenceRevision: 4, runRevision: 4, note: 'current' });

    const decision = await resolveSaveRecovery(fixture({
      primaryRaw: current.data,
      head: future,
    }));

    expect(decision).toEqual({ kind: 'unsupported', rawCandidates: [future.data] });
  });

  it('requires confirmation instead of combining conflicting run IDs', async () => {
    const primary = await record({ runId: RUN_A, persistenceRevision: 4, runRevision: 4 });
    const head = await record({ runId: RUN_B, persistenceRevision: 5, runRevision: 5 });

    const decision = await resolveSaveRecovery(fixture({
      primaryRaw: primary.data,
      mirrorMetadataRaw: await metadata({ data: primary.data, ...primary }),
      head,
    }));

    expect(decision).toMatchObject({
      kind: 'recovery_required',
      cause: 'conflicting_runs',
      candidates: expect.arrayContaining([
        expect.objectContaining({ runId: RUN_A }),
        expect.objectContaining({ runId: RUN_B }),
      ]),
    });
  });

  it('requires confirmation when an unsequenced primary differs from a valid head', async () => {
    const primary = await record({ persistenceRevision: 4, runRevision: 4, note: 'unsequenced' });
    const head = await record({ persistenceRevision: 5, runRevision: 5, note: 'head' });

    const decision = await resolveSaveRecovery(fixture({
      primaryRaw: primary.data,
      head,
    }));

    expect(decision).toMatchObject({
      kind: 'recovery_required',
      cause: 'unsequenced_primary',
      candidates: expect.arrayContaining([
        expect.objectContaining({ source: 'mirror', data: primary.data }),
        expect.objectContaining({ source: 'journal', data: head.data }),
      ]),
    });
  });

  it('orders equal-timestamp durable candidates by persistence revision', async () => {
    const older = await checkpoint({ persistenceRevision: 4, runRevision: 4, capturedAt: BASE_CAPTURED_AT, note: 'older' });
    const newer = await checkpoint({ persistenceRevision: 5, runRevision: 5, capturedAt: BASE_CAPTURED_AT, note: 'newer' });

    const decision = await resolveSaveRecovery(fixture({
      primaryRaw: '{bad',
      checkpoints: [older, newer],
    }));

    expect(decision).toMatchObject({
      kind: 'recovery_required',
      candidates: [
        expect.objectContaining({ persistenceRevision: 5 }),
        expect.objectContaining({ persistenceRevision: 4 }),
      ],
    });
  });

  it('returns an empty decision when no evidence exists', async () => {
    await expect(resolveSaveRecovery(fixture())).resolves.toEqual({ kind: 'empty' });
  });

  it('requires recovery when only a checkpoint remains and the primary is absent', async () => {
    const safe = await checkpoint({ persistenceRevision: 3, runRevision: 3 });

    const decision = await resolveSaveRecovery(fixture({ checkpoints: [safe] }));

    expect(decision).toMatchObject({
      kind: 'recovery_required',
      primaryRaw: null,
      candidates: [expect.objectContaining({ source: 'checkpoint' })],
    });
  });
});
