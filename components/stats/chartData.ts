import type { ActivityDay, TimelinePoint } from '../../utils/fateAnalytics';

/** Limits only the points sent to the chart renderer; analytics remain untouched. */
export const downsampleTimeline = (points: TimelinePoint[], maxPoints: number): TimelinePoint[] => {
  const cap = Math.floor(maxPoints);
  if (points.length <= cap) return points;
  if (cap <= 0) return [];
  if (cap === 1) return [points[0]];

  const sampled = Array.from({ length: cap }, (_, position) => {
    const index = Math.round(position * (points.length - 1) / (cap - 1));
    return points[index];
  });
  return sampled.filter((point, index) => index === 0 || point !== sampled[index - 1]);
};

const parseLocalDate = (value: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.getFullYear() === Number(match[1])
    && date.getMonth() === Number(match[2]) - 1
    && date.getDate() === Number(match[3])
    ? date
    : null;
};

const localDateString = (date: Date): string => [
  String(date.getFullYear()).padStart(4, '0'),
  String(date.getMonth() + 1).padStart(2, '0'),
  String(date.getDate()).padStart(2, '0'),
].join('-');

/** Builds a continuous window using local calendar days rather than fixed millisecond offsets. */
export const buildCalendarGrid = (
  days: ActivityDay[],
  endDate: string,
  dayCount = 91,
): ActivityDay[] => {
  const end = parseLocalDate(endDate);
  const count = Math.max(0, Math.floor(dayCount));
  if (!end || count === 0) return [];
  const attemptsByDate = new Map(days.map(day => [day.date, day.attempts]));
  const start = new Date(end);
  start.setDate(start.getDate() - count + 1);

  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const value = localDateString(date);
    return { date: value, attempts: attemptsByDate.get(value) ?? 0 };
  });
};
