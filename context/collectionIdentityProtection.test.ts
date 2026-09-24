import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFreshState, gameReducer, prepareDetectedEventAcceptanceAction } from './GameContext';
import { classifyFateEvent, classifyFateEventCandidate } from '../utils/fateEventEligibility';
import { collectionIdentityReview, collectionLogSync } from '../services/CollectionLogSyncService';
import type { FateEventEnvelope } from '../services/fateEventProtocol';
import { DropSource, type DetectedProgress } from '../types';
import { parseAndMigrateSave } from '../utils/saveSchema';
import { serializeCurrent } from '../utils/gamePersistence';

// A previous live cache assigned Unsired the ID now belonging to Bludgeon spine.
// Both that reused ID and Unsired's current canonical ID must stay quarantined.
const reusedId = 101004;
const movedId = 101002;
const legacy = JSON.stringify({ timestamp: 0, data: { additions: [
  { id: reusedId, name: 'Unsired', page: 'Abyssal Sire' },
], newSources: [] } });
const fresh = () => {
  const state = { ...createFreshState(), lastEvent: null, linkedAccount: 'Review account' };
  state.unlocks.collectionLog = { [reusedId]: 1 };
  delete state.collectionLogIdentity;
  const parsed = parseAndMigrateSave(serializeCurrent(state), createFreshState());
  if (parsed.ok === false) throw new Error(parsed.message);
  return { ...parsed.state, lastEvent: null, linkedAccount: 'Review account' };
};
const event = (state: ReturnType<typeof fresh>, canonicalLabel: string | null = 'Unsired'): FateEventEnvelope => ({
  protocolVersion: 1, eventId: 'identity-review-event', runId: state.runId,
  account: state.linkedAccount, runRevision: state.runRevision,
  eventType: 'COLLECTION_LOG', canonicalLabel, occurredAt: 1,
  sessionSequence: 1, bundleVersion: 1, rulesVersion: '1', contentVersion: 1,
  detectorId: 'collection-log-chat-v1', detectorVersion: 1, confidence: 'EXACT', evidence: {},
});

beforeEach(() => vi.stubGlobal('localStorage', {
  getItem: (key: string) => key === 'fate_clog_sync_v3' ? legacy : null,
  setItem: vi.fn(), removeItem: vi.fn(),
}));
afterEach(() => vi.unstubAllGlobals());

describe('Collection Log identity quarantine at shared entry points', () => {
  it('blocks exact events and reviewed candidates for both conflicting identities', () => {
    const state = fresh();
    expect([...collectionIdentityReview(state.unlocks.collectionLog, collectionLogSync.legacyMappings(), undefined, state.collectionLogIdentity).blockedIds].sort()).toEqual([reusedId, movedId].sort());
    for (const [id, name] of [[reusedId, 'Bludgeon spine'], [movedId, 'Unsired']] as const) {
      expect(classifyFateEvent(event(state, name), state)).toMatchObject({ state: 'BLOCKED', reason: expect.stringContaining('identity review') });
      expect(classifyFateEventCandidate(event(state, name), state, String(id)).state).toBe('BLOCKED');
      expect(classifyFateEventCandidate(event(state, null), state, String(id)).state).toBe('BLOCKED');
    }
  });

  it.each([reusedId, movedId])('rejects final acceptance, sync and manual writes for quarantined ID %i', itemId => {
    const state = fresh();
    const before = JSON.stringify(state);
    const progress: DetectedProgress = { kind: 'COLLECTION_ITEM', itemId };
    const action = prepareDetectedEventAcceptanceAction(state, progress,
      { source: DropSource.COLLECTION_LOG, threshold: 100, failureFate: 1, target: 'Unsired' },
      () => 1, { fateEventId: 'identity-review-event', detectorId: 'collection-log-chat-v1', detectorVersion: 1 },
      { runId: state.runId, runRevision: state.runRevision, account: state.linkedAccount });
    expect(gameReducer(state, action)).toBe(state);
    expect(gameReducer(state, { type: 'SYNC_DETECTED_PROGRESS', payload: progress })).toBe(state);
    expect(gameReducer(state, { type: 'LOG_ITEM', payload: itemId })).toBe(state);
    expect(JSON.stringify(state)).toBe(before);
    expect(localStorage.getItem('fate_clog_sync_v3')).toBe(legacy);
    expect(localStorage.setItem).not.toHaveBeenCalled();
    expect(localStorage.removeItem).not.toHaveBeenCalled();
  });

  it('allows an unrelated canonical item and a fresh run without conflicting saved progress', () => {
    const state = fresh();
    expect(classifyFateEvent(event(state, 'Bludgeon claw'), state).state).toBe('READY');
    const next = gameReducer(state, { type: 'LOG_ITEM', payload: 101005 });
    expect(next.unlocks.collectionLog[101005]).toBe(1);
    const clean = { ...createFreshState(), lastEvent: null, linkedAccount: 'Review account' };
    expect(classifyFateEvent(event(clean, 'Unsired'), clean).state).toBe('READY');
    expect(gameReducer(clean, { type: 'LOG_ITEM', payload: movedId }).unlocks.collectionLog[movedId]).toBe(1);
  });
});


describe('Collection Log identity provenance across runs and browsers', () => {
  it.each([[reusedId, 'Bludgeon spine'], [movedId, 'Unsired']] as const)(
    'keeps new canonical drops at %i usable despite another run historical cache', (itemId, name) => {
      let state = { ...createFreshState(), lastEvent: null, linkedAccount: 'Review account' };
      for (let count = 1; count <= 2; count++) {
        expect(classifyFateEvent(event(state, name), state).state).toBe('READY');
        state = gameReducer(state, { type: 'LOG_ITEM', payload: itemId }) as typeof state;
        expect(state.unlocks.collectionLog[itemId]).toBe(count);
        expect(collectionIdentityReview(state.unlocks.collectionLog, collectionLogSync.legacyMappings(), undefined, state.collectionLogIdentity).blockedIds.size).toBe(0);
      }
      const reloaded = parseAndMigrateSave(serializeCurrent(state), createFreshState());
      expect(reloaded.ok).toBe(true);
      if (reloaded.ok === false) throw new Error(reloaded.message);
      expect(reloaded.state.unlocks.collectionLog[itemId]).toBe(2);
      expect(reloaded.state.collectionLogIdentity).toEqual({ version: 1, quarantinedIds: [] });
      expect(classifyFateEvent(event(state, name), reloaded.state).state).toBe('READY');
    });

  it('exports the quarantine and retains both blocked identities on a clean browser', () => {
    const state = fresh();
    expect(state.collectionLogIdentity).toEqual({ version: 1, quarantinedIds: [movedId, reusedId] });
    const exported = serializeCurrent(state);
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn(), removeItem: vi.fn() });
    const imported = parseAndMigrateSave(exported, createFreshState());
    expect(imported.ok).toBe(true);
    if (imported.ok === false) throw new Error(imported.message);
    expect(imported.state.unlocks.collectionLog).toEqual(state.unlocks.collectionLog);
    expect(imported.state.collectionLogIdentity).toEqual(state.collectionLogIdentity);
    const restored = { ...imported.state, lastEvent: null, linkedAccount: 'Review account' };
    const review = collectionIdentityReview(restored.unlocks.collectionLog, [], undefined, restored.collectionLogIdentity);
    expect([...review.blockedIds].sort()).toEqual([movedId, reusedId].sort());
    expect(review.savedRecords).toBe(1);
    for (const [itemId, name] of [[reusedId, 'Bludgeon spine'], [movedId, 'Unsired']] as const) {
      expect(classifyFateEvent(event(restored, name), restored).state).toBe('BLOCKED');
      expect(gameReducer(restored, { type: 'LOG_ITEM', payload: itemId })).toBe(restored);
      expect(gameReducer(restored, { type: 'SYNC_DETECTED_PROGRESS', payload: { kind: 'COLLECTION_ITEM', itemId } })).toBe(restored);
    }
    // A separate new run on the same browser never inherits that quarantine.
    const clean = { ...createFreshState(), lastEvent: null, linkedAccount: 'Review account' };
    expect(gameReducer(clean, { type: 'LOG_ITEM', payload: reusedId }).unlocks.collectionLog[reusedId]).toBe(1);
  });
});


describe('Collection Log identity review before retired-ID migration', () => {
  it.each([
    [528089, 'Venator fang', 532002, 532001],
    [528090, 'Venator tooth', 532001, 532002],
  ] as const)('preserves conflicting raw ID %i through migration and clean-browser import', (rawId, name, actualId, staticTarget) => {
    const evidence = JSON.stringify({ data: { additions: [{ id: rawId, name, page: 'Slayer' }] } });
    vi.stubGlobal('localStorage', { getItem: (key: string) => key === 'fate_clog_sync_v3' ? evidence : null });
    const state = createFreshState();
    delete state.collectionLogIdentity;
    state.unlocks.collectionLog = { [rawId]: 2 };
    const reviewed = parseAndMigrateSave(serializeCurrent(state), createFreshState());
    expect(reviewed.ok).toBe(true);
    if (reviewed.ok === false) throw new Error(reviewed.message);
    expect(reviewed.state.unlocks.collectionLog).toEqual({ [rawId]: 2 });
    expect(reviewed.state.unlocks.collectionLog[staticTarget]).toBeUndefined();
    expect(reviewed.state.collectionLogIdentity).toEqual({ version: 1, quarantinedIds: [rawId, actualId].sort((a, b) => a - b) });
    vi.stubGlobal('localStorage', { getItem: () => null });
    const imported = parseAndMigrateSave(serializeCurrent(reviewed.state), createFreshState());
    expect(imported.ok).toBe(true);
    if (imported.ok === false) throw new Error(imported.message);
    expect(imported.state.unlocks.collectionLog).toEqual({ [rawId]: 2 });
    expect(imported.state.collectionLogIdentity).toEqual(reviewed.state.collectionLogIdentity);
    const restored = { ...imported.state, lastEvent: null, linkedAccount: 'Review account' };
    expect(classifyFateEvent(event(restored, name), restored).state).toBe('BLOCKED');
    for (const itemId of [rawId, actualId]) {
      expect(gameReducer(restored, { type: 'LOG_ITEM', payload: itemId })).toBe(restored);
      expect(gameReducer(restored, { type: 'SYNC_DETECTED_PROGRESS', payload: { kind: 'COLLECTION_ITEM', itemId } })).toBe(restored);
    }
  });

  it.each([[104011, 104002], [528089, 532001], [528090, 532002]])(
    'retains the reviewed static migration %i to %i without conflicting evidence', (rawId, canonicalId) => {
      vi.stubGlobal('localStorage', { getItem: () => null });
      const state = createFreshState();
      delete state.collectionLogIdentity;
      state.unlocks.collectionLog = { [rawId]: 2, [canonicalId]: 1 };
      const loaded = parseAndMigrateSave(serializeCurrent(state), createFreshState());
      expect(loaded.ok).toBe(true);
      if (loaded.ok === false) throw new Error(loaded.message);
      expect(loaded.state.unlocks.collectionLog).toEqual({ [canonicalId]: 2 });
      expect(loaded.state.collectionLogIdentity).toEqual({ version: 1, quarantinedIds: [] });
    });

  it('never folds a retired count into an already quarantined canonical target', () => {
    const state = createFreshState();
    state.unlocks.collectionLog = { 528089: 2, 532001: 1 };
    state.collectionLogIdentity = { version: 1, quarantinedIds: [532001] };
    const loaded = parseAndMigrateSave(serializeCurrent(state), createFreshState());
    expect(loaded.ok).toBe(true);
    if (loaded.ok === false) throw new Error(loaded.message);
    expect(loaded.state.unlocks.collectionLog).toEqual(state.unlocks.collectionLog);
    expect(loaded.state.collectionLogIdentity).toEqual({ version: 1, quarantinedIds: [528089, 532001] });
  });

  it('defers retired-ID migration when legacy evidence cannot be read', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('unavailable'); } });
    const state = createFreshState();
    delete state.collectionLogIdentity;
    state.unlocks.collectionLog = { 528089: 1 };
    const loaded = parseAndMigrateSave(serializeCurrent(state), createFreshState());
    expect(loaded.ok).toBe(true);
    if (loaded.ok === false) throw new Error(loaded.message);
    expect(loaded.state.unlocks.collectionLog).toEqual({ 528089: 1 });
    expect(loaded.state.collectionLogIdentity).toBeUndefined();
  });
});
