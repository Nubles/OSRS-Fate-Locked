import { LogEntry } from '../types';

export interface RollBucket {
  range: string;
  count: number;
  min: number;
}

export const buildRollDistribution = (
  rolls: Array<Pick<LogEntry, 'rollValue'>>,
): RollBucket[] => {
  const buckets = Array.from({ length: 20 }, (_, index) => {
    const min = index === 0 ? 0.1 : index * 5 + 0.1;
    const max = (index + 1) * 5;
    return {
      range: `${min.toFixed(1)}–${max.toFixed(1)}`,
      count: 0,
      min,
    };
  });

  for (const roll of rolls) {
    if (typeof roll.rollValue !== 'number') continue;
    const index = Math.min(19, Math.max(0, Math.ceil(roll.rollValue / 5) - 1));
    buckets[index].count += 1;
  }

  return buckets;
};
