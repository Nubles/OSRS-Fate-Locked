import { describe, expect, it } from 'vitest';
import { DropSource, TableType, type GameState } from '../types';
import { DROP_RATES } from '../config/rules';
import { gameReducer, initialState } from '../context/GameContext';
import { CHUNKED_START_KEY, chunkKey, getChunkFrontier } from './chunkAdjacency';
import { FATE_MARKS, leanTowardThread, threadCandidates, threadLeaning, withFateLand } from './fateLand';
import { validateAndMigrateSave } from './saveSchema';
import { replayInvariants } from './integrity';
import { afterRoll, failFate, rollRitualPlan } from './ritualEffects';
import { ACTIVITY_CHUNKS } from '../data/activityChunks';
import { BANK_BY_ID } from '../data/banks';
import { bankChunkKey } from './activityAccess';
import {
  FATE_THREAD_LEAN_CHANCE, FATE_MARK_BLESSED_FATE, FATE_MARK_CLOUDED_ROLLS, FATE_MARK_CURSED_ODDS, FATE_MARK_CURSED_ROLLS, FATE_MARK_FORTUNATE_ODDS,
  FATE_MARK_FORTUNATE_ROLLS, FATE_MARK_WITHERED_FATE, FATE_THREAD_MAX_STEPS, FATE_THREAD_MIN_STEPS,
} from '../config/economy';

type Run = ReturnType<typeof gameReducer>;
const chunked = (over: Partial<GameState> = {}): Run => ({
  ...initialState, runRevision: 0, lastEvent: null, gameModeId: 'chunked', rngSeed: 'fate-land', rngVersion: 2,
  keys: 5, unlocks: { ...initialState.unlocks, chunks: [] as string[] }, ...over,
});
const tied = (thread: string, over: Partial<GameState> = {}): Run => chunked({ fateLand: { thread, fulfilled: 0, marks: {}, gilded: [] }, ...over });
const spend = (s: Run, item: string): Run => {
  const next = gameReducer(s, { type: 'UNLOCK', payload: { table: TableType.CHUNKS, item, costType: 'key', cost: 1, revealId: 'r' } });
  return next.pendingUnlock ? gameReducer(next, { type: 'ACKNOWLEDGE_UNLOCK', payload: 'r' }) : next;
};
const frontier = (owned: string[]) => getChunkFrontier(owned).map(chunkKey);
const fateEntries = (s: Run) => s.history.filter(e => e.type === 'FATE');
const persists = (s: Run) => {
  const { lastEvent: _lastEvent, ...persisted } = s;
  return validateAndMigrateSave(persisted, initialState);
};

describe("Fate's Thread", () => {
  it('is tied on a Chunked run\'s first action, to an unheld chunk 2 to 4 frontiers out', () => {
    const s = gameReducer(chunked(), { type: 'TOGGLE_ANIMATIONS' });
    const thread = s.fateLand?.thread;
    expect(thread).toBeDefined();
    expect(threadCandidates([CHUNKED_START_KEY], s.unlocks)).toContain(thread);
    // Past the frontier, not on it.
    expect(frontier([CHUNKED_START_KEY])).not.toContain(thread);
    expect(fateEntries(s).map(e => e.meta?.fate)).toEqual(['thread']);
    expect(persists(s).ok).toBe(true);
  });

  it('draws its places from the boss, minigame, guild and bank chunks in the right rings', () => {
    const rings: string[][] = [];
    const seen = new Set([CHUNKED_START_KEY]);
    for (let i = 0; i < FATE_THREAD_MAX_STEPS; i++) {
      const ring = frontier([...seen]).filter(k => !seen.has(k));
      rings.push(ring);
      ring.forEach(k => seen.add(k));
    }
    const places = new Set([...Object.values(ACTIVITY_CHUNKS).flat(), ...Object.keys(BANK_BY_ID).map(bankChunkKey)]);
    const wanted = rings.slice(FATE_THREAD_MIN_STEPS - 1).flat().filter(k => places.has(k));
    expect(wanted.length).toBeGreaterThan(0);
    expect(threadCandidates([CHUNKED_START_KEY], initialState.unlocks)).toEqual(wanted.sort());
  });

  it('leaves Vanilla runs alone', () => {
    const s = gameReducer({ ...chunked(), gameModeId: 'vanilla' }, { type: 'TOGGLE_ANIMATIONS' });
    expect(s.fateLand).toBeUndefined();
    expect(fateEntries(s)).toEqual([]);
  });

  it('gives one Chunks draw in six to the frontier chunks nearest the thread', () => {
    const pool = ['49,50', '51,50', '50,51', '50,49'].map(item => ({ table: TableType.CHUNKS, item }));
    expect(leanTowardThread(pool, '54,50', FATE_THREAD_LEAN_CHANCE - 0.01).map(c => c.item)).toEqual(['51,50']);
    expect(leanTowardThread(pool, '54,50', FATE_THREAD_LEAN_CHANCE)).toEqual(pool);
    expect(leanTowardThread(pool, undefined, 0)).toEqual(pool);
    expect(threadLeaning(pool.map(c => c.item), '50,55')).toEqual(['50,51']);
  });

  it('is fulfilled when the run gains its place: a free ritual fate picks and a new thread', () => {
    const s = spend(tied('49,50'), '49,50');
    expect(s.fateLand?.fulfilled).toBe(1);
    expect(s.fateLand?.thread).not.toBe('49,50');
    expect(s.fateLand?.thread).toBeDefined();
    expect(s.freeRituals).toHaveLength(1);
    const fulfilled = fateEntries(s).find(e => e.meta?.fate === 'fulfilled');
    expect(fulfilled?.meta?.ritualsAwarded).toEqual(s.freeRituals);
    expect(fateEntries(s).at(-1)?.meta?.fate).toBe('thread');
    expect(persists(s).ok).toBe(true);
  });
});

describe("Fate's omens", () => {
  // The seeded draw decides each chunk's mark; find a seed that gives each one.
  const markedRun = (mark: string): Run => {
    for (let i = 0; i < 2000; i++) {
      const s = spend(tied('62,40', { rngSeed: `mark-${i}`, fatePoints: 10 }), '49,50');
      if (s.fateLand?.marks['49,50'] === mark) return s;
    }
    throw new Error(`no seed marks 49,50 ${mark}`);
  };

  it('draws one of the eight omens on every chunk, each about as often as the others', () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 800; i++) {
      const s = spend(tied('62,40', { rngSeed: `rate-${i}` }), '49,50');
      const mark = s.fateLand?.marks['49,50'];
      expect(mark).toBeDefined();
      counts.set(mark!, (counts.get(mark!) ?? 0) + 1);
      const entry = fateEntries(s).find(e => e.meta?.fate === 'mark');
      expect(entry?.meta?.omen).toBe(['CURSED', 'WITHERED', 'CLOUDED', 'TANGLED'].includes(mark!) ? 'bane' : 'boon');
    }
    expect([...counts.keys()].sort()).toEqual([...FATE_MARKS].sort());
    for (const n of counts.values()) {
      expect(n).toBeGreaterThan(60);
      expect(n).toBeLessThan(140);
    }
  });

  it('Blessed gives 10 Fate up to the pity line and the audit follows it', () => {
    const s = markedRun('BLESSED');
    expect(s.fatePoints).toBe(10 + FATE_MARK_BLESSED_FATE);
    const entry = fateEntries(s).find(e => e.meta?.mark === 'BLESSED');
    expect(entry?.meta?.fatePointsAfter).toBe(s.fatePoints);
    expect(replayInvariants(s.history, initialState.keys).final.fatePoints).toBe(s.fatePoints);
    const full = withFateLand(tied('62,40', { fatePoints: 45 }), { ...markedRun('BLESSED'), fatePoints: 45 }, 0, () => 'x', 1e9);
    expect(full.fatePoints).toBeLessThanOrEqual(50);
  });

  it('Gilded waits as a free roll that is used up once', () => {
    expect(DROP_RATES[DropSource.FATE_MARK]).toBe(DROP_RATES[DropSource.CHUNK_EXPLORE]);
    const s = markedRun('GILDED');
    expect(s.fateLand?.gilded).toEqual(['49,50']);
    const rolled = gameReducer(s, { type: 'FATE_MARK_ROLL', payload: { chunk: '49,50' } });
    expect(rolled.fateLand?.gilded).toEqual([]);
    expect(rolled.fateLand?.marks['49,50']).toBe('GILDED');
    expect(gameReducer(rolled, { type: 'FATE_MARK_ROLL', payload: { chunk: '49,50' } })).toBe(rolled);
    expect(persists(s).ok).toBe(true);
  });

  it('Chaotic records the Chaos Key it gives, if any', () => {
    const s = markedRun('CHAOTIC');
    const entry = fateEntries(s).find(e => e.meta?.mark === 'CHAOTIC');
    expect(s.chaosKeys).toBe(entry?.meta?.chaosKeysAwarded);
    expect(replayInvariants(s.history, initialState.keys).final.chaosKeys).toBe(s.chaosKeys);
  });

  it('Cursed makes the next 3 Key rolls worse and doubles the Fate of their fails', () => {
    const s = markedRun('CURSED');
    expect(s.rituals?.cursedRollsLeft).toBe(FATE_MARK_CURSED_ROLLS);
    expect(rollRitualPlan(s.rituals, 0).oddsBonus).toBe(-FATE_MARK_CURSED_ODDS);
    expect(failFate(s.rituals, 2, 0, true, 50).earned).toBe(4);
    let r = s.rituals;
    for (let i = 0; i < FATE_MARK_CURSED_ROLLS; i++) r = afterRoll(r, { success: false, debtPaid: 0 });
    expect(r?.cursedRollsLeft).toBeUndefined();
    expect(persists(s).ok).toBe(true);
  });

  it('Fortunate makes the next 3 Key rolls better', () => {
    const s = markedRun('FORTUNATE');
    expect(s.rituals?.fortunateRollsLeft).toBe(FATE_MARK_FORTUNATE_ROLLS);
    expect(rollRitualPlan(s.rituals, 0).oddsBonus).toBe(FATE_MARK_FORTUNATE_ODDS);
    let r = s.rituals;
    for (let i = 0; i < FATE_MARK_FORTUNATE_ROLLS; i++) r = afterRoll(r, { success: false, debtPaid: 0 });
    expect(r?.fortunateRollsLeft).toBeUndefined();
    expect(persists(s).ok).toBe(true);
  });

  it('Withered takes 10 Fate, never below zero, and the audit follows it', () => {
    const s = markedRun('WITHERED');
    expect(s.fatePoints).toBe(10 - FATE_MARK_WITHERED_FATE);
    expect(fateEntries(s).find(e => e.meta?.mark === 'WITHERED')?.meta?.fatePointsAfter).toBe(s.fatePoints);
    expect(replayInvariants(s.history, initialState.keys).final.fatePoints).toBe(s.fatePoints);
    const broke = withFateLand(tied('62,40', { fatePoints: 3 }), { ...markedRun('WITHERED'), fatePoints: 3 }, 0, () => 'x', 1e9);
    expect(broke.fatePoints).toBe(0);
  });

  it('Clouded leaves the next 3 failed Key rolls without Fate', () => {
    const s = markedRun('CLOUDED');
    expect(s.rituals?.cloudedRollsLeft).toBe(FATE_MARK_CLOUDED_ROLLS);
    expect(failFate(s.rituals, 2, 0, true, 50).earned).toBe(0);
    let r = s.rituals;
    for (let i = 0; i < FATE_MARK_CLOUDED_ROLLS; i++) r = afterRoll(r, { success: false, debtPaid: 0 });
    expect(failFate(r, 2, 0, true, 50).earned).toBe(2);
    expect(persists(s).ok).toBe(true);
  });

  it('Tangled spares the next chunk from the thread, then clears', () => {
    const s = markedRun('TANGLED');
    expect(s.fateLand?.tangled).toBe(true);
    expect(persists(s).ok).toBe(true);
    const next = spend(s, frontier(['49,50']).find(key => key !== '62,40' && !s.unlocks.chunks.includes(key))!);
    if (next.fateLand?.marks && Object.values(next.fateLand.marks).length > 1) {
      const newest = Object.keys(next.fateLand.marks).find(key => key !== '49,50')!;
      expect(next.fateLand.tangled === true).toBe(next.fateLand.marks[newest] === 'TANGLED');
    }
  });

  it('refuses a save with a Gilded roll on an unmarked chunk', () => {
    const s = tied('62,40', { fateLand: { thread: '62,40', fulfilled: 0, marks: {}, gilded: ['49,50'] } });
    expect(persists(s).ok).toBe(false);
  });
});
