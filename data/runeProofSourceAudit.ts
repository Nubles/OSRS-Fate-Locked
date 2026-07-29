import chunkTransformAudit from './sources/chunk-content-transform-audit.json';
import questRequirementAudit from './sources/quest-requirement-audit.json';
import { sha256Hex } from '../utils/integrity';
import type { AuditCoverage, RuneProofSourceAudit } from '../utils/runeproof/sourceGate';

type JsonRecord = Record<string, unknown>;
const TERMINAL_DISPOSITIONS = ['imported', 'normalized', 'excluded', 'unresolved'] as const;
type TerminalDisposition = typeof TERMINAL_DISPOSITIONS[number];
const CHUNK_DISPOSITIONS = new Set<TerminalDisposition>(TERMINAL_DISPOSITIONS);
const AUXILIARY_CHUNK_EVENT_CATEGORIES = new Set(['lite']);

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonicalize(child)]));
  }
  return value;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value)) ?? 'undefined';
}

function isCount(value: unknown): value is number {
  return Number.isInteger(value) && value >= 0;
}

function questCoverage(audit: unknown): AuditCoverage {
  if (!isRecord(audit) || audit.schemaVersion !== 1 || !Array.isArray(audit.entries)
    || audit.entries.length === 0) return 'UNKNOWN';

  const statuses = audit.entries.map(entry => isRecord(entry) ? entry.status : undefined);
  if (!statuses.every(status =>
    status === 'verified' || status === 'verified-with-notes' || status === 'unresolved')) {
    return 'UNKNOWN';
  }
  return statuses.includes('unresolved') ? 'PARTIAL' : 'VERIFIED';
}

function validChunkEvent(
  event: unknown,
  categories: Set<string>,
): event is JsonRecord & { terminal: boolean; category: string; disposition: string } {
  return isRecord(event)
    && typeof event.terminal === 'boolean'
    && typeof event.category === 'string'
    && categories.has(event.category)
    && typeof event.sourceKey === 'string'
    && event.sourceKey.length > 0
    && Array.isArray(event.targetKeys)
    && event.targetKeys.every(targetKey => typeof targetKey === 'string')
    && typeof event.disposition === 'string'
    && CHUNK_DISPOSITIONS.has(event.disposition);
}

function chunkCoverage(audit: unknown): AuditCoverage {
  if (!isRecord(audit) || audit.schemaVersion !== 1
    || typeof audit.sourceCommit !== 'string' || !audit.sourceCommit
    || !isRecord(audit.categoryTotals) || !Array.isArray(audit.events)) {
    return 'UNKNOWN';
  }

  const categories = Object.entries(audit.categoryTotals);
  if (!categories.length || !categories.every(([, total]) => {
    if (!isRecord(total)) return false;
    const { source, imported, normalized, excluded, unresolved } = total;
    return [source, imported, normalized, excluded, unresolved].every(isCount)
      && source === imported + normalized + excluded + unresolved;
  })) return 'UNKNOWN';

  const categoryNames = new Set(categories.map(([category]) => category));
  const recognizedCategories = new Set([...categoryNames, ...AUXILIARY_CHUNK_EVENT_CATEGORIES]);
  const terminalCounts = new Map(categories.map(([category]) => [category, 0]));
  const terminalDispositionCounts = new Map(categories.map(([category]) => [
    category,
    { imported: 0, normalized: 0, excluded: 0, unresolved: 0 },
  ]));
  const terminalKeys = new Set<string>();
  let hasUnresolvedEvent = false;

  for (const event of audit.events) {
    if (!validChunkEvent(event, recognizedCategories)) return 'UNKNOWN';
    if (event.terminal && !categoryNames.has(event.category)) return 'UNKNOWN';
    if (event.disposition === 'unresolved') hasUnresolvedEvent = true;
    if (!event.terminal) continue;

    const terminalKey = `${event.category}\u0000${event.sourceKey}`;
    if (terminalKeys.has(terminalKey)) return 'UNKNOWN';
    terminalKeys.add(terminalKey);
    terminalCounts.set(event.category, (terminalCounts.get(event.category) ?? 0) + 1);
    const dispositionCounts = terminalDispositionCounts.get(event.category)!;
    dispositionCounts[event.disposition as TerminalDisposition] += 1;
  }

  if (!audit.events.length || categories.some(([category, total]) => {
    const declared = total as JsonRecord;
    const counted = terminalDispositionCounts.get(category)!;
    return terminalCounts.get(category) !== declared.source
      || TERMINAL_DISPOSITIONS.some(disposition => counted[disposition] !== declared[disposition]);
  })) return 'UNKNOWN';

  const hasUnresolvedTotals = categories.some(([, total]) =>
    (total as JsonRecord).unresolved !== 0);
  return hasUnresolvedTotals || hasUnresolvedEvent ? 'PARTIAL' : 'VERIFIED';
}

export async function buildRuneProofSourceAudit(
  questAudit: unknown,
  chunkAudit: unknown,
): Promise<RuneProofSourceAudit> {
  return Object.freeze({
    sourceVersion: `sha256-${await sha256Hex(canonicalJson({ questAudit, chunkAudit }))}`,
    questCoverage: questCoverage(questAudit),
    chunkCoverage: chunkCoverage(chunkAudit),
    // Task 5 must replace this after validating acquisition-source coverage.
    acquisitionCoverage: 'PARTIAL',
  });
}

export function loadRuneProofSourceAudit(): Promise<RuneProofSourceAudit> {
  return buildRuneProofSourceAudit(questRequirementAudit, chunkTransformAudit);
}
