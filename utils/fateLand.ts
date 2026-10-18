/**
 * Chunked's own fate (Alex picked these on 18 October 2026): Fate's Thread and
 * fate's marks. Fate ties a thread to a place a few chunks past the run's
 * border, on a boss, minigame, guild or bank chunk where it can; one Chunks
 * draw in six goes to the frontier chunks nearest the thread, the rest to the
 * whole frontier. When the run gains the place, fate is
 * fulfilled: a free ritual fate picks, and a new thread. Every chunk the run
 * gains may also be marked by fate: Blessed, Gilded, Chaotic or Cursed.
 *
 * gameReducer runs withFateLand after every action, so every way a chunk is
 * gained (a Chunks Key, a Chaos Key, Fate's Mercy, the Cartographer) counts.
 * Every draw is seeded from the run's history, like every other fate roll.
 */
import type { FateLand, FateMark, GameState, LogEntry } from '../types';
import { CHUNKED_START_KEY, chunkKey, getChunkFrontier, parseChunkKey } from './chunkAdjacency';
import { chunkLabelWithCoords } from './chunkLabelWithCoords';
import { drawFloat, seededContext } from './seededRng';
import { pickFreeRitual, ritualName, achievementFateCap } from './achievementRewards';
import { FATE_MARK_CHANCE, FATE_MARK_BLESSED_FATE, FATE_MARK_CHAOS_CHANCE, FATE_MARK_CURSED_ROLLS, FATE_THREAD_LEAN_CHANCE, FATE_THREAD_MIN_STEPS, FATE_THREAD_MAX_STEPS } from '../config/economy';
import { ACTIVITY_CHUNKS } from '../data/activityChunks';
import { BANK_BY_ID } from '../data/banks';
import { bankChunkKey } from './activityAccess';

export type { FateLand, FateMark };
export const FATE_MARKS: readonly FateMark[] = ['BLESSED', 'GILDED', 'CHAOTIC', 'CURSED'];
export const FATE_MARK_NAMES: Record<FateMark, string> = { BLESSED: 'Blessed', GILDED: 'Gilded', CHAOTIC: 'Chaotic', CURSED: 'Cursed' };

type FateLandRun = Pick<GameState, 'gameModeId' | 'unlocks' | 'history' | 'fatePoints' | 'chaosKeys' | 'freeRituals' | 'rituals' | 'customMode'>
  & Partial<Pick<GameState, 'rngSeed' | 'rngVersion' | 'runId' | 'fateLand'>>;

const EMPTY: FateLand = { fulfilled: 0, marks: {}, gilded: [] };

/** Places fate ties its thread to: chunks a boss, minigame or guild is entered from, and bank chunks. */
let places: ReadonlySet<string> | null = null;
const threadPlaces = (): ReadonlySet<string> => (places ??= new Set([
  ...Object.values(ACTIVITY_CHUNKS).flat(),
  ...Object.keys(BANK_BY_ID).map(bankChunkKey).filter((key): key is string => key !== undefined),
]));

/** The chunks a Chunked run holds, its free start chunk included. */
const held = (run: Pick<GameState, 'unlocks'>): string[] => {
  const chunks = run.unlocks.chunks ?? [];
  return chunks.includes(CHUNKED_START_KEY) ? [...chunks] : [CHUNKED_START_KEY, ...chunks];
};

/**
 * The places fate may tie a thread to: chunks between FATE_THREAD_MIN_STEPS
 * and FATE_THREAD_MAX_STEPS frontiers past the run's land, walked by the same
 * rules as the frontier itself, so the run can always reach them: the boss,
 * minigame, guild and bank chunks among them, or every one when none is.
 * When the map is nearly full, the farthest chunks still unheld stand in.
 */
export const threadCandidates = (owned: readonly string[], account: GameState['unlocks']): string[] => {
  const seen = new Set(owned);
  const layers: string[][] = [];
  for (let step = 1; step <= FATE_THREAD_MAX_STEPS; step++) {
    const layer = getChunkFrontier([...seen], account).map(chunkKey).filter(key => !seen.has(key));
    if (layer.length === 0) break;
    layers.push(layer);
    for (const key of layer) seen.add(key);
  }
  const wanted = layers.slice(FATE_THREAD_MIN_STEPS - 1).flat();
  const placed = wanted.filter(key => threadPlaces().has(key));
  const chosen = placed.length > 0 ? placed : wanted.length > 0 ? wanted : layers[layers.length - 1] ?? [];
  return chosen.slice().sort();
};

/** Grid steps between two chunks. */
const stepsBetween = (a: string, b: string): number => {
  const p = parseChunkKey(a);
  const q = parseChunkKey(b);
  return Math.abs(p.cx - q.cx) + Math.abs(p.cy - q.cy);
};

/**
 * A Chunks Key's pool with fate leaning toward its thread: when the seeded
 * `roll` falls under FATE_THREAD_LEAN_CHANCE, only the candidates nearest the
 * thread; otherwise, and for runs with no thread, the pool as it is.
 */
export const leanTowardThread = <T extends { item: string }>(pool: readonly T[], thread: string | undefined, roll: number): T[] => {
  if (!thread || pool.length === 0 || roll >= FATE_THREAD_LEAN_CHANCE) return [...pool];
  const nearest = Math.min(...pool.map(c => stepsBetween(c.item, thread)));
  return pool.filter(c => stepsBetween(c.item, thread) === nearest);
};

/** The frontier chunks fate leans toward: the ones nearest the thread. */
export const threadLeaning = (frontier: readonly string[], thread: string | undefined): string[] => {
  if (!thread || frontier.length === 0) return [];
  const nearest = Math.min(...frontier.map(key => stepsBetween(key, thread)));
  return frontier.filter(key => stepsBetween(key, thread) === nearest);
};

const entry = (newId: () => string, now: number, message: string, details: string, meta: Record<string, unknown>): LogEntry =>
  ({ id: newId(), timestamp: now, type: 'FATE', message, details, meta });

/**
 * The run after fate has had its say on the chunks it just gained: marks,
 * a fulfilled thread, and a thread tied where there is none. Returns `next`
 * untouched outside Chunked, or when there's nothing for fate to do.
 */
export const withFateLand = <S extends FateLandRun>(prev: FateLandRun, next: S, now: number, newId: () => string, maxCounter: number): S => {
  if (next.gameModeId !== 'chunked') return next;
  const before = new Set(held(prev));
  const gained = held(next).filter(key => !before.has(key));
  const land = next.fateLand ?? EMPTY;
  // A thread is tied on the run's first action under these rules, and again
  // once the run holds its place. A run with nowhere to tie one waits for its
  // next chunk rather than searching the map on every action.
  const needsThread = !next.fateLand || (land.thread !== undefined && before.has(land.thread));
  if (gained.length === 0 && !needsThread) return next;

  const seed = next.rngSeed ?? next.runId ?? 'unseeded';
  const context = seededContext(prev);
  const draw = (purpose: string) => drawFloat(seed, context, purpose);
  const fateCap = achievementFateCap(next, maxCounter);
  let fatePoints = next.fatePoints;
  let chaosKeys = next.chaosKeys;
  let rituals = next.rituals;
  let freeRituals = next.freeRituals;
  const marks = { ...land.marks };
  const gilded = [...land.gilded];
  let fulfilled = land.fulfilled;
  let thread = land.thread;
  const entries: LogEntry[] = [];

  for (const key of gained) {
    const label = chunkLabelWithCoords(key);
    if (key === thread) {
      fulfilled += 1;
      const ritual = pickFreeRitual(next.gameModeId, draw(`fate-thread-ritual:${key}`));
      const room = (freeRituals?.length ?? 0) < maxCounter;
      if (room) freeRituals = [...(freeRituals ?? []), ritual];
      entries.push(entry(newId, now, `Fate is fulfilled: ${label}`,
        room ? `Fate's Thread led here. Fate grants you a free ${ritualName(ritual)}.` : "Fate's Thread led here.",
        { fate: 'fulfilled', chunk: key, ...(room ? { ritualsAwarded: [ritual] } : {}) }));
      thread = undefined;
    }
    if (draw(`fate-mark:${key}`) >= FATE_MARK_CHANCE) continue;
    const mark = FATE_MARKS[Math.min(FATE_MARKS.length - 1, Math.floor(draw(`fate-mark-kind:${key}`) * FATE_MARKS.length))];
    marks[key] = mark;
    if (mark === 'BLESSED') {
      const after = Math.max(fatePoints, Math.min(fateCap, fatePoints + FATE_MARK_BLESSED_FATE));
      const gainedFate = after - fatePoints;
      fatePoints = after;
      entries.push(entry(newId, now, `Fate has marked ${label}: Blessed`,
        gainedFate > 0 ? `You gain ${gainedFate} Fate.` : 'Your Fate is already full to the pity line.',
        { fate: 'mark', mark, chunk: key, fatePointsAfter: fatePoints }));
    } else if (mark === 'GILDED') {
      gilded.push(key);
      entries.push(entry(newId, now, `Fate has marked ${label}: Gilded`, 'A free Key roll waits on the Keys screen.', { fate: 'mark', mark, chunk: key }));
    } else if (mark === 'CHAOTIC') {
      const won = draw(`fate-mark-chaos:${key}`) < FATE_MARK_CHAOS_CHANCE && chaosKeys < maxCounter;
      if (won) chaosKeys += 1;
      entries.push(entry(newId, now, `Fate has marked ${label}: Chaotic`,
        won ? 'Fate gives you a Chaos Key.' : 'No Chaos Key this time.',
        { fate: 'mark', mark, chunk: key, chaosKeysAwarded: won ? 1 : 0 }));
    } else {
      rituals = { ...rituals, cursedRollsLeft: FATE_MARK_CURSED_ROLLS };
      entries.push(entry(newId, now, `Fate has marked ${label}: Cursed`,
        `Your next ${FATE_MARK_CURSED_ROLLS} Key rolls are 5% worse, but each fail among them gives double Fate.`,
        { fate: 'mark', mark, chunk: key }));
    }
  }

  const owned = held({ unlocks: next.unlocks });
  if (!thread || owned.includes(thread)) {
    const candidates = threadCandidates(owned, next.unlocks);
    thread = candidates.length > 0
      ? candidates[Math.min(candidates.length - 1, Math.floor(draw('fate-thread') * candidates.length))]
      : undefined;
    if (thread) {
      entries.push(entry(newId, now, `Fate has tied a thread to ${chunkLabelWithCoords(thread)}`,
        'One Chunks draw in six goes to the frontier chunks nearest it; the rest draw from your whole frontier.',
        { fate: 'thread', chunk: thread }));
    }
  }

  const fateLand: FateLand = { ...(thread ? { thread } : {}), fulfilled, marks, gilded };
  return {
    ...next,
    fatePoints,
    chaosKeys,
    ...(rituals !== next.rituals ? { rituals } : {}),
    ...(freeRituals !== next.freeRituals ? { freeRituals } : {}),
    fateLand,
    history: entries.length > 0 ? [...next.history, ...entries] : next.history,
  };
};
