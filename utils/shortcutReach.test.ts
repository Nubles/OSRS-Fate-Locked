import { describe, it, expect } from 'vitest';
import { shortcutReachability } from './shortcutReach';
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
