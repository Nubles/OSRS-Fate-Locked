/**
 * Reading Wise Old Man's hiscores for Sync & Roll's baseline
 * (utils/syncBaseline.ts). Kept apart from the baseline rules so only the
 * Sync & Roll panel loads it.
 */
import { SKILLS_LIST } from '../data/items';

/** One skill as the hiscores report it: its level when ranked, 'unranked', or null when absent. */
export type HiscoreLevel = number | 'unranked' | null;

export interface HiscoreReading {
  skills: Record<string, HiscoreLevel>;
  /** The account's true total level when the hiscores rank it overall; null otherwise. */
  overall: number | null;
}

/** The lowest level a skill can be: 10 for Hitpoints, 1 for the rest. */
export const minSkillLevel = (skill: string): number => (skill === 'Hitpoints' ? 10 : 1);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * One Wise Old Man skill entry. The hiscores list a skill only while the
 * account ranks in it; an unranked skill comes back with rank and experience
 * -1, and its real level is unknown (anything from the minimum up).
 */
export const readHiscoreSkill = (entry: unknown): HiscoreLevel => {
  if (!isRecord(entry)) return null;
  const { level, rank, experience } = entry;
  if ((typeof rank === 'number' && rank < 0) || (typeof experience === 'number' && experience < 0)) return 'unranked';
  if (typeof level !== 'number' || !Number.isFinite(level)) return null;
  if (level <= 0) return 'unranked';
  return Math.min(99, Math.max(1, Math.floor(level)));
};

/** The overall entry's total level, only when the account ranks overall (so it counts unranked skills too). */
export const readHiscoreOverall = (entry: unknown): number | null => {
  if (!isRecord(entry)) return null;
  const { level, rank, experience } = entry;
  if ((typeof rank === 'number' && rank < 0) || (typeof experience === 'number' && experience < 0)) return null;
  return typeof level === 'number' && Number.isFinite(level) && level > 0 ? Math.floor(level) : null;
};

/**
 * The baseline one hiscores reading gives each skill:
 * - ranked: its level;
 * - unranked: the most it can be, never a level that later pays out what the
 *   account already had. When the account ranks overall, its total counts
 *   every skill, so the unranked ones share what the ranked ones don't use;
 *   each is at most that share less the others' minimums (exact when only one
 *   skill is unranked, or when they're all at their minimum). With no overall
 *   rank (a new account), each is at its minimum.
 * - absent (null): unknown; the first fetch that reports it sets it.
 */
export const baselineFromReading = (
  reading: HiscoreReading,
  skills: readonly string[] = SKILLS_LIST,
): Record<string, number | null> => {
  const out: Record<string, number | null> = {};
  const unknown = skills.filter(skill => typeof reading.skills[skill] !== 'number');
  const rankedTotal = skills.reduce((sum, skill) => {
    const level = reading.skills[skill];
    return sum + (typeof level === 'number' ? level : 0);
  }, 0);
  const unknownMinimum = unknown.reduce((sum, skill) => sum + minSkillLevel(skill), 0);
  const share = reading.overall !== null && reading.overall - rankedTotal >= unknownMinimum
    ? reading.overall - rankedTotal
    : null;
  for (const skill of skills) {
    const level = reading.skills[skill];
    if (typeof level === 'number') { out[skill] = level; continue; }
    if (level !== 'unranked') { out[skill] = null; continue; }
    const minimum = minSkillLevel(skill);
    out[skill] = share === null
      ? minimum
      : Math.min(99, Math.max(minimum, share - (unknownMinimum - minimum)));
  }
  return out;
};

