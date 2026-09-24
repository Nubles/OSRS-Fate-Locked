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
import { describe, it, expect, afterEach, vi } from 'vitest';
import { buildRuneliteBundle } from './runeliteBundle';
import { isAreaReachable, isRegionUnlocked, isBankReachable, isNamedAreaReachableViaChunks } from './reachability';
import { setStartArea } from './freeAreas';
import { isChunkUnlocked, chunkKey, CHUNKED_START_KEY } from './chunkAdjacency';
import { SUB_AREA_CHUNKS } from '../data/subAreaChunks';
import { REGION_CHUNKS } from '../data/regionChunks';
import { BANKS, bankId } from '../data/banks';
import type { UnlockState } from '../types';
import { ZERO_BONUSES } from './gearStats';
import { EQUIPMENT_CACHE_SOURCE } from '../data/equipmentCatalogue';

afterEach(() => setStartArea('misthalin'));

describe('Vanilla equipment tier export parity', () => {
  it('keeps reviewed daggers and basic staves aligned in the picker and both plugin maps', async () => {
    const { gearService } = await import('../services/GearService');
    const { buildRuneliteRulesManifest } = await import('./runeliteRulesManifest');
    const { initialState } = await import('../context/GameContext');
    const FreshGearService = gearService.constructor as new () => typeof gearService;
    const gear = new FreshGearService();
    const daggers = [
      { id: 1205, name: 'Bronze dagger', stab: 4, meleeStr: 3, tier: 1 },
      { id: 1203, name: 'Iron dagger', stab: 5, meleeStr: 4, tier: 1 },
      { id: 1207, name: 'Steel dagger', stab: 8, meleeStr: 7, tier: 2 },
      { id: 1217, name: 'Black dagger', stab: 10, meleeStr: 8, tier: 2 },
      { id: 6591, name: 'White dagger', stab: 10, meleeStr: 8, tier: 2 },
      { id: 1381, name: 'Staff of air', stab: 0, meleeStr: 3, magic: 10, tier: 1 },
      { id: 1383, name: 'Staff of water', stab: 0, meleeStr: 3, magic: 10, tier: 1 },
      { id: 1385, name: 'Staff of earth', stab: 1, meleeStr: 5, magic: 10, tier: 1 },
      { id: 1387, name: 'Staff of fire', stab: 3, meleeStr: 6, magic: 10, tier: 1 },
    ];
    // Existing cached item data must pick up corrected tiers without clearing
    // the player's profile or waiting for the gear-data cache to expire.
    vi.stubGlobal('localStorage', {
      getItem: () => JSON.stringify({ timestamp: Date.now(), source: EQUIPMENT_CACHE_SOURCE, data: [...daggers.map(item => ({
        id: item.id, name: item.name, slot: 'Weapon', imageFile: `${item.name}.png`,
        speed: 4, twoHanded: false,
        bonuses: { ...ZERO_BONUSES, stab: item.stab, meleeStr: item.meleeStr, magic: item.magic ?? 0,
          prayer: item.name === 'White dagger' ? 1 : 0 },
      })), {
        id: 1293, name: 'Iron longsword', slot: 'Weapon', imageFile: 'Iron longsword.png',
        speed: 5, twoHanded: false,
        bonuses: { ...ZERO_BONUSES, stab: 10, slash: 15, meleeStr: 14 },
      }, {
        id: 99901, name: 'Unreviewed weapon', slot: 'Weapon', imageFile: '',
        speed: 4, twoHanded: false, bonuses: { ...ZERO_BONUSES, stab: 1000 },
      }] }),
    });
    try {
      await gear.init();
      const unlocks = { ...structuredClone(initialState.unlocks), equipment: { Weapon: 1 } };
      const manifest = await buildRuneliteRulesManifest({
        unlocks, run: { runId: 'equipment-parity', runRevision: 1, gameModeId: 'vanilla' },
        itemRuleSource: gear,
        contentService: {
          init: async () => false, allChunkCoords: () => [], contentFor: () => null,
          connectGraph: () => ({}), shortcuts: () => [], questSections: () => ({}),
        },
      });
      const bundle = await buildRuneliteBundle(unlocks.regions, { ...state, equipment: unlocks.equipment },
        gear.tierExport(), undefined, undefined, undefined, undefined, undefined, manifest);
      for (const dagger of daggers) {
        const id = String(dagger.id);
        expect(gear.tierOf(dagger.id), dagger.name).toBe(dagger.tier);
        expect(bundle.itemTiers?.[id], dagger.name).toBe(dagger.tier);
        expect(bundle.rules.itemRules[id], dagger.name).toEqual({ tier: dagger.tier, slot: 'Weapon' });
        // FateLockedPlugin.recomputeOverTierGear and FateRuleEngine.equipment
        // compare these exported tiers to the corresponding unlocked slot.
        const legacyLocked = bundle.itemTiers![id] > bundle.state.equipment!.Weapon;
        const rule = bundle.rules.itemRules[id];
        const v4Locked = rule.tier > bundle.rules.unlocks.equipment[rule.slot];
        expect(legacyLocked, dagger.name).toBe(dagger.tier > 1);
        expect(v4Locked, dagger.name).toBe(legacyLocked);
      }
      expect(gear.byId(99901)).toBeDefined();
      expect(gear.tierOf(99901)).toBeGreaterThan(1);
      // The actual Java paths skip absent legacy IDs and return UNKNOWN for
      // absent v4 rules. Adding a confidence flag alone would not protect old clients.
      expect(bundle.itemTiers?.['99901']).toBeUndefined();
      expect(bundle.rules.itemRules['99901']).toBeUndefined();
      expect(bundle.rules.equipmentCatalogue?.estimatedItemCount).toBe(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

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

  it("treats Otto's Grotto as its Baxtorian Falls owner unlock", async () => {
    setStartArea('misthalin');
    const unlocks = { regions: ['Baxtorian Falls'] } as UnlockState;
    const bundle = await buildRuneliteBundle(unlocks.regions, state);
    const sim = pluginSim(bundle);

    expect(isAreaReachable("Otto's Grotto", unlocks, 'vanilla')).toBe(true);
    expect(sim.isUnlocked('Baxtorian Falls')).toBe(true);
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
    expect(bundle.freeAreas).toEqual(['Tutorial Island', 'Lumbridge']);
    // Plugin CHUNKED_START (50,50) must equal the web's free start chunk.
    expect(CHUNKED_START_KEY).toBe('50,50');
    expect(isChunkUnlocked('50,50', [])).toBe(true);
  });
});
type BundleLike = {
  unlockedRegions?: string[];
  unlockedChunks?: string[];
  bankLocks?: boolean;
  unlockedBanks?: string[];
  state?: { linkedAccount?: string };
  rules?: {
    account: string | null;
    bankLocks: boolean;
    unlocks: {
      regions: string[];
      chunks: string[];
      banks: string[];
    };
  };
};

const effectiveV4 = (bundle: BundleLike) => ({
  account: bundle.rules?.account ?? bundle.state?.linkedAccount ?? null,
  bankLocks: bundle.rules?.bankLocks ?? bundle.bankLocks ?? false,
  regions: bundle.rules?.unlocks.regions ?? bundle.unlockedRegions ?? [],
  chunks: bundle.rules?.unlocks.chunks ?? bundle.unlockedChunks ?? [],
  banks: bundle.rules?.unlocks.banks ?? bundle.unlockedBanks ?? [],
});

describe('RuneLite v3/v4 parity', () => {
  it('preserves canonical pending quest and boss confirmations in the v4 category snapshot', async () => {
    const { buildRuneliteRulesManifest } = await import('./runeliteRulesManifest');
    const { initialState } = await import('../context/GameContext');
    const { QUEST_DATA } = await import('../data/questData');
    const { REGIONS_LIST, SKILLS_LIST } = await import('../data/items');
    const unlocks = {
      ...structuredClone(initialState.unlocks),
      regions: [...REGIONS_LIST], bosses: ['General Graardor'],
      skills: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 10])),
      levels: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 99])),
      quests: Object.keys(QUEST_DATA).filter(id => id !== 'Dragon Slayer II'),
    };
    const manifest = await buildRuneliteRulesManifest({
      unlocks, run: { runId: 'confirmation-parity', runRevision: 1, gameModeId: 'vanilla' },
      itemRuleSource: { init: async () => {}, ready: false, itemRuleExport: () => ({}) },
      contentService: {
        init: async () => true, allChunkCoords: () => [{ cx: 50, cy: 50 }],
        contentFor: () => ({ name: 'Lumbridge', monsters: [{ name: 'General Graardor', count: 1, slayer: null }],
          npcs: [], objects: [], shops: [], quests: { 'Dragon Slayer II': 'step' }, diaries: {}, clues: {}, spawns: [] }),
        connectGraph: () => ({}), shortcuts: () => [], questSections: () => ({}),
        taskRequirements: () => [], chunkEntryRequirements: () => [],
      },
    });
    expect(manifest.chunks['50,50'].categories.QUESTS?.[0]).toMatchObject({ status: 'UNKNOWN', detail: expect.stringMatching(/pyre/i) });
    expect(manifest.chunks['50,50'].categories.ACTIVITIES?.[0]).toMatchObject({ status: 'UNKNOWN', detail: expect.stringMatching(/kill-count/) });
    const bundle = await buildRuneliteBundle(unlocks.regions, state, undefined, undefined, undefined, [], true, undefined, manifest);
    expect(bundle.version).toBe(4);
    expect(bundle.rules.chunks).toEqual(manifest.chunks);
    expect(bundle.unlockedChunks).toBeUndefined();
  });

  it('adds housing and storage without changing the unlock fields the plugin reads', async () => {
    const { buildRuneliteRulesManifest } = await import('./runeliteRulesManifest');
    const { initialState } = await import('../context/GameContext');
    // RuneliteRulesManifest.java's Unlocks class. Gson drops every other key,
    // so the web-only families below must never gain a plugin decision here.
    const pluginUnlockFields = [
      'regions', 'chunks', 'skills', 'levels', 'equipment', 'banks',
      'merchants', 'bosses', 'minigames', 'mobility', 'arcana', 'guilds',
      'farming', 'slayer', 'quests',
    ];
    const webOnlyUnlockFields = ['housing', 'storage'];
    const manifest = await buildRuneliteRulesManifest({
      unlocks: {
        ...structuredClone(initialState.unlocks),
        housing: ['Portal Nexus'],
        storage: ['Rune Pouch'],
      },
      run: { runId: 'web-only-families', runRevision: 1, gameModeId: 'vanilla' },
      itemRuleSource: { init: async () => {}, ready: false, itemRuleExport: () => ({}) },
      contentService: {
        init: async () => false, allChunkCoords: () => [], contentFor: () => null,
        connectGraph: () => ({}), shortcuts: () => [], questSections: () => ({}),
      },
    });

    expect(Object.keys(manifest.unlocks).sort())
      .toEqual([...pluginUnlockFields, ...webOnlyUnlockFields].sort());
    expect(manifest.unlocks.housing).toEqual(['Portal Nexus']);
    expect(manifest.unlocks.storage).toEqual(['Rune Pouch']);
  });

  it('preserves region, chunk, bank, and account decisions', () => {
    const v3: BundleLike = {
      unlockedRegions: ['Misthalin'],
      unlockedChunks: ['50,50'],
      bankLocks: true,
      unlockedBanks: ['12850'],
      state: { linkedAccount: 'Example' },
    };
    const v4: BundleLike = {
      ...v3,
      rules: {
        account: 'Example',
        bankLocks: true,
        unlocks: {
          regions: ['Misthalin'],
          chunks: ['50,50'],
          banks: ['12850'],
        },
      },
    };

    expect(effectiveV4(v4)).toEqual(effectiveV4(v3));
  });

  it('uses legacy root fields when a rules manifest is absent', () => {
    expect(effectiveV4({
      unlockedRegions: ['Asgarnia'],
      state: { linkedAccount: 'Legacy' },
    })).toEqual({
      account: 'Legacy',
      bankLocks: false,
      regions: ['Asgarnia'],
      chunks: [],
      banks: [],
    });
  });
});
