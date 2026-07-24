import { describe, it, expect } from 'vitest';
import { questUnmet, diaryUnmet, isAlmostThere } from './journalProgress';
import { QUEST_DATA, type QuestData } from '../data/questData';
import { DIARY_DATA, type DiaryTier } from '../data/diaryData';
import { ALL_DIARY_TASKS } from '../data/diaryTasks';
import type { UnlockState } from '../types';

const u = (o: Partial<UnlockState>): UnlockState =>
  ({ regions: [], quests: [], skills: {}, levels: {}, guilds: [], diaries: [],
    cas: [], completedTasks: [], ...o } as UnlockState);

const quest = (over: Partial<QuestData>): QuestData =>
  ({ id: 'q', name: 'Q', regions: [], skills: {}, prereqs: [], points: 1, ...over } as unknown as QuestData);

describe('questUnmet', () => {
  it('returns nothing when everything is met', () => {
    expect(questUnmet(quest({ regions: ['Misthalin'] }), u({}))).toEqual([]);
  });
  it('lists missing region, skill and prereq', () => {
    const q = { ...quest({}), regions: ['Kandarin'], skills: { Cooking: 30 }, prereqs: ['Cooks Assistant'] } as QuestData;
    const unmet = questUnmet(q, u({}));
    expect(unmet.map(x => x.kind).sort()).toEqual(['quest', 'region', 'skill']);
  });
  it('counts a skill met once tier + level are there', () => {
    const q = { ...quest({}), skills: { Cooking: 30 } } as QuestData;
    expect(questUnmet(q, u({ skills: { Cooking: 3 }, levels: { Cooking: 35 } }))).toEqual([]);
    expect(questUnmet(q, u({ skills: { Cooking: 3 }, levels: { Cooking: 20 } })).length).toBe(1);
  });
  it('reports method-cap and alternative-access blockers', () => {
    expect(questUnmet(quest({ skills: { Woodcutting: 15 } }), u({
      skills: { Woodcutting: 1 }, levels: { Woodcutting: 15 },
    }))).toEqual([{ kind: 'skill', label: 'Woodcutting 15' }]);

    expect(questUnmet(quest({ oneOf: [
      { regions: ['East Ardougne'] },
      { guilds: ["Wizards' Guild"] },
    ] }), u({}))).toEqual([{
      kind: 'region', label: "East Ardougne or Wizards' Guild",
    }]);
  });

  it('maps calculated combat blockers into the existing unmet shape', () => {
    expect(questUnmet(QUEST_DATA['Dream Mentor'], u({
      regions: ['Fremennik'],
      quests: ['Lunar Diplomacy', "Eadgar's Ruse"],
      levels: {
        Attack: 60, Strength: 60, Defence: 60, Hitpoints: 60,
        Prayer: 60, Ranged: 60, Magic: 60,
      },
    }))).toEqual([{ kind: 'skill', label: 'Combat level 85' }]);
  });
});

describe('diaryUnmet', () => {
  const diary = (over: Partial<DiaryTier>): DiaryTier =>
    ({ id: 'D', region: 'Misthalin', tier: 'Easy', skills: {}, quests: [], requiredRegions: [], difficulty: '' as any, ...over });
  it('ignores legacy aggregate requirements when no canonical tasks exist', () => {
    const d = diary({ region: 'Kandarin', requiredRegions: ['Kandarin', 'Asgarnia'] });
    expect(diaryUnmet(d, u({ regions: ['Asgarnia'] }))).toEqual([]);
  });
  it('derives blockers from canonical remaining tasks instead of the stale aggregate', () => {
    const taskSkills = ALL_DIARY_TASKS.flatMap(task => Object.keys(task.skills ?? {}));
    const unlocks = u({
      skills: Object.fromEntries(taskSkills.map(skill => [skill, 10])),
      levels: Object.fromEntries(taskSkills.map(skill => [skill, 99])),
      regions: [...new Set(ALL_DIARY_TASKS.flatMap(task => task.regions ?? []))],
      quests: Object.keys(QUEST_DATA).filter(quest => quest !== 'Biohazard'),
      cas: ['Easy', 'Medium', 'Hard', 'Elite', 'Master', 'Grandmaster'],
      completedTasks: ALL_DIARY_TASKS
        .filter(task => task.tierId !== 'Ardougne Easy' || task.id !== 'ard_easy_6')
        .map(task => task.id),
    });

    expect(diaryUnmet(DIARY_DATA['Ardougne Easy'], unlocks)).toEqual([
      { kind: 'quest', label: 'Biohazard' },
    ]);
    expect(diaryUnmet({
      ...DIARY_DATA['Ardougne Easy'],
      quests: ['Impossible aggregate quest'],
      requiredRegions: ['Impossible aggregate region'],
    }, unlocks)).toEqual([{ kind: 'quest', label: 'Biohazard' }]);
  });
});

describe('isAlmostThere', () => {
  it('is true only for exactly one blocker', () => {
    expect(isAlmostThere([])).toBe(false);
    expect(isAlmostThere([{ kind: 'skill', label: 'x' }])).toBe(true);
    expect(isAlmostThere([{ kind: 'skill', label: 'x' }, { kind: 'region', label: 'y' }])).toBe(false);
  });
});
