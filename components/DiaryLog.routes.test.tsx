import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { DiaryLog } from './DiaryLog';

// Owns the Ruins of Uzer and the Hunter level, but nothing joins Uzer to the run.
vi.mock('../context/GameContext', () => ({
  useGame: () => ({
    unlocks: {
      equipment: {}, skills: { Hunter: 10 }, levels: { Hunter: 99 }, regions: ['Ruins of Uzer'], mobility: [], arcana: [],
      housing: [], merchants: [], minigames: [], bosses: [], storage: [], guilds: [],
      farming: [], slayerUnlocks: [], quests: [], diaries: [], cas: [],
      completedTasks: [], collectionLog: {},
    },
    completeDiaryTask: vi.fn(),
    completeDiaryTier: vi.fn(),
    advisorsEnabled: false,
    gameModeId: 'vanilla',
  }),
}));
vi.mock('../hooks/useAreaRoutes', () => ({
  useAreaRoutes: () => ({ strandedAreas: new Set(['Ruins of Uzer']), strandedChunks: new Set() }),
}));

vi.mock('../hooks/useLocalStorage', () => ({
  useLocalStorage: (_key: string, initial: unknown) => [initial, vi.fn()],
}));
vi.mock('./JournalFilterBar', () => ({ JournalFilterBar: () => null }));
vi.mock('./DiaryHeatmap', () => ({ DiaryHeatmap: () => null }));
vi.mock('./JournalInsights', () => ({ DiaryInsights: () => null }));
vi.mock('./SkillTrainingPopover', () => ({ SkillTrainingPopover: () => null }));

describe('DiaryLog in an owned area no route reaches', () => {
  it('shows the Golden Warbler as out of reach, and why', () => {
    const markup = renderToStaticMarkup(<DiaryLog searchTerm="Golden Warbler" suspendModals />);
    const row = markup.slice(markup.indexOf('data-diary-task-row="des_easy_1"'));
    const at = row.indexOf('No route to Ruins of Uzer');
    const chip = row.slice(row.lastIndexOf('<span', at), row.indexOf('</span>', at));

    expect(at).toBeGreaterThan(0);
    expect(chip).toContain('border-red-500/30');
    expect(chip).toContain('every way there crosses locked land');
  });
});
