import { levelsToLog, MAX_SKILL_LEVEL, type LevelBatchSummary } from './setLevel';

// Set level's words: what a typed level means and the summary line. Apart
// from utils/setLevel.ts so they load with the skill detail, not with the
// app's first screen.

export type SetLevelPlan =
  | { ok: true; from: number; to: number; count: number }
  | { ok: false; reason: string };

/** What typing `input` as a skill's new level would log, or why it logs nothing. */
export const planSetLevel = (currentLevel: number, tier: number, input: string | number): SetLevelPlan => {
  const from = Math.max(1, Math.trunc(currentLevel) || 1);
  if (tier < 1) return { ok: false, reason: 'Unlock a tier of this skill first.' };
  if (from >= MAX_SKILL_LEVEL) return { ok: false, reason: 'Already level 99.' };
  const text = String(input).trim();
  if (text === '') return { ok: false, reason: `Type a level from ${from + 1} to 99.` };
  const to = Number(text);
  if (!Number.isInteger(to)) return { ok: false, reason: `Type a whole level from ${from + 1} to 99.` };
  if (to > MAX_SKILL_LEVEL) return { ok: false, reason: 'The highest level is 99.' };
  if (to <= from) return { ok: false, reason: `Already level ${from}. Levels can't go down.` };
  // The rule itself is levelsToLog's, the one GameContext.setSkillLevel applies.
  const count = levelsToLog(from, tier, to);
  return count > 0 ? { ok: true, from, to, count } : { ok: false, reason: `Type a level from ${from + 1} to 99.` };
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** One line for the whole run: "12 levels logged: 2 Keys found, +40 Fate". */
export const formatLevelBatchSummary = (summary: LevelBatchSummary): string => {
  const parts: string[] = [];
  if (summary.keys > 0) parts.push(`${plural(summary.keys, 'Key')} found`);
  if (summary.omniKeys > 0) parts.push(`${plural(summary.omniKeys, 'Omni-Key')} found`);
  if (summary.chaosKeys > 0) parts.push(plural(summary.chaosKeys, 'Chaos Key'));
  if (summary.fate > 0) parts.push(`+${summary.fate} Fate`);
  if (summary.noRoll > 0) parts.push(`${summary.noRoll} past the tier cap with no roll`);
  if (parts.length === 0) parts.push('no Keys this time');
  return `${plural(summary.levels, 'level')} logged: ${parts.join(', ')}`;
};
