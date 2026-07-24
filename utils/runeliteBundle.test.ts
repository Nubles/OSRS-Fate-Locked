import { describe, it, expect, vi } from 'vitest';
import chunkContentJson from '../public/chunk-content.json?raw';
import { initialState } from '../context/GameContext';
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
  });});
