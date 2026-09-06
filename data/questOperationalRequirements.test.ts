import { describe, expect, it } from 'vitest';
import { QUEST_DATA, type QuestData } from './questData';
import { evaluateQuestEligibility } from '../utils/journalStatus';
import { questCompletionDecision } from '../utils/journalCompletion';
import { calculateGoalProgress } from '../utils/goalLogic';
import { TableType, type UnlockState } from '../types';

const state: UnlockState = {
  equipment: {}, skills: {}, levels: {}, regions: [], quests: [], diaries: [], cas: [], completedTasks: [], collectionLog: {},
  mobility: [], arcana: [], housing: [], merchants: [], minigames: [], bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [],
};

describe('quest operational completion readiness', () => {
  it("keeps missing Cook's Assistant source data unknown in both journal and pinned goals", () => {
    const quest = QUEST_DATA["Cook's Assistant"];
    const result = evaluateQuestEligibility(quest, state);
    expect(result.status).toBe('UNKNOWN');
    expect(result.confirmable).toBe(false);
    expect([...result.manualChecks, ...result.blockers.map(blocker => blocker.label)].join(' ')).toMatch(/egg/i);
    expect([...result.manualChecks, ...result.blockers.map(blocker => blocker.label)].join(' ')).toMatch(/milk/i);
    expect([...result.manualChecks, ...result.blockers.map(blocker => blocker.label)].join(' ')).toMatch(/flour/i);
    expect(questCompletionDecision(quest, state).ok).toBe(false);
    expect(questCompletionDecision(quest, state, undefined, { manualConfirmed: true }).ok).toBe(false);
    expect(calculateGoalProgress({ id: quest.id, category: TableType.QUESTS, regions: [], skills: {} }, state).percentage).toBeLessThan(100);
  });
  it('does not allow a manual attestation to bypass the required Demon Slayer weapon slot', () => {
    const quest = QUEST_DATA['Demon Slayer'];
    expect(evaluateQuestEligibility(quest, state).blockers).toContainEqual({ kind: 'requirement', label: 'Weapon equipment tier 1' });
    expect(questCompletionDecision(quest, state, undefined, { manualConfirmed: true }).ok).toBe(false);
  });
  it('does not demand a gathering level to use pre-obtained Priest in Peril essence', () => {
    const quest = QUEST_DATA['Priest in Peril'];
    const result = evaluateQuestEligibility(quest, state);
    expect(result.manualChecks.join(' ')).toMatch(/50 unnoted rune essence or pure essence/i);
    expect(result.blockers.some(blocker => blocker.kind === 'skill')).toBe(false);
  });
  it('keeps custom unclassified operational data unknown and non-confirmable', () => {
    const quest = { ...QUEST_DATA["Cook's Assistant"], id: 'Unknown imported quest' };
    expect(evaluateQuestEligibility(quest, state)).toMatchObject({ status: 'UNKNOWN', eligible: false, confirmable: false });
    expect(questCompletionDecision(quest, state, undefined, { manualConfirmed: true }).ok).toBe(false);
    expect(evaluateQuestEligibility({ ...quest, operationalRequirements: [] }, state).status).toBe('AVAILABLE');
  });
});

 it.each([
   [{ regions: ['Rimmington'] }, 'LOCKED_REGION'],
   [{ skills: { Woodcutting: 30 } }, 'LOCKED_SKILL'],
   [{ prereqs: ['Rune Mysteries'] }, 'LOCKED_QUEST'],
 ] satisfies [Partial<QuestData>, string][])('keeps known hard gates ahead of unknown supplies: %j', (gate, status) => {
   const quest = { ...QUEST_DATA["Cook's Assistant"], accessPolicy: 'regions' as const, locations: undefined, ...gate,
     operationalRequirements: [{ kind: 'unknown' as const, key: 'missing-supply', label: 'Unreviewed acquisition route' }] };
   const result = evaluateQuestEligibility(quest, state);
   expect(result.status).toBe(status);
   expect(result.blockers).toContainEqual({ kind: 'requirement', label: 'Unreviewed acquisition route', internalOnly: true });
   expect(result.confirmable).toBe(false);
 });
