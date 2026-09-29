import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { QUEST_DATA, type QuestData } from '../data/questData';
import type { UnlockState } from '../types';
import type { AreaRoutes } from '../utils/areaRoutes';
import { evaluateQuestEligibility } from '../utils/journalStatus';
import { QuestCard } from './QuestLog';

/**
 * A player reported on 29 September 2026 that the Quest Log called quests
 * ready to complete in owned areas they had no way to reach, as the Diary
 * Journal did.
 */
vi.mock('../context/GameContext', () => ({
  useGame: () => ({ unlocks: {}, completeQuest: vi.fn(), advisorsEnabled: false, gameModeId: 'vanilla' }),
}));
vi.mock('../hooks/useLocalStorage', () => ({
  useLocalStorage: (_key: string, initial: unknown) => [initial, vi.fn()],
}));
vi.mock('./JournalFilterBar', () => ({ JournalFilterBar: () => null }));
vi.mock('./JournalInsights', () => ({ QuestInsights: () => null }));
vi.mock('./QuestAdvisorPanel', () => ({ QuestAdvisorPanel: () => null }));
vi.mock('./SkillTrainingPopover', () => ({ SkillTrainingPopover: () => null }));

const account = (regions: string[]): UnlockState => ({
  equipment: {}, skills: {}, levels: {}, regions, mobility: [], arcana: [], housing: [], merchants: [],
  minigames: [], bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [], quests: [],
  diaries: [], cas: [], completedTasks: [], collectionLog: {},
});
const strandedAt = (...areas: string[]): AreaRoutes => ({ strandedAreas: new Set(areas), strandedChunks: new Set() });
const noRoute = (place: string) => ({ kind: 'alternative', label: `No route to ${place}`, travel: place, blockerKinds: [], routes: [] });

const barcrawl = QUEST_DATA["Alfred Grimhand's Barcrawl"];
const bars = account([...new Set(barcrawl.locations!.flatMap(location => location.standardAreas))]);
const inAreas = (overrides: Partial<QuestData>): QuestData => ({
  id: 'Test quest', name: 'Test quest', kind: 'quest', accessPolicy: 'regions', regions: [], skills: {},
  prereqs: [], points: 1, difficulty: barcrawl.difficulty, ...overrides,
});

describe('a quest in an owned area no route reaches', () => {
  it('reads "No route to" the place, not ready, as a Diary task does', () => {
    expect(evaluateQuestEligibility(barcrawl, bars, 'vanilla').eligible).toBe(true);

    const stranded = evaluateQuestEligibility(barcrawl, bars, 'vanilla', strandedAt('Brimhaven'));
    expect(stranded.eligible).toBe(false);
    expect(stranded.status).toBe('LOCKED_REGION');
    expect(stranded.blockers).toEqual([noRoute("Dead Man's Chest in Brimhaven")]);
    expect(stranded.evidence).not.toContain("Dead Man's Chest in Brimhaven");

    const quest = inAreas({ regions: ['Brimhaven'] });
    expect(evaluateQuestEligibility(quest, account(['Brimhaven']), 'vanilla', strandedAt('Brimhaven')).blockers)
      .toEqual([noRoute('Brimhaven')]);
    // An area the run doesn't own stays a plain region blocker.
    expect(evaluateQuestEligibility(quest, account([]), 'vanilla', strandedAt('Brimhaven')).blockers)
      .toEqual([{ kind: 'region', label: 'Brimhaven' }]);
  });

  it('takes any option a route reaches, and says when none does', () => {
    const quest = inAreas({ oneOf: [{ regions: ['Brimhaven'] }, { regions: ['Port Sarim'] }] });
    const both = account(['Brimhaven', 'Port Sarim']);
    expect(evaluateQuestEligibility(quest, both, 'vanilla', strandedAt('Brimhaven')).eligible).toBe(true);
    expect(evaluateQuestEligibility(quest, both, 'vanilla', strandedAt('Brimhaven', 'Port Sarim')).blockers)
      .toEqual([noRoute('Brimhaven or Port Sarim')]);
    expect(evaluateQuestEligibility(quest, account(['Port Sarim']), 'vanilla', strandedAt('Brimhaven', 'Port Sarim')).blockers)
      .toEqual([noRoute('Port Sarim')]);
  });

  it('shows the Quest Log card the red chip and no "Ready to complete"', () => {
    const eligibility = evaluateQuestEligibility(barcrawl, bars, 'vanilla', strandedAt('Brimhaven'));
    const markup = renderToStaticMarkup(<QuestCard quest={{ ...barcrawl, status: eligibility.status, eligibility }}
      unlocks={bars} gameModeId="vanilla" currentQP={0} onToggle={vi.fn()} />);
    const at = markup.indexOf('No route to Dead Man');
    const chip = markup.slice(markup.lastIndexOf('<span', at), markup.indexOf('</span>', at));

    expect(at).toBeGreaterThan(0);
    expect(chip).toContain('text-red-400');
    expect(chip).toContain('every way there crosses locked land');
    expect(markup).not.toContain('Ready to complete');
  });

});
