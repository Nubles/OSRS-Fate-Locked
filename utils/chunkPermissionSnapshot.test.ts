import { describe, expect, it } from 'vitest';
import { initialState } from '../context/GameContext';
import type { ChunkContent } from '../services/ChunkContentService';
import {
  buildChunkPermissionSnapshot,
  type ChunkPermissionContext,
} from './chunkPermissionSnapshot';

const content = (overrides: Partial<ChunkContent> = {}): ChunkContent => ({
  name: 'Lumbridge',
  monsters: [],
  npcs: [],
  objects: [],
  shops: [],
  quests: {},
  diaries: {},
  clues: {},
  spawns: [],
  ...overrides,
});

const context = (
  overrides: Partial<ChunkPermissionContext> = {},
): ChunkPermissionContext => ({
  unlocks: {
    ...initialState.unlocks,
    banks: [],
    merchants: [],
  },
  gameModeId: 'vanilla',
  reachableChunks: new Set(['12850']),
  questStatuses: {},
  ...overrides,
});

describe('buildChunkPermissionSnapshot', () => {
  it("ignores injected permission statuses and uses canonical Witch's Potion access", () => {
    const locked = buildChunkPermissionSnapshot(
      content({ quests: { "Witch's Potion": 'first' } }),
      { cx: 50, cy: 50 },
      context({ questStatuses: { "Witch's Potion": 'ALLOWED' } }),
    );
    const available = buildChunkPermissionSnapshot(
      content({ quests: { "Witch's Potion": 'first' } }),
      { cx: 50, cy: 50 },
      context({
        unlocks: {
          ...initialState.unlocks,
          regions: ['Rimmington'],
        },
        questStatuses: { "Witch's Potion": 'LOCKED' },
      }),
    );

    expect(locked.categories.QUESTS?.[0].status).toBe('LOCKED');
    expect(available.categories.QUESTS?.[0].status).toBe('ALLOWED');
  });
  it('uses compact category-specific rows', () => {
    const view = buildChunkPermissionSnapshot(
      content({
        monsters: [{ name: 'Goblin', count: 4, slayer: null }],
        shops: ['Lumbridge General Store'],
        quests: { "Cook's Assistant": 'first' },
      }),
      { cx: 50, cy: 50 },
      context(),
    );

    expect(view.categories.BANKS).toEqual([
      expect.objectContaining({
        name: 'Lumbridge Castle',
        status: 'LOCKED',
      }),
    ]);
    expect(view.categories.BANKS?.[0].detail).toBeUndefined();
    expect(view.categories.SHOPS).toEqual([
      expect.objectContaining({
        name: 'Lumbridge General Store',
        status: 'LOCKED',
      }),
    ]);
    expect(view.categories.QUESTS?.[0]).toMatchObject({
      name: "Cook's Assistant",
      status: 'ALLOWED',
    });
    expect(view.categories.COMBAT?.[0]).toMatchObject({
      name: 'Goblin',
      status: 'ALLOWED',
    });
    expect(view.categories.QUESTS?.[0].detail).toBeUndefined();
    expect(view.categories.COMBAT?.[0].detail).toBeUndefined();
  });

  it('keeps useful skilling requirements concise', () => {
    const unlocks = {
      ...initialState.unlocks,
      skills: { ...initialState.unlocks.skills, Woodcutting: 5 },
      levels: { ...initialState.unlocks.levels, Woodcutting: 45 },
    };
    const view = buildChunkPermissionSnapshot(
      content({ objects: [['Yew tree', 2]] }),
      { cx: 50, cy: 50 },
      context({ unlocks }),
    );

    expect(view.categories.SKILLING?.[0]).toMatchObject({
      name: 'Yew tree',
      status: 'NOT_READY',
      detail: 'Woodcutting 45/60 · cap 50',
    });
  });

  it('omits empty categories and banned prose', () => {
    const view = buildChunkPermissionSnapshot(
      content({
        monsters: [{ name: 'Goblin', count: 1, slayer: null }],
        shops: ['Lumbridge General Store'],
        quests: { "Cook's Assistant": 'first' },
      }),
      { cx: 50, cy: 50 },
      context(),
    );
    expect(view.categories.TRAVEL).toBeUndefined();
    const dense = ['BANKS', 'SHOPS', 'QUESTS', 'COMBAT'] as const;
    const banned = [
      'Unlock from',
      'Spend Keys',
      'This individual',
      'has not been rolled',
      'Complete this quest to',
      'Combat access requires',
    ];
    for (const category of dense) {
      for (const row of view.categories[category] ?? []) {
        expect(banned.some((phrase) =>
          `${row.name} ${row.detail ?? ''}`.includes(phrase))).toBe(false);
      }
    }
  });
});
