import { describe, expect, it } from 'vitest';
import { ALL_DIARY_TASKS, DiaryTask } from '../data/diaryTasks';
import { QUEST_DATA, QuestData } from '../data/questData';
import { DropSource, UnlockState } from '../types';
import {
  canEarnDiaryTier,
  diaryTaskCompletionDecision,
  questCompletionDecision,
  withJournalCompletion,
} from './journalCompletion';
import { evaluateDiaryTaskEligibility } from './journalStatus';

const unlocked = (over: Partial<UnlockState> = {}): UnlockState => ({
  equipment: {}, skills: {}, levels: {},
  regions: [], mobility: [], arcana: [], housing: [], merchants: [],
  minigames: [], bosses: [], storage: [], guilds: [], farming: [],
  slayerUnlocks: [], quests: [], diaries: [], cas: [],
  completedTasks: [], collectionLog: {}, ...over,
});

describe('journal completion decisions', () => {
  const unlocksReadyForPryingTimes = (): UnlockState => unlocked({
    regions: ['The Pandemonium', 'Port Sarim', 'Rimmington'],
    quests: ['Pandemonium', "The Knight's Sword"],
    skills: { Smithing: 3, Sailing: 2 },
    levels: { Smithing: 30, Sailing: 12 },
  });

  const malformedQuest = (overrides: Partial<QuestData>): QuestData => ({
    operationalRequirements: [], id: 'Malformed policy quest',
    name: 'Malformed policy quest',
    kind: 'quest',
    accessPolicy: 'regions',
    regions: ['Asgarnia'],
    skills: {},
    prereqs: [],
    points: 0,
    difficulty: DropSource.QUEST_NOVICE,
    ...overrides,
  });

  it.each([
    {
      name: 'locations policy with missing locations',
      quest: malformedQuest({
        accessPolicy: 'locations',
        oneOf: [{ regions: ['Misthalin'] }],
      }),
      error: 'locations policy requires at least one base location',
    },
    {
      name: 'locations policy with empty locations',
      quest: malformedQuest({ accessPolicy: 'locations', locations: [] }),
      error: 'locations policy requires at least one base location',
    },
    {
      name: 'regions-and-locations policy with missing locations',
      quest: malformedQuest({ accessPolicy: 'regions-and-locations' }),
      error: 'regions-and-locations policy requires at least one base location',
    },
    {
      name: 'regions-and-locations policy with empty locations',
      quest: malformedQuest({ accessPolicy: 'regions-and-locations', locations: [] }),
      error: 'regions-and-locations policy requires at least one base location',
    },
    {
      name: 'regions-and-locations policy with empty regions',
      quest: malformedQuest({
        accessPolicy: 'regions-and-locations',
        regions: [],
        locations: [{
          id: 'rimmington',
          label: 'Rimmington',
          standardAreas: ['Rimmington'],
          chunkOptions: [{ cx: 46, cy: 50 }],
        }],
      }),
      error: 'regions-and-locations policy requires at least one region',
    },
  ])('does not let manual attestation bypass $name', ({ quest, error }) => {
    expect(questCompletionDecision(
      quest,
      unlocked(),
      'vanilla',
      { manualConfirmed: true },
    )).toEqual({
      ok: false,
      reason: `Requires: Invalid quest access configuration: ${error}`,
    });
  });

  it('keeps a malformed stored completion on the duplicate no-reward path', () => {
    const quest = malformedQuest({
      accessPolicy: 'locations',
      oneOf: [{ regions: ['Misthalin'] }],
    });

    expect(questCompletionDecision(
      quest,
      unlocked({ quests: [quest.id] }),
      'vanilla',
      { manualConfirmed: true },
    )).toEqual({ ok: false, reason: 'Already completed' });
  });
  it('rejects a quest completion when canonical eligibility is blocked', () => {
    const result = questCompletionDecision(
      QUEST_DATA['A Porcine of Interest'],
      unlocked({
        regions: ['Misthalin', 'Draynor Village', 'Port Sarim'],
        skills: { Slayer: 1 },
        levels: { Slayer: 1 },
      }),
      'vanilla',
    );
    expect(result).toEqual({ ok: false, reason: 'Requires: South Falador Farm' });
  });

  it("rejects Witch's Potion and Murder Mystery before their exact locations are accessible", () => {
    expect(questCompletionDecision(
      QUEST_DATA["Witch's Potion"],
      unlocked({ regions: ['Asgarnia'] }),
      'vanilla',
    )).toEqual({ ok: false, reason: 'Requires: Rimmington' });
    expect(questCompletionDecision(
      QUEST_DATA['Murder Mystery'],
      unlocked({ regions: ['Kandarin'] }),
      'vanilla',
    )).toEqual({ ok: false, reason: "Requires: Sinclair Mansion, Seers' Village" });
  });

  it('keeps Murder Mystery blocked until both of its chunks are accessible', () => {
    const quest = QUEST_DATA['Murder Mystery'];
    const oneLocation = unlocked({
      regions: ['Kandarin'],
      chunks: ['42,55'],
    });

    expect(questCompletionDecision(quest, oneLocation, 'chunked')).toEqual({
      ok: false,
      reason: "Requires: Seers' Village",
    });
    expect(questCompletionDecision(
      quest,
      { ...oneLocation, chunks: ['42,55', '42,54'] },
      'chunked',
      { manualConfirmed: true },
    )).toEqual({ ok: true });
  });

  it('accepts a Diary task only when task skills quests and regions are met', () => {
    const task: DiaryTask = {
      id: 'x',
      tierId: 'Falador Medium',
      description: 'Make a crafting item in Falador.',
      skills: { Crafting: 36 },
      regions: ['Falador'],
    };
    expect(diaryTaskCompletionDecision(task, unlocked(), 'vanilla').ok).toBe(false);
    expect(diaryTaskCompletionDecision(task, unlocked({
      regions: ['Falador'],
      skills: { Crafting: 4 },
      levels: { Crafting: 36 },
    }), 'vanilla').ok).toBe(true);
  });

  it('allows a real combat-51 account to complete the Vannaka diary task', () => {
    const task = ALL_DIARY_TASKS.find(candidate => candidate.id === 'var_med_9')!;
    const combatSkills = ['Attack', 'Strength', 'Defence', 'Hitpoints', 'Prayer', 'Ranged', 'Magic'];
    const result = diaryTaskCompletionDecision(task, unlocked({
      skills: Object.fromEntries(combatSkills.map(skill => [skill, 1])),
      levels: Object.fromEntries(combatSkills.map(skill => [skill, 40])),
      regions: ['Edgeville'],
    }), 'vanilla');

    expect(result).toEqual({ ok: true });
  });

  it('requires and accepts an explicit quest manual attestation', () => {
    const task = QUEST_DATA['Prying Times'];
    const ready = unlocksReadyForPryingTimes();
    expect(questCompletionDecision(task, ready, 'vanilla')).toEqual({
      ok: false,
      reason: expect.stringContaining('Confirm: One open Sailing task slot'),
    });
    expect(questCompletionDecision(
      task,
      ready,
      'vanilla',
      { manualConfirmed: true },
    )).toEqual({ ok: true });
  });
  it('reports structured Diary-task eligibility from the shared evaluator', () => {
    const task: DiaryTask = {
      id: 'x',
      tierId: 'Falador Medium',
      description: 'Make a crafting item in Falador.',
      skills: { Crafting: 36 },
      quests: ['Doric\'s Quest'],
      regions: ['Falador'],
    };
    const result = evaluateDiaryTaskEligibility(task, unlocked(), 'vanilla');
    expect(result.eligible).toBe(false);
    expect(result.blockers).toEqual([
      {
        kind: 'skill', label: 'Crafting 36',
        requirement: { type: 'single', skill: 'Crafting', level: 36 },
      },
      { kind: 'quest', label: 'Doric\'s Quest' },
      { kind: 'region', label: 'Falador' },
    ]);
  });

  it('rejects a repeated completion after the accepted ID is reserved', () => {
    const quest = QUEST_DATA['A Porcine of Interest'];
    const available = unlocked({
      regions: ['Misthalin', 'Draynor Village', 'Falador'],
      skills: { Slayer: 1 },
      levels: { Slayer: 1 },
    });

    expect(questCompletionDecision(quest, available, 'vanilla', { manualConfirmed: true })).toEqual({ ok: true });

    const reserved = withJournalCompletion(
      available,
      'quests',
      quest.id,
    );
    expect(questCompletionDecision(quest, reserved, 'vanilla')).toEqual({
      ok: false,
      reason: 'Already completed',
    });
  });

  it('does not offer the current Karamja cape task after the legacy Jad completion', () => {
    const task = ALL_DIARY_TASKS.find(
      candidate => candidate.tierId === 'Karamja Elite'
        && candidate.description.startsWith('Equip a Fire Cape'),
    );

    expect(task?.id).toBe('kar_elite_4');
    expect(diaryTaskCompletionDecision(
      task!,
      unlocked({ completedTasks: ['kar_elite_4'] }),
      'vanilla',
    )).toEqual({ ok: false, reason: 'Already completed' });
  });

  it('accepts two distinct legitimate completions in order', () => {
    const first: DiaryTask = {
      id: 'fal_easy_first',
      tierId: 'Falador Easy',
      description: 'Complete the first eligible task.',
    };
    const second: DiaryTask = {
      id: 'fal_easy_second',
      tierId: 'Falador Easy',
      description: 'Complete the second eligible task.',
    };

    const available = unlocked();
    expect(diaryTaskCompletionDecision(first, available, 'vanilla')).toEqual({ ok: true });
    const afterFirst = withJournalCompletion(
      available,
      'completedTasks',
      first.id,
    );
    expect(diaryTaskCompletionDecision(second, afterFirst, 'vanilla')).toEqual({ ok: true });
    const afterSecond = withJournalCompletion(
      afterFirst,
      'completedTasks',
      second.id,
    );

    expect(afterSecond.completedTasks).toEqual([first.id, second.id]);
  });

  it('earns a Diary tier only after every current task is complete', () => {
    const tasks = [
      { id: 'fal_easy_1', tierId: 'Falador Easy' },
      { id: 'fal_easy_2', tierId: 'Falador Easy' },
    ];
    expect(canEarnDiaryTier('Falador Easy', ['fal_easy_1'], tasks)).toBe(false);
    expect(canEarnDiaryTier(
      'Falador Easy',
      ['fal_easy_1', 'fal_easy_2'],
      tasks,
    )).toBe(true);
  });
  it('does not let attestation bypass a machine blocker', () => {
    const task = ALL_DIARY_TASKS.find(({ id }) => id === 'var_hard_2')!;
    expect(diaryTaskCompletionDecision(
      task,
      unlocked(),
      'chunked',
      { manualConfirmed: true },
    ).ok).toBe(false);
  });

  it('checks The Slug Menace machine requirements before manual attestation', () => {
    const quest = QUEST_DATA['The Slug Menace'];
    const shared = {
      skills: { Crafting: 3, Runecraft: 3, Slayer: 3, Thieving: 3 },
      levels: { Crafting: 30, Runecraft: 30, Slayer: 30, Thieving: 30 },
      quests: ['Sea Slug', 'Wanted!'],
    };
    const machineBlocked = unlocked({
      ...shared,
      regions: ['Observatory', 'Witchaven'],
    });

    expect(questCompletionDecision(
      quest,
      machineBlocked,
      'vanilla',
      { manualConfirmed: true },
    )).toEqual({ ok: false, reason: 'Requires: Falador' });

    const machineReady = unlocked({
      ...shared,
      regions: ['Observatory', 'Witchaven', 'Falador'],
    });
    expect(questCompletionDecision(quest, machineReady, 'vanilla')).toEqual({
      ok: false,
      reason: expect.stringContaining('Confirm: Access to all required elemental altars through one route: surface altars with Misthalin and Kharidian Desert; the Abyss through Edgeville with Enter the Abyss completed; or Guardians of the Rift with Misthalin and Temple of the Eye completed'),
    });
    expect(questCompletionDecision(
      quest,
      machineReady,
      'vanilla',
      { manualConfirmed: true },
    )).toEqual({ ok: true });
  });

  it('accepts the Kudos task only after confirmation', () => {
    const task = ALL_DIARY_TASKS.find(({ id }) => id === 'var_hard_2')!;
    const ready = unlocked({ regions: ['Varrock'] });
    expect(diaryTaskCompletionDecision(task, ready, 'vanilla')).toEqual({
      ok: false,
      reason: 'Confirm: 153 Varrock Museum Kudos',
    });
    expect(diaryTaskCompletionDecision(
      task,
      ready,
      'vanilla',
      { manualConfirmed: true },
    )).toEqual({ ok: true });
  });
});

// This suite isolates destination/skill/manual behavior with known legal supplies.
// Acquisition availability itself is covered by itemAcquisition and source tests.
import { beforeEach as beforeSupplyTest, afterEach as afterSupplyTest, vi as supplySpy } from 'vitest';
import { chunkContentService as suppliedItemsFixture } from '../services/ChunkContentService';
let restoreSupplyFixture: (() => void)[] = [];
beforeSupplyTest(() => {
  const ready = supplySpy.spyOn(suppliedItemsFixture, 'ready', 'get').mockReturnValue(true);
  const records = supplySpy.spyOn(suppliedItemsFixture, 'itemSourceRecords').mockImplementation(itemName => [{ itemName, kind: 'spawn', hostName: 'Test prepared supplies', cx: 50, cy: 50, rawRequirements: [] }]);
  restoreSupplyFixture = [() => ready.mockRestore(), () => records.mockRestore()];
});
afterSupplyTest(() => restoreSupplyFixture.forEach(restore => restore()));
