import { beforeAll, describe, expect, it, vi } from 'vitest';
import content from '../public/chunk-content.json';
import { initialState } from '../context/GameContext';
import { ChunkContentService } from '../services/ChunkContentService';
import type { UnlockState } from '../types';
import { chunkForPlace } from './chunkLocations';
import { SLAYER_DECISION, slayerDecisions, slayerLocate, slayerReason, slayerTaskKey } from './slayerDecisions';
import { slayerReachability, type SlayerReach, type SlayerStatus, type SlayerTaskRow } from './slayerReach';

const fresh = (): UnlockState => structuredClone(initialState.unlocks);

const statuses = (decisions: ReturnType<typeof slayerDecisions>) =>
  Object.fromEntries(Object.entries(decisions).map(([key, decision]) => [key, decision.status]));

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
    const locked = { status: 'LOCKED', reason: 'Area locked' };
    expect(slayerDecisions(reach({ Krystilia: [['Bears', 'area-locked']] })))
      .toEqual({ 'krystilia:bear': locked, bear: locked });
  });

  it("gives a task whatever its master the most usable of the masters' answers", () => {
    const decisions = statuses(slayerDecisions(reach({
      Turael: [['Bears', 'ready'], ['Cows', 'area-locked'], ['Dogs', 'no-location'], ['Rats', 'area-locked'],
        ['Goblins', 'area-locked']],
      Krystilia: [['Bears', 'area-locked'], ['Cows', 'area-locked'], ['Dogs', 'slayer-locked'], ['Rats', 'access-unknown'],
        ['Goblins', 'combat-locked']],
    })));
    expect(decisions).toMatchObject({
      'turael:bear': 'ALLOWED', 'krystilia:bear': 'LOCKED', bear: 'ALLOWED',
      cow: 'LOCKED',
      dog: 'UNKNOWN',
      rat: 'UNKNOWN',
      goblin: 'NOT_READY',
    });
  });

  it('merges the same way whichever master comes first', () => {
    const one = reach({ A: [['Rats', 'area-locked']], B: [['Rats', 'ready']] });
    const other = reach({ B: [['Rats', 'ready']], A: [['Rats', 'area-locked']] });
    expect(slayerDecisions(one)).toEqual(slayerDecisions(other));
    expect(slayerDecisions(one).rat).toEqual({ status: 'ALLOWED' });
  });

  it("gives a task whatever its master the chosen master's reason", () => {
    const decisions = slayerDecisions(reach({ A: [['Rats', 'area-locked']], B: [['Rats', 'access-unknown']] }));
    expect(decisions.rat).toEqual({ status: 'UNKNOWN', reason: 'Access needs review' });
  });
});

describe('slayerReason', () => {
  const row = (status: SlayerStatus, extra: Partial<SlayerTaskRow> = {}): SlayerTaskRow =>
    ({ monster: 'Bears', weight: 1, status, loc: null, ...extra });

  it("says why a task isn't ready, the master's blocker and levels first, as the panel's badge does", () => {
    expect(slayerReason(row('ready'))).toBeUndefined();
    expect(slayerReason(row('area-locked', { masterBlocker: { status: 'area-locked', label: 'Master: Wyrmscraig' } })))
      .toBe('Master: Wyrmscraig');
    expect(slayerReason(row('slayer-locked', { slayer: 55 }))).toBe('Slayer 55');
    expect(slayerReason(row('slayer-locked'))).toBe('Slayer locked');
    expect(slayerReason(row('combat-locked', { combat: 70 }))).toBe('Combat 70');
    expect(slayerReason(row('quest-locked'))).toBe('Quest requirements');
    expect(slayerReason(row('area-locked'))).toBe('Area locked');
    expect(slayerReason(row('access-blocked'))).toBe('Entry requirements');
    expect(slayerReason(row('access-unknown'))).toBe('Access needs review');
    expect(slayerReason(row('no-location'))).toBe('No known location');
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
