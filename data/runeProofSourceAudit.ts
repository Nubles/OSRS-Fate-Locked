import chunkTransformAudit from './sources/chunk-content-transform-audit.json';
import questRequirementAudit from './sources/quest-requirement-audit.json';
import runeProofSources from '../public/runeproof-sources.json';
import { sha256Hex } from '../utils/integrity';
import type { AuditCoverage, RuneProofSourceAudit } from '../utils/runeproof/sourceGate';
import { factId, type FactKind, type SourceKind } from '../utils/runeproof/model';

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
  'DROP', 'PRODUCTION', 'RESOURCE_ENGINE', 'SHOP', 'SPAWN',
] as const;
type AcquisitionFamily = typeof ACQUISITION_FAMILIES[number];

const ACQUISITION_SOURCE_KINDS = new Set<SourceKind>([
  'SHOP', 'DROP', 'SPAWN', 'PRODUCTION', 'GATHERING', 'QUEST_REWARD',
  'MINIGAME', 'PICKPOCKET', 'CLUE',
]);
const FACT_KINDS = new Set<FactKind>([
  'ITEM', 'QUEST', 'SKILL_LEVEL', 'UNLOCK', 'LOCATION', 'CAPABILITY',
]);
const UNRESOLVED_REASONS = new Set([
  'REGION_ONLY_LOCATION', 'UNKNOWN_LOCATION', 'INCOMPLETE_METADATA',
  'CONFLICTING_RULE_ID', 'CONFLICTING_OUTPUT_ID', 'NO_PROOF_GRADE_LOCATION',
]);
const PROVENANCE_KINDS = new Set([
  'CHUNK', 'TRANSFORM', 'RESOURCE_MAP', 'RECIPE_AUDIT', 'LOCATION', 'UNKNOWN',
]);
const RULE_KEYS = [
  'coverage', 'id', 'locationId', 'output', 'outputQuantity', 'probability',
  'provenanceIds', 'repeatability', 'requirements', 'sourceKind', 'sourceLabel',
];
const UNRESOLVED_KEYS = [
  'coverage', 'id', 'output', 'provenanceIds', 'reason', 'regions', 'sourceHost',
  'sourceKind',
];

function validAuditCoverage(value: unknown): value is AuditCoverage {
  return value === 'VERIFIED' || value === 'PARTIAL' || value === 'UNKNOWN';
}

function hasExactKeys(value: JsonRecord, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index]);
}

function validProvenanceIds(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0
    && value.every(id => typeof id === 'string' && id.trim().length > 0)
    && new Set(value).size === value.length;
}

function validFactRef(value: unknown): value is JsonRecord {
  if (!isRecord(value)) return false;
  const keys = value.quantity === undefined
    ? ['id', 'kind', 'label'] : ['id', 'kind', 'label', 'quantity'];
  return hasExactKeys(value, keys)
    && FACT_KINDS.has(value.kind as FactKind)
    && typeof value.label === 'string' && value.label.trim().length > 0
    && value.id === factId(value.kind as FactKind, value.label)
    && (value.quantity === undefined
      || (typeof value.quantity === 'number' && Number.isInteger(value.quantity)
        && value.quantity > 0));
}

function validRequirementExpr(value: unknown, active = new Set<object>()): boolean {
  if (!isRecord(value) || active.has(value)) return false;
  active.add(value);
  let valid = false;
  if (value.op === 'FACT') {
    valid = hasExactKeys(value, ['fact', 'op']) && validFactRef(value.fact);
  } else if (value.op === 'ALL' || value.op === 'ANY') {
    valid = hasExactKeys(value, ['op', 'terms']) && Array.isArray(value.terms)
      && value.terms.every(term => validRequirementExpr(term, active));
  }
  active.delete(value);
  return valid;
}

function expectedRuleId(rule: JsonRecord): string {
  const output = (rule.output as JsonRecord).label as string;
  const sourceKind = rule.sourceKind as string;
  const sourceLabel = rule.sourceLabel as string;
  const locationId = rule.locationId as string;
  return `acq:${normalizeAuditId(factId('ITEM', output))}:${[
    sourceKind, sourceLabel, locationId,
  ].map(normalizeAuditId).join('-')}:${stableAuditFingerprint([
    output, sourceKind, sourceLabel, locationId,
  ])}`;
}

function normalizeAuditId(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function stableAuditFingerprint(values: readonly string[]): string {
  let hash = 0x811c9dc5;
  for (const value of values.join('\u0000')) {
    hash ^= value.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function validAcquisitionRule(rule: unknown): rule is JsonRecord {
  return isRecord(rule) && hasExactKeys(rule, RULE_KEYS)
    && typeof rule.id === 'string'
    && /^acq:[a-z0-9-]+:[a-z0-9-]+:[0-9a-f]{8}$/.test(rule.id)
    && validFactRef(rule.output) && rule.output.kind === 'ITEM'
    && rule.id === expectedRuleId(rule)
    && isCount(rule.outputQuantity) && rule.outputQuantity > 0
    && ACQUISITION_SOURCE_KINDS.has(rule.sourceKind as SourceKind)
    && typeof rule.sourceLabel === 'string' && rule.sourceLabel.trim().length > 0
    && typeof rule.locationId === 'string' && rule.locationId.trim().length > 0
    && validRequirementExpr(rule.requirements)
    && ['REPEATABLE', 'ONE_TIME', 'UNKNOWN'].includes(rule.repeatability as string)
    && (rule.probability === null || (typeof rule.probability === 'number'
      && Number.isFinite(rule.probability) && rule.probability >= 0
      && rule.probability <= 1))
    && validAuditCoverage(rule.coverage)
    && validProvenanceIds(rule.provenanceIds);
}

function validUnresolvedSource(source: unknown): source is JsonRecord {
  return isRecord(source) && hasExactKeys(source, UNRESOLVED_KEYS)
    && typeof source.id === 'string'
    && /^unresolved:[a-z0-9-]+:[0-9a-f]{8}$/.test(source.id)
    && typeof source.output === 'string' && source.output.trim().length > 0
    && ACQUISITION_SOURCE_KINDS.has(source.sourceKind as SourceKind)
    && typeof source.sourceHost === 'string' && source.sourceHost.trim().length > 0
    && Array.isArray(source.regions) && source.regions.every(region =>
      typeof region === 'string' && region.trim().length > 0)
    && validAuditCoverage(source.coverage)
    && UNRESOLVED_REASONS.has(source.reason as string)
    && validProvenanceIds(source.provenanceIds);
}

function validProvenanceEntry(entry: unknown): entry is JsonRecord {
  if (!isRecord(entry)
    || typeof entry.id !== 'string' || !entry.id.trim()
    || !PROVENANCE_KINDS.has(entry.kind as string)
    || !validAuditCoverage(entry.coverage)) return false;
  const expectedKeys = entry.kind === 'LOCATION'
    ? ['coverage', 'id', 'kind', 'locationId', 'parentId', 'ruleIds', 'surfaceChunk',
      'unresolvedIds']
    : ['coverage', 'id', 'kind', 'ruleIds', 'unresolvedIds'];
  if (!hasExactKeys(entry, expectedKeys)
    || !Array.isArray(entry.ruleIds) || !entry.ruleIds.every(id =>
      typeof id === 'string' && id.trim().length > 0)
    || new Set(entry.ruleIds).size !== entry.ruleIds.length
    || !Array.isArray(entry.unresolvedIds) || !entry.unresolvedIds.every(id =>
      typeof id === 'string' && id.trim().length > 0)
    || new Set(entry.unresolvedIds).size !== entry.unresolvedIds.length) return false;
  switch (entry.kind) {
    case 'CHUNK': return /^chunk:\d+$/.test(entry.id) && entry.coverage === 'PARTIAL';
    case 'TRANSFORM':
      return /^transform:(shopItems|drops):.+/.test(entry.id)
        && entry.coverage === 'PARTIAL';
    case 'RESOURCE_MAP': return /^resource-map:.+/.test(entry.id);
    case 'RECIPE_AUDIT': return /^recipe-audit:.+/.test(entry.id);
    case 'LOCATION':
      return typeof entry.locationId === 'string' && entry.locationId.trim().length > 0
        && entry.id === `location:${entry.locationId}`
        && typeof entry.surfaceChunk === 'string'
        && /^(0|[1-9]\d*),(0|[1-9]\d*)$/.test(entry.surfaceChunk)
        && (entry.parentId === null
          || (typeof entry.parentId === 'string' && entry.parentId.trim().length > 0));
    case 'UNKNOWN':
      return entry.coverage === 'UNKNOWN'
        && !/^(chunk:\d+|transform:(shopItems|drops):.+|resource-map:.+|recipe-audit:.+|location:.+)$/.test(entry.id);
    default: return false;
  }
}

function containsPositiveProductionInput(value: JsonRecord): boolean {
  if (value.op === 'FACT') {
    const fact = value.fact as JsonRecord;
    return fact.kind === 'ITEM' && typeof fact.quantity === 'number'
      && Number.isInteger(fact.quantity) && fact.quantity > 0;
  }
  return (value.terms as JsonRecord[]).some(containsPositiveProductionInput);
}

function combineCoverage(left: AuditCoverage, right: AuditCoverage): AuditCoverage {
  if (left === 'UNKNOWN' || right === 'UNKNOWN') return 'UNKNOWN';
  if (left === 'PARTIAL' || right === 'PARTIAL') return 'PARTIAL';
  return 'VERIFIED';
}

function semanticRuleCoverage(rule: JsonRecord): AuditCoverage {
  if (rule.sourceKind === 'PRODUCTION') {
    return rule.repeatability !== 'UNKNOWN'
      && containsPositiveProductionInput(rule.requirements as JsonRecord)
      ? 'VERIFIED' : 'UNKNOWN';
  }
  return rule.repeatability === 'UNKNOWN' ? 'PARTIAL' : 'VERIFIED';
}

function effectiveRuleCoverage(
  rule: JsonRecord,
  catalog: ReadonlyMap<string, JsonRecord>,
): AuditCoverage {
  let coverage = semanticRuleCoverage(rule);
  const provenanceIds = rule.provenanceIds as string[];
  const locationProvenance = `location:${rule.locationId as string}`;
  if (!provenanceIds.includes(locationProvenance)
    || catalog.get(locationProvenance)?.kind !== 'LOCATION') return 'UNKNOWN';
  for (const id of provenanceIds) {
    const entry = catalog.get(id);
    if (!entry) return 'UNKNOWN';
    coverage = combineCoverage(coverage, entry.coverage as AuditCoverage);
  }
  return coverage;
}

function belongsToFamily(source: JsonRecord, family: AcquisitionFamily): boolean {
  const provenance = source.provenanceIds as string[];
  return family === 'RESOURCE_ENGINE'
    ? provenance.some(id => id.startsWith('resource-map:'))
    : source.sourceKind === family;
}

function derivedFamilyAccounting(
  rules: readonly JsonRecord[],
  unresolved: readonly JsonRecord[],
  effectiveCoverage: ReadonlyMap<string, AuditCoverage>,
): Record<AcquisitionFamily, JsonRecord> {
  return Object.fromEntries(ACQUISITION_FAMILIES.map(family => {
    const familyRules = rules.filter(rule => belongsToFamily(rule, family));
    const familyUnresolved = unresolved.filter(source => belongsToFamily(source, family));
    let coverage: AuditCoverage = familyRules.length === 0 && familyUnresolved.length === 0
      ? 'UNKNOWN' : 'VERIFIED';
    for (const rule of familyRules) {
      coverage = combineCoverage(coverage, effectiveCoverage.get(rule.id as string) ?? 'UNKNOWN');
    }
    if (familyUnresolved.length > 0) coverage = 'UNKNOWN';
    return [family, {
      ruleCount: familyRules.length,
      unresolvedCount: familyUnresolved.length,
      ruleIds: familyRules.map(rule => rule.id),
      unresolvedIds: familyUnresolved.map(source => source.id),
      coverage,
    }];
  })) as unknown as Record<AcquisitionFamily, JsonRecord>;
}

async function acquisitionCoverage(audit: unknown): Promise<AuditCoverage> {
  if (audit === undefined) return 'PARTIAL';
  if (!isRecord(audit) || !hasExactKeys(audit, [
    'schemaVersion', 'sourceVersion', 'counts', 'acquisitionCoverage',
    'sourceFamilyCoverage', 'sourceFamilyAccounting', 'provenanceCatalog',
    'rules', 'unresolvedSources',
  ]) || audit.schemaVersion !== 1
    || typeof audit.sourceVersion !== 'string'
    || !/^sha256-[0-9a-f]{64}$/.test(audit.sourceVersion)
    || !validAuditCoverage(audit.acquisitionCoverage)
    || !isRecord(audit.counts) || !hasExactKeys(audit.counts, ['rules', 'unresolvedSources'])
    || !isCount(audit.counts.rules) || !isCount(audit.counts.unresolvedSources)
    || !isRecord(audit.sourceFamilyCoverage)
    || !hasExactKeys(audit.sourceFamilyCoverage, ACQUISITION_FAMILIES)
    || !isRecord(audit.sourceFamilyAccounting)
    || !hasExactKeys(audit.sourceFamilyAccounting, ACQUISITION_FAMILIES)
    || !Array.isArray(audit.provenanceCatalog)
    || !Array.isArray(audit.rules) || !Array.isArray(audit.unresolvedSources)
    || audit.counts.rules !== audit.rules.length
    || audit.counts.unresolvedSources !== audit.unresolvedSources.length) return 'UNKNOWN';

  const { sourceVersion: _sourceVersion, ...contents } = audit;
  const expectedVersion = `sha256-${await sha256Hex(canonicalJson(contents))}`;
  if (audit.sourceVersion !== expectedVersion
    || !audit.rules.every(validAcquisitionRule)
    || !audit.unresolvedSources.every(validUnresolvedSource)
    || !audit.provenanceCatalog.every(validProvenanceEntry)) return 'UNKNOWN';

  const rules = audit.rules as JsonRecord[];
  const unresolved = audit.unresolvedSources as JsonRecord[];
  const catalogEntries = audit.provenanceCatalog as JsonRecord[];
  const allIds = [...rules, ...unresolved].map(source => source.id as string);
  if (new Set(allIds).size !== allIds.length) return 'UNKNOWN';
  const catalogIds = catalogEntries.map(entry => entry.id as string);
  if (new Set(catalogIds).size !== catalogIds.length
    || catalogIds.some((id, index) => index > 0 && id <= catalogIds[index - 1])) return 'UNKNOWN';
  const usedProvenance = new Set([...rules, ...unresolved]
    .flatMap(source => source.provenanceIds as string[]));
  if (usedProvenance.size !== catalogIds.length
    || catalogIds.some(id => !usedProvenance.has(id))) return 'UNKNOWN';
  const catalog = new Map(catalogEntries.map(entry => [entry.id as string, entry]));
  for (const entry of catalogEntries) {
    const id = entry.id as string;
    const expectedRuleIds = rules.filter(rule =>
      (rule.provenanceIds as string[]).includes(id)).map(rule => rule.id);
    const expectedUnresolvedIds = unresolved.filter(source =>
      (source.provenanceIds as string[]).includes(id)).map(source => source.id);
    if (canonicalJson(entry.ruleIds) !== canonicalJson(expectedRuleIds)
      || canonicalJson(entry.unresolvedIds) !== canonicalJson(expectedUnresolvedIds)) {
      return 'UNKNOWN';
    }
  }
  if ([...rules, ...unresolved].some(source =>
    !ACQUISITION_FAMILIES.some(family => belongsToFamily(source, family)))) return 'UNKNOWN';

  const effectiveCoverage = new Map<string, AuditCoverage>();
  for (const rule of rules) {
    const derived = effectiveRuleCoverage(rule, catalog);
    if (rule.coverage !== derived) return 'UNKNOWN';
    effectiveCoverage.set(rule.id as string, derived);
  }
  for (const source of unresolved) {
    if (source.coverage !== 'UNKNOWN'
      || (source.provenanceIds as string[]).some(id => !catalog.has(id))) return 'UNKNOWN';
  }

  const derived = derivedFamilyAccounting(rules, unresolved, effectiveCoverage);
  for (const family of ACQUISITION_FAMILIES) {
    const declared = audit.sourceFamilyAccounting[family];
    if (!isRecord(declared) || !hasExactKeys(declared, [
      'coverage', 'ruleCount', 'ruleIds', 'unresolvedCount', 'unresolvedIds',
    ]) || canonicalJson(declared) !== canonicalJson(derived[family])
      || audit.sourceFamilyCoverage[family] !== derived[family].coverage) return 'UNKNOWN';
  }

  const familyCoverages = ACQUISITION_FAMILIES.map(
    family => derived[family].coverage as AuditCoverage,
  );
  const derivedGlobal: AuditCoverage = catalogEntries.some(entry => entry.kind === 'UNKNOWN')
    ? 'UNKNOWN'
    : unresolved.length > 0
      ? 'PARTIAL'
      : familyCoverages.every(coverage => coverage === 'VERIFIED')
        ? 'VERIFIED'
        : rules.length === 0 ? 'UNKNOWN' : 'PARTIAL';
  return audit.acquisitionCoverage === derivedGlobal ? derivedGlobal : 'UNKNOWN';
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
    acquisitionCoverage: await acquisitionCoverage(acquisitionAudit),
  });
}

export function loadRuneProofSourceAudit(): Promise<RuneProofSourceAudit> {
  return buildRuneProofSourceAudit(
    questRequirementAudit, chunkTransformAudit, runeProofSources,
  );
}
