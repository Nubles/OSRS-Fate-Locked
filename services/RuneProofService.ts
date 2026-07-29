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
  replay?: () => Promise<RuneProofReport>;
}

export class RuneProofExportRegistry {
  private readonly records = new Map<string, RuneProofExportRecord>();
  private readonly selectedByRun = new Map<string, string>();
  private readonly selectedByIdentity = new Map<string, string>();
  private readonly latestIdentityByRun = new Map<string, { runRevision: number; sourceVersion: string }>();

  record(
    goal: CompiledGoal,
    report: RuneProofReport,
    snapshot: RuneProofRunSnapshot,
    sourceVersion: string,
    replay?: () => Promise<RuneProofReport>,
  ): void {
    assertExportReport(goal, report);
    if (!sourceVersion || sourceVersion !== sourceVersion.trim()) {
      throw new Error('Invalid RuneProof export record');
    }
    const newer = [...this.records.values()].some(candidate => candidate.runId === snapshot.runId
      && candidate.goal.id === goal.id && candidate.runRevision > snapshot.runRevision);
    if (newer) return;
    const key = recordKey(snapshot.runId, snapshot.runRevision, sourceVersion, goal.id);
    const record = { goal, report, runId: snapshot.runId, runRevision: snapshot.runRevision, sourceVersion, replay };
    this.records.set(key, record);
    const latest = this.latestIdentityByRun.get(snapshot.runId);
    if (!latest || latest.runRevision <= snapshot.runRevision) {
      this.selectedByRun.set(snapshot.runId, goal.id);
      this.selectedByIdentity.set(selectionIdentityKey(snapshot.runId, snapshot.runRevision, sourceVersion), goal.id);
      this.latestIdentityByRun.set(snapshot.runId, { runRevision: snapshot.runRevision, sourceVersion });
    }
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
    return this.latestIdentityByRun.get(runId)?.sourceVersion ?? null;
  }

  private selectedRecords(selection: RuneProofExportSelection): RuneProofExportRecord[] {
    const forRun = [...this.records.values()].filter(record => record.runId === selection.runId);
    const exact = forRun.filter(record => record.runRevision === selection.runRevision
      && record.sourceVersion === selection.sourceVersion);
    const selectedGoalId = this.selectedByIdentity.get(selectionIdentityKey(
      selection.runId, selection.runRevision, selection.sourceVersion,
    )) ?? this.selectedByRun.get(selection.runId);
    const selected = selectedGoalId === undefined ? undefined
      : exact.find(record => record.goal.id === selectedGoalId)
        ?? forRun.filter(record => record.goal.id === selectedGoalId).sort(newestRecordFirst)[0];
    const chosen = new Map<string, RuneProofExportRecord>();
    if (selected) chosen.set(selected.goal.id, selected);
    const requested = [...new Set(selection.pinnedGoalIds)].sort(compareText);
    for (const requestedId of requested) {
      const normalized = normalizeId(requestedId);
      const record = exact.find(candidate => candidate.goal.id === requestedId
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
      assertExportReport(record.goal, record.report);
      const recordedPositive = positiveStatus(record.report.status);
      let report = record.report;
      if (recordedPositive) {
        if (!record.replay) return unknownSummary(record.goal, selection);
        const replayed = await record.replay();
        assertExportReport(record.goal, replayed);
        if (replayed.status !== record.report.status
          || replayed.routes[0]?.witness.proofHash !== record.report.routes[0]?.witness.proofHash) {
          return unknownSummary(record.goal, selection);
        }
        report = replayed;
      }
      const positive = positiveStatus(report.status);
      const witness = report.routes[0]?.witness;
      if (positive && (!witness || witness.runId !== selection.runId
        || witness.runRevision !== selection.runRevision
        || witness.sourceVersion !== selection.sourceVersion
        || await hashProofWitness(witness) !== witness.proofHash)) {
        return unknownSummary(record.goal, selection);
      }
      const blockerLabels = report.status === 'BLOCKED'
        ? [...new Set(report.blockers.flatMap(blocker => blocker.labels))]
        : [];
      const unavoidableIds = new Set(report.unavoidableBlockerFactIds);
      const unavoidableBlockerLabels = report.status === 'BLOCKED'
        ? [...new Set(report.blockers.flatMap(blocker => blocker.factIds
          .map((factId, index) => unavoidableIds.has(factId) ? blocker.labels[index] : undefined)
          .filter((label): label is string => label !== undefined)))]
        : [];
      const routeLabels = positive && witness
        ? [...new Set(Object.keys(witness.steps).sort(compareText)
          .map(stepId => witness.steps[stepId].sourceLabel
            ?? witness.steps[stepId].proves.label))]
        : [];
      return {
        goalId: record.goal.id, goalLabel: record.goal.label, status: report.status,
        explanation: report.explanation ?? defaultExplanation(report.status),
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

function assertExportReport(goal: CompiledGoal, report: RuneProofReport): void {
  if (report.goalId !== goal.id) throw new Error('Invalid RuneProof export record');
  if (!positiveStatus(report.status)) {
    assertRuneProofReport(report);
    return;
  }
  const witnessRoot = report.routes[0]?.witness.rootFactId;
  if (!witnessRoot || report.routes.some(route => route.witness.rootFactId !== witnessRoot)) {
    throw new Error('Invalid RuneProof export record');
  }
  assertRuneProofReport({ ...report, goalId: witnessRoot });
}
function positiveStatus(status: RuneProofReport['status']): boolean {
  return status === 'OBTAINABLE' || status === 'OBTAINABLE_RNG';
}
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
function recordKey(runId: string, runRevision: number, sourceVersion: string, goalId: string): string {
  return JSON.stringify([runId, runRevision, sourceVersion, goalId]);
}
function selectionIdentityKey(runId: string, runRevision: number, sourceVersion: string): string {
  return JSON.stringify([runId, runRevision, sourceVersion]);
}
function newestRecordFirst(left: RuneProofExportRecord, right: RuneProofExportRecord): number {
  return right.runRevision - left.runRevision || compareText(right.sourceVersion, left.sourceVersion);
}
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
    if (cached) {
      this.exportRegistry.record(query.goal, cached, snapshot, sourceVersion,
        () => this.replay(query, snapshot, sourceVersion));
      return cached;
    }
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
      this.exportRegistry.record(query.goal, result, snapshot, sourceVersion,
        () => this.replay(query, snapshot, sourceVersion));
      this.cache.set(key, result);
      return result;
    } catch (error) {
      if (controller.signal.aborted || this.disposed) return null;
      throw error;
    } finally {
      if (this.active === controller) this.active = null;
    }
  }

  private async replay(
    query: RuneProofQuery,
    recordedSnapshot: RuneProofRunSnapshot,
    sourceVersion: string,
  ): Promise<RuneProofReport> {
    const current = this.currentSnapshot();
    if (this.engine.sourceVersion !== sourceVersion
      || current.runId !== recordedSnapshot.runId
      || current.runRevision !== recordedSnapshot.runRevision) {
      throw new Error('Stale RuneProof export replay');
    }
    return this.engine.evaluate(query, current);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.serial += 1;
    this.active?.abort();
    this.active = null;
    this.cache.clear();
    this.engine.dispose?.();
  }
}

function flags(query: RuneProofQuery): string { return `alternatives=${query.includeAlternatives !== false};blockers=${query.includeBlockers !== false}`; }
