import chunkTransformAudit from './sources/chunk-content-transform-audit.json';
import questRequirementAudit from './sources/quest-requirement-audit.json';
import type {
  AuditCoverage,
  RuneProofSourceAudit,
} from '../utils/runeproof/sourceGate';

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
}

function auditIdentity(value: unknown): string {
  const serialized = JSON.stringify(canonicalize(value)) ?? 'undefined';
  let hash = 0x811c9dc5;
  for (let index = 0; index < serialized.length; index += 1) {
    hash = Math.imul(hash ^ serialized.charCodeAt(index), 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function isCount(value: unknown): value is number {
  return Number.isInteger(value) && value >= 0;
}

function questCoverage(audit: unknown): AuditCoverage {
  if (!isRecord(audit) || audit.schemaVersion !== 1 || !Array.isArray(audit.entries)
    || audit.entries.length === 0) {
    return 'UNKNOWN';
  }

  const statuses = audit.entries.map(entry => isRecord(entry) ? entry.status : undefined);
  if (!statuses.every(status =>
    status === 'verified' || status === 'verified-with-notes' || status === 'unresolved')) {
    return 'UNKNOWN';
  }
  return statuses.includes('unresolved') ? 'PARTIAL' : 'VERIFIED';
}

function chunkCoverage(audit: unknown): AuditCoverage {
  if (!isRecord(audit) || audit.schemaVersion !== 1
    || typeof audit.sourceCommit !== 'string' || !audit.sourceCommit
    || !isRecord(audit.categoryTotals) || !Array.isArray(audit.events)) {
    return 'UNKNOWN';
  }

  const totals = Object.values(audit.categoryTotals);
  if (!totals.length || !totals.every(total => {
    if (!isRecord(total)) return false;
    const { source, imported, normalized, excluded, unresolved } = total;
    return [source, imported, normalized, excluded, unresolved].every(isCount)
      && source === imported + normalized + excluded + unresolved;
  })) {
    return 'UNKNOWN';
  }

  const dispositions = audit.events.map(event => isRecord(event) ? event.disposition : undefined);
  if (!dispositions.length || !dispositions.every(disposition =>
    disposition === 'imported' || disposition === 'normalized'
      || disposition === 'excluded' || disposition === 'unresolved')) {
    return 'UNKNOWN';
  }

  const terminalEvents = audit.events.filter(event => isRecord(event) && event.terminal === true);
  const sourceTotal = totals.reduce((sum, total) => sum + (total as JsonRecord).source as number, 0);
  if (sourceTotal !== terminalEvents.length) return 'UNKNOWN';

  const hasUnresolvedTotals = totals.some(total => (total as JsonRecord).unresolved !== 0);
  return hasUnresolvedTotals || dispositions.includes('unresolved') ? 'PARTIAL' : 'VERIFIED';
}

export function buildRuneProofSourceAudit(
  questAudit: unknown,
  chunkAudit: unknown,
): RuneProofSourceAudit {
  return Object.freeze({
    sourceVersion: `quest-${auditIdentity(questAudit)}-chunk-${auditIdentity(chunkAudit)}`,
    questCoverage: questCoverage(questAudit),
    chunkCoverage: chunkCoverage(chunkAudit),
    // Task 5 must replace this after validating acquisition-source coverage.
    acquisitionCoverage: 'PARTIAL',
  });
}

export const runeProofSourceAudit = buildRuneProofSourceAudit(
  questRequirementAudit,
  chunkTransformAudit,
);
