import type { AnalyticsSummary, FateAnalyticsResult } from '../../utils/fateAnalytics';

export type Verdict = AnalyticsSummary['verdict'];

/** Standard normal CDF (Abramowitz & Stegun 7.1.26; absolute error below 1.5e-7). */
export const normalCdf = (z: number): number => {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const poly = ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t;
  const erf = 1 - poly * Math.exp(-x * x);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
};

/**
 * The share of runs with the same odds that would have done no better, as a
 * whole percentage kept inside 1–99 so it never claims certainty.
 */
export const luckPercentile = (zScore: number): number =>
  Math.min(99, Math.max(1, Math.round(normalCdf(zScore) * 100)));

export const percentileSentence = (zScore: number): string => {
  const percentile = luckPercentile(zScore);
  return zScore >= 0
    ? `Luckier than about ${percentile}% of runs with the same odds.`
    : `Unluckier than about ${100 - percentile}% of runs with the same odds.`;
};

export const plural = (count: number, singular: string, pluralForm = `${singular}s`): string =>
  `${new Intl.NumberFormat('en-GB').format(count)} ${count === 1 ? singular : pluralForm}`;

export const signedFixed = (value: number, digits: number): string =>
  `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(digits)}`;

export const formatSigma = (zScore: number | null): string =>
  zScore === null ? '—' : `${signedFixed(zScore, 2)}σ`;

export interface VerdictTone {
  title: string;
  blurb: string;
  text: string;
  border: string;
  glow: string;
}

const TONES: Record<Exclude<Verdict, null>, VerdictTone> = {
  'Blessed by Fate': {
    title: 'Blessed by Fate',
    blurb: 'Fate is smiling on you. You are winning far more often than the odds say.',
    text: 'text-amber-300',
    border: 'border-amber-400/35',
    glow: 'from-amber-500/20',
  },
  'Running hot': {
    title: 'Running hot',
    blurb: 'You are winning more often than the odds say you should.',
    text: 'text-emerald-300',
    border: 'border-emerald-400/30',
    glow: 'from-emerald-500/15',
  },
  'Fate is fair': {
    title: 'Fate is fair',
    blurb: 'Your luck is right about where the odds say it should be.',
    text: 'text-sky-200',
    border: 'border-sky-300/20',
    glow: 'from-sky-400/10',
  },
  'Running cold': {
    title: 'Running cold',
    blurb: 'You are winning a little less often than the odds say, so far.',
    text: 'text-sky-300',
    border: 'border-sky-400/30',
    glow: 'from-sky-500/15',
  },
  'Forsaken by Fate': {
    title: 'Forsaken by Fate',
    blurb: 'Fate has been cruel so far. You are well behind the odds.',
    text: 'text-rose-300',
    border: 'border-rose-400/35',
    glow: 'from-rose-500/20',
  },
  'Building sample': {
    title: 'Building a sample',
    blurb: 'Fate needs at least 10 rolls with known odds before it judges your luck.',
    text: 'text-gray-200',
    border: 'border-white/10',
    glow: 'from-white/5',
  },
};

const NO_VERDICT: VerdictTone = {
  title: 'No verdict yet',
  blurb: 'Every roll so far had a certain outcome, so there is no luck to measure.',
  text: 'text-gray-200',
  border: 'border-white/10',
  glow: 'from-white/5',
};

export const verdictTone = (verdict: Verdict): VerdictTone => (verdict ? TONES[verdict] : NO_VERDICT);

/** A plain sentence that states the win count against expectation. */
export const luckSentence = (summary: AnalyticsSummary): string => {
  const { scoreableAttempts, scoreableWins, expectedWins, delta, attempts } = summary;
  if (scoreableAttempts === 0) return `None of your ${plural(attempts, 'roll')} have known odds, so Fate can't judge them yet.`;
  const knownOdds = scoreableAttempts < attempts ? ' with known odds' : '';
  const gap = Math.abs(delta);
  const standing = gap < 0.05
    ? 'so you are right on expectation'
    : `so you are ${gap.toFixed(1)} ${gap === 1 ? 'win' : 'wins'} ${delta > 0 ? 'ahead' : 'behind'}`;
  const wins = new Intl.NumberFormat('en-GB').format(scoreableWins);
  return `You won ${wins} of ${knownOdds ? '' : 'your '}${plural(scoreableAttempts, 'roll')}${knownOdds}. Fate expected about ${expectedWins.toFixed(1)}, ${standing}.`;
};

/** Short text for sharing in a chat, built from the same figures as the page. */
export const shareableSummary = (analytics: FateAnalyticsResult): string => {
  const { summary, notables } = analytics;
  const tone = verdictTone(summary.verdict);
  const lines = [
    `Fate Locked luck report: ${tone.title} (${formatSigma(summary.zScore)})`,
    `${plural(summary.scoreableWins, 'win')} from ${plural(summary.scoreableAttempts, 'roll')}, ${summary.expectedWins.toFixed(1)} expected (${signedFixed(summary.delta, 1)}).`,
  ];
  if (summary.zScore !== null && summary.verdict !== 'Building sample') lines.push(percentileSentence(summary.zScore));
  if (notables.luckiestSuccess) lines.push(`Luckiest roll: ${notables.luckiestSuccess.source} at ${(notables.luckiestSuccess.probability * 100).toFixed(1)}%.`);
  lines.push(`Longest drought: ${plural(summary.longestDrought, 'miss', 'misses')} in a row.`);
  return lines.join('\n');
};

const shortDay = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
const fullDay = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export const parseLocalDay = (value: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatShortDay = (value: string): string => {
  const date = parseLocalDay(value);
  return date ? shortDay.format(date) : value;
};

/** "29 May – 27 Aug 2026" for the selection's first and last active days. */
export const selectionDateRange = (analytics: FateAnalyticsResult): string | null => {
  let first: string | null = null;
  let last: string | null = null;
  for (const day of analytics.activityDays) {
    if (first === null || day.date < first) first = day.date;
    if (last === null || day.date > last) last = day.date;
  }
  const start = first ? parseLocalDay(first) : null;
  const end = last ? parseLocalDay(last) : null;
  if (!start || !end) return null;
  if (first === last) return fullDay.format(end);
  const startLabel = start.getFullYear() === end.getFullYear() ? shortDay.format(start) : fullDay.format(start);
  return `${startLabel} – ${fullDay.format(end)}`;
};
