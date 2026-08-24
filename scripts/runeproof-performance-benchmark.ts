import { describe, expect, it } from 'vitest';
import { cpus } from 'node:os';
import {
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { fileURLToPath } from 'node:url';
import { filterRuneProofCatalogue } from '../components/questStrategies/RuneProofCatalogueFilters';
import { withSelectedRuneProofBranch } from '../utils/questStrategies/branches';
import { buildRuneProofPackCoachModel } from '../utils/questStrategies/coach';
import {
  preflightRuneProofObjectives,
  rankRuneProofObjectives,
} from '../utils/questStrategies/objectives';
import type {
  RuneProofAction,
  RuneProofCompiledPack,
} from '../utils/questStrategies/packModel';
import {
  canonicalRuneProofProgressJson,
  readRuneProofProgressIndex,
  RUNEPROOF_PROGRESS_INDEX_MAX_CHARS,
  runeProofProgressIndexStorageKey,
} from '../utils/questStrategies/progress';
import {
  branchingPack,
  emptyProgressFor,
  makeCatalogueSummaries,
  progressSummary,
  readyRequirementSnapshot,
} from '../utils/questStrategies/testFixtures';

interface BenchmarkOperation {
  readonly id: string;
  run(): unknown;
  validate(result: unknown): void;
  validateInputs?(): void;
}

interface OperationTiming {
  readonly medianMilliseconds: number;
  readonly p95Milliseconds: number;
}

interface RuneProofPerformanceOperationBudget extends OperationTiming {
  readonly ceilingMilliseconds: number;
}

interface RuneProofPerformanceProfile {
  readonly id: string;
  readonly nodeVersion: string;
  readonly platform: string;
  readonly arch: string;
  readonly cpuModel: string;
  readonly logicalCpuCount: number;
  readonly warmups: 5;
  readonly samples: 25;
  readonly operations: Readonly<Record<string, RuneProofPerformanceOperationBudget>>;
}

interface RuneProofPerformanceBudgets {
  readonly schemaVersion: 1;
  readonly profiles: readonly Readonly<RuneProofPerformanceProfile>[];
}

interface BenchmarkRunResult {
  readonly timings: Readonly<Record<string, OperationTiming>>;
  readonly record: boolean;
  readonly enforced: boolean;
}

type HardwareProfile = Pick<
  RuneProofPerformanceProfile,
  'nodeVersion' | 'platform' | 'arch' | 'cpuModel' | 'logicalCpuCount'
>;

const OPERATION_IDS = Object.freeze([
  'catalogue-preflight-210',
  'catalogue-search-filter-210',
  'recommendations-rank-top-3',
  'selected-pack-coach-100-actions',
  'branch-switch-8-branches-160-actions',
  'progress-index-parse-serialize-210',
] as const);

const WARMUP_SAMPLES = 5;
const MEASURED_SAMPLES = 25;

const ceilingFor = (p95Milliseconds: number): number => (
  Math.max(5, Math.ceil((p95Milliseconds * 1.5) / 5) * 5)
);

const summarizeSamples = (samples: readonly number[]): OperationTiming => {
  invariant(samples.length === MEASURED_SAMPLES, 'Expected exactly 25 measured samples.');
  const sorted = [...samples].sort((left, right) => left - right);
  return {
    medianMilliseconds: sorted[12],
    p95Milliseconds: sorted[23],
  };
};

const measureOperation = (
  operation: BenchmarkOperation,
  now: () => number = () => performance.now(),
): OperationTiming => {
  for (let index = 0; index < WARMUP_SAMPLES; index += 1) {
    const result = operation.run();
    operation.validate(result);
    operation.validateInputs?.();
  }
  const samples = Array.from({ length: MEASURED_SAMPLES }, () => {
    const started = now();
    const result = operation.run();
    const elapsed = now() - started;
    operation.validate(result);
    operation.validateInputs?.();
    return elapsed;
  });
  return summarizeSamples(samples);
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const hasExactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index]);
};

const nonblank = (value: unknown): value is string => (
  typeof value === 'string' && value.trim().length > 0 && value === value.trim()
);

const finiteNonnegative = (value: unknown): value is number => (
  typeof value === 'number' && Number.isFinite(value) && value >= 0
);

const hardwareSignature = (profile: HardwareProfile): string => [
  profile.nodeVersion,
  profile.platform,
  profile.arch,
  profile.cpuModel,
  profile.logicalCpuCount,
].join('\u0000');

const sameHardware = (left: HardwareProfile, right: HardwareProfile): boolean => (
  hardwareSignature(left) === hardwareSignature(right)
);

const validateBudgets = (value: unknown): RuneProofPerformanceBudgets => {
  invariant(isRecord(value)
    && hasExactKeys(value, ['schemaVersion', 'profiles'])
    && value.schemaVersion === 1
    && Array.isArray(value.profiles), 'Budgets must have exact root keys and schemaVersion 1.');
  const profiles = value.profiles;
  const ids = new Set<string>();
  const signatures = new Set<string>();
  for (const candidate of profiles) {
    invariant(isRecord(candidate) && hasExactKeys(candidate, [
      'id', 'nodeVersion', 'platform', 'arch', 'cpuModel', 'logicalCpuCount',
      'warmups', 'samples', 'operations',
    ]), 'Budgets require exact profile keys.');
    invariant(nonblank(candidate.id)
      && nonblank(candidate.nodeVersion)
      && nonblank(candidate.platform)
      && nonblank(candidate.arch)
      && nonblank(candidate.cpuModel), 'Profile IDs and hardware strings must be trimmed and nonblank.');
    invariant(Number.isInteger(candidate.logicalCpuCount)
      && (candidate.logicalCpuCount as number) > 0,
    'Profile logicalCpuCount must be a positive integer.');
    invariant(candidate.warmups === WARMUP_SAMPLES && candidate.samples === MEASURED_SAMPLES,
      'Profiles must use exactly five warmups and 25 samples.');
    invariant(isRecord(candidate.operations)
      && hasExactKeys(candidate.operations, OPERATION_IDS),
    'Profiles must contain the exact benchmark operation set.');
    for (const operationId of OPERATION_IDS) {
      const budget = candidate.operations[operationId];
      invariant(isRecord(budget) && hasExactKeys(budget, [
        'medianMilliseconds', 'p95Milliseconds', 'ceilingMilliseconds',
      ]), `Operation ${operationId} must have exact metric keys.`);
      invariant(finiteNonnegative(budget.medianMilliseconds)
        && finiteNonnegative(budget.p95Milliseconds)
        && finiteNonnegative(budget.ceilingMilliseconds),
      `Operation ${operationId} metrics must be finite nonnegative numbers.`);
      invariant(budget.medianMilliseconds <= budget.p95Milliseconds,
        `Operation ${operationId} median cannot exceed p95.`);
      invariant(budget.p95Milliseconds <= budget.ceilingMilliseconds,
        `Operation ${operationId} p95 cannot exceed its ceiling.`);
      invariant(budget.ceilingMilliseconds === ceilingFor(budget.p95Milliseconds),
        `Operation ${operationId} ceiling must use the reviewed formula.`);
    }
    invariant(!ids.has(candidate.id), 'Budgets require unique profile IDs.');
    ids.add(candidate.id);
    const signature = hardwareSignature(candidate as unknown as HardwareProfile);
    invariant(!signatures.has(signature), 'Budgets require unique hardware signatures.');
    signatures.add(signature);
  }
  return value as unknown as RuneProofPerformanceBudgets;
};

const canonicalBudgetsJson = (budgets: RuneProofPerformanceBudgets): string => {
  const profiles = [...budgets.profiles]
    .sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
    .map(profile => ({
      id: profile.id,
      nodeVersion: profile.nodeVersion,
      platform: profile.platform,
      arch: profile.arch,
      cpuModel: profile.cpuModel,
      logicalCpuCount: profile.logicalCpuCount,
      warmups: profile.warmups,
      samples: profile.samples,
      operations: Object.fromEntries([...OPERATION_IDS]
        .sort()
        .map(operationId => [operationId, profile.operations[operationId]])),
    }));
  return `${JSON.stringify({ schemaVersion: 1, profiles }, null, 2)}\n`;
};

const selectReferenceProfile = (
  budgets: RuneProofPerformanceBudgets,
  hardware: HardwareProfile,
  requestedId: string | undefined,
  enforceRequested: boolean,
): Readonly<{
  profile?: RuneProofPerformanceProfile;
  enforced: boolean;
  reason: string;
}> => {
  const normalizedId = requestedId?.trim();
  const selected = normalizedId
    ? budgets.profiles.find(profile => profile.id === normalizedId)
    : budgets.profiles.find(profile => sameHardware(profile, hardware));
  if (!selected) {
    return {
      enforced: false,
      reason: normalizedId
        ? `Reference profile ${normalizedId} was not found.`
        : 'No exact hardware reference profile was found.',
    };
  }
  if (!sameHardware(selected, hardware)) {
    return {
      enforced: false,
      reason: `Reference profile ${selected.id} has a hardware mismatch.`,
    };
  }
  if (!enforceRequested) {
    return {
      profile: selected,
      enforced: false,
      reason: 'Measurement mode does not enforce wall-clock timings.',
    };
  }
  if (!normalizedId) {
    return {
      profile: selected,
      enforced: false,
      reason: 'Reference enforcement requires an explicit profile ID.',
    };
  }
  return { profile: selected, enforced: true, reason: 'Exact reference profile enforced.' };
};

const recordedBudgets = (
  budgets: RuneProofPerformanceBudgets,
  profileId: string,
  hardware: HardwareProfile,
  timings: Readonly<Record<string, OperationTiming>>,
): RuneProofPerformanceBudgets => {
  validateBudgets(budgets);
  const normalizedId = profileId.trim();
  invariant(normalizedId.length > 0, 'Recording requires an explicit nonblank profile ID.');
  invariant(hasExactKeys(timings, OPERATION_IDS),
    'Recording requires the exact benchmark operation set.');
  const round3 = (value: number): number => Math.round(value * 1_000) / 1_000;
  const operations = Object.fromEntries(OPERATION_IDS.map(operationId => {
    const timing = timings[operationId];
    invariant(timing !== undefined
      && finiteNonnegative(timing.medianMilliseconds)
      && finiteNonnegative(timing.p95Milliseconds)
      && timing.medianMilliseconds <= timing.p95Milliseconds,
    `Recorded timing for ${operationId} must be finite, nonnegative, and ordered.`);
    const medianMilliseconds = round3(timing.medianMilliseconds);
    const p95Milliseconds = round3(timing.p95Milliseconds);
    return [operationId, {
      medianMilliseconds,
      p95Milliseconds,
      ceilingMilliseconds: ceilingFor(p95Milliseconds),
    }];
  }));
  const recorded: RuneProofPerformanceProfile = {
    id: normalizedId,
    ...hardware,
    warmups: WARMUP_SAMPLES,
    samples: MEASURED_SAMPLES,
    operations,
  };
  return validateBudgets({
    schemaVersion: 1,
    profiles: [
      ...budgets.profiles.filter(profile => profile.id !== normalizedId),
      recorded,
    ].sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0),
  });
};

const benchmarkMode = (
  recordValue: string | undefined,
  enforceValue: string | undefined,
  profileId: string | undefined,
): Readonly<{ record: boolean; enforce: boolean; profileId?: string }> => {
  const record = recordValue === '1';
  const enforce = enforceValue === '1';
  invariant(!(record && enforce), 'RuneProof cannot record and enforce in the same command.');
  const normalizedId = profileId?.trim();
  if (record) {
    invariant(normalizedId !== undefined && normalizedId.length > 0,
      'Recording requires an explicit nonblank profile ID.');
  }
  return {
    record,
    enforce,
    ...(normalizedId === undefined || normalizedId.length === 0
      ? {}
      : { profileId: normalizedId }),
  };
};

const BUDGETS_PATH = fileURLToPath(new URL(
  '../data/sources/runeproof-performance-budgets.json',
  import.meta.url,
));

const currentHardware = (): HardwareProfile => {
  const processors = cpus();
  return {
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    cpuModel: processors[0]?.model.trim() || 'Unknown CPU',
    logicalCpuCount: processors.length,
  };
};

const atomicWriteBudgets = (
  budgets: RuneProofPerformanceBudgets,
): void => {
  const validated = validateBudgets(budgets);
  const contents = canonicalBudgetsJson(validated);
  const temporaryPath = `${BUDGETS_PATH}.${process.pid}.tmp`;
  try {
    writeFileSync(temporaryPath, contents, { encoding: 'utf8', flag: 'wx' });
    renameSync(temporaryPath, BUDGETS_PATH);
  } finally {
    rmSync(temporaryPath, { force: true });
  }
  invariant(readFileSync(BUDGETS_PATH, 'utf8') === contents,
    'Recorded performance budgets did not reread canonically.');
};

const runBenchmark = (): BenchmarkRunResult => {
  const mode = benchmarkMode(
    process.env.RUNEPROOF_RECORD_REFERENCE_PROFILE,
    process.env.RUNEPROOF_ENFORCE_REFERENCE_PROFILE,
    process.env.RUNEPROOF_REFERENCE_PROFILE_ID,
  );
  const originalBytes = readFileSync(BUDGETS_PATH, 'utf8');
  const budgets = validateBudgets(JSON.parse(originalBytes) as unknown);
  const hardware = currentHardware();
  const operations = benchmarkOperations();
  invariant(operations.map(operation => operation.id).join('\u0000') === OPERATION_IDS.join('\u0000'),
    'Benchmark operation IDs or order changed.');
  const timings: Record<string, OperationTiming> = {};
  for (const operation of operations) {
    timings[operation.id] = measureOperation(operation);
  }
  invariant(hasExactKeys(timings, OPERATION_IDS),
    'Benchmark did not measure the exact operation set.');

  const selection = selectReferenceProfile(
    budgets,
    hardware,
    mode.profileId,
    mode.enforce,
  );
  for (const operationId of OPERATION_IDS) {
    const timing = timings[operationId];
    invariant(timing !== undefined, `Missing timing for ${operationId}.`);
    const reference = selection.profile?.operations[operationId];
    const delta = reference === undefined
      ? 'medianDelta=n/a p95Delta=n/a'
      : `medianDelta=${(timing.medianMilliseconds - reference.medianMilliseconds).toFixed(3)}ms `
        + `p95Delta=${(timing.p95Milliseconds - reference.p95Milliseconds).toFixed(3)}ms`;
    process.stdout.write(
      `${operationId}: median=${timing.medianMilliseconds.toFixed(3)}ms `
      + `p95=${timing.p95Milliseconds.toFixed(3)}ms ${delta}\n`,
    );
    if (selection.enforced && reference !== undefined) {
      invariant(timing.p95Milliseconds <= reference.ceilingMilliseconds,
        `${operationId} p95 ${timing.p95Milliseconds.toFixed(3)}ms exceeded `
        + `${selection.profile!.id} ceiling ${reference.ceilingMilliseconds.toFixed(3)}ms.`);
    }
  }

  if (mode.record) {
    const next = recordedBudgets(budgets, mode.profileId!, hardware, timings);
    atomicWriteBudgets(next);
    process.stdout.write(`RECORDED REFERENCE PROFILE: ${mode.profileId}\n`);
  } else {
    invariant(readFileSync(BUDGETS_PATH, 'utf8') === originalBytes,
      'Measure/enforce mode must not modify the performance budget file.');
  }

  process.stdout.write(`${selection.enforced
    ? `REFERENCE PROFILE ENFORCED: ${selection.profile!.id}`
    : `REFERENCE PROFILE NOT ENFORCED: ${mode.record
      ? 'recording mode only.'
      : selection.reason}`}\n`);
  return {
    timings,
    record: mode.record,
    enforced: selection.enforced,
  };
};

const invariant = (condition: unknown, message: string): asserts condition => {
  if (!condition) throw new Error(message);
};

const syntheticAction = (
  branchId: string,
  actionIndex: number,
  actionCount: number,
): RuneProofAction => {
  const template = branchingPack.sharedActions[0];
  invariant(template !== undefined, 'Synthetic benchmark action template is missing.');
  const id = `${branchId}:action-${actionIndex + 1}`;
  return {
    ...template,
    id,
    sourceOrder: actionIndex + 1,
    instruction: `Complete synthetic action ${actionIndex + 1} on ${branchId}.`,
    dependsOn: actionIndex === 0 ? [] : [`${branchId}:action-${actionIndex}`],
    requirements: { kind: 'ALL', requirements: [] },
    itemEffects: [],
    alternatives: [],
    completion: actionIndex === actionCount - 1
      ? { kind: 'CANONICAL_QUEST_COMPLETED', questId: branchingPack.questId }
      : { kind: 'ACTION_CONFIRMED' },
  };
};

const syntheticPack = (
  branchCount: number,
  actionsPerBranch: number,
): RuneProofCompiledPack => {
  const branches = Array.from({ length: branchCount }, (_, branchIndex) => {
    const id = `branch-${branchIndex + 1}`;
    return {
      ...branchingPack.branches[0],
      id,
      label: `Branch ${branchIndex + 1}`,
      rank: {
        localRoutePenalty: branchIndex,
        newUnlockCount: 0,
        riskCost: 0,
        tieBreak: branchIndex,
      },
      actions: Array.from({ length: actionsPerBranch }, (_, actionIndex) => (
        syntheticAction(id, actionIndex, actionsPerBranch)
      )),
      checkpointIds: [],
    };
  });
  return {
    ...branchingPack,
    sharedActions: [],
    branches,
    completion: {
      ...branchingPack.completion,
      branchActionIds: Object.fromEntries(branches.map(branch => [
        branch.id,
        `${branch.id}:action-${actionsPerBranch}`,
      ])),
    },
  };
};

const benchmarkOperations = (): readonly BenchmarkOperation[] => {
  const summaries = makeCatalogueSummaries(210).map((summary, index) => ({
    ...summary,
    series: `Series ${String.fromCharCode(65 + (index % 3))}`,
    proofState: (['READY', 'CONFIRM', 'BLOCKED', 'NEEDS_REVIEW', 'COMPLETE'] as const)[index % 5],
  }));
  const snapshot = readyRequirementSnapshot();
  const emptyIndex = { schemaVersion: 2 as const, runId: 'benchmark-run', entries: {} };
  const preflightCandidates = preflightRuneProofObjectives({
    summaries,
    snapshot,
    progressIndex: emptyIndex,
  }).candidates;
  const highActionPack = syntheticPack(1, 100);
  const branchPack = syntheticPack(8, 20);
  const branchProgress = {
    ...emptyProgressFor(branchPack, 'benchmark-run'),
    selectedBranchId: 'branch-1',
  };
  const branchEvaluations = Object.fromEntries(branchPack.branches.map(branch => [
    branch.id,
    { state: 'READY' as const, evidenceComplete: true },
  ]));
  const index = {
    schemaVersion: 2 as const,
    runId: 'benchmark-run',
    entries: Object.fromEntries(summaries.map((summary, index) => [
      summary.slug,
      progressSummary({
        questId: summary.questId,
        packRevision: summary.packRevision,
        completedActionCount: index % 20,
        totalActionCount: 20,
        complete: false,
      }),
    ])),
  };
  const indexRaw = canonicalRuneProofProgressJson(index);
  const indexKey = runeProofProgressIndexStorageKey('benchmark-run');
  const indexStorage = {
    getItem: (key: string) => key === indexKey ? indexRaw : null,
    setItem: () => undefined,
    removeItem: () => undefined,
  };

  const inputSignature = (): string => canonicalRuneProofProgressJson({
    summaries,
    emptyIndex,
    highActionPack,
    branchPack,
    branchProgress,
    index,
    snapshot: {
      ...snapshot,
      completedQuestIds: [...snapshot.completedQuestIds],
      regions: [...snapshot.regions],
      chunks: [...snapshot.chunks],
      canonicalUnlocks: Object.fromEntries(Object.entries(snapshot.canonicalUnlocks)
        .map(([key, values]) => [key, [...values]])),
      transportIds: [...snapshot.transportIds],
      confirmedManualIds: [...snapshot.confirmedManualIds],
      branchCheckpointIds: [...snapshot.branchCheckpointIds],
    },
  });
  const expectedInputSignature = inputSignature();

  const operations: readonly BenchmarkOperation[] = [
    {
      id: OPERATION_IDS[0],
      run: () => preflightRuneProofObjectives({
        summaries,
        snapshot,
        progressIndex: emptyIndex,
      }),
      validate: (value) => {
        const result = value as ReturnType<typeof preflightRuneProofObjectives>;
        invariant(result.candidates.length === 210, 'Preflight did not return 210 candidates.');
        invariant(result.metrics.headerEvaluations === 210, 'Preflight header cap changed.');
        invariant(result.metrics.progressIndexLookups === 210, 'Preflight index cap changed.');
        invariant(result.metrics.packLoads === 0, 'Preflight loaded a pack.');
        invariant(result.metrics.deepAnalyses === 0, 'Preflight ran deep analysis.');
      },
    },
    {
      id: OPERATION_IDS[1],
      run: () => filterRuneProofCatalogue(summaries, {
        query: 'quest',
        kind: 'ALL',
        membership: 'MEMBERS',
        series: 'Series A',
        readiness: 'READY',
        milestone: 3,
        reviewStatus: 'PREVIEW_VALIDATED',
      }),
      validate: (value) => {
        invariant(Array.isArray(value), 'Combined catalogue filter did not return rows.');
        invariant((value as { questId: string }[]).map(row => row.questId).join('\u0000') === [
          'Quest 31', 'Quest 46', 'Quest 61', 'Quest 76', 'Quest 91', 'Quest 106',
          'Quest 121', 'Quest 136', 'Quest 151', 'Quest 166', 'Quest 181', 'Quest 196',
        ].join('\u0000'), 'Combined heterogeneous catalogue filter returned the wrong rows.');
      },
    },
    {
      id: OPERATION_IDS[2],
      run: () => rankRuneProofObjectives(preflightCandidates),
      validate: (value) => {
        invariant(Array.isArray(value), 'Recommendation rank did not return rows.');
        invariant((value as { questId: string }[]).map(row => row.questId).join('\u0000')
          === ['Quest 1', 'Quest 2', 'Quest 3'].join('\u0000'),
        'Recommendation rank returned the wrong top three order.');
      },
    },
    {
      id: OPERATION_IDS[3],
      run: () => buildRuneProofPackCoachModel({
        pack: highActionPack,
        progress: emptyProgressFor(highActionPack, 'benchmark-run'),
        requirementSnapshot: snapshot,
        completedQuestIds: new Set(),
      }),
      validate: (value) => {
        const model = value as ReturnType<typeof buildRuneProofPackCoachModel>;
        invariant(model.progress.total === 100, 'Coach did not project 100 actions.');
        invariant(model.actions.length === 100, 'Coach did not retain all 100 actions.');
        invariant(model.doNow?.id === 'branch-1:action-1', 'Coach selected the wrong action.');
        invariant(model.actions.at(-1)?.id === 'branch-1:action-100',
          'Coach projected the wrong terminal action.');
      },
    },
    {
      id: OPERATION_IDS[4],
      run: () => {
        const progress = withSelectedRuneProofBranch(
          branchProgress,
          'branch-8',
          branchPack,
          branchEvaluations,
        );
        return {
          progress,
          model: buildRuneProofPackCoachModel({
            pack: branchPack,
            progress,
            requirementSnapshot: snapshot,
            completedQuestIds: new Set(),
          }),
        };
      },
      validate: (value) => {
        const result = value as {
          progress: typeof branchProgress;
          model: ReturnType<typeof buildRuneProofPackCoachModel>;
        };
        invariant(branchPack.branches.length === 8, 'Branch fixture did not contain eight branches.');
        invariant(branchPack.branches.reduce((total, branch) => total + branch.actions.length, 0) === 160,
          'Branch fixture did not contain 160 actions.');
        invariant(result.progress.selectedBranchId === 'branch-8',
          'Branch switch selected the wrong branch.');
        invariant(result.model.branch.selectedBranchId === 'branch-8',
          'Coach did not project the switched branch.');
        invariant(result.model.progress.total === 20,
          'Coach did not project the switched branch action count.');
        invariant(result.model.doNow?.id === 'branch-8:action-1',
          'Coach did not project the switched branch current action.');
      },
    },
    {
      id: OPERATION_IDS[5],
      run: () => {
        const read = readRuneProofProgressIndex(indexStorage, 'benchmark-run');
        return {
          read,
          serialized: canonicalRuneProofProgressJson(read.index),
        };
      },
      validate: (value) => {
        const result = value as {
          read: ReturnType<typeof readRuneProofProgressIndex>;
          serialized: string;
        };
        invariant(result.read.warnings.length === 0, 'Progress index read emitted a warning.');
        invariant(Object.keys(result.read.index.entries).length === 210,
          'Progress index did not contain 210 rows.');
        invariant(indexRaw.length < RUNEPROOF_PROGRESS_INDEX_MAX_CHARS,
          'Progress index exceeded its compact storage cap.');
        invariant(result.serialized === indexRaw, 'Progress index serialization was not canonical.');
      },
    },
  ];
  return operations.map(operation => ({
    ...operation,
    validateInputs: () => {
      invariant(inputSignature() === expectedInputSignature,
        `Benchmark operation ${operation.id} mutated its inputs.`);
    },
  }));
};

describe('RuneProof reference-profile performance benchmark', () => {
  const hardware: HardwareProfile = {
    nodeVersion: 'v22.0.0',
    platform: 'linux',
    arch: 'x64',
    cpuModel: 'Benchmark CPU',
    logicalCpuCount: 8,
  };
  const profile = (
    id: string,
    overrides: Partial<RuneProofPerformanceProfile> = {},
  ): RuneProofPerformanceProfile => ({
    id,
    ...hardware,
    warmups: 5,
    samples: 25,
    operations: Object.fromEntries(OPERATION_IDS.map(operationId => [operationId, {
      medianMilliseconds: 1,
      p95Milliseconds: 2,
      ceilingMilliseconds: 5,
    }])),
    ...overrides,
  });

  it('validates exact unique profile and operation schemas before selection or recording', () => {
    const alpha = profile('alpha');
    const beta = profile('beta', { cpuModel: 'Other CPU' });
    expect(validateBudgets({ schemaVersion: 1, profiles: [alpha, beta] })).toEqual({
      schemaVersion: 1,
      profiles: [alpha, beta],
    });
    expect(() => validateBudgets({
      schemaVersion: 1,
      profiles: [alpha, { ...beta, id: 'alpha' }],
    })).toThrow(/unique profile IDs/i);
    expect(() => validateBudgets({
      schemaVersion: 1,
      profiles: [alpha, { ...beta, id: 'beta', cpuModel: alpha.cpuModel }],
    })).toThrow(/unique hardware signatures/i);
    expect(() => validateBudgets({
      schemaVersion: 1,
      profiles: [{ ...alpha, extra: true }],
    })).toThrow(/exact profile keys/i);
    expect(() => validateBudgets({
      schemaVersion: 1,
      profiles: [{ ...alpha, id: ' alpha ' }],
    })).toThrow(/trimmed and nonblank/i);
    expect(() => validateBudgets({
      schemaVersion: 1,
      profiles: [{ ...alpha, warmups: 4 }],
    })).toThrow(/five warmups and 25 samples/i);
    expect(() => validateBudgets({
      schemaVersion: 1,
      profiles: [{ ...alpha, samples: 24 }],
    })).toThrow(/five warmups and 25 samples/i);
    const missingOperation = { ...alpha.operations };
    delete missingOperation[OPERATION_IDS[0]];
    expect(() => validateBudgets({
      schemaVersion: 1,
      profiles: [{ ...alpha, operations: missingOperation }],
    })).toThrow(/exact benchmark operation set/i);
    expect(() => validateBudgets({
      schemaVersion: 1,
      profiles: [{
        ...alpha,
        operations: {
          ...alpha.operations,
          [OPERATION_IDS[0]]: {
            medianMilliseconds: -1,
            p95Milliseconds: 2,
            ceilingMilliseconds: 5,
          },
        },
      }],
    })).toThrow(/finite nonnegative/i);
    expect(() => validateBudgets({
      schemaVersion: 1,
      profiles: [{
        ...alpha,
        operations: {
          ...alpha.operations,
          [OPERATION_IDS[0]]: {
            medianMilliseconds: 1,
            p95Milliseconds: Number.POSITIVE_INFINITY,
            ceilingMilliseconds: 5,
          },
        },
      }],
    })).toThrow(/finite nonnegative/i);
    expect(() => validateBudgets({
      schemaVersion: 1,
      profiles: [{
        ...alpha,
        operations: {
          ...alpha.operations,
          [OPERATION_IDS[0]]: {
            medianMilliseconds: 3,
            p95Milliseconds: 2,
            ceilingMilliseconds: 5,
          },
        },
      }],
    })).toThrow(/median cannot exceed p95/i);
    expect(() => validateBudgets({
      schemaVersion: 1,
      profiles: [{
        ...alpha,
        operations: {
          ...alpha.operations,
          [OPERATION_IDS[0]]: {
            medianMilliseconds: 1,
            p95Milliseconds: 10,
            ceilingMilliseconds: 5,
          },
        },
      }],
    })).toThrow(/p95 cannot exceed its ceiling/i);
    expect(() => validateBudgets({
      schemaVersion: 1,
      profiles: [{
        ...alpha,
        operations: {
          ...alpha.operations,
          [OPERATION_IDS[0]]: {
            medianMilliseconds: 1,
            p95Milliseconds: 2,
            ceilingMilliseconds: 10,
          },
        },
      }],
    })).toThrow(/reviewed formula/i);
    expect(() => validateBudgets({
      schemaVersion: 1,
      profiles: [{
        ...alpha,
        operations: {
          ...alpha.operations,
          [OPERATION_IDS[0]]: {
            ...alpha.operations[OPERATION_IDS[0]],
            extra: true,
          },
        },
      }],
    })).toThrow(/exact metric keys/i);
    expect(() => validateBudgets({ schemaVersion: 1, profiles: [], extra: true }))
      .toThrow(/exact root keys/i);
  });

  it('sorts canonical no-time JSON and requires exact hardware plus an explicit ID to enforce', () => {
    const alpha = profile('alpha');
    const beta = profile('beta', { cpuModel: 'Other CPU' });
    const budgets: RuneProofPerformanceBudgets = { schemaVersion: 1, profiles: [beta, alpha] };
    const canonical = canonicalBudgetsJson(budgets);
    expect(canonical.endsWith('\n')).toBe(true);
    expect(canonical.indexOf('"id": "alpha"')).toBeLessThan(canonical.indexOf('"id": "beta"'));
    expect(canonical).not.toMatch(/recordedAt|timestamp/iu);

    expect(selectReferenceProfile(budgets, hardware, undefined, false)).toMatchObject({
      profile: alpha,
      enforced: false,
    });
    expect(selectReferenceProfile(budgets, hardware, undefined, true)).toMatchObject({
      enforced: false,
      reason: expect.stringMatching(/explicit profile ID/i),
    });
    expect(selectReferenceProfile(budgets, hardware, 'missing', true)).toMatchObject({
      enforced: false,
      reason: expect.stringMatching(/not found/i),
    });
    expect(selectReferenceProfile(budgets, hardware, 'beta', true)).toMatchObject({
      enforced: false,
      reason: expect.stringMatching(/hardware mismatch/i),
    });
    expect(selectReferenceProfile(budgets, hardware, 'alpha', true)).toMatchObject({
      profile: alpha,
      enforced: true,
    });
  });

  it('records only an explicit reviewed ID, preserves peers, sorts, and rejects ambiguous modes', () => {
    const beta = profile('beta', { cpuModel: 'Other CPU' });
    const timings = Object.fromEntries(OPERATION_IDS.map(operationId => [operationId, {
      medianMilliseconds: 1.23456,
      p95Milliseconds: 2.34567,
    }]));
    const appended = recordedBudgets(
      { schemaVersion: 1, profiles: [beta] },
      'alpha',
      hardware,
      timings,
    );
    expect(appended.profiles.map(value => value.id)).toEqual(['alpha', 'beta']);
    expect(appended.profiles[1]).toEqual(beta);
    expect(appended.profiles[0]?.operations[OPERATION_IDS[0]]).toEqual({
      medianMilliseconds: 1.235,
      p95Milliseconds: 2.346,
      ceilingMilliseconds: 5,
    });
    const replacementTimings = Object.fromEntries(OPERATION_IDS.map(operationId => [operationId, {
      medianMilliseconds: 2.1111,
      p95Milliseconds: 3.2222,
    }]));
    const replaced = recordedBudgets(appended, 'alpha', hardware, replacementTimings);
    expect(replaced.profiles.map(value => value.id)).toEqual(['alpha', 'beta']);
    expect(replaced.profiles[1]).toEqual(beta);
    expect(replaced.profiles[0]?.operations[OPERATION_IDS[0]]).toEqual({
      medianMilliseconds: 2.111,
      p95Milliseconds: 3.222,
      ceilingMilliseconds: 5,
    });
    expect(() => recordedBudgets(appended, 'gamma', hardware, timings))
      .toThrow(/unique hardware signatures/i);
    expect(() => recordedBudgets(appended, '   ', hardware, timings))
      .toThrow(/explicit nonblank/i);
    expect(benchmarkMode('1', undefined, 'alpha')).toEqual({
      record: true,
      enforce: false,
      profileId: 'alpha',
    });
    expect(() => benchmarkMode('1', '1', 'alpha')).toThrow(/cannot record and enforce/i);
  });

  it('uses five warmups, 25 measured samples, numeric sample 13/24 selection, and the reviewed ceiling', () => {
    let calls = 0;
    let validations = 0;
    let tick = 0;
    const operation: BenchmarkOperation = {
      id: 'sampling-contract',
      run: () => { calls += 1; return calls; },
      validate: () => { validations += 1; },
    };
    const timing = measureOperation(operation, () => {
      const value = Math.floor(tick / 2) + (tick % 2);
      tick += 1;
      return value;
    });

    expect(calls).toBe(WARMUP_SAMPLES + MEASURED_SAMPLES);
    expect(validations).toBe(WARMUP_SAMPLES + MEASURED_SAMPLES);
    expect(timing).toEqual({ medianMilliseconds: 1, p95Milliseconds: 1 });
    expect(summarizeSamples([
      25, 1, 24, 2, 23, 3, 22, 4, 21, 5, 20, 6, 19,
      7, 18, 8, 17, 9, 16, 10, 15, 11, 14, 12, 13,
    ])).toEqual({ medianMilliseconds: 13, p95Milliseconds: 24 });
    expect(ceilingFor(24)).toBe(40);
    expect(ceilingFor(0.001)).toBe(5);
  });

  it('defines the six reviewed pure-operation workloads with unique IDs', () => {
    const operations = benchmarkOperations();
    expect(operations).toHaveLength(6);
    expect(new Set(operations.map(operation => operation.id)).size).toBe(6);
    for (const operation of operations) {
      operation.validate(operation.run());
    }
    const branchSwitch = operations.find(operation => operation.id === OPERATION_IDS[4]);
    expect(branchSwitch?.run()).toMatchObject({
      progress: { selectedBranchId: 'branch-8' },
      model: {
        branch: { selectedBranchId: 'branch-8' },
        progress: { total: 20 },
        doNow: { id: 'branch-8:action-1' },
      },
    });
  });

  it('measures and validates every workload through the selected reference mode', () => {
    const result = runBenchmark();
    expect(Object.keys(result.timings).sort()).toEqual([...OPERATION_IDS].sort());
    for (const timing of Object.values(result.timings)) {
      expect(Number.isFinite(timing.medianMilliseconds)).toBe(true);
      expect(Number.isFinite(timing.p95Milliseconds)).toBe(true);
      expect(timing.medianMilliseconds).toBeGreaterThanOrEqual(0);
      expect(timing.p95Milliseconds).toBeGreaterThanOrEqual(timing.medianMilliseconds);
    }
  });
});
