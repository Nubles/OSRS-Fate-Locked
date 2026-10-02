import { describe, expect, it } from 'vitest';
import { ALL_DIARY_TASKS, type DiaryTask } from '../data/diaryTasks';
import { DIARY_DATA } from '../data/diaryData';
import { QUEST_DATA } from '../data/questData';
import {
  ARCANA_LIST, BOSSES_LIST, EQUIPMENT_SLOTS, FARMING_PATCH_LIST, GUILDS_LIST, MERCHANTS_LIST, MINIGAMES_LIST,
  MOBILITY_LIST, POH_LIST, REGION_GROUPS, SKILLS_LIST, SLAYER_UNLOCKS_LIST,
} from '../data/items';
import { TableType, type GameState, type UnlockState } from '../types';
import { diaryRequirementOptionLabel, evaluateDiaryTaskEligibility, getDiaryStatus } from './journalStatus';
import { planForTarget } from './goalPlanner';
import { buildGoalRoute } from './goalRoute';
import { diaryTaskCompletionDecision, diaryTaskLoggingEligibility, withStatusOnlyUnlocks } from './journalCompletion';

/**
 * The owner's calls of 2 October 2026: a Diary task names the guild, farming
 * patch, house room or Slayer reward it uses. Each is a rolled unlock. It sets
 * the task's status in the Journal only: logging the task by hand never waits
 * for it, as manual play stays free.
 */

const account = (overrides: Partial<UnlockState> = {}): UnlockState => ({
  equipment: {}, skills: {}, levels: {}, regions: [], mobility: [], arcana: [],
  housing: [], merchants: [], minigames: [], bosses: [], storage: [], guilds: [],
  farming: [], slayerUnlocks: [], quests: [], diaries: [], cas: [],
  completedTasks: [], collectionLog: {}, ...overrides,
});

/** Everything unlocked, every quest and Combat Achievement done: only what a check takes away is missing. */
const everything = (overrides: Partial<UnlockState> = {}) => account({
  equipment: Object.fromEntries(EQUIPMENT_SLOTS.map(slot => [slot, 9])),
  skills: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 10])),
  levels: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 99])),
  regions: [...Object.keys(REGION_GROUPS), ...Object.values(REGION_GROUPS).flat()],
  arcana: [...ARCANA_LIST], quests: Object.keys(QUEST_DATA), mobility: [...MOBILITY_LIST],
  merchants: [...MERCHANTS_LIST], minigames: [...MINIGAMES_LIST], bosses: [...BOSSES_LIST],
  guilds: [...GUILDS_LIST], farming: [...FARMING_PATCH_LIST], housing: [...POH_LIST],
  slayerUnlocks: [...SLAYER_UNLOCKS_LIST], cas: ['Easy', 'Medium', 'Hard', 'Elite', 'Master', 'Grandmaster'],
  ...overrides,
});
const task = (id: string) => ALL_DIARY_TASKS.find(row => row.id === id)!;
const exceptTask = (id: string) => ALL_DIARY_TASKS
  .filter(row => row.tierId === task(id).tierId && row.id !== id).map(row => row.id);

/** Each vocabulary: its field, how the Journal shows the unlock, the unlock's id, and its blocker kind. */
const VOCABULARIES = [
  ['guilds', "Wizards' Guild", "Wizards' Guild", 'guild'],
  ['farming', 'Herb patch', 'Herb', 'farming'],
  ['housing', 'Menagerie', 'Menagerie', 'housing'],
  ['slayerUnlocks', 'Malevolent Masquerade', 'Malevolent Masquerade', 'slayer'],
] as const;

const probe = (field: string, name: string, extra: Partial<DiaryTask> = {}): DiaryTask => ({
  id: 'probe', tierId: 'Ardougne Easy', description: 'A task that uses an unlock.', [field]: [name], ...extra,
} as DiaryTask);

describe('Diary tasks that use a guild, farming patch, house room or Slayer reward', () => {
  it.each(VOCABULARIES)('read as locked without their %s unlock, naming %s, and as ready with it', (field, shown, name, kind) => {
    const row = probe(field, name);
    const locked = evaluateDiaryTaskEligibility(row, account());
    expect(locked).toMatchObject({ eligible: false, machineEligible: false });
    expect(locked.blockers).toEqual([expect.objectContaining({ kind, label: shown })]);

    const ready = evaluateDiaryTaskEligibility(row, account({ [field]: [name] } as Partial<UnlockState>));
    expect(ready).toMatchObject({ eligible: true, blockers: [] });
    expect(ready.evidence).toEqual([shown]);
  });

  it('keep the farming unlock id beside the patch name the Journal shows', () => {
    expect(evaluateDiaryTaskEligibility(probe('farming', 'Fruit Tree'), account()).blockers)
      .toEqual([{ kind: 'farming', label: 'Fruit Tree patch', patch: 'Fruit Tree' }]);
  });

  it.each(VOCABULARIES)('never hold up logging a task by hand for a missing %s unlock', (field, _shown, name) => {
    const row = probe(field, name);
    expect(diaryTaskLoggingEligibility(row, account())).toMatchObject({ eligible: true, blockers: [] });
    expect(diaryTaskCompletionDecision(row, account())).toEqual({ ok: true });
    // Its other requirements still apply when it is logged.
    const elsewhere = probe(field, name, { regions: ['Yanille'] });
    expect(diaryTaskCompletionDecision(elsewhere, account())).toEqual({ ok: false, reason: 'Requires: Yanille' });
    expect(diaryTaskCompletionDecision(elsewhere, account({ regions: ['Yanille'] }))).toEqual({ ok: true });
  });

  it('never hold up logging when every route needs a house room the player lacks', () => {
    const row: DiaryTask = {
      id: 'probe', tierId: 'Morytania Hard', description: 'Enter a portal.',
      oneOf: [{ housing: ['Portal Chamber'] }, { housing: ['Portal Nexus'] }],
    };
    expect(evaluateDiaryTaskEligibility(row, account()).blockers)
      .toEqual([expect.objectContaining({ kind: 'alternative', label: 'Portal Chamber or Portal Nexus' })]);
    expect(evaluateDiaryTaskEligibility(row, account({ housing: ['Portal Nexus'] })).eligible).toBe(true);
    expect(diaryTaskCompletionDecision(row, account())).toEqual({ ok: true });
  });

  it('still ask for their confirmations when logged by hand', () => {
    const row = probe('guilds', 'Mining Guild', { items: ['Prospector helmet'] });
    expect(diaryTaskCompletionDecision(row, account())).toEqual({ ok: false, reason: 'Confirm: Prospector helmet' });
    expect(diaryTaskCompletionDecision(row, account(), undefined, { manualConfirmed: true })).toEqual({ ok: true });
  });

  it('name each unlock in a route label, a farming patch as a patch', () => {
    expect(diaryRequirementOptionLabel({ label: 'Grow watermelons', skills: { Farming: 47 }, farming: ['Allotment'] }))
      .toBe('Grow watermelons: Farming 47 + Allotment patch');
    expect(diaryRequirementOptionLabel({ guilds: ["Legends' Guild"], housing: ['Portal Nexus'], slayerUnlocks: ['Malevolent Masquerade'] }))
      .toBe("Legends' Guild + Portal Nexus + Malevolent Masquerade");
  });

  it('count every status-only unlock as unlocked for logging, and nothing else', () => {
    const unlocks = withStatusOnlyUnlocks(account({ regions: ['Falador'] }));
    expect(unlocks).toMatchObject({
      guilds: GUILDS_LIST, farming: FARMING_PATCH_LIST, housing: POH_LIST, slayerUnlocks: SLAYER_UNLOCKS_LIST,
      regions: ['Falador'], merchants: [], minigames: [], bosses: [],
    });
  });
});

describe('A Diary task done inside a guild', () => {
  it('locks the Ranging Guild entry, its tier, plan and route until the guild is unlocked, but never its logging', () => {
    const row = task('kan_med_3');
    const locked = everything({ guilds: [], completedTasks: exceptTask(row.id) });

    expect(evaluateDiaryTaskEligibility(row, locked, 'vanilla').blockers).toEqual([{ kind: 'guild', label: 'Ranging Guild' }]);
    expect(getDiaryStatus(DIARY_DATA[row.tierId], locked, 'vanilla')).toBe('LOCKED_GUILD');
    expect(planForTarget('diary', row.tierId, locked, 'vanilla')?.guildSteps).toEqual([
      expect.objectContaining({ kind: 'guild', id: 'Ranging Guild', unlockTable: TableType.GUILDS }),
    ]);
    const route = buildGoalRoute(row.tierId, { unlocks: locked, gameModeId: 'vanilla' } as GameState)!;
    expect(route.guilds).toEqual([expect.objectContaining({ name: 'Ranging Guild', met: false })]);
    expect(route.tables).toContainEqual(expect.objectContaining({ table: TableType.GUILDS, needed: ['Ranging Guild'] }));
    expect(diaryTaskCompletionDecision(row, locked, 'vanilla')).toEqual({ ok: true });

    const unlocked = { ...locked, guilds: ['Ranging Guild'] };
    expect(evaluateDiaryTaskEligibility(row, unlocked, 'vanilla').eligible).toBe(true);
    expect(getDiaryStatus(DIARY_DATA[row.tierId], unlocked, 'vanilla')).toBe('AVAILABLE');
  });
});

describe('A Diary task that uses a farming patch', () => {
  it('locks the Catherby limpwurt, its tier, plan and route until the Flower patch is unlocked, but never its logging', () => {
    const row = task('kan_med_8');
    const locked = everything({ farming: [], completedTasks: exceptTask(row.id) });

    expect(evaluateDiaryTaskEligibility(row, locked, 'vanilla').blockers)
      .toEqual([{ kind: 'farming', label: 'Flower patch', patch: 'Flower' }]);
    expect(getDiaryStatus(DIARY_DATA[row.tierId], locked, 'vanilla')).toBe('LOCKED_FARMING');
    expect(planForTarget('diary', row.tierId, locked, 'vanilla')?.farmingSteps).toEqual([
      expect.objectContaining({ kind: 'farming', id: 'Flower', label: 'Flower patch', unlockTable: TableType.FARMING_LAYERS }),
    ]);
    const route = buildGoalRoute(row.tierId, { unlocks: locked, gameModeId: 'vanilla' } as GameState)!;
    expect(route.farming).toEqual([expect.objectContaining({ name: 'Flower patch', met: false })]);
    expect(route.tables).toContainEqual(expect.objectContaining({ table: TableType.FARMING_LAYERS, needed: ['Flower'] }));
    expect(diaryTaskCompletionDecision(row, locked, 'vanilla')).toEqual({ ok: true });

    const unlocked = { ...locked, farming: ['Flower'] };
    expect(evaluateDiaryTaskEligibility(row, unlocked, 'vanilla').eligible).toBe(true);
    expect(getDiaryStatus(DIARY_DATA[row.tierId], unlocked, 'vanilla')).toBe('AVAILABLE');
  });

  it('needs the allotment only on the scarecrow route that grows the watermelon', () => {
    const row = task('fal_med_4');
    const farmer = everything({ farming: ['Flower'], skills: { Farming: 10 }, levels: { Farming: 50 }, quests: [] });
    expect(evaluateDiaryTaskEligibility(row, farmer, 'vanilla').blockers).toEqual([
      expect.objectContaining({
        kind: 'alternative',
        routes: [
          { label: 'Grow watermelons: Farming 47 + Allotment patch', blockers: [{ kind: 'farming', label: 'Allotment patch', patch: 'Allotment' }] },
          expect.objectContaining({ label: expect.stringContaining('Obtain a watermelon from gryphons') }),
        ],
      }),
    ]);
    expect(evaluateDiaryTaskEligibility(row, { ...farmer, farming: ['Flower', 'Allotment'] }, 'vanilla').eligible).toBe(true);
    expect(evaluateDiaryTaskEligibility(row, everything({ farming: ['Allotment'] }), 'vanilla').blockers)
      .toEqual([{ kind: 'farming', label: 'Flower patch', patch: 'Flower' }]);
  });
});

describe('A Diary task that uses a house room or a Slayer reward', () => {
  it.each([
    ['frem_med_7', 'Menagerie', 'housing', 'LOCKED_HOUSING', 'housingSteps', TableType.POH, 'housing'],
    ['des_hard_6', 'Malevolent Masquerade', 'slayerUnlocks', 'LOCKED_SLAYER', 'slayerSteps', TableType.SLAYER_UNLOCKS, 'slayerUnlocks'],
  ] as const)('locks %s, its tier, plan and route until %s is unlocked, but never its logging', (id, name, field, status, steps, table, routeField) => {
    const row = task(id);
    const locked = everything({ [field]: [], completedTasks: exceptTask(row.id) } as Partial<UnlockState>);

    expect(evaluateDiaryTaskEligibility(row, locked, 'vanilla').blockers)
      .toEqual([{ kind: field === 'housing' ? 'housing' : 'slayer', label: name }]);
    expect(getDiaryStatus(DIARY_DATA[row.tierId], locked, 'vanilla')).toBe(status);
    expect(planForTarget('diary', row.tierId, locked, 'vanilla')?.[steps]).toEqual([
      expect.objectContaining({ id: name, label: name, unlockTable: table }),
    ]);
    const route = buildGoalRoute(row.tierId, { unlocks: locked, gameModeId: 'vanilla' } as GameState)!;
    expect(route[routeField]).toEqual([expect.objectContaining({ name, met: false })]);
    expect(route.tables).toContainEqual(expect.objectContaining({ table, needed: [name] }));
    expect(diaryTaskCompletionDecision(row, locked, 'vanilla', { manualConfirmed: true })).toEqual({ ok: true });

    const unlocked = { ...locked, [field]: [name] };
    expect(evaluateDiaryTaskEligibility(row, unlocked, 'vanilla').machineEligible).toBe(true);
    expect(getDiaryStatus(DIARY_DATA[row.tierId], unlocked, 'vanilla')).toBe('AVAILABLE');
  });

  it('takes either portal room for the Kharyrll portal', () => {
    const row = task('mor_hard_1');
    const noRooms = everything({ housing: [] });
    expect(evaluateDiaryTaskEligibility(row, noRooms, 'vanilla').blockers).toEqual([
      expect.objectContaining({ kind: 'alternative', label: 'Portal Chamber or Portal Nexus' }),
    ]);
    expect(evaluateDiaryTaskEligibility(row, { ...noRooms, housing: ['Portal Chamber'] }, 'vanilla').eligible).toBe(true);
    expect(evaluateDiaryTaskEligibility(row, { ...noRooms, housing: ['Portal Nexus'] }, 'vanilla').eligible).toBe(true);
    expect(diaryTaskCompletionDecision(row, noRooms, 'vanilla')).toEqual({ ok: true });
  });
});
