import { describe, it, expect } from 'vitest';
// @ts-expect-error Node types are intentionally excluded from the browser app.
import { readFileSync } from 'node:fs';
// @ts-expect-error Node types are intentionally excluded from the browser app.
import { resolve } from 'node:path';
import { SHORTCUT_QUESTS, shortcutReachability } from './shortcutReach';
import { QUEST_DATA } from '../data/questData';
import { Shortcut } from '../services/ChunkContentService';
import { UnlockState } from '../types';

const base = (over: Partial<UnlockState> = {}): UnlockState => ({
  equipment: {}, skills: {}, levels: {}, regions: [], mobility: [], arcana: [],
  housing: [], merchants: [], minigames: [], bosses: [], storage: [], guilds: [],
  farming: [], slayerUnlocks: [], quests: [], diaries: [], cas: [],
  completedTasks: [], collectionLog: {},
  ...over,
});

const SHORTCUTS: Shortcut[] = [
  { name: 'Low wall', skill: 'Agility', level: 5, objects: ['Wall'], chunks: [] },
  { name: 'High cliff', skill: 'Agility', level: 60, objects: ['Cliff'], chunks: [] },
  { name: 'Far ledge', skill: 'Agility', level: 10, objects: ['Ledge'], chunks: [] },
  { name: 'Nowhere', skill: 'Agility', level: 1, objects: ['Ghost'], chunks: [] },
];

const locate = (s: Shortcut) => {
  if (s.name === 'Low wall') return { cx: 1, cy: 1, unlocked: true };
  if (s.name === 'High cliff') return { cx: 2, cy: 2, unlocked: true };
  if (s.name === 'Far ledge') return { cx: 3, cy: 3, unlocked: false };
  return null; // Nowhere
};

const statusOf = (r: ReturnType<typeof shortcutReachability>, name: string) =>
  r.rows.find(x => x.name === name)!.status;

describe('shortcutReachability', () => {
  it('classifies by level, area, and missing location', () => {
    // Agility tier 6 (caps level 60), level 55 actual
    const r = shortcutReachability(SHORTCUTS, base({ skills: { Agility: 6 }, levels: { Agility: 55 } }), locate);
    expect(statusOf(r, 'Low wall')).toBe('ready');       // lvl 5 met, unlocked
    expect(statusOf(r, 'High cliff')).toBe('level');     // needs 60, have 55
    expect(statusOf(r, 'Far ledge')).toBe('area-locked'); // lvl 10 met, chunk locked
    expect(statusOf(r, 'Nowhere')).toBe('no-location');
  });

  it('counts ready and sorts ready-first', () => {
    const r = shortcutReachability(SHORTCUTS, base({ skills: { Agility: 6 }, levels: { Agility: 60 } }), locate);
    expect(r.ready).toBe(2); // Low wall + High cliff (both unlocked, level met)
    expect(r.rows[0].status).toBe('ready');
  });
});

describe('shortcutReachability: every requirement of a shortcut', () => {
  const lum = 'Access the (mith grapple) over the River Lum to Al Kharid shortcut';
  const GRAPPLE: Shortcut[] = [
    { name: lum, skill: 'Agility', level: 8, objects: ['Broken raft'], chunks: [] },
    { name: lum, skill: 'Ranged', level: 37, objects: ['Broken raft'], chunks: [] },
    { name: lum, skill: 'Strength', level: 19, objects: ['Broken raft'], chunks: [] },
  ];
  const here = () => ({ cx: 1, cy: 1, unlocked: true });

  it('judges a mith grapple shortcut once, on Agility, Ranged and Strength', () => {
    const agilityOnly = shortcutReachability(GRAPPLE, base({ skills: { Agility: 8 }, levels: { Agility: 80 } }), here);
    expect(agilityOnly.total).toBe(1);
    expect(agilityOnly.ready).toBe(0);
    expect(agilityOnly.rows[0]).toMatchObject({ name: lum, skill: 'Agility', level: 8, status: 'level' });
    expect(agilityOnly.rows[0].missing).toEqual([{ skill: 'Ranged', level: 37 }, { skill: 'Strength', level: 19 }]);

    const all = shortcutReachability(GRAPPLE, base({
      skills: { Agility: 8, Ranged: 4, Strength: 2 }, levels: { Agility: 80, Ranged: 37, Strength: 19 },
    }), here);
    expect(all.rows[0].status).toBe('ready');
    expect(all.ready).toBe(1);
  });

  it('holds a quest-gated shortcut until the quest is done', () => {
    const SHILO: Shortcut[] = [{ name: 'Access the Shilo Village rocks shortcut', skill: 'Agility', level: 79, objects: [], chunks: [] }];
    const skilled = { skills: { Agility: 8 }, levels: { Agility: 80 } };
    const before = shortcutReachability(SHILO, base(skilled), here);
    expect(before.rows[0]).toMatchObject({ status: 'quest', quest: 'Shilo Village' });
    expect(before.ready).toBe(0);
    const after = shortcutReachability(SHILO, base({ ...skilled, quests: ['Shilo Village'] }), here);
    expect(after.rows[0].status).toBe('ready');
  });

  it('holds a two-quest shortcut until both quests are done and names the ones left', () => {
    const GNOME: Shortcut[] = [{ name: 'Access the Gnome Stronghold shortcut', skill: 'Agility', level: 37, objects: [], chunks: [] }];
    const skilled = { skills: { Agility: 8 }, levels: { Agility: 40 } };
    expect(shortcutReachability(GNOME, base(skilled), here).rows[0])
      .toMatchObject({ status: 'quest', quest: 'The Grand Tree and Tree Gnome Village' });
    expect(shortcutReachability(GNOME, base({ ...skilled, quests: ['The Grand Tree'] }), here).rows[0])
      .toMatchObject({ status: 'quest', quest: 'Tree Gnome Village' });
    expect(shortcutReachability(GNOME, base({ ...skilled, quests: ['The Grand Tree', 'Tree Gnome Village'] }), here).rows[0].status)
      .toBe('ready');
  });

  it('names real shortcuts and real quests in the quest table', () => {
    const doc = JSON.parse(readFileSync(resolve('public/chunk-content.json'), 'utf8')) as { shortcuts: Shortcut[] };
    const names = new Set(doc.shortcuts.map(s => s.name));
    for (const [shortcut, quests] of Object.entries(SHORTCUT_QUESTS)) {
      expect(names.has(shortcut), shortcut).toBe(true);
      expect(quests.length, shortcut).toBeGreaterThan(0);
      for (const quest of quests) expect(QUEST_DATA[quest]?.id, quest).toBe(quest);
    }
    // OSRS Wiki "Shortcuts": Rubble (Temple of the Eye) 56, Rocks (Shilo Village) 79,
    // Troll Stronghold wall-climb 73.
    expect(SHORTCUT_QUESTS['Access the rock climb in the Temple of the Eye shortcut']).toEqual(['Temple of the Eye']);
    expect(SHORTCUT_QUESTS['Access the Shilo Village rocks shortcut']).toEqual(['Shilo Village']);
    expect(SHORTCUT_QUESTS['Access the Troll Stronghold wall-climb shortcut']).toEqual(["My Arm's Big Adventure"]);
    // Trellis (Varrock) 35, Crevice (Shaman Caves), Rocks (Observatory) grapple,
    // Wall (Darkmeyer) north-eastern wall, Rocks (Tree Gnome Stronghold) 37.
    expect(SHORTCUT_QUESTS['Access the Varrock Palace Garden trellis shortcut']).toEqual(['Garden of Tranquillity']);
    expect(SHORTCUT_QUESTS['Access the Shaman Caves crevice shortcut']).toEqual(["Legends' Quest"]);
    expect(SHORTCUT_QUESTS['Access the (mith grapple) scale the Observatory cliff shortcut']).toEqual(['Observatory Quest']);
    expect(SHORTCUT_QUESTS['Access the Darkmeyer north-eastern wall shortcut']).toEqual(['Sins of the Father']);
    expect(SHORTCUT_QUESTS['Access the Gnome Stronghold shortcut']).toEqual(['The Grand Tree', 'Tree Gnome Village']);
  });
});
