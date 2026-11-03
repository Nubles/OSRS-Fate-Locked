import type { GameState, LogEntry } from '../types';
import { TableType } from '../types';
import { SKILLS_TIER_CAP } from '../config/economy';

/**
 * Hitpoints is free (owner decision, 30 October 2026): every run has it at its
 * top tier, so it is never on the Skills table and its levels never pass a cap.
 * A run from before gets back what it paid for each Hitpoints tier, once, in
 * the currency it paid with, as a retired unlock does (utils/areaUnlockMigration.ts).
 */
export const FREE_HITPOINTS_TIER = SKILLS_TIER_CAP;

export interface HitpointsRefund {
  keys: number;
  specialKeys: number;
  chaosKeys: number;
  /** Hitpoints tiers the history paid for: they are free now. */
  paidTiers: number;
  /** Hitpoints tiers Sacrifice took: the run has them back. */
  sacrificedTiers: number;
}

/**
 * What a run gets back for its Hitpoints tiers. A tier Sacrifice took above
 * the free starting tier already paid an Omni-Key, so it pays nothing more:
 * each one cancels the newest paid tier's refund.
 */
export const hitpointsRefund = (history: readonly LogEntry[]): HitpointsRefund => {
  const paid: Array<'keys' | 'specialKeys' | 'chaosKeys'> = [];
  let sacrificedTiers = 0;
  let sacrificedPaid = 0;
  for (const entry of history) {
    if (entry.type === 'UNLOCK' && entry.meta?.category === TableType.SKILLS && entry.meta?.item === 'Hitpoints') {
      const costType = entry.meta?.costType;
      if (costType === 'key') paid.push('keys');
      else if (costType === 'specialKey') paid.push('specialKeys');
      else if (costType === 'chaosKey') paid.push('chaosKeys');
    } else if (entry.type === 'ALTAR' && entry.meta?.ritual === 'SACRIFICE' && Array.isArray(entry.meta?.taken)) {
      for (const taken of entry.meta.taken as Array<{ table?: unknown; name?: unknown; tier?: unknown }>) {
        if (taken?.table !== 'skill' || taken?.name !== 'Hitpoints') continue;
        sacrificedTiers += 1;
        if (typeof taken.tier === 'number' && taken.tier > 1) sacrificedPaid += 1;
      }
    }
  }
  const refunded = paid.slice(0, Math.max(0, paid.length - sacrificedPaid));
  const count = (counter: 'keys' | 'specialKeys' | 'chaosKeys'): number => refunded.filter(c => c === counter).length;
  return { keys: count('keys'), specialKeys: count('specialKeys'), chaosKeys: count('chaosKeys'), paidTiers: paid.length, sacrificedTiers };
};

/** Called only on validated save data. Never rewrite the integrity history. */
export function migrateFreeHitpoints(state: GameState, maxCounter: number): boolean {
  if (state.hitpointsRevision === 1) return false;
  const refund = hitpointsRefund(state.history);
  state.keys = Math.min(maxCounter, state.keys + refund.keys);
  state.specialKeys = Math.min(maxCounter, state.specialKeys + refund.specialKeys);
  state.chaosKeys = Math.min(maxCounter, state.chaosKeys + refund.chaosKeys);
  state.unlocks.skills = { ...state.unlocks.skills, Hitpoints: FREE_HITPOINTS_TIER };
  // A Hitpoints reveal still waiting was paid for above; there is nothing left to show.
  if (state.pendingUnlock?.table === TableType.SKILLS && state.pendingUnlock.item === 'Hitpoints') {
    delete state.pendingUnlock;
  }
  state.hitpointsRevision = 1;
  return true;
}
