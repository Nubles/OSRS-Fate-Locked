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

describe('DiaryLog access evidence', () => {
  it('shows partial Barbarian Fishing access without a completion blocker', () => {
    const markup = renderToStaticMarkup(
      <DiaryLog searchTerm="shark" suspendModals />,
    );

    expect(markup).not.toContain('Barbarian Training');
    expect(markup.match(/Access to Barbarian Fishing/g)).toHaveLength(2);
    expect(markup).toContain('Fishing 96');
    expect(markup).toContain('Strength 76');
    expect(markup).toContain('In Aid of the Myreque');
  });
});
