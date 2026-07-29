import type { RuneProofRunSnapshot } from '../../types';
import type { RuneProofSourceAudit } from './sourceGate';
import {
  assertRequirementExpr, factId, type AcquisitionRule, type Coverage,
  type FactRef, type RuneProofReport,
} from './model';
import type { RuneProofSourceDocument } from './acquisitionIndex';
import { calculateReachability, type LocationGraph } from './locationGraph';
import { evaluateObtainability } from './evaluator';
import { createProofCertificate, verifyProof } from './proof';
import type { CompiledGoal } from './goalCompiler';

export interface RuneProofQuery {
  readonly goal: CompiledGoal;
  readonly includeAlternatives?: boolean;
  readonly includeBlockers?: boolean;
}

export interface RuneProofEngine {
  readonly sourceVersion: string;
  evaluate(query: RuneProofQuery, snapshot: RuneProofRunSnapshot, signal?: AbortSignal): Promise<RuneProofReport>;
  dispose?(): void;
}

export interface RuneProofEngineSources {
  readonly sourceVersion: string;
  readonly sourceAudit: RuneProofSourceAudit;
  readonly acquisition: RuneProofSourceDocument;
  readonly locationGraph: LocationGraph;
}

export interface RuneProofExecutorOptions {
  readonly acquisitionUrl?: string;
}

/** Builds a deterministic main-thread engine; the worker uses this exact function too. */
export function createRuneProofEngine(sources: RuneProofEngineSources): RuneProofEngine {
  return Object.freeze({
    sourceVersion: sources.sourceVersion,
    evaluate: (query, snapshot, signal) => evaluateRuneProof(query, snapshot, sources, signal),
  });
}

/** Uses a worker when construction succeeds; every worker failure falls back to the same pure engine. */
export function createRuneProofExecutor(
  sources: RuneProofEngineSources,
  options: RuneProofExecutorOptions = {},
): RuneProofEngine {
  const fallback = createRuneProofEngine(sources);
  if (typeof Worker === 'undefined') return fallback;
  let worker: Worker;
  try { worker = new Worker(new URL('../../workers/runeproof.worker.ts', import.meta.url), { type: 'module' }); }
  catch { return fallback; }
  const initialization = options.acquisitionUrl
    ? {
        type: 'INITIALIZE',
        acquisitionUrl: options.acquisitionUrl,
        sourceVersion: sources.sourceVersion,
        sourceAudit: sources.sourceAudit,
        locationGraph: sources.locationGraph,
      }
    : { type: 'INITIALIZE', sources };
  try { worker.postMessage(initialization); }
  catch { worker.terminate(); return fallback; }
  let nextId = 0;
  let failed = false;
  let disposed = false;
  type PendingRequest = {
    query: RuneProofQuery;
    snapshot: RuneProofRunSnapshot;
    signal?: AbortSignal;
    abort?: () => void;
    resolve: (value: RuneProofReport) => void;
    reject: (reason?: unknown) => void;
  };
  const pending = new Map<number, PendingRequest>();
  const cleanup = (request: PendingRequest) => {
    if (request.abort) request.signal?.removeEventListener('abort', request.abort);
  };
  const terminate = () => {
    try { worker.terminate(); } catch { /* Worker termination is best effort. */ }
  };
  const failWorker = () => {
    if (failed || disposed) return;
    failed = true;
    terminate();
    const interrupted = [...pending.values()];
    pending.clear();
    interrupted.forEach(request => {
      cleanup(request);
      fallback.evaluate(request.query, request.snapshot, request.signal)
        .then(request.resolve, request.reject);
    });
  };
  worker.onmessage = event => {
    const response = event.data as { id: number; report?: RuneProofReport; error?: string };
    const request = pending.get(response.id);
    if (!request) return;
    if (response.error || !response.report) {
      failWorker();
      return;
    }
    pending.delete(response.id);
    cleanup(request);
    request.resolve(response.report);
  };
  worker.onerror = failWorker;
  return Object.freeze({
    sourceVersion: sources.sourceVersion,
    evaluate: (query, snapshot, signal) => new Promise<RuneProofReport>((resolve, reject) => {
      if (signal?.aborted || disposed) { reject(abortError()); return; }
      if (failed) {
        fallback.evaluate(query, snapshot, signal).then(resolve, reject);
        return;
      }
      const id = ++nextId;
      const abort = () => {
        const request = pending.get(id);
        if (!request) return;
        pending.delete(id);
        cleanup(request);
        reject(abortError());
      };
      signal?.addEventListener('abort', abort, { once: true });
      pending.set(id, { query, snapshot, signal, abort, resolve, reject });
      try { worker.postMessage({ type: 'EVALUATE', id, query, snapshot }); }
      catch { failWorker(); }
    }),
    dispose: () => {
      if (disposed) return;
      disposed = true;
      terminate();
      const interrupted = [...pending.values()];
      pending.clear();
      interrupted.forEach(request => {
        cleanup(request);
        request.reject(abortError());
      });
    },
  });
}
export async function evaluateRuneProof(
  query: RuneProofQuery,
  snapshot: RuneProofRunSnapshot,
  sources: RuneProofEngineSources,
  signal?: AbortSignal,
): Promise<RuneProofReport> {
  if (signal?.aborted) throw abortError();
  try {
    validateSources(sources);
    const reachability = calculateReachability(sources.locationGraph, snapshot);
    const coverage = combineAll([
      query.goal.coverage,
      sources.sourceAudit.questCoverage,
      sources.sourceAudit.chunkCoverage,
      sources.sourceAudit.acquisitionCoverage,
      sources.acquisition.acquisitionCoverage,
      reachability.coverage,
    ]);
    const goal = directGoalFact(query.goal);
    const rulesForEvaluation = [...sources.acquisition.rules, ...syntheticGoalRule(query.goal, goal, reachability.reachable)];
    const evaluated = evaluateObtainability(goal, {
      rules: rulesForEvaluation,
      snapshot,
      reachableLocations: reachability.reachable,
      distanceByLocation: reachability.distance,
      sourceVersion: sources.sourceVersion,
      coverage,
    });
    if (signal?.aborted) throw abortError();
    const routes = query.includeAlternatives === false ? evaluated.routes.slice(0, 1) : evaluated.routes;
    const certified = [];
    const rules = new Map(rulesForEvaluation.map(rule => [rule.id, rule]));
    const runFacts = suppliedFacts(snapshot, reachability.reachable);
    for (const route of routes) {
      const witness = await createProofCertificate(JSON.parse(JSON.stringify(route.witness)));
      const replay = await verifyProof({ witness, rules, runFacts, runId: snapshot.runId,
        runRevision: snapshot.runRevision, sourceVersion: sources.sourceVersion });
      if (!replay.valid) return unknown(query.goal.id, `RuneProof proof replay failed: ${replay.errors.join('; ')}`);
      certified.push({ ...route, witness });
    }
    if (signal?.aborted) throw abortError();
    return freeze({ ...evaluated, goalId: query.goal.id, routes: certified, blockers: query.includeBlockers === false ? [] : evaluated.blockers });
  } catch (error) {
    if (isAbort(error)) throw error;
    return unknown(query.goal.id, `RuneProof source validation failed: ${message(error)}`);
  }
}

const SOURCE_FAMILIES = [
  'DROP', 'PRODUCTION', 'RESOURCE_ENGINE', 'SHOP', 'SPAWN',
] as const;
const SOURCE_KINDS = new Set([
  'SHOP', 'DROP', 'SPAWN', 'PRODUCTION', 'GATHERING', 'QUEST_REWARD',
  'MINIGAME', 'PICKPOCKET', 'CLUE',
]);
const UNRESOLVED_REASONS = new Set([
  'REGION_ONLY_LOCATION', 'UNKNOWN_LOCATION', 'INCOMPLETE_METADATA',
  'CONFLICTING_RULE_ID', 'CONFLICTING_OUTPUT_ID', 'NO_PROOF_GRADE_LOCATION',
]);
const PROVENANCE_KINDS = new Set([
  'CHUNK', 'TRANSFORM', 'RESOURCE_MAP', 'RECIPE_AUDIT', 'LOCATION', 'UNKNOWN',
]);
const DOCUMENT_KEYS = [
  'schemaVersion', 'sourceVersion', 'counts', 'acquisitionCoverage',
  'sourceFamilyCoverage', 'sourceFamilyAccounting', 'provenanceCatalog',
  'rules', 'unresolvedSources',
];
const RULE_KEYS = [
  'id', 'output', 'outputQuantity', 'sourceKind', 'sourceLabel', 'locationId',
  'requirements', 'repeatability', 'probability', 'coverage', 'provenanceIds',
];
const PROVENANCE_BASE_KEYS = [
  'id', 'kind', 'coverage', 'ruleIds', 'unresolvedIds',
];
const PROVENANCE_RULE_PAYLOAD_KEYS = [
  'type', 'output', 'outputQuantity', 'sourceKind', 'sourceLabel', 'locationId',
  'requirements', 'repeatability', 'probability', 'declaredCoverage', 'sourceIds',
];
const PROVENANCE_UNRESOLVED_PAYLOAD_KEYS = [
  'type', 'output', 'sourceKind', 'sourceLabel', 'regions', 'reason',
  'declaredCoverage', 'sourceIds',
];
const VALIDATED_SOURCE_DOCUMENTS = new WeakSet<object>();

function validateSources(sources: RuneProofEngineSources): void {
  if (!sources || typeof sources.sourceVersion !== 'string' || !sources.sourceVersion
    || sources.acquisition.sourceVersion !== sources.sourceVersion) throw new Error('source version mismatch');
  const audit = sources.sourceAudit;
  if (!audit || !isCoverage(audit.questCoverage) || !isCoverage(audit.chunkCoverage)
    || !isCoverage(audit.acquisitionCoverage)) {
    throw new Error('invalid source audit');
  }
  assertRuneProofSourceDocument(sources.acquisition);
}

export function assertRuneProofSourceDocument(
  value: unknown,
): asserts value is RuneProofSourceDocument {
  if (isRecord(value) && VALIDATED_SOURCE_DOCUMENTS.has(value)) return;
  if (!isRecord(value) || !hasExactKeys(value, DOCUMENT_KEYS)
    || value.schemaVersion !== 1 || !nonEmptyString(value.sourceVersion)
    || !isRecord(value.counts)
    || !hasExactKeys(value.counts, ['rules', 'unresolvedSources'])
    || !safeCount(value.counts.rules) || !safeCount(value.counts.unresolvedSources)
    || !isCoverage(value.acquisitionCoverage)
    || !Array.isArray(value.rules) || !Array.isArray(value.unresolvedSources)
    || !Array.isArray(value.provenanceCatalog)
    || !isRecord(value.sourceFamilyCoverage)
    || !hasExactKeys(value.sourceFamilyCoverage, SOURCE_FAMILIES)
    || !isRecord(value.sourceFamilyAccounting)
    || !hasExactKeys(value.sourceFamilyAccounting, SOURCE_FAMILIES)) {
    throw new Error('invalid acquisition source document');
  }
  const document = value as unknown as RuneProofSourceDocument;
  if (document.counts.rules !== document.rules.length
    || document.counts.unresolvedSources !== document.unresolvedSources.length
    || SOURCE_FAMILIES.some(family =>
      !isCoverage(document.sourceFamilyCoverage[family]))) {
    throw new Error('invalid acquisition source document');
  }

  const ruleIds = new Set<string>();
  for (const rule of document.rules) {
    if (!validRule(rule) || ruleIds.has(rule.id)) {
      throw new Error('invalid acquisition source document');
    }
    ruleIds.add(rule.id);
  }
  const unresolvedIds = new Set<string>();
  for (const source of document.unresolvedSources) {
    if (!validUnresolvedSource(source) || unresolvedIds.has(source.id)) {
      throw new Error('invalid acquisition source document');
    }
    unresolvedIds.add(source.id);
  }
  if (document.acquisitionCoverage === 'VERIFIED' && unresolvedIds.size > 0) {
    throw new Error('invalid acquisition source document');
  }

  const accountedRules = new Set<string>();
  const accountedUnresolved = new Set<string>();
  for (const family of SOURCE_FAMILIES) {
    const accounting = document.sourceFamilyAccounting[family];
    if (!isRecord(accounting) || !hasExactKeys(accounting, [
      'ruleCount', 'unresolvedCount', 'ruleIds', 'unresolvedIds', 'coverage',
    ]) || !safeCount(accounting.ruleCount) || !safeCount(accounting.unresolvedCount)
      || !validStringList(accounting.ruleIds) || !validStringList(accounting.unresolvedIds)
      || accounting.ruleCount !== accounting.ruleIds.length
      || accounting.unresolvedCount !== accounting.unresolvedIds.length
      || !isCoverage(accounting.coverage)
      || accounting.coverage !== document.sourceFamilyCoverage[family]
      || accounting.ruleIds.some(id => !ruleIds.has(id))
      || accounting.unresolvedIds.some(id => !unresolvedIds.has(id))
      || !sameStringSet(accounting.ruleIds, document.rules
        .filter(source => belongsToFamily(source, family)).map(source => source.id))
      || !sameStringSet(accounting.unresolvedIds, document.unresolvedSources
        .filter(source => belongsToFamily(source, family)).map(source => source.id))) {
      throw new Error('invalid acquisition source document');
    }
    accounting.ruleIds.forEach(id => accountedRules.add(id));
    accounting.unresolvedIds.forEach(id => accountedUnresolved.add(id));
  }
  if ([...ruleIds].some(id => !accountedRules.has(id))
    || [...unresolvedIds].some(id => !accountedUnresolved.has(id))) {
    throw new Error('invalid acquisition source document');
  }

  const catalogIds = new Set<string>();
  for (const entry of document.provenanceCatalog) {
    if (!validProvenanceEntry(entry) || catalogIds.has(entry.id)
      || entry.ruleIds.some(id => !ruleIds.has(id))
      || entry.unresolvedIds.some(id => !unresolvedIds.has(id))) {
      throw new Error('invalid acquisition source document');
    }
    catalogIds.add(entry.id);
  }
  const sources = [...document.rules, ...document.unresolvedSources];
  if (sources.some(source =>
    source.provenanceIds.some(id => !catalogIds.has(id)))) {
    throw new Error('invalid acquisition source document');
  }
  const rulesByProvenance = indexSourceIds(document.rules);
  const unresolvedByProvenance = indexSourceIds(document.unresolvedSources);
  for (const entry of document.provenanceCatalog) {
    const expectedRules = rulesByProvenance.get(entry.id) ?? [];
    const expectedUnresolved = unresolvedByProvenance.get(entry.id) ?? [];
    if (!sameStringSet(entry.ruleIds, expectedRules)
      || !sameStringSet(entry.unresolvedIds, expectedUnresolved)) {
      throw new Error('invalid acquisition source document');
    }
  }
  freeze(document);
  VALIDATED_SOURCE_DOCUMENTS.add(value);
}

function validRule(value: unknown): value is AcquisitionRule {
  if (!isRecord(value) || !hasExactKeys(value, RULE_KEYS)) return false;
  const rule = value as unknown as AcquisitionRule;
  try {
    assertRequirementExpr(rule.requirements);
    assertRequirementExpr({ op: 'FACT', fact: rule.output });
  } catch { return false; }
  return nonEmptyString(rule.id) && rule.output.kind === 'ITEM'
    && nonEmptyString(rule.sourceLabel) && nonEmptyString(rule.locationId)
    && Number.isSafeInteger(rule.outputQuantity) && rule.outputQuantity > 0
    && SOURCE_KINDS.has(rule.sourceKind) && isCoverage(rule.coverage)
    && (rule.repeatability === 'REPEATABLE' || rule.repeatability === 'ONE_TIME'
      || rule.repeatability === 'UNKNOWN')
    && (rule.probability === null || (Number.isFinite(rule.probability)
      && rule.probability >= 0 && rule.probability <= 1))
    && validStringList(rule.provenanceIds, true);
}

function validUnresolvedSource(value: unknown): boolean {
  if (!isRecord(value) || !hasExactKeys(value, [
    'id', 'output', 'sourceKind', 'sourceHost', 'regions', 'coverage', 'reason',
    'provenanceIds',
  ])) return false;
  return nonEmptyString(value.id) && nonEmptyString(value.output)
    && SOURCE_KINDS.has(value.sourceKind as string)
    && nonEmptyString(value.sourceHost) && validStringList(value.regions)
    && isCoverage(value.coverage) && UNRESOLVED_REASONS.has(value.reason as string)
    && validStringList(value.provenanceIds, true);
}

function validProvenanceEntry(value: unknown): value is RuneProofSourceDocument['provenanceCatalog'][number] {
  if (!isRecord(value) || !nonEmptyString(value.id)
    || !PROVENANCE_KINDS.has(value.kind as string) || !isCoverage(value.coverage)
    || !validStringList(value.ruleIds) || !validStringList(value.unresolvedIds)) return false;
  if (value.kind === 'LOCATION') {
    return hasExactKeys(value, [
      ...PROVENANCE_BASE_KEYS, 'locationId', 'surfaceChunk', 'parentId',
    ]) && nonEmptyString(value.locationId) && nonEmptyString(value.surfaceChunk)
      && (value.parentId === undefined || value.parentId === null
        || nonEmptyString(value.parentId));
  }
  if (value.kind === 'RESOURCE_MAP' || value.kind === 'RECIPE_AUDIT') {
    return hasExactKeys(value, [...PROVENANCE_BASE_KEYS, 'payload'])
      && validProvenancePayload(value.payload)
      && (value.kind !== 'RECIPE_AUDIT' || value.payload.sourceKind === 'PRODUCTION')
      && (value.kind !== 'RESOURCE_MAP' || value.payload.type === 'UNRESOLVED'
        || value.payload.sourceKind !== 'PRODUCTION');
  }
  return hasExactKeys(value, PROVENANCE_BASE_KEYS);
}

function validProvenancePayload(
  value: unknown,
): value is NonNullable<RuneProofSourceDocument['provenanceCatalog'][number]['payload']> {
  if (!isRecord(value) || !nonEmptyString(value.output)
    || !SOURCE_KINDS.has(value.sourceKind as string)
    || !nonEmptyString(value.sourceLabel) || !isCoverage(value.declaredCoverage)
    || !validStringList(value.sourceIds, true)) return false;
  if (value.type === 'RULE') {
    if (!hasExactKeys(value, PROVENANCE_RULE_PAYLOAD_KEYS)
      || !safeCount(value.outputQuantity) || value.outputQuantity === 0
      || !nonEmptyString(value.locationId)
      || (value.repeatability !== 'REPEATABLE' && value.repeatability !== 'ONE_TIME'
        && value.repeatability !== 'UNKNOWN')
      || (value.probability !== null && (typeof value.probability !== 'number'
        || !Number.isFinite(value.probability) || value.probability < 0
        || value.probability > 1))) return false;
    try {
      assertRequirementExpr(value.requirements as AcquisitionRule['requirements']);
    } catch { return false; }
    return true;
  }
  return value.type === 'UNRESOLVED'
    && hasExactKeys(value, PROVENANCE_UNRESOLVED_PAYLOAD_KEYS)
    && validStringList(value.regions)
    && UNRESOLVED_REASONS.has(value.reason as string);
}

function belongsToFamily(
  source: Pick<AcquisitionRule, 'sourceKind' | 'provenanceIds'>,
  family: typeof SOURCE_FAMILIES[number],
): boolean {
  return family === 'RESOURCE_ENGINE'
    ? source.provenanceIds.some(id => id.startsWith('resource-map:'))
    : source.sourceKind === family;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function hasExactKeys(value: object, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index]);
}
function safeCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
function validStringList(value: unknown, requireNonEmpty = false): value is string[] {
  return Array.isArray(value) && (!requireNonEmpty || value.length > 0)
    && value.every(nonEmptyString) && new Set(value).size === value.length;
}
function sameStringSet(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every(value => right.includes(value));
}
function indexSourceIds<T extends { id: string; provenanceIds: string[] }>(
  sources: readonly T[],
): Map<string, string[]> {
  const result = new Map<string, string[]>();
  sources.forEach(source => source.provenanceIds.forEach(id => {
    result.set(id, [...(result.get(id) ?? []), source.id]);
  }));
  return result;
}
function directGoalFact(goal: CompiledGoal): FactRef {
  if (goal.requirement.op === 'FACT' && goal.requirement.fact.id === goal.id) return goal.requirement.fact;
  const label = `runeproof-goal-${goal.id}-${goal.sourceVersion}`;
  return { id: factId('CAPABILITY', label), kind: 'CAPABILITY', label };
}

function syntheticGoalRule(
  goal: CompiledGoal,
  output: FactRef,
  reachable: ReadonlySet<string>,
): readonly AcquisitionRule[] {
  if (goal.requirement.op === 'FACT' && goal.requirement.fact.id === goal.id) return [];
  const locationId = [...reachable].sort()[0];
  if (!locationId) return [];
  return [{
    id: `goal:${goal.id}:${goal.sourceVersion}`, output, outputQuantity: 1, sourceKind: 'QUEST_REWARD',
    sourceLabel: goal.label, locationId, requirements: goal.requirement,
    repeatability: 'ONE_TIME', probability: null, coverage: goal.coverage,
    provenanceIds: [...goal.provenanceIds],
  }];
}
function suppliedFacts(snapshot: RuneProofRunSnapshot, reachable: ReadonlySet<string>): Set<string> {
  const values = new Set<string>();
  const add = (kind: FactRef['kind'], entries: readonly string[]) => entries.forEach(entry => {
    values.add(`${factId(kind, entry)}@1`);
    if (entry.includes(':')) values.add(`${entry}@1`);
  });
  add('QUEST', snapshot.completedQuests);
  [snapshot.unlockedAreas, snapshot.unlockedChunks, snapshot.unlockedMobility, snapshot.unlockedArcana,
    snapshot.unlockedHousing, snapshot.unlockedMerchants, snapshot.unlockedMinigames, snapshot.unlockedBosses,
    snapshot.unlockedStorage, snapshot.unlockedGuilds, snapshot.unlockedFarming, snapshot.unlockedSlayer,
    snapshot.unlockedBanks, snapshot.completedDiaries, snapshot.completedCombatAchievements, snapshot.completedTasks]
    .forEach(entries => add('UNLOCK', entries));
  add('CAPABILITY', snapshot.unlockedMobility); add('CAPABILITY', snapshot.unlockedArcana);
  Object.entries(snapshot.currentLevels).forEach(([label, quantity]) => values.add(`${factId('SKILL_LEVEL', label)}@${quantity}`));
  reachable.forEach(location => values.add(`${factId('LOCATION', location)}@1`));
  return values;
}

function unknown(goalId: string, explanation: string): RuneProofReport {
  return freeze({ goalId, status: 'UNKNOWN', coverage: 'UNKNOWN', routes: [], blockers: [], unavoidableBlockerFactIds: [], routesComplete: false, explanation });
}
function combineAll(values: readonly Coverage[]): Coverage { return values.includes('UNKNOWN') ? 'UNKNOWN' : values.includes('PARTIAL') ? 'PARTIAL' : 'VERIFIED'; }
function isCoverage(value: unknown): value is Coverage { return value === 'VERIFIED' || value === 'PARTIAL' || value === 'UNKNOWN'; }
function freeze<T>(value: T): T { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
function abortError(): Error { return new DOMException('RuneProof request aborted', 'AbortError'); }
function isAbort(error: unknown): boolean { return error instanceof DOMException && error.name === 'AbortError'; }
function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
