// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UnlockState } from '../types';
import { QuestLog } from './QuestLog';

const fixture = vi.hoisted(() => ({
  unlocks: {
    equipment: {}, skills: {}, levels: {},
    regions: [], mobility: [], arcana: [], housing: [], merchants: [], minigames: [],
    bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [],
    quests: [], diaries: [], cas: [], completedTasks: [], collectionLog: {},
  } as UnlockState,
}));
vi.mock('../context/GameContext', () => ({
  useGame: () => ({ unlocks: fixture.unlocks, completeQuest: vi.fn(), advisorsEnabled: false, gameModeId: 'vanilla' }),
}));
vi.mock('./JournalInsights', () => ({ QuestInsights: () => null }));
vi.mock('./QuestAdvisorPanel', () => ({ QuestAdvisorPanel: () => null }));
vi.mock('./SkillTrainingPopover', () => ({ SkillTrainingPopover: () => null }));

// jsdom has no scrollIntoView; record which cards a jump scrolls to.
const scrolled: Element[] = [];
beforeAll(() => {
  Element.prototype.scrollIntoView = function scrollIntoView(this: Element) { scrolled.push(this); };
});
afterAll(() => {
  delete (Element.prototype as Partial<Element>).scrollIntoView;
});
beforeEach(() => {
  localStorage.clear();
  scrolled.length = 0;
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});

const card = (id: string) => document.querySelector<HTMLElement>(`[data-journal-id="${id}"]`);

// A jump renders the whole quest list, which is slow in jsdom, so the filter
// controls are looked up while the list is still short.
const JUMP_TIMEOUT = 30_000;

// Desert Treasure I is a Master quest; its prerequisite Priest in Peril is
// Novice. The tier filter is remembered, as for a returning player.
const renderMasterQuestsSearchedFor = (term: string) => {
  localStorage.setItem('jrnl:quest:diff', JSON.stringify('Master'));
  render(<QuestLog />);
  const tier = screen.getByRole('combobox', { name: 'Filter by tier' }) as HTMLSelectElement;
  const search = screen.getByPlaceholderText('Search quests...') as HTMLInputElement;
  expect(tier.value).toBe('Master');
  fireEvent.change(search, { target: { value: term } });
  expect(card('Priest in Peril')).toBeNull();
  return { tier, search };
};

describe('quest journal jumps', () => {
  it('clears the tier filter and search to show a prerequisite chip\'s quest', async () => {
    const { tier, search } = renderMasterQuestsSearchedFor('Desert Treasure');

    fireEvent.click(within(card('Desert Treasure I')!).getByTitle('Jump to prerequisite: Priest in Peril'));

    expect(card('Priest in Peril')).not.toBeNull();
    expect(card('Priest in Peril')!.className).toContain('ring-amber-400');
    expect(tier.value).toBe('ALL');
    expect(search.value).toBe('');
    await waitFor(() => expect(scrolled).toContain(card('Priest in Peril')));
  }, JUMP_TIMEOUT);

  it('clears the status, tier and search filters for a quest opened from Next Best', async () => {
    localStorage.setItem('jrnl:quest:filter', JSON.stringify('COMPLETED'));
    const { tier, search } = renderMasterQuestsSearchedFor('Desert Treasure');

    // "Open in the list" in Next Best asks the journal to focus the quest.
    act(() => {
      window.dispatchEvent(new CustomEvent('fate:journal-focus', { detail: { id: 'Priest in Peril' } }));
    });

    expect(card('Priest in Peril')).not.toBeNull();
    expect(card('Priest in Peril')!.className).toContain('ring-amber-400');
    expect(localStorage.getItem('jrnl:quest:filter')).toBe(JSON.stringify('ALL'));
    expect(tier.value).toBe('ALL');
    expect(search.value).toBe('');
    await waitFor(() => expect(scrolled).toContain(card('Priest in Peril')));
  }, JUMP_TIMEOUT);
});
