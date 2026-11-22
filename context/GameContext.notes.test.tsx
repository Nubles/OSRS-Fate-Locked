// @vitest-environment jsdom
// A run note is capped at MAX_NOTE_CHARS by the reducer, so a long paste never
// stops saving, the export re-imports, and the next load is ready. A save that
// already holds a longer note (written before the cap) loads with the note cut
// to the limit instead of needing recovery.

import 'fake-indexeddb/auto';
import React from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  saveBootstrapResultFromDecision,
  type SaveBootstrapResult,
} from '../components/SaveBootstrap';
import { serializeCurrent } from '../utils/gamePersistence';
import { resetPendingSavesForTest } from '../utils/pendingSaves';
import { writerLeaseKey } from '../utils/profileWriterLease';
import { openRecoveryDatabase } from '../utils/recoveryDatabase';
import type { RecoveryHead, RecoveryRepository } from '../utils/recoveryTypes';
import { checksumSave } from '../utils/saveIntegrity';
import { resolveSaveRecovery, type SaveRecoveryDecision } from '../utils/saveRecovery';
import { profileMirrorMetadataKey } from '../utils/storageRecovery';
import { profileLifecycleMarkKey } from '../utils/lifecycleMark';
import { GameProvider, initialState, useGame } from './GameContext';
import { deobfuscateFateSave, encodeFateSaveExport } from '../utils/encryption';
import { MAX_NOTE_CHARS, validateAndMigrateSave } from '../utils/saveSchema';

type Game = ReturnType<typeof useGame>;
const GameCapture = ({ onGame }: { onGame: (game: Game) => void }) => {
  onGame(useGame());
  return null;
};

let values: Map<string, string>;
let repository: RecoveryRepository;
let toasts: string[];
const onToast = (event: Event) => {
  toasts.push((event as CustomEvent<{ message: string }>).detail.message);
};

beforeEach(async () => {
  resetPendingSavesForTest();
  values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
    clear: () => { values.clear(); },
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  });
  repository = await openRecoveryDatabase();
  toasts = [];
  window.addEventListener('fate:toast', onToast);
});

afterEach(() => {
  window.removeEventListener('fate:toast', onToast);
  cleanup();
  repository.close();
  resetPendingSavesForTest();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const run = (note: string) => ({ ...structuredClone(initialState), userNotes: { goal: note } });

const recordFor = async (profileId: string, note: string, persistenceRevision: number): Promise<RecoveryHead> => {
  const state = run(note);
  const data = serializeCurrent(state);
  return {
    profileId,
    persistenceRevision,
    runId: state.runId,
    runRevision: state.runRevision,
    capturedAt: persistenceRevision * 100,
    checksum: await checksumSave(data),
    data,
  };
};

const keyFor = (profileId: string): string => `FATE_PROFILE_${profileId}`;
const writeJournal = async (record: RecoveryHead): Promise<void> => {
  await repository.putHead(record, () => ({ ok: true }));
};
const writeBrowserCopy = (record: RecoveryHead): void => {
  const storageKey = keyFor(record.profileId);
  values.set(storageKey, record.data);
  values.set(profileMirrorMetadataKey(storageKey), JSON.stringify({
    version: 1,
    persistenceRevision: record.persistenceRevision,
    capturedAt: record.capturedAt,
    checksum: record.checksum,
  }));
};

const startupDecision = async (profileId: string): Promise<SaveRecoveryDecision> => {
  const storageKey = keyFor(profileId);
  return resolveSaveRecovery({
    profileId,
    pendingRaw: null,
    primaryRaw: values.get(storageKey) ?? null,
    mirrorMetadataRaw: values.get(profileMirrorMetadataKey(storageKey)) ?? null,
    lifecycleMarkRaw: values.get(profileLifecycleMarkKey(storageKey)) ?? null,
    head: await repository.getHead(profileId),
    checkpoints: await repository.listCheckpoints(profileId),
    defaults: initialState,
  });
};

const openTab = async (profileId: string) => {
  const bootstrap = saveBootstrapResultFromDecision(await startupDecision(profileId)) as SaveBootstrapResult;
  let current: Game | undefined;
  render(
    <GameProvider storageKey={keyFor(profileId)} bootstrap={bootstrap} leaseOptions={{ ownerId: 'this-page' }}>
      <GameCapture onGame={game => { current = game; }} />
    </GameProvider>,
  );
  return { bootstrap, game: () => current! };
};


const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('long run notes', () => {
  it('a note over the limit is cut to MAX_NOTE_CHARS, keeps saving, exports, re-imports and loads', async () => {
    const profileId = 'note-profile';
    const loaded = await recordFor(profileId, 'saved before the long note', 1);
    await writeJournal(loaded);
    writeBrowserCopy(loaded);
    const { game } = await openTab(profileId);
    await waitFor(() => expect(game().saveOwnershipStatus).toBe('owner'));

    act(() => game().saveNote('Attack', 'x'.repeat(MAX_NOTE_CHARS + 1)));
    expect(game().userNotes.Attack).toHaveLength(MAX_NOTE_CHARS);
    await sleep(1500); // past the 500 ms save debounce
    expect(game().saveStatus).not.toBe('failed');
    expect(game().saveDurability.primary).not.toBe('failed');

    act(() => game().saveNote('goal', 'progress made AFTER the long note'));
    await sleep(1500);
    const headAfter = await repository.getHead(profileId);
    expect(headAfter && JSON.parse(headAfter.data).userNotes.goal).toBe('progress made AFTER the long note');

    const encoded = encodeFateSaveExport(JSON.parse(game().getExportData()));
    expect(encoded.ok).toBe(true);
    const decoded = deobfuscateFateSave((encoded as { ok: true; value: string }).value);
    expect(decoded.ok).toBe(true);
    const imported = validateAndMigrateSave((decoded as { ok: true; value: unknown }).value, initialState);
    expect(imported.ok).toBe(true);

    act(() => { window.dispatchEvent(new Event('pagehide')); });
    cleanup();
    const decision = await startupDecision(profileId);
    expect(decision.kind).toBe('ready');
    if (decision.kind === 'ready') {
      expect(decision.state.userNotes.goal).toBe('progress made AFTER the long note');
      expect(decision.state.userNotes.Attack).toHaveLength(MAX_NOTE_CHARS);
    }
  }, 30_000);

  it('an old save that already holds a note over the limit loads, keeps the text up to the limit, and saves again', async () => {
    const profileId = 'old-long-note';
    const longNote = `${'a'.repeat(MAX_NOTE_CHARS)}tail beyond the limit`;
    // Before the cap, pagehide could mirror such a run into the browser save
    // (newer than the journal) with a lifecycle mark.
    const journal = await recordFor(profileId, 'journal copy', 1);
    await writeJournal(journal);
    const browser = await recordFor(profileId, longNote, 2);
    writeBrowserCopy(browser);

    const decision = await startupDecision(profileId);
    expect(decision.kind).toBe('ready');
    if (decision.kind !== 'ready') return;
    expect(decision.state.userNotes.goal).toBe('a'.repeat(MAX_NOTE_CHARS));

    const { game } = await openTab(profileId);
    await waitFor(() => expect(game().saveOwnershipStatus).toBe('owner'));
    expect(game().userNotes.goal).toBe('a'.repeat(MAX_NOTE_CHARS));
    act(() => game().saveNote('Attack', 'later progress'));
    await sleep(1500);
    expect(game().saveDurability.primary).not.toBe('failed');
    const head = await repository.getHead(profileId);
    expect(head && JSON.parse(head.data).userNotes.Attack).toBe('later progress');
    const reimported = validateAndMigrateSave(JSON.parse(game().getExportData()), initialState);
    expect(reimported.ok).toBe(true);
  }, 30_000);
});
