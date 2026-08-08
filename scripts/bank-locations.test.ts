import { describe, expect, it } from 'vitest';
import { BANKS } from '../data/banks';
import { readPinnedChunkSource } from './chunk-source.mjs';
import {
  bankLocationLabels,
  bankVirtualLocations,
  readBankLocationRegistry,
  validateBankLocationRegistry,
} from './bank-locations.mjs';

const ADDITION_IDS = [
  '5678', '6454', '6458', '6711', '6712', '6961', '7225', '8499',
  '8508', '8751', '8756', '8757', '8999', '9274', '10553', '11047',
  '11056', '11062', '11572', '11578', '12082', '12337', '12838',
  '12849', '14132',
];

const EXCLUSIONS = [
  { name: 'Tutorial Island bank', reason: 'Onboarding-only and absent from the walkable chunk registry.' },
  { name: 'The Node bank', reason: 'Group Ironman onboarding-only and absent from the walkable chunk registry.' },
  { name: 'Gravedigger Mausoleum', reason: 'Random-event-only internal service without a stable surface entrance.' },
  { name: 'Tool leprechauns', reason: 'Produce-noting service, not a bank or deposit facility.' },
  { name: 'Player-owned house servants', reason: 'Variable-location fetching service, not a fixed bank or deposit facility.' },
  { name: 'Ferox Enclave mercenary', reason: 'Unnoting and token exchange service, not a deposit facility.' },
  { name: 'Removed banks', reason: 'No longer accessible in normal play.' },
];

const TEST_VALIDATION_OPTIONS = {
  validChunkIds: new Set(ADDITION_IDS),
  validBankIds: new Set(['10275', '11830']),
};

describe('reviewed bank-location registry', () => {
  it('contains the reviewed virtual Woodcutting Leprechaun unlock outside the physical registry', () => {
    const registry = readBankLocationRegistry();

    expect(registry.virtualLocations).toEqual([
      expect.objectContaining({
        id: 'woodcutting-leprechaun',
        name: 'Woodcutting Leprechaun (Forestry)',
        referenceKind: 'virtual',
        accessVia: 'Variable Forestry woodcutting area; no fixed chunk',
        facilities: ['Woodcutting Leprechaun'],
        wiki: ['https://oldschool.runescape.wiki/w/Forestry_event'],
      }),
    ]);
    expect(registry.locations.some((location: { id: string }) => location.id === 'woodcutting-leprechaun')).toBe(false);
    expect(registry.exclusions.some((exclusion: { name: string }) => exclusion.name === 'Woodcutting Leprechaun')).toBe(false);
  });

  it('exposes virtual bank locations without adding them to physical labels', () => {
    const registry = readBankLocationRegistry();

    expect(bankVirtualLocations(registry)).toHaveLength(1);
    expect(bankVirtualLocations(registry)[0].id).toBe('woodcutting-leprechaun');
    expect(bankLocationLabels(registry).has('woodcutting-leprechaun')).toBe(false);
  });

  it('contains the exact reviewed addition set and validates against walkable chunks', async () => {
    const registry = readBankLocationRegistry();
    const { data } = await readPinnedChunkSource();
    const validChunkIds = new Set((data.walkableChunks ?? []).map(String));
    const validBankIds = new Set((data.rollingChunks?.bank ?? []).map(String));

    expect(() => validateBankLocationRegistry(registry, { validChunkIds, validBankIds })).not.toThrow();
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
    expect(registry.exclusions).toEqual(EXCLUSIONS);

    const locationNames = registry.locations.map(({ name }: { name: string }) => name);
    const facilityNames = registry.locations.flatMap(({ facilities }: { facilities: string[] }) => facilities);
    const generatedLabels = BANKS.map(({ name }) => name);
    for (const { name } of EXCLUSIONS) {
      expect(locationNames).not.toContain(name);
      expect(facilityNames).not.toContain(name);
      expect(generatedLabels).not.toContain(name);
    }
  });

  it('rejects duplicate ids and coordinate mismatches', () => {
    const registry = readBankLocationRegistry();
    const duplicate = structuredClone(registry);
    duplicate.locations.push(structuredClone(duplicate.locations[0]));
    expect(() => validateBankLocationRegistry(duplicate, TEST_VALIDATION_OPTIONS))
      .toThrow(/duplicate bank location id/i);

    const mismatch = structuredClone(registry);
    mismatch.locations[0].cx += 1;
    expect(() => validateBankLocationRegistry(mismatch, TEST_VALIDATION_OPTIONS))
      .toThrow(/canonical chunk id mismatch/i);
  });

  it('rejects a label override with a non-canonical chunk id', () => {
    const registry = structuredClone(readBankLocationRegistry());
    registry.labelOverrides[0].id = '010275';

    expect(() => validateBankLocationRegistry(registry, TEST_VALIDATION_OPTIONS))
      .toThrow(/canonical chunk id/i);
  });

  it('rejects duplicate label override ids before labels can be overwritten', () => {
    const registry = structuredClone(readBankLocationRegistry());
    registry.labelOverrides.push({
      id: '10275',
      name: 'Replacement Wyrmscraig label',
      wiki: [''],
    });

    expect(() => validateBankLocationRegistry(registry, TEST_VALIDATION_OPTIONS))
      .toThrow(/duplicate bank label override id/i);
  });

  it('rejects a label override that does not target a known bank', () => {
    const registry = structuredClone(readBankLocationRegistry());
    registry.labelOverrides[0].id = '999999';

    expect(() => validateBankLocationRegistry(registry, TEST_VALIDATION_OPTIONS))
      .toThrow(/does not target a valid bank/i);
  });

  it('rejects blank facility evidence', () => {
    const registry = structuredClone(readBankLocationRegistry());
    registry.locations[0].facilities = [''];

    expect(() => validateBankLocationRegistry(registry, TEST_VALIDATION_OPTIONS))
      .toThrow(/facility must be a non-empty string/i);
  });

  it('rejects blank location Wiki evidence', () => {
    const registry = structuredClone(readBankLocationRegistry());
    registry.locations[0].wiki = [''];

    expect(() => validateBankLocationRegistry(registry, TEST_VALIDATION_OPTIONS))
      .toThrow(/Wiki evidence must be a non-empty string/i);
  });

  it('rejects blank label override Wiki evidence', () => {
    const registry = structuredClone(readBankLocationRegistry());
    registry.labelOverrides[0].wiki = [''];

    expect(() => validateBankLocationRegistry(registry, TEST_VALIDATION_OPTIONS))
      .toThrow(/Wiki evidence must be a non-empty string/i);
  });

  it('rejects location Wiki evidence absent from the reviewed source revisions', () => {
    const registry = structuredClone(readBankLocationRegistry());
    registry.locations[0].wiki = ['https://oldschool.runescape.wiki/w/Unreviewed_location'];

    expect(() => validateBankLocationRegistry(registry, TEST_VALIDATION_OPTIONS))
      .toThrow(/Wiki evidence is not covered by source revisions/i);
  });

  it('rejects label override Wiki evidence absent from the reviewed source revisions', () => {
    const registry = structuredClone(readBankLocationRegistry());
    registry.labelOverrides[0].wiki = ['https://oldschool.runescape.wiki/w/Unreviewed_override'];

    expect(() => validateBankLocationRegistry(registry, TEST_VALIDATION_OPTIONS))
      .toThrow(/Wiki evidence is not covered by source revisions/i);
  });

  it('rejects a numeric virtual id', () => {
    const registry = structuredClone(readBankLocationRegistry());
    registry.virtualLocations[0].id = '12345';

    expect(() => validateBankLocationRegistry(registry, TEST_VALIDATION_OPTIONS))
      .toThrow(/stable virtual bank id/i);
  });

  it('rejects duplicate virtual ids', () => {
    const registry = structuredClone(readBankLocationRegistry());
    registry.virtualLocations.push(structuredClone(registry.virtualLocations[0]));

    expect(() => validateBankLocationRegistry(registry, TEST_VALIDATION_OPTIONS))
      .toThrow(/duplicate virtual bank id/i);
  });

  it('rejects virtual ids that collide with physical location ids', () => {
    const registry = structuredClone(readBankLocationRegistry());
    registry.virtualLocations[0].id = registry.locations[0].id;

    expect(() => validateBankLocationRegistry(registry, TEST_VALIDATION_OPTIONS))
      .toThrow(/stable virtual bank id|collides with a physical location/i);
  });

  it('rejects a blank virtual access route', () => {
    const registry = structuredClone(readBankLocationRegistry());
    registry.virtualLocations[0].accessVia = '';

    expect(() => validateBankLocationRegistry(registry, TEST_VALIDATION_OPTIONS))
      .toThrow(/accessVia must be a non-empty string/i);
  });

  it('rejects blank virtual facilities', () => {
    const registry = structuredClone(readBankLocationRegistry());
    registry.virtualLocations[0].facilities = [''];

    expect(() => validateBankLocationRegistry(registry, TEST_VALIDATION_OPTIONS))
      .toThrow(/facility must be a non-empty string/i);
  });

  it('rejects blank virtual Wiki evidence', () => {
    const registry = structuredClone(readBankLocationRegistry());
    registry.virtualLocations[0].wiki = [''];

    expect(() => validateBankLocationRegistry(registry, TEST_VALIDATION_OPTIONS))
      .toThrow(/Wiki evidence must be a non-empty string/i);
  });

  it('rejects virtual Wiki evidence absent from the reviewed source revisions', () => {
    const registry = structuredClone(readBankLocationRegistry());
    registry.virtualLocations[0].wiki = ['https://oldschool.runescape.wiki/w/Unreviewed_virtual'];

    expect(() => validateBankLocationRegistry(registry, TEST_VALIDATION_OPTIONS))
      .toThrow(/Wiki evidence is not covered by source revisions/i);
  });
});
