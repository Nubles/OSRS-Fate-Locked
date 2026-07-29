import chunkTransformAudit from './sources/chunk-content-transform-audit.json';
import questRequirementAudit from './sources/quest-requirement-audit.json';
import runeProofSources from '../public/runeproof-sources.json';
import { sha256Hex } from '../utils/integrity';
import type { AuditCoverage, RuneProofSourceAudit } from '../utils/runeproof/sourceGate';
import { assertRequirementExpr, factId, type RequirementExpr, type SourceKind } from '../utils/runeproof/model';

type JsonRecord = Record<string, unknown>;
const TERMINAL_DISPOSITIONS = ['imported', 'normalized', 'excluded', 'unresolved'] as const;
type TerminalDisposition = typeof TERMINAL_DISPOSITIONS[number];
type ChunkCategoryTotal = Record<TerminalDisposition | 'source', number>;
const CHUNK_DISPOSITIONS = new Set<string>(TERMINAL_DISPOSITIONS);
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
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isTerminalDisposition(value: unknown): value is TerminalDisposition {
  return typeof value === 'string' && CHUNK_DISPOSITIONS.has(value);
}

function validChunkCategoryEntry(
  entry: [string, unknown],
): entry is [string, ChunkCategoryTotal] {
  const total = entry[1];
  if (!isRecord(total)) return false;
  const { source, imported, normalized, excluded, unresolved } = total;
  return isCount(source)
    && isCount(imported)
    && isCount(normalized)
    && isCount(excluded)
    && isCount(unresolved)
    && source === imported + normalized + excluded + unresolved;
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
): event is JsonRecord & {
  terminal: boolean;
  category: string;
  disposition: TerminalDisposition;
} {
  return isRecord(event)
    && typeof event.terminal === 'boolean'
    && typeof event.category === 'string'
    && categories.has(event.category)
    && typeof event.sourceKey === 'string'
    && event.sourceKey.length > 0
    && Array.isArray(event.targetKeys)
    && event.targetKeys.every(targetKey => typeof targetKey === 'string')
    && isTerminalDisposition(event.disposition);
}

function chunkCoverage(audit: unknown): AuditCoverage {
  if (!isRecord(audit) || audit.schemaVersion !== 1
    || typeof audit.sourceCommit !== 'string' || !audit.sourceCommit
    || !isRecord(audit.categoryTotals) || !Array.isArray(audit.events)) {
    return 'UNKNOWN';
  }

  const categories = Object.entries(audit.categoryTotals);
  if (!categories.length || !categories.every(validChunkCategoryEntry)) return 'UNKNOWN';

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
    dispositionCounts[event.disposition] += 1;
  }

  if (!audit.events.length || categories.some(([category, total]) => {
    const counted = terminalDispositionCounts.get(category)!;
    return terminalCounts.get(category) !== total.source
      || TERMINAL_DISPOSITIONS.some(disposition => counted[disposition] !== total[disposition]);
  })) return 'UNKNOWN';

  const hasUnresolvedTotals = categories.some(([, total]) => total.unresolved !== 0);
  return hasUnresolvedTotals || hasUnresolvedEvent ? 'PARTIAL' : 'VERIFIED';
}

const ACQUISITION_FAMILIES = [
  'SHOP', 'DROP', 'SPAWN', 'PRODUCTION', 'RESOURCE_ENGINE',
] as const;

const ACQUISITION_SOURCE_KINDS = new Set<SourceKind>([
  'SHOP', 'DROP', 'SPAWN', 'PRODUCTION', 'GATHERING', 'QUEST_REWARD',
  'MINIGAME', 'PICKPOCKET', 'CLUE',
]);

function validAuditCoverage(value: unknown): value is AuditCoverage {
  return value === 'VERIFIED' || value === 'PARTIAL' || value === 'UNKNOWN';
}

function validVerifiedAcquisitionRule(rule: unknown): boolean {
  if (!isRecord(rule) || typeof rule.id !== 'string' || !rule.id
    || !isRecord(rule.output) || rule.output.kind !== 'ITEM'
    || typeof rule.output.label !== 'string' || !rule.output.label
    || rule.output.id !== factId('ITEM', rule.output.label)
    || !isCount(rule.outputQuantity) || rule.outputQuantity === 0
    || !ACQUISITION_SOURCE_KINDS.has(rule.sourceKind as SourceKind)
    || typeof rule.sourceLabel !== 'string' || !rule.sourceLabel
    || typeof rule.locationId !== 'string' || !rule.locationId
    || !['REPEATABLE', 'ONE_TIME', 'UNKNOWN'].includes(rule.repeatability as string)
    || (rule.probability !== null && (typeof rule.probability !== 'number'
      || !Number.isFinite(rule.probability) || rule.probability < 0 || rule.probability > 1))
    || rule.coverage !== 'VERIFIED' || !Array.isArray(rule.provenanceIds)
    || rule.provenanceIds.length === 0
    || !rule.provenanceIds.every(id => typeof id === 'string' && id.length > 0)) return false;
  try {
    assertRequirementExpr(rule.requirements as RequirementExpr);
    return true;
  } catch {
    return false;
  }
}
function acquisitionCoverage(audit: unknown): AuditCoverage {
  if (audit === undefined) return 'PARTIAL';
  if (!isRecord(audit)
    || audit.schemaVersion !== 1
    || !validAuditCoverage(audit.acquisitionCoverage)
    || !isRecord(audit.sourceFamilyCoverage)
    || !Array.isArray(audit.unresolvedSources)) return 'UNKNOWN';

  const familyCoverage = ACQUISITION_FAMILIES.map(
    family => audit.sourceFamilyCoverage[family],
  );
  if (!familyCoverage.every(validAuditCoverage)) return 'UNKNOWN';

  for (const source of audit.unresolvedSources) {
    if (!isRecord(source)
      || typeof source.id !== 'string'
      || source.id.length === 0
      || !validAuditCoverage(source.coverage)) return 'UNKNOWN';
  }
  if (audit.unresolvedSources.length > 0) return 'PARTIAL';
  if (audit.acquisitionCoverage === 'VERIFIED') {
    if (!Array.isArray(audit.rules) || audit.rules.length === 0) return 'UNKNOWN';
    const ruleIds = new Set<string>();
    for (const rule of audit.rules) {
      if (!validVerifiedAcquisitionRule(rule) || ruleIds.has(rule.id)) return 'UNKNOWN';
      ruleIds.add(rule.id);
    }
    if (familyCoverage.every(coverage => coverage === 'VERIFIED')) return 'VERIFIED';
  }
  return audit.acquisitionCoverage === 'UNKNOWN' ? 'UNKNOWN' : 'PARTIAL';
}

export async function buildRuneProofSourceAudit(
  questAudit: unknown,
  chunkAudit: unknown,
  acquisitionAudit?: unknown,
): Promise<RuneProofSourceAudit> {
  return Object.freeze({
    sourceVersion: `sha256-${await sha256Hex(canonicalJson({
      questAudit, chunkAudit, acquisitionAudit,
    }))}`,
    questCoverage: questCoverage(questAudit),
    chunkCoverage: chunkCoverage(chunkAudit),
    acquisitionCoverage: acquisitionCoverage(acquisitionAudit),
  });
}

export function loadRuneProofSourceAudit(): Promise<RuneProofSourceAudit> {
  return buildRuneProofSourceAudit(
    questRequirementAudit, chunkTransformAudit, runeProofSources,
  );
}
