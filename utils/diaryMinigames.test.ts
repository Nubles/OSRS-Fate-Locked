import { describe, expect, it } from 'vitest';
import diarySource from '../data/sources/achievement-diary-tasks.json';
import { ALL_DIARY_TASKS } from '../data/diaryTasks';
import { DIARY_DATA } from '../data/diaryData';
import { QUEST_DATA } from '../data/questData';
import {
  ARCANA_LIST, EQUIPMENT_SLOTS, MERCHANTS_LIST, MINIGAMES_LIST, MOBILITY_LIST, REGION_GROUPS, SKILLS_LIST,
} from '../data/items';
import { TableType, type GameState, type UnlockState } from '../types';
import { evaluateDiaryTaskEligibility, getDiaryStatus } from './journalStatus';
import { diaryTaskCompletionDecision } from './journalCompletion';
import { planForTarget } from './goalPlanner';
import { buildGoalRoute } from './goalRoute';

/**
 * The owner's rule of 26 September 2026: a diary task that means playing a
 * minigame needs that minigame unlocked. The review, with the tasks left
 * alone and why, is docs/reviews/2026-09-26-diary-minigame-audit.md.
 */
const REVIEWED: Record<string, string> = {
  ard_easy_5: 'Fishing Trawler',
  ard_elite_1: 'Fishing Trawler',
  ard_elite_5: 'Nightmare Zone',
  ard_elite_8: 'Castle Wars',
  des_easy_8: 'Pyramid Plunder',
  des_easy_9: 'Pyramid Plunder',
  des_elite_5: 'Pyramid Plunder',
  frem_hard_9: 'Blast Furnace',
  kan_med_11: 'Barbarian Assault',
  kan_hard_9: 'Barbarian Assault',
  kan_elite_1: 'Barbarian Assault',
  kar_med_1: 'Brimhaven Agility Arena',
  kar_med_5: 'Tai Bwo Wannai Cleanup',
  kar_hard_1: 'TzHaar Fight Pit',
  kou_hard_5: 'Tithe Farm',
  kou_hard_8: 'Stealing Artefacts',
  lum_med_11: 'Impetuous Impulses',
  lum_hard_5: 'Tears of Guthix',
  mor_med_6: 'Trouble Brewing',
  mor_hard_5: 'Temple Trekking',
  west_easy_2: 'Pest Control',
  western_med_6: 'Pest Control',
  west_hard_3: 'Pest Control',
  west_elite_5: 'Pest Control',
  western_easy_5: 'Gnome Ball',
  west_med_7: 'Gnome Restaurant',
};

const account = (overrides: Partial<UnlockState> = {}): UnlockState => ({
  equipment: {}, skills: {}, levels: {}, regions: [], mobility: [], arcana: [],
  housing: [], merchants: [], minigames: [], bosses: [], storage: [], guilds: [],
  farming: [], slayerUnlocks: [], quests: [], diaries: [], cas: [],
  completedTasks: [], collectionLog: {}, ...overrides,
});
const everything = (overrides: Partial<UnlockState> = {}) => account({
  equipment: Object.fromEntries(EQUIPMENT_SLOTS.map(slot => [slot, 9])),
  skills: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 10])),
  levels: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 99])),
  regions: [...Object.keys(REGION_GROUPS), ...Object.values(REGION_GROUPS).flat()],
  arcana: [...ARCANA_LIST], quests: Object.keys(QUEST_DATA), mobility: [...MOBILITY_LIST],
  merchants: [...MERCHANTS_LIST], minigames: [...MINIGAMES_LIST],
  ...overrides,
});
const task = (id: string) => ALL_DIARY_TASKS.find(row => row.id === id)!;
const exceptTask = (id: string) => ALL_DIARY_TASKS
  .filter(row => row.tierId === task(id).tierId && row.id !== id).map(row => row.id);

describe('diary tasks played in a minigame', () => {
  it('tag exactly the reviewed tasks, each with a minigame the tracker unlocks', () => {
    const tagged = Object.fromEntries(ALL_DIARY_TASKS
      .filter(row => row.minigames?.length || row.oneOf?.some(option => option.minigames?.length))
      .map(row => [row.id, row.minigames?.join(', ')]));

    expect(tagged).toEqual(REVIEWED);
    for (const minigame of Object.values(REVIEWED)) expect(MINIGAMES_LIST).toContain(minigame);
  });

  it('keep the review beside the data', () => {
    const audit = diarySource.minigameAudit;

    expect(audit.changedTaskIds).toEqual(Object.keys(REVIEWED).sort());
    for (const id of Object.keys(audit.notTagged)) {
      expect(task(id), id).toBeDefined();
      expect(task(id).minigames, id).toBeUndefined();
    }
  });

  it('wait for their minigame, and only for it', () => {
    for (const [id, minigame] of Object.entries(REVIEWED)) {
      const without = everything({ minigames: MINIGAMES_LIST.filter(name => name !== minigame) });
      expect(evaluateDiaryTaskEligibility(task(id), without, 'vanilla').blockers, id)
        .toContainEqual({ kind: 'minigame', label: minigame });
      expect(evaluateDiaryTaskEligibility(task(id), everything(), 'vanilla').blockers
        .filter(blocker => blocker.kind === 'minigame'), id).toEqual([]);
    }
  });

  it('lock a Pest Control game, its tier and its plan until Pest Control is unlocked', () => {
    const row = task('west_easy_2');
    const locked = everything({
      regions: ["Void Knights' Outpost", 'Port Sarim'],
      minigames: [],
      completedTasks: exceptTask(row.id),
    });

    expect(evaluateDiaryTaskEligibility(row, locked, 'vanilla').blockers)
      .toEqual([{ kind: 'minigame', label: 'Pest Control' }]);
    expect(diaryTaskCompletionDecision(row, locked, 'vanilla', { manualConfirmed: true }).ok).toBe(false);
    expect(getDiaryStatus(DIARY_DATA[row.tierId], locked, 'vanilla')).toBe('LOCKED_MINIGAME');
    expect(planForTarget('diary', row.tierId, locked, 'vanilla')?.minigameSteps).toEqual([
      expect.objectContaining({ kind: 'minigame', id: 'Pest Control', unlockTable: TableType.MINIGAMES }),
    ]);
    const route = buildGoalRoute(row.tierId, { unlocks: locked, gameModeId: 'vanilla' } as GameState)!;
    expect(route.minigames).toEqual([expect.objectContaining({ name: 'Pest Control', met: false })]);
    expect(route.tables).toContainEqual(expect.objectContaining({ table: TableType.MINIGAMES, needed: ['Pest Control'] }));

    const unlocked = { ...locked, minigames: ['Pest Control'] };
    expect(evaluateDiaryTaskEligibility(row, unlocked, 'vanilla').eligible).toBe(true);
    expect(getDiaryStatus(DIARY_DATA[row.tierId], unlocked, 'vanilla')).toBe('AVAILABLE');
  });

  it('leave the Minigame Teleport task to its Mobility unlock', () => {
    expect(evaluateDiaryTaskEligibility(task('west_easy_9'), everything({ minigames: [] }), 'vanilla').eligible)
      .toBe(true);
  });
});
