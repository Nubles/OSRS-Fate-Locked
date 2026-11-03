import { describe, expect, it } from 'vitest';
import { createFreshState, gameReducer, prepareKeyRollAction } from '../context/GameContext';
import { validateAndMigrateSave } from './saveSchema';
import { auditHistory } from './runAudit';
import { hitpointsRefund } from './hitpointsMigration';
import { randomUnlockPool } from './gameEngine';
import { sacrificeCandidates } from './ritualEffects';
import { resolveModeRules } from '../config/gameModes';
import { TableType, type GameState, type LogEntry } from '../types';

type Run = GameState & { lastEvent: unknown };
const RUN_ID = '0b7e9d2c-3f4a-4e1b-8c6d-5a9f0e1d2c3b';
const step = (s: Run, action: Parameters<typeof gameReducer>[1]): Run =>
  gameReducer(s as Parameters<typeof gameReducer>[0], action) as Run;
const best = (_p: string, _i = 0) => 1;

/** A run from before Hitpoints was free: tier 1, no revision, and Keys to spend. */
const olderRun = (): Run => {
  const { hitpointsRevision: _revision, ...fresh } = createFreshState();
  let s = {
    ...fresh, runId: RUN_ID, gameModeId: 'vanilla', gameModeLocked: true, lastEvent: null,
    unlocks: { ...fresh.unlocks, skills: { Hitpoints: 1 } },
  } as Run;
  for (let i = 0; i < 3; i++) s = step(s, prepareKeyRollAction(s, 'Quest (Novice)', 50, 1, best)!);
  return s;
};
const spendOnHitpoints = (s: Run, costType: 'key' | 'chaosKey', n: number): Run => {
  for (let i = 0; i < n; i++) {
    s = step(s, { type: 'UNLOCK', payload: { table: TableType.SKILLS, item: 'Hitpoints', costType, cost: 1, revealId: `hp-${costType}-${i}` } });
    s = step(s, { type: 'ACKNOWLEDGE_UNLOCK', payload: s.pendingUnlock!.id });
  }
  return s;
};
const load = (s: Run) => {
  const { lastEvent: _lastEvent, ...saved } = s;
  const loaded = validateAndMigrateSave(JSON.parse(JSON.stringify(saved)), createFreshState());
  if (loaded.ok === false) throw new Error(`save refused: ${loaded.code}`);
  return loaded.state;
};
const audit = (s: GameState) => auditHistory(s.history, resolveModeRules(s.gameModeId, s.customMode), s);

describe('Hitpoints is free', () => {
  it('starts every new run at tier 10, off the Skills table and out of Sacrifice', () => {
    const fresh = createFreshState();
    expect(fresh.unlocks.skills.Hitpoints).toBe(10);
    expect(fresh.hitpointsRevision).toBe(1);
    expect(randomUnlockPool(fresh.unlocks, 'vanilla', 'key', TableType.SKILLS).map(c => c.item)).not.toContain('Hitpoints');
    expect(sacrificeCandidates(fresh.unlocks)).toEqual([]);
  });

  it('pays an older run back the Keys it spent on Hitpoints, once, and the run check still matches', () => {
    const before = spendOnHitpoints(olderRun(), 'key', 2);
    expect(before.unlocks.skills.Hitpoints).toBe(3);
    expect(audit(before).totals.status).toBe('match');

    const loaded = load(before);
    expect(loaded.unlocks.skills.Hitpoints).toBe(10);
    expect(loaded.keys).toBe(before.keys + 2);
    expect(loaded.hitpointsRevision).toBe(1);
    // The history is never rewritten: the run check credits the refund itself.
    expect(loaded.history).toEqual(before.history);
    expect(audit(loaded).verdict).toBe('intact');
    expect(audit(loaded).totals.status).toBe('match');

    // A second load pays nothing more.
    expect(load(loaded as Run).keys).toBe(loaded.keys);
  });

  it('pays each tier back in the Key type it cost', () => {
    const entry = (costType: string, i: number): LogEntry => ({
      id: `u${i}`, timestamp: i, type: 'UNLOCK', message: 'Unlocked Hitpoints', meta: { item: 'Hitpoints', category: TableType.SKILLS, cost: 1, costType },
    });
    expect(hitpointsRefund([entry('key', 1), entry('chaosKey', 2), entry('specialKey', 3), entry('breakthrough', 4), entry('mercy', 5)]))
      .toEqual({ keys: 1, specialKeys: 1, chaosKeys: 1, paidTiers: 3, sacrificedTiers: 0 });
  });

  it('pays nothing for a tier Sacrifice already turned into an Omni-Key', () => {
    const entry = (i: number): LogEntry => ({
      id: `u${i}`, timestamp: i, type: 'UNLOCK', message: 'Unlocked Hitpoints', meta: { item: 'Hitpoints', category: TableType.SKILLS, cost: 1, costType: 'key' },
    });
    const sacrifice: LogEntry = {
      id: 's', timestamp: 9, type: 'ALTAR', message: 'Sacrifice', meta: { ritual: 'SACRIFICE', taken: [{ table: 'skill', name: 'Hitpoints', tier: 3 }] },
    };
    expect(hitpointsRefund([entry(1), entry(2), sacrifice])).toEqual({ keys: 1, specialKeys: 0, chaosKeys: 0, paidTiers: 2, sacrificedTiers: 1 });
  });
});
