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
  'Test Master': {
    Crawling: { weight: 8, slayer: 5 },                         // low slayer
    Banshees: { weight: 8, slayer: 15, req: ['Priest in Peril Complete the quest'] },
    Bigfella: { weight: 5, combat: 80 },                         // combat gate
  },
};

// Mortimer's individual assignments start below his own access requirement.
// These deliberately low task requirements ensure the tests catch a missing
// master gate rather than an assignment-level lock.
const MORTIMER: SlayerMasters = {
  Mortimer: {
    Crawling: { weight: 10, slayer: 5 },
    Bigfella: { weight: 10, slayer: 15 },
  },
};

const COMBAT_LEVELS = {
  Attack: 99,
  Strength: 99,
  Defence: 99,
  Hitpoints: 99,
  Prayer: 99,
  Ranged: 99,
  Magic: 99,
};

const COMBAT_TIERS = {
  Attack: 10,
  Strength: 10,
  Defence: 10,
  Hitpoints: 10,
  Prayer: 10,
  Ranged: 10,
  Magic: 10,
};

const mortimerUnlocks = (over: Partial<UnlockState> = {}): UnlockState => base({
  ...over,
  skills: { ...COMBAT_TIERS, Slayer: 10, ...over.skills },
  levels: { ...COMBAT_LEVELS, Slayer: 99, ...over.levels },
  regions: over.regions ?? ['Wyrmscraig'],
  quests: over.quests ?? ['Fallen From Grace'],
});

// A locate fn that knows where two monsters live and their unlock state.
const locate = (name: string) => {
  if (name === 'Crawling') return { cx: 1, cy: 1, unlocked: true };
  if (name === 'Banshees') return { cx: 2, cy: 2, unlocked: false };
  if (name === 'Bigfella') return { cx: 3, cy: 3, unlocked: true };
  return null;
};

const statusOf = (r: ReturnType<typeof slayerReachability>, m: string): SlayerStatus =>
  r.masters[0].rows.find(x => x.monster === m)!.status;

const mortimerReach = (unlocks: UnlockState, gameModeId?: string) =>
  slayerReachability(MORTIMER, unlocks, locate, gameModeId);

const standardMasterReach = (
  master: string,
  unlocks: UnlockState,
  gameModeId?: string,
) => slayerReachability({
  [master]: { Crawling: { weight: 10 } },
}, unlocks, locate, gameModeId);

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

  it('uses real combat levels for assignment minimums despite lower method tiers', () => {
    const r = slayerReachability(MASTERS, base({
      skills: {
        Slayer: 5,
        Attack: 1, Strength: 1, Defence: 1, Hitpoints: 1,
        Prayer: 1, Ranged: 1, Magic: 1,
      },
      levels: { Slayer: 20, ...COMBAT_LEVELS },
    }), locate);

    expect(r.combatLevel).toBe(126);
    expect(statusOf(r, 'Bigfella')).toBe('ready');
  });

  it('blocks every Mortimer assignment until Wyrmscraig is reachable in the active mode', () => {
    const r = mortimerReach(mortimerUnlocks({ regions: ['Wyrmscraig'], chunks: [] }), 'chunked');

    expect(r.masters[0]).toMatchObject({
      masterBlocker: { status: 'area-locked', label: 'Master: Wyrmscraig' },
    });
    expect(r.masters[0].rows.map(row => row.status)).toEqual(['area-locked', 'area-locked']);
  });

  it('blocks every Mortimer assignment until Fallen From Grace is completed', () => {
    const r = mortimerReach(mortimerUnlocks({ quests: [] }));

    expect(r.masters[0]).toMatchObject({
      masterBlocker: { status: 'quest-locked', label: 'Master: Fallen From Grace' },
    });
    expect(r.masters[0].rows.map(row => row.status)).toEqual(['quest-locked', 'quest-locked']);
  });

  it('uses attained Slayer levels for Mortimer despite lower method tiers', () => {
    const r = mortimerReach(mortimerUnlocks({ skills: { ...COMBAT_TIERS, Slayer: 1 } }));
    expect(r.slayerLevel).toBe(99);
    expect(r.masters[0].masterBlocker).toBeUndefined();
    expect(r.masters[0].rows.every(row => row.status === 'ready')).toBe(true);
  });

  it('uses real combat levels for Mortimer after effective Slayer 70 is met', () => {
    const r = mortimerReach(mortimerUnlocks({
      skills: { Attack: 7, Strength: 7, Defence: 7, Hitpoints: 7, Prayer: 7, Ranged: 7, Magic: 7, Slayer: 7 },
      levels: { ...COMBAT_LEVELS, Slayer: 70 },
    }));

    expect(r.combatLevel).toBe(126);
    expect(r.masters[0]).not.toHaveProperty('masterBlocker');
    expect(r.masters[0].rows.map(row => row.status)).toEqual(['ready', 'ready']);
  });

  it('accepts Mortimer at exactly effective Slayer 70 and real Combat 100', () => {
    const r = mortimerReach(mortimerUnlocks({
      skills: { Attack: 8, Strength: 8, Defence: 8, Hitpoints: 8, Prayer: 8, Ranged: 8, Magic: 8, Slayer: 7 },
      levels: { Attack: 79, Strength: 79, Defence: 79, Hitpoints: 79, Prayer: 79, Ranged: 1, Magic: 1, Slayer: 70 },
    }));

    expect(r.slayerLevel).toBe(70);
    expect(r.combatLevel).toBe(100);
    expect(r.masters[0]).not.toHaveProperty('masterBlocker');
    expect(r.masters[0].rows.map(row => row.status)).toEqual(['ready', 'ready']);
  });

  it('accepts effective Slayer 99 even when Combat is below 100', () => {
    const r = mortimerReach(mortimerUnlocks({
      skills: { Attack: 1, Strength: 1, Defence: 1, Hitpoints: 1, Prayer: 1, Ranged: 1, Magic: 1, Slayer: 10 },
      levels: { Attack: 1, Strength: 1, Defence: 1, Hitpoints: 10, Prayer: 1, Ranged: 1, Magic: 1, Slayer: 99 },
    }));

    expect(r.slayerLevel).toBe(99);
    expect(r.combatLevel).toBeLessThan(100);
    expect(r.masters[0]).not.toHaveProperty('masterBlocker');
    expect(r.masters[0].rows.map(row => row.status)).toEqual(['ready', 'ready']);
  });

  it('uses the Wyrmscraig chunk foothold for Mortimer in Chunked mode', () => {
    const r = mortimerReach(mortimerUnlocks({ regions: [], chunks: ['40,35'] }), 'chunked');

    expect(r.masters[0]).not.toHaveProperty('masterBlocker');
    expect(r.masters[0].rows.map(row => row.status)).toEqual(['ready', 'ready']);
  });

  it('allows a real combat-51 account to use Vannaka despite low combat method tiers', () => {
    const combatSkills = ['Attack', 'Strength', 'Defence', 'Hitpoints', 'Prayer', 'Ranged', 'Magic'];
    const r = standardMasterReach('Vannaka', base({
      skills: {
        Slayer: 1,
        ...Object.fromEntries(combatSkills.map(skill => [skill, 1])),
      },
      levels: {
        Slayer: 1,
        ...Object.fromEntries(combatSkills.map(skill => [skill, 40])),
      },
      regions: ['Edgeville'],
    }));

    expect(r.combatLevel).toBe(51);
    expect(r.masters[0]).not.toHaveProperty('masterBlocker');
    expect(r.masters[0].rows[0].status).toBe('ready');
  });

  it.each([
    ['Mazchna', 'Canifis', ['Priest in Peril'], 20, 1],
    ['Vannaka', 'Edgeville', [], 40, 1],
    ['Chaeldar', 'Zanaris', ['Lost City'], 70, 1],
    ['Konar quo Maten', 'Mount Karuulm', [], 75, 1],
    ['Nieve', 'Tree Gnome Stronghold', [], 85, 1],
    ['Duradel', 'Shilo Village', ['Shilo Village'], 100, 50],
  ] as const)(
    'enforces %s master combat and accepts the Slayer cape bypass',
    (master, area, quests, combatRequirement, slayerLevel) => {
      const common = {
        regions: [area],
        quests: [...quests],
      };
      const belowCombat = standardMasterReach(master, base({
        ...common,
        skills: { Slayer: 10 },
        levels: { Slayer: slayerLevel },
      }));

      expect(belowCombat.combatLevel).toBeLessThan(combatRequirement);
      expect(belowCombat.masters[0].masterBlocker?.status).toBe('combat-locked');

      const cape = standardMasterReach(master, base({
        ...common,
        skills: { Slayer: 10 },
        levels: { Slayer: 99 },
      }));
      expect(cape.masters[0]).not.toHaveProperty('masterBlocker');
      expect(cape.masters[0].rows[0].status).toBe('ready');
    },
  );

  it('enforces Spria\'s quest requirement across every assignment', () => {
    const blocked = standardMasterReach('Spria', base({
      skills: { Slayer: 1 },
      levels: { Slayer: 1 },
      regions: ['Draynor Village'],
    }));
    expect(blocked.masters[0].masterBlocker).toEqual({
      status: 'quest-locked',
      label: 'Master: A Porcine of Interest',
    });

    const ready = standardMasterReach('Spria', base({
      skills: { Slayer: 1 },
      levels: { Slayer: 1 },
      quests: ['A Porcine of Interest'],
      regions: ['Draynor Village'],
    }));
    expect(ready.masters[0]).not.toHaveProperty('masterBlocker');
    expect(ready.masters[0].rows[0].status).toBe('ready');
  });

  it.each([
    ['Turael', 'Burthorpe', []],
    ['Spria', 'Draynor Village', ['A Porcine of Interest']],
    ['Krystilia', 'Edgeville', []],
  ] as const)('requires access to %s at the master location', (master, area, quests) => {
    const blocked = standardMasterReach(master, base({
      skills: { Slayer: 1 },
      levels: { Slayer: 1 },
      quests: [...quests],
    }), 'chunked');
    expect(blocked.masters[0].masterBlocker).toEqual({
      status: 'area-locked',
      label: `Master: ${area}`,
    });

    const ready = standardMasterReach(master, base({
      skills: { Slayer: 1 },
      levels: { Slayer: 1 },
      quests: [...quests],
      regions: [area],
    }));
    expect(ready.masters[0]).not.toHaveProperty('masterBlocker');
  });
});
