import { LogEntry } from '../types';

export interface RollBucket {
  range: string;
  count: number;
  min: number;
}

export const ROLL_BUCKETS = Array.from({ length: 20 }, (_, index) => ({
  min: index === 0 ? 0.01 : index * 5 + 0.01,
  max: (index + 1) * 5,
  range: `${(index === 0 ? 0.01 : index * 5 + 0.01).toFixed(2)}–${((index + 1) * 5).toFixed(2)}`,
}));

export const buildRollDistribution = (
  rolls: Array<Pick<LogEntry, 'rollValue'>>,
): RollBucket[] => {
  const buckets = ROLL_BUCKETS.map(({ range, min }) => ({ range, count: 0, min }));

  for (const roll of rolls) {
    if (typeof roll.rollValue !== 'number') continue;
    const index = Math.min(19, Math.max(0, Math.ceil(roll.rollValue / 5) - 1));
    buckets[index].count += 1;
  }

  return buckets;
};
