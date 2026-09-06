import { expect, it } from 'vitest';
import { catalogQuest, questPointsForReferences } from '../data/questCatalog';
import { QUEST_DATA } from '../data/questData';
import { evaluateQuestEligibility, evaluateDiaryTaskEligibility } from './journalStatus';
import { evaluateActivityReadiness } from './activityReadiness';
import { evaluatePredicate } from './requirementPredicates';
import { slayerReachability } from './slayerReach';
import { planForTarget } from './goalPlanner';
import { TableType, type UnlockState } from '../types';
import { calculateGoalProgress } from './goalLogic';

it('gives mixed stable IDs and legacy aliases the same completion and gate evidence across features', () => {
  const priestId = catalogQuest('Priest in Peril')!.id;
  const state: UnlockState = {
    equipment: {}, skills: { Slayer: 1 }, levels: { Slayer: 85 }, regions: ['Edgeville'],
    quests: [priestId, 'PRIEST IN PERIL', 'Priest in Peril'], diaries: [], cas: [], completedTasks: [], collectionLog: {},
    mobility: [], arcana: [], housing: [], merchants: [], minigames: [], bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [],
  };
  expect(questPointsForReferences(state.quests)).toBe(1);
  expect(evaluatePredicate({ kind: 'quest', id: priestId }, { unlocks: state }).status).toBe('READY');
  expect(evaluatePredicate({ kind: 'questPoints', count: 2 }, { unlocks: state }).status).toBe('LOCKED');
  expect(evaluateQuestEligibility(QUEST_DATA['Priest in Peril'], state).status).toBe('COMPLETED');
  expect(evaluateDiaryTaskEligibility({ id: 'priest-gate', quests: ['Priest in Peril'] }, state).eligible).toBe(true);
  expect(evaluateActivityReadiness(true, { quests: ['Priest in Peril'] }, state).status).toBe('READY');
  const slayer = slayerReachability({ Krystilia: { Banshees: { weight: 8, slayer: 15, req: ['Priest in Peril Complete the quest'] } } }, state, () => ({ cx: 2, cy: 2, unlocked: true }));
  expect(slayer.masters[0].rows[0].status).toBe('ready');
  expect(planForTarget('quest', priestId, state)?.alreadyDone).toBe(true);
  expect(calculateGoalProgress({ id: priestId, category: TableType.QUESTS, regions: [], skills: {} }, state).percentage).toBe(100);
});
