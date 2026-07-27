import { CA_DATA } from '../data/caData';
import { ALL_CA_TASKS, CATask } from '../data/caTasks';
import type { CompletionResult } from './journalCompletion';

export const CA_TIER_ORDER = [
  'Easy',
  'Medium',
  'Hard',
  'Elite',
  'Master',
  'Grandmaster',
] as const;

export type CATierId = (typeof CA_TIER_ORDER)[number];

export const CA_TASK_POINTS: Record<CATierId, number> = {
  Easy: 1,
  Medium: 2,
  Hard: 3,
  Elite: 4,
  Master: 5,
  Grandmaster: 6,
};

export const isCATierId = (tierId: string): tierId is CATierId =>
  CA_TIER_ORDER.some(tier => tier === tierId);

export const completedCAPoints = (
  completedIds: readonly string[],
  tasks: readonly Pick<CATask, 'id' | 'tierId'>[] = ALL_CA_TASKS,
): number => {
  const done = new Set(completedIds);
  return tasks.reduce((sum, task) => {
    if (!done.has(task.id) || !isCATierId(task.tierId)) return sum;
    return sum + CA_TASK_POINTS[task.tierId];
  }, 0);
};

export const earnedCATiers = (
  points: number,
  stored: readonly string[] = [],
): CATierId[] => {
  const sticky = new Set(stored);
  for (const tier of CA_TIER_ORDER) {
    if (points >= CA_DATA[tier].pointsRequired) sticky.add(tier);
  }
  return CA_TIER_ORDER.filter(tier => sticky.has(tier));
};

export const newlyEarnedCATiers = (
  points: number,
  stored: readonly string[],
): CATierId[] => {
  const previous = new Set(stored);
  return earnedCATiers(points, stored).filter(tier => !previous.has(tier));
};

export const caTierCompletionDecision = (
  tierId: string,
  points: number,
  stored: readonly string[],
): CompletionResult => {
  const tier = CA_DATA[tierId];
  if (!tier) return { ok: false, reason: 'Unknown Combat Achievement tier' };
  if (stored.includes(tierId)) return { ok: false, reason: 'Already completed' };
  if (points < tier.pointsRequired) {
    return {
      ok: false,
      reason: `Requires ${tier.pointsRequired} Combat Achievement points`,
    };
  }
  return { ok: true };
};
