// @vitest-environment jsdom
/**
 * The owner's rule for detected events (28 September 2026): RuneLite and the
 * Roll Inbox are an optional helper. With detections waiting, a player still
 * logs by hand, rolls and spends Keys exactly as before, and nothing in the
 * run changes until they press Roll on a row.
 */
import React from 'react';
import 'fake-indexeddb/auto';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { GameProvider, createFreshState, useGame } from './GameContext';
import type { FateEventEnvelope } from '../services/fateEventProtocol';
import { getRollInboxStore } from '../services/rollInboxRuntime';
import { TableType } from '../types';
import { resetPendingSavesForTest } from '../utils/pendingSaves';
import { WRITER_LEASE_ARBITRATION_MS } from '../utils/profileWriterLease';

let current: ReturnType<typeof useGame>;
const Capture = () => { current = useGame(); return null; };
const settle = async () => {
  await act(async () => { await vi.advanceTimersByTimeAsync(WRITER_LEASE_ARBITRATION_MS + 1); });
  await act(async () => { await vi.advanceTimersByTimeAsync(550); });
};

beforeEach(() => {
  vi.useFakeTimers();
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => { values.set(k, v); },
    removeItem: (k: string) => values.delete(k),
  });
  resetPendingSavesForTest();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); resetPendingSavesForTest(); });

const detected = (runId: string, eventId: string, overrides: Partial<FateEventEnvelope>): FateEventEnvelope => ({
  protocolVersion: 1,
  eventId,
  runId,
  account: 'Nubles',
  runRevision: 0,
  eventType: 'SKILL_LEVEL',
  canonicalLabel: 'Attack Level 2',
  occurredAt: Date.now(),
  sessionSequence: 1,
  bundleVersion: 4,
  rulesVersion: '1',
  contentVersion: 1,
  detectorId: 'skill-level-v1',
  detectorVersion: 1,
  confidence: 'EXACT',
  evidence: { skill: 'Attack', previousLevel: 1, level: 2 },
  ...overrides,
});

/** Log a level by hand, roll for a Key, then spend one, and report what the run became. */
async function playByHand(storageKey: string, withDetections: boolean) {
  // Both plays start from the same run, moment, seed and dice, so any difference is the inbox's doing.
  // The run id must be valid for the save to load as this seeded run (an invalid one fell back to a
  // fresh unseeded run), and rngVersion 2 keeps each entry's random id out of the draws.
  vi.setSystemTime(new Date('2026-09-28T12:00:00Z'));
  vi.spyOn(Math, 'random').mockReturnValue(0.42);
  localStorage.setItem(storageKey, JSON.stringify({ ...createFreshState(), runId: '6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b', keys: 3, rngSeed: 'manual-play', rngVersion: 2 }));
  render(<GameProvider storageKey={storageKey} leaseOptions={{ ownerId: storageKey }}><Capture /></GameProvider>);
  await settle();
  const inbox = getRollInboxStore(current.runId);
  if (withDetections) {
    inbox.ingest([
      detected(current.runId, 'waiting-level', {}),
      detected(current.runId, 'waiting-quest', {
        eventType: 'QUEST', canonicalLabel: "Cook's Assistant", detectorId: 'quest-state-v1', evidence: {},
      }),
    ]);
  }
  const revisionWithDetectionsWaiting = current.runRevision;

  act(() => current.levelUpSkill('Attack'));
  act(() => current.rollForKey('Quest (Novice)', 25, 1));
  act(() => current.rollUnlock(TableType.EQUIPMENT));
  act(() => current.acknowledgeUnlock(current.pendingUnlock!.id));

  const result = {
    revisionWithDetectionsWaiting,
    attack: current.unlocks.levels.Attack,
    keys: current.keys,
    fatePoints: current.fatePoints,
    history: current.history.map((entry) => entry.type),
    equipment: Object.keys(current.unlocks.equipment).sort(),
    inbox: inbox.list().map((row) => row.state),
  };
  cleanup();
  vi.mocked(Math.random).mockRestore();
  return result;
}

it('leaves logging by hand, rolling and spending Keys exactly as they are while detections wait', async () => {
  const without = await playByHand('manual-play-plain', false);
  const withWaiting = await playByHand('manual-play-waiting', true);

  // Detections waiting changed nothing in the run, and every manual action did what it does without them.
  expect(withWaiting.revisionWithDetectionsWaiting).toBe(without.revisionWithDetectionsWaiting);
  expect({ ...withWaiting, inbox: [] }).toEqual({ ...without, inbox: [] });
  expect(withWaiting.attack).toBe(2); // the level logged by hand
  expect(withWaiting.history.filter((type) => type === 'UNLOCK')).toHaveLength(1); // the Key spent
  // The waiting rows are still waiting: nothing rolled them.
  expect(withWaiting.inbox).toEqual(['RECEIVED', 'RECEIVED']);
});
