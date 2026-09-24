// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UnlockState } from '../types';
import { DiaryLog } from './DiaryLog';

const fixture = vi.hoisted(() => ({
  unlocks: {
    equipment: {}, skills: {}, levels: {},
    regions: [], mobility: [], arcana: [], housing: [], merchants: [], minigames: [],
    bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [],
    quests: [], diaries: [], cas: [], completedTasks: [], collectionLog: {},
  } as UnlockState,
}));
vi.mock('../context/GameContext', () => ({
  useGame: () => ({
    unlocks: fixture.unlocks,
    completeDiaryTask: vi.fn(),
    completeDiaryTier: vi.fn(),
    advisorsEnabled: false,
    gameModeId: 'vanilla',
  }),
}));
vi.mock('./JournalInsights', () => ({ DiaryInsights: () => null }));
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

describe('diary journal jumps', () => {
  it('clears the search to show a diary opened from Next Best', async () => {
    render(<DiaryLog />);
    const search = screen.getByPlaceholderText('Search diaries or tasks...') as HTMLInputElement;
    fireEvent.change(search, { target: { value: 'Karamja' } });
    expect(card('Ardougne Easy')).toBeNull();

    // "Open in the list" in Next Best asks the journal to focus the diary.
    act(() => {
      window.dispatchEvent(new CustomEvent('fate:journal-focus', { detail: { id: 'Ardougne Easy' } }));
    });

    expect(search.value).toBe('');
    expect(card('Ardougne Easy')).not.toBeNull();
    await waitFor(() => expect(scrolled).toContain(card('Ardougne Easy')), { timeout: 3_000 });
  }, 30_000);
});
