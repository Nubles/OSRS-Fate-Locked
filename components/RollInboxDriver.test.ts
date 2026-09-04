import { describe, expect, it } from 'vitest';
import type { FateEventEnvelope } from '../services/fateEventProtocol';
import type { RollInboxRow } from '../services/rollInboxStore';
import { classifyRollInboxDriverRow } from './RollInboxDriver';

const legacyRow: RollInboxRow = {
  event: {
    protocolVersion: 1,
    eventId: 'evt-1',
    runId: 'run-1',
    account: 'Nubles',
    runRevision: 1,
    eventType: 'QUEST',
    canonicalLabel: 'Dragon Slayer I',
    occurredAt: 1,
    sessionSequence: 1,
    bundleVersion: 4,
    rulesVersion: '1',
    contentVersion: 1,
    detectorId: 'quest-widget-v1',
    detectorVersion: 1,
    confidence: 'EXACT',
    evidence: {},
  } satisfies FateEventEnvelope,
  state: 'RECEIVED',
  updatedAt: 1_000,
};

describe('RollInboxDriver legacy row support', () => {
  it('keeps older browser rows classifiable locally', () => {
    expect(classifyRollInboxDriverRow(legacyRow, {
      runId: 'run-1',
      runRevision: 1,
      linkedAccount: 'Nubles',
      history: [],
    } as never)).toBeDefined();
  });
});
