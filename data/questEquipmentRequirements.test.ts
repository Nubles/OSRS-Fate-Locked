import { describe, expect, it } from 'vitest';
import { QUEST_DATA } from './questData';
import { QUEST_EQUIPMENT_REQUIREMENTS } from './questEquipmentRequirements';
import { questOperationalRequirements } from './questOperationalRequirements';
import { evaluatePredicate } from '../utils/requirementPredicates';
import type { UnlockState } from '../types';
const unlocks: UnlockState = { equipment: {}, skills: {}, levels: {}, regions: [], chunks: [], mobility: [], arcana: [], housing: [], merchants: [], minigames: [], bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [], quests: [], diaries: [], cas: [], completedTasks: [], collectionLog: {} };
describe('reviewed mandatory equipment gates', () => {
  for (const [id, gates] of Object.entries(QUEST_EQUIPMENT_REQUIREMENTS)) {
    it(`${id}: every mandatory slot is enforced by shared quest requirements`, () => {
      expect(QUEST_DATA[id]).toBeDefined();
      for (const gate of gates) expect(questOperationalRequirements(QUEST_DATA[id])).toContainEqual(gate);
      const all = { kind: 'all' as const, of: gates };
      expect(evaluatePredicate(all, { unlocks }).status).toBe('LOCKED');
      const equipment = Object.fromEntries(gates.flatMap(gate => gate.kind === 'equipment' ? [[gate.slot, gate.tier]] : []));
      expect(evaluatePredicate(all, { unlocks: { ...unlocks, equipment } }).status).toBe('READY');
      for (const slot of Object.keys(equipment)) expect(evaluatePredicate(all, { unlocks: { ...unlocks, equipment: { ...equipment, [slot]: 0 } } }).status).toBe('LOCKED');
    });
  }
  it('does not turn optional rewarded amulets or unreviewed ghost alternatives into mandatory neck gates', () => {
    expect(QUEST_EQUIPMENT_REQUIREMENTS['Imp Catcher']).toBeUndefined();
    expect(QUEST_EQUIPMENT_REQUIREMENTS['Making History']).toBeUndefined();
  });
});
