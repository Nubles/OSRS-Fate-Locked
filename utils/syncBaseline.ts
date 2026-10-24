/**
 * Sync & Roll's baseline (critique GP-1, October 2026).
 *
 * When a run links an OSRS name (its first link, and every name change), the
 * hiscores it reads at that moment become the run's baseline: the levels the
 * account already had. Sync & Roll rolls only levels above both the baseline
 * and the run's own recorded level, and RuneLite's detected level-ups take
 * the same baseline. Everything else (Chunked's tier cap included) stays the
 * manual level-up's rule.
 *
 * A run linked before baselines existed has none (syncBaseline undefined), so
 * it rolls as it always did. A baseline
 * that is still being read (a name change whose fetch hasn't worked yet) or a
 * skill the hiscores didn't report rolls nothing until a fetch reads it.
 */
import { SKILLS_LIST } from '../data/items';
import type { SyncBaseline } from '../types';
import type { HiscoreLevel } from './hiscoreReading';
import { normalizeAccountName } from './accountName';

export type { SyncBaseline };
export type { HiscoreLevel };

/** A baseline waiting for its first reading of `account` (a new link or a name change). */
export const pendingBaseline = (account: string): SyncBaseline => ({ account });

/**
 * The run's baseline after a successful hiscores reading of `account`
 * (`fresh`: hiscoreReading.ts baselineFromReading's answer). A pending
 * baseline (or one for another name) takes the whole reading; a taken one
 * only fills skills it couldn't read before. A run with no baseline (linked
 * before baselines), and a reading of a name other than the run's, change
 * nothing. Anything but a level from 1 to 99 counts as unknown.
 */
export const recordBaseline = (
  current: SyncBaseline | undefined,
  linkedAccount: string | undefined,
  account: string,
  fresh: Record<string, number | null>,
  now: number,
): SyncBaseline | undefined => {
  if (!current || !linkedAccount) return current;
  if (normalizeAccountName(linkedAccount) !== normalizeAccountName(account)) return current;
  const read = (skill: string): number | null => {
    const level = fresh[skill];
    return Number.isSafeInteger(level) && (level as number) >= 1 && (level as number) <= 99 ? level as number : null;
  };
  if (!current.levels || normalizeAccountName(current.account) !== normalizeAccountName(account)) {
    return { account: linkedAccount, levels: Object.fromEntries(SKILLS_LIST.map(skill => [skill, read(skill)])), takenAt: now };
  }
  let changed = false;
  const levels = { ...current.levels };
  for (const skill of SKILLS_LIST) {
    if (typeof levels[skill] === 'number' || read(skill) === null) continue;
    levels[skill] = read(skill);
    changed = true;
  }
  return changed ? { ...current, levels } : current;
};

/**
 * The baseline that applies to one skill: a level, null while it is unknown
 * (nothing rolls), or undefined for a run linked before baselines (none).
 */
export const skillBaseline = (
  baseline: SyncBaseline | undefined,
  linkedAccount: string | undefined,
  skill: string,
): number | null | undefined => {
  if (!baseline) return undefined;
  if (!baseline.levels || !linkedAccount) return null;
  if (normalizeAccountName(baseline.account) !== normalizeAccountName(linkedAccount)) return null;
  const level = baseline.levels[skill];
  return typeof level === 'number' ? level : null;
};

/** Why a skill the account is ahead in rolls nothing (more) now. */
export type SyncHold = 'locked' | 'unranked' | 'linked' | null;

export interface SyncSkillPlan {
  /** The run's recorded level now. */
  current: number;
  /** The level the run records, without a roll, before the first new level rolls (the baseline); null when none is needed. */
  catchUpTo: number | null;
  /** The levels from + 1 … to level up, one at a time as the manual button does; count is 0 when none do. */
  from: number;
  to: number;
  count: number;
  /** Why the account's levels above the run's don't roll, if they don't. */
  hold: SyncHold;
}

/**
 * Which of a skill's levels Sync & Roll levels up: those above both the run's
 * level and the baseline, up to the hiscores level. Each goes through the
 * manual level-up, so its mode's rules (Chunked's tier cap) apply as before.
 */
export const planSkillSync = (input: {
  tracker: number;
  tier: number;
  hiscore: HiscoreLevel;
  /** skillBaseline's answer: a level, null when unknown, undefined when the run has none. */
  baseline: number | null | undefined;
}): SyncSkillPlan => {
  const current = Math.max(1, input.tracker);
  const none = (hold: SyncHold): SyncSkillPlan => ({ current, catchUpTo: null, from: current, to: current, count: 0, hold });
  if (typeof input.hiscore !== 'number') return none(input.hiscore === 'unranked' ? 'unranked' : null);
  if (input.hiscore <= current) return none(null);
  if (input.tier < 1) return none('locked');
  if (input.baseline === null) return none('linked');
  const floor = Math.max(current, input.baseline ?? current);
  const to = Math.min(input.hiscore, 99);
  if (to <= floor) return none('linked');
  return { current, catchUpTo: floor > current ? floor : null, from: floor, to, count: to - floor, hold: null };
};

export interface DetectedLevelPlan {
  /** Why the level rolls nothing; null when it rolls as the manual rules allow. */
  hold: 'recorded' | 'linked' | null;
  /** The level the event's levels count from (the run's, or the baseline's when higher). */
  from: number;
}

/**
 * A RuneLite-detected level-up to `level`: a level at or below the run's or
 * the baseline's rolls nothing, and only levels above both count for Chaos
 * milestones. With the baseline still unknown, only the event's own level
 * counts. The mode's own rules (Chunked's tier cap) are the caller's.
 */
export const planDetectedLevel = (input: {
  tracker: number;
  level: number;
  baseline: number | null | undefined;
}): DetectedLevelPlan => {
  const tracker = Math.max(1, input.tracker);
  if (input.level <= tracker) return { hold: 'recorded', from: tracker };
  if (typeof input.baseline === 'number' && input.level <= input.baseline) return { hold: 'linked', from: tracker };
  return { hold: null, from: Math.max(tracker, input.baseline === null ? input.level - 1 : input.baseline ?? tracker) };
};
