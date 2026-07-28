import type { RollInboxRow } from '../services/rollInboxStore';
import type { LogEntry } from '../types';
import { CONTENT_VERSION, RULES_VERSION } from './runeliteBundle';

export interface DetectorPlaytestMetrics {
  detectorId: string;
  detectorVersion: number;
  received: number;
  confirmedUnchanged: number;
  corrected: number;
  dismissed: number;
  blocked: number;
  duplicate: number;
  rolled: number;
  falsePositiveRate: number;
}

export interface DetectorPlaytestReport {
  formatVersion: 1;
  appVersion: string;
  rulesVersion: string;
  contentVersion: number;
  dateRange: { from: string | null; to: string | null };
  detectors: Record<string, DetectorPlaytestMetrics>;
}

const day = (timestamp: number): string =>
  new Date(timestamp).toISOString().slice(0, 10);

export function buildDetectorPlaytestReport(
  inbox: RollInboxRow[],
  history: LogEntry[],
): DetectorPlaytestReport {
  const detectors: Record<string, DetectorPlaytestMetrics> = {};
  const rolledEventIds = new Set(
    history
      .map((entry) => entry.meta?.fateEventId)
      .filter((eventId): eventId is string => typeof eventId === 'string'),
  );

  for (const row of inbox) {
    const { detectorId, detectorVersion, eventId } = row.event;
    const key = `${detectorId}@${detectorVersion}`;
    const metrics = detectors[key] ?? {
      detectorId,
      detectorVersion,
      received: 0,
      confirmedUnchanged: 0,
      corrected: 0,
      dismissed: 0,
      blocked: 0,
      duplicate: 0,
      rolled: 0,
      falsePositiveRate: 0,
    };
    metrics.received += 1;
    if (row.reviewOutcome === 'CONFIRMED_UNCHANGED') metrics.confirmedUnchanged += 1;
    if (row.reviewOutcome === 'CORRECTED') metrics.corrected += 1;
    if (row.state === 'DISMISSED') metrics.dismissed += 1;
    if (row.state === 'BLOCKED') metrics.blocked += 1;
    if (row.state === 'DUPLICATE') metrics.duplicate += 1;
    if (rolledEventIds.has(eventId)) metrics.rolled += 1;
    detectors[key] = metrics;
  }

  for (const metrics of Object.values(detectors)) {
    const reviewed = metrics.confirmedUnchanged + metrics.corrected + metrics.dismissed;
    metrics.falsePositiveRate = reviewed
      ? Number((metrics.corrected / reviewed).toFixed(6))
      : 0;
  }

  const dates = inbox.map((row) => row.event.occurredAt).filter(Number.isFinite);
  return {
    formatVersion: 1,
    appVersion: '1.0.0',
    rulesVersion: RULES_VERSION,
    contentVersion: CONTENT_VERSION,
    dateRange: {
      from: dates.length ? day(Math.min(...dates)) : null,
      to: dates.length ? day(Math.max(...dates)) : null,
    },
    detectors,
  };
}
