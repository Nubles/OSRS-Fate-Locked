import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createFreshState } from '../../context/GameContext';
import { QUEST_DATA } from '../../data/questData';
import { EQUIPMENT_SLOTS, GUILDS_LIST, MERCHANTS_LIST, MOBILITY_LIST, POH_LIST, SKILLS_LIST } from '../../data/items';
import { currentQuestPoints, evaluateQuestEligibility } from '../../utils/journalStatus';
import { questLines } from './OsrsJournalQuests';
import { QuestCard } from '../QuestLog';
import type { UnlockState } from '../../types';

// Some quests need an area and a prerequisite quest with the same name. The
// journal must decide the quest line from completed quests and the area line
// from owned areas, not from one list of met names that holds both.
const all = Object.values(QUEST_DATA);
const allRegions = [...new Set(all.flatMap(quest => [
  ...quest.regions,
  ...(quest.locations ?? []).flatMap(location => location.standardAreas),
  ...(quest.oneOf ?? []).flatMap(option => [
    ...(option.regions ?? []),
    ...(option.anyOfRegions ?? []),
    ...(option.locations ?? []).flatMap(location => location.standardAreas),
  ]),
]))];
const state = (missingQuests: string[], missingRegions: string[] = []): UnlockState => ({
  ...createFreshState().unlocks,
  equipment: Object.fromEntries(EQUIPMENT_SLOTS.map(slot => [slot, 9])),
  skills: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 10])),
  levels: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 99])),
  regions: allRegions.filter(region => !missingRegions.includes(region)),
  merchants: [...MERCHANTS_LIST],
  guilds: [...GUILDS_LIST],
  mobility: [...MOBILITY_LIST],
  poh: [...POH_LIST],
  quests: all.map(quest => quest.id).filter(id => !missingQuests.includes(id)),
} as UnlockState);

const card = (id: string, unlocks: UnlockState) => {
  const eligibility = evaluateQuestEligibility(QUEST_DATA[id], unlocks, 'vanilla');
  return { ...QUEST_DATA[id], status: eligibility.status, eligibility } as any;
};
const osrsLines = (id: string, name: string, unlocks: UnlockState) => {
  const { game, fate } = questLines(card(id, unlocks), unlocks, currentQuestPoints(unlocks), () => {}, () => {});
  const pick = (lines: typeof game) => lines.filter(line => line.text === name).map(line => line.met);
  return { game: pick(game), fate: pick(fate) };
};
const classicCounter = (id: string, unlocks: UnlockState) => {
  const html = renderToStaticMarkup(React.createElement(QuestCard as any, {
    quest: card(id, unlocks), unlocks, gameModeId: 'vanilla', currentQP: currentQuestPoints(unlocks), onToggle: () => {},
  }));
  const match = html.replace(/<!-- -->/g, '').match(/(\d+)\/(\d+) reqs/);
  return match ? [Number(match[1]), Number(match[2])] : null;
};

// [quest, same-named prerequisite and area, the area's parent region]
const SAME_NAME: Array<[string, string, string]> = [
  ['One Small Favour', 'Shilo Village', 'Karamja'],
  ['While Guthix Sleeps', 'Fight Arena', 'Kandarin'],
  ['Lair of Tarn Razorlor', 'Haunted Mine', 'Morytania'],
];

describe('quest and area with the same name', () => {
  it.each(SAME_NAME)('%s: area owned, %s quest not done', (id, name) => {
    const unlocks = state([id, name]);
    expect(osrsLines(id, name, unlocks)).toEqual({ game: [false], fate: [true] });
  });

  it.each(SAME_NAME)('%s: %s quest done, area not owned', (id, name, parent) => {
    const unlocks = state([id], [name, parent]);
    expect(osrsLines(id, name, unlocks)).toEqual({ game: [true], fate: [false] });
  });

  it.each(SAME_NAME)('%s: both met in the OSRS layout once %s is done and owned', (id, name) => {
    const unlocks = state([id]);
    expect(osrsLines(id, name, unlocks)).toEqual({ game: [true], fate: [true] });
  });

  it.each(SAME_NAME)('classic card %s: area chip for %s stays unmet when only the quest is done', (id, name, parent) => {
    const chipClasses = (unlocks: UnlockState) => {
      const html = renderToStaticMarkup(React.createElement(QuestCard as any, {
        quest: card(id, unlocks), unlocks, gameModeId: 'vanilla', currentQP: currentQuestPoints(unlocks), onToggle: () => {},
      })).replace(/<!-- -->/g, '');
      const chip = new RegExp(`<span class="([^"]*)"><img[^>]*World_map_icon[^>]*/> ${name}</span>`, 'g');
      return [...html.matchAll(chip)].map(match => match[1]);
    };
    const areaMissing = chipClasses(state([id], [name, parent]));
    expect(areaMissing.length).toBeGreaterThan(0);
    for (const cls of areaMissing) {
      expect(cls).toContain('bg-red-900/10');
      expect(cls).not.toContain('bg-black/30');
    }
    const bothMet = chipClasses(state([id]));
    for (const cls of bothMet) expect(cls).toContain('bg-black/30');
  });

  it.each(SAME_NAME.filter(([id]) => id !== 'While Guthix Sleeps'))(
    'classic card %s counts one unmet requirement in either case (%s)', (id, name, parent) => {
      const questMissing = classicCounter(id, state([id, name]));
      const areaMissing = classicCounter(id, state([id], [name, parent]));
      expect(questMissing).not.toBeNull();
      const total = questMissing![1];
      expect(questMissing).toEqual([total - 1, total]);
      expect(areaMissing).toEqual([total - 1, total]);
    },
  );
});
