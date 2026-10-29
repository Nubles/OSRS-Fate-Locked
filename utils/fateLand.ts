/**
 * Chunked's own fate (Alex picked these on 18 October 2026): Fate's Thread and
 * fate's marks. Fate ties a thread to a place a few chunks past the run's
 * border, on a boss, minigame, guild or bank chunk where it can; one Chunks
 * draw in six goes to the frontier chunks nearest the thread, the rest to the
 * whole frontier. When the run gains the place, fate is
 * fulfilled: a free ritual fate picks, and a new thread. Every chunk the run
 * gains draws one of fate's eight omens at even odds: a boon (Blessed, Gilded,
 * Fortunate, Chaotic) or a bane (Cursed, Withered, Clouded, Tangled).
 *
 * Fated sites and region seals (Alex picked these on 22 October 2026): when a
 * run starts, fate hides FATE_SITE_COUNT sites in the fog (a Shrine, Hoard,
 * Rift or Waystone each). Gaining a site's chunk sets off the site instead of
 * an omen. The first chunk the run gains in each region breaks that region's
 * seal, and its omen is always a boon at FATE_SEAL_BOON_FACTOR times the
 * strength. Runs from before this rule get their sites on their next action,
 * and the regions they already hold count as unsealed.
 *
 * gameReducer runs withFateLand after every action, so every way a chunk is
 * gained (a Chunks Key, a Chaos Key, Fate's Mercy, the Cartographer) counts.
 * Every draw is seeded from the run's history, like every other fate roll.
 */
import { TableType, type FateLand, type FateMark, type FateSite, type GameState, type LogEntry } from '../types';
import { ALL_CHUNK_KEYS, CHUNKED_START_KEY, chunkKey, chunkRegion, getChunkFrontier, parseChunkKey } from './chunkAdjacency';
import { chunkLabelWithCoords } from './chunkLabelWithCoords';
import { FATE_MARK_EFFECTS, MARK_NAME, SEAL_BOON_EFFECTS, SITE_EFFECTS, SITE_NAME, isBaneMark } from './fateMap';
import { drawFloat, seededContext } from './seededRng';
import { pickFreeRitual, ritualName, achievementFateCap } from './achievementRewards';
import {
  FATE_MARK_BLESSED_FATE, FATE_MARK_CHAOS_CHANCE, FATE_MARK_CLOUDED_ROLLS, FATE_MARK_CURSED_ROLLS,
  FATE_MARK_FORTUNATE_ROLLS, FATE_MARK_WITHERED_FATE, FATE_SEAL_BOON_FACTOR, FATE_SITE_COUNT, FATE_THREAD_LEAN_CHANCE,
  FATE_THREAD_MIN_STEPS, FATE_THREAD_MAX_STEPS, FATE_WAYSTONE_DRAWS,
} from '../config/economy';
import { ACTIVITY_CHUNKS } from '../data/activityChunks';
import { BANK_BY_ID } from '../data/banks';
import { bankChunkKey } from './activityAccess';

export type { FateLand, FateMark };
/** Fate's omens in draw order: the four boons, then the four banes. */
export const FATE_MARKS: readonly FateMark[] = ['BLESSED', 'GILDED', 'FORTUNATE', 'CHAOTIC', 'CURSED', 'WITHERED', 'CLOUDED', 'TANGLED'];
export { MARK_NAME as FATE_MARK_NAMES } from './fateMap';
/** Fated sites in draw order. */
export const FATE_SITES: readonly FateSite[] = ['SHRINE', 'HOARD', 'RIFT', 'WAYSTONE'];
const BOONS: readonly FateMark[] = ['BLESSED', 'GILDED', 'FORTUNATE', 'CHAOTIC'];


type FateLandRun = Pick<GameState, 'gameModeId' | 'unlocks' | 'history' | 'fatePoints' | 'chaosKeys' | 'freeRituals' | 'rituals' | 'customMode'>
  & Partial<Pick<GameState, 'rngSeed' | 'rngVersion' | 'runId' | 'fateLand' | 'pendingUnlock'>>;

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

/**
 * Where fate hides a run's sites: FATE_SITE_COUNT land chunks the run doesn't
 * hold, each with a site kind, all drawn from the run's seed.
 */
export const placeSites = (owned: ReadonlySet<string>, draw: (purpose: string) => number): Record<string, FateSite> => {
  const pool = ALL_CHUNK_KEYS.filter(key => !owned.has(key)).sort();
  const sites: Record<string, FateSite> = {};
  for (let i = 0; i < FATE_SITE_COUNT && pool.length > 0; i++) {
    const [key] = pool.splice(Math.min(pool.length - 1, Math.floor(draw(`fate-site:${i}`) * pool.length)), 1);
    sites[key] = FATE_SITES[Math.min(FATE_SITES.length - 1, Math.floor(draw(`fate-site-kind:${i}`) * FATE_SITES.length))];
  }
  return sites;
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
  if (gained.length === 0 && !needsThread && land.sites && land.seals) return next;

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
  // A Tangled chunk spares only the next chunk from the thread's pull.
  let tangled = gained.length > 0 ? false : land.tangled === true;
  let fulfilled = land.fulfilled;
  let thread = land.thread;
  const entries: LogEntry[] = [];
  // Sites are hidden once, away from the land the run holds now; a run's
  // regions held before seals existed count as unsealed.
  const sites = land.sites ?? placeSites(new Set(held(next)), draw);
  const seals: Record<string, string> = land.seals ? { ...land.seals } : {};
  if (!land.seals) {
    for (const key of before) {
      const region = chunkRegion(key);
      if (region) seals[region] = '';
    }
  }
  // A Waystone's pull is spent by each Chunks Key draw.
  const pending = next.pendingUnlock;
  const keyDraw = pending !== undefined && pending !== prev.pendingUnlock && pending.table === TableType.CHUNKS && pending.costType === 'key';
  let pull = Math.max(0, (land.pull ?? 0) - (keyDraw && !land.tangled ? 1 : 0));
  // A Rift's chunk joins the queue, so fate has its say on it too.
  const queue = [...gained];
  const rifted: string[] = [];

  for (let i = 0; i < queue.length; i++) {
    const key = queue[i];
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
    const region = chunkRegion(key);
    const unsealed = region !== undefined && !(region in seals);
    if (unsealed) {
      seals[region] = key;
      entries.push(entry(newId, now, `The seal of ${region} breaks`,
        `${label} is your first chunk in ${region}. Fate's omen here is a boon, ${FATE_SEAL_BOON_FACTOR} times as strong.`,
        { fate: 'seal', region, chunk: key }));
    }
    const site = sites[key];
    if (site) {
      const title = `Fated site: ${SITE_NAME[site]} at ${label}`;
      const meta = { fate: 'site', site, chunk: key };
      if (site === 'SHRINE') {
        const ritual = pickFreeRitual(next.gameModeId, draw(`fate-site-ritual:${key}`));
        const room = (freeRituals?.length ?? 0) < maxCounter;
        if (room) freeRituals = [...(freeRituals ?? []), ritual];
        entries.push(entry(newId, now, title, room ? `Fate grants you a free ${ritualName(ritual)}.` : 'You hold all the free rituals you can.',
          { ...meta, ...(room ? { ritualsAwarded: [ritual] } : {}) }));
      } else if (site === 'HOARD') {
        const room = chaosKeys < maxCounter;
        if (room) chaosKeys += 1;
        entries.push(entry(newId, now, title, room ? SITE_EFFECTS.HOARD : 'You hold all the Chaos Keys you can.',
          { ...meta, chaosKeysAwarded: room ? 1 : 0 }));
      } else if (site === 'RIFT') {
        const chunks = [...(next.unlocks.chunks ?? []), ...rifted];
        const frontier = getChunkFrontier(chunks, next.unlocks).map(chunkKey).filter(k => !queue.includes(k));
        const pick = frontier.length > 0 ? frontier[Math.min(frontier.length - 1, Math.floor(draw(`fate-rift:${key}`) * frontier.length))] : undefined;
        entries.push(entry(newId, now, title, pick ? `Fate draws a second chunk: ${chunkLabelWithCoords(pick)}.` : 'There is no land left for fate to draw.', meta));
        if (pick) {
          rifted.push(pick);
          queue.push(pick);
          entries.push({
            id: newId(), timestamp: now, type: 'UNLOCK', message: `Unlocked ${chunkLabelWithCoords(pick)} · Rift`,
            details: 'A Rift: fate drew a second chunk. Nothing was spent.',
            meta: { item: pick, category: TableType.CHUNKS, cost: 0, costType: 'rift' },
          });
        }
      } else {
        pull = FATE_WAYSTONE_DRAWS;
        entries.push(entry(newId, now, title, SITE_EFFECTS.WAYSTONE, meta));
      }
      // A site chunk shows its site instead of an omen, unless it also breaks a seal.
      if (!unsealed) continue;
    }
    const mark = unsealed
      ? BOONS[Math.min(BOONS.length - 1, Math.floor(draw(`fate-seal-boon:${key}`) * BOONS.length))]
      : FATE_MARKS[Math.min(FATE_MARKS.length - 1, Math.floor(draw(`fate-mark-kind:${key}`) * FATE_MARKS.length))];
    const times = unsealed ? FATE_SEAL_BOON_FACTOR : 1;
    marks[key] = mark;
    const title = `Fate has marked ${label}: ${MARK_NAME[mark]}${unsealed ? ', doubled' : ''}`;
    const meta = { fate: 'mark', mark, chunk: key, omen: isBaneMark(mark) ? 'bane' : 'boon', ...(unsealed ? { sealed: true } : {}) };
    if (mark === 'BLESSED') {
      const after = Math.max(fatePoints, Math.min(fateCap, fatePoints + FATE_MARK_BLESSED_FATE * times));
      const gainedFate = after - fatePoints;
      fatePoints = after;
      entries.push(entry(newId, now, title,
        gainedFate > 0 ? `You gain ${gainedFate} Fate.` : 'Your Fate is already full to the pity line.',
        { ...meta, fatePointsAfter: fatePoints }));
    } else if (mark === 'WITHERED') {
      const lost = Math.min(Math.max(0, fatePoints), FATE_MARK_WITHERED_FATE);
      fatePoints -= lost;
      entries.push(entry(newId, now, title, lost > 0 ? `You lose ${lost} Fate.` : 'You have no Fate for it to take.',
        { ...meta, fatePointsAfter: fatePoints }));
    } else if (mark === 'CHAOTIC') {
      const won = draw(`fate-mark-chaos:${key}`) < FATE_MARK_CHAOS_CHANCE * times && chaosKeys < maxCounter;
      if (won) chaosKeys += 1;
      entries.push(entry(newId, now, title, won ? 'Fate gives you a Chaos Key.' : 'No Chaos Key this time.',
        { ...meta, chaosKeysAwarded: won ? 1 : 0 }));
    } else {
      if (mark === 'GILDED') for (let n = 0; n < times; n++) gilded.push(key);
      if (mark === 'FORTUNATE') rituals = { ...rituals, fortunateRollsLeft: Math.max(rituals?.fortunateRollsLeft ?? 0, FATE_MARK_FORTUNATE_ROLLS * times) };
      if (mark === 'CURSED') rituals = { ...rituals, cursedRollsLeft: FATE_MARK_CURSED_ROLLS };
      if (mark === 'CLOUDED') rituals = { ...rituals, cloudedRollsLeft: FATE_MARK_CLOUDED_ROLLS };
      if (mark === 'TANGLED') tangled = true;
      entries.push(entry(newId, now, title, unsealed ? SEAL_BOON_EFFECTS[mark] ?? FATE_MARK_EFFECTS[mark]
        : mark === 'GILDED' ? 'A free Key roll waits on the Keys screen.' : FATE_MARK_EFFECTS[mark], meta));
    }
  }

  const unlocks = rifted.length > 0 ? { ...next.unlocks, chunks: [...(next.unlocks.chunks ?? []), ...rifted] } : next.unlocks;
  const owned = held({ unlocks });
  if (!thread || owned.includes(thread)) {
    const candidates = threadCandidates(owned, unlocks);
    thread = candidates.length > 0
      ? candidates[Math.min(candidates.length - 1, Math.floor(draw('fate-thread') * candidates.length))]
      : undefined;
    if (thread) {
      entries.push(entry(newId, now, `Fate has tied a thread to ${chunkLabelWithCoords(thread)}`,
        'One Chunks draw in six goes to the frontier chunks nearest it; the rest draw from your whole frontier.',
        { fate: 'thread', chunk: thread }));
    }
  }

  const fateLand: FateLand = {
    ...(thread ? { thread } : {}), fulfilled, marks, gilded, ...(tangled ? { tangled: true } : {}), sites, seals, ...(pull > 0 ? { pull } : {}),
  };
  return {
    ...next,
    ...(unlocks !== next.unlocks ? { unlocks } : {}),
    fatePoints,
    chaosKeys,
    ...(rituals !== next.rituals ? { rituals } : {}),
    ...(freeRituals !== next.freeRituals ? { freeRituals } : {}),
    fateLand,
    history: entries.length > 0 ? [...next.history, ...entries] : next.history,
  };
};
