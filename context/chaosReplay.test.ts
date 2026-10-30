import { beforeAll, expect, it } from 'vitest';
import { createFreshState, gameReducer } from './GameContext';
import { pickRandomPoolEntry, pickRandomUnlock, randomUnlockPool, type RandomUnlockCandidate } from '../utils/gameEngine';
import { CURRENT_RNG_VERSION, chaosPicksTableFirst, drawFloat, seededContext } from '../utils/seededRng';
import { setStartArea } from '../utils/freeAreas';
import { resolveModeRules } from '../config/gameModes';
import { loadWalkSections } from '../utils/walkSections';
import { loadRunRoutes } from '../utils/chunkEntry';

/*
 * Seeded replay of Chaos Key spends, step by step through the reducer: the
 * pool, pick and seeded draw GameContext.rollUnlock uses. Chunked frontiers
 * read map data the app loads in the background, so it is loaded first.
 */
beforeAll(async () => { await loadWalkSections(); await loadRunRoutes(); });

const SEED = 'OLD-CHAOS-SEED';
type Picker = (pool: readonly RandomUnlockCandidate[], state: ReturnType<typeof gameReducer>, draw: (purpose: string, index?: number) => number) => RandomUnlockCandidate | undefined;
/** What the app does today. */
const app: Picker = (pool, state, draw) => pickRandomUnlock(pool, 'chaosKey', chaosPicksTableFirst(state), draw);
/** What the app did before Chaos Keys picked a table first: one draw over every entry. */
const before: Picker = (pool, _state, draw) => pickRandomPoolEntry(pool, () => draw('chaos'));

const replay = (mode: string, rngVersion: 1 | 2 | 3 | undefined, pick: Picker, count = 4) => {
  setStartArea(resolveModeRules(mode).startArea);
  let state: ReturnType<typeof gameReducer> = { ...createFreshState(), lastEvent: null, gameModeId: mode, gameModeLocked: true, chaosKeys: count, rngSeed: SEED, rngVersion };
  const drawn: string[] = [];
  for (let i = 0; i < count; i++) {
    const pool = randomUnlockPool(state.unlocks, mode, 'chaosKey');
    const context = seededContext(state);
    const picked = pick(pool, state, (purpose, index = 0) => drawFloat(SEED, context, purpose, index))!;
    drawn.push(`${picked.table}: ${picked.item}`);
    state = gameReducer(state, { type: 'UNLOCK', payload: { ...picked, costType: 'chaosKey', cost: 1, revealId: `reveal-${i}` } });
    state = gameReducer(state, { type: 'ACKNOWLEDGE_UNLOCK', payload: state.pendingUnlock!.id });
  }
  return drawn;
};

// Recorded with the same replay and the old one-draw pick. Vanilla's pool
// includes bosses and minigames you can't reach yet (Keys roll anything left).
// Re-recorded when Hitpoints became free and left the Skills pool (30 October 2026).
const OLD = {
  vanilla: ['Bosses: Kalphite Queen', 'Regions: Poison Waste', 'Banks: 6968', 'Skills: Strength'],
  chunked: ['Merchants: Halberd Shops', 'Mobility: Minigame Teleports', 'Slayer Unlocks: Task Storage', 'Arcana: Preserve'],
};

it('replays an old seeded save (rngVersion 2) exactly as before', () => {
  for (const mode of ['vanilla', 'chunked'] as const) expect(replay(mode, 2, app)).toEqual(OLD[mode]);
});

it.each([1, undefined] as const)('keeps the old one-draw Chaos pick at every spend of a legacy seeded save (rngVersion %s)', version => {
  // Version 1 contexts hash random log IDs, so compare both picks at each spend of one run.
  const same: Picker = (pool, state, draw) => {
    const picked = app(pool, state, draw);
    expect(picked).toEqual(before(pool, state, draw));
    return picked;
  };
  for (const mode of ['vanilla', 'chunked']) expect(replay(mode, version, same)[0]).toBe(OLD[mode as keyof typeof OLD][0]);
});

it('picks a table first on a run seeded now', () => {
  expect(CURRENT_RNG_VERSION).toBe(3);
  // Pinned so a later change to the draw shows up here, and gets its own rngVersion.
  expect(replay('vanilla', CURRENT_RNG_VERSION, app)).toEqual(['Bosses: Obor', 'Slayer Unlocks: Reptile Freezer', 'Storage: Herb Sack', "Housing: Mounted Xeric's Talisman"]);
  expect(replay('chunked', CURRENT_RNG_VERSION, app)).toEqual(['Minigames: Forestry', "Storage: Dizana's Quiver", 'Housing: Restoration Pools', 'Mobility: Mine Carts']);
  for (const mode of ['vanilla', 'chunked']) expect(replay(mode, CURRENT_RNG_VERSION, app)).not.toEqual(replay(mode, CURRENT_RNG_VERSION, before));
});
