// @vitest-environment jsdom
import React from 'react';
import 'fake-indexeddb/auto';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { GameProvider, createFreshState, useGame } from './GameContext';
import { TableType, type GameState, type LogEntry } from '../types';
import { resetPendingSavesForTest } from '../utils/pendingSaves';
import { WRITER_LEASE_ARBITRATION_MS } from '../utils/profileWriterLease';
import { legacyRunSalt } from '../utils/seededRng';
import { readRestoreCounts } from '../utils/restoreCount';

// Critique GP-4: a restore must not re-roll a result, and the run keeps count of its restores.

let current: ReturnType<typeof useGame>;
const Capture = () => { current = useGame(); return null; };
const mount = (storageKey: string) =>
  render(<GameProvider storageKey={storageKey} leaseOptions={{ ownerId: `tab-${storageKey}` }}><Capture /></GameProvider>);
const settle = async () => {
  await act(async () => { await vi.advanceTimersByTimeAsync(WRITER_LEASE_ARBITRATION_MS + 1); });
  await act(async () => { await vi.advanceTimersByTimeAsync(550); });
};
/** What an entry decided, without its id, time or chain hash. */
const outcome = (entry: LogEntry | undefined) => entry && { type: entry.type, message: entry.message, details: entry.details, meta: entry.meta };

beforeEach(() => {
  vi.useFakeTimers();
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => { values.set(k, v); },
    removeItem: (k: string) => { values.delete(k); },
  });
  resetPendingSavesForTest();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); resetPendingSavesForTest(); });

/** Play the same three actions: spend a Key on Equipment, accept it, level Attack. */
const play = () => {
  act(() => current.rollUnlock(TableType.EQUIPMENT));
  const spent = current.pendingUnlock!;
  act(() => current.acknowledgeUnlock(spent.id));
  act(() => current.levelUpSkill('Attack'));
  return { item: spent.item, entries: current.history.slice(-2).map(outcome), keys: current.keys, chaosKeys: current.chaosKeys };
};

const restoreSessionStart = async () => {
  const backups = await current.listBackups();
  const sessionStart = backups.find(backup => backup.reason === 'Session start');
  expect(sessionStart).toBeDefined();
  let result: Awaited<ReturnType<typeof current.restoreBackup>> | undefined;
  await act(async () => { result = await current.restoreBackup(sessionStart!.id); });
  expect(result).toMatchObject({ ok: true });
};

it('gives an unseeded run the same results after restoring "Session start", and counts each restore', async () => {
  const key = 'restore-seed';
  localStorage.setItem(key, JSON.stringify({ ...createFreshState(), keys: 5 }));
  let view = mount(key); await settle();
  expect(current.rngSeed).toBeUndefined();
  expect(current.rngSalt).toBeTruthy();
  act(() => current.levelUpSkill('Defence'));
  await act(async () => { await vi.advanceTimersByTimeAsync(550); });
  view.unmount();
  // A new session: the tracker drops a "Session start" backup.
  view = mount(key); await settle();
  const sessionKeys = current.keys;

  const first = play();
  expect(current.keys).toBe(sessionKeys - 1);

  await vi.advanceTimersByTimeAsync(60_000); // later, with new ids and times
  await restoreSessionStart();
  expect(current.keys).toBe(sessionKeys);
  expect(current.restoreCount).toBe(1);
  expect(play()).toEqual(first);

  await restoreSessionStart();
  expect(current.restoreCount).toBe(2);
  expect(play()).toEqual(first);
  // The count is in the run's own save and this profile's count, which a restore cannot roll back.
  await act(async () => { await vi.advanceTimersByTimeAsync(550); });
  expect(JSON.parse(localStorage.getItem(key)!).restoreCount).toBe(2);
  expect(readRestoreCounts(localStorage, key)[current.runId]).toBe(2);
  expect(JSON.parse(localStorage.getItem(`${key}__restores`)!).runs[current.runId]).toBe(2);
}, 20_000);

it('counts importing a copy of the same run, but not a run arriving in a fresh profile', async () => {
  localStorage.setItem('origin', JSON.stringify({ ...createFreshState(), keys: 2 }));
  mount('origin'); await settle();
  act(() => current.levelUpSkill('Defence'));
  const exported = current.getExportData();
  act(() => current.rollUnlock(TableType.EQUIPMENT));
  let result: Awaited<ReturnType<typeof current.importSave>> | undefined;
  await act(async () => { result = await current.importSave(JSON.parse(exported)); });
  expect(result).toMatchObject({ ok: true });
  expect(current.restoreCount).toBe(1);
  cleanup();

  // A fresh profile (a new device) takes the run with the count it carries.
  mount('new-device'); await settle();
  const moved = JSON.parse(current.getExportData()) as GameState;
  expect(moved.restoreCount).toBeUndefined();
  await act(async () => { result = await current.importSave({ ...JSON.parse(exported), restoreCount: 1 }); });
  expect(result).toMatchObject({ ok: true });
  expect(current.restoreCount).toBe(1);
}, 20_000);

it('loads a save from before salts, and every copy of it draws the same', async () => {
  // A run saved before salts: no rngSalt, one entry of history.
  const old = { ...createFreshState(), keys: 2 } as Record<string, unknown>;
  delete old.rngSalt;
  localStorage.setItem('old-a', JSON.stringify(old));
  mount('old-a'); await settle();
  act(() => current.levelUpSkill('Defence'));
  const withHistory = JSON.parse(current.getExportData()) as Record<string, unknown>;
  delete withHistory.rngSalt;
  cleanup();

  const results: string[] = [];
  for (const copy of ['old-b', 'old-c']) {
    localStorage.setItem(copy, JSON.stringify(withHistory));
    mount(copy); await settle();
    expect(current.history).toHaveLength((withHistory.history as unknown[]).length);
    expect(current.rngSalt).toBe(legacyRunSalt(current.history));
    act(() => current.rollUnlock(TableType.EQUIPMENT));
    results.push(current.pendingUnlock!.item);
    cleanup();
  }
  expect(results[0]).toBe(results[1]);
}, 20_000);

// A seeded run saved before salts (rngVersion absent: draws hash the history tip).
const OLD_SEEDED_HISTORY = [{"id": "00000000-0000-4000-8000-000000000006", "timestamp": 1784548800051, "type": "ROLL_FAIL", "message": "No Key.", "details": "Rolled 82.2 (> 0.4%). Fate: 1/50", "meta": {"roll": 82.2, "baseThreshold": 0.4, "threshold": 0.4, "source": "Defence Level 2", "fatePointsEarned": 1, "skill": "Defence", "level": 2, "totalLevel": 34, "chaosKeysAwarded": 0, "chaosKeyAwarded": false, "successProbability": 0.004, "luckApplied": false, "drawResolution": 1000, "standardKeysAwarded": 0, "rewardKind": "none"}, "result": "FAIL", "source": "Defence Level 2", "rollValue": 82.2, "baseThreshold": 0.4, "threshold": 0.4, "prevHash": "GENESIS", "hash": "e5bbda8f"}, {"id": "00000000-0000-4000-8000-000000000009", "timestamp": 1784548800051, "type": "ROLL_FAIL", "message": "No Key.", "details": "Rolled 57.4 (> 0.6%). Fate: 2/50", "meta": {"roll": 57.4, "baseThreshold": 0.6, "threshold": 0.6, "source": "Defence Level 3", "fatePointsEarned": 1, "skill": "Defence", "level": 3, "totalLevel": 35, "chaosKeysAwarded": 0, "chaosKeyAwarded": false, "successProbability": 0.006, "luckApplied": false, "drawResolution": 1000, "standardKeysAwarded": 0, "rewardKind": "none"}, "result": "FAIL", "source": "Defence Level 3", "rollValue": 57.4, "baseThreshold": 0.6, "threshold": 0.6, "prevHash": "e5bbda8f", "hash": "0fc42808"}];
const oldSeededSave = () => {
  const fresh = createFreshState();
  const save = {
    ...fresh, runId: '00000000-0000-4000-8000-000000000001', runRevision: 4, keys: 3, fatePoints: 2,
    rngSeed: 'FATE-2026-W30', history: OLD_SEEDED_HISTORY,
    unlocks: { ...fresh.unlocks, levels: { ...fresh.unlocks.levels, Defence: 3 } },
  } as Record<string, unknown>;
  delete save.rngSalt;
  return JSON.stringify(save);
};

it('replays an old seeded save exactly as before salts existed', async () => {
  // The level roll and the Equipment draw were taken from main before salts existed.
  localStorage.setItem('old-seeded-a', oldSeededSave());
  mount('old-seeded-a'); await settle();
  act(() => current.levelUpSkill('Defence'));
  const level = current.history.at(-1)!;
  cleanup();
  localStorage.setItem('old-seeded-b', oldSeededSave());
  mount('old-seeded-b'); await settle();
  act(() => current.rollUnlock(TableType.EQUIPMENT));
  expect({ type: level.type, details: level.details }).toEqual({ type: 'ROLL_FAIL', details: 'Rolled 8.9 (> 0.8%). Fate: 3/50' });
  expect(current.pendingUnlock!.item).toBe('Legs');
  // The salt it gains on load plays no part in a seeded run.
  expect(current.rngSalt).toBe(legacyRunSalt(OLD_SEEDED_HISTORY as LogEntry[]));
}, 20_000);
