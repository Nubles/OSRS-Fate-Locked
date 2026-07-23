import { describe, expect, it } from 'vitest';
import { QUEST_DATA, QuestData } from '../data/questData';
import { DropSource, UnlockState } from '../types';
import {
  countDoableTasks, getQuestStatus, meetsSkillRequirement,
} from './journalStatus';

const unlocked = (over: Partial<UnlockState> = {}): UnlockState => ({
  equipment: {}, skills: { Slayer: 10 }, levels: { Slayer: 99 },
  regions: [], mobility: [], arcana: [], housing: [], merchants: [],
  minigames: [], bosses: [], storage: [], guilds: [], farming: [],
  slayerUnlocks: [], quests: [], diaries: [], cas: [],
  completedTasks: [], collectionLog: {}, ...over,
});

describe('reported quest access', () => {
  it('requires Port Sarim for A Porcine of Interest', () => {
    const quest = QUEST_DATA['A Porcine of Interest'];
    expect(quest.regions).toEqual(['Misthalin', 'Port Sarim']);
    expect(getQuestStatus(quest, unlocked())).toBe('LOCKED_REGION');
    expect(getQuestStatus(quest,
      unlocked({ regions: ['Port Sarim'] }))).toBe('AVAILABLE');
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

  it('treats an empty alternative list as no alternative requirement', () => {
    const quest = {
      ...QUEST_DATA['A Porcine of Interest'],
      regions: ['Misthalin'],
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
});
