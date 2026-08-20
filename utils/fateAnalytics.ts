import type { LogEntry } from '../types';
import { isRollEntry } from './logEntry';
import { ROLL_BUCKETS } from './rollDistribution';

export type AnalyticsRange = 'all' | 'last-30-days' | 'last-100';
export type AnalyticsScope =
  | { kind: 'all' }
  | { kind: 'category'; value: string }
  | { kind: 'source'; value: string };

export interface FateAnalyticsQuery {
  range: AnalyticsRange;
  scope: AnalyticsScope;
  includeLegacyEstimates: boolean;
  now: number;
}

export type AnalyticsOutcome = 'normal-win' | 'omni-win' | 'miss' | 'pity';
export type ProbabilityQuality = 'exact' | 'legacy-estimate' | 'unscoreable';

export interface AnalyticsCoverage {
  attempts: number;
  exactOutcomes: number;
  exactProbabilities: number;
  legacyEstimates: number;
  unscoreableProbabilities: number;
  exactRewardEvents: number;
  unverifiedRewardEvents: number;
  invalidTimestamps: number;
  unknownSources: number;
  inconsistentEntries: number;
}

export interface AnalyticsSummary {
  attempts: number;
  genuineWins: number;
  scoreableAttempts: number;
  scoreableWins: number;
  expectedWins: number;
  variance: number;
  delta: number;
  zScore: number | null;
  verdict: 'Building sample' | 'Blessed by Fate' | 'Running hot' | 'Fate is fair' | 'Running cold' | 'Forsaken by Fate' | null;
  pityInterventions: number;
  omniKeysAwarded: number;
  confirmedStandardKeys: number;
  rewardEvents: number;
  actualRate: number | null;
  expectedRate: number | null;
  currentDrought: number;
  longestDrought: number;
  longestHotStreak: number;
}

export interface TimelinePoint {
  index: number;
  timestamp: number;
  actual: number;
  expected: number;
  lower: number;
  upper: number;
  delta: number;
  outcome: AnalyticsOutcome;
}

export interface HistogramBucket {
  range: string;
  min: number;
  max: number;
  observed: number;
  expected: number | null;
  expectedCoverage: number;
}

export interface AnalyticsAggregate {
  kind: 'source' | 'category';
  label: string;
  attempts: number;
  genuineWins: number;
  scoreableAttempts: number;
  scoreableWins: number;
  expectedWins: number;
  variance: number;
  delta: number;
  zScore: number | null;
  pityInterventions: number;
  confirmedStandardKeys: number;
  probabilityCoverage: number;
  actualRate: number | null;
  expectedRate: number | null;
  sampleLabel: 'Limited sample' | 'Developing sample' | 'Established sample';
}

export interface CalibrationBin {
  range: string;
  attempts: number;
  meanPredictedRate: number;
  actualRate: number;
}

export interface StreakSegment {
  startIndex: number;
  endIndex: number;
  outcome: 'win' | 'miss' | 'pity';
  length: number;
}

export interface KeyAcquisitionPoint {
  date: string;
  normalStandard: number;
  greedStandard: number;
  pityStandard: number;
  omniStandard: number;
  omniKeys: number;
  unverifiedRewardEvents: number;
}

export interface ActivityDay {
  date: string;
  attempts: number;
}

export interface AnalyticsNotableRoll {
  source: string;
  probability: number;
  timestamp: number;
  historyIndex: number;
}

export interface AnalyticsNotables {
  luckiestSuccess: AnalyticsNotableRoll | null;
  cruelestMiss: AnalyticsNotableRoll | null;
  mostProductiveSource: string | null;
  mostActiveDay: ActivityDay | null;
}

export interface FateAnalyticsResult {
  query: FateAnalyticsQuery;
  summary: AnalyticsSummary;
  coverage: AnalyticsCoverage;
  timeline: TimelinePoint[];
  outcomeComposition: Array<{ outcome: AnalyticsOutcome; count: number }>;
  histogram: HistogramBucket[];
  sources: AnalyticsAggregate[];
  categories: AnalyticsAggregate[];
  streaks: StreakSegment[];
  calibration: CalibrationBin[];
  keyAcquisition: KeyAcquisitionPoint[];
  activityDays: ActivityDay[];
  notables: AnalyticsNotables;
  availableSources: string[];
  availableCategories: string[];
  exactOnlyAvailable: boolean;
}

/** "Quest (Novice)" → "Quest"; "Col. Log: Vorki" → "Collection Log"; else as-is. */
export const rollCategory = (source: string): string => {
  if (source.toLowerCase().startsWith('col. log:')) return 'Collection Log';
  const paren = source.indexOf(' (');
  return paren > 0 ? source.slice(0, paren) : source;
};

type RewardKind = 'normal' | 'greed' | 'pity' | 'omni' | 'none';
interface NormalizedRoll {
  entry: LogEntry;
  historyIndex: number;
  source: string;
  category: string;
  outcome: AnalyticsOutcome;
  genuineWin: boolean;
  probability: number | null;
  probabilityQuality: ProbabilityQuality;
  inconsistent: boolean;
  scoreable: boolean;
  validTimestamp: boolean;
  standardKeys: number | null;
  rewardKind: RewardKind | null;
  verifiedReward: boolean;
  drawResolution: 1000 | 10000 | null;
  luckApplied: boolean | null;
}

const UNKNOWN_SOURCE = 'Unknown source';
const REWARD_KINDS: ReadonlySet<RewardKind> = new Set(['normal', 'greed', 'pity', 'omni', 'none']);

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isValidTimestamp = (value: unknown): value is number => isFiniteNumber(value) && !Number.isNaN(new Date(value).getTime());
const own = (value: unknown, key: string): boolean => typeof value === 'object' && value !== null && Object.prototype.hasOwnProperty.call(value, key);
const sourceFor = (entry: LogEntry): string => typeof entry.source === 'string' && entry.source.trim() ? entry.source : UNKNOWN_SOURCE;
const rewardBearing = (roll: Pick<NormalizedRoll, 'outcome' | 'genuineWin'>): boolean => roll.genuineWin || roll.outcome === 'pity';
const confirmedStandardKeysFor = (roll: NormalizedRoll): number =>
  roll.verifiedReward && roll.rewardKind !== 'none' ? roll.standardKeys! : 0;

const sampleLabelFor = (attempts: number): AnalyticsAggregate['sampleLabel'] =>
  attempts < 10 ? 'Limited sample' : attempts < 30 ? 'Developing sample' : 'Established sample';

const verdictFor = (zScore: number, scoreableAttempts: number): AnalyticsSummary['verdict'] => {
  if (scoreableAttempts < 10) return 'Building sample';
  if (zScore >= 2) return 'Blessed by Fate';
  if (zScore >= 1) return 'Running hot';
  if (zScore > -1) return 'Fate is fair';
  if (zScore > -2) return 'Running cold';
  return 'Forsaken by Fate';
};

const localDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const drawCdf = (percentage: number, units: 1000 | 10000, luckApplied: boolean): number => {
  const clamped = Math.min(100, Math.max(0, percentage));
  const oneDraw = Math.floor((clamped / 100) * units) / units;
  return luckApplied ? 1 - (1 - oneDraw) ** 2 : oneDraw;
};

const rewardKindMatchesOutcome = (outcome: AnalyticsOutcome, rewardKind: RewardKind): boolean => {
  if (outcome === 'normal-win') return rewardKind === 'normal' || rewardKind === 'greed';
  if (outcome === 'omni-win') return rewardKind === 'omni';
  if (outcome === 'pity') return rewardKind === 'pity';
  return rewardKind === 'none';
};

const normalizedRoll = (entry: LogEntry, historyIndex: number): NormalizedRoll => {
  const outcome: AnalyticsOutcome = entry.type === 'PITY'
    ? 'pity'
    : entry.type === 'ROLL_OMNI'
      ? 'omni-win'
      : entry.type === 'ROLL_SUCCESS'
        ? 'normal-win'
        : 'miss';
  const genuineWin = outcome === 'normal-win' || outcome === 'omni-win';
  const meta = entry.meta;
  const hasExactProbability = own(meta, 'successProbability');
  const exactProbability = hasExactProbability ? meta?.successProbability : undefined;
  const threshold = entry.threshold;
  let probability: number | null = null;
  let probabilityQuality: ProbabilityQuality = 'unscoreable';
  if (hasExactProbability && isFiniteNumber(exactProbability) && exactProbability >= 0 && exactProbability <= 1) {
    probability = exactProbability;
    probabilityQuality = 'exact';
  } else if (!hasExactProbability && isFiniteNumber(threshold) && threshold >= 0 && threshold <= 100) {
    probability = threshold / 100;
    probabilityQuality = 'legacy-estimate';
  }

  const validComparison = isFiniteNumber(entry.rollValue)
    && isFiniteNumber(threshold)
    && entry.rollValue >= 0
    && entry.rollValue <= 100
    && threshold >= 0
    && threshold <= 100;
  const inconsistent = validComparison && (entry.rollValue <= threshold) !== genuineWin;
  const rawStandardKeys = meta?.standardKeysAwarded;
  const standardKeys = isFiniteNumber(rawStandardKeys)
    && Number.isInteger(rawStandardKeys)
    && rawStandardKeys >= 0
    && rawStandardKeys <= 2
    ? rawStandardKeys
    : null;
  const rawRewardKind = meta?.rewardKind;
  const rewardKind = typeof rawRewardKind === 'string' && REWARD_KINDS.has(rawRewardKind as RewardKind)
    ? rawRewardKind as RewardKind
    : null;
  const rawDrawResolution = meta?.drawResolution;
  const drawResolution = rawDrawResolution === 1000 || rawDrawResolution === 10000 ? rawDrawResolution : null;
  const luckApplied = typeof meta?.luckApplied === 'boolean' ? meta.luckApplied : null;
  const verifiedReward = rewardBearing({ outcome, genuineWin })
    && standardKeys !== null
    && rewardKind !== null
    && rewardKindMatchesOutcome(outcome, rewardKind);

  return {
    entry,
    historyIndex,
    source: sourceFor(entry),
    category: rollCategory(sourceFor(entry)),
    outcome,
    genuineWin,
    probability,
    probabilityQuality,
    inconsistent,
    scoreable: false,
    validTimestamp: isValidTimestamp(entry.timestamp),
    standardKeys,
    rewardKind,
    verifiedReward,
    drawResolution,
    luckApplied,
  };
};

const aggregate = (kind: AnalyticsAggregate['kind'], label: string, rolls: NormalizedRoll[]): AnalyticsAggregate => {
  const scoreable = rolls.filter((roll) => roll.scoreable);
  const genuineWins = rolls.filter((roll) => roll.genuineWin).length;
  const scoreableWins = scoreable.filter((roll) => roll.genuineWin).length;
  const expectedWins = scoreable.reduce((total, roll) => total + roll.probability!, 0);
  const variance = scoreable.reduce((total, roll) => total + roll.probability! * (1 - roll.probability!), 0);
  const zScore = variance > 0 ? (scoreableWins - expectedWins) / Math.sqrt(variance) : null;
  return {
    kind,
    label,
    attempts: rolls.length,
    genuineWins,
    scoreableAttempts: scoreable.length,
    scoreableWins,
    expectedWins,
    variance,
    delta: scoreableWins - expectedWins,
    zScore,
    pityInterventions: rolls.filter((roll) => roll.outcome === 'pity').length,
    confirmedStandardKeys: rolls.reduce((total, roll) => total + confirmedStandardKeysFor(roll), 0),
    probabilityCoverage: rolls.length === 0 ? 0 : scoreable.length / rolls.length,
    actualRate: scoreable.length === 0 ? null : scoreableWins / scoreable.length,
    expectedRate: scoreable.length === 0 ? null : expectedWins / scoreable.length,
    sampleLabel: sampleLabelFor(scoreable.length),
  };
};

export const defaultFateAnalyticsQuery = (now: number): FateAnalyticsQuery => ({
  range: 'all',
  scope: { kind: 'all' },
  includeLegacyEstimates: true,
  now,
});

export const buildFateAnalytics = (history: LogEntry[], query: FateAnalyticsQuery): FateAnalyticsResult => {
  const ordered = history
    .map((entry, historyIndex) => ({
      entry,
      historyIndex,
      sortTimestamp: isValidTimestamp(entry.timestamp) ? entry.timestamp : Number.POSITIVE_INFINITY,
    }))
    .filter(({ entry }) => isRollEntry(entry))
    .sort((a, b) => a.sortTimestamp - b.sortTimestamp || a.historyIndex - b.historyIndex);

  let ranged = ordered.map(({ entry, historyIndex }) => normalizedRoll(entry, historyIndex));
  if (query.range === 'last-30-days') {
    const boundary = new Date(query.now);
    boundary.setHours(0, 0, 0, 0);
    boundary.setDate(boundary.getDate() - 29);
    const boundaryTimestamp = boundary.getTime();
    ranged = ranged.filter((roll) => roll.validTimestamp && roll.entry.timestamp >= boundaryTimestamp);
  } else if (query.range === 'last-100') {
    ranged = ranged.slice(-100);
  }

  const availableSources = [...new Set(ranged.map((roll) => roll.source))].sort((a, b) => a.localeCompare(b));
  const availableCategories = [...new Set(ranged.map((roll) => roll.category))].sort((a, b) => a.localeCompare(b));
  const exactOnlyAvailable = ranged.some((roll) => roll.probabilityQuality === 'exact' && !roll.inconsistent);
  const selected = ranged.filter((roll) => query.scope.kind === 'all'
    || (query.scope.kind === 'source' && roll.source === query.scope.value)
    || (query.scope.kind === 'category' && roll.category === query.scope.value));
  const rolls = selected.map((roll) => ({
    ...roll,
    scoreable: roll.probability !== null
      && !roll.inconsistent
      && (query.includeLegacyEstimates || roll.probabilityQuality === 'exact'),
  }));
  const scoreable = rolls.filter((roll) => roll.scoreable);
  const scoreableWins = scoreable.filter((roll) => roll.genuineWin).length;
  const expectedWins = scoreable.reduce((total, roll) => total + roll.probability!, 0);
  const variance = scoreable.reduce((total, roll) => total + roll.probability! * (1 - roll.probability!), 0);
  const zScore = variance > 0 ? (scoreableWins - expectedWins) / Math.sqrt(variance) : null;

  let actual = 0;
  let expected = 0;
  let runningVariance = 0;
  const timeline = scoreable.map((roll, index) => {
    if (roll.genuineWin) actual += 1;
    expected += roll.probability!;
    runningVariance += roll.probability! * (1 - roll.probability!);
    const margin = 2 * Math.sqrt(runningVariance);
    return {
      index,
      timestamp: roll.entry.timestamp,
      actual,
      expected,
      lower: Math.max(0, expected - margin),
      upper: Math.min(index + 1, expected + margin),
      delta: actual - expected,
      outcome: roll.outcome,
    };
  });

  let drought = 0;
  let longestDrought = 0;
  let hotStreak = 0;
  let longestHotStreak = 0;
  const streaks: StreakSegment[] = [];
  let segment: StreakSegment | null = null;
  for (let index = 0; index < rolls.length; index += 1) {
    const roll = rolls[index];
    const streakOutcome: StreakSegment['outcome'] = roll.genuineWin ? 'win' : roll.outcome === 'pity' ? 'pity' : 'miss';
    if (!segment || segment.outcome !== streakOutcome) {
      if (segment) streaks.push(segment);
      segment = { startIndex: index, endIndex: index, outcome: streakOutcome, length: 1 };
    } else {
      segment.endIndex = index;
      segment.length += 1;
    }
    if (roll.genuineWin) {
      hotStreak += 1;
      drought = 0;
      longestHotStreak = Math.max(longestHotStreak, hotStreak);
    } else {
      drought += 1;
      hotStreak = 0;
      longestDrought = Math.max(longestDrought, drought);
    }
  }
  if (segment) streaks.push(segment);

  const outcomeComposition: FateAnalyticsResult['outcomeComposition'] = ['normal-win', 'omni-win', 'miss', 'pity']
    .map((outcome) => ({ outcome: outcome as AnalyticsOutcome, count: rolls.filter((roll) => roll.outcome === outcome).length }));

  const histogramModels = rolls.filter((roll) => roll.probabilityQuality === 'exact'
    && !roll.inconsistent
    && roll.drawResolution !== null
    && roll.luckApplied !== null);
  const histogram = ROLL_BUCKETS.map(({ range, min, max }, index) => {
    const inBucket = (roll: NormalizedRoll) => isFiniteNumber(roll.entry.rollValue) && roll.entry.rollValue >= min && roll.entry.rollValue <= max;
    const previousMax = index === 0 ? 0 : ROLL_BUCKETS[index - 1].max;
    return {
      range,
      min,
      max,
      observed: rolls.filter(inBucket).length,
      expected: histogramModels.length === 0 ? null : histogramModels.reduce(
        (total, roll) => total + drawCdf(max, roll.drawResolution!, roll.luckApplied!)
          - drawCdf(previousMax, roll.drawResolution!, roll.luckApplied!),
        0,
      ),
      expectedCoverage: histogramModels.length,
    };
  });

  const makeAggregates = (kind: AnalyticsAggregate['kind'], labelFor: (roll: NormalizedRoll) => string) => {
    const groups = new Map<string, NormalizedRoll[]>();
    for (const roll of rolls) {
      const label = labelFor(roll);
      const group = groups.get(label);
      if (group) group.push(roll);
      else groups.set(label, [roll]);
    }
    return [...groups.entries()]
      .map(([label, grouped]) => aggregate(kind, label, grouped))
      .sort((a, b) => b.attempts - a.attempts || a.label.localeCompare(b.label));
  };
  const sources = makeAggregates('source', (roll) => roll.source);
  const categories = makeAggregates('category', (roll) => roll.category);

  const calibration = Array.from({ length: 10 }, (_, index) => {
    const min = index / 10;
    const max = (index + 1) / 10;
    const bin = scoreable.filter((roll) => roll.probability! >= min && (index === 9 ? roll.probability! <= max : roll.probability! < max));
    return {
      range: `${Math.round(min * 100)}–${Math.round(max * 100)}%`,
      attempts: bin.length,
      meanPredictedRate: bin.length === 0 ? 0 : bin.reduce((sum, roll) => sum + roll.probability!, 0) / bin.length * 100,
      actualRate: bin.length === 0 ? 0 : bin.filter((roll) => roll.genuineWin).length / bin.length * 100,
    };
  }).filter((bin) => bin.attempts > 0);

  const activityByDate = new Map<string, number>();
  const keyByDate = new Map<string, KeyAcquisitionPoint>();
  for (const roll of rolls) {
    if (!roll.validTimestamp) continue;
    const date = localDate(roll.entry.timestamp);
    activityByDate.set(date, (activityByDate.get(date) ?? 0) + 1);
    if (!rewardBearing(roll)) continue;
    const point = keyByDate.get(date) ?? {
      date,
      normalStandard: 0,
      greedStandard: 0,
      pityStandard: 0,
      omniStandard: 0,
      omniKeys: 0,
      unverifiedRewardEvents: 0,
    };
    if (roll.verifiedReward) {
      if (roll.rewardKind === 'normal') point.normalStandard += roll.standardKeys!;
      if (roll.rewardKind === 'greed') point.greedStandard += roll.standardKeys!;
      if (roll.rewardKind === 'pity') point.pityStandard += roll.standardKeys!;
      if (roll.rewardKind === 'omni') point.omniStandard += roll.standardKeys!;
    } else {
      point.unverifiedRewardEvents += 1;
    }
    if (roll.outcome === 'omni-win') point.omniKeys += 1;
    keyByDate.set(date, point);
  }
  const activityDays = [...activityByDate.entries()]
    .map(([date, attempts]) => ({ date, attempts }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const keyAcquisition = [...keyByDate.values()].sort((a, b) => a.date.localeCompare(b.date));

  const luckiestSuccess = scoreable.filter((roll) => roll.genuineWin && roll.validTimestamp)
    .reduce<AnalyticsNotableRoll | null>((best, roll) => !best || roll.probability! < best.probability
      ? { source: roll.source, probability: roll.probability!, timestamp: roll.entry.timestamp, historyIndex: roll.historyIndex }
      : best, null);
  const cruelestMiss = scoreable.filter((roll) => !roll.genuineWin && roll.validTimestamp)
    .reduce<AnalyticsNotableRoll | null>((best, roll) => !best || roll.probability! > best.probability
      ? { source: roll.source, probability: roll.probability!, timestamp: roll.entry.timestamp, historyIndex: roll.historyIndex }
      : best, null);
  const sourceFirstAppearance = new Map<string, number>();
  for (const [index, roll] of rolls.entries()) {
    if (!sourceFirstAppearance.has(roll.source)) sourceFirstAppearance.set(roll.source, index);
  }
  const mostProductiveSource = sources.length === 0 ? null : [...sources]
    .sort((a, b) => b.confirmedStandardKeys - a.confirmedStandardKeys
      || b.genuineWins - a.genuineWins
      || sourceFirstAppearance.get(a.label)! - sourceFirstAppearance.get(b.label)!)[0].label;
  const mostActiveDay = activityDays.length === 0 ? null : [...activityDays]
    .sort((a, b) => b.attempts - a.attempts || a.date.localeCompare(b.date))[0];

  const exactRewardEvents = rolls.filter((roll) => rewardBearing(roll) && roll.verifiedReward).length;
  const unverifiedRewardEvents = rolls.filter((roll) => rewardBearing(roll) && !roll.verifiedReward).length;
  const coverage: AnalyticsCoverage = {
    attempts: rolls.length,
    exactOutcomes: rolls.length,
    exactProbabilities: rolls.filter((roll) => roll.probabilityQuality === 'exact').length,
    legacyEstimates: rolls.filter((roll) => roll.probabilityQuality === 'legacy-estimate').length,
    unscoreableProbabilities: rolls.filter((roll) => roll.probabilityQuality === 'unscoreable').length,
    exactRewardEvents,
    unverifiedRewardEvents,
    invalidTimestamps: rolls.filter((roll) => !roll.validTimestamp).length,
    unknownSources: rolls.filter((roll) => roll.source === UNKNOWN_SOURCE).length,
    inconsistentEntries: rolls.filter((roll) => roll.inconsistent).length,
  };
  const summary: AnalyticsSummary = {
    attempts: rolls.length,
    genuineWins: rolls.filter((roll) => roll.genuineWin).length,
    scoreableAttempts: scoreable.length,
    scoreableWins,
    expectedWins,
    variance,
    delta: scoreableWins - expectedWins,
    zScore,
    verdict: zScore === null ? null : verdictFor(zScore, scoreable.length),
    pityInterventions: rolls.filter((roll) => roll.outcome === 'pity').length,
    omniKeysAwarded: rolls.filter((roll) => roll.outcome === 'omni-win').length,
    confirmedStandardKeys: rolls.reduce((total, roll) => total + confirmedStandardKeysFor(roll), 0),
    rewardEvents: exactRewardEvents + unverifiedRewardEvents,
    actualRate: scoreable.length === 0 ? null : scoreableWins / scoreable.length,
    expectedRate: scoreable.length === 0 ? null : expectedWins / scoreable.length,
    currentDrought: drought,
    longestDrought,
    longestHotStreak,
  };

  return {
    query,
    summary,
    coverage,
    timeline,
    outcomeComposition,
    histogram,
    sources,
    categories,
    streaks,
    calibration,
    keyAcquisition,
    activityDays,
    notables: { luckiestSuccess, cruelestMiss, mostProductiveSource, mostActiveDay },
    availableSources,
    availableCategories,
    exactOnlyAvailable,
  };
};
