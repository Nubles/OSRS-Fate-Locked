import { beforeAll, describe, it, expect, vi } from 'vitest';
import fullChunkContent from '../public/chunk-content.json';
import {
  aggregateContent,
  ChunkContent,
  chunkContentService,
} from './ChunkContentService';

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

describe('generated normalized source unions', () => {
  beforeAll(async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify(fullChunkContent),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )));
    expect(await chunkContentService.init()).toBe(true);
  });

  it('exposes merged drop items through runtime item-source lookups and tags', () => {
    expect(chunkContentService.itemSources('Iron 2h sword')).toContain('Cyclops');
    expect(chunkContentService.tagChunks('runecraft')).toContainEqual({ cx: 37, cy: 52 });
  });

  it('exposes merged skill stage/rate evidence and policy metadata', () => {
    const soil = chunkContentService.skillYields('Mining').Soil;
    expect(soil.find(([item]) => item === 'Bones')?.[1]).toContain('1 @ 1/12');
    expect(chunkContentService.sourceMetadata()?.policyVersion).toBe(2);
  });
});
