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
  it('shows why an Ankou in the owned Forgotten Cemetery is not doable yet, and the Slayer Cave', () => {
    const markup = renderToStaticMarkup(<DiaryLog searchTerm="Ankou" suspendModals />);
    const row = markup.slice(markup.indexOf('data-diary-task-row="wilderness_med_6"'));
    const label = 'Forgotten Cemetery or Wilderness Slayer Cave entrance';
    const chip = row.slice(row.lastIndexOf('<span', row.indexOf(label)), row.indexOf('</span>', row.indexOf(label)));

    expect(chip).toContain('border-red-500/30');
    expect(chip).toContain('Forgotten Cemetery, via Walk in from Chaos Altar (needs Chaos Altar)');
    expect(chip).toContain('Forgotten Cemetery, via Cemetery Teleport (Arceuus spell or tablet) (needs Arceuus Spellbook + Magic 71)');
    expect(chip).toContain('Wilderness Slayer Cave entrance, via Chaos Temple · Wilderness (50, 57) (needs Chaos Temple)');
    // Each way's places get their map buttons, the cave's entrances among them.
    expect(row).toContain('aria-label="Show Forgotten Cemetery on the map"');
    expect(row).toContain('aria-label="Show Wilderness Slayer Cave entrance at 50, 57 on the map"');
    expect(row).toContain('aria-label="Show Wilderness Slayer Cave entrance at 51, 58 on the map"');
  });

  it('shows a whole province as one map button, not one per chunk', () => {
    const markup = renderToStaticMarkup(<DiaryLog searchTerm="team cape" suspendModals />);
    const row = markup.slice(markup.indexOf('data-diary-task-row="wild_easy_8"'));
    const end = row.indexOf('data-diary-task-row=', 10);
    const own = end > 0 ? row.slice(0, end) : row;
    expect(own).toContain('aria-label="Show Anywhere in the Wilderness on the map"');
    expect(own).toMatch(/Anywhere in the Wilderness \(\d+ chunks\)/);
    expect(own).not.toContain('aria-label="Show Anywhere in the Wilderness at');
  });
});
