import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ALL_DIARY_TASKS } from '../data/diaryTasks';
import { DIARY_DATA } from '../data/diaryData';
import { DiaryLog } from './DiaryLog';

const state = vi.hoisted(() => ({ unlocks: {} as any, filter: 'ALL', counts: {} as any }));
vi.mock('../context/GameContext', () => ({ useGame: () => ({
  unlocks: state.unlocks, completeDiaryTask: vi.fn(), completeDiaryTier: vi.fn(),
  advisorsEnabled: false, gameModeId: 'vanilla',
}) }));
vi.mock('../hooks/useLocalStorage', () => ({ useLocalStorage: (key: string, initial: unknown) => [key === 'jrnl:diary:status' ? state.filter : initial, vi.fn()] }));
vi.mock('./JournalFilterBar', () => ({ JournalFilterBar: (props: any) => { state.counts = props.statusCounts; return null; } }));
vi.mock('./DiaryHeatmap', () => ({ DiaryHeatmap: () => null }));
vi.mock('./JournalInsights', () => ({ DiaryInsights: () => null }));
vi.mock('./SkillTrainingPopover', () => ({ SkillTrainingPopover: () => null }));

beforeEach(() => {
  state.filter = 'ALL';
  state.unlocks = {
    equipment: {}, skills: {}, levels: {}, regions: ['Ferox Enclave'], mobility: [], arcana: [],
    housing: [], merchants: [], minigames: [], bosses: [], storage: [], guilds: [],
    farming: [], slayerUnlocks: [], quests: [], cas: [], collectionLog: {},
    diaries: Object.keys(DIARY_DATA).filter(id => id !== 'Wilderness Easy'),
    completedTasks: ALL_DIARY_TASKS.filter(task => task.id !== 'wild_easy_8').map(task => task.id),
  };
});

describe('Vanilla diary permission display', () => {
  it('shows the missing Cape slot directly beside the team-cape task', () => {
    const markup = renderToStaticMarkup(<DiaryLog searchTerm="Equip any team cape" suspendModals />);
    expect(markup).toContain('Cape T1: Team cape');
    expect(state.counts.AVAILABLE).toBe(0);
  });

  it('keeps item confirmation out of the Available count and filter', () => {
    state.unlocks.equipment.Cape = 1;
    const markup = renderToStaticMarkup(<DiaryLog searchTerm="Equip any team cape" suspendModals />);
    expect(markup).toContain('Needs confirmation');
    expect(markup).toContain('specific item is permitted');
    expect(state.counts.AVAILABLE).toBe(0);
    expect(state.counts.LOCKED).toBe(1);
    state.filter = 'AVAILABLE';
    expect(renderToStaticMarkup(<DiaryLog searchTerm="Equip any team cape" suspendModals />))
      .not.toContain('data-diary-task-row="wild_easy_8"');
  });

  it('shows the Fairy Rings permission separately from the completed quest', () => {
    state.unlocks.regions = ['East Ardougne'];
    state.unlocks.quests = ['Fairytale II - Cure a Queen'];
    state.unlocks.diaries = Object.keys(DIARY_DATA).filter(id => id !== 'Ardougne Medium' && id !== 'Lumbridge Elite');
    state.unlocks.completedTasks = ALL_DIARY_TASKS.filter(task => task.id !== 'ard_med_1').map(task => task.id);
    const markup = renderToStaticMarkup(<DiaryLog searchTerm="Unicorn pen" suspendModals />);
    expect(markup).toContain('Fairy Rings');
    expect(markup).toContain('Weapon T1: Dramen or lunar staff');
    expect(state.counts.LOCKED).toBe(1);
  });

  it('shows missing God Spells even after the Magic, staff and Mage Arena requirements are met', () => {
    state.unlocks.equipment.Weapon = 6;
    state.unlocks.skills.Magic = 10;
    state.unlocks.levels.Magic = 99;
    state.unlocks.regions = ['Mage Arena'];
    state.unlocks.quests = ['Mage Arena I'];
    state.unlocks.diaries = Object.keys(DIARY_DATA).filter(id => id !== 'Wilderness Hard');
    state.unlocks.completedTasks = ALL_DIARY_TASKS.filter(task => task.id !== 'wild_hard_1').map(task => task.id);
    const markup = renderToStaticMarkup(<DiaryLog searchTerm="3 God spells" suspendModals />);
    expect(markup).toContain('God Spells');
    expect(state.counts.AVAILABLE).toBe(0);
    expect(state.counts.LOCKED).toBe(1);
  });
});
