import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { DiaryLog } from './DiaryLog';

vi.mock('../context/GameContext', () => ({
  useGame: () => ({
    unlocks: {
      equipment: {}, skills: {}, levels: {}, regions: [], mobility: [], arcana: [],
      housing: [], merchants: [], minigames: [], bosses: [], storage: [], guilds: [],
      farming: [], slayerUnlocks: [], quests: [], diaries: [], cas: [],
      completedTasks: [], collectionLog: {},
    },
    completeDiaryTask: vi.fn(),
    completeDiaryTier: vi.fn(),
    advisorsEnabled: false,
    gameModeId: 'standard',
  }),
}));

vi.mock('../hooks/useLocalStorage', () => ({
  useLocalStorage: (_key: string, initial: unknown) => [initial, vi.fn()],
}));
vi.mock('./JournalFilterBar', () => ({ JournalFilterBar: () => null }));
vi.mock('./DiaryHeatmap', () => ({ DiaryHeatmap: () => null }));
vi.mock('./JournalInsights', () => ({ DiaryInsights: () => null }));
vi.mock('./SkillTrainingPopover', () => ({ SkillTrainingPopover: () => null }));


// ui-osrs-b.d1[1] and own.d1[10]: the diary search ignores apostrophes and
// stray spaces, as the Quest Log and Collection Log searches do.
const rowIds = (searchTerm: string) =>
  [...renderToStaticMarkup(<DiaryLog searchTerm={searchTerm} suspendModals />).matchAll(/data-diary-task-row="([^"]+)"/g)].map(m => m[1]);

describe('DiaryLog search', () => {
  it('finds a task typed without its apostrophe', () => {
    expect(rowIds('necromancers tower')).toEqual(['ard_med_12']);
    expect(rowIds("necromancer's tower")).toEqual(['ard_med_12']);
  });

  it('ignores a trailing or leading space', () => {
    const plain = rowIds('Falador Easy');
    expect(plain.length).toBeGreaterThan(0);
    expect(rowIds('Falador Easy ')).toEqual(plain);
    expect(rowIds(' falador easy')).toEqual(plain);
    expect(rowIds('necromancers tower ')).toEqual(['ard_med_12']);
  });

  it('a lone space filters nothing out', () => {
    expect(rowIds(' ').length).toBe(rowIds('').length);
  });
});
