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
  ({
    operationalRequirements: [], id: 'q', name: 'Q', kind: 'quest', accessPolicy: 'regions',
    regions: [], skills: {}, prereqs: [], points: 1, ...over,
  } as unknown as QuestData);

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
  it('classifies a quest point shortfall as QP, not a prerequisite quest', () => {
    expect(questUnmet(QUEST_DATA['Black Knights\' Fortress'], u({}))).toContainEqual({
      kind: 'qp',
      label: '12 QP',
    });
  });
  it('keeps level and alternative-access blockers independent', () => {
    expect(questUnmet(quest({ skills: { Woodcutting: 15 } }), u({
      skills: { Woodcutting: 1 }, levels: { Woodcutting: 15 },
    }))).toEqual([]);

    expect(questUnmet(quest({ oneOf: [
      { regions: ['East Ardougne'] },
      { guilds: ["Wizards' Guild"] },
    ] }), u({}))).toEqual([{
      kind: 'region', label: "East Ardougne or Wizards' Guild",
    }]);
  });

  it('maps calculated combat blockers into the existing unmet shape', () => {
    expect(questUnmet(QUEST_DATA['Dream Mentor'], u({
      regions: ['Lunar Isle'],
      quests: ['Lunar Diplomacy', "Eadgar's Ruse"],
      levels: {
        Attack: 60, Strength: 60, Defence: 60, Hitpoints: 60,
        Prayer: 60, Ranged: 60, Magic: 60,
      },
    }))).toEqual(expect.arrayContaining([{ kind: 'skill', label: 'Combat level 85' }]));
  });

  it('keeps Prying Times behind its manual Sailing confirmation', () => {
    expect(questUnmet(QUEST_DATA['Prying Times'], u({
      regions: ['The Pandemonium', 'Port Sarim', 'Rimmington'],
      quests: ['Pandemonium', "The Knight's Sword"],
      skills: { Smithing: 3, Sailing: 2 },
      levels: { Smithing: 30, Sailing: 12 },
    }))).toEqual(expect.arrayContaining([{
      kind: 'manual',
      label: 'Confirm: One open Sailing task slot',
    }]));
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
      regions: [...new Set(ALL_DIARY_TASKS.flatMap(task => [
        ...(task.regions ?? []), ...(task.anyOfRegions ?? []),
      ]))],
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

  it('classifies the Champions Guild requirement as a QP shortfall', () => {
    const completedTasks = ALL_DIARY_TASKS
      .filter(task => task.tierId !== 'Varrock Medium' || task.id !== 'var_med_2')
      .map(task => task.id);

    expect(diaryUnmet(DIARY_DATA['Varrock Medium'], u({
      regions: ['Varrock'],
      guilds: ["Champions' Guild"],
      completedTasks,
    }))).toEqual([{ kind: 'qp', label: '32 QP' }]);
  });
  it('reports the remaining Varrock Kudos confirmation after machine gates pass', () => {
    const completedTasks = ALL_DIARY_TASKS
      .filter(task => task.tierId !== 'Varrock Hard' || task.id !== 'var_hard_2')
      .map(task => task.id);

    expect(diaryUnmet(DIARY_DATA['Varrock Hard'], u({
      regions: ['Varrock'],
      completedTasks,
    }))).toEqual([{
      kind: 'manual',
      label: 'Confirm: 153 Varrock Museum Kudos',
    }]);
  });
});

describe('isAlmostThere', () => {
  it('is true only for exactly one blocker', () => {
    expect(isAlmostThere([])).toBe(false);
    expect(isAlmostThere([{ kind: 'skill', label: 'x' }])).toBe(true);
    expect(isAlmostThere([{ kind: 'skill', label: 'x' }, { kind: 'region', label: 'y' }])).toBe(false);
  });
});
