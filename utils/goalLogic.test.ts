import { describe, expect, it } from 'vitest';
import {
  ARCANA_LIST, BOSSES_LIST, FARMING_PATCH_LIST, GUILDS_LIST, MERCHANTS_LIST, MINIGAMES_LIST, MOBILITY_LIST,
  POH_LIST, REGION_GROUPS, REGIONS_LIST, SKILLS_LIST, STORAGE_LIST,
} from '../constants';
import { STRATEGY_DATABASE, type ContentRequirement } from '../data/requirements';
import { QUEST_DATA } from '../data/questData';
import { DIARY_DATA } from '../data/diaryData';
import { analyzeRequirement } from '../components/StrategyGuide';
import { TableType, type UnlockState } from '../types';
import { calculateGoalProgress } from './goalLogic';

const unlocks = (regions: string[]): UnlockState => ({
  equipment: {}, skills: {}, levels: {}, regions,
  mobility: [], arcana: [], housing: [], merchants: [], minigames: [],
  bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [],
  quests: [], diaries: [], cas: [], completedTasks: [], collectionLog: {},
});

describe('calculateGoalProgress region groups', () => {
  it('does not count a continent until all of its child areas are unlocked', () => {
    const requirement = {
      id: 'Wilderness access', category: TableType.QUESTS,
      regions: ['Wilderness'], skills: {}, quests: [],
    };

    expect(calculateGoalProgress(
      requirement,
      unlocks(REGION_GROUPS.Wilderness.slice(0, -1)),
    ).missing).toContain('Region: Wilderness');
    expect(calculateGoalProgress(
      requirement,
      unlocks([...REGION_GROUPS.Wilderness]),
    ).missing).not.toContain('Region: Wilderness');
  });
});

// A goal pinned from the Strategy Guide is judged the way the guide's card
// judges it (one shared helper), so it can reach Ready.
const baseUnlocks = (over: Partial<UnlockState>): UnlockState => ({ ...unlocks([]), ...over });

const ROLLABLE: Partial<Record<TableType, readonly string[]>> = {
  [TableType.MINIGAMES]: MINIGAMES_LIST, [TableType.BOSSES]: BOSSES_LIST, [TableType.GUILDS]: GUILDS_LIST,
  [TableType.MERCHANTS]: MERCHANTS_LIST, [TableType.MOBILITY]: MOBILITY_LIST, [TableType.ARCANA]: ARCANA_LIST,
  [TableType.POH]: POH_LIST, [TableType.STORAGE]: STORAGE_LIST, [TableType.FARMING_LAYERS]: FARMING_PATCH_LIST,
};

const maxed = (): UnlockState => baseUnlocks({
  regions: [...new Set([...REGIONS_LIST, ...Object.values(REGION_GROUPS).flat()])],
  skills: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 10])),
  levels: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 99])),
  quests: Object.keys(QUEST_DATA), diaries: Object.keys(DIARY_DATA),
});

describe('calculateGoalProgress for pinned Strategy Guide entries', () => {
  it('does not ask to unlock Cockatrice, which no Key can roll', () => {
    const progress = calculateGoalProgress(STRATEGY_DATABASE['Cockatrice'], baseUnlocks({
      regions: [...REGION_GROUPS.Fremennik], skills: { Slayer: 3 }, levels: { Slayer: 30 },
    }), 'vanilla');
    expect(progress.missing.filter(item => item.startsWith('Unlock:'))).toEqual([]);
    expect(progress.percentage).toBe(100);
  });

  it('keeps Wilderness God Wars Dungeon below Ready without 60 Strength or 60 Agility', () => {
    const req = STRATEGY_DATABASE['Wilderness God Wars Dungeon'];
    const wilderness = { regions: [...REGION_GROUPS.Wilderness] };
    const without = calculateGoalProgress(req, baseUnlocks({ ...wilderness, skills: { Strength: 3 }, levels: { Strength: 40 } }), 'vanilla');
    expect(without.percentage).toBeLessThan(100);
    expect(without.missing).toContain('One of: 60 Strength or 60 Agility');
    expect(without.missing.filter(item => item.startsWith('Unlock:'))).toEqual([]);
    const withStrength = calculateGoalProgress(req, baseUnlocks({ ...wilderness, skills: { Strength: 6 }, levels: { Strength: 60 } }), 'vanilla');
    expect(withStrength).toMatchObject({ percentage: 100, missing: [] });
  });

  it('still asks for the Key of a root entry such as the Mining Guild', () => {
    const req = STRATEGY_DATABASE['Mining Guild (Amethyst)'];
    const state = baseUnlocks({ regions: [...REGION_GROUPS.Asgarnia], skills: { Mining: 6 }, levels: { Mining: 60 } });
    expect(calculateGoalProgress(req, state, 'vanilla').missing).toEqual(['Unlock: Mining Guild']);
    expect(calculateGoalProgress(req, { ...state, guilds: ['Mining Guild'] }, 'vanilla').percentage).toBe(100);
  });

  it('lists a manual requirement or an alternative as a check and never claims Ready for it', () => {
    const req: ContentRequirement = {
      id: 'Manual test', category: TableType.MINIGAMES, regions: [], skills: {},
      manualRequirements: ['Bring a light source'],
      alternatives: [{ label: 'Route', routes: [{ label: 'Route A' }, { label: 'Route B' }] }] as ContentRequirement['alternatives'],
    };
    const progress = calculateGoalProgress(req, maxed(), 'vanilla');
    expect(progress.missing).toEqual(['Confirm: One of: Route A or Route B', 'Confirm: Bring a light source']);
    expect(progress.percentage).toBeLessThan(100);
  });

  it('needs the Mobility Key for Soda Ash (Charter Ships), whose id is a Mobility root', () => {
    const req = STRATEGY_DATABASE['Soda Ash (Charter Ships)'];
    const without = baseUnlocks({ ...maxed(), mobility: [] });
    const progress = calculateGoalProgress(req, without, 'vanilla');
    expect(progress.missing).toContain('Unlock: Charter Ships');
    expect(progress.percentage).toBeLessThan(100);
    expect(analyzeRequirement(req, without, 'vanilla').isCategoryUnlocked).toBe(false);

    const withKey = baseUnlocks({ ...maxed(), mobility: ['Charter Ships'] });
    expect(calculateGoalProgress(req, withKey, 'vanilla').missing).not.toContain('Unlock: Charter Ships');
    expect(calculateGoalProgress(req, withKey, 'vanilla').percentage).toBe(100);
    expect(analyzeRequirement(req, withKey, 'vanilla').isCategoryUnlocked).toBe(true);
  });

  it('never asks to unlock an id no Key can roll, and agrees with the Strategy Guide on Ready', () => {
    for (const [key, req] of Object.entries(STRATEGY_DATABASE)) {
      if (QUEST_DATA[req.id]) continue; // quests use the quest journal
      for (const state of [unlocks([]), maxed()]) {
        const progress = calculateGoalProgress(req, state, 'vanilla');
        for (const item of progress.missing.filter(entry => entry.startsWith('Unlock: '))) {
          // Usually its own table's Key; Soda Ash (Charter Ships) needs the Mobility Key.
          // A Key with several sources reads 'Temple Trekking or Forestry': each must be rollable.
          for (const id of item.slice('Unlock: '.length).split(' or ')) {
            expect(Object.values(ROLLABLE).some(list => list?.includes(id)), `${key}: ${item}`).toBe(true);
          }
        }
        expect(progress.percentage === 100, key).toBe(analyzeRequirement(req, state, 'vanilla').isFullyPlayable);
        expect(progress.percentage === 100, key).toBe(progress.missing.length === 0);
      }
    }
  });
});
