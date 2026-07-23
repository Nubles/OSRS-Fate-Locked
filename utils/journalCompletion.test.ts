import { describe, expect, it } from 'vitest';
import { DiaryTask } from '../data/diaryTasks';
import { QUEST_DATA } from '../data/questData';
import { UnlockState } from '../types';
import {
  claimRollDrawBase,
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
      { kind: 'skill', label: 'Crafting 36' },
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

  it('reserves distinct seeded draw slots until history advances', () => {
    const first = claimRollDrawBase({ context: '', rolls: 0 }, 'tip-a');
    const second = claimRollDrawBase(first.cursor, 'tip-a');
    const advanced = claimRollDrawBase(second.cursor, 'tip-b');

    expect(first.baseIndex).toBe(0);
    expect(second.baseIndex).toBe(3);
    expect(advanced.baseIndex).toBe(0);
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
});
