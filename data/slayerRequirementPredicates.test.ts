import { describe, expect, it } from 'vitest';
import content from '../public/chunk-content.json';
import { slayerRequirementPredicate } from './slayerRequirementPredicates';
import { slayerReachability } from '../utils/slayerReach';
import type { UnlockState } from '../types';
describe('Slayer source requirement classification', () => {
  it('classifies every committed assignment requirement and rejects changed unknown wording', () => {
    let count = 0;
    for (const tasks of Object.values(content.slayerMasters) as Array<Record<string, { req?: string[] }>>) {
      for (const row of Object.values(tasks)) for (const clause of row.req ?? []) {
        count++;
        expect(slayerRequirementPredicate(clause).kind, clause).not.toBe('unknown');
      }
    }
    expect(count).toBeGreaterThan(0);
    expect(slayerRequirementPredicate('Dragon Slayer I 999 unreviewed route').kind).toBe('unknown');
    expect(slayerRequirementPredicate('constructor Complete the quest').kind).toBe('unknown');
  });
  it('never calls manually classified quest progress ready just because the location is open', () => {
    const unlocks = { levels: { Slayer: 99, Attack: 99, Strength: 99, Defence: 99, Hitpoints: 99, Prayer: 99 }, regions: ['Edgeville'], quests: ['Dragon Slayer I'], skills: {} } as Partial<UnlockState> as UnlockState;
    const result = slayerReachability({ Krystilia: { Dragons: { weight: 5, req: ['Dragon Slayer I 1'] } } }, unlocks, () => ({ cx: 1, cy: 1, unlocked: true }));
    expect(result.masters[0].rows[0].status).toBe('needs-confirmation');
    expect(result.masters[0].ready).toBe(0);
  });
});
