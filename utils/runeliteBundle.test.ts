import { describe, it, expect, vi } from 'vitest';
import chunkContentJson from '../public/chunk-content.json?raw';
import { initialState } from '../context/GameContext';
import { MOBILITY_LIST } from '../data/items';
import fullChunkContent from '../public/chunk-content.json';
import { buildBundlePayload } from './runeliteExport';
import { buildRuneliteBundle, RuneliteRunState } from './runeliteBundle';

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
      const full = (fullChunkContent as any).chunks[String(cx * 256 + cy)];
      expect(full, `missing full record for lite chunk ${coords}`).toBeDefined();
      expect((lite.mon ?? []).length).toBeLessThanOrEqual(6);
      expect((lite.shop ?? []).length).toBeLessThanOrEqual(8);
      expect((lite.farm ?? []).length).toBeLessThanOrEqual(8);
      expect((lite.poi ?? []).length).toBeLessThanOrEqual(8);
      for (const name of lite.mon ?? []) expect(full.m.map(([item]: [string]) => item)).toContain(name);
      for (const name of lite.shop ?? []) expect(full.s ?? []).toContain(name);
      for (const name of [...(lite.farm ?? []), ...(lite.poi ?? [])]) {
        expect(full.o.map(([item]: [string]) => item)).toContain(name);
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
  it('fits the complete rules snapshot inside the relay limit', async () => {
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
      const { compressed } = await buildBundlePayload(initialState.unlocks, {
        runId: 'run-size',
        runRevision: 1,
        keys: 3,
        specialKeys: 0,
        chaosKeys: 0,
        fatePoints: 0,
        activeBuff: 'NONE',
        gameModeId: 'vanilla',
      });
      expect(compressed.startsWith('FLGZ:')).toBe(true);
      expect(new TextEncoder().encode(compressed).byteLength)
        .toBeLessThan(256 * 1024);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('buildRuneliteBundle - canonical area names', () => {
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
