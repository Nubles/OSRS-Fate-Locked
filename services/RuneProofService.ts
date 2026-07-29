import type { RuneProofRunSnapshot } from '../types';
import {
  assertRuneProofReport, normalizeId, type RuneProofReport,
} from '../utils/runeproof/model';
import { hashProofWitness } from '../utils/runeproof/proof';
import type { RuneProofEngine, RuneProofQuery } from '../utils/runeproof/engine';
import type { CompiledGoal } from '../utils/runeproof/goalCompiler';
import {
  MAX_RUNEPROOF_BUNDLE_SUMMARIES, normalizeRuneProofBundleSummaries,
  type RuneProofBundleSummary,
} from '../utils/runeliteRulesManifest';

export interface RuneProofExportSelection {
  runId: string;
  runRevision: number;
  sourceVersion: string;
  pinnedGoalIds: readonly string[];
}

interface RuneProofExportRecord {
  goal: CompiledGoal;
  report: RuneProofReport;
  runId: string;
  runRevision: number;
  sourceVersion: string;
}

export class RuneProofExportRegistry {
  private readonly records = new Map<string, RuneProofExportRecord>();
  private readonly selectedByRun = new Map<string, string>();

  record(goal: CompiledGoal, report: RuneProofReport, snapshot: RuneProofRunSnapshot, sourceVersion: string): void {
    assertRuneProofReport(report);
    if (report.goalId !== goal.id || !sourceVersion || sourceVersion !== sourceVersion.trim()) {
      throw new Error('Invalid RuneProof export record');
    }
    const key = recordKey(snapshot.runId, goal.id);
    const existing = this.records.get(key);
    if (existing && existing.runRevision > snapshot.runRevision) return;
    const record = { goal, report, runId: snapshot.runId, runRevision: snapshot.runRevision, sourceVersion };
    this.records.set(key, record);
    const selected = this.records.get(this.selectedByRun.get(snapshot.runId) ?? '');
    if (!selected || selected.runRevision <= snapshot.runRevision) this.selectedByRun.set(snapshot.runId, key);
  }

  async select(selection: RuneProofExportSelection): Promise<RuneProofBundleSummary[]> {
    const records = this.selectedRecords(selection);
    const summaries = await Promise.all(records.map(record => this.summary(record, selection)));
    return normalizeRuneProofBundleSummaries(summaries, {
      runRevision: selection.runRevision,
      sourceVersion: selection.sourceVersion,
    });
  }

  metadata(selection: RuneProofExportSelection): { proofCount: number; sourceVersion: string } {
    return { proofCount: this.selectedRecords(selection).length, sourceVersion: selection.sourceVersion };
  }

  latestSourceVersion(runId: string): string | null {
    return this.records.get(this.selectedByRun.get(runId) ?? '')?.sourceVersion ?? null;
  }

  private selectedRecords(selection: RuneProofExportSelection): RuneProofExportRecord[] {
    const selected = this.records.get(this.selectedByRun.get(selection.runId) ?? '');
    const byIdentity = [...this.records.values()].filter(record => record.runId === selection.runId);
    const chosen = new Map<string, RuneProofExportRecord>();
    if (selected) chosen.set(selected.goal.id, selected);
    const requested = [...new Set(selection.pinnedGoalIds)].sort(compareText);
    for (const requestedId of requested) {
      const normalized = normalizeId(requestedId);
      const record = byIdentity.find(candidate => candidate.goal.id === requestedId
        || candidate.goal.label === requestedId
        || normalizeId(candidate.goal.id) === normalized
        || normalizeId(candidate.goal.label) === normalized);
      if (record) chosen.set(record.goal.id, record);
    }
    const prioritized = selected
      ? [selected, ...[...chosen.values()].filter(record => record !== selected).sort(recordCompare)]
      : [...chosen.values()].sort(recordCompare);
    return prioritized.slice(0, MAX_RUNEPROOF_BUNDLE_SUMMARIES);
  }

  private async summary(record: RuneProofExportRecord, selection: RuneProofExportSelection): Promise<RuneProofBundleSummary> {
    if (record.runRevision !== selection.runRevision || record.sourceVersion !== selection.sourceVersion) {
      return unknownSummary(record.goal, selection);
    }
    try {
      assertRuneProofReport(record.report);
      const positive = record.report.status === 'OBTAINABLE' || record.report.status === 'OBTAINABLE_RNG';
      const witness = record.report.routes[0]?.witness;
      if (positive && (!witness || witness.runId !== selection.runId
        || witness.runRevision !== selection.runRevision
        || witness.sourceVersion !== selection.sourceVersion
        || witness.rootFactId !== record.goal.id
        || await hashProofWitness(witness) !== witness.proofHash)) {
        return unknownSummary(record.goal, selection);
      }
      const blockerLabels = record.report.status === 'BLOCKED'
        ? [...new Set(record.report.blockers.flatMap(blocker => blocker.labels))]
        : [];
      const unavoidableIds = new Set(record.report.unavoidableBlockerFactIds);
      const unavoidableBlockerLabels = record.report.status === 'BLOCKED'
        ? [...new Set(record.report.blockers.flatMap(blocker => blocker.factIds
          .map((factId, index) => unavoidableIds.has(factId) ? blocker.labels[index] : undefined)
          .filter((label): label is string => label !== undefined)))]
        : [];
      const routeLabels = positive && witness
        ? Object.keys(witness.steps).sort(compareText).map(stepId => witness.steps[stepId].proves.label)
        : [];
      return {
        goalId: record.goal.id, goalLabel: record.goal.label, status: record.report.status,
        explanation: record.report.explanation ?? defaultExplanation(record.report.status),
        routeLabels, blockerLabels, unavoidableBlockerLabels,
        proofHash: positive && witness ? witness.proofHash : null,
        sourceVersion: selection.sourceVersion, runRevision: selection.runRevision,
      };
    } catch {
      return unknownSummary(record.goal, selection);
    }
  }
}

export const runeProofExportRegistry = new RuneProofExportRegistry();

function unknownSummary(goal: CompiledGoal, selection: RuneProofExportSelection): RuneProofBundleSummary {
  return {
    goalId: goal.id, goalLabel: goal.label, status: 'UNKNOWN',
    explanation: 'The selected proof is stale or could not be verified.',
    routeLabels: [], blockerLabels: [], unavoidableBlockerLabels: [], proofHash: null,
    sourceVersion: selection.sourceVersion, runRevision: selection.runRevision,
  };
}
function defaultExplanation(status: RuneProofReport['status']): string {
  switch (status) {
    case 'OBTAINABLE': return 'A deterministic current route is verified.';
    case 'OBTAINABLE_RNG': return 'A current route is verified and depends on chance.';
    case 'BLOCKED': return 'Known current routes have missing requirements.';
    case 'IMPOSSIBLE': return 'Every audited legal route is excluded.';
    case 'UNKNOWN': return 'Verified evidence is incomplete.';
  }
}
function recordKey(runId: string, goalId: string): string { return `${runId}|${goalId}`; }
function recordCompare(left: RuneProofExportRecord, right: RuneProofExportRecord): number {
  return compareText(left.goal.id, right.goal.id);
}
function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/** App-facing, latest-request-wins facade around the pure engine or worker adapter. */
export class RuneProofService {
  private readonly cache = new Map<string, RuneProofReport>();
  private active: AbortController | null = null;
  private serial = 0;
  private disposed = false;

  constructor(
    private readonly engine: RuneProofEngine,
    private readonly currentSnapshot: () => RuneProofRunSnapshot,
    private readonly exportRegistry: RuneProofExportRegistry = runeProofExportRegistry,
  ) {}

  async evaluate(query: RuneProofQuery): Promise<RuneProofReport | null> {
    if (this.disposed) return null;
    const snapshot = this.currentSnapshot();
    const sourceVersion = this.engine.sourceVersion;
    const key = `${sourceVersion}|${snapshot.runId}|${snapshot.runRevision}|${query.goal.id}|${flags(query)}`;
    const cached = this.cache.get(key);
    if (cached) return cached;
    this.active?.abort();
    const controller = new AbortController();
    this.active = controller;
    const serial = ++this.serial;
    try {
      const result = await this.engine.evaluate(query, snapshot, controller.signal);
      const current = this.currentSnapshot();
      if (this.disposed || serial !== this.serial || controller.signal.aborted
        || this.engine.sourceVersion !== sourceVersion || current.runId !== snapshot.runId
        || current.runRevision !== snapshot.runRevision) return null;
      this.exportRegistry.record(query.goal, result, snapshot, sourceVersion);
      this.cache.set(key, result);
      return result;
    } catch (error) {
      if (controller.signal.aborted || this.disposed) return null;
      throw error;
    } finally {
      if (this.active === controller) this.active = null;
    }
  }

  dispose(): void { this.disposed = true; this.serial += 1; this.active?.abort(); this.active = null; this.cache.clear(); }
}

function flags(query: RuneProofQuery): string { return `alternatives=${query.includeAlternatives !== false};blockers=${query.includeBlockers !== false}`; }
