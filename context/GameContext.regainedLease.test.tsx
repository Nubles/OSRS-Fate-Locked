// @vitest-environment jsdom

import 'fake-indexeddb/auto';
import React from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  saveBootstrapResultFromDecision,
  type SaveBootstrapResult,
} from '../components/SaveBootstrap';
import { serializeCurrent, type ImportResult } from '../utils/gamePersistence';
import { resetPendingSavesForTest } from '../utils/pendingSaves';
import { writerLeaseKey, WRITER_LEASE_TTL_MS } from '../utils/profileWriterLease';
import { openRecoveryDatabase } from '../utils/recoveryDatabase';
import type { RecoveryHead, RecoveryRepository } from '../utils/recoveryTypes';
import { checksumSave } from '../utils/saveIntegrity';
import { resolveSaveRecovery, type SaveRecoveryDecision } from '../utils/saveRecovery';
import { profileMirrorMetadataKey } from '../utils/storageRecovery';
import * as newestDurableSave from '../utils/newestDurableSave';
import { GameProvider, initialState, useGame } from './GameContext';

/**
 * A tab that could not save for a while (another tab held the profile, or a
 * lease was left behind by a page that never closed cleanly) gets to save
 * again. What it may load or write then is decided against the recovery
 * journal. It used to read the browser save alone and take any difference
 * for newer progress, so an older browser save (a crash loses the browser's
 * last writes, a full storage stops them) silently replaced the newest run.
 */
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

const recordFor = async (
  profileId: string,
  note: string,
  persistenceRevision: number,
): Promise<RecoveryHead> => {
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

/** The browser's copy of a journal record: the save and its sidecar. */
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

const holdLeaseElsewhere = (profileId: string): void => {
  values.set(writerLeaseKey(keyFor(profileId)), JSON.stringify({
    version: 1,
    ownerId: 'other-tab',
    expiresAt: Date.now() + WRITER_LEASE_TTL_MS,
  }));
};

const endLeaseElsewhere = (profileId: string): void => {
  const leaseKey = writerLeaseKey(keyFor(profileId));
  values.delete(leaseKey);
  act(() => { window.dispatchEvent(new StorageEvent('storage', { key: leaseKey })); });
};

/** What a page load decides from the saved copies as they stand. */
const startupDecision = async (profileId: string): Promise<SaveRecoveryDecision> => {
  const storageKey = keyFor(profileId);
  return resolveSaveRecovery({
    profileId,
    pendingRaw: null,
    primaryRaw: values.get(storageKey) ?? null,
    mirrorMetadataRaw: values.get(profileMirrorMetadataKey(storageKey)) ?? null,
    head: await repository.getHead(profileId),
    checkpoints: await repository.listCheckpoints(profileId),
    defaults: initialState,
  });
};

const openTab = async (profileId: string) => {
  const bootstrap = saveBootstrapResultFromDecision(await startupDecision(profileId)) as SaveBootstrapResult;
  let current: Game | undefined;
  render(
    <GameProvider
      storageKey={keyFor(profileId)}
      bootstrap={bootstrap}
      leaseOptions={{ ownerId: 'this-tab' }}
    >
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

describe('a tab that gets to save again checks the recovery journal first', () => {
  it('keeps the newest progress when the browser save is an older copy', async () => {
    const profileId = 'regain-older-browser-copy';
    await writeJournal(await recordFor(profileId, 'newest', 8));
    writeBrowserCopy(await recordFor(profileId, 'older copy', 5));
    holdLeaseElsewhere(profileId);

    const { bootstrap, game } = await openTab(profileId);
    expect(bootstrap).toMatchObject({ source: 'journal', needsMirrorRepair: true });
    await waitFor(() => expect(game().saveOwnershipStatus).toBe('blocked'));
    expect(game().userNotes.goal).toBe('newest');

    endLeaseElsewhere(profileId);
    await waitFor(() => expect(game().saveOwnershipStatus).toBe('owner'));

    // The older copy was not taken for newer progress...
    expect(game().userNotes.goal).toBe('newest');
    expect(toasts).not.toContain('Loaded newer progress saved in another tab');
    // ...and it is replaced, so the next page load has nothing to puzzle over.
    await waitFor(() => expect(browserNote(profileId)).toBe('newest'));
    await waitFor(() => expect(game().saveStatus).toBe('saved'));
    expect(await journalNote(profileId)).toBe('newest');
    expect(await startupDecision(profileId)).toMatchObject({
      kind: 'ready',
      source: 'mirror',
      reason: 'normal',
      needsJournalImport: false,
    });
  });

  it('loads progress another tab saved meanwhile', async () => {
    const profileId = 'regain-other-tab-saved';
    const loaded = await recordFor(profileId, 'loaded by both tabs', 1);
    await writeJournal(loaded);
    writeBrowserCopy(loaded);
    holdLeaseElsewhere(profileId);
    const { game } = await openTab(profileId);
    await waitFor(() => expect(game().saveOwnershipStatus).toBe('blocked'));

    const theirs = await recordFor(profileId, 'other tab progress', 5);
    await writeJournal(theirs);
    writeBrowserCopy(theirs);
    endLeaseElsewhere(profileId);

    await waitFor(() => expect(game().userNotes.goal).toBe('other tab progress'));
    await waitFor(() => expect(game().saveOwnershipStatus).toBe('owner'));
    expect(toasts).toContain('Loaded newer progress saved in another tab');
    expect(game().hasPendingChanges).toBe(false);

    // And carries on from there.
    act(() => game().saveNote('goal', 'continued in this tab'));
    await waitFor(async () => expect(await journalNote(profileId)).toBe('continued in this tab'));
    await waitFor(() => expect(browserNote(profileId)).toBe('continued in this tab'));
  });

  it('loads the other tab\'s progress from the journal when its browser save never landed', async () => {
    const profileId = 'regain-journal-only';
    const loaded = await recordFor(profileId, 'loaded by both tabs', 1);
    await writeJournal(loaded);
    writeBrowserCopy(loaded);
    holdLeaseElsewhere(profileId);
    const { game } = await openTab(profileId);
    await waitFor(() => expect(game().saveOwnershipStatus).toBe('blocked'));

    // The other tab's storage was full: only the journal has what it saved.
    await writeJournal(await recordFor(profileId, 'other tab progress', 5));
    endLeaseElsewhere(profileId);

    await waitFor(() => expect(game().userNotes.goal).toBe('other tab progress'));
    await waitFor(() => expect(game().saveOwnershipStatus).toBe('owner'));
    await waitFor(() => expect(browserNote(profileId)).toBe('other tab progress'));
  });

  it('saves this tab\'s waiting changes when nothing newer was saved', async () => {
    const profileId = 'regain-own-changes';
    await writeJournal(await recordFor(profileId, 'newest', 8));
    writeBrowserCopy(await recordFor(profileId, 'older copy', 5));
    holdLeaseElsewhere(profileId);
    const { game } = await openTab(profileId);
    await waitFor(() => expect(game().saveOwnershipStatus).toBe('blocked'));

    act(() => game().saveNote('goal', 'made while waiting'));
    endLeaseElsewhere(profileId);

    await waitFor(() => expect(game().saveOwnershipStatus).toBe('owner'));
    expect(game().saveOwnershipBlockReason).toBeNull();
    await waitFor(async () => expect(await journalNote(profileId)).toBe('made while waiting'));
    await waitFor(() => expect(browserNote(profileId)).toBe('made while waiting'));
    expect(game().userNotes.goal).toBe('made while waiting');
  });

  it('asks the player when this tab has changes and newer progress was saved', async () => {
    const profileId = 'regain-conflict';
    const loaded = await recordFor(profileId, 'loaded by both tabs', 1);
    await writeJournal(loaded);
    writeBrowserCopy(loaded);
    holdLeaseElsewhere(profileId);
    const { game } = await openTab(profileId);
    await waitFor(() => expect(game().saveOwnershipStatus).toBe('blocked'));
    act(() => game().saveNote('goal', 'this tab'));

    // Newer in the journal; the browser save is still the old one.
    await writeJournal(await recordFor(profileId, 'other tab progress', 5));
    endLeaseElsewhere(profileId);

    await waitFor(() => expect(game().saveOwnershipBlockReason).toBe('newer_save'));
    expect(game().saveOwnershipStatus).toBe('blocked');
    expect(game().userNotes.goal).toBe('this tab');
    // Nothing is written over either copy until the player chooses.
    expect(await journalNote(profileId)).toBe('other tab progress');
    expect(browserNote(profileId)).toBe('loaded by both tabs');

    // "Load the newer save" means the journal's, not the older browser copy.
    let result: ImportResult | undefined;
    await act(async () => { result = await game().reloadLatestSave(); });
    expect(result).toEqual({ ok: true, warnings: [] });
    expect(game().userNotes.goal).toBe('other tab progress');
    await waitFor(() => expect(game().saveOwnershipStatus).toBe('owner'));
    await waitFor(() => expect(browserNote(profileId)).toBe('other tab progress'));
  });

  it('keeps this tab\'s progress when the player chooses it over the newer save', async () => {
    const profileId = 'regain-conflict-keep';
    const loaded = await recordFor(profileId, 'loaded by both tabs', 1);
    await writeJournal(loaded);
    writeBrowserCopy(loaded);
    holdLeaseElsewhere(profileId);
    const { game } = await openTab(profileId);
    await waitFor(() => expect(game().saveOwnershipStatus).toBe('blocked'));
    act(() => game().saveNote('goal', 'this tab'));
    const theirs = await recordFor(profileId, 'other tab progress', 5);
    await writeJournal(theirs);
    writeBrowserCopy(theirs);
    endLeaseElsewhere(profileId);
    await waitFor(() => expect(game().saveOwnershipBlockReason).toBe('newer_save'));

    let kept = false;
    await act(async () => { kept = await game().takeOverSaveOwnership(); });

    expect(kept).toBe(true);
    expect(game().saveOwnershipStatus).toBe('owner');
    expect(await journalNote(profileId)).toBe('this tab');
    expect(browserNote(profileId)).toBe('this tab');
  });

  it('writes nothing over saved copies that disagree, and sends the player to choose', async () => {
    const profileId = 'regain-undecided';
    const loaded = await recordFor(profileId, 'loaded by both tabs', 1);
    await writeJournal(loaded);
    writeBrowserCopy(loaded);
    holdLeaseElsewhere(profileId);
    const { game } = await openTab(profileId);
    await waitFor(() => expect(game().saveOwnershipStatus).toBe('blocked'));

    // Something rewrote the browser save without the journal or a sidecar.
    const foreign = serializeCurrent(run('written by something else'));
    values.set(keyFor(profileId), foreign);
    values.delete(profileMirrorMetadataKey(keyFor(profileId)));
    endLeaseElsewhere(profileId);

    await waitFor(() => expect(game().saveOwnershipBlockReason).toBe('newer_save'));
    expect(game().userNotes.goal).toBe('loaded by both tabs');
    expect(values.get(keyFor(profileId))).toBe(foreign);
    expect(await journalNote(profileId)).toBe('loaded by both tabs');

    let result: ImportResult | undefined;
    await act(async () => { result = await game().reloadLatestSave(); });
    expect(result).toMatchObject({ ok: false });
    expect(result?.ok === false && result.message).toContain('Reload the page to choose');
    expect(game().userNotes.goal).toBe('loaded by both tabs');
  });

  it('does not load a browser save it cannot check against the journal', async () => {
    const profileId = 'regain-journal-unreadable';
    await writeJournal(await recordFor(profileId, 'newest', 8));
    writeBrowserCopy(await recordFor(profileId, 'older copy', 5));
    holdLeaseElsewhere(profileId);
    const { game } = await openTab(profileId);
    await waitFor(() => expect(game().saveOwnershipStatus).toBe('blocked'));
    expect(game().userNotes.goal).toBe('newest');

    const reading = vi.spyOn(newestDurableSave, 'readNewestDurableSave')
      .mockRejectedValueOnce(new Error('The journal could not be read.'));
    endLeaseElsewhere(profileId);

    // The browser save differs, and nothing says which way: the player decides.
    await waitFor(() => expect(game().saveOwnershipBlockReason).toBe('newer_save'));
    expect(reading).toHaveBeenCalledTimes(1);
    expect(game().userNotes.goal).toBe('newest');
    expect(toasts).not.toContain('Loaded newer progress saved in another tab');
    expect(await journalNote(profileId)).toBe('newest');
    expect(browserNote(profileId)).toBe('older copy');

    let kept = false;
    await act(async () => { kept = await game().takeOverSaveOwnership(); });
    expect(kept).toBe(true);
    expect(await journalNote(profileId)).toBe('newest');
    expect(browserNote(profileId)).toBe('newest');
  });

  it('carries on when the journal cannot be read and the browser save is this tab\'s own', async () => {
    const profileId = 'regain-journal-unreadable-same';
    const loaded = await recordFor(profileId, 'loaded', 3);
    await writeJournal(loaded);
    writeBrowserCopy(loaded);
    holdLeaseElsewhere(profileId);
    const { game } = await openTab(profileId);
    await waitFor(() => expect(game().saveOwnershipStatus).toBe('blocked'));

    vi.spyOn(newestDurableSave, 'readNewestDurableSave')
      .mockRejectedValueOnce(new Error('The journal could not be read.'));
    endLeaseElsewhere(profileId);

    await waitFor(() => expect(game().saveOwnershipStatus).toBe('owner'));
    expect(game().saveOwnershipBlockReason).toBeNull();
    act(() => game().saveNote('goal', 'continued'));
    await waitFor(async () => expect(await journalNote(profileId)).toBe('continued'));
    await waitFor(() => expect(browserNote(profileId)).toBe('continued'));
  });
});

describe('a page that loads from the journal brings the browser save back in step', () => {
  it('rewrites an older browser save as soon as this tab may save', async () => {
    const profileId = 'startup-repair';
    await writeJournal(await recordFor(profileId, 'newest', 8));
    writeBrowserCopy(await recordFor(profileId, 'older copy', 5));

    const { bootstrap, game } = await openTab(profileId);
    expect(bootstrap).toMatchObject({ source: 'journal', needsMirrorRepair: true });

    await waitFor(() => expect(browserNote(profileId)).toBe('newest'));
    await waitFor(() => expect(game().saveStatus).toBe('saved'));
    expect(game().userNotes.goal).toBe('newest');
    const head = await repository.getHead(profileId);
    const sidecar = JSON.parse(values.get(profileMirrorMetadataKey(keyFor(profileId)))!);
    expect(sidecar.persistenceRevision).toBe(head?.persistenceRevision);
    expect(sidecar.checksum).toBe(head?.checksum);
    expect(await startupDecision(profileId)).toMatchObject({ kind: 'ready', source: 'mirror', reason: 'normal' });
  });

  it('writes nothing extra when the copies already agree', async () => {
    const profileId = 'startup-in-step';
    const saved = await recordFor(profileId, 'saved', 4);
    await writeJournal(saved);
    writeBrowserCopy(saved);

    const { bootstrap, game } = await openTab(profileId);
    expect(bootstrap.needsMirrorRepair).toBe(false);
    await waitFor(() => expect(game().saveOwnershipStatus).toBe('owner'));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 150)); });

    expect((await repository.getHead(profileId))?.persistenceRevision).toBe(4);
  });
});
