import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QUEST_DATA } from '../data/questData';
import type { UnlockState } from '../types';
import { evaluateQuestEligibility } from '../utils/journalStatus';
import { QuestCard, QuestLog } from './QuestLog';

const view = vi.hoisted(() => ({ filter: 'ALL', crafting: 0, completed: false }));
const account = (): UnlockState => ({
  equipment: {}, skills: { Crafting: view.crafting }, levels: { Crafting: 1 },
  regions: [], mobility: [], arcana: [], housing: [], merchants: [], minigames: [],
  bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [],
  quests: view.completed ? ['Sheep Shearer'] : [], diaries: [], cas: [],
  completedTasks: [], collectionLog: {},
});
vi.mock('../context/GameContext', () => ({
  useGame: () => ({ unlocks: account(), completeQuest: vi.fn(), advisorsEnabled: false, gameModeId: 'vanilla' }),
}));
vi.mock('../hooks/useLocalStorage', () => ({
  useLocalStorage: (key: string, initial: unknown) => [key === 'jrnl:quest:filter' ? view.filter : initial, vi.fn()],
}));
vi.mock('./JournalFilterBar', () => ({
  JournalFilterBar: ({ statusCounts }: { statusCounts: Record<string, number> }) =>
    <div data-available-count={statusCounts.AVAILABLE} data-locked-count={statusCounts.LOCKED} />,
}));
vi.mock('./JournalInsights', () => ({ QuestInsights: () => null }));
vi.mock('./QuestAdvisorPanel', () => ({ QuestAdvisorPanel: () => null }));
vi.mock('./SkillTrainingPopover', () => ({ SkillTrainingPopover: () => null }));

const renderCard = () => {
  const quest = QUEST_DATA['Sheep Shearer'];
  const unlocks = account();
  const eligibility = evaluateQuestEligibility(quest, unlocks, 'vanilla');
  return renderToStaticMarkup(<QuestCard quest={{ ...quest, status: eligibility.status, eligibility }}
    unlocks={unlocks} gameModeId="vanilla" currentQP={0} onToggle={vi.fn()} />);
};
beforeEach(() => { view.filter = 'ALL'; view.crafting = 0; view.completed = false; });

describe('quest journal preparation readiness in Vanilla', () => {
  it('shows the canonical wool check instead of ready copy and counts the missing check', () => {
    const html = renderCard();
    expect(html).not.toContain('Ready to complete!');
    expect(html).toContain('20 unnoted balls of wool');
    expect(html).toContain('Needs confirmation');
    expect(html).toContain('1/2 reqs');
    expect(html).toContain('title="Confirm &amp; Complete"');
    expect(html).not.toContain('disabled=""');
  });

  it('excludes unchecked preparation from Available and includes it in Locked', () => {
    view.filter = 'AVAILABLE';
    const available = renderToStaticMarkup(<QuestLog searchTerm="Sheep Shearer" />);
    expect(available).not.toContain('data-journal-id="Sheep Shearer"');
    const expected = Object.values(QUEST_DATA).filter(q => {
      const e = evaluateQuestEligibility(q, account(), 'vanilla');
      return e.status !== 'COMPLETED' && e.eligible;
    }).length;
    expect(available).toContain(`data-available-count="${expected}"`);
    view.filter = 'LOCKED';
    expect(renderToStaticMarkup(<QuestLog searchTerm="Sheep Shearer" />))
      .toContain('data-journal-id="Sheep Shearer"');
  });

  it('shows ready only after Crafting unlocks and preserves completed quests', () => {
    view.crafting = 1;
    expect(renderCard()).toContain('Ready to complete!');
    expect(renderCard()).not.toContain('Needs confirmation');
    view.crafting = 0;
    view.completed = true;
    expect(renderCard()).not.toContain('Needs confirmation');
    expect(renderCard()).not.toContain('reqs');
  });
});


describe('quest journal skill alternatives in Vanilla', () => {
  const desertTreasure = (plagueCity: boolean, slayerTier = 0) => {
    const quest = QUEST_DATA['Desert Treasure I'];
    const unlocks: UnlockState = {
      ...account(),
      skills: { Thieving: 6, Firemaking: 5, Magic: 5, Slayer: slayerTier },
      levels: { Thieving: 53, Firemaking: 50, Magic: 50, Slayer: 10 },
      regions: [...quest.regions],
      quests: [...quest.prereqs, ...(plagueCity ? ['Plague City'] : [])],
    };
    const eligibility = evaluateQuestEligibility(quest, unlocks, 'vanilla');
    return renderToStaticMarkup(<QuestCard quest={{ ...quest, status: eligibility.status, eligibility }}
      unlocks={unlocks} gameModeId="vanilla" currentQP={0} onToggle={vi.fn()} />);
  };

  it('shows both routes when Slayer and the gas-mask route are locked', () => {
    const html = desertTreasure(false);
    expect(html).toContain('Slayer 10 or Plague City');
    expect(html).not.toContain('Ready to complete!');
  });

  it('counts the gas-mask confirmation once instead of also demanding Slayer training', () => {
    const html = desertTreasure(true);
    expect(html).toContain('Have a gas mask from Plague City');
    expect(html).toContain('17/18 reqs');
    expect(html).not.toContain('Training guide: Slayer');
    expect(html).not.toContain('Ready to complete!');
  });

  it('keeps the automatic Slayer route ready without a gas-mask confirmation', () => {
    const html = desertTreasure(false, 1);
    expect(html).toContain('Ready to complete!');
    expect(html).not.toContain('Needs confirmation');
  });
});
