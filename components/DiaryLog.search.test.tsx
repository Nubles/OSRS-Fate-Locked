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


// ui-osrs-b.d1[1]: the diary search ignores apostrophes, as the Quest Log and Collection Log searches do.
const rowIds = (searchTerm: string) =>
  [...renderToStaticMarkup(<DiaryLog searchTerm={searchTerm} suspendModals />).matchAll(/data-diary-task-row="([^"]+)"/g)].map(m => m[1]);

describe('DiaryLog search', () => {
  it('finds a task typed without its apostrophe', () => {
    expect(rowIds('necromancers tower')).toEqual(['ard_med_12']);
    expect(rowIds("necromancer's tower")).toEqual(['ard_med_12']);
  });
});
