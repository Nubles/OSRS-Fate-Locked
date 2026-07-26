export const EVENT_TTL_SECONDS = 7 * 86400;
export const MAX_RECORDS = 100;
export const MAX_EVENT_BYTES = 8 * 1024;
export const MAX_REQUEST_BYTES = 256 * 1024;

const EVENT_TYPES = new Set([
  'SKILL_LEVEL',
  'QUEST',
  'COMBAT_ACHIEVEMENT',
  'COLLECTION_LOG',
  'CLUE_CASKET',
  'BOSS_KILL',
  'RAID_COMPLETION',
  'SLAYER_TASK',
  'DIARY_TASK',
  'PET_DROP',
  'MINIGAME_COMPLETION',
]);
const ACK_STATES = new Set(['COMPLETED', 'DISMISSED', 'DUPLICATE']);

const record = value => typeof value === 'object' && value !== null && !Array.isArray(value);
const boundedString = value =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= 256;
const nonNegativeInteger = value => Number.isSafeInteger(value) && value >= 0;
const encodedBytes = value => new TextEncoder().encode(JSON.stringify(value)).byteLength;

export function validEvent(value) {
  if (!record(value) || encodedBytes(value) > MAX_EVENT_BYTES) return false;
  if (!record(value.evidence) || Object.keys(value.evidence).length > 32) return false;
  for (const [key, evidence] of Object.entries(value.evidence)) {
    if (!boundedString(key)) return false;
    if (typeof evidence === 'string') {
      if (evidence.length > 256) return false;
    } else if (typeof evidence === 'number') {
      if (!Number.isFinite(evidence)) return false;
    } else if (typeof evidence !== 'boolean') {
      return false;
    }
  }
  return value.protocolVersion === 1
    && boundedString(value.eventId)
    && boundedString(value.runId)
    && boundedString(value.account)
    && nonNegativeInteger(value.runRevision)
    && EVENT_TYPES.has(value.eventType)
    && (value.canonicalLabel === null || boundedString(value.canonicalLabel))
    && nonNegativeInteger(value.occurredAt)
    && nonNegativeInteger(value.sessionSequence)
    && nonNegativeInteger(value.bundleVersion)
    && boundedString(value.rulesVersion)
    && nonNegativeInteger(value.contentVersion)
    && boundedString(value.detectorId)
    && nonNegativeInteger(value.detectorVersion)
    && (value.confidence === 'EXACT' || value.confidence === 'UNCERTAIN');
}

export function validAcknowledgement(value) {
  return record(value)
    && boundedString(value.eventId)
    && ACK_STATES.has(value.state)
    && nonNegativeInteger(value.acknowledgedAt)
    && encodedBytes(value) <= MAX_EVENT_BYTES;
}

export function appendUnique(existing, incoming) {
  const records = existing.slice(0, MAX_RECORDS);
  const seen = new Set(records.map(entry => entry.eventId));
  const accepted = [];
  const duplicates = [];
  const capacity = [];
  for (const entry of incoming) {
    if (seen.has(entry.eventId)) {
      duplicates.push(entry.eventId);
    } else if (records.length < MAX_RECORDS) {
      seen.add(entry.eventId);
      records.push(entry);
      accepted.push(entry.eventId);
    } else {
      capacity.push(entry.eventId);
    }
  }
  return { records, accepted, duplicates, capacity };
}

export function appendUniqueNewest(existing, incoming) {
  const records = existing.slice(-MAX_RECORDS);
  const seen = new Set(records.map(entry => entry.eventId));
  const accepted = [];
  const duplicates = [];
  for (const entry of incoming) {
    if (seen.has(entry.eventId)) {
      duplicates.push(entry.eventId);
    } else {
      seen.add(entry.eventId);
      records.push(entry);
      accepted.push(entry.eventId);
    }
  }
  const retained = records.length <= MAX_RECORDS
    ? records
    : records
      .map((entry, index) => ({ entry, index }))
      .sort((left, right) => (
        left.entry.acknowledgedAt - right.entry.acknowledgedAt
        || left.index - right.index
      ))
      .slice(-MAX_RECORDS)
      .map(({ entry }) => entry);
  return {
    records: retained,
    accepted,
    duplicates,
    capacity: [],
  };
}
