import { describe, expect, it } from 'vitest';
import { initialState } from '../context/GameContext';
import type { GameState } from '../types';
import { serializeCurrent } from './gamePersistence';
import { createLifecycleMark, profileLifecycleMarkKey } from './lifecycleMark';
import type { RecoveryHead, RecoveryRepository } from './recoveryTypes';
import { createSaveCoordinator } from './saveCoordinator';
import { profileMirrorMetadataKey } from './storageRecovery';
import { checksumSave } from './saveIntegrity';
import { resolveSaveRecovery, type SaveRecoveryInput } from './saveRecovery';
import { parseAndMigrateSave, SAVE_APP_ID } from './saveSchema';

/**
 * SAVE-1 regression: other pages on nubles.github.io share this tracker's
 * localStorage. A rewrite of the browser save by another app must never be
 * accepted silently over the recovery journal.
 */
const RUN = '123e4567-e89b-42d3-a456-426614174000';
const CAPTURED_AT = 1_760_000_000_000;

const goodRun = (): GameState => {
  const good = structuredClone(initialState) as GameState;
  good.version = 5;
  good.runId = RUN;
  good.runRevision = 7;
  good.history = Array.from({ length: 40 }, (_, index) => ({
    id: `h${index}`,
    timestamp: Date.UTC(2026, 8, 1) + index,
    type: 'ROLL_FAIL',
    source: 'x',
    message: 'm',
  })) as GameState['history'];
  return good;
};

const journalled = async (data: string) => {
  const checksum = await checksumSave(data);
  return {
    head: {
      profileId: 'alpha',
      persistenceRevision: 7,
      runId: RUN,
      runRevision: 7,
      capturedAt: CAPTURED_AT,
      checksum,
      data,
    },
    sidecar: JSON.stringify({ version: 1, persistenceRevision: 7, capturedAt: CAPTURED_AT, checksum }),
  };
};

const input = (overrides: Partial<SaveRecoveryInput>): SaveRecoveryInput => ({
  profileId: 'alpha',
  pendingRaw: null,
  primaryRaw: null,
  mirrorMetadataRaw: null,
  head: null,
  checkpoints: [],
  defaults: { ...structuredClone(initialState), runId: RUN, runRevision: 0 },
  ...overrides,
});

describe('foreign write to the browser save', () => {
  it('does not load a 40-entry run rewritten to version 2 with empty history as ready', async () => {
    const good = goodRun();
    const goodData = JSON.stringify(good);
    const { head, sidecar } = await journalled(goodData);
    // Another app rewrites the primary: old version stamp, history wiped.
    const foreign = structuredClone(good) as GameState;
    foreign.version = 2;
    foreign.history = [];
    const foreignData = JSON.stringify(foreign);

    const decision = await resolveSaveRecovery(input({
      primaryRaw: foreignData,
      mirrorMetadataRaw: sidecar,
      head,
    }));

    expect(decision.kind).toBe('recovery_required');
    if (decision.kind !== 'recovery_required') return;
    expect(decision.cause).toBe('unconfirmed_primary');
    // The foreign copy stays available, but the journal head outranks it.
    expect(decision.primaryRaw).toBe(foreignData);
    expect(decision.candidates[0]).toMatchObject({ source: 'journal', persistenceRevision: 7 });
    expect(decision.candidates[0].state.history).toHaveLength(40);
    expect(decision.candidates.some(candidate => candidate.data === foreignData)).toBe(true);
  });

  it('still ignores a page-hide mark written for different bytes', async () => {
    const good = goodRun();
    const { head, sidecar } = await journalled(JSON.stringify(good));
    const ours = structuredClone(good) as GameState;
    ours.userNotes = { goal: 'written on page-hide' };
    const foreign = structuredClone(good) as GameState;
    foreign.history = [];

    const decision = await resolveSaveRecovery(input({
      primaryRaw: JSON.stringify(foreign),
      mirrorMetadataRaw: sidecar,
      lifecycleMarkRaw: createLifecycleMark(JSON.stringify(ours)),
      head,
    }));

    expect(decision).toMatchObject({ kind: 'recovery_required', cause: 'unconfirmed_primary' });
  });

  it('treats a save stamped by another app as foreign and keeps the journal', async () => {
    const good = goodRun();
    const { head, sidecar } = await journalled(serializeCurrent(good));
    const foreignData = JSON.stringify({ app: 'rs3-fate-locked', ...good, history: [] });

    const decision = await resolveSaveRecovery(input({
      primaryRaw: foreignData,
      mirrorMetadataRaw: sidecar,
      lifecycleMarkRaw: createLifecycleMark(foreignData),
      head,
    }));

    expect(decision).toMatchObject({
      kind: 'recovery_required',
      cause: 'foreign_primary',
      primaryRaw: foreignData,
      candidates: [expect.objectContaining({ source: 'journal', persistenceRevision: 7 })],
    });
  });
});

describe('page-hide write by this app', () => {
  it('still loads the newer page-hide save, with the mark the coordinator wrote', async () => {
    const storageKey = 'FATE_PROFILE_alpha';
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    };
    const journalledData = serializeCurrent(goodRun());
    const { head, sidecar } = await journalled(journalledData);
    values.set(storageKey, journalledData);
    values.set(profileMirrorMetadataKey(storageKey), sidecar);
    const repository = {
      getHead: async () => head as RecoveryHead,
      listCheckpoints: async () => [],
    } as unknown as RecoveryRepository;
    const coordinator = createSaveCoordinator({
      profileId: 'alpha',
      storageKey,
      storage,
      repository,
      authorizeWrite: () => ({ ok: true }),
      validate: data => parseAndMigrateSave(data, initialState),
      checksum: checksumSave,
      now: () => CAPTURED_AT + 1,
      initialPersistenceRevision: 7,
    });
    const newer = goodRun();
    newer.userNotes = { goal: 'left the page' };
    const newerData = serializeCurrent(newer);

    expect(coordinator.mirrorLifecycle(newerData)).toBe(true);
    expect(values.has(profileLifecycleMarkKey(storageKey))).toBe(true);

    const decision = await resolveSaveRecovery(input({
      primaryRaw: values.get(storageKey) ?? null,
      mirrorMetadataRaw: values.get(profileMirrorMetadataKey(storageKey)) ?? null,
      lifecycleMarkRaw: values.get(profileLifecycleMarkKey(storageKey)) ?? null,
      head,
    }));
    expect(decision).toMatchObject({
      kind: 'ready',
      source: 'mirror',
      reason: 'lifecycle_mirror',
      persistenceRevision: 8,
      data: newerData,
    });
    coordinator.dispose();
  });
});

describe('app stamp', () => {
  it('stamps every save this app writes', () => {
    const data = serializeCurrent(goodRun());
    expect(JSON.parse(data).app).toBe(SAVE_APP_ID);
    expect(SAVE_APP_ID).toBe('osrs-fate-locked');
    const parsed = parseAndMigrateSave(data, initialState);
    expect(parsed.ok).toBe(true);
    // The stamp is a property of the stored bytes, not of the run.
    expect(parsed.ok && 'app' in parsed.state).toBe(false);
  });

  it('keeps loading unstamped saves from before the stamp', () => {
    const legacy = JSON.stringify(goodRun());
    expect(JSON.parse(legacy).app).toBeUndefined();
    const parsed = parseAndMigrateSave(legacy, initialState);
    expect(parsed.ok).toBe(true);
    expect(parsed.ok && parsed.state.history).toHaveLength(40);
  });

  it('refuses a save stamped by a different app', () => {
    const parsed = parseAndMigrateSave(JSON.stringify({ ...goodRun(), app: 'rs3-fate-locked' }), initialState);
    expect(parsed).toMatchObject({ ok: false, code: 'foreign_app' });
  });
});
