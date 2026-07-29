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
}

export interface RuneProofEngineSources {
  readonly sourceVersion: string;
  readonly sourceAudit: RuneProofSourceAudit;
  readonly acquisition: RuneProofSourceDocument;
  readonly locationGraph: LocationGraph;
}

/** Builds a deterministic main-thread engine; the worker uses this exact function too. */
export function createRuneProofEngine(sources: RuneProofEngineSources): RuneProofEngine {
  return Object.freeze({
    sourceVersion: sources.sourceVersion,
    evaluate: (query, snapshot, signal) => evaluateRuneProof(query, snapshot, sources, signal),
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
    if (!goal) return unknown(query.goal.id, 'RuneProof goal does not have a directly evaluable fact');
    const evaluated = evaluateObtainability(goal, {
      rules: sources.acquisition.rules,
      snapshot,
      reachableLocations: reachability.reachable,
      distanceByLocation: reachability.distance,
      sourceVersion: sources.sourceVersion,
      coverage,
    });
    if (signal?.aborted) throw abortError();
    const routes = query.includeAlternatives === false ? evaluated.routes.slice(0, 1) : evaluated.routes;
    const certified = [];
    const rules = new Map(sources.acquisition.rules.map(rule => [rule.id, rule]));
    const runFacts = suppliedFacts(snapshot, reachability.reachable);
    for (const route of routes) {
      const witness = await createProofCertificate(JSON.parse(JSON.stringify(route.witness)));
      const replay = await verifyProof({ witness, rules, runFacts, runId: snapshot.runId,
        runRevision: snapshot.runRevision, sourceVersion: sources.sourceVersion });
      if (!replay.valid) return unknown(query.goal.id, `RuneProof proof replay failed: ${replay.errors.join('; ')}`);
      certified.push({ ...route, witness });
    }
    if (signal?.aborted) throw abortError();
    return freeze({ ...evaluated, routes: certified, blockers: query.includeBlockers === false ? [] : evaluated.blockers });
  } catch (error) {
    if (isAbort(error)) throw error;
    return unknown(query.goal.id, `RuneProof source validation failed: ${message(error)}`);
  }
}

function validateSources(sources: RuneProofEngineSources): void {
  if (!sources || typeof sources.sourceVersion !== 'string' || !sources.sourceVersion
    || sources.acquisition.sourceVersion !== sources.sourceVersion) throw new Error('source version mismatch');
  const audit = sources.sourceAudit;
  if (!audit || !isCoverage(audit.questCoverage) || !isCoverage(audit.chunkCoverage)
    || !isCoverage(audit.acquisitionCoverage) || !isCoverage(sources.acquisition.acquisitionCoverage)) {
    throw new Error('invalid source audit');
  }
  if (!Array.isArray(sources.acquisition.rules) || !Array.isArray(sources.acquisition.unresolvedSources)) {
    throw new Error('invalid acquisition source document');
  }
  const ids = new Set<string>();
  sources.acquisition.rules.forEach(rule => {
    if (!validRule(rule) || ids.has(rule.id)) throw new Error('invalid acquisition rule');
    ids.add(rule.id);
  });
}

function validRule(rule: AcquisitionRule): boolean {
  try { assertRequirementExpr(rule.requirements); } catch { return false; }
  return typeof rule.id === 'string' && rule.id.length > 0 && typeof rule.locationId === 'string'
    && rule.locationId.length > 0 && typeof rule.outputQuantity === 'number' && rule.outputQuantity > 0
    && Number.isSafeInteger(rule.outputQuantity) && isCoverage(rule.coverage)
    && ['REPEATABLE', 'ONE_TIME', 'UNKNOWN'].includes(rule.repeatability)
    && (rule.probability === null || (Number.isFinite(rule.probability) && rule.probability >= 0 && rule.probability <= 1));
}

function directGoalFact(goal: CompiledGoal): FactRef | null {
  return goal.requirement.op === 'FACT' && goal.requirement.fact.id === goal.id ? goal.requirement.fact : null;
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
