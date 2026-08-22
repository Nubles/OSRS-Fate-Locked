import { beforeAll, describe, it, expect, vi } from 'vitest';
import fullChunkContent from '../public/chunk-content.json';
import {
  aggregateContent,
  ChunkContent,
  chunkContentService,
} from './ChunkContentService';
import type { ChunkEntrance } from './ChunkContentService';

const DWARVEN_MINE_CHUNK = { cx: 47, cy: 52 };
const generatedContentFixture = structuredClone(fullChunkContent) as any;
generatedContentFixture.chunks['1'] = {
  s: ["Durrik's Goods", "Gunslik's Assorted Items", 'Unreviewed audit shop'],
};
generatedContentFixture.shopItems['Unreviewed audit shop'] = ['RuneProof audit token'];
const rawDwarvenMineEntrances = generatedContentFixture.entrances['12084'];
rawDwarvenMineEntrances.reverse();

const empty = (over: Partial<ChunkContent> = {}): ChunkContent => ({
  monsters: [], npcs: [], objects: [], shops: [],
  quests: {}, diaries: {}, clues: {}, spawns: [],
  ...over,
});

describe('aggregateContent', () => {
  it('sums monster counts and keeps the lowest slayer requirement', () => {
    const a = empty({ monsters: [{ name: 'Cave bug', count: 3, slayer: 7 }] });
    const b = empty({ monsters: [{ name: 'Cave bug', count: 2, slayer: null }, { name: 'Goblin', count: 5, slayer: null }] });
    const agg = aggregateContent([a, b]);
    expect(agg.monsters).toEqual([
      { name: 'Cave bug', count: 5, slayer: 7 },
      { name: 'Goblin', count: 5, slayer: null },
    ]);
  });

  it('quest "first" wins over "step" regardless of order', () => {
    const a = empty({ quests: { 'Cook\'s Assistant': 'step' } });
    const b = empty({ quests: { 'Cook\'s Assistant': 'first' } });
    expect(aggregateContent([a, b]).quests['Cook\'s Assistant']).toBe('first');
    expect(aggregateContent([b, a]).quests['Cook\'s Assistant']).toBe('first');
  });

  it('dedupes npcs/shops/spawns and sums objects + clues', () => {
    const a = empty({
      npcs: ['Hans'], shops: ['General Store'], spawns: ['Logs'],
      objects: [['Yew tree', 2]], clues: { easy: 3 },
    });
    const b = empty({
      npcs: ['Hans', 'Bob'], shops: ['General Store'], spawns: ['Logs'],
      objects: [['Yew tree', 1], ['Bank booth', 2]], clues: { easy: 1, hard: 2 },
    });
    const agg = aggregateContent([a, b]);
    expect(agg.npcs).toEqual(['Bob', 'Hans']);
    expect(agg.shops).toEqual(['General Store']);
    expect(agg.spawns).toEqual(['Logs']);
    expect(agg.objects).toEqual([['Yew tree', 3], ['Bank booth', 2]]);
    expect(agg.clues).toEqual({ easy: 4, hard: 2 });
  });

  it('concatenates diary refs for the same area', () => {
    const a = empty({ diaries: { Varrock: 'EA1' } });
    const b = empty({ diaries: { Varrock: 'MD3', Lumbridge: 'HD4' } });
    expect(aggregateContent([a, b]).diaries).toEqual({ Varrock: 'EA1, MD3', Lumbridge: 'HD4' });
  });

  it('handles the empty case', () => {
    const agg = aggregateContent([]);
    expect(agg.monsters).toEqual([]);
    expect(agg.quests).toEqual({});
  });
});

describe('entrances before initialization', () => {
  it('returns no entrance rows before the generated document loads', () => {
    expect(chunkContentService.entrancesFor(DWARVEN_MINE_CHUNK.cx, DWARVEN_MINE_CHUNK.cy)).toEqual([]);
  });

  it('reports partial exact-item coverage before the generated document loads', () => {
    expect(chunkContentService.itemSourceCoverage()).toBe('PARTIAL');
  });
});

describe('generated normalized source unions', () => {
  beforeAll(async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => generatedContentFixture,
    })));
    expect(await chunkContentService.init()).toBe(true);
  });

  it('exposes merged drop items through runtime item-source lookups and tags', () => {
    expect(chunkContentService.itemSources('Iron 2h sword')).toContain('Cyclops');
    expect(chunkContentService.tagChunks('runecraft')).toContainEqual({ cx: 37, cy: 52 });
  });

  it('preserves exact host, chunk, and access evidence', () => {
    expect(chunkContentService.itemSourceRecords('Plank')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          itemName: 'Plank',
          kind: expect.stringMatching(/spawn|shop|monster/),
          hostName: expect.any(String),
          cx: expect.any(Number),
          cy: expect.any(Number),
          rawRequirements: expect.any(Array),
        }),
      ]),
    );
    expect(chunkContentService.itemSourceCoverage()).toBe('COMPLETE');
  });

  it('does not expose mutable cached access evidence', () => {
    const records = chunkContentService.itemSourceRecords('RuneProof audit token');
    (records[0].rawRequirements as { raw: string; origin: 'ENTITY' | 'CHUNK_ENTRY' }[]).push({
      raw: 'Mutated by consumer',
      origin: 'ENTITY',
    });

    expect(chunkContentService.itemSourceRecords('RuneProof audit token')[0].rawRequirements)
      .not.toContainEqual({ raw: 'Mutated by consumer', origin: 'ENTITY' });
  });

  it('fails closed for an unclassified synthetic merchant', () => {
    expect(chunkContentService.itemSourceRecords('RuneProof audit token')).toEqual([
      expect.objectContaining({
        hostName: 'Unreviewed audit shop',
        rawRequirements: [{
          raw: 'Unknown merchant category: Unreviewed audit shop',
          origin: 'ENTITY',
        }],
      }),
    ]);
  });

  it('exposes merged skill stage/rate evidence and policy metadata', () => {
    const soil = chunkContentService.skillYields('Mining').Soil;
    expect(soil.find(([item]) => item === 'Bones')?.[1]).toContain('1 @ 1/12');
    expect(chunkContentService.sourceMetadata()?.policyVersion).toBe(2);
    expect(chunkContentService.sourceMetadata()?.namedLocationPolicyVersion).toBe(1);
    expect(chunkContentService.sourceMetadata()?.namedLocationReviewedAt).toBe('2026-08-03');
  });
  it('returns exact generated entrances in label order without exposing mutable generated rows', () => {
    const expectedDwarvenMineEntrances: ChunkEntrance[] = [
      {
        location: 'Dwarven Mine',
        label: 'Eastern Falador entrance to Dwarven Mine',
        wikiPage: 'Dwarven_Mine',
        requirements: [],
      },
      {
        location: 'Mining Guild',
        label: 'Entrance to Mining Guild',
        wikiPage: 'Mining_Guild',
        requirements: ['60 Mining'],
      },
      {
        location: 'Dwarven Mine',
        label: 'Mining Guild entrance to Dwarven Mine',
        wikiPage: 'Dwarven_Mine',
        requirements: ['60 Mining'],
      },
    ];
    const rawBeforeLookup = structuredClone(rawDwarvenMineEntrances);
    expect(rawBeforeLookup.map(({ label }) => label)).toEqual([
      'Mining Guild entrance to Dwarven Mine',
      'Entrance to Mining Guild',
      'Eastern Falador entrance to Dwarven Mine',
    ]);
    const entrances = chunkContentService.entrancesFor(DWARVEN_MINE_CHUNK.cx, DWARVEN_MINE_CHUNK.cy);

    expect(entrances).toEqual(expectedDwarvenMineEntrances);
    expect(entrances.map(({ label }) => label)).toEqual([
      'Eastern Falador entrance to Dwarven Mine',
      'Entrance to Mining Guild',
      'Mining Guild entrance to Dwarven Mine',
    ]);
    expect(rawDwarvenMineEntrances).toEqual(rawBeforeLookup);

    entrances[0].label = 'Mutated label';
    entrances[1].requirements.push('Mutated requirement');
    entrances.pop();

    expect(chunkContentService.entrancesFor(DWARVEN_MINE_CHUNK.cx, DWARVEN_MINE_CHUNK.cy))
      .toEqual(expectedDwarvenMineEntrances);
    expect(rawDwarvenMineEntrances).toEqual(rawBeforeLookup);
  });

  it('returns no entrance rows for an unknown chunk', () => {
    expect(chunkContentService.entrancesFor(-1, -1)).toEqual([]);
  });
});
