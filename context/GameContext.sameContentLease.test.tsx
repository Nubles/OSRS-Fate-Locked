// @vitest-environment jsdom
// After this tab has rolled in this session, losing and regaining the save
// lease with nothing newer saved must not be reported as "newer progress saved
// in another tab". The journal copy has been through the save validator, which
// rebuilds history entries in its own key order, so it is compared with this
// tab's baseline in the same validated form, not as raw text. A real newer save
// is still held for the player.
// Same harness as context/GameContext.regainedLease.test.tsx.

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
import { writerLeaseKey, WRITER_LEASE_TTL_MS } from '../utils/profileWriterLease';
import { openRecoveryDatabase } from '../utils/recoveryDatabase';
import type { RecoveryHead, RecoveryRepository } from '../utils/recoveryTypes';
import { checksumSave } from '../utils/saveIntegrity';
import { parseAndMigrateSave } from '../utils/saveSchema';
import { resolveSaveRecovery, type SaveRecoveryDecision } from '../utils/saveRecovery';
import { profileMirrorMetadataKey } from '../utils/storageRecovery';
import { DropSource } from '../types';
import { GameProvider, createFreshState, initialState, useGame } from './GameContext';

type Game = ReturnType<typeof useGame>;
const GameCapture = ({ onGame }: { onGame: (game: Game) => void }) => { onGame(useGame()); return null; };

let values: Map<string, string>;
let repository: RecoveryRepository;
let toasts: string[];
const onToast = (event: Event) => { toasts.push((event as CustomEvent<{ message: string }>).detail.message); };

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

const keyFor = (profileId: string): string => `FATE_PROFILE_${profileId}`;
const seedProfile = async (profileId: string): Promise<void> => {
  const state = { ...structuredClone(initialState), userNotes: { goal: 'start' } };
  const data = serializeCurrent(state);
  const record: RecoveryHead = {
    profileId, persistenceRevision: 1, runId: state.runId, runRevision: state.runRevision,
    capturedAt: 100, checksum: await checksumSave(data), data,
  };
  await repository.putHead(record, () => ({ ok: true }));
  values.set(keyFor(profileId), data);
  values.set(profileMirrorMetadataKey(keyFor(profileId)), JSON.stringify({
    version: 1, persistenceRevision: 1, capturedAt: 100, checksum: record.checksum,
  }));
};
const startupDecision = async (profileId: string): Promise<SaveRecoveryDecision> => resolveSaveRecovery({
  profileId,
  pendingRaw: null,
  primaryRaw: values.get(keyFor(profileId)) ?? null,
  mirrorMetadataRaw: values.get(profileMirrorMetadataKey(keyFor(profileId))) ?? null,
  head: await repository.getHead(profileId),
  checkpoints: await repository.listCheckpoints(profileId),
  defaults: initialState,
});
const openTab = async (profileId: string) => {
  const bootstrap = saveBootstrapResultFromDecision(await startupDecision(profileId)) as SaveBootstrapResult;
  let current: Game | undefined;
  render(
    <GameProvider storageKey={keyFor(profileId)} bootstrap={bootstrap} leaseOptions={{ ownerId: 'this-tab' }}>
      <GameCapture onGame={game => { current = game; }} />
    </GameProvider>,
  );
  return { game: () => current! };
};
/** Another tab takes the profile (the player pressed "Use this tab" there), then closes without saving anything. */
const otherTabTakesTheLease = (profileId: string): void => {
  const leaseKey = writerLeaseKey(keyFor(profileId));
  values.set(leaseKey, JSON.stringify({ version: 1, ownerId: 'other-tab', expiresAt: Date.now() + WRITER_LEASE_TTL_MS }));
  act(() => { window.dispatchEvent(new StorageEvent('storage', { key: leaseKey })); });
};
const otherTabCloses = (profileId: string): void => {
  const leaseKey = writerLeaseKey(keyFor(profileId));
  values.delete(leaseKey);
  act(() => { window.dispatchEvent(new StorageEvent('storage', { key: leaseKey })); });
};

const playOneRoll = async (profileId: string, game: () => Game): Promise<string> => {
  await waitFor(() => expect(game().saveOwnershipStatus).toBe('owner'));
  // One ordinary Key roll (a Slayer task): the reducer appends a history entry.
  act(() => game().rollForKey(DropSource.SLAYER_BEGINNER, 10, 1));
  expect(game().history).toHaveLength(1);
  await waitFor(async () => {
    const head = await repository.getHead(profileId);
    expect(JSON.parse(head!.data).history).toHaveLength(1);
  });
  await waitFor(() => expect(game().saveStatus).toBe('saved'));
  await waitFor(() => expect(game().hasPendingChanges).toBe(false));
  return (await repository.getHead(profileId))!.data;
};

describe('a regained lease with nothing newer saved, after a Key roll', () => {
  it('a rolled save keeps its meaning under validate + re-serialise, though not its key order', async () => {
    const profileId = 'false-newer-text';
    await seedProfile(profileId);
    const { game } = await openTab(profileId);
    const saved = await playOneRoll(profileId, game);
    const parsed = parseAndMigrateSave(saved, createFreshState());
    expect(parsed.ok).toBe(true);
    const again = parsed.ok ? serializeCurrent(parsed.state) : '';
    expect(JSON.parse(again)).toEqual(JSON.parse(saved));
  });

  it('with changes waiting: saves them (as when no roll was made) instead of reporting newer progress', async () => {
    const profileId = 'false-newer-conflict';
    await seedProfile(profileId);
    const { game } = await openTab(profileId);
    const savedByThisTab = await playOneRoll(profileId, game);
    const headBefore = await repository.getHead(profileId);

    otherTabTakesTheLease(profileId);
    await waitFor(() => expect(game().saveOwnershipStatus).toBe('blocked'));
    act(() => game().saveNote('goal', 'made while waiting'));
    // The other tab saved nothing: the journal still holds exactly what THIS tab saved.
    const headNow = await repository.getHead(profileId);
    expect(headNow!.persistenceRevision).toBe(headBefore!.persistenceRevision);
    expect(headNow!.data).toBe(savedByThisTab);
    otherTabCloses(profileId);

    // Wait for the lease to come back and the check against the journal to settle.
    await waitFor(() => expect(
      game().saveOwnershipStatus === 'owner' || game().saveOwnershipBlockReason === 'newer_save',
    ).toBe(true), { timeout: 5000 });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 400)); });
    expect(game().saveOwnershipBlockReason).toBeNull();
    expect(game().saveOwnershipStatus).toBe('owner');
    await waitFor(async () => expect(JSON.parse((await repository.getHead(profileId))!.data).userNotes.goal).toBe('made while waiting'));
  });

  it('with nothing waiting: carries on quietly instead of "Loaded newer progress saved in another tab"', async () => {
    const profileId = 'false-newer-toast';
    await seedProfile(profileId);
    const { game } = await openTab(profileId);
    await playOneRoll(profileId, game);
    const replacementsBefore = game().stateReplacements;

    otherTabTakesTheLease(profileId);
    await waitFor(() => expect(game().saveOwnershipStatus).toBe('blocked'));
    otherTabCloses(profileId);
    await waitFor(() => expect(game().saveOwnershipStatus).toBe('owner'));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 400)); });
    expect(toasts).not.toContain('Loaded newer progress saved in another tab');
    expect(game().stateReplacements).toBe(replacementsBefore);
  });

  it('still holds the tab when another tab really saved newer progress after a roll', async () => {
    const profileId = 'real-newer-after-roll';
    await seedProfile(profileId);
    const { game } = await openTab(profileId);
    const savedByThisTab = await playOneRoll(profileId, game);
    const headBefore = (await repository.getHead(profileId))!;

    otherTabTakesTheLease(profileId);
    await waitFor(() => expect(game().saveOwnershipStatus).toBe('blocked'));
    act(() => game().saveNote('goal', 'made while waiting'));
    // The other tab saves different progress, then closes.
    const theirs = { ...JSON.parse(savedByThisTab), userNotes: { goal: 'saved by the other tab' } };
    const data = serializeCurrent(theirs);
    await repository.putHead({
      ...headBefore,
      persistenceRevision: headBefore.persistenceRevision + 1,
      capturedAt: headBefore.capturedAt + 1,
      checksum: await checksumSave(data),
      data,
    }, () => ({ ok: true }));
    otherTabCloses(profileId);

    await waitFor(() => expect(game().saveOwnershipBlockReason).toBe('newer_save'), { timeout: 5000 });
    expect(JSON.parse((await repository.getHead(profileId))!.data).userNotes.goal).toBe('saved by the other tab');
  });
});
