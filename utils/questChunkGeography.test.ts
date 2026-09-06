import { describe, expect, it } from 'vitest';
import type { UnlockState } from '../types';
import { chooseChunkQuestLocations, evaluateChunkQuestGeography, type ChunkQuestGeography, type ChunkQuestLocation } from './questChunkGeography';

const location = (id: string, cx: number, cy = 50): ChunkQuestLocation => ({ id, label: id, chunkOptions: [{ cx, cy }] });
const data = (overrides: Partial<ChunkQuestGeography> = {}): ChunkQuestGeography => ({ locations: [], groups: [], unknowns: [], ...overrides });
const route = (id: string, locations: ChunkQuestLocation[], unknowns?: string[]) => ({ id, label: id, locations, unknowns });
const region = (cx: number, cy = 50) => String(cx * 256 + cy);

describe('evaluateChunkQuestGeography', () => {
  it('requires every fixed destination but accepts one coordinate alternative and the free start', () => {
    const geography = data({ locations: [location('start', 50), { ...location('entrance', 44), chunkOptions: [{ cx: 44, cy: 50 }, { cx: 45, cy: 50 }] }, location('finish', 46)] });
    expect(evaluateChunkQuestGeography(geography, { chunks: ['45,50'] })).toEqual({
      blockers: ['finish'], evidence: ['start', 'entrance'], unknowns: [],
    });
  });

  it('does not combine owned halves of two correlated routes', () => {
    const geography = data({ groups: [{ id: 'branch', label: 'Branch', routes: [
      route('north', [location('north-start', 40), location('north-end', 41)]),
      route('south', [location('south-start', 42), location('south-end', 43)]),
    ] }] });
    expect(evaluateChunkQuestGeography(geography, { chunks: ['40,50', '43,50'] }).blockers).toEqual(['Branch: one complete route required']);
    expect(evaluateChunkQuestGeography(geography, { chunks: ['40,50', '41,50'] })).toEqual({
      blockers: [], evidence: ['Branch', 'north-start', 'north-end'], unknowns: [],
    });
  });

  it('requires each independent alternative group', () => {
    const geography = data({ groups: [
      { id: 'first', label: 'First', routes: [route('a', [location('a', 40)])] },
      { id: 'second', label: 'Second', routes: [route('b', [location('b', 41)])] },
    ] });
    expect(evaluateChunkQuestGeography(geography, { chunks: ['40,50'] }).blockers).toEqual(['Second: one complete route required']);
  });

  it('preserves capability unknowns, but a complete known alternative proves its group', () => {
    const geography = data({ groups: [{ id: 'transport', label: 'Transport', routes: [
      route('boat', [location('dock', 40)]), route('teleport', [], ['Teleport permission unverified']),
    ] }], unknowns: ['Dynamic quest destination'] });
    expect(evaluateChunkQuestGeography(geography, { chunks: [] })).toEqual({
      blockers: [], evidence: [], unknowns: ['Dynamic quest destination', 'Teleport permission unverified'],
    });
    expect(evaluateChunkQuestGeography(geography, { chunks: ['40,50'] }).unknowns).toEqual(['Dynamic quest destination']);
  });

  it('treats a route with a locked destination as blocked even if another requirement is unknown', () => {
    const geography = data({ groups: [{ id: 'boat', label: 'Boat', routes: [route('boat', [location('dock', 40)], ['Boat permission'])] }] });
    expect(evaluateChunkQuestGeography(geography, { chunks: [] }).blockers).toEqual(['Boat: one complete route required']);
    expect(evaluateChunkQuestGeography(geography, { chunks: ['40,50'] }).unknowns).toEqual(['Boat permission']);
  });

  it('does not silently pass empty geography, groups, routes or coordinate options', () => {
    const cases = [data(), data({ groups: [{ id: 'empty', label: 'Empty', routes: [] }] }),
      data({ groups: [{ id: 'empty', label: 'Empty', routes: [route('empty', [])] }] }),
      data({ locations: [{ id: 'empty', label: 'Empty', chunkOptions: [] }] })];
    for (const geography of cases) {
      const verdict = evaluateChunkQuestGeography(geography, { chunks: [] });
      expect(verdict.unknowns.length).toBeGreaterThan(0);
      expect(verdict.evidence).toEqual([]);
    }
  });

  it.each([NaN, Infinity, -1, 1.5, 256])('keeps invalid coordinate %s unknown even if its string appears owned', cx => {
    expect(evaluateChunkQuestGeography(data({ locations: [location('invalid', cx)] }), { chunks: [`${cx},50`] }).unknowns).toEqual(['invalid: unverified chunk coordinates']);
  });
});

describe('chooseChunkQuestLocations', () => {
  const geography = data({ groups: [{ id: 'branch', label: 'Branch', routes: [
    route('north', [location('north-start', 40), location('north-end', 41)]),
    route('south', [location('south-start', 42), location('south-end', 43)]),
  ] }] });

  it('preserves a whole route instead of mixing reachable branches', () => {
    const selected = chooseChunkQuestLocations(geography, new Set([region(40), region(43)]), () => true);
    expect(selected).toEqual([{ cx: 40, cy: 50 }, { cx: 41, cy: 50 }]);
  });

  it('prefers an entirely owned stranded route over a partly locked route', () => {
    const owned = new Set([40, 42, 43]);
    expect(chooseChunkQuestLocations(geography, new Set([region(40)]), cx => owned.has(cx))).toEqual([{ cx: 42, cy: 50 }, { cx: 43, cy: 50 }]);
  });

  it('prefers a reachable complete route when ownership is equal', () => {
    expect(chooseChunkQuestLocations(geography, new Set([region(42), region(43)]), () => true)).toEqual([{ cx: 42, cy: 50 }, { cx: 43, cy: 50 }]);
  });

  it('does not let an empty unknown route hide a proven route stranded destination', () => {
    const geography = data({ groups: [{ id: 'branch', label: 'Branch', routes: [
      route('unknown', [], ['Teleport unknown']), route('known', [location('dock', 40)]),
    ] }] });
    expect(chooseChunkQuestLocations(geography, new Set(), () => true)).toEqual([{ cx: 40, cy: 50 }]);
  });

  it('uses region ID reach keys for coordinate ORs and ignores invalid points', () => {
    const geography = data({ locations: [{ ...location('entrance', 40), chunkOptions: [{ cx: NaN, cy: 50 }, { cx: 40, cy: 50 }, { cx: 41, cy: 50 }] }] });
    expect(chooseChunkQuestLocations(geography, new Set([region(41)]), () => true)).toEqual([{ cx: 41, cy: 50 }]);
  });
});


describe('typed route permissions', () => {
  const state = (level: number) => ({ skills: { Agility: 1 }, levels: { Agility: level }, chunks: ['40,50', '41,50'], quests: [], mobility: [], arcana: [], equipment: {} } as unknown as UnlockState);
  const geography: ChunkQuestGeography = data({ groups: [{ id: 'access', label: 'Access', routes: [
    { ...route('shortcut', [location('shortcut', 40)]), requirements: [{ kind: 'skill', skill: 'Agility', level: 70 }] },
    { ...route('item-route', [location('item-route', 41)]), requirements: [{ kind: 'item', id: 'dusty-key', label: 'Dusty key held', usage: 'hold' }] },
  ] }] });
  it('uses actual skill levels and preserves unverified possession', () => {
    expect(evaluateChunkQuestGeography(geography, state(70), state(70)).unknowns).toEqual([]);
    expect(evaluateChunkQuestGeography(geography, state(69), state(69)).unknowns).toEqual(['Dusty key held: available and legal to hold']);
    expect(evaluateChunkQuestGeography(geography, state(70)).unknowns.length).toBeGreaterThan(0);
  });
  it('does not choose an inaccessible permission route merely because its chunks are reachable', () => {
    expect(chooseChunkQuestLocations(geography, new Set([region(40)]), () => true, state(69))).toEqual([{ cx: 41, cy: 50 }]);
    expect(chooseChunkQuestLocations(geography, new Set([region(41)]), () => true, state(70))).toEqual([{ cx: 40, cy: 50 }]);
  });
});
