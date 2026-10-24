// @vitest-environment jsdom
import React from 'react';
import 'fake-indexeddb/auto';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { GameProvider, createFreshState, gameReducer, useGame } from './GameContext';
import { pickChaosEntry, randomUnlockPool } from '../utils/gameEngine';
import { CURRENT_RNG_VERSION, drawFloat, seededContext } from '../utils/seededRng';
import { resetPendingSavesForTest } from '../utils/pendingSaves';
import { WRITER_LEASE_ARBITRATION_MS } from '../utils/profileWriterLease';

let current: ReturnType<typeof useGame>;
const Capture = () => { current = useGame(); return null; };
const mount = () => render(<GameProvider storageKey="chaos-pick" leaseOptions={{ ownerId: 'chaos-test' }}><Capture /></GameProvider>);
const settle = async () => {
  await act(async () => { await vi.advanceTimersByTimeAsync(WRITER_LEASE_ARBITRATION_MS + 1); });
  await act(async () => { await vi.advanceTimersByTimeAsync(550); });
};
beforeEach(() => {
  vi.useFakeTimers();
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => { values.set(k, v); }, removeItem: (k: string) => values.delete(k) });
  resetPendingSavesForTest();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); resetPendingSavesForTest(); });

const SEED = 'OLD-CHAOS-SEED';
/** Spends Chaos Keys in a row through the provider on a seeded run and lists what fate drew. */
const chaosDraws = async (mode: string, rngVersion: 1 | 2 | 3 | undefined, count = 3) => {
  localStorage.setItem('chaos-pick', JSON.stringify({ ...createFreshState(), gameModeId: mode, gameModeLocked: true, chaosKeys: count, rngSeed: SEED, rngVersion }));
  mount(); await settle();
  const drawn: string[] = [];
  for (let i = 0; i < count; i++) {
    act(() => current.rollUnlock());
    drawn.push(`${current.pendingUnlock?.table}: ${current.pendingUnlock?.item}`);
    const id = current.pendingUnlock!.id;
    act(() => current.acknowledgeUnlock(id));
    await act(async () => { await vi.advanceTimersByTimeAsync(550); });
  }
  return drawn;
};

// These draws come from the old one-draw pick on today's Vanilla pool, which
// holds bosses and minigames you can't reach yet. A seeded run saved before
// Chaos Keys picked a table first must keep drawing that way.
// (Chunked pools also depend on map data the provider loads in the background,
// so context/chaosReplay.test.ts pins Chunked with that data loaded.)
const OLD_VANILLA_FIRST = 'Bosses: Hespori';

it.each([2, 1, undefined] as const)('spends a Chaos Key on an old seeded Vanilla save (rngVersion %s) exactly as before', async version => {
  // Later draws also depend on what the app logs between spends, so the
  // provider pins the first; context/chaosReplay.test.ts pins sequences.
  expect(await chaosDraws('vanilla', version, 1)).toEqual([OLD_VANILLA_FIRST]);
});

it('picks a table first, then an entry, on a run seeded now', async () => {
  const seeded = gameReducer({ ...createFreshState(), lastEvent: null }, { type: 'SET_SEED', payload: SEED });
  expect(seeded.rngVersion).toBe(CURRENT_RNG_VERSION);
  expect(CURRENT_RNG_VERSION).toBe(3);
  const { lastEvent: _event, ...save } = seeded;
  const state = { ...save, gameModeId: 'vanilla', gameModeLocked: true, chaosKeys: 1 };
  const pool = randomUnlockPool(state.unlocks, 'vanilla', 'chaosKey');
  const expected = pickChaosEntry(pool, i => drawFloat(SEED, seededContext(state), 'chaos', i))!;
  localStorage.setItem('chaos-pick', JSON.stringify(state));
  mount(); await settle();
  act(() => current.rollUnlock());
  expect(current.pendingUnlock).toMatchObject({ table: expected.table, item: expected.item, costType: 'chaosKey' });
  // The same seed under the old single draw lands somewhere else.
  const old = pool[Math.floor(drawFloat(SEED, seededContext(state), 'chaos', 0) * pool.length)];
  expect(`${old.table}: ${old.item}`).not.toBe(`${expected.table}: ${expected.item}`);
});
