import { describe, expect, it } from 'vitest';
import { QUEST_DATA, QuestData } from '../data/questData';
import { DropSource, UnlockState } from '../types';
import { combatLevel } from './slayerReach';
import {
  countDoableDiaryTasks, countDoableTasks, countMetSkillRequirements,
  evaluateQuestEligibility, getQuestStatus, meetsSkillRequirement,
} from './journalStatus';

const unlocked = (over: Partial<UnlockState> = {}): UnlockState => ({
  equipment: {}, skills: { Slayer: 10 }, levels: { Slayer: 99 },
  regions: [], mobility: [], arcana: [], housing: [], merchants: [],
  minigames: [], bosses: [], storage: [], guilds: [], farming: [],
  slayerUnlocks: [], quests: [], diaries: [], cas: [],
  completedTasks: [], collectionLog: {}, ...over,
});

describe('reported quest access', () => {
  it('requires the exact South Falador Farm chunk in Chunked mode', () => {
    const q = QUEST_DATA['A Porcine of Interest'];
    const near = unlocked({ chunks: ['46,51', '48,50'] });
    const exact = unlocked({ chunks: ['47,51', '48,50'] });
    expect(evaluateQuestEligibility(q, near, 'chunked').status).toBe('LOCKED_REGION');
    expect(evaluateQuestEligibility(q, exact, 'chunked').status).toBe('AVAILABLE');
  });

  it('calculates Dream Mentor combat instead of reading a pseudo-skill', () => {
    const q = QUEST_DATA['Dream Mentor'];
    const base = {
      regions: ['Fremennik'], quests: ['Lunar Diplomacy', "Eadgar's Ruse"],
      skills: { Attack: 10, Strength: 10, Defence: 10, Hitpoints: 10, Prayer: 10, Ranged: 10, Magic: 10 },
    };
    const lowLevels = { Attack: 60, Strength: 60, Defence: 60, Hitpoints: 60, Prayer: 60, Ranged: 60, Magic: 60 };
    const highLevels = { Attack: 70, Strength: 70, Defence: 70, Hitpoints: 70, Prayer: 70, Ranged: 70, Magic: 70 };
    const low = unlocked({ ...base, levels: lowLevels });
    const high = unlocked({ ...base, levels: highLevels });

    expect(combatLevel(lowLevels)).toBeLessThan(85);
    expect(evaluateQuestEligibility(q, low).blockers).toContainEqual({
      kind: 'combat', label: 'Combat level 85',
    });
    expect(combatLevel(highLevels)).toBeGreaterThanOrEqual(85);
    expect(evaluateQuestEligibility(q, high).blockers).not.toContainEqual({
      kind: 'combat', label: 'Combat level 85',
    });
    expect(evaluateQuestEligibility(q, high).status).toBe('AVAILABLE');
  });

  it.each([
    ['East Ardougne', { regions: ['East Ardougne'] }],
    ['Tree Gnome Stronghold', { regions: ['Tree Gnome Stronghold'] }],
    ["Wizards' Guild", { guilds: ["Wizards' Guild"] }],
  ])('allows Enter the Abyss through %s', (_name, route) => {
    expect(getQuestStatus(QUEST_DATA['Enter the Abyss'], unlocked({
      quests: ['Rune Mysteries'], ...route,
    }))).toBe('AVAILABLE');
  });

  it('locks Enter the Abyss without a third provider', () => {
    expect(getQuestStatus(QUEST_DATA['Enter the Abyss'],
      unlocked({ quests: ['Rune Mysteries'] }))).toBe('LOCKED_REGION');
  });

  it('checks and labels location-based alternative routes', () => {
    const quest: QuestData = {
      ...QUEST_DATA['A Porcine of Interest'],
      id: 'alternative-location', name: 'Alternative location',
      regions: [], locations: [], skills: {}, prereqs: [],
      oneOf: [{ locations: [{
        id: 'test-crossing', label: 'Test crossing',
        standardAreas: ['Falador'], chunkOptions: [{ cx: 47, cy: 51 }],
      }] }],
    };
    expect(evaluateQuestEligibility(
      quest, unlocked({ chunks: ['46,51'] }), 'chunked',
    ).blockers).toContainEqual({ kind: 'region', label: 'Test crossing' });
    expect(evaluateQuestEligibility(
      quest, unlocked({ chunks: ['47,51'] }), 'chunked',
    ).status).toBe('AVAILABLE');
  });

  it('treats an empty alternative list as no alternative requirement', () => {
    const quest = {
      ...QUEST_DATA['A Porcine of Interest'],
      regions: ['Misthalin'],
      locations: [],
      oneOf: [],
    };
    expect(getQuestStatus(quest, unlocked())).toBe('AVAILABLE');
  });
});

describe('skill-method caps', () => {
  const quest: QuestData = {
    id: 'cap', name: 'cap', regions: ['Misthalin'],
    skills: { Woodcutting: 15 }, prereqs: [], points: 0,
    difficulty: DropSource.QUEST_NOVICE,
  };

  it('requires level and method cap', () => {
    const tier1 = unlocked({
      skills: { Woodcutting: 1 }, levels: { Woodcutting: 15 },
    });
    const tier2LowLevel = unlocked({
      skills: { Woodcutting: 2 }, levels: { Woodcutting: 14 },
    });
    const tier2 = unlocked({
      skills: { Woodcutting: 2 }, levels: { Woodcutting: 15 },
    });
    expect(meetsSkillRequirement(tier1, 'Woodcutting', 15)).toBe(false);
    expect(getQuestStatus(quest, tier1)).toBe('LOCKED_SKILL');
    expect(meetsSkillRequirement(tier2LowLevel, 'Woodcutting', 15)).toBe(false);
    expect(getQuestStatus(quest, tier2LowLevel)).toBe('LOCKED_SKILL');
    expect(meetsSkillRequirement(tier2, 'Woodcutting', 15)).toBe(true);
    expect(getQuestStatus(quest, tier2)).toBe('AVAILABLE');
  });

  it('applies the same cap to diary tasks', () => {
    const tasks = [{ id: 'wc15', skills: { Woodcutting: 15 } }];
    expect(countDoableTasks(tasks, unlocked({
      skills: { Woodcutting: 1 }, levels: { Woodcutting: 15 },
    }))).toBe(0);
    expect(countDoableTasks(tasks, unlocked({
      skills: { Woodcutting: 2 }, levels: { Woodcutting: 15 },
    }))).toBe(1);
  });

  it('applies method caps to diary consumer counts', () => {
    const tasks = [{
      id: 'wc15', tierId: 'Test Diary',
      skills: { Woodcutting: 15 },
    }];
    const tier1 = unlocked({
      skills: { Woodcutting: 1 }, levels: { Woodcutting: 15 },
    });
    const tier2 = unlocked({
      skills: { Woodcutting: 2 }, levels: { Woodcutting: 15 },
    });

    expect(countDoableDiaryTasks(tasks, tier1)).toBe(0);
    expect(countMetSkillRequirements(tasks[0].skills, tier1)).toBe(0);
    expect(countDoableDiaryTasks(tasks, tier2)).toBe(1);
    expect(countMetSkillRequirements(tasks[0].skills, tier2)).toBe(1);
  });

  it('excludes completed diary tasks and completed diary tiers', () => {
    const tasks = [{
      id: 'wc15', tierId: 'Test Diary',
      skills: { Woodcutting: 15 },
    }];
    const eligible = {
      skills: { Woodcutting: 2 }, levels: { Woodcutting: 15 },
    };

    expect(countDoableDiaryTasks(tasks, unlocked({
      ...eligible, completedTasks: ['wc15'],
    }))).toBe(0);
    expect(countDoableDiaryTasks(tasks, unlocked({
      ...eligible, diaries: ['Test Diary'],
    }))).toBe(0);
  });
});
