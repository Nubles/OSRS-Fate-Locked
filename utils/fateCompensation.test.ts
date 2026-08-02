import { describe, expect, it } from 'vitest';
import { DropSource, type GameState, type LogEntry } from '../types';
import {
  calculateLegacyFateCompensation,
  LEGACY_FATE_COMPENSATION_ID,
} from './fateCompensation';

type CompensationState = Pick<GameState, 'unlocks' | 'history' | 'fatePoints'>;

const emptyUnlocks = (): GameState['unlocks'] => ({
  equipment: {},
  skills: {},
  levels: {},
  regions: [],
  chunks: [],
  mobility: [],
  arcana: [],
  housing: [],
  merchants: [],
  minigames: [],
  bosses: [],
  storage: [],
  guilds: [],
  farming: [],
  slayerUnlocks: [],
  banks: [],
  quests: [],
  diaries: [],
  cas: [],
  completedTasks: [],
  collectionLog: {},
});

const state = (
  history: LogEntry[] = [],
  levels: Record<string, number> = {},
  fatePoints = 0,
): CompensationState => ({
  unlocks: { ...emptyUnlocks(), levels },
  history,
  fatePoints,
});

let nextEntryId = 0;
const entry = (
  type: LogEntry['type'],
  source?: string,
  meta?: LogEntry['meta'],
): LogEntry => ({
  id: `entry-${nextEntryId++}`,
  timestamp: nextEntryId,
  type,
  source,
  message: type,
  meta,
});

const failures = (count: number, source: string): LogEntry[] =>
  Array.from({ length: count }, () => entry('ROLL_FAIL', source));

describe('calculateLegacyFateCompensation', () => {
  it('uses the frozen level map for every reached Chaos milestone', () => {
    const historicalRandomChaos = entry('LEVEL_UP', undefined, {
      chaosKeyAwarded: true,
      chaosKeysAwarded: 1,
    });

    const result = calculateLegacyFateCompensation(
      state([historicalRandomChaos], { Attack: 30, Strength: 80 }),
    );

    expect(result.chaosKeys).toBe(7);
  });

  it('ignores unknown and obsolete level keys when counting Chaos milestones', () => {
    const result = calculateLegacyFateCompensation(
      state([], { Attack: 30, 'Removed Skill': 99, 'Legacy Total': 99 }),
    );

    expect(result.chaosKeys).toBe(1);
  });

  it('converts weighted legacy failures into missed Pity Keys with overflow', () => {
    const history = [
      ...failures(40, DropSource.QUEST_NOVICE),
      ...failures(5, DropSource.QUEST_MASTER),
    ];

    expect(calculateLegacyFateCompensation(state(history, {}, 45))).toMatchObject({
      pityKeys: 1,
      fatePoints: 5,
    });
  });

  it.each(['ROLL_SUCCESS', 'ROLL_OMNI'] as const)(
    '%s resets the replay bar',
    successType => {
      const history = [
        ...failures(49, DropSource.QUEST_NOVICE),
        entry(successType, DropSource.QUEST_NOVICE),
        entry('ROLL_FAIL', DropSource.QUEST_MASTER),
      ];

      expect(calculateLegacyFateCompensation(state(history))).toMatchObject({
        pityKeys: 0,
        fatePoints: 3,
      });
    },
  );

  it('uses an existing Pity Key to consume one replay crossing', () => {
    const history = [
      ...failures(49, DropSource.QUEST_NOVICE),
      entry('PITY', DropSource.QUEST_NOVICE),
    ];

    expect(calculateLegacyFateCompensation(state(history))).toMatchObject({
      pityKeys: 0,
      fatePoints: 0,
    });
  });

  it('retains weighted overflow when an existing Pity Key consumes a crossing', () => {
    const history = [
      ...failures(49, DropSource.QUEST_NOVICE),
      entry('PITY', DropSource.QUEST_MASTER),
    ];

    expect(calculateLegacyFateCompensation(state(history))).toMatchObject({
      pityKeys: 0,
      fatePoints: 2,
    });
  });

  it('resets the replay bar when an existing Pity follows a new crossing', () => {
    const history = [
      ...failures(49, DropSource.QUEST_NOVICE),
      entry('ROLL_FAIL', DropSource.QUEST_MASTER),
      entry('PITY', DropSource.QUEST_MASTER),
    ];

    expect(calculateLegacyFateCompensation(state(history))).toMatchObject({
      pityKeys: 1,
      fatePoints: 0,
    });
  });

  it('preserves a recorded Greed refund while replacing only the old base award', () => {
    const greedFailure = entry('ROLL_FAIL', DropSource.QUEST_MASTER, {
      fatePointsEarned: 9,
    });

    expect(calculateLegacyFateCompensation(state([greedFailure]))).toMatchObject({
      pityKeys: 0,
      fatePoints: 11,
    });
  });

  it('keeps an unknown legacy source at its original +1 Fate', () => {
    const unknownFailure = entry('ROLL_FAIL', 'Mystery Event');

    expect(calculateLegacyFateCompensation(state([unknownFailure]))).toMatchObject({
      pityKeys: 0,
      fatePoints: 1,
    });
  });

  it('weights a legacy skill failure from its attained level suffix', () => {
    const skillFailure = entry('ROLL_FAIL', 'Attack Level 80');

    expect(calculateLegacyFateCompensation(state([skillFailure]))).toMatchObject({
      pityKeys: 0,
      fatePoints: 3,
    });
  });

  it('keeps an unknown Level-suffixed legacy source at its original +1 Fate', () => {
    const unknownLevelFailure = entry('ROLL_FAIL', 'Mystery Level 80');

    expect(calculateLegacyFateCompensation(state([unknownLevelFailure]))).toMatchObject({
      pityKeys: 0,
      fatePoints: 1,
    });
  });

  it.each([
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    -4,
    1.5,
    2_147_483_648,
    Number.MAX_SAFE_INTEGER + 1,
  ])(
    'falls back conservatively for invalid recorded Fate metadata: %s',
    fatePointsEarned => {
      const invalidMetadata = entry('ROLL_FAIL', 'Mystery Event', { fatePointsEarned });

      expect(calculateLegacyFateCompensation(state([invalidMetadata]))).toMatchObject({
        pityKeys: 0,
        fatePoints: 1,
      });
    },
  );


  it('bounds replayed Pity Key compensation at the save counter limit', () => {
    const result = calculateLegacyFateCompensation(state(
      failures(51, DropSource.QUEST_MASTER).map(failure => ({
        ...failure,
        meta: { fatePointsEarned: 2_147_483_647 },
      })),
    ));

    expect(result).toMatchObject({
      pityKeys: 2_147_483_647,
      fatePoints: 49,
    });
  });

  it('bounds replayed Fate compensation at the save counter limit', () => {
    const result = calculateLegacyFateCompensation(state([
      entry('PITY', DropSource.QUEST_MASTER, { fatePointsEarned: 2_147_483_647 }),
      entry('PITY', DropSource.QUEST_MASTER, { fatePointsEarned: 2_147_483_647 }),
    ]));

    expect(result).toMatchObject({
      pityKeys: 0,
      fatePoints: 2_147_483_647,
    });
  });
  it('returns zero compensation without history or reached milestones', () => {
    expect(calculateLegacyFateCompensation(state())).toEqual({
      chaosKeys: 0,
      pityKeys: 0,
      fatePoints: 0,
    });
  });

  it('exports the release identity used to freeze the migration result', () => {
    expect(LEGACY_FATE_COMPENSATION_ID).toBe('2026-08-02-weighted-fate');
  });
});
