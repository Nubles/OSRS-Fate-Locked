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

const elementMarkup = (markup: string, openingTagPrefix: string) => {
  const start = markup.indexOf(openingTagPrefix);
  if (start === -1) {
    throw new Error(`Could not find element starting with ${openingTagPrefix}`);
  }

  const openingEnd = markup.indexOf('>', start);
  const openingTag = markup.slice(start, openingEnd + 1);
  const tagName = /^<([a-z0-9-]+)/i.exec(openingTag)?.[1];
  if (!tagName) {
    throw new Error(`Could not read an element name from ${openingTag}`);
  }

  const tagPattern = new RegExp(`<\\/?${tagName}\\b[^>]*>`, 'gi');
  tagPattern.lastIndex = start;
  let depth = 0;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(markup))) {
    if (match[0].startsWith('</')) {
      depth -= 1;
      if (depth === 0) return markup.slice(start, tagPattern.lastIndex);
    } else if (!match[0].endsWith('/>')) {
      depth += 1;
    }
  }

  throw new Error(`Could not find the closing ${tagName} for ${openingTagPrefix}`);
};

const openingTagWith = (markup: string, attribute: string) => {
  const start = markup.indexOf(attribute);
  if (start === -1) {
    throw new Error(`Could not find ${attribute}`);
  }
  const openingStart = markup.lastIndexOf('<', start);
  const openingEnd = markup.indexOf('>', start);
  return markup.slice(openingStart, openingEnd);
};

const innerMarkup = (element: string, tagName: string) => {
  const openingEnd = element.indexOf('>');
  const closingTag = `</${tagName}>`;
  const closingStart = element.lastIndexOf(closingTag);
  if (openingEnd === -1 || closingStart === -1) {
    throw new Error(`Could not extract the inner ${tagName} markup`);
  }
  return element.slice(openingEnd + 1, closingStart);
};

describe('DiaryLog access evidence', () => {
  it('shows partial Barbarian Fishing access without a completion blocker', () => {
    const markup = renderToStaticMarkup(
      <DiaryLog searchTerm="shark" suspendModals />,
    );

    expect(markup).not.toContain('Barbarian Training');
    expect(markup).toContain('Access to Barbarian Fishing');
    expect(markup).not.toContain('Requires: Barbarian Training');
    expect(markup).toContain('Fishing 96');
    expect(markup).toContain('Strength 76');
    expect(markup).toContain('In Aid of the Myreque');
  });

  it('keeps the real Steal a cake completion, Wiki, and training controls as siblings', () => {
    const description = 'Steal a cake from the Ardougne market stalls.';
    const markup = renderToStaticMarkup(
      <DiaryLog searchTerm="Steal a cake" suspendModals />,
    );
    const row = elementMarkup(markup, '<div data-diary-task-row="ard_easy_2"');
    const completion = elementMarkup(
      row,
      `<button aria-label="Complete diary task: ${description}"`,
    );
    const completionChildren = innerMarkup(completion, 'button');
    const wikiOpeningTag = openingTagWith(
      row,
      `aria-label="Open Wiki for diary task: ${description}"`,
    );
    const skillOpeningTag = openingTagWith(row, 'title="Training guide: Thieving"');

    expect(row.startsWith('<div ')).toBe(true);
    expect(completion.startsWith('<button ')).toBe(true);
    expect(wikiOpeningTag.startsWith('<a ')).toBe(true);
    expect(skillOpeningTag.startsWith('<button ')).toBe(true);
    expect(completionChildren).not.toMatch(/<(?:a|button)\b/);
    expect(completionChildren).not.toContain(wikiOpeningTag);
    expect(completionChildren).not.toContain(skillOpeningTag);
    expect(row).not.toMatch(/^<button\b/);
  });

  it('shows the canonical Quest Points requirement before Champions Guild completion', () => {
    const markup = renderToStaticMarkup(
      <DiaryLog searchTerm="Champions" suspendModals />,
    );
    const row = elementMarkup(markup, '<div data-diary-task-row="var_med_2"');
    const completion = elementMarkup(
      row,
      '<button aria-label="Complete diary task: Enter the Champions&#x27; Guild."',
    );

    expect(completion).toContain('Quest Points 32');
    expect(completion).toContain('border-red-500/30');
  });

  it('shows the Varrock Kudos confirmation before completion is attempted', () => {
    const markup = renderToStaticMarkup(
      <DiaryLog searchTerm="153 Kudos" suspendModals />,
    );
    const row = elementMarkup(markup, '<div data-diary-task-row="var_hard_2"');
    const completion = elementMarkup(
      row,
      '<button aria-label="Complete diary task: Speak to Orlando Smith when you have achieved 153 Kudos."',
    );

    expect(completion).toContain('Confirm: 153 Varrock Museum Kudos');
    expect(completion).toContain('border-cyan-500/30');
  });
  it.each([
    ['mind tiara', 'Ice Mountain'],
    ['Blue Dragon', "Heroes' Guild"],
    ['Ranging guild', 'Ranging Guild'],
    ['Adamant spear', "Otto's Grotto"],
    ['Rune Hasta', "Otto's Grotto"],
    ['Adamant scimitar', 'Resource Area'],
    ['Dark Crab', 'Resource Area'],
    ['rune scimitar from scratch', 'Resource Area'],
    ['magic logs in the Resource Area', 'Resource Area'],
  ])('keeps the %s map control on the authored %s alias chunk', (searchTerm, place) => {
    const markup = renderToStaticMarkup(
      <DiaryLog searchTerm={searchTerm} suspendModals />,
    );
    const escapedPlace = place.replace(/'/g, '&#x27;');

    expect(markup).toContain(`aria-label="Show ${escapedPlace} on the map"`);
  });
});
