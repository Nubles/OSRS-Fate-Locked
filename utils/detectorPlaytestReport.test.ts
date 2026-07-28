import { describe, expect, it } from 'vitest';
import type { LogEntry } from '../types';
import type { RollInboxRow } from '../services/rollInboxStore';
import { buildDetectorPlaytestReport } from './detectorPlaytestReport';

const row = (
  id: string,
  state: RollInboxRow['state'],
  reviewOutcome?: RollInboxRow['reviewOutcome'],
): RollInboxRow => ({
  event: {
    protocolVersion: 1,
    eventId: id,
    runId: 'private-run',
    account: 'Private Player',
    runRevision: 2,
    eventType: 'SLAYER_TASK',
    canonicalLabel: 'Abyssal demons',
    occurredAt: Date.UTC(2026, 6, 20),
    sessionSequence: Number(id.replace(/\D/g, '')) || 1,
    bundleVersion: 4,
    rulesVersion: '1',
    contentVersion: 1,
    detectorId: 'slayer-task-v1',
    detectorVersion: 1,
    confidence: 'UNCERTAIN',
    evidence: { chatSignature: 'private message', relayToken: 'secret' },
  },
  state,
  reviewOutcome,
  updatedAt: Date.UTC(2026, 6, 21),
});

describe('buildDetectorPlaytestReport', () => {
  it('aggregates reviewed outcomes without exporting private event data', () => {
    const inbox = [
      ...Array.from({ length: 18 }, (_, index) =>
        row(`confirmed-${index}`, 'COMPLETED', 'CONFIRMED_UNCHANGED')),
      row('corrected-19', 'COMPLETED', 'CORRECTED'),
      row('dismissed-20', 'DISMISSED'),
      row('duplicate-21', 'DUPLICATE'),
      row('blocked-22', 'BLOCKED'),
    ];
    const history: LogEntry[] = inbox.slice(0, 19).map((item, index) => ({
      id: `roll-${index}`,
      timestamp: Date.UTC(2026, 6, 21),
      type: 'ROLL_FAIL',
      message: 'Private roll text',
      meta: {
        fateEventId: item.event.eventId,
        detectorId: item.event.detectorId,
        detectorVersion: 1,
      },
    }));

    const report = buildDetectorPlaytestReport(inbox, history);

    expect(report.detectors['slayer-task-v1@1']).toMatchObject({
      received: 22,
      confirmedUnchanged: 18,
      corrected: 1,
      dismissed: 1,
      blocked: 1,
      duplicate: 1,
      rolled: 19,
      falsePositiveRate: 0.05,
    });
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain('Private Player');
    expect(serialized).not.toContain('private-run');
    expect(serialized).not.toContain('relayToken');
    expect(serialized).not.toContain('chatSignature');
    expect(serialized).not.toContain('Private roll text');
    expect(serialized).not.toContain('2026-07-20T00:00:00.000Z');
  });
});
