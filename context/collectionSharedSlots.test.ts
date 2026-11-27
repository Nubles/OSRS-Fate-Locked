import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFreshState, gameReducer, prepareDetectedEventAcceptanceAction } from './GameContext';
import { classifyFateEvent, classifyFateEventCandidate } from '../utils/fateEventEligibility';
import { sharedSlotCount, sharedSlotIds, withSharedSlots } from '../data/collectionLogSlots';
import type { FateEventEnvelope } from '../services/fateEventProtocol';
import { DROP_RATES } from '../config/rules';
import { DropSource, type DetectedProgress } from '../types';
import { parseAndMigrateSave } from '../utils/saveSchema';
import { serializeCurrent } from '../utils/gamePersistence';
import { evaluateAchievements } from '../utils/achievements';

// Wiki, "Collection log": "obtaining a dragon pickaxe from the Chaos Elemental
// will also log it under other bosses that drop it, such as Callisto and the
// King Black Dragon."
const CHAOS_ELEMENTAL = 109002;
const KING_BLACK_DRAGON = 128003;
const PICKAXE = [107003, 109002, 127006, 128003, 147003, 148003];

type State = Parameters<typeof gameReducer>[0];
const fresh = (log: Record<number, number> = {}): State => {
  const state = { ...createFreshState(), lastEvent: null, linkedAccount: 'Shared account' } as State;
  state.unlocks.collectionLog = log;
  return state;
};
const event = (state: State, canonicalLabel: string | null): FateEventEnvelope => ({
  protocolVersion: 1, eventId: 'shared-slot-event', runId: state.runId,
  account: state.linkedAccount ?? '', runRevision: state.runRevision,
  eventType: 'COLLECTION_LOG', canonicalLabel, occurredAt: 1,
  sessionSequence: 1, bundleVersion: 1, rulesVersion: '1', contentVersion: 1,
  detectorId: 'collection-log-chat-v1', detectorVersion: 1, confidence: 'EXACT', evidence: {},
});
const accept = (state: State, itemId: number) => prepareDetectedEventAcceptanceAction(
  state, { kind: 'COLLECTION_ITEM', itemId } satisfies DetectedProgress,
  { source: DropSource.COLLECTION_LOG, threshold: 100, failureFate: 1, target: 'Dragon pickaxe' },
  () => 1, { fateEventId: 'shared-slot-event', detectorId: 'collection-log-chat-v1', detectorVersion: 1 },
  { runId: state.runId, runRevision: state.runRevision, account: state.linkedAccount });

beforeEach(() => {
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn(), removeItem: vi.fn() });
});
afterEach(() => vi.unstubAllGlobals());

describe('one item fills every collection log page that lists it', () => {
  it('logging Dragon pickaxe on the Chaos Elemental page also marks it on the King Black Dragon page', () => {
    expect([...sharedSlotIds(CHAOS_ELEMENTAL)].sort()).toEqual(PICKAXE);
    const next = gameReducer(fresh(), { type: 'LOG_ITEM', payload: CHAOS_ELEMENTAL });
    for (const id of PICKAXE) expect(sharedSlotCount(next.unlocks.collectionLog, id)).toBe(1);
    expect(withSharedSlots(next.unlocks.collectionLog)[KING_BLACK_DRAGON]).toBe(1);
    // Stored once, so the achievement count of logged items moves by one.
    expect(next.unlocks.collectionLog).toEqual({ [CHAOS_ELEMENTAL]: 1 });
  });

  it('a second page of the same item adds to the one slot instead of logging a new item', () => {
    const once = gameReducer(fresh(), { type: 'LOG_ITEM', payload: CHAOS_ELEMENTAL });
    const twice = gameReducer(once, { type: 'LOG_ITEM', payload: KING_BLACK_DRAGON });
    expect(twice.unlocks.collectionLog).toEqual({ [CHAOS_ELEMENTAL]: 2 });
    expect(sharedSlotCount(twice.unlocks.collectionLog, KING_BLACK_DRAGON)).toBe(2);
  });

  it('a RuneLite event for an item on several pages logs the item once and rolls once', () => {
    const state = fresh();
    const first = classifyFateEvent(event(state, 'Dragon pickaxe'), state);
    expect(first).toMatchObject({
      state: 'READY',
      intent: { source: DropSource.COLLECTION_LOG, threshold: DROP_RATES[DropSource.COLLECTION_LOG], target: 'Dragon pickaxe' },
      progress: { kind: 'COLLECTION_ITEM' },
    });
    if (first.state !== 'READY' || first.progress.kind !== 'COLLECTION_ITEM') throw new Error('not ready');
    expect(PICKAXE).toContain(first.progress.itemId);
    const logged = gameReducer(state, { type: 'SYNC_DETECTED_PROGRESS', payload: first.progress });
    for (const id of PICKAXE) expect(sharedSlotCount(logged.unlocks.collectionLog, id)).toBe(1);
    // The next drop of it, from any page, is already logged.
    expect(classifyFateEvent(event(logged, 'Dragon pickaxe'), logged))
      .toEqual({ state: 'BLOCKED', reason: 'This item is already in the Collection Log.' });
  });

  it('an event or sync for a second page does not roll', () => {
    const state = gameReducer(fresh(), { type: 'LOG_ITEM', payload: CHAOS_ELEMENTAL });
    expect(classifyFateEventCandidate(event(state, null), state, String(KING_BLACK_DRAGON)))
      .toEqual({ state: 'BLOCKED', reason: 'This item is already in the Collection Log.' });
    expect(gameReducer(state, { type: 'SYNC_DETECTED_PROGRESS', payload: { kind: 'COLLECTION_ITEM', itemId: KING_BLACK_DRAGON } })).toBe(state);
    expect(gameReducer(state, accept(state, KING_BLACK_DRAGON))).toBe(state);
    // The first page of a new item still rolls through the same acceptance.
    const clean = fresh();
    const rolled = gameReducer(clean, accept(clean, KING_BLACK_DRAGON));
    expect(rolled).not.toBe(clean);
    expect(rolled.history.length).toBe(clean.history.length + 1);
  });

  it('never marks or writes a page held for identity review', () => {
    const state = { ...fresh({ [CHAOS_ELEMENTAL]: 1 }), collectionLogIdentity: { version: 1 as const, quarantinedIds: [KING_BLACK_DRAGON] } };
    const blocked = new Set([KING_BLACK_DRAGON]);
    expect(withSharedSlots(state.unlocks.collectionLog, blocked)[KING_BLACK_DRAGON]).toBeUndefined();
    expect(gameReducer(state, { type: 'LOG_ITEM', payload: KING_BLACK_DRAGON })).toBe(state);
    expect(classifyFateEventCandidate(event(state, null), state, String(KING_BLACK_DRAGON)).state).toBe('BLOCKED');
    // A count held for review is not evidence for its sibling pages.
    const held = { ...fresh({ [KING_BLACK_DRAGON]: 1 }), collectionLogIdentity: { version: 1 as const, quarantinedIds: [KING_BLACK_DRAGON] } };
    expect(sharedSlotCount(held.unlocks.collectionLog, CHAOS_ELEMENTAL, blocked)).toBe(0);
    expect(gameReducer(held, { type: 'LOG_ITEM', payload: CHAOS_ELEMENTAL }).unlocks.collectionLog)
      .toEqual({ [KING_BLACK_DRAGON]: 1, [CHAOS_ELEMENTAL]: 1 });
  });
});

describe('saves made before shared slots', () => {
  const load = (log: Record<number, number>) => {
    const old = fresh(log);
    delete old.collectionLogIdentity;
    const parsed = parseAndMigrateSave(serializeCurrent(old), createFreshState());
    if (parsed.ok === false) throw new Error(parsed.message);
    return { ...parsed.state, lastEvent: null, linkedAccount: 'Shared account' } as State;
  };

  it('a save holding one page shows the item on its other pages without a new roll', () => {
    const state = load({ [CHAOS_ELEMENTAL]: 1 });
    expect(state.unlocks.collectionLog).toEqual({ [CHAOS_ELEMENTAL]: 1 });
    for (const id of PICKAXE) expect(withSharedSlots(state.unlocks.collectionLog)[id]).toBe(1);
    expect(classifyFateEvent(event(state, 'Dragon pickaxe'), state).state).toBe('BLOCKED');
    expect(gameReducer(state, { type: 'SYNC_DETECTED_PROGRESS', payload: { kind: 'COLLECTION_ITEM', itemId: KING_BLACK_DRAGON } })).toBe(state);
  });

  it('a save holding two pages of one item keeps both counts and its achievement count', () => {
    const state = load({ [CHAOS_ELEMENTAL]: 1, [KING_BLACK_DRAGON]: 3 });
    expect(state.unlocks.collectionLog).toEqual({ [CHAOS_ELEMENTAL]: 1, [KING_BLACK_DRAGON]: 3 });
    expect(withSharedSlots(state.unlocks.collectionLog)[107003]).toBe(3);
    const items = (s: State) => evaluateAchievements(s).find(a => a.id === 'collection-25')?.current;
    const before = items(state);
    expect(before).toBe(2);
    const next = gameReducer(state, { type: 'LOG_ITEM', payload: CHAOS_ELEMENTAL });
    expect(next.unlocks.collectionLog).toEqual({ [CHAOS_ELEMENTAL]: 4, [KING_BLACK_DRAGON]: 3 });
    expect(items(next)).toBe(before);
  });
});
