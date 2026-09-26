import { beforeAll, describe, expect, it, vi } from 'vitest';
import content from '../public/chunk-content.json';
import { initialState } from '../context/GameContext';
import { ChunkContentService } from '../services/ChunkContentService';
import type { UnlockState } from '../types';
import { chunkForPlace } from './chunkLocations';
import { SLAYER_DECISION, slayerDecisions, slayerLocate, slayerTaskKey } from './slayerDecisions';
import { slayerReachability, type SlayerReach, type SlayerStatus } from './slayerReach';

const fresh = (): UnlockState => structuredClone(initialState.unlocks);

/** Masters and their tasks' statuses, as slayerReachability would give them. */
const reach = (masters: Record<string, [string, SlayerStatus][]>): SlayerReach => ({
  combatLevel: 3,
  slayerLevel: 1,
  slayerUnlocked: true,
  masters: Object.entries(masters).map(([master, rows]) => ({
    master,
    rows: rows.map(([monster, status]) => ({ monster, weight: 1, status, loc: null })),
    ready: 0,
    total: rows.length,
  })),
});

describe('SLAYER_DECISION', () => {
  it('holds back only a task in a locked area; one the run cannot take yet is not ready', () => {
    expect(SLAYER_DECISION).toEqual({
      'ready': 'ALLOWED',
      'area-locked': 'LOCKED',
      'slayer-locked': 'NOT_READY',
      'quest-locked': 'NOT_READY',
      'combat-locked': 'NOT_READY',
      'access-blocked': 'NOT_READY',
      'access-unknown': 'UNKNOWN',
      'no-location': 'UNKNOWN',
    });
  });
});

describe('slayerDecisions', () => {
  it('keys each task as slayerChunks does, for its master and on its own', () => {
    expect(slayerTaskKey(' Bears ')).toBe('bear');
    expect(slayerDecisions(reach({ Krystilia: [['Bears', 'area-locked']] })))
      .toEqual({ 'krystilia:bear': 'LOCKED', bear: 'LOCKED' });
  });

  it("gives a task whatever its master the most permissive of the masters' answers", () => {
    const decisions = slayerDecisions(reach({
      Turael: [['Bears', 'ready'], ['Cows', 'area-locked'], ['Dogs', 'no-location'], ['Rats', 'area-locked']],
      Krystilia: [['Bears', 'area-locked'], ['Cows', 'area-locked'], ['Dogs', 'slayer-locked'], ['Rats', 'access-unknown']],
    }));
    expect(decisions).toMatchObject({
      'turael:bear': 'ALLOWED', 'krystilia:bear': 'LOCKED', bear: 'ALLOWED',
      cow: 'LOCKED',
      dog: 'NOT_READY',
      rat: 'UNKNOWN',
    });
  });

  it('merges the same way whichever master comes first', () => {
    const one = reach({ A: [['Rats', 'area-locked']], B: [['Rats', 'ready']] });
    const other = reach({ B: [['Rats', 'ready']], A: [['Rats', 'area-locked']] });
    expect(slayerDecisions(one)).toEqual(slayerDecisions(other));
    expect(slayerDecisions(one).rat).toBe('ALLOWED');
  });
});

describe('slayerLocate', () => {
  const lumbridge = chunkForPlace('Lumbridge')!;
  const falador = chunkForPlace('Falador')!;
  const source = (...coords: { cx: number; cy: number }[]) =>
    ({ slayerLocations: () => coords.map((location) => ({ name: 'Cow', location })) });

  it('prefers a location the run can use', () => {
    expect(slayerLocate(source(falador, lumbridge), fresh(), 'vanilla')('Cows'))
      .toEqual({ ...lumbridge, unlocked: true, accessStatus: 'ALLOWED' });
  });

  it('falls back to a location the run cannot use, and to nothing', () => {
    expect(slayerLocate(source(falador), fresh(), 'vanilla')('Cows'))
      .toEqual({ ...falador, unlocked: false, accessStatus: 'LOCKED' });
    expect(slayerLocate(source(), fresh(), 'vanilla')('Cows')).toBeNull();
  });
});

describe('slayerDecisions on the shipped Slayer data', () => {
  const service = new ChunkContentService();

  beforeAll(async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => content })));
    await service.init();
    vi.unstubAllGlobals();
  });

  it("decides every key the bundle's slayerChunks has, and no other", () => {
    const decisions = slayerDecisions(
      slayerReachability(service.slayerMasters(), fresh(), slayerLocate(service, fresh(), 'vanilla'), 'vanilla'));
    const keys = Object.keys(service.slayerReachIndex());
    expect(keys.length).toBeGreaterThan(100);
    expect(Object.keys(decisions).sort()).toEqual(keys.sort());
  });
});
