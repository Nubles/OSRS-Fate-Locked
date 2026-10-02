import { describe, expect, it } from 'vitest';
import type { DiaryTask } from '../data/diaryTasks';
import { FARMING_PATCH_LIST, GUILDS_LIST, POH_LIST, SLAYER_UNLOCKS_LIST } from '../data/items';
import type { UnlockState } from '../types';
import { diaryRequirementOptionLabel, evaluateDiaryTaskEligibility } from './journalStatus';
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
