// The journal keeps the newest 'session-start' checkpoint even on the day it
// was taken, so the run as it was when the session began survives retention
// (the Backups ring copy of it is the first thing dropped when storage is tight).
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { openRecoveryDatabase } from './recoveryDatabase';
import { selectRetainedCheckpointKeys } from './recoveryRetention';
import type { RecoveryCheckpoint } from './recoveryTypes';

const ok = () => ({ ok: true as const });
const cp = (rev: number, capturedAt: number, reason: RecoveryCheckpoint['reason']): RecoveryCheckpoint => ({
  profileId: 'p', persistenceRevision: rev, runId: 'r', runRevision: rev, capturedAt,
  checksum: rev.toString(16).padStart(64, '0'), data: JSON.stringify({ rev }), reason,
});

describe('session-start checkpoint retention', () => {
  it('keeps the newest session-start checkpoint captured today, and only that one', () => {
    const now = new Date(2026, 10, 22, 12, 0, 0).getTime();
    const early = new Date(2026, 10, 22, 8, 0, 0).getTime();
    const later = new Date(2026, 10, 22, 9, 0, 0).getTime();
    expect([...selectRetainedCheckpointKeys([cp(5, later, 'session-start')], now)]).toEqual(['p:5']);
    expect([...selectRetainedCheckpointKeys([cp(4, early, 'session-start'), cp(5, later, 'session-start')], now)]).toEqual(['p:5']);
  });

  it('putCheckpoint keeps a session-start checkpoint it reports as stored', async () => {
    const repo = await openRecoveryDatabase({ databaseName: 'session-start-retention' });
    try {
      const result = await repo.putCheckpoint(cp(5, Date.now(), 'session-start'), ok);
      expect(result).toEqual({ stored: true });
      expect((await repo.listCheckpoints('p')).map(c => c.reason)).toEqual(['session-start']);
    } finally {
      repo.close();
    }
  });
});
