import { describe, expect, it } from 'vitest';
import { f2pQuestMembership } from '../f2pQuestMembership';
import { questStrategyCatalogue, questWalkthroughFor, questStrategyFor } from '../questWalkthroughs.preview-boundary';
import { questStrategyCatalogue as publicStrategies } from '../questWalkthroughs.public';
import { loadQuestStrategyCatalogue, loadQuestWalkthroughFor } from '../questWalkthroughLoader';
import { batchA } from './batchA';
import { batchB } from './batchB';
import { batchC } from './batchC';
import { compileF2PGuidePack } from './compile';
import { currentQuestPoints } from '../../utils/journalStatus';
import { evaluateRouteGates } from '../../utils/questRoutes/accountRequirements';
import { materializeRuneProofAccount } from '../../utils/questRoutes/goalPlannerRuneProof';
import { analyzeQuest, type QuestRouteAnalysisSnapshot } from '../../utils/questRoutes/analyzeQuest';
import { buildRuneProofCoachModel } from '../../utils/questStrategies/coach';
import { guideNeeds } from '../../utils/questStrategies/guideNeeds';
import type { UnlockState } from '../../types';

const packs = [...batchA, ...batchB, ...batchC];
const account = (equipment = {}, quests: string[] = []): UnlockState => ({
  equipment, quests, skills: {}, levels: {}, regions: [], chunks: [],
  guilds: [], merchants: [], minigames: [], mobility: [], slayerUnlocks: [], arcana: [],
  housing: [], bosses: [], storage: [], farming: [], diaries: [], cas: [], completedTasks: [], collectionLog: {},
});
const coach = (questId: string, unlocks = account(), checked: string[] = []) => {
  const snapshot: QuestRouteAnalysisSnapshot = {
    ...materializeRuneProofAccount(unlocks, 'vanilla'), chunkDataVersion: 1,
    itemSourceRecords: [], recipes: [], entityLocations: [], stationRequirements: [], sourceCoverage: [], connectGraph: {},
  };
  return buildRuneProofCoachModel({ strategy: questStrategyFor(questId)!,
    analysis: analyzeQuest(questId, snapshot, questWalkthroughFor(questId)!), account: snapshot,
    confirmedActionIds: new Set(checked), confirmedItemKeys: new Set(), completedQuestIds: new Set(unlocks.quests),
  });
};

describe('all F2P guides in the local Vanilla preview', () => {
  it('covers the exact current roster and 46 quest points without members-only Daddy\'s Home', () => {
    expect(questStrategyCatalogue).toHaveLength(24);
    expect(new Set(questStrategyCatalogue.map(q => q.questId))).toEqual(new Set(f2pQuestMembership.map(q => q.questId)));
    expect(currentQuestPoints({ quests: f2pQuestMembership.map(q => q.questId) })).toBe(46);
    expect(questStrategyFor("Daddy's Home")).toBeUndefined();
  });
  it.each(packs.map(pack => [pack.questId, pack] as const))('compiles %s with facts, balanced item flow, stable step identities and one final completion', (_name, pack) => {
    const { walkthrough, strategy } = compileF2PGuidePack(pack);
    expect(walkthrough.releaseStatus).toBe('PREVIEW_ONLY');
    expect(strategy.article?.sourceUrl).toContain(`oldid=${pack.wikiRevision}`);
    expect(strategy.article?.startPoint).not.toBe('');
    expect(strategy.actions.length).toBeGreaterThan(1);
    expect(strategy.actions.filter(a => a.coach.completion.kind === 'QUEST_COMPLETED')).toHaveLength(1);
    expect(strategy.actions.at(-1)?.coach.completion.kind).toBe('QUEST_COMPLETED');
    expect(new Set(strategy.actions.map(a => a.id)).size).toBe(strategy.actions.length);
    for (const step of pack.steps) expect(step.locationEvidence.trim().length).toBeGreaterThan(10);
    const model = coach(pack.questId);
    expect(model.actions).toHaveLength(pack.steps.length);
    expect(model.article?.questId).toBe(pack.questId);
  });
  it('preserves all five public revisions and keeps expanded guides out of the public loader', async () => {
    expect(await loadQuestStrategyCatalogue('PUBLIC')).toEqual(publicStrategies);
    for (const existing of publicStrategies) expect(questStrategyFor(existing.questId)).toBe(existing);
    const quest = questWalkthroughFor('Dragon Slayer I')!;
    const release = { questId: quest.questId, revision: quest.revision, releaseStatus: 'PREVIEW_ONLY' as const };
    expect(await loadQuestWalkthroughFor('PREVIEW', release)).toBe(quest);
    expect(await loadQuestWalkthroughFor('PUBLIC', release)).toBeUndefined();
    expect(await loadQuestWalkthroughFor('PREVIEW', { ...release, revision: 'wrong' })).toBeUndefined();
  });
  it('counts earned quest points for the gate instead of treating them as a trainable skill', () => {
    const gate = { type: 'SKILL' as const, skill: 'Quest Points', level: 32, label: 'Quest Points 32' };
    expect(evaluateRouteGates([gate], account()).blockers).toEqual([gate]);
    const quests = f2pQuestMembership.map(q => q.questId).filter(id => id !== 'Dragon Slayer I');
    expect(evaluateRouteGates([gate], account({}, quests)).blockers).toEqual([]);
    expect(guideNeeds(coach('Dragon Slayer I')).some(need => need.label === 'Quest Points 32' && need.visual?.type === 'QUEST')).toBe(true);
  });
  it('shows both disguise slot locks and the apron slot lock in Vanilla', () => {
    const knightNeeds = guideNeeds(coach("Black Knights' Fortress"));
    expect(knightNeeds.some(need => need.id === 'equipment:Head:1')).toBe(true);
    expect(knightNeeds.some(need => need.id === 'equipment:Body:1')).toBe(true);
    expect(guideNeeds(coach("Pirate's Treasure")).some(need => need.id === 'equipment:Body:1')).toBe(true);
    expect(guideNeeds(coach("Black Knights' Fortress", account({ Head: 1, Body: 1 }))).some(need => need.id.startsWith('equipment:'))).toBe(false);
  });
  it('allows starting the Knight quest before its later Mining gate', () => {
    const model = coach("The Knight's Sword");
    expect(model.nextAction?.blockers?.some(b => b.kind === 'GATE' && b.gate.type === 'SKILL' && b.gate.skill === 'Mining')).toBe(false);
    expect(model.actions.find(a => a.id.endsWith(':mine-blurite'))?.blockers?.some(b => b.kind === 'GATE' && b.gate.type === 'SKILL' && b.gate.skill === 'Mining')).toBe(true);
  });
  it('keeps Shield partner exchange a check until explicitly confirmed without dead-ending the guide', () => {
    const strategy = questStrategyFor('Shield of Arrav')!;
    const index = strategy.actions.findIndex(a => a.id.endsWith(':give-partner-key'));
    const checked = strategy.actions.slice(0, index).map(a => a.id);
    const before = coach(strategy.questId, account(), checked);
    expect(before.nextAction?.state).toBe('NEEDS_CONFIRMATION');
    expect(before.nextAction?.confirmationAllowed).toBe(true);
    expect(guideNeeds(before).some(need => need.kind === 'CHECK' && need.actionIds.includes(strategy.actions[index].id))).toBe(true);
    const after = coach(strategy.questId, account(), [...checked, strategy.actions[index].id]);
    expect(guideNeeds(after).some(need => need.actionIds.includes(strategy.actions[index].id))).toBe(false);
  });
  it('keeps unknown preview destinations unknown rather than substituting an unrelated chunk', () => {
    for (const pack of packs) for (const step of pack.steps.filter(s => !s.chunks.length)) {
      const action = questWalkthroughFor(pack.questId)!.actions.find(a => a.id === `${pack.slug}:${step.id}`)!;
      expect(action.location.kind).toBe('NONE');
      expect(action.confidence).toBe('UNMAPPED');
    }
  });
});
