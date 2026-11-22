// @vitest-environment jsdom
// A page that fired pagehide (released its save lease) and is shown again from
// the back-forward cache must check the journal before it writes again, as a
// regained lease does, so its next save never overwrites newer progress saved
// meanwhile by another page. With nothing newer saved it carries on quietly.

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

const browserNote = (profileId: string): string | undefined =>
  JSON.parse(values.get(keyFor(profileId)) ?? '{}').userNotes?.goal;
const journalNote = async (profileId: string): Promise<string | undefined> => {
  const head = await repository.getHead(profileId);
  return head === null ? undefined : JSON.parse(head.data).userNotes?.goal;
};

describe('page kept by the back-forward cache', () => {
  it('loads the newer progress another page saved after pagehide, and keeps it', async () => {
    const profileId = 'bfcache-stale';
    const loaded = await recordFor(profileId, 'old progress (this page)', 1);
    await writeJournal(loaded);
    writeBrowserCopy(loaded);

    const { game } = await openTab(profileId);
    await waitFor(() => expect(game().saveOwnershipStatus).toBe('owner'));
    await waitFor(() => expect(game().saveStatus).toBe('saved'));
    expect(game().userNotes.goal).toBe('old progress (this page)');

    // The player navigates this tab elsewhere. The browser fires pagehide and
    // keeps the page alive in the back-forward cache (it is NOT unmounted).
    act(() => { window.dispatchEvent(new Event('pagehide')); });
    // The page released its save lease, as designed.
    expect(values.has(writerLeaseKey(keyFor(profileId)))).toBe(false);

    // Meanwhile the tracker is loaded afresh (new tab, bookmark, link), the
    // player plays on, and that page saves newer progress and closes
    // (its lease is released; nothing holds the profile).
    const theirs = await recordFor(profileId, 'NEWER progress (other page)', 7);
    await writeJournal(theirs);
    writeBrowserCopy(theirs);
    values.delete(profileLifecycleMarkKey(keyFor(profileId)));
    expect(await startupDecision(profileId)).toMatchObject({ kind: 'ready' });
    expect((await startupDecision(profileId) as { state: { userNotes: Record<string, string> } }).state.userNotes.goal)
      .toBe('NEWER progress (other page)');

    // The player presses Back: the first page is shown again from the cache.
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    await waitFor(() => expect(game().saveOwnershipStatus).toBe('owner'));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 300)); });

    const shownAfterReturn = game().userNotes.goal;

    // The player does anything that changes the run (here: types a note).
    act(() => game().saveNote('other', 'typed after coming back'));
    await waitFor(async () => {
      const head = await repository.getHead(profileId);
      expect(JSON.parse(head!.data).userNotes.other).toBe('typed after coming back');
    });
    await waitFor(() => expect(game().saveStatus).toBe('saved'));

    // What a correct tracker must keep: the newer progress.
    expect(shownAfterReturn).toBe('NEWER progress (other page)');
    expect(await journalNote(profileId)).toBe('NEWER progress (other page)');
    expect(browserNote(profileId)).toBe('NEWER progress (other page)');
  });

  it('with nothing newer saved, comes back as owner without a toast and keeps saving', async () => {
    const profileId = 'bfcache-same';
    const loaded = await recordFor(profileId, 'only this page', 1);
    await writeJournal(loaded);
    writeBrowserCopy(loaded);
    const { game } = await openTab(profileId);
    await waitFor(() => expect(game().saveOwnershipStatus).toBe('owner'));
    await waitFor(() => expect(game().saveStatus).toBe('saved'));
    const replacementsBefore = game().stateReplacements;

    act(() => { window.dispatchEvent(new Event('pagehide')); });
    expect(values.has(writerLeaseKey(keyFor(profileId)))).toBe(false);
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    await waitFor(() => expect(game().saveOwnershipStatus).toBe('owner'));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 300)); });
    expect(game().saveOwnershipBlockReason).toBeNull();
    expect(toasts).toEqual([]);
    expect(game().stateReplacements).toBe(replacementsBefore);

    act(() => game().saveNote('other', 'typed after coming back'));
    await waitFor(async () => expect(JSON.parse((await repository.getHead(profileId))!.data).userNotes.other).toBe('typed after coming back'));
  });
});
