import { describe, expect, it } from 'vitest';
import { selectRetainedCheckpointKeys } from './recoveryRetention';
import type { RecoveryCheckpoint } from './recoveryTypes';

const NOW = new Date(2026, 7, 25, 12, 0, 0, 0).getTime();

const localDay = (daysFromNow: number, hour: number): number =>
  new Date(2026, 7, 25 + daysFromNow, hour, 0, 0, 0).getTime();

const checkpoint = (
  persistenceRevision: number,
  capturedAt: number,
  reason: RecoveryCheckpoint['reason'] = 'interval',
  profileId = 'alpha',
): RecoveryCheckpoint => ({
  profileId,
  persistenceRevision,
  runId: 'run-alpha',
  runRevision: persistenceRevision,
  capturedAt,
  checksum: persistenceRevision.toString(16).padStart(64, '0'),
  data: JSON.stringify({ persistenceRevision }),
  reason,
});

type RetentionFixture = RecoveryCheckpoint & { isHead?: boolean };

describe('recovery retention', () => {
  it('keeps six newest intervals and the newest checkpoint from each prior local day', () => {
    const records: RetentionFixture[] = [
      checkpoint(31, localDay(0, 11)),
      checkpoint(30, localDay(0, 10)),
      checkpoint(29, localDay(0, 9)),
      checkpoint(28, localDay(0, 8)),
      checkpoint(27, localDay(0, 7)),
      checkpoint(26, localDay(0, 6)),
      checkpoint(25, localDay(0, 5)),
      checkpoint(20, localDay(-1, 22), 'session-start'),
      checkpoint(19, localDay(-1, 18), 'session-start'),
      checkpoint(12, localDay(-2, 22), 'session-start'),
      checkpoint(11, localDay(-2, 18), 'session-start'),
      checkpoint(7, localDay(-3, 22), 'session-start'),
      checkpoint(6, localDay(-3, 18), 'session-start'),
    ];

    expect(selectRetainedCheckpointKeys(records, NOW)).toEqual(new Set([
      'alpha:31', 'alpha:30', 'alpha:29', 'alpha:28', 'alpha:27', 'alpha:26',
      'alpha:20', 'alpha:12', 'alpha:7',
    ]));
  });

  it('keeps four pre-replacement records, caps legacy imports, deduplicates overlap, and excludes a head marker', () => {
    const records: RetentionFixture[] = [
      checkpoint(40, localDay(0, 11), 'pre-replacement'),
      checkpoint(39, localDay(0, 10), 'pre-replacement'),
      checkpoint(38, localDay(0, 9), 'pre-replacement'),
      checkpoint(37, localDay(0, 8), 'pre-replacement'),
      checkpoint(36, localDay(0, 7), 'pre-replacement'),
      checkpoint(18, localDay(-1, 11), 'legacy-import'),
      checkpoint(17, localDay(-1, 10), 'legacy-import'),
      checkpoint(16, localDay(-1, 9), 'legacy-import'),
      checkpoint(15, localDay(-1, 8), 'legacy-import'),
      checkpoint(14, localDay(-1, 7), 'legacy-import'),
      checkpoint(13, localDay(-1, 6), 'legacy-import'),
      checkpoint(12, localDay(-1, 5), 'legacy-import'),
      checkpoint(11, localDay(-1, 4), 'legacy-import'),
      checkpoint(10, localDay(-1, 3), 'legacy-import'),
      // This row is the same logical checkpoint as the legacy record above;
      // a retention set must contain the stable key only once.
      checkpoint(12, localDay(-1, 5), 'interval'),
      // A journal head is not a checkpoint deletion candidate.
      { ...checkpoint(99, localDay(0, 12), 'session-start'), isHead: true },
    ];

    const retained = selectRetainedCheckpointKeys(records, NOW);

    expect(retained).toEqual(new Set([
      'alpha:40', 'alpha:39', 'alpha:38', 'alpha:37',
      'alpha:18', 'alpha:17', 'alpha:16', 'alpha:15',
      'alpha:14', 'alpha:13', 'alpha:12', 'alpha:11',
    ]));
    expect([...retained].filter(key => key.startsWith('alpha:1')).length).toBe(8);
    expect(retained.has('alpha:99')).toBe(false);
  });

  it('enforces the eight-import cap across legacy records selected by daily retention', () => {
    const records: RecoveryCheckpoint[] = [
      checkpoint(200, localDay(0, 11), 'legacy-import'),
      checkpoint(199, localDay(0, 10), 'legacy-import'),
      checkpoint(198, localDay(0, 9), 'legacy-import'),
      checkpoint(197, localDay(0, 8), 'legacy-import'),
      checkpoint(196, localDay(0, 7), 'legacy-import'),
      checkpoint(195, localDay(0, 6), 'legacy-import'),
      checkpoint(194, localDay(0, 5), 'legacy-import'),
      checkpoint(193, localDay(0, 4), 'legacy-import'),
      checkpoint(120, localDay(-1, 23), 'legacy-import'),
      checkpoint(119, localDay(-2, 23), 'legacy-import'),
      checkpoint(118, localDay(-3, 23), 'legacy-import'),
      checkpoint(117, localDay(-4, 23), 'legacy-import'),
      checkpoint(116, localDay(-5, 23), 'legacy-import'),
      checkpoint(115, localDay(-6, 23), 'legacy-import'),
      checkpoint(114, localDay(-7, 23), 'legacy-import'),
    ];

    expect(selectRetainedCheckpointKeys(records, NOW)).toEqual(new Set([
      'alpha:200', 'alpha:199', 'alpha:198', 'alpha:197',
      'alpha:196', 'alpha:195', 'alpha:194', 'alpha:193',
    ]));
  });
});
