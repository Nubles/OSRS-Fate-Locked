import { describe, it, expect } from 'vitest';
import { slayerReachability, combatLevel, SlayerStatus } from './slayerReach';
import { SlayerMasters } from '../services/ChunkContentService';
import { UnlockState } from '../types';

const base = (over: Partial<UnlockState> = {}): UnlockState => ({
  equipment: {}, skills: {}, levels: {}, regions: [], mobility: [], arcana: [],
  housing: [], merchants: [], minigames: [], bosses: [], storage: [], guilds: [],
  farming: [], slayerUnlocks: [], quests: [], diaries: [], cas: [],
  completedTasks: [], collectionLog: {},
  ...over,
});

const MASTERS: SlayerMasters = {
  Turael: {
    Crawling: { weight: 8, slayer: 5 },                         // low slayer
    Banshees: { weight: 8, slayer: 15, req: ['Priest in Peril Complete the quest'] },
    Bigfella: { weight: 5, combat: 80 },                         // combat gate
  },
};

// A locate fn that knows where two monsters live and their unlock state.
const locate = (name: string) => {
  if (name === 'Crawling') return { cx: 1, cy: 1, unlocked: true };
  if (name === 'Banshees') return { cx: 2, cy: 2, unlocked: false };
  if (name === 'Bigfella') return { cx: 3, cy: 3, unlocked: true };
  return null;
};

const statusOf = (r: ReturnType<typeof slayerReachability>, m: string): SlayerStatus =>
  r.masters[0].rows.find(x => x.monster === m)!.status;

describe('slayerReachability', () => {
  it('combat level uses the standard formula', () => {
    expect(combatLevel({ Attack: 1, Strength: 1, Defence: 1, Hitpoints: 10 })).toBe(3);
    expect(combatLevel({ Attack: 99, Strength: 99, Defence: 99, Hitpoints: 99, Prayer: 99, Ranged: 99, Magic: 99 })).toBe(126);
  });

  it('gates on Slayer skill being unlocked at all', () => {
    const r = slayerReachability(MASTERS, base({ levels: { Slayer: 50 } }), locate);
    // Slayer skill tier 0 → everything slayer-locked
    expect(statusOf(r, 'Crawling')).toBe('slayer-locked');
  });

  it('classifies each task by its binding requirement', () => {
    const u = base({ skills: { Slayer: 5 }, levels: { Slayer: 20, Attack: 40, Strength: 40, Defence: 40, Hitpoints: 40 } });
    const r = slayerReachability(MASTERS, u, locate);
    expect(statusOf(r, 'Crawling')).toBe('ready');         // slayer 5 met, unlocked chunk
    expect(statusOf(r, 'Banshees')).toBe('quest-locked');  // needs Priest in Peril
    expect(statusOf(r, 'Bigfella')).toBe('combat-locked'); // combat < 80
  });

  it('an unlocked quest clears the quest gate but area lock remains', () => {
    const u = base({ skills: { Slayer: 5 }, levels: { Slayer: 20 }, quests: ['Priest in Peril'] });
    const r = slayerReachability(MASTERS, u, locate);
    expect(statusOf(r, 'Banshees')).toBe('area-locked');   // chunk not unlocked
  });

  it('reports ready counts per master', () => {
    const u = base({ skills: { Slayer: 10, Attack: 10, Strength: 10, Defence: 10, Hitpoints: 10 }, levels: { Slayer: 99, Attack: 99, Strength: 99, Defence: 99, Hitpoints: 99 }, quests: ['Priest in Peril'] });
    const r = slayerReachability(MASTERS, u, locate);
    // Crawling + Bigfella ready (unlocked chunks); Banshees area-locked
    expect(r.masters[0].ready).toBe(2);
  });
});
