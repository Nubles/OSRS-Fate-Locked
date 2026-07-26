import type { LogEntry } from '../types';
import { rollCategory } from './fateReport';
import { isRollEntry } from './logEntry';

export type EvidenceStage = 'early' | 'mid' | 'late';

export interface KeyEconomyEvidenceInput {
  reportId: string;
  gameMode: string;
  stage: EvidenceStage;
  observedHours: number;
  appVersion: string;
}

export interface DroughtSummary {
  longestFailures: number;
  activeFailures: number;
}

export interface SourceEvidence {
  source: string;
  category: string;
  attempts: number;
  successes: number;
  expectedSuccesses: number;
  fatePoints: number;
  drought: DroughtSummary;
}

export interface KeyEconomyEvidenceReport {
  schemaVersion: 1;
  reportId: string;
  gameMode: string;
  stage: EvidenceStage;
  observedHours: number;
  appVersion: string;
  totals: {
    attempts: number;
    successes: number;
    expectedSuccesses: number;
    fatePoints: number;
    drought: DroughtSummary;
  };
  sources: SourceEvidence[];
}

interface SourceAccumulator {
  source: string;
  category: string;
  attempts: number;
  successes: number;
  expectedSuccesses: number;
  fatePoints: number;
  rolls: LogEntry[];
}

export const stageForCompletion = (percent: number): EvidenceStage => {
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new Error('completion percent must be between 0 and 100');
  }
  if (percent < 25) return 'early';
  if (percent < 75) return 'mid';
  return 'late';
};

const validateInput = (input: KeyEconomyEvidenceInput): void => {
  if (!input.reportId.trim()) throw new Error('reportId is required');
  if (!input.gameMode.trim()) throw new Error('gameMode is required');
  if (!input.appVersion.trim()) throw new Error('appVersion is required');
  if (!['early', 'mid', 'late'].includes(input.stage)) {
    throw new Error('stage is invalid');
  }
  if (!Number.isFinite(input.observedHours) || input.observedHours <= 0) {
    throw new Error('observedHours must be a positive finite number');
  }
};

const scoreableRolls = (history: readonly LogEntry[]): LogEntry[] =>
  history.filter(entry =>
    isRollEntry(entry)
    && typeof entry.threshold === 'number'
    && entry.threshold > 0
    && Boolean(entry.source)
  );

const fateEarned = (entry: LogEntry): number => {
  const exact = entry.meta?.fatePointsEarned;
  if (typeof exact === 'number' && Number.isFinite(exact) && exact >= 0) {
    return exact;
  }
  return entry.type === 'ROLL_FAIL' || entry.type === 'PITY' ? 1 : 0;
};

const droughtSummary = (rolls: readonly LogEntry[]): DroughtSummary => {
  let longestFailures = 0;
  let current = 0;
  for (const roll of rolls) {
    if (roll.result === 'FAIL') {
      current += 1;
      longestFailures = Math.max(longestFailures, current);
    } else {
      current = 0;
    }
  }
  return { longestFailures, activeFailures: current };
};

export function buildKeyEconomyEvidence(
  history: readonly LogEntry[],
  input: KeyEconomyEvidenceInput,
): KeyEconomyEvidenceReport {
  validateInput(input);

  // Timestamps determine drought sequence internally, but are never exported.
  const rolls = [...scoreableRolls(history)].sort((a, b) => a.timestamp - b.timestamp);
  const bySource = new Map<string, SourceAccumulator>();
  let successes = 0;
  let expectedSuccesses = 0;
  let fatePoints = 0;

  for (const roll of rolls) {
    const source = roll.source!;
    const expected = Math.min(roll.threshold!, 100) / 100;
    const earned = fateEarned(roll);
    const accumulator = bySource.get(source) ?? {
      source,
      category: rollCategory(source),
      attempts: 0,
      successes: 0,
      expectedSuccesses: 0,
      fatePoints: 0,
      rolls: [],
    };

    accumulator.attempts += 1;
    accumulator.expectedSuccesses += expected;
    accumulator.fatePoints += earned;
    accumulator.rolls.push(roll);
    if (roll.result === 'SUCCESS') {
      accumulator.successes += 1;
      successes += 1;
    }

    expectedSuccesses += expected;
    fatePoints += earned;
    bySource.set(source, accumulator);
  }

  const sources = [...bySource.values()]
    .map(({ rolls: sourceRolls, ...source }) => ({
      ...source,
      drought: droughtSummary(sourceRolls),
    }))
    .sort((a, b) => a.source.localeCompare(b.source));

  return {
    schemaVersion: 1,
    reportId: input.reportId,
    gameMode: input.gameMode,
    stage: input.stage,
    observedHours: input.observedHours,
    appVersion: input.appVersion,
    totals: {
      attempts: rolls.length,
      successes,
      expectedSuccesses,
      fatePoints,
      drought: droughtSummary(rolls),
    },
    sources,
  };
}
