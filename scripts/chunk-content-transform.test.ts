import { describe, expect, it } from 'vitest';
import { transformChunkContent } from './chunk-content-transform.mjs';

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

describe('transformChunkContent', () => {
  it('preserves the reviewed RuneProof Graveyard plank corridor', () => {
    const result = transformChunkContent({
      walkableChunks: [],
      chunks: {},
      slayerMonsters: {},
    }, manifest);

    expect(result.full.locationNodes.map(node => [
      node.surfaceChunk, node.coverage,
    ])).toEqual([
      ['50,50', 'VERIFIED'], ['50,51', 'VERIFIED'], ['50,52', 'VERIFIED'],
      ['50,53', 'VERIFIED'], ['50,54', 'VERIFIED'], ['50,55', 'VERIFIED'],
      ['49,55', 'VERIFIED'], ['49,56', 'VERIFIED'], ['49,57', 'VERIFIED'],
    ]);
    expect(result.full.locationEdges.map(edge => [
      edge.from, edge.to, edge.bidirectional,
    ])).toEqual([
      ['surface:50,50', 'surface:50,51', true],
      ['surface:50,51', 'surface:50,52', true],
      ['surface:50,52', 'surface:50,53', true],
      ['surface:50,53', 'surface:50,54', true],
      ['surface:50,54', 'surface:50,55', true],
      ['surface:50,55', 'surface:49,55', true],
      ['surface:49,55', 'surface:49,56', true],
      ['surface:49,56', 'surface:49,57', true],
    ]);
    expect(result.full.locationEdges.every(edge =>
      edge.provenanceIds.includes('chunk-route:audit:lumbridge-graveyard-v1')))
      .toBe(true);
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
});
