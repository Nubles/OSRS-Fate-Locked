import { describe, expect, it } from 'vitest';
// @ts-expect-error Node types are intentionally excluded from the browser app.
import { readFileSync } from 'node:fs';
import type { ItemSourceRecord } from '../../services/ChunkContentService';
import { indexDirectItemSources } from './chunkSourceIndex';
import { chunkKey, type ItemRef } from './model';

const plank: ItemRef = { key: 'plank', name: 'Plank' };
const records: readonly ItemSourceRecord[] = [
  {
    itemName: 'Plank', kind: 'spawn', hostName: 'Plank', cx: 1, cy: 2,
    rawRequirements: [{ raw: 'Enter the locked cave', origin: 'ENTITY' }],
  },
  {
    itemName: 'Plank', kind: 'shop', hostName: 'Timber merchant', cx: 3, cy: 4,
    rawRequirements: [{ raw: 'Complete the merchant favour', origin: 'ENTITY' }],
  },
  {
    itemName: 'Plank', kind: 'monster', hostName: 'Undead lumberjack', cx: 5, cy: 6,
    rawRequirements: [],
  },
];

describe('indexDirectItemSources', () => {
  it('does not infer complete direct-family coverage from an empty callback', () => {
    const result = indexDirectItemSources(plank, {
      unlockedChunks: new Set(),
      recordsForClass: () => [],
      hasKnownOutsideSources: () => false,
    });

    expect(result.directCoverage).toBe('PARTIAL');
  });

  it('keeps exact provenance while separating unlocked and outside sources', () => {
    const unlockedChunks = new Set([chunkKey(3, 4)]);
    const currentRecords = records.filter(record => (
      unlockedChunks.has(chunkKey(record.cx, record.cy))
    ));
    const advisoryRecords = records.filter(record => (
      !unlockedChunks.has(chunkKey(record.cx, record.cy))
    ));
    const result = indexDirectItemSources(plank, {
      unlockedChunks,
      recordsForClass: (itemName, searchClass) => {
        if (itemName !== 'Plank') return [];
        return searchClass === 'current' ? currentRecords : advisoryRecords;
      },
      hasKnownOutsideSources: itemName => (
        itemName === 'Plank' && advisoryRecords.length > 0
      ),
      sourceCoverage: () => ({ direct: 'COMPLETE', transformation: 'COMPLETE' }),
    });

    expect(result.directCoverage).toBe('COMPLETE');
    expect(result.currentSources).toEqual([
      expect.objectContaining({
        id: 'shop:Timber merchant:3,4:plank',
        kind: 'SHOP',
        label: 'Timber merchant',
        hostName: 'Timber merchant',
        chunk: '3,4',
        rawRequirements: [{ raw: 'Complete the merchant favour', origin: 'ENTITY' }],
        gates: [expect.objectContaining({ type: 'UNRESOLVED', raw: 'Complete the merchant favour' })],
        deterministic: true,
      }),
    ]);
    expect(result.currentSources).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ chunk: '1,2' }),
    ]));
    expect(result.knownOutsideSources).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'SPAWN', hostName: 'Plank', chunk: '1,2' }),
      expect.objectContaining({ kind: 'DROP', hostName: 'Undead lumberjack', chunk: '5,6' }),
    ]));
  });

  it('keeps the first source ID at a host and chunk and marks later interior variants', () => {
    const cyclops = (sourceId?: string, raw: readonly string[] = []): ItemSourceRecord => ({
      itemName: 'Plank', kind: 'monster', hostName: 'Cyclops', cx: 44, cy: 55,
      ...(sourceId === undefined ? {} : { sourceId }),
      rawRequirements: raw.map(requirement => ({ raw: requirement, origin: 'ENTITY' as const })),
    });
    const sourcesFor = (current: readonly ItemSourceRecord[]) => indexDirectItemSources(plank, {
      unlockedChunks: new Set([chunkKey(44, 55)]),
      recordsForClass: (_itemName, searchClass) => searchClass === 'current' ? current : [],
      hasKnownOutsideSources: () => false,
    }).currentSources.map(source => ({ id: source.id, accessVariant: source.accessVariant ?? false }));

    expect(sourcesFor([cyclops(undefined, ["Access the Warriors' Guild"]), cyclops('11675')])).toEqual([
      { id: 'monster:Cyclops:44,55:plank', accessVariant: false },
      { id: 'monster:Cyclops:44,55:plank:11675', accessVariant: true },
    ]);
    // An interior that is the first source there keeps the ID it always had.
    expect(sourcesFor([cyclops('11675'), cyclops('22000')])).toEqual([
      { id: 'monster:Cyclops:44,55:plank', accessVariant: false },
      { id: 'monster:Cyclops:44,55:plank:22000', accessVariant: true },
    ]);
  });

  it('does not invoke a class index after the work boundary', () => {
    let classLookups = 0;
    const result = indexDirectItemSources(plank, {
      unlockedChunks: new Set(),
      recordsForClass: () => {
        classLookups += 1;
        return records;
      },
      hasKnownOutsideSources: () => true,
    }, {
      hasWorkCapacity: () => false,
      searchClasses: ['current'],
    });

    expect(classLookups).toBe(0);
    expect(result.currentSearchIncomplete).toBe(true);
  });
  it('does not reference the coarse resourceData map', () => {
    const moduleSource = readFileSync(new URL('./chunkSourceIndex.ts', import.meta.url), 'utf8');
    expect(moduleSource).not.toMatch(/\bresourceData\b/);
  });
});
