import { describe, expect, it } from 'vitest';
import { UnlockState } from '../types';
import { computeUnlockImpact, prepareUnlockImpactContext } from './unlockImpact';
import { evaluateQuestEligibility } from './journalStatus';
import { QUEST_DATA } from '../data/questData';
import { rankAvailableQuests } from './questAdvisor';

const unlocksReadyForPryingTimes = (): UnlockState => ({
  equipment: {}, skills: { Smithing: 3, Sailing: 2 }, levels: { Smithing: 30, Sailing: 12 },
  regions: ['The Open Seas', 'The Pandemonium', 'Port Sarim'], mobility: [], arcana: [], housing: [], merchants: [],
  minigames: [], bosses: [], storage: [], guilds: [], farming: [],
  slayerUnlocks: [], quests: ['Pandemonium', "The Knight's Sword"], diaries: [], cas: [],
  completedTasks: [], collectionLog: {},
});

describe('rankAvailableQuests', () => {
  it('includes conditional candidates with their pending checks', () => {
    expect(rankAvailableQuests(unlocksReadyForPryingTimes()).map(quest => quest.id))
      .toContain('Prying Times');
    expect(rankAvailableQuests(unlocksReadyForPryingTimes()).find(q => q.id === 'Prying Times')?.pendingChecks?.length).toBeGreaterThan(0);
  });

  it('excludes completed quests even when their requirements are otherwise eligible', () => {
    const unlocks = unlocksReadyForPryingTimes();
    expect(rankAvailableQuests({
      ...unlocks,
      quests: [...unlocks.quests, 'Prying Times'],
    }).map(quest => quest.id)).not.toContain('Prying Times');
  });
});


describe('unmocked conditional planning', () => {
  it('shows Cook as a candidate without changing its readiness or allowing hard gates', () => {
    const u = { ...unlocksReadyForPryingTimes(), regions: [], quests: [] };
    const ranked = rankAvailableQuests(u);
    expect(ranked.find(q => q.id === "Cook's Assistant")?.pendingChecks?.length).toBeGreaterThan(0);
    expect(ranked.map(q => q.id)).not.toContain('Prying Times');
    expect(evaluateQuestEligibility(QUEST_DATA["Cook's Assistant"], u).status).toBe('NEEDS_CONFIRMATION');
    expect(evaluateQuestEligibility(QUEST_DATA["Cook's Assistant"], u).eligible).toBe(false);
    expect(u.quests).toEqual([]);
  });
  it('counts conditional downstream paths only when planning explicitly opts in', () => {
    const before = { ...unlocksReadyForPryingTimes(), quests: ["The Knight's Sword"] };
    const after = { ...before, quests: [...before.quests, 'Pandemonium'] };
    expect(computeUnlockImpact(before, after).directQuestNames).not.toContain('Prying Times');
    const impact = computeUnlockImpact(before, after, undefined, { includeConditional: true });
    expect(impact.directQuestNames).toContain('Prying Times');
    expect(impact.cascadeQuestNames).toContain('Prying Times');
    expect(evaluateQuestEligibility(QUEST_DATA['Prying Times'], after).eligible).toBe(false);
    expect(after.quests).not.toContain('Prying Times');
  });
});


it('does not simulate completion through an unknown operational gate', () => {
  const before = unlocksReadyForPryingTimes();
  const context = prepareUnlockImpactContext(before);
  const unknown = { ...QUEST_DATA['Prying Times'], id: 'unreviewed', prereqs: [], skills: {}, regions: [],
    accessPolicy: 'regions' as const, locations: undefined, operationalRequirements: [{ kind: 'unknown' as const, key: 'missing', label: 'Not classified' }] };
  context.allQuests = [unknown];
  context.baseQuestStatus = new Map([['unreviewed', 'UNKNOWN']]);
  context.baseAvailableIds = new Set();
  context.baseCompletedQuestIds = new Set();
  const impact = computeUnlockImpact(before, before, undefined, { context, includeConditional: true, diaryIds: [] });
  expect(impact.directQuestNames).toEqual([]);
  expect(impact.cascadeQuestNames).toEqual([]);
  expect(impact.finalQuestIds).not.toContain('unreviewed');
});
