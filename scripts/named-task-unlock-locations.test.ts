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
        { kind: 'wiki', url: 'https://oldschool.runescape.wiki/w/Example_Cave?oldid=100', revision: '100' },
        {
          kind: 'coordinate',
          source: 'Explv game-cache map tile',
          url: 'https://raw.githubusercontent.com/Explv/osrs_map_tiles/1234567890abcdef1234567890abcdef12345678/0/11/1/2.png',
          revision: '1234567890abcdef1234567890abcdef12345678',
        },
      ],
      note: 'Two independently reachable entrances.',
    },
    {
      name: 'Example Instance',
      sourceKeys: ['Example Instance'],
      disposition: 'instance-only',
      sources: [{ kind: 'wiki', url: 'https://oldschool.runescape.wiki/w/Example_Instance?oldid=200', revision: '200' }],
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

  it('rejects missing, invalid, or count-inconsistent mapping kinds', () => {
    const missing = clone(validRegistry);
    delete (missing.locations[0] as { mappingKind?: unknown }).mappingKind;
    expect(() => validateNamedTaskUnlockRegistry(missing, context))
      .toThrow('Invalid named task-unlock mapping kind for Example Cave: undefined');

    const invalid = clone(validRegistry);
    invalid.locations[0].mappingKind = 'portal-network';
    expect(() => validateNamedTaskUnlockRegistry(invalid, context))
      .toThrow('Invalid named task-unlock mapping kind for Example Cave: portal-network');

    const wrongCount = clone(validRegistry);
    wrongCount.locations[0].mappingKind = 'single-entrance';
    expect(() => validateNamedTaskUnlockRegistry(wrongCount, context))
      .toThrow('Single-entrance named task-unlock location has 2 entrances: Example Cave');
  });

  it('rejects unpinned, incomplete, and unsupported sources', () => {
    const unpinnedWiki = clone(validRegistry);
    unpinnedWiki.locations[0].sources[0].url = 'https://oldschool.runescape.wiki/w/Example_Cave';
    expect(() => validateNamedTaskUnlockRegistry(unpinnedWiki, context))
      .toThrow('Named task-unlock Wiki source is not pinned to revision 100 for Example Cave');

    const unsupported = clone(validRegistry);
    unsupported.locations[0].sources[0].kind = 'search-result';
    expect(() => validateNamedTaskUnlockRegistry(unsupported, context))
      .toThrow('Invalid named task-unlock source kind for Example Cave: search-result');

    const nonHttps = clone(validRegistry);
    nonHttps.locations[0].sources[0].url = 'http://oldschool.runescape.wiki/w/Example_Cave?oldid=100';
    expect(() => validateNamedTaskUnlockRegistry(nonHttps, context))
      .toThrow('Named task-unlock source has no permanent HTTPS URL for Example Cave');

    const missingRevision = clone(validRegistry);
    missingRevision.locations[0].sources[0].revision = '';
    expect(() => validateNamedTaskUnlockRegistry(missingRevision, context))
      .toThrow('Named task-unlock source has no revision for Example Cave');
  });

  it('rejects coordinate evidence that is generic or not pinned to its artifact revision', () => {
    const genericCommit = clone(validRegistry);
    genericCommit.locations[0].sources[1].url = 'https://github.com/Explv/osrs_map_tiles/commit/1234567890abcdef1234567890abcdef12345678';
    expect(() => validateNamedTaskUnlockRegistry(genericCommit, context))
      .toThrow('Named task-unlock coordinate source is not a pinned artifact for Example Cave');

    const unpinnedArtifact = clone(validRegistry);
    unpinnedArtifact.locations[0].sources[1].url = 'https://raw.githubusercontent.com/Explv/osrs_map_tiles/main/0/11/1/2.png';
    expect(() => validateNamedTaskUnlockRegistry(unpinnedArtifact, context))
      .toThrow('Named task-unlock coordinate source is not a pinned artifact for Example Cave');

    const unnamed = clone(validRegistry);
    unnamed.locations[0].sources[1].source = '';
    expect(() => validateNamedTaskUnlockRegistry(unnamed, context))
      .toThrow('Named task-unlock coordinate source has no source name for Example Cave');
  });

  it('rejects incomplete entrance metadata and malformed requirements', () => {
    const blankLabel = clone(validRegistry);
    blankLabel.locations[0].entrances[0].label = ' ';
    expect(() => validateNamedTaskUnlockRegistry(blankLabel, context))
      .toThrow('Named task-unlock entrance has no label for Example Cave');

    const blankWikiPage = clone(validRegistry);
    blankWikiPage.locations[0].entrances[0].wikiPage = '';
    expect(() => validateNamedTaskUnlockRegistry(blankWikiPage, context))
      .toThrow('Named task-unlock entrance has no Wiki page for Example Cave / Entrance to Example Cave');

    const missingRequirements = clone(validRegistry);
    delete (missingRequirements.locations[0].entrances[0] as { requirements?: unknown }).requirements;
    expect(() => validateNamedTaskUnlockRegistry(missingRequirements, context))
      .toThrow('Named task-unlock entrance requirements are not an array for Example Cave / Entrance to Example Cave');

    const blankRequirement = clone(validRegistry);
    blankRequirement.locations[0].entrances[0].requirements = [' '];
    expect(() => validateNamedTaskUnlockRegistry(blankRequirement, context))
      .toThrow('Named task-unlock entrance has a blank requirement for Example Cave / Entrance to Example Cave');
  });

  it('rejects fractional entrance coordinates', () => {
    const registry = clone(validRegistry);
    registry.locations[0].entrances[0].x = 64.5;

    expect(() => validateNamedTaskUnlockRegistry(registry, context))
      .toThrow('Named task-unlock entrance has non-integral coordinates for Example Cave / Entrance to Example Cave');
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
      mappingKind: 'single-entrance',
      entrances: [{ chunkId: '256', x: 64, y: 0, label: 'Entrance to Example Grotto', wikiPage: 'Example_Grotto', requirements: [] }],
      sources: [{ kind: 'wiki', url: 'https://oldschool.runescape.wiki/w/Example_Grotto?oldid=300', revision: '300' }],
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
