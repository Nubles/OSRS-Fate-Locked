import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QUEST_DATA } from '../data/questData';
import type { UnlockState } from '../types';
import type { AreaRoutesState } from '../hooks/useAreaRoutes';
import {
  JournalSummaryCard, ROUTES_PENDING_LABEL, journalSummaryDiarySub, journalSummaryQuestSub, shownRecommendation,
} from './JournalSummaryCard';
import { OsrsJournalSummary } from './osrs/OsrsJournalSummary';

/**
 * For a moment after every page load the first screen counted quests and
 * diary tasks in owned areas no route reaches, because the routes had not
 * loaded yet: a real run read "8 ready" and "29 doable now", then 5 and 10.
 * While the routes load, the summary now holds those lines.
 */

// Owns every area of Alfred Grimhand's Barcrawl, so without routes it counts as ready.
const barcrawl = QUEST_DATA["Alfred Grimhand's Barcrawl"];
const unlocks: UnlockState = {
  equipment: {}, skills: {}, levels: {},
  regions: [...new Set(barcrawl.locations!.flatMap(location => location.standardAreas))],
  mobility: [], arcana: [], housing: [], merchants: ['Bars & Inns'], minigames: [],
  bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [],
  quests: [], diaries: [], cas: [], completedTasks: [], collectionLog: {},
};

let routes: AreaRoutesState = { routes: null, pending: true };
vi.mock('../context/GameContext', () => ({
  useGame: () => ({ unlocks, advisorsEnabled: true, gameModeId: 'vanilla', hasSeenOnboarding: true }),
}));
vi.mock('../hooks/useAreaRoutes', () => ({ useAreaRoutesState: () => routes }));
vi.mock('../utils/uiStyle', () => ({ useIsOsrsUi: () => false }));
vi.mock('./osrs/OsrsJournalNav', () => ({ openOsrsJournal: vi.fn() }));

const text = (markup: string) => markup.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ');
const classic = () => text(renderToStaticMarkup(<JournalSummaryCard onNavClick={vi.fn()} />));
const osrs = () => renderToStaticMarkup(<OsrsJournalSummary />);

beforeEach(() => { routes = { routes: null, pending: true }; });

describe('the Journal summary while the routes load', () => {
  it('holds what is ready, what is doable and what to do next on the classic card', () => {
    const waiting = classic();
    expect(waiting.split(ROUTES_PENDING_LABEL).length - 1).toBe(3); // next step, quests, diary tasks
    expect(waiting).not.toMatch(/ready to complete|doable now|doable right now|Complete Alfred/);
    // What does not depend on routes is there from the start.
    expect(waiting).toContain(`0/${Object.keys(QUEST_DATA).length} done`);
  });

  it('then shows the counts the routes give', () => {
    routes = { routes: { strandedAreas: new Set(), strandedChunks: new Set() }, pending: false };
    const reachable = classic();
    expect(reachable).not.toContain(ROUTES_PENDING_LABEL);
    expect(reachable).toMatch(/miniquests? ready to complete/);

    // Every area of the Barcrawl owned, but no route to one of them: the miniquest is not ready.
    const ready = (markup: string) => Number((markup.match(/(\d+) miniquests? ready/) ?? [, '0'])[1]);
    routes = { routes: { strandedAreas: new Set(['Brimhaven']), strandedChunks: new Set() }, pending: false };
    expect(ready(classic())).toBe(ready(reachable) - 1);
  });

  it('shows the counts without routes once the wait is over (failed or slow)', () => {
    routes = { routes: null, pending: false };
    const shown = classic();
    expect(shown).not.toContain(ROUTES_PENDING_LABEL);
    expect(shown).toMatch(/ready to complete/);
  });

  it('holds the same lines in the OSRS Journal window, and its Examine texts', () => {
    const waiting = osrs();
    expect(text(waiting).split(ROUTES_PENDING_LABEL).length - 1).toBe(3); // quests, diary tasks, Combat Achievements
    expect(waiting).not.toMatch(/ready to complete|doable now|tasks at a boss you have unlocked/);
    expect(waiting).toContain(`Do this next: ${ROUTES_PENDING_LABEL}`);
    // A held row is drawn as "none" until its count is known.
    expect(waiting.match(/ojr-sum-sub is-none/g)?.length).toBe(3);

    routes = { routes: { strandedAreas: new Set(), strandedChunks: new Set() }, pending: false };
    const loaded = osrs();
    expect(loaded).not.toContain(ROUTES_PENDING_LABEL);
    expect(loaded).toMatch(/\d+ ready to complete/);
  });
});

describe('the held lines', () => {
  const stats = { quests: { available: 3, miniquests: 1 }, diaries: { doable: 7 } } as never;

  it('stand in for the two counts only while pending', () => {
    expect(journalSummaryQuestSub(stats)).toBe('2 quests and 1 miniquest ready to complete');
    expect(journalSummaryQuestSub(stats, true)).toBe(ROUTES_PENDING_LABEL);
    expect(journalSummaryDiarySub(stats)).toBe('7 tasks doable now');
    expect(journalSummaryDiarySub(stats, true)).toBe(ROUTES_PENDING_LABEL);
  });

  it('never hold "everything is done", which no route can change', () => {
    const done = { tab: null, headline: "Everything's done!", detail: 'All journal content completed' };
    expect(shownRecommendation(done, true)).toBe(done);
    const next = { tab: 'QUESTS' as const, headline: 'Complete Dragon Slayer I', detail: 'available now' };
    expect(shownRecommendation(next, false)).toBe(next);
    expect(shownRecommendation(next, true)).toEqual({ tab: 'QUESTS', headline: ROUTES_PENDING_LABEL, detail: 'Working out what you can reach' });
  });
});
