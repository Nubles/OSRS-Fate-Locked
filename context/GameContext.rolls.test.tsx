// @vitest-environment jsdom
import React from 'react';
import 'fake-indexeddb/auto';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { GameProvider, createFreshState, useGame } from './GameContext';
import { TableType } from '../types';
import { resetPendingSavesForTest } from '../utils/pendingSaves';
import { WRITER_LEASE_ARBITRATION_MS } from '../utils/profileWriterLease';

let current: ReturnType<typeof useGame>;
const Capture = () => { current = useGame(); return <div>{current.pendingUnlock?.item ?? 'No reveal'}</div>; };
const mount = () => render(<GameProvider storageKey="roll-audit" leaseOptions={{ ownerId: 'roll-test' }}><Capture /></GameProvider>);
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

it.each([undefined, 'repeatable-seed'])('saves the selection, cost and award before reveal; reload and double acknowledgement do not reroll (%s)', async seed => {
  localStorage.setItem('roll-audit', JSON.stringify({ ...createFreshState(), keys: 3, rngSeed: seed }));
  let view = mount(); await settle();
  act(() => { current.rollUnlock(TableType.EQUIPMENT); current.rollUnlock(TableType.EQUIPMENT); });
  const saved = JSON.parse(localStorage.getItem('roll-audit')!);
  expect(saved.keys).toBe(2);
  expect(saved.unlocks.equipment[saved.pendingUnlock.item]).toBe(1);
  expect(saved.history.filter((e: any) => e.type === 'UNLOCK')).toHaveLength(1);
  view.unmount();
  view = mount(); await settle();
  expect(current.pendingUnlock).toEqual(saved.pendingUnlock);
  const id = current.pendingUnlock!.id;
  act(() => { current.acknowledgeUnlock(id); current.acknowledgeUnlock(id); });
  expect(current.keys).toBe(2);
  expect(current.unlocks.equipment[saved.pendingUnlock.item]).toBe(1);
  expect(current.pendingUnlock).toBeUndefined();
  await act(async () => { await vi.advanceTimersByTimeAsync(550); });
  view.unmount(); mount(); await settle();
  expect(current.pendingUnlock).toBeUndefined();
  expect(current.keys).toBe(2);
});

it('does not expose a failed-save result and retries that same transaction', async () => {
  localStorage.setItem('roll-audit', JSON.stringify({ ...createFreshState(), keys: 3 }));
  mount(); await settle();
  const write = localStorage.setItem.bind(localStorage);
  const spy = vi.spyOn(localStorage, 'setItem').mockImplementation(function(key, value) {
    if (key === 'roll-audit') throw new DOMException('Full', 'QuotaExceededError');
    return write(key, value);
  });
  vi.spyOn(Math, 'random').mockReturnValue(0.1);
  act(() => current.rollUnlock(TableType.EQUIPMENT));
  expect(screen.getByRole('status').textContent).toContain('waiting to be saved');
  const selected = current.pendingUnlock!;
  expect(screen.getByText(selected.item).parentElement?.style.display).toBe('none');
  expect(screen.queryByRole('button', { name: 'Accept Destiny' })).toBeNull();
  expect(JSON.parse(localStorage.getItem('roll-audit')!).keys).toBe(3);
  spy.mockRestore();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Retry save' })); });
  expect(current.keys).toBe(2);
  expect(current.pendingUnlock).toBeDefined();
  expect(current.pendingUnlock).toEqual(selected);
  expect(JSON.parse(localStorage.getItem('roll-audit')!).pendingUnlock).toEqual(selected);
  expect(current.history.filter(e => e.type === 'UNLOCK')).toHaveLength(1);
});

it('persists Chaos awards and does not draw or spend from an empty table', async () => {
  localStorage.setItem('roll-audit', JSON.stringify({ ...createFreshState(), chaosKeys: 2, keys: 3 }));
  mount(); await settle();
  act(() => current.rollUnlock());
  expect(current.chaosKeys).toBe(1);
  expect(JSON.parse(localStorage.getItem('roll-audit')!).pendingUnlock.costType).toBe('chaosKey');
  act(() => current.acknowledgeUnlock(current.pendingUnlock!.id));
  const history = current.history;
  act(() => current.rollUnlock(TableType.QUESTS));
  expect(current.keys).toBe(3);
  expect(current.history).toEqual(history);
});

it('keeps the durable writer usable after StrictMode effect replay', async () => {
  vi.useRealTimers();
  const state = createFreshState();
  render(<React.StrictMode><GameProvider storageKey="strict-audit" leaseOptions={{ ownerId: 'strict-test' }} bootstrap={{
    initialState: state, initialData: JSON.stringify(state), persistenceRevision: 0,
    maxDurablePersistenceRevision: 0, source: 'empty', needsJournalImport: true,
  }}><Capture /></GameProvider></React.StrictMode>);
  await waitFor(() => expect(current.saveOwnershipStatus).toBe('owner'));
  act(() => current.saveNote('audit', 'Persist after replay'));
  await act(async () => { await current.retrySave(); });
  expect(current.saveStatus).toBe('saved');
  expect(JSON.parse(localStorage.getItem('strict-audit')!).userNotes.audit).toBe('Persist after replay');
});

it.each([
  ['casual', 10, true],
  ['hardcore', 20, false],
  ['hardcore', 23, true],
  ['vanilla', 14, false],
] as const)('stakes a %s Gambit of %i Fate only at the mode-scaled minimum the Altar shows', async (mode, fate, accepted) => {
  // Casual's minimum is 9 (15 x 0.6) and Hardcore's 23 (15 x 1.5); Vanilla's stays 15.
  localStorage.setItem('roll-audit', JSON.stringify({ ...createFreshState(), fatePoints: fate, gameModeId: mode, gameModeLocked: true }));
  mount(); await settle();
  act(() => current.performGambit());
  expect(current.fatePoints).toBe(accepted ? 0 : fate);
  expect(current.history.filter(e => e.meta?.ritual === 'GAMBIT')).toHaveLength(accepted ? 1 : 0);
});
