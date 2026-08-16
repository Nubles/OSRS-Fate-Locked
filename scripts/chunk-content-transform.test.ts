import { describe, expect, it } from 'vitest';
import { assertChunkTransform, assertChunkTransformBase, transformChunkContent } from './chunk-content-transform.mjs';
import { buildEntranceIndex } from './named-task-unlock-locations.mjs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readPinnedChunkSource, writeApprovedChunkSource } from './chunk-source.mjs';

const manifest = {
  schemaVersion: 1,
  repository: 'source-chunk/chunk-picker-v2',
  branch: 'gh-pages',
  exportPath: 'chunkpicker-chunkinfo-export.json',
  commit: 'ba2fcebf8b26c84c74f8d9ab328a0ede802be926',
  blobSha: '6674e5c62cd7a6ec90267def278aca5bc1f05a06',
  rawSha256: '95E4864651E2A9C7D4555C4EBBE4DD4AB5E71B881FF18BC966799CD22D48C167',
  rawBytes: 7802950,
  policyVersion: 2,
  reviewedAt: '2026-07-28',
  sourceUrl: 'https://github.com/source-chunk/chunk-picker-v2',
  countFloors: {},
};
const manifestForRaw = (
  raw: Buffer,
  overrides: { commit?: string; countFloors?: Record<string, number> } = {},
) => ({
  commit: 'a9a5c74760eb76dbe39f90d2b04f023fc1de3746',
  rawBytes: raw.length,
  rawSha256: createHash('sha256').update(raw).digest('hex').toUpperCase(),
  blobSha: createHash('sha1').update(`blob ${raw.length}\0`).update(raw).digest('hex'),
  countFloors: {},
  ...overrides,
});

const sourcePreflightTarget = pathToFileURL(join(tmpdir(), 'fate-task3-preflight-no-write.gz'));

const mappedRegistry = {
  schemaVersion: 1,
  policyVersion: 1,
  sourceRepository: 'source-chunk/chunk-picker-v2',
  sourceCommit: manifest.commit,
  reviewedAt: '2026-08-03',
  locations: [{
    name: 'Example Cave',
    sourceKeys: ['Example Cave'],
    disposition: 'mapped',
    mappingKind: 'multiple-entrances',
    entrances: [
      { chunkId: '256', x: 64, y: 0, label: 'Entrance to Example Cave', wikiPage: 'Example_Cave', requirements: [] },
      { chunkId: '256', x: 65, y: 0, label: 'Northern entrance to Example Cave', wikiPage: 'Example_Cave', requirements: [] },
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
    note: 'Two independently reachable chunks, with two entrances in the western chunk.',
  }],
};

const exclusionRegistry = (disposition: 'instance-only' | 'non-purchasable') => ({
  schemaVersion: 1,
  policyVersion: 1,
  sourceRepository: 'source-chunk/chunk-picker-v2',
  sourceCommit: manifest.commit,
  reviewedAt: '2026-08-03',
  locations: [{
    name: `Example ${disposition}`,
    sourceKeys: [`Example ${disposition}`],
    disposition,
    sources: [{
      kind: 'wiki',
      url: `https://oldschool.runescape.wiki/w/Example_${disposition}?oldid=100`,
      revision: '100',
    }],
    note: `This location is ${disposition}.`,
  }],
});
describe('transformChunkContent', () => {
  it('unions reviewed bank locations without changing upstream bank audit accounting', () => {
    const result = transformChunkContent({
      walkableChunks: [256, 512],
      chunks: { 256: { Nickname: 'Upstream bank' }, 512: { Nickname: 'Reviewed bank' } },
      slayerMonsters: {},
      rollingChunks: { bank: ['256'] },
    }, manifest, null, {
      locations: [{ id: '512' }],
    });

    expect(result.full.banks).toEqual(['256', '512']);
    expect(result.audit.categoryTotals.banks).toEqual({
      source: 1, imported: 1, normalized: 0, excluded: 0, unresolved: 0,
    });
  });

  it('keeps the upstream bank floor independent from reviewed locations', () => {
    const upstreamBanks = Array.from({ length: 76 }, (_, index) => String(1000 + index));
    const reviewedBanks = Array.from({ length: 25 }, (_, index) => ({ id: String(2000 + index) }));
    const floorManifest = { ...manifest, countFloors: { banks: 101 } };
    const result = transformChunkContent({
      walkableChunks: [],
      chunks: {},
      slayerMonsters: {},
      rollingChunks: { bank: upstreamBanks },
    }, floorManifest, null, { locations: reviewedBanks });

    expect(result.full.banks).toHaveLength(101);
    expect(() => assertChunkTransformBase(result, floorManifest))
      .toThrow('Chunk transform floor failed for banks: expected at least 101, received 76');
  });

  it('maps named locations to every unique entrance chunk and emits entrance metadata', () => {
    const result = transformChunkContent({
      walkableChunks: [256, 513],
      chunks: { 256: {}, 513: {} },
      slayerMonsters: {},
      taskUnlocks: {
        Monsters: {
          'Cave beast#1': {
            'Example Cave': [
              { 'Quest One Complete the quest': true },
              { 'Quest One Complete the quest': true },
            ],
          },
        },
      },
    }, manifest, mappedRegistry);

    expect(result.full.version).toBe(9);
    expect(result.full.sourceMeta).toMatchObject({
      namedLocationPolicyVersion: 1,
      namedLocationReviewedAt: '2026-08-03',
    });
    expect(result.full.taskUnlocks).toEqual({
      Monsters: {
        'Cave beast': {
          256: ['Quest One'],
          513: ['Quest One'],
        },
      },
    });
    expect(result.full.entrances).toEqual(buildEntranceIndex(mappedRegistry));
    expect(result.audit.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        category: 'taskUnlocks',
        sourceKey: 'Monsters/Cave beast#1/Example Cave',
        terminal: true,
        disposition: 'normalized',
        reason: 'named-location-mapped',
        targetKeys: ['Cave beast/256', 'Cave beast/513'],
      }),
      expect.objectContaining({
        category: 'taskUnlocks',
        sourceKey: 'Monsters/Cave beast#1/Example Cave',
        terminal: false,
        disposition: 'normalized',
        reason: 'variant-name-cleaned',
      }),
      expect.objectContaining({
        category: 'taskUnlocks',
        sourceKey: 'Monsters/Cave beast#1/Example Cave',
        terminal: false,
        disposition: 'normalized',
        reason: 'duplicate-deduped',
      }),
    ]));
  });

  it.each([
    ['instance-only', 'named-location-instance-only'],
    ['non-purchasable', 'named-location-non-purchasable'],
  ] as const)('excludes %s named locations with the reviewed terminal reason', (disposition, reason) => {
    const location = `Example ${disposition}`;
    const result = transformChunkContent({
      walkableChunks: [],
      chunks: {},
      slayerMonsters: {},
      taskUnlocks: { NPCs: { Guide: { [location]: [{ 'Quest One Complete the quest': true }] } } },
    }, manifest, exclusionRegistry(disposition));

    expect(result.full.taskUnlocks).toEqual({});
    expect(result.audit.events).toContainEqual(expect.objectContaining({
      category: 'taskUnlocks',
      sourceKey: `NPCs/Guide/${location}`,
      terminal: true,
      disposition: 'excluded',
      reason,
      targetKeys: [],
    }));
  });
  it('accounts for merged sections and promotes quest starts', () => {
    const result = transformChunkContent({
      walkableChunks: [256],
      chunks: {
        256: {
          Quest: { 'Example Quest': 'step' },
          Sections: {
            basement: { Quest: { 'Example Quest': 'first' } },
          },
        },
      },
      slayerMonsters: {},
    }, manifest);
    expect(result.full.chunks['256'].q).toEqual({ 'Example Quest': 'first' });
    expect(result.audit.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        terminal: true, disposition: 'normalized', reason: 'section-merged',
      }),
      expect.objectContaining({
        terminal: false, disposition: 'normalized', reason: 'role-promoted-to-first',
      }),
    ]));
  });

  it('reports named locations and broad quest gates instead of silently dropping them', () => {
    const broad = Object.fromEntries(Array.from({ length: 151 }, (_, index) => [
      String(1000 + index),
      ['Pandemonium Complete the quest'],
    ]));
    const result = transformChunkContent({
      walkableChunks: [],
      chunks: {},
      slayerMonsters: {},
      questSections: broad,
      taskUnlocks: {
        NPCs: { Banker: { 'Stronghold Slayer Cave': [{ 'Quest X Complete the quest': true }] } },
      },
    }, manifest);
    expect(result.audit.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ reason: 'named-location-unmappable', disposition: 'unresolved' }),
      expect.objectContaining({ reason: 'broad-quest-gate-suppressed', disposition: 'excluded' }),
    ]));
  });

  it('accounts for non-walkable and empty walkable chunks', () => {
    const result = transformChunkContent({
      walkableChunks: [2], chunks: { 1: { Monster: { Goblin: 1 } }, 2: {} }, slayerMonsters: {},
    }, manifest);
    expect(result.audit.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: 'chunks', sourceKey: '1', disposition: 'excluded', reason: 'non-walkable-content' }),
      expect.objectContaining({ category: 'chunks', sourceKey: '2', disposition: 'excluded', reason: 'empty-walkable-chunk' }),
    ]));
  });

  it('normalizes variants, quest subpaths, sub-area suffixes, and duplicate roles', () => {
    const result = transformChunkContent({
      walkableChunks: [256],
      chunks: { 256: { Monster: { 'Goblin#Drop table 1': 1 }, Quest: { 'Recipe for Disaster/Dwarf': 'step' } } },
      slayerMonsters: {},
      questSections: { '256-1': ['Quest X Complete the quest'] },
      taskUnlocks: { NPCs: { 'Banker#2': { '256-1': [{ 'Quest X Complete the quest': true }, { 'Quest X Complete the quest': true }] } } },
    }, manifest);
    expect(result.full.chunks['256']).toMatchObject({ m: [['Goblin', 1]], q: { 'Recipe for Disaster': 'step' } });
    expect(result.full.questSections).toEqual({ 256: ['Quest X'] });
    expect(result.full.taskUnlocks).toEqual({ NPCs: { Banker: { 256: ['Quest X'] } } });
    expect(result.audit.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ reason: 'variant-name-cleaned', disposition: 'normalized' }),
      expect.objectContaining({ reason: 'quest-subpath-collapsed', disposition: 'normalized' }),
      expect.objectContaining({ reason: 'subarea-suffix-collapsed', disposition: 'normalized' }),
      expect.objectContaining({ reason: 'duplicate-deduped', disposition: 'normalized' }),
    ]));
  });

  it('records every RuneLite-lite cap', () => {
    const monsters = Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`Monster ${i}`, 7 - i]));
    const shops = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`Shop ${i}`, true]));
    const objects = Object.fromEntries([
      ...Array.from({ length: 9 }, (_, i) => [`Patch ${i}`, 1]),
      ...Array.from({ length: 9 }, (_, i) => [`Bank ${i}`, 1]),
    ]);
    const result = transformChunkContent({
      walkableChunks: [256], chunks: { 256: { Monster: monsters, Shop: shops, Object: objects } }, slayerMonsters: {},
    }, manifest);
    expect(result.liteSource).toContain('"mon":["Monster 0","Monster 1","Monster 2","Monster 3","Monster 4","Monster 5"]');
    expect(result.audit.events.filter((event) => event.reason === 'lite-cap')).toHaveLength(4);
  });
  it('merges task-unlock variants and gives each source record one terminal audit outcome', () => {
    const result = transformChunkContent({
      walkableChunks: [],
      chunks: {},
      slayerMonsters: {},
      taskUnlocks: {
        Items: {
          'Medallion fragment#1': { 256: [{ 'Quest One Complete the quest': true }] },
          'Medallion fragment#2': { 256: [{ 'Quest Two Complete the quest': true }] },
        },
      },
    }, manifest);
    expect(result.full.taskUnlocks).toEqual({
      Items: { 'Medallion fragment': { 256: ['Quest One', 'Quest Two'] } },
    });
    const terminal = result.audit.events.filter((event) => event.terminal && event.category === 'taskUnlocks');
    expect(terminal.map((event) => event.sourceKey).sort()).toEqual([
      'Items/Medallion fragment#1/256',
      'Items/Medallion fragment#2/256',
    ]);
    expect(terminal.map((event) => event.targetKeys)).toEqual([
      ['Medallion fragment/256'],
      ['Medallion fragment/256'],
    ]);
    expect(result.audit.categoryTotals.taskUnlocks).toEqual({
      source: 2, imported: 0, normalized: 2, excluded: 0, unresolved: 0,
    });
  });

  it('accounts independently for duplicate banks and nested consumed records', () => {
    const result = transformChunkContent({
      walkableChunks: [], chunks: {}, slayerMonsters: {},
      rollingChunks: { bank: ['256', '256'] },
      slayerMasterTasks: { Turael: { Goblin: {}, Rat: {} } },
      challenges: { Agility: { Gap: { Category: ['Shortcut'], Objects: [] }, Course: { Category: [], Objects: [] } } },
      skillItems: { Mining: { Rocks: { Tin: { first: '1/1' } }, Clay: { Clay: { first: '1/1' } } } },
    }, manifest);
    const keys = (category) => result.audit.events.filter((event) => event.terminal && event.category === category).map((event) => event.sourceKey).sort();
    expect(result.full.banks).toEqual(['256']);
    expect(keys('banks')).toEqual(['256@0', '256@1']);
    expect(result.audit.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: 'banks', sourceKey: '256@1', disposition: 'normalized', reason: 'duplicate-deduped', targetKeys: ['256'] }),
    ]));
    expect(keys('slayerMasterTasks')).toEqual(['Turael/Goblin', 'Turael/Rat']);
    expect(keys('challenges')).toEqual(['Agility/Course', 'Agility/Gap']);
    expect(keys('skillItems')).toEqual(['Mining/Clay', 'Mining/Rocks']);
    const terminalKeys = result.audit.events
      .filter((event) => event.terminal)
      .map((event) => `${event.category}/${event.sourceKey}`)
      .sort();
    expect(terminalKeys).toEqual([
      'banks/256@0', 'banks/256@1',
      'challenges/Agility/Course', 'challenges/Agility/Gap',
      'skillItems/Mining/Clay', 'skillItems/Mining/Rocks',
      'slayerMasterTasks/Turael/Goblin', 'slayerMasterTasks/Turael/Rat',
    ]);
    expect(new Set(terminalKeys)).toHaveLength(terminalKeys.length);
  });
  it('merges normalized drop tables before tags are derived and audits every raw source', () => {
    const result = transformChunkContent({
      walkableChunks: [256],
      chunks: {
        256: { Monster: { 'Goblin#Armoured': 1 } },
      },
      slayerMonsters: {},
      drops: {
        'Goblin#Plain': {
          'Bronze arrow': {},
          Coins: {},
        },
        'Goblin#Armoured': {
          Bones: {},
          'Coins#Small stack': {},
        },
      },
      searchTerms: {
        'ammo|Items': { 'Bronze arrow': true },
      },
    }, manifest);

    expect(result.full.drops.Goblin).toEqual(['Bones', 'Bronze arrow', 'Coins']);
    expect(result.full.tags.ammo).toEqual(['256']);
    expect(result.audit.events.filter((event) =>
      event.terminal && event.category === 'drops'
    )).toEqual([
      expect.objectContaining({
        sourceKey: 'Goblin#Armoured',
        disposition: 'normalized',
        reason: 'variant-collision-merged',
        targetKeys: ['Goblin'],
      }),
      expect.objectContaining({
        sourceKey: 'Goblin#Plain',
        disposition: 'normalized',
        reason: 'variant-collision-merged',
        targetKeys: ['Goblin'],
      }),
    ]);
  });

  it('merges normalized skill methods without losing item, stage, or rate evidence', () => {
    const result = transformChunkContent({
      walkableChunks: [],
      chunks: {},
      slayerMonsters: {},
      skillItems: {
        Mining: {
          'Soil#Level 1 loot': {
            'Copper ore#Unnoted': {
              1: '1/2',
              2: '1/4',
            },
            Clay: { 1: '1/8' },
          },
          'Soil#Level 2 loot': {
            'Copper ore': {
              1: '1/3',
              3: '1/6',
            },
            'Tin ore': { 1: '1/5' },
          },
        },
      },
    }, manifest);

    expect(result.full.skillItems.Mining.Soil).toEqual([
      ['Clay', '1/8'],
      [
        'Copper ore',
        '1 @ 1/2 (Copper ore#Unnoted), 1 @ 1/3 (Copper ore), 2 @ 1/4 (Copper ore#Unnoted), 3 @ 1/6 (Copper ore)',
      ],
      ['Tin ore', '1/5'],
    ]);
    expect(result.audit.events.filter((event) =>
      event.terminal && event.category === 'skillItems'
    )).toEqual([
      expect.objectContaining({
        sourceKey: 'Mining/Soil#Level 1 loot',
        disposition: 'normalized',
        reason: 'variant-collision-merged',
        targetKeys: ['Mining/Soil'],
      }),
      expect.objectContaining({
        sourceKey: 'Mining/Soil#Level 2 loot',
        disposition: 'normalized',
        reason: 'variant-collision-merged',
        targetKeys: ['Mining/Soil'],
      }),
    ]);
  });

  it('preserves singleton stage evidence even when different stages share a rate', () => {
    const result = transformChunkContent({
      walkableChunks: [], chunks: {}, slayerMonsters: {},
      skillItems: {
        Smithing: {
          Bars: {
            'Iron bar': { 1: '1/2', 2: '1/2' },
            'Steel bar': { 1: '1/4' },
          },
        },
      },
    }, manifest);

    expect(result.full.skillItems.Smithing.Bars).toEqual([
      ['Iron bar', '1 @ 1/2, 2 @ 1/2'],
      ['Steel bar', '1/4'],
    ]);
  });

  it('preserves raw item variants that clean to one item within a skill method', () => {
    const result = transformChunkContent({
      walkableChunks: [], chunks: {}, slayerMonsters: {},
      skillItems: {
        Nonskill: {
          'Bird nest (egg) loot': {
            "Bird's egg#Blue": { 1: '1/3' },
            "Bird's egg#Green": { 1: '1/3' },
            "Bird's egg#Red": { 1: '1/3' },
            'Bird nest (empty)': { 1: 'Always' },
          },
        },
      },
    }, manifest);

    expect(result.full.skillItems.Nonskill['Bird nest (egg) loot']).toEqual([
      ['Bird nest (empty)', 'Always'],
      [
        "Bird's egg",
        "1 @ 1/3 (Bird's egg#Blue), 1 @ 1/3 (Bird's egg#Green), 1 @ 1/3 (Bird's egg#Red)",
      ],
    ]);
  });

  it.each([
    {
      category: 'slayerMasterTasks',
      data: {
        slayerMasterTasks: {
          Turael: {
            'Goblin#Plain': { Weight: 1 },
            'Goblin#Armoured': { Weight: 2 },
          },
        },
      },
    },
    {
      category: 'shopItems',
      data: {
        shopItems: {
          'General Store': { Tinderbox: {} },
          'General Store.': { Hammer: {} },
        },
      },
    },
    {
      category: 'mapOverlays',
      data: {
        mapOverlays: {
          'Star|Primary': [{ x: 1, y: 2 }],
          'Star|Secondary': [{ x: 3, y: 4 }],
        },
      },
    },
  ])('fails closed for an unreviewed $category canonical collision', ({ category, data }) => {
    expect(() => transformChunkContent({
      walkableChunks: [],
      chunks: {},
      slayerMonsters: {},
      ...data,
    }, manifest)).toThrow(`Unreviewed ${category} canonical collision`);
  });
  it('rejects unresolved named task unlocks at the release gate', () => {
    const result = transformChunkContent({
      walkableChunks: [],
      chunks: {},
      slayerMonsters: {},
      taskUnlocks: { NPCs: { Guide: { 'Unreviewed Cave': [{ 'Quest One Complete the quest': true }] } } },
    }, manifest);

    expect(() => assertChunkTransform(result, manifest))
      .toThrow('Unresolved task-unlock records: 1');
  });
  it('runs count floors before zero-unresolved release gating in source preflight', async () => {
    const raw = Buffer.from(JSON.stringify({
      walkableChunks: [],
      chunks: {},
      slayerMonsters: {},
      taskUnlocks: { NPCs: { Guide: { 'Unreviewed Cave': [{ 'Quest One Complete the quest': true }] } } },
    }));

    await expect(writeApprovedChunkSource(raw, manifestForRaw(raw, {
      commit: 'not-the-reviewed-source',
      countFloors: { contentChunks: 1 },
    }), sourcePreflightTarget)).rejects.toThrow(
      'Chunk transform floor failed for contentChunks: expected at least 1, received 0',
    );
  });

  it('validates exact renamed named-key coverage before zero-unresolved release gating', async () => {
    const { data, manifest: sourceManifest } = await readPinnedChunkSource();
    const renamedData = JSON.parse(JSON.stringify(data));
    const originalLocation = 'Abyssal Nexus';
    const renamedLocation = 'Abyssal Nexus Renamed';
    let renamed = 0;

    for (const entities of Object.values(renamedData.taskUnlocks ?? {}) as Record<string, unknown>[]) {
      for (const value of Object.values(entities) as Record<string, unknown>[]) {
        if (Array.isArray(value) || !Object.prototype.hasOwnProperty.call(value, originalLocation)) continue;
        value[renamedLocation] = value[originalLocation];
        delete value[originalLocation];
        renamed++;
      }
    }
    expect(renamed).toBeGreaterThan(0);

    const raw = Buffer.from(JSON.stringify(renamedData));
    await expect(writeApprovedChunkSource(raw, manifestForRaw(raw, {
      commit: sourceManifest.commit,
    }), sourcePreflightTarget)).rejects.toThrow(
      `Invalid named task-unlock registry:\nMissing named task-unlock source key: ${renamedLocation}\nUnexpected named task-unlock source key: ${originalLocation}`,
    );
  });
});
