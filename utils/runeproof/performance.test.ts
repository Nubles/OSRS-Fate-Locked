import { afterAll, describe, expect, it } from 'vitest';
import chunkDocumentJson from '../../public/chunk-content.json';
import sourceDocumentJson from '../../public/runeproof-sources.json';
import chunkAuditJson from '../../data/sources/chunk-content-transform-audit.json';
import questAuditJson from '../../data/sources/quest-requirement-audit.json';
import trustedCatalogJson from '../../data/sources/runeproof-trusted-acquisition-sources.json';
import travelAuditJson from '../../data/sources/runeproof-reviewed-travel-audit.json';
import reviewedAcquisitionJson from '../../data/sources/runeproof-reviewed-acquisition-sources.json';
import { loadRuneProofSourceAudit } from '../../data/runeProofSourceAudit';
import { RESOURCE_MAP } from '../../data/resourceData';
import type { RuneProofRunSnapshot } from '../../types';
import {
  compileAcquisitionArtifacts,
  type AcquisitionCompilerInput,
  type ReviewedAcquisitionSource,
  type RuneProofSourceDocument,
} from './acquisitionIndex';
import {
  createRuneProofEngine,
  createRuneProofExecutor,
  type RuneProofEngineSources,
} from './engine';
import { evaluateObtainability } from './evaluator';
import { compileItemGoal, type CompiledGoal } from './goalCompiler';
import type {
  AcquisitionRule,
  FactKind,
  FactRef,
  RequirementExpr,
  RuneProofReport,
  SourceKind,
} from './model';
import {
  RuneProofExportRegistry,
  RuneProofService,
} from '../../services/RuneProofService';

const RUNS = 20;
const START_LOCATION = 'surface:50,50';
const PRODUCTION_ACQUISITION_URL =
  `/runeproof-sources.json?v=${encodeURIComponent(sourceDocumentJson.sourceVersion)}`;
const empty: RequirementExpr = { op: 'ALL', terms: [] };
const metrics: BenchmarkMetric[] = [];

interface BenchmarkMetric {
  name: string;
  medianMs: number;
  p95Ms: number;
}

interface ChunkSource {
  sourceMeta?: { commit?: string };
  locationNodes?: AcquisitionCompilerInput['locationNodes'];
  locationEdges?: RuneProofEngineSources['locationGraph']['edges'];
  chunks?: AcquisitionCompilerInput['chunks'];
  shopItems?: AcquisitionCompilerInput['shopItems'];
  drops?: AcquisitionCompilerInput['drops'];
  taskUnlocks?: AcquisitionCompilerInput['taskUnlocks'];
}

const sourceDocument =
  sourceDocumentJson as unknown as RuneProofSourceDocument;
const chunkDocument = chunkDocumentJson as unknown as ChunkSource;
const productionSourceAudit = await loadRuneProofSourceAudit();
const fullSources: RuneProofEngineSources = {
  sourceVersion: sourceDocument.sourceVersion,
  sourceAudit: productionSourceAudit,
  acquisition: sourceDocument,
  locationGraph: sourceDocument.locationGraph!,
};
const ordinaryGoal = compileItemGoal(
  { id: 'item:plank', label: 'Plank' },
  1,
);
const currentRun = snapshot({
  unlockedChunks: sourceDocument.locationGraph!.nodes
    .map(node => node.surfaceChunk),
});

describe('RuneProof selective-solving performance acceptance', () => {
  it('cold-compiles the complete checked-in audited source corpus 20 times', () => {
    const input = fullCompilerInput();
    const fingerprints = sampleSync('cold source compilation', () => {
      const compiled = compileAcquisitionArtifacts(input);
      expect(compiled.document.counts).toEqual({
        rules: sourceDocument.counts.rules,
        unresolvedSources: sourceDocument.counts.unresolvedSources,
      });
      expect(compiled.document.sourceVersion).toBe(sourceDocument.sourceVersion);
      expect(compiled.document.locationGraph).toEqual(fullSources.locationGraph);
      expect(compiled.document.travelAuditCatalog).toEqual(travelAuditJson);
      expect(compiled.trustedCatalog.sourceVersion)
        .toBe(trustedCatalogJson.sourceVersion);
      expect(compiled.trustedCatalog.entries.map(entry => entry.id))
        .toEqual(trustedCatalogJson.entries.map(entry => entry.id));
      return `${compiled.document.sourceVersion}|${compiled.trustedCatalog.sourceVersion}`;
    });

    expect(fingerprints).toHaveLength(RUNS);
    expect(new Set(fingerprints).size).toBe(1);
  }, 120_000);

  it('meets query budgets for the full graph and deterministic hard cases', async () => {
    const coldReports = await sampleAsync(
      'cold ordinary query',
      () => createRuneProofEngine(fullSources)
        .evaluate({ goal: ordinaryGoal }, currentRun),
    );
    expect(coldReports.every(report => report.status === 'OBTAINABLE'))
      .toBe(true);
    expect(lastMetric('cold ordinary query').p95Ms).toBeLessThan(250);

    const cacheRegistry = new RuneProofExportRegistry();
    const service = new RuneProofService(
      createRuneProofEngine(fullSources),
      () => currentRun,
      cacheRegistry,
    );
    await service.evaluate({ goal: ordinaryGoal });
    const cachedReports = await sampleAsync(
      'cached ordinary query',
      () => service.evaluate({ goal: ordinaryGoal }),
    );
    expect(cachedReports.every(report => report?.status === 'OBTAINABLE'))
      .toBe(true);
    expect(lastMetric('cached ordinary query').p95Ms).toBeLessThan(50);
    service.dispose();

    const recursive = recursiveFixture(14);
    const recursiveReports = await sampleAsync(
      'deep recursive production goal',
      () => createRuneProofEngine(recursive.sources)
        .evaluate({ goal: recursive.goal }, currentRun),
    );
    expect(recursiveReports.every(report =>
      report.status === 'OBTAINABLE'
      && Object.keys(report.routes[0].witness.steps).length === 15,
    )).toBe(true);

    const alternatives = alternativeQuestFixture(recursive);
    const alternativeReports = await sampleAsync(
      'quest with alternatives',
      () => createRuneProofEngine(alternatives.sources)
        .evaluate({ goal: alternatives.goal }, alternatives.snapshot),
    );
    expect(alternativeReports.every(report =>
      report.status === 'OBTAINABLE'
      && Object.values(report.routes[0].witness.steps).some(step =>
        step.ruleId === 'seed:quest:benchmark-permit'),
    )).toBe(true);

    const blocker = cartesianBlockerFixture(7);
    const blockerReports = await sampleAsync(
      'worst checked-in blocker fixture',
      () => createRuneProofEngine(blocker.sources)
        .evaluate({ goal: blocker.goal }, currentRun),
    );
    expect(blockerReports.every(report =>
      report.status === 'BLOCKED'
      && report.routesComplete
      && report.blockers.length === 128
      && report.blockers.every(set => set.factIds.length === 7),
    )).toBe(true);
    expect(lastMetric('worst checked-in blocker fixture').p95Ms)
      .toBeLessThan(1_000);

    const exportRules = Array.from({ length: 20 }, (_, index) =>
      rule(`benchmark-export-${String(index + 1).padStart(2, '0')}`,
        `Benchmark export ${String(index + 1).padStart(2, '0')}`));
    const exportSources = verifiedSources(exportRules);
    const exportGoals = exportRules.map(exportRule => compileItemGoal(
      { id: exportRule.output.id, label: exportRule.output.label },
      1,
    ));
    const exportReports = await Promise.all(
      exportGoals.map(goal =>
        createRuneProofEngine(exportSources).evaluate({ goal }, currentRun)),
    );
    expect(exportReports.every(report =>
      report.status === 'OBTAINABLE' || report.status === 'OBTAINABLE_RNG',
    )).toBe(true);
    let replayCalls = 0;
    const replayEngine = createRuneProofEngine(exportSources);
    const exportBatches = await sampleAsync(
      '20 pinned proof exports',
      () => exportTwentyProofs(
        exportGoals,
        exportReports,
        replayEngine,
        () => { replayCalls += 1; },
      ),
    );
    expect(exportBatches.every(batch =>
      batch.length === 20
      && batch.every(summary => summary.proofHash?.startsWith('sha256-')),
    )).toBe(true);
    expect(replayCalls).toBe(RUNS * 20);
  }, 120_000);

  it('fails closed at route and blocker bounds and keeps production worker dispatch small', async () => {
    const direct = rule('benchmark-route-cap', 'Route capped item');
    const routeCap = evaluateObtainability(direct.output, {
      rules: [...sourceDocument.rules, direct],
      snapshot: currentRun,
      reachableLocations: new Set([START_LOCATION]),
      sourceVersion: sourceDocument.sourceVersion,
      coverage: 'VERIFIED',
      limits: { maxIterations: 1_000, maxRoutes: 0 },
    });
    expect(routeCap).toMatchObject({
      status: 'UNKNOWN', routes: [], blockers: [], routesComplete: false,
    });
    expect(routeCap.explanation).toContain('maxRoutes');

    const blockerCap = cartesianBlockerFixture(8);
    const blockerReport = await createRuneProofEngine(blockerCap.sources)
      .evaluate({ goal: blockerCap.goal }, currentRun);
    expect(blockerReport).toMatchObject({
      status: 'UNKNOWN', routes: [], blockers: [], routesComplete: false,
    });
    expect(blockerReport.explanation).toContain('maxBlockerSets');

    const blockerSizeCap = blockerFixture(17);
    const blockerSizeReport = await createRuneProofEngine(blockerSizeCap.sources)
      .evaluate({ goal: blockerSizeCap.goal }, currentRun);
    expect(blockerSizeReport).toMatchObject({
      status: 'UNKNOWN', routes: [], blockers: [], routesComplete: false,
    });
    expect(blockerSizeReport.explanation).toContain('maxSetSize');

    const originalWorker = globalThis.Worker;
    let workerInstance: DeferredWorker | undefined;
    try {
      globalThis.Worker = class extends DeferredWorker {
        constructor() {
          super();
          workerInstance = this;
        }
      } as unknown as typeof Worker;
      const executor = createRuneProofExecutor(fullSources, {
        acquisitionUrl: PRODUCTION_ACQUISITION_URL,
      });
      const first = executor.evaluate({ goal: ordinaryGoal }, currentRun);
      expect(workerInstance?.messages).toHaveLength(2);
      expect(workerInstance?.messages[0]).toMatchObject({
        type: 'INITIALIZE',
        acquisitionUrl: PRODUCTION_ACQUISITION_URL,
        sourceVersion: fullSources.sourceVersion,
        sourceAudit: fullSources.sourceAudit,
        locationGraph: fullSources.locationGraph,
      });
      expect(workerInstance?.messages[0]).not.toHaveProperty('sources');
      expect(workerInstance?.messages[0]).not.toHaveProperty('acquisition');
      expect(workerInstance?.messages[1]).toMatchObject({
        type: 'EVALUATE', id: 1, query: { goal: ordinaryGoal },
        snapshot: currentRun,
      });
      expect(workerInstance?.messages[1]).not.toHaveProperty('sources');
      workerInstance?.reply(1, unknownReport(ordinaryGoal.id));
      expect((await first).status).toBe('UNKNOWN');

      const second = executor.evaluate({ goal: ordinaryGoal }, currentRun);
      expect(workerInstance?.messages).toHaveLength(3);
      expect(workerInstance?.messages[2]).toMatchObject({
        type: 'EVALUATE', id: 2,
      });
      expect(workerInstance?.messages.filter(message =>
        message.type === 'INITIALIZE',
      )).toHaveLength(1);
      workerInstance?.reply(2, unknownReport(ordinaryGoal.id));
      expect((await second).status).toBe('UNKNOWN');

      sampleVoidSync('production worker initialization clone', () => {
        structuredClone(workerInstance!.messages[0]);
      });
      sampleVoidSync('subsequent worker request clone', () => {
        structuredClone(workerInstance!.messages[1]);
      });
      expect(lastMetric('production worker initialization clone').p95Ms)
        .toBeLessThan(10);
      expect(lastMetric('subsequent worker request clone').p95Ms)
        .toBeLessThan(10);
    } finally {
      globalThis.Worker = originalWorker;
    }

    let terminated = false;
    try {
      globalThis.Worker = class {
        onmessage: ((event: MessageEvent) => void) | null = null;
        onerror: ((event: ErrorEvent) => void) | null = null;
        postMessage(): void {
          throw new DOMException('cannot clone sources', 'DataCloneError');
        }
        terminate(): void { terminated = true; }
      } as unknown as typeof Worker;
      const selected = createRuneProofExecutor(fullSources);
      const expected = await createRuneProofEngine(fullSources)
        .evaluate({ goal: ordinaryGoal }, currentRun);
      expect(await selected.evaluate({ goal: ordinaryGoal }, currentRun))
        .toEqual(expected);
      expect(terminated).toBe(true);
    } finally {
      globalThis.Worker = originalWorker;
    }
  });

  it('latches worker errors before and during queries and uses fallback forever', async () => {
    const originalWorker = globalThis.Worker;
    const expected = await createRuneProofEngine(fullSources)
      .evaluate({ goal: ordinaryGoal }, currentRun);
    try {
      let beforeWorker: DeferredWorker | undefined;
      globalThis.Worker = class extends DeferredWorker {
        constructor() { super(); beforeWorker = this; }
      } as unknown as typeof Worker;
      const before = createRuneProofExecutor(fullSources, {
        acquisitionUrl: PRODUCTION_ACQUISITION_URL,
      });
      beforeWorker?.crash();
      const beforeResult = before.evaluate({ goal: ordinaryGoal }, currentRun);
      expect(beforeWorker?.terminated).toBe(true);
      expect(beforeWorker?.messages).toHaveLength(1);
      expect(await beforeResult).toEqual(expected);

      let duringWorker: DeferredWorker | undefined;
      globalThis.Worker = class extends DeferredWorker {
        constructor() { super(); duringWorker = this; }
      } as unknown as typeof Worker;
      const during = createRuneProofExecutor(fullSources, {
        acquisitionUrl: PRODUCTION_ACQUISITION_URL,
      });
      const pending = during.evaluate({ goal: ordinaryGoal }, currentRun);
      expect(duringWorker?.messages).toHaveLength(2);
      duringWorker?.crash();
      expect(duringWorker?.terminated).toBe(true);
      expect(await pending).toEqual(expected);
      const future = during.evaluate({ goal: ordinaryGoal }, currentRun);
      expect(duringWorker?.messages).toHaveLength(2);
      expect(await future).toEqual(expected);

      let initializationWorker: DeferredWorker | undefined;
      globalThis.Worker = class extends DeferredWorker {
        constructor() { super(); initializationWorker = this; }
      } as unknown as typeof Worker;
      const initialization = createRuneProofExecutor(fullSources, {
        acquisitionUrl: PRODUCTION_ACQUISITION_URL,
      });
      const initializationPending =
        initialization.evaluate({ goal: ordinaryGoal }, currentRun);
      initializationWorker?.fail(
        1,
        'RuneProof acquisition source version mismatch',
      );
      expect(initializationWorker?.terminated).toBe(true);
      expect(await initializationPending).toEqual(expected);
      expect(await initialization.evaluate({ goal: ordinaryGoal }, currentRun))
        .toEqual(expected);
      expect(initializationWorker?.messages).toHaveLength(2);
    } finally {
      globalThis.Worker = originalWorker;
    }
  });

  it('terminates the worker and rejects pending and future work on disposal', async () => {
    const originalWorker = globalThis.Worker;
    let workerInstance: DeferredWorker | undefined;
    try {
      globalThis.Worker = class extends DeferredWorker {
        constructor() { super(); workerInstance = this; }
      } as unknown as typeof Worker;
      const executor = createRuneProofExecutor(fullSources, {
        acquisitionUrl: PRODUCTION_ACQUISITION_URL,
      });
      const pending = executor.evaluate({ goal: ordinaryGoal }, currentRun);
      expect(typeof executor.dispose).toBe('function');
      executor.dispose?.();
      expect(workerInstance?.terminated).toBe(true);
      await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
      await expect(executor.evaluate({ goal: ordinaryGoal }, currentRun))
        .rejects.toMatchObject({ name: 'AbortError' });
      expect(workerInstance?.messages).toHaveLength(2);
    } finally {
      globalThis.Worker = originalWorker;
    }
  });
});

afterAll(() => {
  for (const metric of metrics) {
    console.info(
      `[RuneProof benchmark] ${metric.name}: median ${metric.medianMs.toFixed(3)} ms, p95 ${metric.p95Ms.toFixed(3)} ms (${RUNS} runs)`,
    );
  }
});

function sampleSync<T>(name: string, operation: () => T): T[] {
  const samples: number[] = [];
  const results: T[] = [];
  for (let run = 0; run < RUNS; run += 1) {
    const started = performance.now();
    const result = operation();
    samples.push(performance.now() - started);
    results.push(result);
  }
  recordMetric(name, samples);
  return results;
}

function sampleVoidSync(name: string, operation: () => void): void {
  const samples: number[] = [];
  for (let run = 0; run < RUNS; run += 1) {
    const started = performance.now();
    operation();
    samples.push(performance.now() - started);
  }
  recordMetric(name, samples);
}

async function sampleAsync<T>(
  name: string,
  operation: () => Promise<T>,
): Promise<T[]> {
  const samples: number[] = [];
  const results: T[] = [];
  for (let run = 0; run < RUNS; run += 1) {
    const started = performance.now();
    const result = await operation();
    samples.push(performance.now() - started);
    results.push(result);
  }
  recordMetric(name, samples);
  return results;
}

function recordMetric(name: string, samples: readonly number[]): void {
  const ordered = [...samples].sort((left, right) => left - right);
  const metric = {
    name,
    medianMs: percentile(ordered, 0.5),
    p95Ms: percentile(ordered, 0.95),
  };
  const existing = metrics.findIndex(value => value.name === name);
  if (existing >= 0) metrics.splice(existing, 1, metric);
  else metrics.push(metric);
}

function percentile(ordered: readonly number[], value: number): number {
  return ordered[Math.max(0, Math.ceil(ordered.length * value) - 1)];
}

function lastMetric(name: string): BenchmarkMetric {
  const metric = metrics.find(value => value.name === name);
  if (!metric) throw new Error(`Missing benchmark metric: ${name}`);
  return metric;
}

function fullCompilerInput(): AcquisitionCompilerInput {
  return {
    sourceCommit: chunkDocument.sourceMeta?.commit ?? 'unknown',
    locationNodes: chunkDocument.locationNodes ?? [],
    locationGraph: fullSources.locationGraph,
    travelAuditCatalog: travelAuditJson as unknown as
      AcquisitionCompilerInput['travelAuditCatalog'],
    chunks: chunkDocument.chunks ?? {},
    shopItems: chunkDocument.shopItems ?? {},
    drops: chunkDocument.drops ?? {},
    taskUnlocks: chunkDocument.taskUnlocks ?? {},
    questIds: questAuditJson.entries.map(entry => entry.id),
    transformEvents:
      chunkAuditJson.events as AcquisitionCompilerInput['transformEvents'],
    productionRecipes: [],
    reviewedSources: reviewedSources(),
  };
}

function reviewedSources(): ReviewedAcquisitionSource[] {
  return [
    ...Object.entries(RESOURCE_MAP)
    .sort(([left], [right]) => compareText(left, right))
    .flatMap(([output, sources]) => sources.map(
      (source, index): ReviewedAcquisitionSource => ({
        output,
        sourceKind: resourceSourceKind(source),
        sourceHost: source.name,
        regions: [...source.regions].sort(compareText),
        coverage: source.regions.includes('Any') ? 'UNKNOWN' : 'PARTIAL',
        provenanceIds: [trustedSourceId(output, index)],
      }),
    )),
    ...(reviewedAcquisitionJson.sources as ReviewedAcquisitionSource[]),
  ];
}

function resourceSourceKind(
  source: (typeof RESOURCE_MAP)[string][number],
): SourceKind {
  switch (source.type) {
    case 'DROP': return 'DROP';
    case 'SHOP': return 'SHOP';
    case 'MERCHANT': return source.inputs ? 'PRODUCTION' : 'SHOP';
    case 'SPAWN': return 'SPAWN';
    case 'SKILL': return source.inputs ? 'PRODUCTION' : 'GATHERING';
    case 'MINIGAME': return 'MINIGAME';
    case 'QUEST': return 'QUEST_REWARD';
    case 'PICKPOCKET': return 'PICKPOCKET';
    case 'CLUE': return 'CLUE';
  }
}

function recursiveFixture(depth: number): {
  goal: CompiledGoal;
  sources: RuneProofEngineSources;
  rules: AcquisitionRule[];
} {
  const rules = [
    rule('benchmark-recursive-00', recursiveLabel(0), {
      sourceKind: 'SPAWN',
    }),
    ...Array.from({ length: depth }, (_, index) =>
      rule(
        `benchmark-recursive-${String(index + 1).padStart(2, '0')}`,
        recursiveLabel(index + 1),
        {
          requirements: requirement('ITEM', recursiveLabel(index)),
        },
      )),
  ];
  const goal = compileItemGoal(
    {
      id: `item:${normalizeId(recursiveLabel(depth))}`,
      label: recursiveLabel(depth),
    },
    1,
  );
  return { goal, sources: verifiedSources(rules), rules };
}

function alternativeQuestFixture(recursive: ReturnType<typeof recursiveFixture>): {
  goal: CompiledGoal;
  sources: RuneProofEngineSources;
  snapshot: RuneProofRunSnapshot;
} {
  const permit = fact('QUEST', 'Benchmark permit');
  const goal: CompiledGoal = {
    id: 'quest:benchmark-alternatives',
    kind: 'QUEST',
    label: 'Benchmark alternatives',
    requirement: {
      op: 'ANY',
      terms: [
        requirement('ITEM', recursive.goal.label),
        { op: 'FACT', fact: permit },
      ],
    },
    coverage: 'VERIFIED',
    provenanceIds: ['benchmark:quest-alternatives'],
    sourceVersion: 'benchmark-goal-v1',
  };
  return {
    goal,
    sources: recursive.sources,
    snapshot: snapshot({ completedQuests: [permit.label] }),
  };
}

function blockerFixture(size: number): {
  goal: CompiledGoal;
  sources: RuneProofEngineSources;
} {
  const goal = compileItemGoal(
    { id: 'item:bounded-blocker-goal', label: 'Bounded blocker goal' },
    1,
  );
  const terms = Array.from({ length: size }, (_, index) =>
    requirement(
      'QUEST',
      `Benchmark gate ${String(index + 1).padStart(2, '0')}`,
    ));
  const blockerRule = rule('benchmark-blocker', goal.label, {
    requirements: { op: 'ALL', terms },
  });
  return { goal, sources: verifiedSources([blockerRule]) };
}

function cartesianBlockerFixture(binaryBranches: number): {
  goal: CompiledGoal;
  sources: RuneProofEngineSources;
} {
  const goal = compileItemGoal(
    { id: 'item:cartesian-blocker-goal', label: 'Cartesian blocker goal' },
    1,
  );
  const terms = Array.from({ length: binaryBranches }, (_, branch) => ({
    op: 'ANY' as const,
    terms: [0, 1].map(choice => requirement(
      'QUEST',
      `Cartesian gate ${String(branch + 1).padStart(2, '0')}-${choice + 1}`,
    )),
  }));
  return {
    goal,
    sources: verifiedSources([rule('benchmark-cartesian-blocker', goal.label, {
      requirements: { op: 'ALL', terms },
    })]),
  };
}

function verifiedSources(extraRules: readonly AcquisitionRule[]): RuneProofEngineSources {
  const syntheticSourceVersion = 'benchmark-synthetic-v1';
  const families = ['DROP', 'PRODUCTION', 'RESOURCE_ENGINE', 'SHOP', 'SPAWN'] as const;
  const sourceFamilyAccounting = Object.fromEntries(families.map(family => {
    const current = sourceDocument.sourceFamilyAccounting[family];
    const added = extraRules.filter(rule => rule.sourceKind === family);
    return [family, {
      ...current,
      ruleCount: current.ruleCount + added.length,
      ruleIds: [...current.ruleIds, ...added.map(rule => rule.id)],
      unresolvedCount: 0,
      unresolvedIds: [],
    }];
  })) as RuneProofSourceDocument['sourceFamilyAccounting'];
  const provenanceCatalog = [
    ...sourceDocument.provenanceCatalog.map(entry => ({
      ...entry,
      unresolvedIds: [],
    })),
    ...[...new Set(extraRules.flatMap(rule => rule.provenanceIds))]
      .sort(compareText)
      .map(id => ({
        id,
        kind: 'UNKNOWN' as const,
        coverage: 'VERIFIED' as const,
        ruleIds: extraRules.filter(rule => rule.provenanceIds.includes(id))
          .map(rule => rule.id),
        unresolvedIds: [],
      })),
  ];
  return {
    sourceVersion: syntheticSourceVersion,
    sourceAudit: {
      sourceVersion: syntheticSourceVersion,
      questCoverage: 'VERIFIED',
      chunkCoverage: 'VERIFIED',
      acquisitionCoverage: 'VERIFIED',
    },
    locationGraph: {
      ...fullSources.locationGraph,
      nodes: fullSources.locationGraph.nodes.map(node => ({
        ...node,
        coverage: 'VERIFIED',
      })),
    },
    acquisition: {
      ...sourceDocument,
      sourceVersion: syntheticSourceVersion,
      counts: {
        rules: sourceDocument.rules.length + extraRules.length,
        unresolvedSources: 0,
      },
      acquisitionCoverage: 'VERIFIED',
      sourceFamilyAccounting,
      provenanceCatalog,
      rules: [...sourceDocument.rules, ...extraRules],
      unresolvedSources: [],
    },
  };
}


async function exportTwentyProofs(
  goals: readonly CompiledGoal[],
  reports: readonly RuneProofReport[],
  engine: ReturnType<typeof createRuneProofEngine>,
  onReplay: () => void,
): Promise<Awaited<ReturnType<RuneProofExportRegistry['select']>>> {
  const registry = new RuneProofExportRegistry();
  goals.forEach((goal, index) => {
    const report = reports[index];
    registry.record(
      goal,
      report,
      currentRun,
      engine.sourceVersion,
      async () => {
        onReplay();
        return engine.evaluate({ goal }, currentRun);
      },
    );
  });
  return registry.select({
    runId: currentRun.runId,
    runRevision: currentRun.runRevision,
    sourceVersion: engine.sourceVersion,
    pinnedGoalIds: goals.map(goal => goal.id),
  });
}

function rule(
  id: string,
  outputLabel: string,
  overrides: Partial<AcquisitionRule> = {},
): AcquisitionRule {
  return {
    id,
    output: fact('ITEM', outputLabel),
    outputQuantity: 1,
    sourceKind: 'PRODUCTION',
    sourceLabel: id,
    locationId: START_LOCATION,
    requirements: empty,
    repeatability: 'REPEATABLE',
    probability: null,
    coverage: 'VERIFIED',
    provenanceIds: [`benchmark:${id}`],
    ...overrides,
  };
}

function requirement(
  kind: FactKind,
  label: string,
  quantity?: number,
): RequirementExpr {
  return { op: 'FACT', fact: fact(kind, label, quantity) };
}

function fact(kind: FactKind, label: string, quantity?: number): FactRef {
  return {
    id: `${kind.toLowerCase().replace('_', '-')}:${normalizeId(label)}`,
    kind,
    label,
    ...(quantity === undefined ? {} : { quantity }),
  };
}

function snapshot(
  overrides: Partial<RuneProofRunSnapshot> = {},
): RuneProofRunSnapshot {
  return {
    runId: 'runeproof-performance-run',
    runRevision: 1,
    gameModeId: 'chunked',
    equipmentTiers: {},
    skillCaps: {},
    currentLevels: {},
    unlockedAreas: [],
    unlockedChunks: [],
    unlockedMobility: [],
    unlockedArcana: [],
    unlockedHousing: [],
    unlockedMerchants: [],
    unlockedMinigames: [],
    unlockedBosses: [],
    unlockedStorage: [],
    unlockedGuilds: [],
    unlockedFarming: [],
    unlockedSlayer: [],
    unlockedBanks: [],
    completedQuests: [],
    completedDiaries: [],
    completedCombatAchievements: [],
    completedTasks: [],
    collectionLog: {},
    ...overrides,
  };
}

class DeferredWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  messages: Record<string, unknown>[] = [];
  terminated = false;

  postMessage(message: Record<string, unknown>): void {
    this.messages.push(message);
  }

  reply(id: number, report: RuneProofReport): void {
    this.onmessage?.({
      data: { id, report },
    } as MessageEvent);
  }

  fail(id: number, error: string): void {
    this.onmessage?.({ data: { id, error, fatal: true } } as MessageEvent);
  }

  crash(): void {
    this.onerror?.({ message: 'worker crashed' } as ErrorEvent);
  }

  terminate(): void {
    this.terminated = true;
  }
}

function unknownReport(goalId: string): RuneProofReport {
  return {
    goalId,
    status: 'UNKNOWN',
    coverage: 'UNKNOWN',
    routes: [],
    blockers: [],
    unavoidableBlockerFactIds: [],
    routesComplete: false,
  };
}

function recursiveLabel(index: number): string {
  return `Recursive component ${String(index).padStart(2, '0')}`;
}

function normalizeId(value: string): string {
  return value.trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const trustedSourceIds = new Map<string, string>(
  sourceDocument.provenanceCatalog.flatMap(entry =>
    entry.payload?.sourceIds.flatMap(id => {
      const match = /:(\d{4})$/.exec(id);
      return match
        ? [[`${entry.payload!.output}\u0000${match[1]}`, id] as const]
        : [];
    }) ?? [],
  ),
);

function trustedSourceId(output: string, index: number): string {
  const key = `${output}\u0000${String(index).padStart(4, '0')}`;
  const id = trustedSourceIds.get(key);
  if (!id) throw new Error(`Missing trusted source id: ${key}`);
  return id;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
