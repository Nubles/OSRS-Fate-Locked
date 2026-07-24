export const FATE_EVENT_PROTOCOL_VERSION = 1 as const;
export const MAX_EVENTS_PER_BATCH = 100;
export const MAX_EVENT_BYTES = 8 * 1024;
export const MAX_EVIDENCE_KEYS = 32;
export const MAX_STRING_LENGTH = 256;

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const FIVE_MINUTES_MS = 5 * 60 * 1000;

export const FATE_EVENT_TYPES = [
  'SKILL_LEVEL',
  'QUEST',
  'COMBAT_ACHIEVEMENT',
  'COLLECTION_LOG',
  'CLUE_CASKET',
  'BOSS_KILL',
  'RAID_COMPLETION',
] as const;

export type FateEventType = typeof FATE_EVENT_TYPES[number];
export type EventConfidence = 'EXACT' | 'UNCERTAIN';
export type EvidenceValue = string | number | boolean;

export interface FateEventEnvelope {
  protocolVersion: typeof FATE_EVENT_PROTOCOL_VERSION;
  eventId: string;
  runId: string;
  account: string;
  runRevision: number;
  eventType: FateEventType;
  canonicalLabel: string | null;
  occurredAt: number;
  sessionSequence: number;
  bundleVersion: number;
  rulesVersion: string;
  contentVersion: number;
  detectorId: string;
  detectorVersion: number;
  confidence: EventConfidence;
  evidence: Record<string, EvidenceValue>;
}

export type EventAcknowledgementState = 'COMPLETED' | 'DISMISSED' | 'DUPLICATE';

export interface EventAcknowledgement {
  eventId: string;
  state: EventAcknowledgementState;
  acknowledgedAt: number;
}

export function normalizeAccountName(account: string): string {
  return account.trim().replace(/\s+/g, ' ').toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isBoundedString(value: unknown, allowEmpty = false): value is string {
  return typeof value === 'string'
    && value.length <= MAX_STRING_LENGTH
    && (allowEmpty || value.trim().length > 0);
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function parseEvidence(value: unknown): Record<string, EvidenceValue> | null {
  if (!isRecord(value)) return null;
  const entries = Object.entries(value);
  if (entries.length > MAX_EVIDENCE_KEYS) return null;
  const evidence: Record<string, EvidenceValue> = {};
  for (const [key, entry] of entries) {
    if (!isBoundedString(key)) return null;
    if (typeof entry === 'string') {
      if (!isBoundedString(entry, true)) return null;
    } else if (typeof entry === 'number') {
      if (!Number.isFinite(entry)) return null;
    } else if (typeof entry !== 'boolean') {
      return null;
    }
    evidence[key] = entry;
  }
  return evidence;
}

export function parseFateEvent(input: unknown): FateEventEnvelope | null {
  if (!isRecord(input)) return null;
  let serialized: string;
  try {
    serialized = JSON.stringify(input);
  } catch {
    return null;
  }
  if (new TextEncoder().encode(serialized).byteLength > MAX_EVENT_BYTES) return null;

  const evidence = parseEvidence(input.evidence);
  const now = Date.now();
  if (
    input.protocolVersion !== FATE_EVENT_PROTOCOL_VERSION
    || !isBoundedString(input.eventId)
    || !isBoundedString(input.runId)
    || !isBoundedString(input.account)
    || !isNonNegativeSafeInteger(input.runRevision)
    || !FATE_EVENT_TYPES.includes(input.eventType as FateEventType)
    || !(input.canonicalLabel === null || isBoundedString(input.canonicalLabel))
    || !isNonNegativeSafeInteger(input.occurredAt)
    || input.occurredAt < now - THIRTY_DAYS_MS
    || input.occurredAt > now + FIVE_MINUTES_MS
    || !isNonNegativeSafeInteger(input.sessionSequence)
    || !isNonNegativeSafeInteger(input.bundleVersion)
    || !isBoundedString(input.rulesVersion)
    || !isNonNegativeSafeInteger(input.contentVersion)
    || !isBoundedString(input.detectorId)
    || !isNonNegativeSafeInteger(input.detectorVersion)
    || (input.confidence !== 'EXACT' && input.confidence !== 'UNCERTAIN')
    || evidence === null
  ) {
    return null;
  }

  return {
    protocolVersion: FATE_EVENT_PROTOCOL_VERSION,
    eventId: input.eventId,
    runId: input.runId,
    account: input.account,
    runRevision: input.runRevision,
    eventType: input.eventType as FateEventType,
    canonicalLabel: input.canonicalLabel as string | null,
    occurredAt: input.occurredAt,
    sessionSequence: input.sessionSequence,
    bundleVersion: input.bundleVersion,
    rulesVersion: input.rulesVersion,
    contentVersion: input.contentVersion,
    detectorId: input.detectorId,
    detectorVersion: input.detectorVersion,
    confidence: input.confidence,
    evidence,
  };
}

export function parseEventBatch(input: unknown): FateEventEnvelope[] {
  if (!isRecord(input) || !Array.isArray(input.events)) return [];
  return input.events
    .slice(0, MAX_EVENTS_PER_BATCH)
    .map(parseFateEvent)
    .filter((event): event is FateEventEnvelope => event !== null);
}
