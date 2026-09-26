import { describe, it, expect, vi } from 'vitest';
import chunkContentJson from '../public/chunk-content.json?raw';
import { initialState } from '../context/GameContext';
import { MOBILITY_LIST } from '../data/items';
import fullChunkContent from '../public/chunk-content.json';
import { REGION_GROUPS, MISTHALIN_AREAS } from '../constants';
import { buildBundlePayload } from './runeliteExport';
import { buildRuneliteBundle, RuneliteRunState } from './runeliteBundle';
import equipmentCatalogueJson from '../public/equipment-catalogue.294c0a5ab539ea503cb22f0fafe1cb4521049724.json?raw';
import { EQUIPMENT_CATALOGUE, EQUIPMENT_CACHE_SOURCE } from '../data/equipmentCatalogue';
import { setStartArea } from './freeAreas';
import { ZERO_BONUSES } from './gearStats';

const state: RuneliteRunState = {
  keys: 3, specialKeys: 0, chaosKeys: 0, fatePoints: 0, activeBuff: 'NONE', pinnedGoals: [],
};

describe('buildRuneliteBundle — unlockedChunks presence', () => {
  it('emits bundle v4 with the shared rules manifest', async () => {
    const bundle = await buildRuneliteBundle(
      ['Misthalin'], state, undefined, undefined, undefined, undefined, false,
      {
        runId: 'run-1', runRevision: 9, gameModeId: 'vanilla',
        rulesVersion: '1', contentVersion: 1, detectorContractVersion: 1,
      },
    ) as any;

    expect(bundle.version).toBe(4);
    expect(bundle.rules.runId).toBe('run-1');
    expect(bundle.chunks).toBeDefined();
    expect(bundle.chunkContent).toBeDefined();
    expect(bundle.rules.knownMobility).toEqual([]);
    expect(bundle.rules.unlocks.mobility).toEqual([]);
  });

  it('preserves authored mobility unlocks in the typed fallback', async () => {
    const bundle = await buildRuneliteBundle(
      ['Misthalin'], state, undefined, undefined, undefined, undefined, false,
      {
        runId: 'run-2', runRevision: 10, gameModeId: 'vanilla',
        rulesVersion: '1', contentVersion: 1, detectorContractVersion: 1,
      },
      undefined,
      ['Spirit Trees', 'Fairy Rings'],
    ) as any;

    expect(bundle.rules.knownMobility).toEqual([...MOBILITY_LIST].sort());
    expect(bundle.rules.unlocks.mobility).toEqual([
      'Fairy Rings',
      'Spirit Trees',
    ]);
  });

  it('omits unlockedChunks entirely when not passed (non-chunked mode)', async () => {
    const bundle = await buildRuneliteBundle([], state) as any;
    expect('unlockedChunks' in bundle).toBe(false);
  });

  it('includes an EMPTY unlockedChunks array for a fresh Chunked run (0 unlocked)', async () => {
    // This is the edge case that matters: a Chunked run at the very start has
    // unlocks.chunks === [], same shape as "not chunked at all" — the plugin
    // needs the field's mere PRESENCE (not its length) to tell the two apart,
    // since the free start chunk must still read as unlocked in-game.
    const bundle = await buildRuneliteBundle([], state, undefined, undefined, []) as any;
    expect('unlockedChunks' in bundle).toBe(true);
    expect(bundle.unlockedChunks).toEqual([]);
  });

  it('includes a populated unlockedChunks array once chunks are rolled', async () => {
    const bundle = await buildRuneliteBundle([], state, undefined, undefined, ['50,51', '51,50']) as any;
    expect(bundle.unlockedChunks).toEqual(['50,51', '51,50']);
  });

  it('still embeds the chunk-content dataset (now dynamically imported)', async () => {
    const bundle = await buildRuneliteBundle([], state) as any;
    expect(bundle.chunkContent).toBeTruthy();
    expect(Object.keys(bundle.chunkContent).length).toBeGreaterThan(100);
  });

  it('exports a v4 lite bundle whose records are capped subsets of the full snapshot', async () => {
    const bundle = await buildRuneliteBundle([], state) as any;
    expect(bundle.version).toBe(4);

    for (const [coords, lite] of Object.entries(bundle.chunkContent) as [string, any][]) {
      const [cx, cy] = coords.split(',').map(Number);
      const id = String(cx * 256 + cy);
      const records = [
        (fullChunkContent as any).chunks[id],
        ...Object.values((fullChunkContent as any).interiors ?? {})
          .filter((entry: any) => entry.entrances.some((route: any) => route.chunkId === id))
          .map((entry: any) => entry.content),
      ].filter(Boolean);
      expect(records.length, `missing full record for lite chunk ${coords}`).toBeGreaterThan(0);
      expect((lite.mon ?? []).length).toBeLessThanOrEqual(6);
      expect((lite.shop ?? []).length).toBeLessThanOrEqual(8);
      expect((lite.farm ?? []).length).toBeLessThanOrEqual(8);
      expect((lite.poi ?? []).length).toBeLessThanOrEqual(8);
      for (const name of lite.mon ?? []) expect(records.flatMap(row => (row.m ?? []).map(([item]: [string]) => item))).toContain(name);
      for (const name of lite.shop ?? []) expect(records.flatMap(row => row.s ?? [])).toContain(name);
      for (const name of [...(lite.farm ?? []), ...(lite.poi ?? [])]) {
        expect(records.flatMap(row => (row.o ?? []).map(([item]: [string]) => item))).toContain(name);
      }
    }
  });
  it('emits bankLocks + unlockedBanks only when banks are locked', async () => {
    const off = await buildRuneliteBundle([], state) as any;
    expect('bankLocks' in off).toBe(false);
    expect('unlockedBanks' in off).toBe(false);

    const on = await buildRuneliteBundle([], state, undefined, undefined, undefined, ['12850'], true) as any;
    expect(on.bankLocks).toBe(true);
    expect(on.unlockedBanks).toEqual(['12850']);
  });

  it('exports stable run and contract identity at the bundle root', async () => {
    const bundle = await buildRuneliteBundle(
      [], state, undefined, undefined, undefined, undefined, false,
      {
        runId: 'run-1',
        runRevision: 9,
        gameModeId: 'vanilla',
        rulesVersion: '1',
        contentVersion: 1,
        detectorContractVersion: 1,
      },
    ) as any;

    expect(bundle).toMatchObject({
      runId: 'run-1',
      runRevision: 9,
      gameModeId: 'vanilla',
      rulesVersion: '1',
      contentVersion: 1,
      detectorContractVersion: 1,
    });
  });
  it('exports completed quest, miniquest, and legacy RFD identities unchanged', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('chunk-content.json')) {
        return new Response(chunkContentJson, {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response('{}', { status: 404 });
    }));

    try {
      const { json } = await buildBundlePayload({
        ...initialState.unlocks,
        quests: [
          "Witch's Potion",
          'In Search of Knowledge',
          'RFD: The Cook',
          'RFD: Finale',
        ],
      }, {
        runId: 'run-completed-identities',
        runRevision: 4,
        keys: 3,
        specialKeys: 0,
        chaosKeys: 0,
        fatePoints: 0,
        activeBuff: 'NONE',
        gameModeId: 'vanilla',
      });
      const bundle = JSON.parse(json);

      expect(bundle.rules.unlocks.quests).toEqual([
        'In Search of Knowledge',
        'RFD: Finale',
        'RFD: The Cook',
        "Witch's Potion",
      ]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('fits the full pinned equipment catalogue and Vanilla rules inside the relay request limit with headroom', async () => {
    // Previous tests may have attempted an offline export. Use fresh service
    // instances so this check must ingest the actual full equipment fixture.
    vi.resetModules();
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {} });
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('chunk-content.json')) {
        return new Response(chunkContentJson, {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (url.includes(EQUIPMENT_CATALOGUE.asset)) {
        return new Response(equipmentCatalogueJson, { status: 200,
          headers: { 'content-type': 'application/json' } });
      }
      return new Response('{}', { status: 404 });
    }));

    try {
      const { buildBundlePayload: buildFreshPayload } = await import('./runeliteExport');
      const { json, compressed } = await buildFreshPayload(initialState.unlocks, {
        runId: 'run-size',
        runRevision: 1,
        keys: 3,
        specialKeys: 0,
        chaosKeys: 0,
        fatePoints: 0,
        activeBuff: 'NONE',
        gameModeId: 'vanilla',
      });
      const bundle = JSON.parse(json);
      expect(bundle.rules.equipmentCatalogue).toMatchObject({ source: EQUIPMENT_CACHE_SOURCE,
        status: 'pinned', localItemCount: EQUIPMENT_CATALOGUE.itemCount });
      const reviewed = Object.keys(bundle.rules.itemRules).length;
      expect(reviewed).toBeGreaterThan(1000);
      expect(reviewed).toBeLessThan(EQUIPMENT_CATALOGUE.itemCount);
      expect(Object.keys(bundle.itemTiers)).toHaveLength(reviewed);
      expect(bundle.rules.equipmentCatalogue.reviewedItemCount).toBe(reviewed);
      expect(bundle.rules.itemRules['552']).toEqual({ tier: 1, slot: 'Neck' });
      expect(compressed.startsWith('FLGZ:')).toBe(true);
      const body = JSON.stringify({ token: 'f'.repeat(32), payload: compressed });
      expect(new TextEncoder().encode(body).byteLength).toBeLessThan(256 * 1024 - 16 * 1024);
      const worker = (await import('../workers/fate-relay/worker.js')).default;
      const put = vi.fn(async (_key: string, _value: string, _options?: unknown) => {});
      const response = await worker.fetch(new Request('https://relay.test/r/catalogue-size', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body,
      }), { RELAY: { get: async () => null, put } });
      expect(response.status).toBe(200);
      // The profile record, then the code's owner record (a token hash).
      expect(put.mock.calls.map(([key]) => key)).toEqual(['r:catalogue-size', 'own:r:catalogue-size']);
    } finally {
      vi.unstubAllGlobals();
      vi.resetModules();
    }
  });
});

describe('buildBundlePayload - failed rules data', () => {
  it('refuses a relay build from failed chunk or equipment data, and retries on request', async () => {
    // Fresh services, so no earlier test's loaded data or cool-down leaks in.
    vi.resetModules();
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {} });
    let online = false;
    const catalogue = [{
      id: 1205, name: 'Bronze dagger', slot: 'weapon', image: 'Bronze dagger.png',
      speed: 4, offensive: { stab: 4 }, bonuses: { str: 3 },
    }];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (!online) return new Response('unavailable', { status: 503 });
      if (url.includes('chunk-content.json')) {
        return new Response(chunkContentJson, { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (url.includes(EQUIPMENT_CATALOGUE.asset)) {
        return new Response(JSON.stringify(catalogue), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response('{}', { status: 404 });
    }));
    const run = {
      runId: 'run-offline', runRevision: 3, keys: 0, specialKeys: 0, chaosKeys: 0,
      fatePoints: 0, activeBuff: 'NONE', gameModeId: 'vanilla',
    };

    try {
      const { buildBundlePayload: buildFreshPayload } = await import('./runeliteExport');
      // Both datasets down: a relay publish must not replace a complete profile.
      await expect(buildFreshPayload(initialState.unlocks, run, { requireRulesData: true }))
        .rejects.toThrow("Couldn't load chunk and equipment data, so the profile wasn't sent.");
      // A manual export still degrades, as before.
      const degraded = JSON.parse((await buildFreshPayload(initialState.unlocks, run)).json);
      expect(degraded.rules.chunks).toEqual({});
      expect(degraded.rules.itemRules).toEqual({});

      // Back online, but equipment data is inside its failure cool-down.
      online = true;
      await expect(buildFreshPayload(initialState.unlocks, run, { requireRulesData: true }))
        .rejects.toThrow("Couldn't load equipment data, so the profile wasn't sent.");
      // An explicit retry skips the cool-down and builds the complete rules.
      const full = JSON.parse((await buildFreshPayload(initialState.unlocks, run, {
        requireRulesData: true, retryFailedLoads: true,
      })).json);
      expect(Object.keys(full.rules.chunks).length).toBeGreaterThan(100);
      expect(full.rules.itemRules['1205']).toEqual({ tier: 1, slot: 'Weapon' });
    } finally {
      vi.unstubAllGlobals();
      vi.resetModules();
    }
  });
});

describe('buildRuneliteBundle - canonical area names', () => {
  it('canonicalizes every overlapping surface alias in root and rules unlocks', async () => {
    const aliases = [
      "Heroes' Guild", 'Ice Mountain', 'Ranging Guild', "Otto's Grotto", 'Resource Area',
    ];
    const canonical = [
      'Taverley', 'Goblin Village', 'Hemenster', 'Baxtorian Falls', 'Mage Arena',
    ];
    const bundle = await buildRuneliteBundle([...aliases, ...canonical], state);

    expect(bundle.unlockedRegions).toEqual(canonical);
    expect(bundle.rules.unlocks.regions).toEqual([...canonical].sort());
    expect(Object.values(REGION_GROUPS).flat()).toHaveLength(178);
    expect(Object.values(bundle.regionGroups).flat()).toHaveLength(187);
    expect(bundle.regionGroups.Misthalin).toEqual(MISTHALIN_AREAS);
    expect(bundle.regionGroups['The Open Seas']).toContain('Wyrmscraig');
    expect(bundle.subAreaChunks.Wyrmscraig).toEqual([
      { cx: 39, cy: 34 },
      { cx: 39, cy: 35 },
      { cx: 40, cy: 34 },
      { cx: 40, cy: 35 },
    ]);
    for (const alias of aliases) {
      expect(Object.values(REGION_GROUPS).flat()).not.toContain(alias);
      expect(Object.values(bundle.regionGroups).flat()).not.toContain(alias);
    }
    expect(bundle.subAreaChunks['Baxtorian Falls']).toContainEqual({ cx: 39, cy: 54 });
  });

  it('canonicalizes legacy regions in both the v4 root and fallback rules', async () => {
    const bundle = await buildRuneliteBundle(['Elf Camp'], state);

    expect(bundle.version).toBe(4);
    expect(bundle.unlockedRegions).toEqual(['Iorwerth Camp']);
    expect(bundle.rules.unlocks.regions).toEqual(['Iorwerth Camp']);
  });

  it('canonicalizes and deduplicates an explicitly supplied v4 rules manifest', async () => {
    const fallback = await buildRuneliteBundle(['Elf Camp'], state);
    const suppliedRules = {
      ...fallback.rules,
      unlocks: {
        ...fallback.rules.unlocks,
        regions: ['Elf Camp', 'Iorwerth Camp'],
      },
    };
    const bundle = await buildRuneliteBundle(
      ['Prifddinas', 'Elf Camp', 'Iorwerth Camp', 'Lletya'],
      state,
      undefined, undefined, undefined, undefined, false,
      {
        runId: 'run-alias-test',
        runRevision: 1,
        gameModeId: 'vanilla',
        rulesVersion: '1',
        contentVersion: 1,
        detectorContractVersion: 1,
      },
      suppliedRules,
    );

    expect(bundle.unlockedRegions).toEqual([
      'Prifddinas', 'Iorwerth Camp', 'Lletya',
    ]);
    expect(bundle.rules.unlocks.regions).toEqual(['Iorwerth Camp']);
  });

  it('exports canonical Tirannwn children and retains the Iorwerth overlay', async () => {
    const bundle = await buildRuneliteBundle([], state) as any;

    expect(bundle.version).toBe(4);
    expect(bundle.chunkOffset).toEqual({ cx: 0, cy: 0 });
    expect(bundle.regionGroups.Tirannwn).toEqual([
      'Prifddinas', 'Lletya', 'Tyras Camp', 'Isafdar', 'Zul-Andra',
      'Arandar', 'Gwenith', 'Iorwerth Camp', 'Poison Waste',
    ]);
    expect(bundle.regionGroups.Tirannwn).not.toContain('Elf Camp');
    expect(bundle.subAreaChunks['Iorwerth Camp']).toEqual([
      { cx: 33, cy: 50 },
      { cx: 34, cy: 50 },
    ]);
  });
});

describe('buildRuneliteBundle - free areas', () => {
  it("carries a Lumbridge start's free areas", async () => {
    setStartArea('lumbridge');
    try {
      const bundle = await buildRuneliteBundle([], state);
      expect(bundle.freeAreas).toEqual(['Tutorial Island', 'Lumbridge']);
    } finally {
      setStartArea('misthalin');
    }
  });
});

describe('buildRuneliteBundle - equipment tiers', () => {
  it('keeps reviewed daggers and basic staves aligned in the picker and both exported maps', async () => {
    const { gearService } = await import('../services/GearService');
    const { buildRuneliteRulesManifest } = await import('./runeliteRulesManifest');
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

describe('buildRuneliteBundle - v4 category snapshot', () => {
  it('preserves canonical pending quest and boss confirmations in the v4 category snapshot', async () => {
    const { buildRuneliteRulesManifest } = await import('./runeliteRulesManifest');
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
});
