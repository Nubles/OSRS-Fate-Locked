import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QUEST_DATA } from '../data/questData';
import type { UnlockState } from '../types';
import { enforcedQuestAreas } from '../utils/questGeographyDisplay';
import { QuestLog } from './QuestLog';

const view = vi.hoisted(() => ({ region: 'ALL' }));
const account = (): UnlockState => ({
  equipment: {}, skills: {}, levels: {},
  regions: [], mobility: [], arcana: [], housing: [], merchants: [], minigames: [],
  bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [],
  quests: [], diaries: [], cas: [], completedTasks: [], collectionLog: {},
});
vi.mock('../context/GameContext', () => ({
  useGame: () => ({ unlocks: account(), completeQuest: vi.fn(), advisorsEnabled: false, gameModeId: 'vanilla' }),
}));
vi.mock('../hooks/useLocalStorage', () => ({
  useLocalStorage: (key: string, initial: unknown) => [key === 'jrnl:quest:region' ? view.region : initial, vi.fn()],
}));
vi.mock('./JournalFilterBar', () => ({
  JournalFilterBar: ({ regions }: { regions?: string[] }) => <div data-region-options={(regions ?? []).join('|')} />,
}));
vi.mock('./JournalInsights', () => ({ QuestInsights: () => null }));
vi.mock('./QuestAdvisorPanel', () => ({ QuestAdvisorPanel: () => null }));
vi.mock('./SkillTrainingPopover', () => ({ SkillTrainingPopover: () => null }));

const decode = (text: string): string => text.replace(/&#x27;/g, "'").replace(/&amp;/g, '&');
const listedIds = (html: string): string[] =>
  [...html.matchAll(/data-journal-id="([^"]+)"/g)].map(match => decode(match[1]));

beforeEach(() => { view.region = 'ALL'; });

describe('quest journal region filter', () => {
  it('lists exactly the quests the selected area gates', () => {
    view.region = 'Varrock';
    const listed = listedIds(renderToStaticMarkup(<QuestLog />)).sort();
    const gated = Object.values(QUEST_DATA)
      .filter(quest => enforcedQuestAreas(quest).includes('Varrock'))
      .map(quest => quest.id)
      .sort();

    expect(gated).toContain('Demon Slayer');
    expect(listed).toEqual(gated);
  });

  it('offers the areas the quests are gated by', () => {
    const html = renderToStaticMarkup(<QuestLog />);
    const options = decode(/data-region-options="([^"]*)"/.exec(html)![1]).split('|');
    const expected = [...new Set(Object.values(QUEST_DATA).flatMap(quest => enforcedQuestAreas(quest)))].sort();

    expect(options).toEqual(expected);
  });

  it('shows every quest when a remembered area is no longer offered', () => {
    view.region = 'Asgarnia (retired label)';
    expect(listedIds(renderToStaticMarkup(<QuestLog />))).toHaveLength(Object.keys(QUEST_DATA).length);
  });
});
