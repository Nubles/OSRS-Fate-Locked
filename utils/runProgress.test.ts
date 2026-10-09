import { afterEach, describe, expect, it } from 'vitest';
import { initialState } from '../context/GameContext';
import { MISTHALIN_AREAS } from '../constants';
import { REGION_GROUPS } from '../data/items';
import { SUB_AREA_CHUNKS } from '../data/subAreaChunks';
import type { UnlockState } from '../types';
import { setStartArea } from './freeAreas';
import { runProgress } from './runProgress';

const run = (changes: Partial<UnlockState>): UnlockState => ({ ...structuredClone(initialState.unlocks), ...changes });

afterEach(() => setStartArea('misthalin'));

describe('runProgress', () => {
  it("counts the review's Vanilla run as the card does: 24 of 187 areas", () => {
    // R9: all of Asgarnia plus Catherby read 24/187 on the web and 21/177 in RuneLite.
    const unlocks = run({ regions: [...REGION_GROUPS.Asgarnia, 'Catherby'] });
    expect(runProgress(unlocks, 'vanilla')).toMatchObject({ unit: 'areas', unlocked: 24, total: 187 });
  });

  it("counts Misthalin's free areas, and each rolled area once", () => {
    expect(runProgress(run({}), 'vanilla')).toMatchObject({ unit: 'areas', unlocked: MISTHALIN_AREAS.length, total: 187 });
    // The golden vanilla-mid run: six rolled areas on top of the free ones.
    const mid = run({ regions: ['Falador', 'Port Sarim', 'Catherby', 'Baxtorian Falls', 'Keldagrim', 'Zanaris'] });
    expect(runProgress(mid, 'vanilla').unlocked).toBe(MISTHALIN_AREAS.length + 6);
  });

  it('counts only what the start area frees', () => {
    setStartArea('lumbridge');
    expect(runProgress(run({}), 'xtreme')).toMatchObject({ unit: 'areas', unlocked: 1, total: 187 });
    setStartArea('none');
    expect(runProgress(run({ regions: ['Falador'] }), 'custom')).toMatchObject({ unit: 'areas', unlocked: 1, total: 187 });
  });

  it("counts a Chunked run's chunks plus its free start chunk, out of every land chunk", () => {
    const chunks = (owned: number) => ({ unlocked: owned, total: 623 });
    expect(runProgress(run({ regions: [], chunks: [] }), 'chunked'))
      .toEqual({ unit: 'chunks', unlocked: 1, total: 623, chunks: chunks(1) });
    expect(runProgress(run({ regions: [], chunks: ['49,50', '48,50'] }), 'chunked'))
      .toEqual({ unit: 'chunks', unlocked: 3, total: 623, chunks: chunks(3) });
  });

  it('counts the land chunks a run owns, whatever it unlocks by', () => {
    const fresh = runProgress(run({}), 'vanilla').chunks;
    expect(fresh.total).toBe(623);
    expect(fresh.unlocked).toBeGreaterThan(0);
    expect(runProgress(run({ regions: ['Falador'] }), 'vanilla').chunks.unlocked)
      .toBe(fresh.unlocked + SUB_AREA_CHUNKS.Falador.length);
  });
});
