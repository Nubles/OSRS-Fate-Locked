import { describe, expect, it } from 'vitest';
import { REGION_CHUNKS } from './regionChunks';
import { SUB_AREA_CHUNKS } from './subAreaChunks';
import { REGIONS_LIST } from './items';
import {
  AREA_ALIASES,
  AREA_REFERENCES,
  type AreaReference,
  INTENTIONALLY_UNMAPPABLE_AREAS,
  canonicalAreaName,
  canonicalizeAreaUnlocks,
} from './areaMapPolicy';

const sorted = (values: Iterable<string>) => [...values].sort();

const AUTHORED_CHUNKS = new Set(
  Object.values(REGION_CHUNKS)
    .flat()
    .map(({ cx, cy }) => `${cx},${cy}`),
);

const EXPECTED_SURFACE_REFERENCE_NAMES = [
  "Giants' Plateau",
  "Heroes' Guild",
  'Ice Mountain',
  "Otto's Grotto",
  'Ranging Guild',
  'Resource Area',
];

const EXPECTED_ENTRANCE_REFERENCE_NAMES = [
  'Asgarnian Ice Dungeon',
  'Braindeath Island',
  'Catacombs of Kourend',
  'Dwarven Mine',
  'Keldagrim',
  'Mor Ul Rek (TzHaar City)',
  'Motherlode Mine',
  'Wilderness God Wars Dungeon',
  'Zanaris',
];

const EMPTY_REFERENCE_FOR_TYPE_CHECK: AreaReference = {
  kind: 'surface',
  // @ts-expect-error AreaReference chunks must contain at least one coordinate.
  chunks: [],
  reason: 'Compile-time non-empty tuple check.',
};
void EMPTY_REFERENCE_FOR_TYPE_CHECK;

describe('area map policy', () => {
  it('pins the exact legacy alias mapping', () => {
    expect(AREA_ALIASES).toEqual({
      'Elf Camp': 'Iorwerth Camp',
    });
  });

  it('pins the exact surface and entrance reference classifications', () => {
    const surface = Object.entries(AREA_REFERENCES)
      .filter(([, policy]) => policy.kind === 'surface')
      .map(([name]) => name);
    const entrance = Object.entries(AREA_REFERENCES)
      .filter(([, policy]) => policy.kind === 'entrance')
      .map(([name]) => name);

    expect(sorted(surface)).toEqual(EXPECTED_SURFACE_REFERENCE_NAMES);
    expect(sorted(entrance)).toEqual(EXPECTED_ENTRANCE_REFERENCE_NAMES);
  });

  it('pins the exact intentionally unmappable area set', () => {
    expect(sorted(Object.keys(INTENTIONALLY_UNMAPPABLE_AREAS))).toEqual([
      'Tutorial Island',
    ]);
  });

  it('requires every reference to have at least one coordinate', () => {
    for (const [name, policy] of Object.entries(AREA_REFERENCES)) {
      expect(policy.chunks.length, name).toBeGreaterThan(0);
    }
  });

  it('requires every reference to have a nonblank reason', () => {
    for (const [name, policy] of Object.entries(AREA_REFERENCES)) {
      expect(policy.reason.trim(), name).not.toBe('');
    }
  });

  it('requires every exemption to have a nonblank reason', () => {
    for (const [name, reason] of Object.entries(INTENTIONALLY_UNMAPPABLE_AREAS)) {
      expect(reason.trim(), name).not.toBe('');
    }
  });

  it('gives every rollable area exactly one current geography route', () => {
    const invalid = REGIONS_LIST
      .map((name) => ({
        name,
        routes: Number(Object.hasOwn(SUB_AREA_CHUNKS, name))
          + Number(Object.hasOwn(AREA_REFERENCES, name))
          + Number(Object.hasOwn(INTENTIONALLY_UNMAPPABLE_AREAS, name)),
      }))
      .filter(({ routes }) => routes !== 1);

    expect(invalid).toEqual([]);
  });

  it('keeps aliases out of rolls and points them directly at current areas', () => {
    for (const [legacy, canonical] of Object.entries(AREA_ALIASES)) {
      expect(REGIONS_LIST, legacy).not.toContain(legacy);
      expect(REGIONS_LIST, canonical).toContain(canonical);
      expect(Object.hasOwn(AREA_ALIASES, canonical), canonical).toBe(false);
      expect(canonicalAreaName(legacy)).toBe(canonical);
    }
  });

  it('uses only authored chunks for surface and entrance references', () => {
    const invalid = Object.entries(AREA_REFERENCES).flatMap(([name, policy]) =>
      policy.chunks
        .filter(({ cx, cy }) => !AUTHORED_CHUNKS.has(`${cx},${cy}`))
        .map(({ cx, cy }) => `${name}: ${cx},${cy}`),
    );
    expect(invalid).toEqual([]);
  });

  it('uses current areas for references and exemptions without overlap', () => {
    const referenced = Object.keys(AREA_REFERENCES);
    const exempted = Object.keys(INTENTIONALLY_UNMAPPABLE_AREAS);
    expect(referenced.filter((name) => !REGIONS_LIST.includes(name))).toEqual([]);
    expect(exempted.filter((name) => !REGIONS_LIST.includes(name))).toEqual([]);
    expect(referenced.filter((name) => exempted.includes(name))).toEqual([]);
  });

  it('canonicalizes legacy names, preserves order, and reports only paid duplicates', () => {
    expect(canonicalizeAreaUnlocks(['Elf Camp', 'Prifddinas'])).toEqual({
      regions: ['Iorwerth Camp', 'Prifddinas'],
      duplicateAliasRefunds: 0,
      migrated: true,
    });
    expect(canonicalizeAreaUnlocks([
      'Prifddinas',
      'Elf Camp',
      'Iorwerth Camp',
      'Lletya',
    ])).toEqual({
      regions: ['Prifddinas', 'Iorwerth Camp', 'Lletya'],
      duplicateAliasRefunds: 1,
      migrated: true,
    });
    expect(canonicalizeAreaUnlocks(['Prifddinas', 'Iorwerth Camp'])).toEqual({
      regions: ['Prifddinas', 'Iorwerth Camp'],
      duplicateAliasRefunds: 0,
      migrated: false,
    });
  });
});
