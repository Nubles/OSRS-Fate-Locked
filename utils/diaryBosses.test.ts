import { describe, expect, it } from 'vitest';
import diarySource from '../data/sources/achievement-diary-tasks.json';
import { ALL_DIARY_TASKS } from '../data/diaryTasks';
import { DIARY_DATA } from '../data/diaryData';
import { QUEST_DATA } from '../data/questData';
import {
  ARCANA_LIST, BOSSES_LIST, EQUIPMENT_SLOTS, MERCHANTS_LIST, MINIGAMES_LIST, MOBILITY_LIST, REGION_GROUPS, SKILLS_LIST,
} from '../data/items';
import { TableType, type GameState, type UnlockState } from '../types';
import { evaluateDiaryTaskEligibility, getDiaryStatus } from './journalStatus';
import { diaryTaskCompletionDecision } from './journalCompletion';
import { planForTarget } from './goalPlanner';
import { buildGoalRoute } from './goalRoute';

/**
 * A player reported on 26 September 2026 that "Kill the Giant Mole" read as
 * doable without the Giant Mole unlocked. Like minigames, a diary task that
 * means fighting a boss needs that boss. The review, with the tasks left
 * alone and why, is docs/reviews/2026-09-26-diary-boss-audit.md.
 */
const REVIEWED: Record<string, string> = {
  des_hard_4: 'Kalphite Queen',
  fal_hard_3: 'Giant Mole',
  frem_elite_1: 'Dagannoth Kings',
  frem_elite_5: "Kree'arra, General Graardor, Commander Zilyana, K'ril Tsutsaroth",
  kar_easy_9: 'TzHaar Fight Cave',
  kar_hard_2: 'TzHaar Fight Cave',
  kou_elite_3: 'Skotizo',
  kou_elite_7: 'Chambers of Xeric',
  kou_med_11: 'Wintertodt',
  mor_elite_6: 'Barrows Brothers',
  west_elite_2: 'Thermonuclear Smoke Devil',
  west_hard_11: 'Zulrah',
  wild_elite_1: "Callisto, Artio, Venenatis, Spindel, Vet'ion, Calvar'ion",
  wild_hard_6: 'Chaos Elemental',
  wild_hard_7: 'Crazy Archaeologist, Chaos Fanatic, Scorpia',
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
  merchants: [...MERCHANTS_LIST], minigames: [...MINIGAMES_LIST], bosses: [...BOSSES_LIST],
  cas: ['Easy', 'Medium', 'Hard', 'Elite', 'Master', 'Grandmaster'],
  ...overrides,
});
const task = (id: string) => ALL_DIARY_TASKS.find(row => row.id === id)!;
const exceptTask = (id: string) => ALL_DIARY_TASKS
  .filter(row => row.tierId === task(id).tierId && row.id !== id).map(row => row.id);
const bossBlockers = (id: string, unlocks: UnlockState) => evaluateDiaryTaskEligibility(task(id), unlocks, 'vanilla')
  .blockers.filter(blocker => blocker.kind === 'boss');

describe('diary tasks that mean fighting a boss', () => {
  it('tag exactly the reviewed tasks, each with a boss the tracker unlocks', () => {
    const tagged = Object.fromEntries(ALL_DIARY_TASKS
      .filter(row => row.bosses?.length || row.anyOfBosses?.length || row.oneOf?.some(option => option.bosses?.length))
      .map(row => [row.id, [
        ...(row.bosses ?? []),
        ...(row.oneOf ?? []).flatMap(option => option.bosses ?? []),
        ...(row.anyOfBosses ?? []).flat(),
      ].join(', ')]));

    expect(tagged).toEqual(REVIEWED);
    for (const bosses of Object.values(REVIEWED)) {
      for (const boss of bosses.split(', ')) expect(BOSSES_LIST).toContain(boss);
    }
  });

  it('keep the review beside the data', () => {
    const audit = diarySource.bossAudit;

    expect(audit.changedTaskIds).toEqual(Object.keys(REVIEWED).sort());
    for (const id of Object.keys(audit.notTagged)) {
      expect(task(id), id).toBeDefined();
      expect(task(id).bosses, id).toBeUndefined();
    }
  });

  it('wait for every boss they fight, and only for those', () => {
    for (const [id, bosses] of Object.entries(REVIEWED)) {
      if (!task(id).bosses?.length) continue;
      for (const boss of bosses.split(', ')) {
        const without = everything({ bosses: BOSSES_LIST.filter(name => name !== boss) });
        expect(bossBlockers(id, without), `${id} ${boss}`).toEqual([{ kind: 'boss', label: boss }]);
      }
      expect(bossBlockers(id, everything()), id).toEqual([]);
    }
  });

  it('lock the Giant Mole, its tier and its plan until the Giant Mole is unlocked', () => {
    const row = task('fal_hard_3');
    const locked = everything({ regions: ['Falador'], bosses: [], completedTasks: exceptTask(row.id) });

    expect(evaluateDiaryTaskEligibility(row, locked, 'vanilla').blockers)
      .toEqual([{ kind: 'boss', label: 'Giant Mole' }]);
    expect(diaryTaskCompletionDecision(row, locked, 'vanilla', { manualConfirmed: true }).ok).toBe(false);
    expect(getDiaryStatus(DIARY_DATA[row.tierId], locked, 'vanilla')).toBe('LOCKED_BOSS');
    expect(planForTarget('diary', row.tierId, locked, 'vanilla')?.bossSteps).toEqual([
      expect.objectContaining({ kind: 'boss', id: 'Giant Mole', unlockTable: TableType.BOSSES }),
    ]);
    const route = buildGoalRoute(row.tierId, { unlocks: locked, gameModeId: 'vanilla' } as GameState)!;
    expect(route.bosses).toEqual([expect.objectContaining({ name: 'Giant Mole', met: false })]);
    expect(route.tables).toContainEqual(expect.objectContaining({ table: TableType.BOSSES, needed: ['Giant Mole'] }));

    const unlocked = { ...locked, bosses: ['Giant Mole'] };
    expect(evaluateDiaryTaskEligibility(row, unlocked, 'vanilla').eligible).toBe(true);
    expect(getDiaryStatus(DIARY_DATA[row.tierId], unlocked, 'vanilla')).toBe('AVAILABLE');
  });

  it('accept the Fight Pits or the Fight Cave for the TzHaar attempt', () => {
    const row = task('kar_easy_9');
    const neither = everything({ minigames: [], bosses: [] });

    expect(evaluateDiaryTaskEligibility(row, neither, 'vanilla').eligible).toBe(false);
    expect(evaluateDiaryTaskEligibility(row, { ...neither, minigames: ['TzHaar Fight Pit'] }, 'vanilla').eligible).toBe(true);
    expect(evaluateDiaryTaskEligibility(row, { ...neither, bosses: ['TzHaar Fight Cave'] }, 'vanilla').eligible).toBe(true);
  });

  it('accept either version of each Wilderness boss, in any mix', () => {
    // The task also asks the player to confirm each boss's entry requirement.
    const row = task('wild_elite_1');
    const none = everything({ bosses: [] });
    const blockers = (bosses: string[]) => evaluateDiaryTaskEligibility(row, { ...none, bosses }, 'vanilla').blockers;

    expect(blockers([])).toEqual([
      { kind: 'boss', label: 'Callisto or Artio' },
      { kind: 'boss', label: 'Venenatis or Spindel' },
      { kind: 'boss', label: "Vet'ion or Calvar'ion" },
    ]);
    expect(blockers(['Callisto', 'Venenatis', "Vet'ion"])).toEqual([]);
    expect(blockers(['Artio', 'Venenatis', "Calvar'ion"])).toEqual([]);
    expect(blockers(['Callisto', 'Spindel'])).toEqual([{ kind: 'boss', label: "Vet'ion or Calvar'ion" }]);
    expect(evaluateDiaryTaskEligibility(row, { ...none, bosses: ['Artio', 'Spindel', "Calvar'ion"] }, 'vanilla').confirmable).toBe(true);
  });

  it('leave entering the King Black Dragon\'s lair alone', () => {
    expect(bossBlockers('wilderness_easy_8', everything({ bosses: [] }))).toEqual([]);
  });
});
