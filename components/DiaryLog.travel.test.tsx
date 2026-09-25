import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { DiaryLog } from './DiaryLog';

// Owns the Forgotten Cemetery, but nothing that reaches it.
vi.mock('../context/GameContext', () => ({
  useGame: () => ({
    unlocks: {
      equipment: {}, skills: {}, levels: {}, regions: ['Forgotten Cemetery'], mobility: [], arcana: [],
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

vi.mock('../hooks/useLocalStorage', () => ({
  useLocalStorage: (_key: string, initial: unknown) => [initial, vi.fn()],
}));
vi.mock('./JournalFilterBar', () => ({ JournalFilterBar: () => null }));
vi.mock('./DiaryHeatmap', () => ({ DiaryHeatmap: () => null }));
vi.mock('./JournalInsights', () => ({ DiaryInsights: () => null }));
vi.mock('./SkillTrainingPopover', () => ({ SkillTrainingPopover: () => null }));

describe('DiaryLog travel to an owned island or enclave', () => {
  it('shows why an Ankou in the owned Forgotten Cemetery is not doable yet', () => {
    const markup = renderToStaticMarkup(<DiaryLog searchTerm="Ankou" suspendModals />);
    const row = markup.slice(markup.indexOf('data-diary-task-row="wilderness_med_6"'));
    const chip = row.slice(row.lastIndexOf('<span', row.indexOf('Travel to Forgotten Cemetery')), row.indexOf('</span>', row.indexOf('Travel to Forgotten Cemetery')));

    expect(chip).toContain('border-red-500/30');
    expect(chip).toContain('Walk in from Chaos Altar (needs Chaos Altar)');
    expect(chip).toContain('Cemetery Teleport (Arceuus spell or tablet) (needs Arceuus Spellbook + Magic 71)');
  });
});
