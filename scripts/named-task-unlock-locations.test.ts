import { describe, expect, it } from 'vitest';
import { readPinnedChunkSource } from './chunk-source.mjs';
import {
  buildEntranceIndex,
  collectNamedTaskUnlockSourceInventory,
  indexNamedTaskUnlockRegistry,
  readNamedTaskUnlockRegistry,
  validateNamedTaskUnlockRegistry,
} from './named-task-unlock-locations.mjs';

const manifest = { commit: '4eb75a8454eb41cfff71b70819326e0e67bcea7c' };

const validRegistry = {
  schemaVersion: 1,
  policyVersion: 1,
  sourceRepository: 'source-chunk/chunk-picker-v2',
  sourceCommit: manifest.commit,
  reviewedAt: '2026-08-03',
  locations: [
    {
      name: 'Example Cave',
      sourceKeys: ['Example Cave', 'Example Cave#Lower level'],
      disposition: 'mapped',
      mappingKind: 'multiple-entrances',
      entrances: [
        { chunkId: '256', x: 64, y: 0, label: 'Entrance to Example Cave', wikiPage: 'Example_Cave', requirements: [] },
        { chunkId: '513', x: 128, y: 64, label: 'Eastern entrance to Example Cave', wikiPage: 'Example_Cave', requirements: ['Example Quest'] },
      ],
      sources: [
        { kind: 'wiki', url: 'https://oldschool.runescape.wiki/w/Example_Cave', revision: '100' },
        { kind: 'coordinate', source: 'RuneLite cache', revision: 'cache-1' },
      ],
      note: 'Two independently reachable entrances.',
    },
    {
      name: 'Example Instance',
      sourceKeys: ['Example Instance'],
      disposition: 'instance-only',
      sources: [{ kind: 'wiki', url: 'https://oldschool.runescape.wiki/w/Example_Instance', revision: '200' }],
      note: 'Created only inside the activity instance.',
    },
  ],
};

const context = {
  sourceCommit: manifest.commit,
  sourceLocationKeys: ['Example Cave', 'Example Cave#Lower level', 'Example Instance'],
  validChunkIds: new Set(['256', '513']),
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

describe('named task-unlock registry', () => {
  it('covers every named task-unlock row in the pinned production source', async () => {
    const { data, manifest: sourceManifest } = await readPinnedChunkSource();
    const { rows, locationKeys } = collectNamedTaskUnlockSourceInventory(data);
    const registry = readNamedTaskUnlockRegistry();

    expect(rows).toHaveLength(140);
    expect(locationKeys).toHaveLength(47);
    expect(() => validateNamedTaskUnlockRegistry(registry, {
      sourceCommit: sourceManifest.commit,
      sourceLocationKeys: locationKeys,
      validChunkIds: new Set((data.walkableChunks ?? []).map(String)),
    })).not.toThrow();

    const entranceIndex = buildEntranceIndex(registry);
    const indexedRows = Object.entries(entranceIndex).flatMap(([chunkId, entrances]) =>
      entrances.map((entrance) => JSON.stringify([chunkId, entrance.location, entrance.label])),
    );
    expect(new Set(indexedRows).size).toBe(indexedRows.length);
    expect(buildEntranceIndex(clone(registry))).toEqual(entranceIndex);
  });

  it('reads the versioned production registry', () => {
    const registry = readNamedTaskUnlockRegistry();

    expect(registry).toMatchObject({
      schemaVersion: 1,
      policyVersion: 1,
      sourceRepository: 'source-chunk/chunk-picker-v2',
      sourceCommit: manifest.commit,
      reviewedAt: '2026-08-03',
    });
    expect(registry.locations).toHaveLength(46);
    expect(indexNamedTaskUnlockRegistry(registry).size).toBe(47);
  });

  it('collects named source locations while excluding numeric task-unlock keys', () => {
    expect(collectNamedTaskUnlockSourceInventory({
      taskUnlocks: {
        Quests: {
          'Example Quest': { 'Example Cave': {}, '256-0': {}, 'Example Cave#Lower level': {} },
          'Already chunked': ['256'],
        },
      },
    })).toEqual({
      rows: ['Quests/Example Quest/Example Cave', 'Quests/Example Quest/Example Cave#Lower level'],
      locationKeys: ['Example Cave', 'Example Cave#Lower level'],
    });
  });

  it('validates exact source coverage and builds searchable indexes', () => {
    expect(() => validateNamedTaskUnlockRegistry(validRegistry, context)).not.toThrow();
    expect(indexNamedTaskUnlockRegistry(validRegistry).get('Example Cave#Lower level')?.name)
      .toBe('Example Cave');
    expect(buildEntranceIndex(validRegistry)).toEqual({
      256: [{ location: 'Example Cave', label: 'Entrance to Example Cave', wikiPage: 'Example_Cave', requirements: [] }],
      513: [{ location: 'Example Cave', label: 'Eastern entrance to Example Cave', wikiPage: 'Example_Cave', requirements: ['Example Quest'] }],
    });
  });

  it('rejects duplicate source keys', () => {
    const registry = clone(validRegistry);
    registry.locations[1].sourceKeys = ['Example Cave'];

    expect(() => validateNamedTaskUnlockRegistry(registry, context))
      .toThrow('Duplicate named task-unlock source key: Example Cave');
  });

  it('rejects missing source keys', () => {
    const registry = clone(validRegistry);
    registry.locations[1].sourceKeys = [];

    expect(() => validateNamedTaskUnlockRegistry(registry, context))
      .toThrow('Missing named task-unlock source key: Example Instance');
  });

  it('rejects a stale source commit', () => {
    const registry = clone(validRegistry);
    registry.sourceCommit = 'stale';

    expect(() => validateNamedTaskUnlockRegistry(registry, context))
      .toThrow('Named task-unlock source commit mismatch: expected 4eb75a8454eb41cfff71b70819326e0e67bcea7c, received stale');
  });

  it('rejects entrances outside the canonical chunk list', () => {
    const registry = clone(validRegistry);
    registry.locations[0].entrances[0].chunkId = '999';

    expect(() => validateNamedTaskUnlockRegistry(registry, context))
      .toThrow('Unknown named task-unlock chunk ID: 999');
  });

  it('rejects mapped records without entrances', () => {
    const registry = clone(validRegistry);
    registry.locations[0].entrances = [];

    expect(() => validateNamedTaskUnlockRegistry(registry, context))
      .toThrow('Mapped named task-unlock location has no entrances: Example Cave');
  });

  it('rejects exclusion records with entrances', () => {
    const registry = clone(validRegistry);
    registry.locations[1].entrances = [clone(registry.locations[0].entrances[0])];

    expect(() => validateNamedTaskUnlockRegistry(registry, context))
      .toThrow('Excluded named task-unlock location has entrances: Example Instance');
  });

  it('rejects records without evidence or a note', () => {
    const registry = clone(validRegistry);
    registry.locations[0].sources = [];
    registry.locations[0].note = '';

    expect(() => validateNamedTaskUnlockRegistry(registry, context)).toThrow(
      'Named task-unlock location has no sources: Example Cave',
    );
    expect(() => validateNamedTaskUnlockRegistry(registry, context)).toThrow(
      'Named task-unlock location has no note: Example Cave',
    );
  });

  it('rejects duplicate entrance labels within a chunk', () => {
    const registry = clone(validRegistry);
    registry.locations[0].entrances[1] = {
      ...registry.locations[0].entrances[1],
      chunkId: '256',
      x: 64,
      y: 0,
      label: 'Entrance to Example Cave',
    };

    expect(() => validateNamedTaskUnlockRegistry(registry, context))
      .toThrow('Duplicate named task-unlock entrance label in chunk 256: Entrance to Example Cave');
  });

  it('rejects entrance coordinates that disagree with their chunk ID', () => {
    const registry = clone(validRegistry);
    registry.locations[0].entrances[0].x = 0;

    expect(() => validateNamedTaskUnlockRegistry(registry, context))
      .toThrow('Named task-unlock entrance chunk mismatch for Example Cave / Entrance to Example Cave: expected 0, received 256');
  });


  it('rejects a mapped entrance without an x coordinate', () => {
    const registry = clone(validRegistry);
    delete (registry.locations[0].entrances[0] as { x?: unknown }).x;

    expect(() => validateNamedTaskUnlockRegistry(registry, context))
      .toThrow('Named task-unlock entrance has invalid coordinates for Example Cave / Entrance to Example Cave');
  });

  it('rejects a mapped entrance without a y coordinate', () => {
    const registry = clone(validRegistry);
    delete (registry.locations[0].entrances[0] as { y?: unknown }).y;

    expect(() => validateNamedTaskUnlockRegistry(registry, context))
      .toThrow('Named task-unlock entrance has invalid coordinates for Example Cave / Entrance to Example Cave');
  });

  it('rejects a mapped entrance with nonnumeric coordinates', () => {
    const registry = clone(validRegistry);
    (registry.locations[0].entrances[0] as { x: unknown }).x = 'north';

    expect(() => validateNamedTaskUnlockRegistry(registry, context))
      .toThrow('Named task-unlock entrance has invalid coordinates for Example Cave / Entrance to Example Cave');
  });

  it('indexes distinct named entrances that share one paid chunk', () => {
    const registry = clone(validRegistry);
    registry.locations.push({
      name: 'Example Grotto',
      sourceKeys: ['Example Grotto'],
      disposition: 'mapped',
      entrances: [{ chunkId: '256', x: 64, y: 0, label: 'Entrance to Example Grotto', wikiPage: 'Example_Grotto', requirements: [] }],
      sources: [{ kind: 'wiki', url: 'https://oldschool.runescape.wiki/w/Example_Grotto', revision: '300' }],
      note: 'A separate named entrance shares this physical chunk.',
    });
    const sharedChunkContext = { ...context, sourceLocationKeys: [...context.sourceLocationKeys, 'Example Grotto'] };

    expect(() => validateNamedTaskUnlockRegistry(registry, sharedChunkContext)).not.toThrow();
    expect(buildEntranceIndex(registry)[256]).toEqual([
      { location: 'Example Cave', label: 'Entrance to Example Cave', wikiPage: 'Example_Cave', requirements: [] },
      { location: 'Example Grotto', label: 'Entrance to Example Grotto', wikiPage: 'Example_Grotto', requirements: [] },
    ]);
  });

  it('deduplicates equivalent entrances and sorts labels within numeric chunks', () => {
    const registry = clone(validRegistry);
    registry.locations[0].entrances.push(clone(registry.locations[0].entrances[0]));
    registry.locations[0].entrances.push({
      chunkId: '256', x: 64, y: 0, label: 'A second entrance', wikiPage: 'Example_Cave', requirements: [],
    });

    expect(buildEntranceIndex(registry)).toEqual({
      256: [
        { location: 'Example Cave', label: 'A second entrance', wikiPage: 'Example_Cave', requirements: [] },
        { location: 'Example Cave', label: 'Entrance to Example Cave', wikiPage: 'Example_Cave', requirements: [] },
      ],
      513: [{ location: 'Example Cave', label: 'Eastern entrance to Example Cave', wikiPage: 'Example_Cave', requirements: ['Example Quest'] }],
    });
  });
});
