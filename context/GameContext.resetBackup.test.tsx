// @vitest-environment jsdom

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
import { openRecoveryDatabase } from '../utils/recoveryDatabase';
import type { RecoveryHead, RecoveryRepository } from '../utils/recoveryTypes';
import { checksumSave } from '../utils/saveIntegrity';
import { resolveSaveRecovery, type SaveRecoveryDecision } from '../utils/saveRecovery';
import { profileMirrorMetadataKey } from '../utils/storageRecovery';
import { confirmReset, RESET_CONFIRM_MESSAGE, RESET_NO_BACKUP_MESSAGE } from '../utils/backups';
import { GameProvider, initialState, useGame } from '../context/GameContext';

/**
 * Reset all progress promises a backup under Sync Code -> Backups. Where none
 * could be kept (no IndexedDB, and localStorage without room for a second copy
 * of the run) it used to wipe the run anyway with no word. It now leaves the
 * run alone and resolves false, and the menus ask a second time
 * (confirmReset): export first, or reset anyway.
 */
type Game = ReturnType<typeof useGame>;

const GameCapture = ({ onGame }: { onGame: (game: Game) => void }) => {
  onGame(useGame());
  return null;
};

let values: Map<string, string>;
let quota: number | null = null;
let repository: RecoveryRepository;

beforeEach(async () => {
  resetPendingSavesForTest();
  values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { const total = [...values.entries()].reduce((n, [k, v]) => n + (k === key ? 0 : k.length + v.length), 0) + key.length + value.length; if (quota !== null && total > quota) throw new DOMException('full', 'QuotaExceededError'); values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
    clear: () => { values.clear(); },
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  });
  repository = await openRecoveryDatabase();
});

afterEach(() => {
  cleanup();
  repository.close();
  resetPendingSavesForTest();
  quota = null;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const big = (c: string) => c.repeat(19_000);
const run = (note: string) => ({ ...structuredClone(initialState), keys: 5, userNotes: { goal: note, a: big('a'), b: big('b'), c: big('c') } });

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




/** A run too big for localStorage to hold a second copy, in a browser without IndexedDB. */
const openFullTab = async (profileId: string) => {
  const loaded = await recordFor(profileId, 'long run worth keeping', 1);
  await writeJournal(loaded);
  writeBrowserCopy(loaded);
  vi.spyOn(indexedDB, 'open').mockImplementation(() => { throw new DOMException('blocked', 'InvalidStateError'); });
  const used = () => [...values.entries()].reduce((n, [k, v]) => n + k.length + v.length, 0);
  quota = used() + 30_000; // room for the save to keep updating, not for a second copy of it
  const tab = await openTab(profileId);
  await waitFor(() => expect(tab.game().saveOwnershipStatus).toBe('owner'));
  await act(async () => { await new Promise(r => setTimeout(r, 900)); });
  return tab;
};

describe('Reset all progress when no backup can be kept', () => {
  it('leaves the run alone until the player says to reset anyway', async () => {
    const profileId = 'reset-full';
    const { game } = await openFullTab(profileId);
    expect(game().keys).toBe(5);

    let result: boolean | undefined;
    await act(async () => { result = await game().resetGame(); });
    await act(async () => { await new Promise(r => setTimeout(r, 900)); });
    expect(result).toBe(false);
    expect(game().keys).toBe(5);
    expect(game().userNotes?.goal).toBe('long run worth keeping');
    expect(browserNote(profileId)).toBe('long run worth keeping');

    await act(async () => { result = await game().resetGame(true); });
    await act(async () => { await new Promise(r => setTimeout(r, 900)); });
    expect(result).toBe(true);
    expect(game().keys).toBe(initialState.keys);
    expect(game().userNotes?.goal).toBeUndefined();
    expect(browserNote(profileId)).toBeUndefined();
  });

  it('asks a second time from the menu, and Cancel keeps the run', async () => {
    const profileId = 'reset-full-menu';
    const { game } = await openFullTab(profileId);
    const asked: string[] = [];
    vi.spyOn(window, 'confirm').mockImplementation(message => {
      asked.push(String(message));
      return message === RESET_CONFIRM_MESSAGE;
    });
    await act(async () => { await confirmReset(game().resetGame); });
    expect(asked).toEqual([RESET_CONFIRM_MESSAGE, RESET_NO_BACKUP_MESSAGE]);
    expect(game().userNotes?.goal).toBe('long run worth keeping');

    vi.spyOn(window, 'confirm').mockImplementation(() => true);
    await act(async () => { await confirmReset(game().resetGame); });
    await act(async () => { await new Promise(r => setTimeout(r, 900)); });
    expect(game().userNotes?.goal).toBeUndefined();
  });

  it('resets after one confirm when the backup is kept', async () => {
    const profileId = 'reset-roomy';
    const loaded = await recordFor(profileId, 'run with room', 1);
    await writeJournal(loaded);
    writeBrowserCopy(loaded);
    const { game } = await openTab(profileId);
    await waitFor(() => expect(game().saveOwnershipStatus).toBe('owner'));
    const asked: string[] = [];
    vi.spyOn(window, 'confirm').mockImplementation(message => { asked.push(String(message)); return true; });
    await act(async () => { await confirmReset(game().resetGame); });
    await act(async () => { await new Promise(r => setTimeout(r, 900)); });
    expect(asked).toEqual([RESET_CONFIRM_MESSAGE]);
    expect(game().userNotes?.goal).toBeUndefined();
    const backups = await game().listBackups();
    expect(backups.some(backup => backup.summary.startsWith('5 keys'))).toBe(true);
  });
});
