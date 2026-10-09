import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { DiaryLog } from './DiaryLog';

// A player reported on 9 October 2026 that Falador Easy said a task was
// available while every task looked locked. The strut repair is doable from
// the Dwarven Mine entrance in Falador, but the row painted the other way in,
// the Motherlode Mine area, as a red lock and never said the task was doable.
vi.mock('../context/GameContext', () => ({
  useGame: () => ({
    unlocks: {
      equipment: {}, skills: {}, levels: {}, regions: ['Falador'], mobility: [], arcana: [],
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
vi.mock('../hooks/useAreaRoutes', () => ({ useAreaRoutes: () => null }));
vi.mock('../hooks/useLocalStorage', () => ({
  useLocalStorage: (_key: string, initial: unknown) => [initial, vi.fn()],
}));
vi.mock('./JournalFilterBar', () => ({ JournalFilterBar: () => null }));
vi.mock('./DiaryHeatmap', () => ({ DiaryHeatmap: () => null }));
vi.mock('./JournalInsights', () => ({ DiaryInsights: () => null }));
vi.mock('./SkillTrainingPopover', () => ({ SkillTrainingPopover: () => null }));

const rowOf = (markup: string, id: string) => {
  const start = markup.indexOf(`data-diary-task-row="${id}"`);
  const next = markup.indexOf('data-diary-task-row=', start + 1);
  return markup.slice(start, next === -1 ? undefined : next);
};

describe('DiaryLog task rows', () => {
  const markup = renderToStaticMarkup(<DiaryLog searchTerm="Falador Easy" suspendModals />);

  it('marks the task the player can do now', () => {
    expect(rowOf(markup, 'fal_easy_9')).toContain('Can do now');
    expect(rowOf(markup, 'fal_easy_10')).not.toContain('Can do now');
  });

  it('does not draw the unused way in as a lock once another way is met', () => {
    const row = rowOf(markup, 'fal_easy_9');
    const at = row.indexOf('Show Motherlode Mine on the map');
    const chip = row.slice(row.lastIndexOf('<button', at), row.indexOf('</button>', at));
    expect(at).toBeGreaterThan(0);
    expect(chip).not.toContain('border-red-500/30');
  });
});
