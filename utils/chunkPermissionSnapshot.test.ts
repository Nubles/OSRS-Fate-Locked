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
  it('requires unlocked skill tiers as well as recorded levels for combat and travel', () => {
    const unlocks = structuredClone(initialState.unlocks);
    unlocks.levels.Slayer = 99; unlocks.levels.Agility = 99;
    unlocks.skills.Slayer = 0; unlocks.skills.Agility = 0;
    const fixture = content({ monsters: [{ name: 'Crawling hand', count: 1, slayer: 5 }] });
    const settings = context({ unlocks, shortcuts: [{ name: 'Test shortcut', skill: 'Agility', level: 10, chunks: ['12850'], objects: ['Rock'] }] });
    const view = () => buildChunkPermissionSnapshot(fixture, { cx: 50, cy: 50 }, settings);
    expect(view().categories.COMBAT?.[0].status).toBe('NOT_READY');
    expect(view().categories.TRAVEL?.[0].status).toBe('NOT_READY');
    unlocks.skills.Slayer = 1; unlocks.skills.Agility = 1;
    expect(view().categories.COMBAT?.[0].status).toBe('ALLOWED');
    expect(view().categories.TRAVEL?.[0].status).toBe('ALLOWED');
    fixture.monsters[0].slayer = 15;
    expect(view().categories.COMBAT?.[0].status).toBe('NOT_READY');
    unlocks.skills.Slayer = 2;
    expect(view().categories.COMBAT?.[0].status).toBe('ALLOWED');
  });
  // own.d1[2]: the plugin shows a NOT_READY row's detail as sent, so the level that blocks it is named,
  // in the form its SkillLine reads for skilling rows ("Slayer 5/93 \u00b7 cap 10").
  it('names the Slayer level a NOT_READY combat row waits on, as skilling rows do', () => {
    const SKILL_LINE = /^(\S.*?) (\d+)\/(\d+) \u00b7 cap (\d+)$/;
    const unlocks = structuredClone(initialState.unlocks);
    unlocks.levels.Slayer = 20; unlocks.skills.Slayer = 1;
    const fixture = content({ monsters: [{ name: 'Cave crawler', count: 1, slayer: 10 }, { name: 'Goblin', count: 1, slayer: null }] });
    const settings = context({ unlocks });
    const row = (name: string) => buildChunkPermissionSnapshot(fixture, { cx: 50, cy: 50 }, settings)
      .categories.COMBAT?.find(one => one.name === name);
    expect(row('Cave crawler')).toMatchObject({ status: 'ALLOWED' });
    expect(row('Cave crawler')?.detail).toBeUndefined();
    unlocks.levels.Slayer = 9; unlocks.skills.Slayer = 2;
    expect(row('Cave crawler')).toMatchObject({ status: 'NOT_READY', detail: 'Slayer 9/10 \u00b7 cap 20' });
    unlocks.levels.Slayer = 10;
    expect(row('Cave crawler')).toMatchObject({ status: 'ALLOWED' });
    expect(row('Cave crawler')?.detail).toBeUndefined();
    unlocks.skills.Slayer = 0;
    expect(row('Cave crawler')).toMatchObject({ status: 'NOT_READY', detail: 'Slayer 10/10 \u00b7 cap 0' });
    expect(row('Cave crawler')?.detail).toMatch(SKILL_LINE);
    expect(row('Goblin')).toMatchObject({ status: 'ALLOWED' });
    expect(row('Goblin')?.detail).toBeUndefined();
    // A row locked for another reason says only that.
    const locked = buildChunkPermissionSnapshot(fixture, { cx: 32, cy: 150 }, context({ unlocks }))
      .categories.COMBAT?.find(one => one.name === 'Cave crawler');
    expect(locked?.status).toBe('LOCKED');
    expect(locked?.detail ?? '').not.toContain('Slayer');
  });
  describe('TRAVEL rows judge shortcuts as the Shortcuts panels do (utils/shortcutReach.ts)', () => {
    const skilled = () => {
      const unlocks = structuredClone(initialState.unlocks);
      for (const skill of ['Agility', 'Ranged', 'Strength']) { unlocks.levels[skill] = 99; unlocks.skills[skill] = 10; }
      return unlocks;
    };
    const travel = (settings: ChunkPermissionContext) =>
      buildChunkPermissionSnapshot(content(), { cx: 50, cy: 50 }, settings).categories.TRAVEL ?? [];
    const rocks = { name: 'Access the Shilo Village rocks shortcut', skill: 'Agility', level: 32, chunks: ['12850'], objects: [] };

    it('holds a quest-gated shortcut until its quest is done', () => {
      const unlocks = skilled();
      expect(travel(context({ unlocks, shortcuts: [rocks] }))).toEqual([
        { key: 'travel:access the shilo village rocks shortcut', name: rocks.name, status: 'NOT_READY',
          detail: 'Agility 99/32; Needs Shilo Village', targetKind: 'TELEPORT' },
      ]);
      unlocks.quests = ['Shilo Village'];
      expect(travel(context({ unlocks, shortcuts: [rocks] }))[0]).toMatchObject({ status: 'ALLOWED', detail: 'Agility 99/32' });
    });

    it('holds a diary-gated shortcut until its diary tier is done', () => {
      const unlocks = skilled();
      const lair = { name: 'Access the Kalphite Lair wall shortcut', skill: 'Agility', level: 86, chunks: ['12850'], objects: [] };
      expect(travel(context({ unlocks, shortcuts: [lair] }))[0])
        .toMatchObject({ status: 'NOT_READY', detail: 'Agility 99/86; Needs Desert Elite diary' });
      unlocks.diaries = ['Desert Elite'];
      expect(travel(context({ unlocks, shortcuts: [lair] }))[0].status).toBe('ALLOWED');
    });

    it('finds shortcuts given by a suffixed chunk id or an interior', () => {
      const unlocks = skilled();
      const suffixed = { name: 'Suffixed shortcut', skill: 'Agility', level: 5, chunks: ['12850-1'], objects: [] };
      const inside = { name: 'Interior shortcut', skill: 'Agility', level: 5, chunks: ['some_cave'], objects: [] };
      const shortcutContent = {
        shortcuts: () => [], entityLocations: () => null, chunkEntryRequirements: () => [],
        interiorEntranceChunks: (key: string) => (key === 'some_cave' ? [{ cx: 50, cy: 50 }] : []),
      };
      expect(travel(context({ unlocks, shortcuts: [suffixed, inside], shortcutContent })).map(row => row.name))
        .toEqual(['Interior shortcut', 'Suffixed shortcut']);
      expect(travel(context({ unlocks, shortcuts: [suffixed], shortcutContent }))[0].status).toBe('ALLOWED');
    });

    it('gives a multi-skill shortcut one row that needs every level', () => {
      const unlocks = skilled();
      unlocks.levels.Strength = 20;
      const name = 'Access the (mith grapple) test shortcut';
      const grapple = ['Agility', 'Ranged', 'Strength'].map(skill => ({ name, skill, level: 30, chunks: ['12850'], objects: [] }));
      expect(travel(context({ unlocks, shortcuts: grapple }))).toEqual([
        { key: `travel:${name.toLowerCase()}`, name, status: 'NOT_READY',
          detail: 'Agility 99/30, Ranged 99/30, Strength 20/30', targetKind: 'TELEPORT' },
      ]);
    });
  });
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
          merchants: ['Magic Shops'],
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
        objects: [['Bank booth', 1]],
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
