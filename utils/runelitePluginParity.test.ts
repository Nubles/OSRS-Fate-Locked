/**
 * Pins the web app ↔ RuneLite plugin lock-semantics contract.
 *
 * The plugin (FateLockedBundle.java) re-implements the app's unlock
 * resolution from the exported bundle. This suite simulates the plugin's
 * exact resolution in TS, feeds it the REAL bundle built by
 * buildRuneliteBundle, and asserts it agrees with the app's own canonical
 * checks (isRegionUnlocked / isChunkUnlocked / isBankReachable) for every
 * named area, across game-mode baselines. If either side's rules drift,
 * this fails in CI before a player sees wrong locks in-game.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { buildRuneliteBundle } from './runeliteBundle';
import { isRegionUnlocked, isBankReachable, isNamedAreaReachableViaChunks } from './reachability';
import { setStartArea } from './freeAreas';
import { isChunkUnlocked, chunkKey, CHUNKED_START_KEY } from './chunkAdjacency';
import { SUB_AREA_CHUNKS } from '../data/subAreaChunks';
import { REGION_CHUNKS } from '../data/regionChunks';
import { BANKS, bankId } from '../data/banks';
import type { UnlockState } from '../types';

afterEach(() => setStartArea('misthalin'));

type Bundle = Awaited<ReturnType<typeof buildRuneliteBundle>>;

/** TS port of FateLockedBundle.java's unlock resolution — keep in lockstep. */
function pluginSim(bundle: Bundle & { unlockedChunks?: string[]; freeAreas?: string[]; bankLocks?: boolean; unlockedBanks?: string[] }) {
  const regionGroups: Record<string, string[]> = bundle.regionGroups;
  const unlocked = new Set(bundle.unlockedRegions);
  const chunked = bundle.unlockedChunks !== undefined;
  const chunkedSet = new Set([CHUNKED_START_KEY, ...(bundle.unlockedChunks ?? [])]);

  // alwaysUnlocked: freeAreas when present, else the legacy Misthalin fallback.
  const always = new Set(
    bundle.freeAreas ?? ['Misthalin', ...(regionGroups['Misthalin'] ?? [])],
  );

  const parentOf: Record<string, string> = {};
  for (const [continent, subs] of Object.entries(regionGroups)) {
    for (const s of subs) parentOf[s] = continent;
  }

  const unlockedOrFree = (n: string) => unlocked.has(n) || always.has(n);

  const isUnlocked = (name: string): boolean => {
    if (chunked) {
      const chunks = (bundle.subAreaChunks as Record<string, { cx: number; cy: number }[]>)[name]
        ?? (bundle.chunks as Record<string, { cx: number; cy: number }[]>)[name];
      if (!chunks || chunks.length === 0) return false;
      return chunks.some((c) => chunkedSet.has(chunkKey(c)));
    }
    if (always.has(name)) return true;
    if (unlocked.has(name)) return true;
    const parent = parentOf[name];
    if (parent) {
      if (always.has(parent) || unlocked.has(parent)) return true;
      const siblings = regionGroups[parent] ?? [];
      if (siblings.length > 0 && siblings.every(unlockedOrFree)) return true;
    }
    const children = regionGroups[name];
    if (children && children.length > 0 && children.every(unlockedOrFree)) return true;
    return false;
  };

  const isBankUnlocked = (cx: number, cy: number): boolean => {
    if (!bundle.bankLocks) return true;
    return (bundle.unlockedBanks ?? []).includes(String(cx * 256 + cy));
  };

  return { isUnlocked, isBankUnlocked };
}

const ALL_AREA_NAMES = [
  ...new Set([...Object.keys(SUB_AREA_CHUNKS), ...Object.keys(REGION_CHUNKS)]),
];

const state = {
  keys: 0, specialKeys: 0, chaosKeys: 0, fatePoints: 0,
  activeBuff: 'NONE', pinnedGoals: [] as string[],
};

describe('web ↔ RuneLite plugin lock parity', () => {
  it('agrees on every named area — default Misthalin start', async () => {
    setStartArea('misthalin');
    const unlocks = ['Falador', 'Port Sarim', 'Catherby'];
    const bundle = await buildRuneliteBundle(unlocks, state);
    const sim = pluginSim(bundle);
    for (const name of ALL_AREA_NAMES) {
      expect(sim.isUnlocked(name), name).toBe(isRegionUnlocked(name, unlocks));
    }
  });

  it('agrees on every named area — continent rolled directly (rule 3)', async () => {
    setStartArea('misthalin');
    const unlocks = ['Kandarin'];
    const bundle = await buildRuneliteBundle(unlocks, state);
    const sim = pluginSim(bundle);
    for (const name of ALL_AREA_NAMES) {
      expect(sim.isUnlocked(name), name).toBe(isRegionUnlocked(name, unlocks));
    }
  });

  it('agrees on every named area — Lumbridge-only start (Xtreme/Custom)', async () => {
    setStartArea('lumbridge');
    const unlocks = ['Varrock'];
    const bundle = await buildRuneliteBundle(unlocks, state);
    const sim = pluginSim(bundle);
    for (const name of ALL_AREA_NAMES) {
      expect(sim.isUnlocked(name), name).toBe(isRegionUnlocked(name, unlocks));
    }
    // The regression this suite exists for: Draynor Village must NOT read as
    // free in the plugin when only Lumbridge is free on the web.
    expect(sim.isUnlocked('Draynor Village')).toBe(false);
  });

  it('agrees on named-area reachability in Chunked mode (fresh + rolled)', async () => {
    setStartArea('none');
    for (const chunks of [[], ['46,52', '46,53']]) {
      const bundle = await buildRuneliteBundle([], state, undefined, undefined, chunks);
      const sim = pluginSim(bundle);
      for (const name of ALL_AREA_NAMES) {
        expect(sim.isUnlocked(name), `${name} chunks=[${chunks}]`).toBe(
          isNamedAreaReachableViaChunks(name, chunks),
        );
      }
    }
  });

  it('agrees on bank usability with bank locks on and off', async () => {
    setStartArea('misthalin');
    // BankDef ids are canonical cx*256+cy — decode back to coords, and pin
    // that decoding round-trips through the shared bankId helper.
    const coords = BANKS.map((b) => {
      const n = Number(b.id);
      return { cx: Math.floor(n / 256), cy: n % 256 };
    });
    expect(bankId(coords[0].cx, coords[0].cy)).toBe(BANKS[0].id);
    const rolled = [BANKS[0].id];
    const lockedRun = await buildRuneliteBundle([], state, undefined, undefined, undefined, rolled, true);
    const freeRun = await buildRuneliteBundle([], state);
    const lockedSim = pluginSim(lockedRun);
    const freeSim = pluginSim(freeRun);
    const unlockState = { banks: rolled } as unknown as UnlockState;
    for (const c of coords) {
      expect(lockedSim.isBankUnlocked(c.cx, c.cy), `${c.cx},${c.cy}`).toBe(
        isBankReachable(c.cx, c.cy, unlockState, 'custom', { bankLocks: true } as never),
      );
      expect(freeSim.isBankUnlocked(c.cx, c.cy)).toBe(true);
    }
  });

  it('the bundle carries the mode free baseline and the chunked start matches', async () => {
    setStartArea('lumbridge');
    const bundle = await buildRuneliteBundle([], state);
    expect(bundle.freeAreas).toEqual(['Lumbridge']);
    // Plugin CHUNKED_START (50,50) must equal the web's free start chunk.
    expect(CHUNKED_START_KEY).toBe('50,50');
    expect(isChunkUnlocked('50,50', [])).toBe(true);
  });
});
