// @vitest-environment jsdom

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { QUEST_DATA } from '../data/questData';
import type { UnlockState } from '../types';
import type { QuestChunkStatus } from '../utils/questDoability';
import { evaluateQuestEligibility } from '../utils/journalStatus';
import { QuestDoabilityPanel, evaluateQuestDoability, questDoabilityRequirementLabels } from './QuestDoabilityPanel';

const account = (): UnlockState => ({
  equipment: {}, skills: { Crafting: 1 }, levels: { Crafting: 1 },
  regions: [], mobility: [], arcana: [], housing: [], merchants: [], minigames: [],
  bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [],
  quests: [], diaries: [], cas: [], completedTasks: [], collectionLog: {},
});
vi.mock('../context/GameContext', () => ({
  useGame: () => ({ unlocks: account(), gameModeId: 'vanilla' }),
}));
const chunkMocks = vi.hoisted(() => ({
  init: vi.fn().mockResolvedValue(false), questSections: vi.fn(() => ({})),
  connectGraph: vi.fn(() => ({})), entityLocations: vi.fn(() => null),
  reachability: vi.fn(() => ({ reachable: new Set() })),
}));
vi.mock('../services/ChunkContentService', () => ({
  chunkContentService: { ready: false, ...chunkMocks },
}));
vi.mock('../utils/chunkReach', () => ({ chunkReachability: chunkMocks.reachability }));
beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

const renderSearch = (searchTerm: string) => renderToStaticMarkup(<QuestDoabilityPanel searchTerm={searchTerm} />).replace(/<[^>]+>/g, '');

describe('quest doability presentation in Vanilla', () => {
  it('retains the canonical alternative skill blocker in the displayed requirements', () => {
    const quest = QUEST_DATA['Desert Treasure I'];
    const unlocks = {
      ...account(), skills: { Thieving: 6, Firemaking: 5, Magic: 5 },
      levels: { Thieving: 53, Firemaking: 50, Magic: 50 },
      regions: [...quest.regions], quests: [...quest.prereqs],
    };
    const eligibility = evaluateQuestEligibility(quest, unlocks, 'vanilla');
    const row = evaluateQuestDoability(quest, unlocks, null, [], 'vanilla');
    expect(row.bucket).toBe('REQS');
    expect(questDoabilityRequirementLabels(row)).toEqual(eligibility.blockers.map(blocker => blocker.label));
    expect(questDoabilityRequirementLabels(row)[0]).toContain('Slayer 10 or Plague City');
  });

  it('uses the same matching quest set for both searched counts', () => {
    expect(renderSearch('Sheep Shearer')).toContain('1 of 1 doable now');
  });

  it('shows zero matching quests when search finds no results', () => {
    expect(renderSearch('no such quest qqq')).toContain('0 of 0 doable now');
  });

  it('keeps the full denominator when no search is active', () => {
    expect(renderSearch('')).toContain(`of ${Object.keys(QUEST_DATA).length} doable now`);
  });
});


describe('Vanilla doability uses canonical area requirements', () => {
  const fakeChunk = (access: 'LOCKED' | 'STRANDED'): QuestChunkStatus => ({
    access, chunkCount: 1, reachable: 0, startReachable: false,
    blockers: [{ cx: 50, cy: 50, access }],
  });

  it.each(['LOCKED', 'STRANDED'] as const)('ignores irrelevant %s chunk evidence for a canonically eligible Vanilla quest', access => {
    const quest = QUEST_DATA["Cook's Assistant"];
    expect(evaluateQuestEligibility(quest, account(), 'vanilla').eligible).toBe(true);
    const row = evaluateQuestDoability(quest, account(), fakeChunk(access), ['Fake locked area'], 'vanilla');
    expect(row).toMatchObject({ bucket: 'DOABLE', reqsMet: true, lockedAreas: [] });
  });

  it('matches canonical Journal readiness across every catalogue quest without chunk evidence', () => {
    for (const quest of Object.values(QUEST_DATA)) {
      const eligibility = evaluateQuestEligibility(quest, account(), 'vanilla');
      const row = evaluateQuestDoability(quest, account(), null, [], 'vanilla');
      expect(row.bucket === 'DOABLE', quest.name).toBe(eligibility.eligible && eligibility.status !== 'COMPLETED');
      expect(row.bucket, quest.name).not.toBe('NO_DATA');
      expect(row.bucket, quest.name).not.toBe('STRANDED');
    }
  });

  it('renders immediately without loading or consulting a cold chunk service', () => {
    const view = render(<QuestDoabilityPanel searchTerm="Sheep Shearer" />);
    expect(view.getByText('Sheep Shearer')).toBeTruthy();
    expect(view.queryByText(/Loading chunk data/)).toBeNull();
    expect(view.queryByText(/chunk reachability|transport links|Stranded|no chunk data/i)).toBeNull();
    for (const fn of Object.values(chunkMocks)) expect(fn).not.toHaveBeenCalled();
  });

  it('retains canonical locked areas and confirmation checks while ignoring unrelated chunk evidence', () => {
    const porcine = QUEST_DATA['A Porcine of Interest'];
    const row = evaluateQuestDoability(porcine, account(), fakeChunk('LOCKED'), ['Fake locked area'], 'vanilla');
    expect(row.bucket).toBe('LOCKED');
    expect(row.lockedAreas).toEqual(evaluateQuestEligibility(porcine, account(), 'vanilla').blockers
      .filter(blocker => blocker.kind === 'region').map(blocker => blocker.label));
    expect(row.lockedAreas).not.toContain('Fake locked area');
    const sheep = evaluateQuestDoability(QUEST_DATA['Sheep Shearer'], { ...account(), skills: {} }, fakeChunk('STRANDED'), [], 'vanilla');
    expect(sheep.bucket).toBe('REQS');
    expect(sheep.manualChecks.join(' ')).toContain('20 unnoted balls of wool');
  });

  it('does not label an invalid canonical access configuration ready and explains its blocker', () => {
    const quest = { ...QUEST_DATA["Cook's Assistant"], locations: [] };
    const row = evaluateQuestDoability(quest, account(), null, [], 'vanilla');
    expect(row.bucket).toBe('REQS');
    expect(questDoabilityRequirementLabels(row).join(' ')).toContain('Invalid quest access configuration');
  });
});
