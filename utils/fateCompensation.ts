import {
  failureFateForSkillLevel,
  failureFateForSource,
  SKILL_CHAOS_MILESTONES,
} from '../config/economy';
import { DropSource, type FailureFateAward, type GameState, type LogEntry } from '../types';

export const LEGACY_FATE_COMPENSATION_ID = '2026-08-02-weighted-fate';

export interface LegacyFateCompensation {
  chaosKeys: number;
  pityKeys: number;
  fatePoints: number;
}

const LEGACY_PITY_THRESHOLD = 50;
const DROP_SOURCES = new Set<string>(Object.values(DropSource));
const SKILL_LEVEL_SOURCE = / Level (-?\d+)$/;

const validRecordedFate = (entry: LogEntry): number | undefined => {
  const recorded = entry.meta?.fatePointsEarned;
  return typeof recorded === 'number' && Number.isFinite(recorded) && recorded >= 0
    ? recorded
    : undefined;
};

const recognizedFailureFate = (entry: LogEntry): FailureFateAward => {
  const source = entry.source;
  if (typeof source !== 'string') return 1;

  if (DROP_SOURCES.has(source)) {
    return failureFateForSource(source as DropSource);
  }

  if (source.startsWith('Col. Log:')) {
    return failureFateForSource(DropSource.COLLECTION_LOG);
  }

  const skillLevel = source.match(SKILL_LEVEL_SOURCE)?.[1];
  if (skillLevel === undefined) return 1;

  const parsed = Number(skillLevel);
  if (!Number.isFinite(parsed)) return 1;

  return failureFateForSkillLevel(Math.min(99, Math.max(2, parsed)));
};

const replayAward = (entry: LogEntry): number => {
  const recorded = validRecordedFate(entry) ?? 1;
  const weighted = recognizedFailureFate(entry);
  return recorded + (weighted - 1);
};

const reachedChaosMilestones = (levels: Readonly<Record<string, number>>): number =>
  Object.values(levels).reduce((total, rawLevel) => {
    if (!Number.isFinite(rawLevel)) return total;
    const level = Math.min(99, Math.max(1, Math.trunc(rawLevel)));
    return total + SKILL_CHAOS_MILESTONES.filter(milestone => milestone <= level).length;
  }, 0);

export const calculateLegacyFateCompensation = (
  state: Pick<GameState, 'unlocks' | 'history' | 'fatePoints'>,
): LegacyFateCompensation => {
  let fatePoints = 0;
  let pityKeys = 0;

  for (const entry of state.history) {
    if (entry.type === 'ROLL_SUCCESS' || entry.type === 'ROLL_OMNI') {
      fatePoints = 0;
      continue;
    }

    if (entry.type !== 'ROLL_FAIL' && entry.type !== 'PITY') continue;

    fatePoints += replayAward(entry);

    if (entry.type === 'PITY') {
      fatePoints = fatePoints >= LEGACY_PITY_THRESHOLD
        ? fatePoints - LEGACY_PITY_THRESHOLD
        : 0;
      continue;
    }

    const crossings = Math.floor(fatePoints / LEGACY_PITY_THRESHOLD);
    pityKeys += crossings;
    fatePoints -= crossings * LEGACY_PITY_THRESHOLD;
  }

  return {
    chaosKeys: reachedChaosMilestones(state.unlocks.levels),
    pityKeys: Math.max(0, pityKeys),
    fatePoints: Math.max(0, fatePoints),
  };
};
