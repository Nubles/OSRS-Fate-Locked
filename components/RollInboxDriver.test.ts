import { describe, expect, it } from 'vitest';
import { MAX_EVENTS_PER_BATCH, type FateEventEnvelope } from '../services/fateEventProtocol';
import type { RollInboxRow, RollInboxState } from '../services/rollInboxStore';
import { buildAcknowledgementBatches } from './RollInboxDriver';

const row = (index: number, state: RollInboxState): RollInboxRow => ({
  event: {
    protocolVersion: 1,
    eventId: `evt-${index}`,
    runId: 'run-1',
    account: 'Nubles',
    runRevision: 1,
    eventType: 'QUEST',
    canonicalLabel: 'Dragon Slayer I',
    occurredAt: index,
    sessionSequence: index,
    bundleVersion: 4,
    rulesVersion: '1',
    contentVersion: 1,
    detectorId: 'quest-widget-v1',
    detectorVersion: 1,
    confidence: 'EXACT',
    evidence: {},
  } satisfies FateEventEnvelope,
  state,
  updatedAt: 1_000 + index,
});

describe('RollInboxDriver acknowledgement batching', () => {
  it('bounds every post at 100 and includes every terminal row without starving newer acknowledgements', () => {
    const terminal = Array.from({ length: 205 }, (_, index) => row(index, 'COMPLETED'));
    const active = Array.from({ length: 7 }, (_, index) => row(index + 205, 'READY'));

    const batches = buildAcknowledgementBatches([...terminal, ...active]);

    expect(batches.map((batch) => batch.length)).toEqual([100, 100, 5]);
    expect(batches.every((batch) => batch.length <= MAX_EVENTS_PER_BATCH)).toBe(true);
    expect(batches.flat().map((ack) => ack.eventId)).toEqual(
      Array.from({ length: 205 }, (_, index) => `evt-${index}`),
    );
    expect(batches.at(-1)?.at(-1)?.eventId).toBe('evt-204');
  });
});
