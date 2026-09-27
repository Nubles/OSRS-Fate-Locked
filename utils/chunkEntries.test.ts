import { describe, expect, it } from 'vitest';
import { initialState } from '../context/GameContext';
import type { UnlockState } from '../types';
import { ALL_CHUNK_KEYS } from './chunkAdjacency';
import { chunkEntries, placeName, rulesPlaces, type ChunkEntriesSource } from './chunkEntries';
import { chunkForPlace } from './chunkLocations';
import type { InteriorRecord } from './interiorEntry';
import { OCEAN_CHUNK_KEYS } from './oceanAccess';

const fresh = (): UnlockState => structuredClone(initialState.unlocks);
const idOf = ({ cx, cy }: { cx: number; cy: number }) => String(cx * 256 + cy);
const lumbridge = chunkForPlace('Lumbridge')!;
const falador = chunkForPlace('Falador')!;

const cellar: InteriorRecord = {
  key: '1,2',
  name: 'Test Cellar#Lower Level',
  entrances: [
    { chunkId: idOf(lumbridge), requirements: [] },
    { chunkId: idOf(falador), requirements: [] },
    { chunkId: idOf(lumbridge), requirements: ['Ratcatchers Complete the quest'] },
  ],
};
const placeholder: InteriorRecord = { key: '1,1', name: 'Interior 257', entrances: [] };
const keldagrim: InteriorRecord = { key: '2,1', name: 'Keldagrim', entrances: [] };
const source: ChunkEntriesSource = {
  interiorRecords: () => [keldagrim, cellar, placeholder],
  chunkEntryRequirements: () => [],
};

describe('placeName', () => {
  it('reads a section as part of its place, and names no placeholder', () => {
    expect(placeName('Mor Ul Rek#Outer Area')).toBe('Mor Ul Rek · Outer Area');
    expect(placeName('Keldagrim')).toBe('Keldagrim');
    expect(placeName('Interior 7244')).toBeUndefined();
  });
});

describe('rulesPlaces', () => {
  it('describes the ocean and each interior, and nothing on land', () => {
    const places = rulesPlaces(source);
    expect(Object.keys(places)).toHaveLength(OCEAN_CHUNK_KEYS.size + 3);
    for (const key of OCEAN_CHUNK_KEYS) expect(places[key]).toEqual({ kind: 'ocean' });
    // Each entrance once, in chunk order (Falador lies west of Lumbridge).
    expect(places['1,2']).toEqual({
      kind: 'interior', name: 'Test Cellar · Lower Level',
      entrances: [`${falador.cx},${falador.cy}`, `${lumbridge.cx},${lumbridge.cy}`],
    });
    expect(places['2,1']).toEqual({ kind: 'interior', name: 'Keldagrim', area: 'Keldagrim', entrances: [] });
    expect(places['1,1']).toEqual({ kind: 'interior', entrances: [] });
    expect(ALL_CHUNK_KEYS.some((key) => key in places)).toBe(false);
  });

  it('lists places in chunk order', () => {
    const keys = Object.keys(rulesPlaces(source)).map((key) => key.split(',').map(Number));
    expect(keys.slice(0, 3)).toEqual([[1, 1], [1, 2], [2, 1]]);
    for (let index = 1; index < keys.length; index++) {
      const [a, b] = [keys[index - 1], keys[index]];
      expect(a[0] < b[0] || (a[0] === b[0] && a[1] < b[1])).toBe(true);
    }
  });
});

describe('chunkEntries', () => {
  it('gives every land, ocean and interior chunk an entry', () => {
    const entries = chunkEntries(source, fresh(), 'vanilla');
    expect(Object.keys(entries)).toHaveLength(ALL_CHUNK_KEYS.length + OCEAN_CHUNK_KEYS.size + 3);
    expect(entries[`${lumbridge.cx},${lumbridge.cy}`]).toBe('ALLOWED');
    expect(entries[`${falador.cx},${falador.cy}`]).toBe('LOCKED');
    expect([...OCEAN_CHUNK_KEYS].every((key) => entries[key] === 'LOCKED')).toBe(true);
  });

  it('decides interiors by their area and their ways in', () => {
    const entries = chunkEntries(source, fresh(), 'vanilla');
    // Through Lumbridge, one way in is open; Keldagrim isn't rolled; nothing is known of the placeholder.
    expect(entries['1,2']).toBe('ALLOWED');
    expect(entries['2,1']).toBe('LOCKED');
    expect(entries['1,1']).toBe('UNKNOWN');
  });

  it("uses the run's reach", () => {
    const entries = chunkEntries(source, fresh(), 'vanilla', new Set());
    expect(entries[`${lumbridge.cx},${lumbridge.cy}`]).toBe('NOT_READY');
    expect(entries['1,2']).toBe('NOT_READY');
  });

  it("passes each entrance chunk's own requirements to its interiors", () => {
    const gated = { ...source, chunkEntryRequirements: () => ['Ratcatchers Complete the quest'] };
    expect(chunkEntries(gated, fresh(), 'vanilla')['1,2']).toBe('NOT_READY');
  });
});
