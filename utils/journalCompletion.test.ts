import { describe, expect, it } from 'vitest';
import { ALL_DIARY_TASKS, DiaryTask } from '../data/diaryTasks';
import { QUEST_DATA } from '../data/questData';
import { UnlockState } from '../types';
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

  it('requires and accepts an explicit quest manual attestation', () => {
    const task = QUEST_DATA['Prying Times'];
    const ready = unlocksReadyForPryingTimes();
    expect(questCompletionDecision(task, ready, 'vanilla')).toEqual({
      ok: false,
      reason: 'Confirm: One open Sailing task slot',
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

    expect(questCompletionDecision(quest, available, 'vanilla')).toEqual({ ok: true });

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
