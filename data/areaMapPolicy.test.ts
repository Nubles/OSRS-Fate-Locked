import { describe, expect, it } from 'vitest';
import { REGION_CHUNKS } from './regionChunks';
import { SUB_AREA_CHUNKS } from './subAreaChunks';
import { REGIONS_LIST } from './items';
import {
  AREA_ALIASES,
  AREA_REFERENCES,
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

const EXPECTED_EXCEPTIONAL_NAMES = [
  'Asgarnian Ice Dungeon',
  'Braindeath Island',
  'Catacombs of Kourend',
  'Dwarven Mine',
  'Elf Camp',
  "Giants' Plateau",
  "Heroes' Guild",
  'Ice Mountain',
  'Keldagrim',
  'Mor Ul Rek (TzHaar City)',
  'Motherlode Mine',
  "Otto's Grotto",
  'Ranging Guild',
  'Resource Area',
  'Tutorial Island',
  'Wilderness God Wars Dungeon',
  'Zanaris',
];

describe('area map policy', () => {
  it('classifies the exact seventeen audited exceptional names', () => {
    const exceptional = new Set([
      ...Object.keys(AREA_ALIASES),
      ...Object.keys(AREA_REFERENCES),
      ...Object.keys(INTENTIONALLY_UNMAPPABLE_AREAS),
    ]);
    expect(sorted(exceptional)).toEqual(sorted(EXPECTED_EXCEPTIONAL_NAMES));
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
