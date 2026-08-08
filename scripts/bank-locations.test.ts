import { describe, expect, it } from 'vitest';
import { readPinnedChunkSource } from './chunk-source.mjs';
import {
  bankLocationLabels,
  readBankLocationRegistry,
  validateBankLocationRegistry,
} from './bank-locations.mjs';

const ADDITION_IDS = [
  '5678', '6454', '6458', '6711', '6712', '6961', '7225', '8499',
  '8508', '8751', '8756', '8757', '8999', '9274', '10553', '11047',
  '11056', '11062', '11572', '11578', '12082', '12337', '12838',
  '12849', '14132',
];

describe('reviewed bank-location registry', () => {
  it('contains the exact reviewed addition set and validates against walkable chunks', async () => {
    const registry = readBankLocationRegistry();
    const { data } = await readPinnedChunkSource();
    const validChunkIds = new Set((data.walkableChunks ?? []).map(String));

    expect(() => validateBankLocationRegistry(registry, { validChunkIds })).not.toThrow();
    expect(registry.locations.map(({ id }: { id: string }) => id).sort((a: string, b: string) => +a - +b))
      .toEqual([...ADDITION_IDS].sort((a, b) => +a - +b));
    expect(new Set(registry.locations.map(({ id }: { id: string }) => id)).size).toBe(25);
  });

  it('keeps canonical coordinates, unique names, reviewed labels, and exclusions explicit', () => {
    const registry = readBankLocationRegistry();
    const labels = bankLocationLabels(registry);

    for (const location of registry.locations) {
      expect(location.id).toBe(String(location.cx * 256 + location.cy));
    }
    expect(new Set(registry.locations.map(({ name }: { name: string }) => name))).toHaveLength(25);
    expect(labels.get('10275')).toBe('Wyrmscraig bank chest');
    expect(labels.get('11830')).toBe('Ruins of Camdozaal (via Ice Mountain)');
    expect(registry.exclusions.map(({ name }: { name: string }) => name)).toContain('Woodcutting Leprechaun');
    expect(registry.locations.some(({ name }: { name: string }) => /Woodcutting Leprechaun/i.test(name))).toBe(false);
  });

  it('rejects duplicate ids and coordinate mismatches', () => {
    const registry = readBankLocationRegistry();
    const duplicate = structuredClone(registry);
    duplicate.locations.push(structuredClone(duplicate.locations[0]));
    expect(() => validateBankLocationRegistry(duplicate))
      .toThrow(/duplicate bank location id/i);

    const mismatch = structuredClone(registry);
    mismatch.locations[0].cx += 1;
    expect(() => validateBankLocationRegistry(mismatch))
      .toThrow(/canonical chunk id mismatch/i);
  });
});
