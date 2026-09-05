// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ALL_DIARY_TASKS } from '../data/diaryTasks';
import { DiaryLog } from './DiaryLog';
import { questId } from '../data/questCatalog';

const state = vi.hoisted(() => ({
  unlocks: {
    equipment: {}, skills: {}, levels: { Slayer: 7 }, regions: ['Lumbridge'], mobility: [], arcana: [],
    housing: [], merchants: [], minigames: [], bosses: [], storage: [], guilds: [],
    farming: [], slayerUnlocks: [], quests: [] as string[], diaries: [], cas: [], completedTasks: [], collectionLog: {},
  },
  complete: vi.fn(),
}));
vi.mock('../context/GameContext', () => ({ useGame: () => ({ unlocks: state.unlocks, completeDiaryTask: state.complete, completeDiaryTier: vi.fn(), advisorsEnabled: false, gameModeId: 'vanilla' }) }));
vi.mock('../hooks/useLocalStorage', () => ({ useLocalStorage: (_key: string, initial: unknown) => [initial, vi.fn()] }));
vi.mock('./JournalFilterBar', () => ({ JournalFilterBar: () => null }));
vi.mock('./DiaryHeatmap', () => ({ DiaryHeatmap: () => null }));
vi.mock('./JournalInsights', () => ({ DiaryInsights: () => null }));
vi.mock('./SkillTrainingPopover', () => ({ SkillTrainingPopover: () => null }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); state.complete.mockClear(); state.unlocks.levels.Slayer = 7; state.unlocks.quests = []; });
const task = ALL_DIARY_TASKS.find(task => task.id === 'lum_easy_2')!;
const renderTask = () => {
  const view = render(<DiaryLog searchTerm="Slay a Cave bug" />);
  return within(view.container.querySelector('[data-diary-task-row="lum_easy_2"]') as HTMLElement);
};

describe('Diary task canonical readiness details', () => {
  it('styles quest prerequisites as completed when a save uses the canonical ID', () => {
    const quest = 'In Aid of the Myreque';
    state.unlocks.quests = [questId(quest)!];
    const view = render(<DiaryLog searchTerm="shark" />);
    const badges = [...view.container.querySelectorAll('span')].filter(span => span.textContent?.trim() === quest);
    expect(badges.length).toBeGreaterThan(0);
    expect(badges.every(badge => !badge.className.includes('text-red-400'))).toBe(true);
  });
  it('shows light-source and cave-entry checks and retains explicit completion attestation', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const row = renderTask();
    expect(row.getByText('Needs confirmation')).toBeTruthy();
    expect(row.getByText(/Confirm:.*usable light source/)).toBeTruthy();
    expect(row.getByText(/Confirm:.*rope available for the first descent/)).toBeTruthy();
    const complete = row.getByRole('button', { name: /^Complete diary task:/ });
    fireEvent.click(complete);
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('usable light source'));
    expect(state.complete).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.click(complete);
    expect(state.complete).toHaveBeenCalledWith(task.id, expect.any(Number), expect.any(Number), { manualConfirmed: true });
  });
  it('shows a hard requirement separately from manual checks', () => {
    state.unlocks.levels.Slayer = 1;
    const row = renderTask();
    expect(row.getByText('Requirements not met')).toBeTruthy();
    expect(row.getByText('Required: Slayer 7')).toBeTruthy();
    expect(row.getByText(/Confirm:.*usable light source/)).toBeTruthy();
  });
  it('labels unreviewed predicates unknown instead of offering a confirmation as proof', () => {
    const original = task.predicates;
    task.predicates = [{ kind: 'unknown', key: 'unreviewed-cave-route', label: 'Unreviewed cave route' }];
    try {
      const row = renderTask();
      expect(row.getByText('Requirements unknown')).toBeTruthy();
      expect(row.getByText('Unknown: Unreviewed cave route')).toBeTruthy();
      expect(row.queryByText('Needs confirmation')).toBeNull();
    } finally { task.predicates = original; }
  });
});
