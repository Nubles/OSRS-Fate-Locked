import { describe, expect, it } from 'vitest';
import { MAX_EVENTS_PER_BATCH, type FateEventEnvelope } from '../services/fateEventProtocol';
import type { RollInboxRow, RollInboxState } from '../services/rollInboxStore';
import { nextAcknowledgementBatch } from './RollInboxDriver';

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
  it('advances through bounded terminal slices and wraps after the tail', () => {
    const terminal = Array.from({ length: 205 }, (_, index) => row(index, 'COMPLETED'));
    const active = Array.from({ length: 7 }, (_, index) => row(index + 205, 'READY'));
    const rows = [...terminal, ...active];

    const first = nextAcknowledgementBatch(rows, null);
    const second = nextAcknowledgementBatch(rows, first.at(-1)!.eventId);
    const third = nextAcknowledgementBatch(rows, second.at(-1)!.eventId);
    const wrapped = nextAcknowledgementBatch(rows, third.at(-1)!.eventId);

    expect([first, second, third, wrapped].map((batch) => batch.length))
      .toEqual([100, 100, 5, 100]);
    expect([first, second, third, wrapped]
      .every((batch) => batch.length <= MAX_EVENTS_PER_BATCH)).toBe(true);
    expect([...first, ...second, ...third].map((ack) => ack.eventId)).toEqual(
      Array.from({ length: 205 }, (_, index) => `evt-${index}`),
    );
    expect(wrapped.map((ack) => ack.eventId))
      .toEqual(Array.from({ length: 100 }, (_, index) => `evt-${index}`));
  });
});
