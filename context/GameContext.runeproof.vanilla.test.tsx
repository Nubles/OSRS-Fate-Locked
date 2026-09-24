// @vitest-environment jsdom
import React, { useMemo } from 'react';
import 'fake-indexeddb/auto';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameProvider, createFreshState, useGame } from './GameContext';
import { useRuneProofPreviewChecks } from '../hooks/useRuneProofPreviewChecks';
import { useRuneProofPreviewActions } from '../hooks/useRuneProofPreviewActions';
import { SaveRecoveryGuard } from '../components/SaveRecoveryGuard';
import { getPendingSave, resetPendingSavesForTest } from '../utils/pendingSaves';
import { WRITER_LEASE_ARBITRATION_MS } from '../utils/profileWriterLease';
import type { QuestStrategyDefinition } from '../utils/questStrategies/model';
import type { GameState } from '../types';
import { openRecoveryDatabase } from '../utils/recoveryDatabase';

const questId = "Cook's Assistant";
const actionId = 'cooks-assistant:take-egg';
const strategies = [{ questId, revision: 'reviewed-v1', actions: [{ id: actionId }] }] as unknown as readonly QuestStrategyDefinition[];
type Controls = { game: ReturnType<typeof useGame>; checks: ReturnType<typeof useRuneProofPreviewChecks>; actions: ReturnType<typeof useRuneProofPreviewActions> };
let values: Map<string, string>;
let failWrites: boolean;

beforeEach(() => {
  vi.useFakeTimers();
  resetPendingSavesForTest();
  values = new Map();
  failWrites = false;
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (failWrites) throw new DOMException('full', 'QuotaExceededError');
      values.set(key, value);
    },
    removeItem: (key: string) => { values.delete(key); },
  });
});
afterEach(() => { cleanup(); resetPendingSavesForTest(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function start(profile = 'profile', ownerId = 'tab-a', coordinated = false) {
  let current!: Controls;
  function Probe() {
    const game = useGame();
    const canonical = useMemo(() => ({ progress: game.runeProofProgress, update: game.updateRuneProof }), [game.runeProofProgress, game.updateRuneProof]);
    const checks = useRuneProofPreviewChecks(game.runId, undefined, canonical);
    const actions = useRuneProofPreviewActions(game.runId, strategies, undefined, canonical);
    current = { game, checks, actions };
    return <SaveRecoveryGuard />;
  }
  const state = coordinated ? JSON.parse(values.get(profile)!) as GameState : undefined;
  const bootstrap = state ? { initialState: state, initialData: values.get(profile)!, persistenceRevision: 0,
    maxDurablePersistenceRevision: 0, source: 'mirror' as const, needsJournalImport: false } : undefined;
  const rendered = render(<GameProvider storageKey={profile} leaseOptions={{ ownerId }} bootstrap={bootstrap}><Probe /></GameProvider>);
  return { ...rendered, current: () => current };
}
async function settle() { await act(async () => { await vi.advanceTimersByTimeAsync(WRITER_LEASE_ARBITRATION_MS + 500); }); }
function fresh(): GameState { return { ...createFreshState(), gameModeId: 'vanilla' }; }

describe('RuneProof canonical Vanilla durability', () => {
  it('writes guide confirmations into the real coordinated journal and mirror', async () => {
    vi.useRealTimers();
    values.set('guide-coordinated', JSON.stringify(fresh()));
    const view = start('guide-coordinated', 'coordinated-owner', true);
    await waitFor(() => expect(view.current().game.saveOwnershipStatus).toBe('owner'));
    act(() => view.current().checks.setItemConfirmed(questId, 'egg', true));
    act(() => view.current().actions.setActionConfirmed(questId, actionId, true));
    await act(async () => { await view.current().game.retrySave(); });
    const repository = await openRecoveryDatabase();
    const head = await repository.getHead('guide-coordinated');
    expect(JSON.parse(head!.data).runeProofProgress.items[questId]).toEqual(['egg']);
    expect(JSON.parse(head!.data).runeProofProgress.actions[questId]).toEqual({ revision: 'reviewed-v1', ids: [actionId] });
    expect(JSON.parse(values.get('guide-coordinated')!).runeProofProgress).toEqual(JSON.parse(head!.data).runeProofProgress);
    repository.close();
  });
  it('migrates local legacy checks once, exports them, and never resurrects them after an older same-run import', async () => {
    const legacy = fresh();
    delete legacy.runeProofProgress;
    values.set('profile', JSON.stringify(legacy));
    const itemKey = `fate_runeproof_preview_checks_v1:${legacy.runId}`;
    const actionKey = `fate_runeproof_preview_actions_v1:${legacy.runId}`;
    values.set(itemKey, JSON.stringify({ [questId]: ['egg'] }));
    values.set(actionKey, JSON.stringify({ [questId]: [actionId, 'obsolete-action'] }));
    const view = start();
    await settle();
    expect([...view.current().checks.confirmedItemKeys(questId)]).toEqual(['egg']);
    expect([...view.current().actions.confirmedActionIdsFor(questId)]).toEqual([actionId]);
    const exported = JSON.parse(view.current().game.getExportData());
    expect(exported.runeProofProgress.actions[questId]).toEqual({ revision: 'reviewed-v1', ids: [actionId] });
    expect(values.get(itemKey)).toBe(JSON.stringify({ [questId]: ['egg'] }));

    await act(async () => { const result = await view.current().game.importSave(legacy); expect(result, JSON.stringify(result)).toMatchObject({ ok: true }); });
    expect(view.current().checks.checks).toEqual({});
    expect(view.current().actions.actionsByQuest).toEqual({});
    view.unmount();
    const reloaded = start();
    await settle();
    expect(reloaded.current().checks.checks).toEqual({});
    expect(reloaded.current().actions.actionsByQuest).toEqual({});
    expect(JSON.parse(values.get('profile')!).runeProofProgress).toEqual({ version: 1, items: {}, actions: {} });
  });

  it('round-trips guide progress through a protective backup and restores its older snapshot', async () => {
    values.set('profile', JSON.stringify(fresh()));
    const view = start();
    await settle();
    act(() => view.current().checks.setItemConfirmed(questId, 'egg', true));
    act(() => view.current().actions.setActionConfirmed(questId, actionId, true));
    await settle();
    await act(async () => { await view.current().game.createBackup('Guide checkpoint'); });
    const backups = await view.current().game.listBackups();
    const checkpoint = backups.find(backup => backup.reason === 'Guide checkpoint')!;
    expect(checkpoint).toBeDefined();
    act(() => view.current().checks.setItemConfirmed(questId, 'pot of flour', true));
    act(() => view.current().actions.setActionConfirmed(questId, actionId, false));
    await act(async () => { const result = await view.current().game.restoreBackup(checkpoint.id); expect(result, JSON.stringify(result)).toMatchObject({ ok: true }); });
    expect([...view.current().checks.confirmedItemKeys(questId)]).toEqual(['egg']);
    expect([...view.current().actions.confirmedActionIdsFor(questId)]).toEqual([actionId]);
  });

  it('blocks a stale second tab from overwriting the owning tab guide state', async () => {
    values.set('profile', JSON.stringify(fresh()));
    const owner = start('profile', 'owner');
    await settle();
    const stale = start('profile', 'stale');
    await settle();
    expect(stale.current().game.saveOwnershipStatus).toBe('blocked');
    act(() => owner.current().checks.setItemConfirmed(questId, 'egg', true));
    await settle();
    const saved = values.get('profile');
    act(() => stale.current().checks.setItemConfirmed(questId, 'pot of flour', true));
    act(() => stale.current().actions.setActionConfirmed(questId, actionId, true));
    await settle();
    expect(values.get('profile')).toBe(saved);
    expect(stale.current().checks.checks).toEqual({});
    expect(JSON.parse(saved!).runeProofProgress.items[questId]).toEqual(['egg']);
  });

  it('retains failed guide writes in pending saves, warns on unload, retries, and survives reload', async () => {
    values.set('profile', JSON.stringify(fresh()));
    const view = start();
    await settle();
    failWrites = true;
    act(() => view.current().checks.setItemConfirmed(questId, 'egg', true));
    await settle();
    expect(view.current().game.saveStatus).toBe('failed');
    expect(view.current().game.hasPendingChanges).toBe(true);
    expect(JSON.parse(getPendingSave('profile')!.data).runeProofProgress.items[questId]).toEqual(['egg']);
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    failWrites = false;
    await act(async () => { await view.current().game.retrySave(); });
    expect(view.current().game.saveStatus).toBe('saved');
    view.unmount();
    const reloaded = start();
    await settle();
    expect([...reloaded.current().checks.confirmedItemKeys(questId)]).toEqual(['egg']);
  });

  it('keeps profiles separate even after importing the same run ID, and rejects stale run callbacks', async () => {
    values.set('profile-a', JSON.stringify(fresh()));
    const first = start('profile-a');
    await settle();
    act(() => first.current().checks.setItemConfirmed(questId, 'egg', true));
    const snapshot = JSON.parse(first.current().game.getExportData());
    const second = start('profile-b');
    await settle();
    await act(async () => { await second.current().game.importSave(snapshot); });
    act(() => first.current().checks.setItemConfirmed(questId, 'pot of flour', true));
    expect([...second.current().checks.confirmedItemKeys(questId)]).toEqual(['egg']);
    const staleCallback = second.current().checks.setItemConfirmed;
    await act(async () => { await second.current().game.importSave(fresh()); });
    act(() => staleCallback(questId, 'pot of flour', true));
    expect(second.current().checks.checks).toEqual({});
  });

  it('does not reuse action confirmations when the reviewed guide revision changes', async () => {
    const state = fresh();
    state.runeProofProgress!.actions[questId] = { revision: 'older-guide', ids: [actionId] };
    values.set('profile', JSON.stringify(state));
    const view = start();
    await settle();
    expect(view.current().actions.actionsByQuest).toEqual({});
    act(() => view.current().actions.setActionConfirmed(questId, actionId, true));
    expect(view.current().game.runeProofProgress!.actions[questId]).toEqual({ revision: 'reviewed-v1', ids: [actionId] });
  });
});
