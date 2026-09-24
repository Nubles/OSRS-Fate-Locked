import { describe, expect, it } from 'vitest';
import { QUEST_DATA } from '../data/questData';
import { recipesFor } from '../data/questRouteRecipes';
import type { GameState, UnlockState } from '../types';
import { isItemAvailable } from './supplyChain';
import { evaluateQuestDoability } from '../components/QuestDoabilityPanel';
import { evaluateRouteGates } from './questRoutes/accountRequirements';
import { evaluateQuestEligibility } from './journalStatus';
import { questCompletionDecision } from './journalCompletion';
import { planForTarget } from './goalPlanner';

const account = (skills: Record<string, number> = {}): UnlockState => ({
  skills, levels: { Crafting: 99 }, equipment: {}, regions: ['Varrock', 'Paterdomus'],
  chunks: [], mobility: [], arcana: [], housing: [], merchants: [], minigames: [],
  bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [], quests: [],
  diaries: [], cas: [], completedTasks: [], collectionLog: {},
});

describe('community quest reports in Vanilla', () => {
  const sheep = QUEST_DATA['Sheep Shearer'];

  it('does not suggest Sheep Shearer as doable with Crafting locked and no wool confirmation', () => {
    const unlocks = account();
    const result = evaluateQuestEligibility(sheep, unlocks, 'vanilla');
    expect(result.eligible).toBe(false);
    expect(result.manualChecks.join(' ')).toMatch(/Crafting.*20 unnoted balls of wool/i);
    expect(evaluateQuestDoability(sheep, unlocks, null, [], 'vanilla').bucket).toBe('REQS');
    expect(planForTarget('quest', sheep.id, unlocks, 'vanilla')?.alreadyReachable).toBe(false);
    expect(questCompletionDecision(sheep, unlocks, 'vanilla').ok).toBe(false);
  });

  it('allows spinning with Crafting T1 while keeping official OSRS prerequisites empty', () => {
    expect(sheep.skills).toEqual({});
    expect(evaluateQuestEligibility(sheep, account({ Crafting: 1 }), 'vanilla'))
      .toMatchObject({ eligible: true, manualChecks: [] });
  });

  it('allows a confirmed supply of wool without inventing a mandatory Crafting prerequisite', () => {
    const result = evaluateQuestEligibility(sheep, account(), 'vanilla');
    expect(result).toMatchObject({ eligible: false, machineEligible: true, confirmable: true });
    expect(questCompletionDecision(sheep, account(), 'vanilla', { manualConfirmed: true })).toEqual({ ok: true });
  });

  it('gates the spinning recipe itself even when the recorded Crafting level is high', () => {
    const recipe = recipesFor('ball of wool').find(recipe => recipe.id === 'spin-wool')!;
    expect(evaluateRouteGates(recipe.gates, account()).blockers)
      .toContainEqual(expect.objectContaining({ type: 'SKILL', skill: 'Crafting', level: 1 }));
    expect(evaluateRouteGates(recipe.gates, account({ Crafting: 1 })).blockers).toEqual([]);
  });

  it('preserves completed Sheep Shearer in existing saves', () => {
    expect(evaluateQuestEligibility(sheep, { ...account(), quests: [sheep.id] }, 'vanilla'))
      .toMatchObject({ status: 'COMPLETED', eligible: true, manualChecks: [] });
  });

  it('keeps the resource planner consistent with the spinning and permitted shop routes', () => {
    const state = (unlocks: UnlockState) => ({ unlocks, gameModeId: 'vanilla' }) as GameState;
    expect(isItemAvailable('Ball of Wool', state(account()))).toBe(false);
    expect(isItemAvailable('Ball of Wool', state(account({ Crafting: 1 })))).toBe(true);
    expect(isItemAvailable('Ball of Wool', state({ ...account(), merchants: ['General Stores'] }))).toBe(false);
    expect(isItemAvailable('Ball of Wool', state({ ...account(), regions: ['East Ardougne'] }))).toBe(false);
    expect(isItemAvailable('Ball of Wool', state({
      ...account(), merchants: ['General Stores'], regions: ['East Ardougne'],
    }))).toBe(true);
  });

  it('does not mistake Priest in Peril reward XP for a Prayer or Neck requirement', () => {
    expect(evaluateQuestEligibility(QUEST_DATA['Priest in Peril'], account(), 'vanilla'))
      .toMatchObject({ eligible: true, blockers: [], manualChecks: [] });
    expect(evaluateQuestEligibility(QUEST_DATA['The Restless Ghost'], account(), 'vanilla').blockers)
      .toContainEqual(expect.objectContaining({ kind: 'equipment', slot: 'Neck', tier: 1 }));
  });
});
