import { describe, it, expect } from 'vitest';
import { questUnmet, diaryUnmet, isAlmostThere } from './journalProgress';
import type { QuestData } from '../data/questData';
import type { DiaryTier } from '../data/diaryData';
import type { UnlockState } from '../types';

const u = (o: Partial<UnlockState>): UnlockState =>
  ({ regions: [], quests: [], skills: {}, levels: {}, ...o } as UnlockState);

const quest = (over: Partial<QuestData>): QuestData =>
  ({ id: 'q', name: 'Q', regions: [], skills: {}, prereqs: [], points: 1 } as unknown as QuestData);

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
});

describe('diaryUnmet', () => {
  const diary = (over: Partial<DiaryTier>): DiaryTier =>
    ({ id: 'D', region: 'Misthalin', tier: 'Easy', skills: {}, quests: [], requiredRegions: [], difficulty: '' as any, ...over });
  it('dedupes regions and reports unmet ones', () => {
    const d = diary({ region: 'Kandarin', requiredRegions: ['Kandarin', 'Asgarnia'] });
    const unmet = diaryUnmet(d, u({ regions: ['Asgarnia'] }));
    expect(unmet).toEqual([{ kind: 'region', label: 'Kandarin' }]);
  });
});

describe('isAlmostThere', () => {
  it('is true only for exactly one blocker', () => {
    expect(isAlmostThere([])).toBe(false);
    expect(isAlmostThere([{ kind: 'skill', label: 'x' }])).toBe(true);
    expect(isAlmostThere([{ kind: 'skill', label: 'x' }, { kind: 'region', label: 'y' }])).toBe(false);
  });
});
