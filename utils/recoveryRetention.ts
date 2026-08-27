import type { RecoveryCheckpoint } from './recoveryTypes';

const INTERVAL_LIMIT = 6;
const PRIOR_DAY_LIMIT = 7;
const PRE_REPLACEMENT_LIMIT = 4;
const LEGACY_IMPORT_LIMIT = 8;

type RetentionCheckpoint = RecoveryCheckpoint & { isHead?: boolean };

const stableKey = (record: RecoveryCheckpoint): string =>
  `${record.profileId}:${record.persistenceRevision}`;

const compareNewest = (a: RecoveryCheckpoint, b: RecoveryCheckpoint): number => {
  if (a.capturedAt !== b.capturedAt) return b.capturedAt - a.capturedAt;
  if (a.persistenceRevision !== b.persistenceRevision) {
    return b.persistenceRevision - a.persistenceRevision;
  }
  const aKey = stableKey(a);
  const bKey = stableKey(b);
  return aKey < bKey ? -1 : aKey > bKey ? 1 : 0;
};

const localCalendarKey = (timestamp: number): string => {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
};

const previousLocalCalendarKey = (now: number, daysAgo: number): string => {
  const date = new Date(now);
  const previous = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() - daysAgo,
  );
  return `${previous.getFullYear()}-${previous.getMonth() + 1}-${previous.getDate()}`;
};

const newest = (records: readonly RecoveryCheckpoint[], limit: number): RecoveryCheckpoint[] => (
  [...records].sort(compareNewest).slice(0, limit)
);

/**
 * Selects checkpoint keys protected by the retention policy.
 *
 * The caller supplies checkpoints only; the replaceable journal head is not a
 * checkpoint and is therefore never selected as a deletion candidate. A
 * defensive `isHead` marker is also ignored when a repository adapter includes
 * a mixed head/checkpoint list. The legacy-import limit applies to the final
 * union, including legacy records selected by another bucket.
 */
export const selectRetainedCheckpointKeys = (
  records: readonly RecoveryCheckpoint[],
  now: number,
): Set<string> => {
  const checkpoints = records.filter(
    (record): record is RecoveryCheckpoint => !(record as RetentionCheckpoint).isHead,
  );
  const retained = new Set<string>();
  const keep = (selected: readonly RecoveryCheckpoint[]) => {
    for (const record of selected) retained.add(stableKey(record));
  };

  keep(newest(checkpoints.filter(record => record.reason === 'interval'), INTERVAL_LIMIT));

  for (let daysAgo = 1; daysAgo <= PRIOR_DAY_LIMIT; daysAgo += 1) {
    const dayKey = previousLocalCalendarKey(now, daysAgo);
    const selected = checkpoints.filter(record => localCalendarKey(record.capturedAt) === dayKey);
    keep(newest(selected, 1));
  }

  keep(newest(
    checkpoints.filter(record => record.reason === 'pre-replacement'),
    PRE_REPLACEMENT_LIMIT,
  ));
  keep(newest(
    checkpoints.filter(record => record.reason === 'legacy-import'),
    LEGACY_IMPORT_LIMIT,
  ));

  const legacyByKey = new Map<string, RecoveryCheckpoint>();
  for (const record of checkpoints) {
    if (record.reason !== 'legacy-import') continue;
    const key = stableKey(record);
    const current = legacyByKey.get(key);
    if (current === undefined || compareNewest(record, current) < 0) {
      legacyByKey.set(key, record);
    }
  }

  const retainedLegacyKeys = [...retained]
    .filter(key => legacyByKey.has(key))
    .sort((a, b) => compareNewest(legacyByKey.get(a)!, legacyByKey.get(b)!));
  for (const key of retainedLegacyKeys.slice(LEGACY_IMPORT_LIMIT)) {
    retained.delete(key);
  }

  return retained;
};
