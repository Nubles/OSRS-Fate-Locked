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

const VOCABULARIES = [
  { field: 'guilds', name: "Wizards' Guild", kind: 'guild', shown: "Wizards' Guild" },
  { field: 'farming', name: 'Herb', kind: 'farming', shown: 'Herb patch' },
  { field: 'housing', name: 'Menagerie', kind: 'housing', shown: 'Menagerie' },
  { field: 'slayerUnlocks', name: 'Malevolent Masquerade', kind: 'slayer', shown: 'Malevolent Masquerade' },
] as const;

const probe = (field: string, name: string, extra: Partial<DiaryTask> = {}): DiaryTask => ({
  id: 'probe', tierId: 'Ardougne Easy', description: 'A task that uses an unlock.', [field]: [name], ...extra,
} as DiaryTask);

describe('Diary tasks that use a guild, farming patch, house room or Slayer reward', () => {
  it.each(VOCABULARIES)('read as locked without the $field unlock, naming $shown, and ready with it', ({ field, name, kind, shown }) => {
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

  it.each(VOCABULARIES)('never hold up logging a task by hand for a missing $field unlock', ({ field, name }) => {
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

  it('still asks for confirmations when a task is logged by hand', () => {
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
