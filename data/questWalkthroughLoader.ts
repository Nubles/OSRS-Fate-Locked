import type { RuneProofAvailability } from '../utils/questRoutes/featureFlag';
import type { QuestStrategyDefinition } from '../utils/questStrategies/model';
import type { QuestWalkthroughDefinition } from '../utils/questWalkthroughs/model';
import type { QuestWalkthroughRelease } from './questWalkthroughRelease';
import type { ReviewedQuestRequirements } from './questItemRequirements';
import type { RuneProofCatalogueEntry } from './runeProofQuestCatalogue';
import type {
  RuneProofPackLifecycle,
  RuneProofPackRelease,
} from './runeProofPackRelease';
import type {
  RequirementExpression,
  RuneProofCompiledPack,
  RuneProofProofState,
  RuneProofQuestPack,
} from '../utils/questStrategies/packModel';
import type { RuneProofRequirementSnapshot } from '../utils/questStrategies/requirements';
import type { RuneProofQuestProgressV2 } from '../utils/questStrategies/progress';

type PreviewWalkthroughCatalogue = typeof import('./questWalkthroughs');
type PreviewStrategyCatalogue = typeof import('./questWalkthroughs.preview-boundary');
type PublicWalkthroughCatalogue = typeof import('./questWalkthroughs.public');

export type RuneProofPackDisposition = 'NO_PACK' | 'REJECTED' | 'RELEASED';
export type RuneProofCatalogueReviewStatus =
  | RuneProofPackDisposition
  | RuneProofPackLifecycle;

export interface RuneProofCatalogueSummary extends RuneProofCatalogueEntry {
  readonly catalogueRevision: string;
  readonly packDisposition: RuneProofPackDisposition;
  readonly reviewStatus: RuneProofCatalogueReviewStatus;
  readonly lifecycle?: RuneProofPackLifecycle;
  readonly packRevision?: string;
  readonly preflight: RequirementExpression;
  readonly proofState: RuneProofProofState;
  readonly playable: boolean;
}

export interface RuneProofPlatformReviewHarness {
  readonly marker: 'RUNEPROOF_PLATFORM_REVIEW_HARNESS_V1';
  readonly scenarios: readonly RuneProofPlatformReviewScenario[];
}

export interface RuneProofPlatformReviewScenario {
  readonly id: 'READY' | 'CONFIRM' | 'BLOCKED' | 'NEEDS_REVIEW' | 'COMPLETE';
  readonly label: string;
  readonly pack: RuneProofCompiledPack;
  readonly snapshot: RuneProofRequirementSnapshot;
  readonly completedQuestIds: readonly string[];
}

export interface RuneProofLoadedPack {
  readonly pack: RuneProofCompiledPack;
  readonly legacyProjection?: RuneProofLegacyProjection;
}

export type RuneProofLegacyProjection = Readonly<{
  walkthrough: QuestWalkthroughDefinition;
  strategy: QuestStrategyDefinition;
  reviewedRequirements: ReviewedQuestRequirements;
}>;

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

export const cloneAndFreezeRuneProofLegacyProjection = (
  projection: RuneProofLegacyProjection,
): RuneProofLegacyProjection => deepFreeze(structuredClone(projection));

export const loadQuestWalkthroughFor = async (
  availability: RuneProofAvailability,
  release: QuestWalkthroughRelease,
): Promise<QuestWalkthroughDefinition | undefined> => {
  if (availability === 'PUBLIC') {
    const catalogue: PublicWalkthroughCatalogue = await import('./questWalkthroughs.public');
    const walkthrough = catalogue.questWalkthroughFor(release.questId);
    return walkthrough?.revision === release.revision && walkthrough.releaseStatus === 'APPROVED'
      ? walkthrough
      : undefined;
  }
  if (availability !== 'PREVIEW') return undefined;

  const catalogue: PreviewWalkthroughCatalogue = await import('./questWalkthroughs');
  const walkthrough = catalogue.questWalkthroughFor(release.questId);

  return walkthrough?.revision === release.revision ? walkthrough : undefined;
};

export const loadQuestStrategyFor = async (
  availability: RuneProofAvailability,
  release: QuestWalkthroughRelease,
): Promise<QuestStrategyDefinition | undefined> => {
  if (availability === 'PUBLIC') {
    const catalogue: PublicWalkthroughCatalogue = await import('./questWalkthroughs.public');
    const strategy = catalogue.questStrategyFor(release.questId);
    return strategy?.revision === release.revision ? strategy : undefined;
  }
  if (availability !== 'PREVIEW') return undefined;

  const catalogue: PreviewStrategyCatalogue = await import('./questWalkthroughs.preview-boundary');
  const strategy = catalogue.questStrategyFor(release.questId);

  return strategy?.revision === release.revision ? strategy : undefined;
};

export const loadQuestStrategyCatalogue = async (
  availability: RuneProofAvailability,
): Promise<readonly QuestStrategyDefinition[]> => {
  if (availability === 'PUBLIC') {
    const catalogue: PublicWalkthroughCatalogue = await import('./questWalkthroughs.public');
    return catalogue.questStrategyCatalogue;
  }
  if (availability !== 'PREVIEW') return [];

  const catalogue: PreviewStrategyCatalogue = await import('./questWalkthroughs.preview-boundary');
  return catalogue.questStrategyCatalogue;
};

export const loadRuneProofCatalogue = async (
  availability: RuneProofAvailability,
): Promise<readonly RuneProofCatalogueSummary[]> => {
  if (availability === 'OFF') return [];
  const catalogue = availability === 'PUBLIC'
    ? await import('./runeProofPacks.public')
    : await import('./runeProofPacks.preview-boundary');
  return catalogue.runeProofCatalogueSummaries;
};

export const loadRuneProofPackFor = async (
  availability: RuneProofAvailability,
  release: RuneProofPackRelease,
): Promise<RuneProofLoadedPack | undefined> => {
  if (availability === 'OFF') return undefined;
  const catalogue = availability === 'PUBLIC'
    ? await import('./runeProofPacks.public')
    : await import('./runeProofPacks.preview-boundary');
  return catalogue.runeProofPackFor(release);
};

export const loadRuneProofPlatformReviewHarness = async (
  availability: RuneProofAvailability,
): Promise<RuneProofPlatformReviewHarness | undefined> => {
  if (availability !== 'PREVIEW') return undefined;
  const catalogue = await import('./runeProofPacks.preview-boundary');
  return catalogue.loadRuneProofPlatformReviewHarness();
};

const REVIEW_SCENARIO_IDS = Object.freeze([
  'READY',
  'CONFIRM',
  'BLOCKED',
  'NEEDS_REVIEW',
  'COMPLETE',
] as const);

const REVIEW_SCENARIO_PROOF_STATES: Readonly<Record<
  RuneProofPlatformReviewScenario['id'],
  RuneProofProofState
>> = Object.freeze({
  READY: 'READY',
  CONFIRM: 'CONFIRM',
  BLOCKED: 'BLOCKED',
  NEEDS_REVIEW: 'NEEDS_REVIEW',
  COMPLETE: 'COMPLETE',
});

const reviewHarnessMarker = (): string => (
  ['RUNEPROOF', 'PLATFORM', 'REVIEW', 'HARNESS', 'V1'].join('_')
);

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isNonblank = (value: unknown): value is string => (
  typeof value === 'string' && value.trim().length > 0
);

const isStringSet = (value: unknown): value is ReadonlySet<string> => (
  value instanceof Set
  && [...value].every(isNonblank)
);

const isDenseArray = (value: unknown): value is readonly unknown[] => {
  if (!Array.isArray(value)) return false;
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, index)) return false;
  }
  return true;
};

const isNonnegativeInteger = (value: unknown): value is number => (
  typeof value === 'number'
  && Number.isFinite(value)
  && Number.isInteger(value)
  && value >= 0
);

const isRecordOf = (
  value: unknown,
  predicate: (entry: unknown) => boolean,
): value is Readonly<Record<string, unknown>> => (
  isRecord(value)
  && Object.entries(value).every(([key, entry]) => isNonblank(key) && predicate(entry))
);

const CANONICAL_UNLOCK_SET_KEYS = Object.freeze([
  'equipment', 'mobility', 'arcana', 'housing', 'guilds', 'merchants', 'minigames',
  'bosses', 'storage', 'farming', 'slayer', 'banks', 'diaries', 'combatAchievements',
  'tasks', 'collectionItems',
] as const);

const isRuneProofRequirementSnapshot = (
  value: unknown,
): value is RuneProofRequirementSnapshot => {
  if (!isRecord(value) || !isRecord(value.canonicalUnlocks)) return false;
  const snapshot = value as Record<string, unknown>;
  const canonicalUnlocks = value.canonicalUnlocks;
  return isStringSet(snapshot.completedQuestIds)
    && isNonnegativeInteger(snapshot.questPoints)
    && isRecordOf(snapshot.levels, isNonnegativeInteger)
    && isNonnegativeInteger(snapshot.combatLevel)
    && isStringSet(snapshot.regions)
    && isStringSet(snapshot.chunks)
    && CANONICAL_UNLOCK_SET_KEYS.every(key => isStringSet(canonicalUnlocks[key]))
    && isStringSet(snapshot.transportIds)
    && (snapshot.availableBoostSourceIds === undefined
      || isStringSet(snapshot.availableBoostSourceIds))
    && (snapshot.itemQuantities === undefined
      || isRecordOf(snapshot.itemQuantities, isNonnegativeInteger))
    && (snapshot.itemAliases === undefined
      || isRecordOf(snapshot.itemAliases, isNonblank))
    && isStringSet(snapshot.confirmedManualIds)
    && (snapshot.selectedBranchId === undefined || isNonblank(snapshot.selectedBranchId))
    && isStringSet(snapshot.branchCheckpointIds)
    && typeof snapshot.observedCanonicalCompletion === 'boolean';
};

const isRuneProofCatalogueEntry = (
  value: unknown,
  expectedQuestId: string,
  expectedSlug: string,
): value is RuneProofCatalogueEntry => {
  if (!isRecord(value) || !isRecord(value.requirementComplexity)) return false;
  const complexity = value.requirementComplexity;
  const override = complexity.override;
  const validOverride = override === undefined || (
    isRecord(override)
    && [3, 4, 5].includes(override.fromMilestone as number)
    && [3, 4, 5].includes(override.toMilestone as number)
    && isNonblank(override.reviewer)
    && isNonblank(override.reviewedAt)
    && isNonblank(override.reason)
  );
  return value.questId === expectedQuestId
    && value.slug === expectedSlug
    && value.kind === 'quest'
    && value.membership === 'MEMBERS'
    && value.wikiTitle === expectedQuestId
    && isNonblank(value.sourceRevision)
    && isNonblank(value.sourceRevisionTimestamp)
    && ['VERIFIED', 'VERIFIED_WITH_NOTES', 'UNRESOLVED'].includes(
      value.requirementStatus as string,
    )
    && (value.series === undefined || isNonblank(value.series))
    && isNonnegativeInteger(value.progressionPriority)
    && [1, 2, 3, 4, 5].includes(value.milestone as number)
    && complexity.schemaVersion === 1
    && isNonnegativeInteger(complexity.score)
    && [3, 4, 5].includes(complexity.baselineMilestone as number)
    && [3, 4, 5].includes(complexity.assignedMilestone as number)
    && isRecordOf(complexity.dimensions, entry => (
      typeof entry === 'boolean' || (typeof entry === 'number' && Number.isFinite(entry))
    ))
    && isDenseArray(complexity.flags)
    && complexity.flags.every(isNonblank)
    && validOverride;
};

const compileReviewPack = async (
  value: unknown,
  scenarioId: RuneProofPlatformReviewScenario['id'],
): Promise<RuneProofCompiledPack | undefined> => {
  if (!isRecord(value) || !isRecord(value.catalogue)) return undefined;
  const expectedQuestId = `RuneProof Platform Review Harness — ${scenarioId}`;
  const expectedSlug = `runeproof-platform-review-${scenarioId.toLowerCase()}`;
  if (
    value.questId !== expectedQuestId
    || !isRuneProofCatalogueEntry(value.catalogue, expectedQuestId, expectedSlug)
    || !isNonblank(value.catalogueRevision)
    || value.catalogue.sourceRevision !== value.catalogueRevision
    || value.revision !== `${value.catalogueRevision}:${scenarioId}`
  ) return undefined;
  const { catalogue, findings: _findings, ...definition } = value;
  try {
    const { compileRuneProofQuestPack } = await import('../utils/questStrategies/packCompiler');
    const compiled = compileRuneProofQuestPack(definition as unknown as RuneProofQuestPack, {
      catalogue: catalogue as unknown as RuneProofCatalogueEntry,
      expectedCatalogueRevision: value.catalogueRevision,
    });
    return compiled.pack !== undefined
      && compiled.findings.every(finding => finding.severity !== 'BLOCKING')
      && compiled.pack.questId === expectedQuestId
      && compiled.pack.catalogue.questId === expectedQuestId
      && compiled.pack.catalogue.slug === expectedSlug
      && compiled.pack.completion.canonicalQuestId === expectedQuestId
      ? compiled.pack
      : undefined;
  } catch {
    return undefined;
  }
};

const emptyReviewProgressFor = (
  pack: RuneProofCompiledPack,
): RuneProofQuestProgressV2 => ({
  schemaVersion: 2,
  runId: 'runeproof-platform-review',
  questId: pack.questId,
  packRevision: pack.revision,
  confirmedActionIds: [],
  confirmedItemKeys: [],
  manualConfirmationIds: [],
  confirmedCheckpointIds: [],
  updatedAt: '1970-01-01T00:00:00.000Z',
});

export const runeProofLoadedPackMatchesRelease = (
  loaded: RuneProofLoadedPack,
  release: RuneProofPackRelease,
): boolean => {
  const { pack, legacyProjection } = loaded;
  if (
    pack.questId !== release.questId
    || pack.revision !== release.packRevision
    || pack.catalogueRevision !== release.catalogueRevision
    || pack.catalogue.questId !== release.questId
  ) return false;
  if (legacyProjection === undefined) return true;
  return legacyProjection.walkthrough.questId === release.questId
    && legacyProjection.walkthrough.revision === release.packRevision
    && legacyProjection.strategy.questId === release.questId
    && legacyProjection.strategy.revision === release.packRevision
    && legacyProjection.reviewedRequirements.questId === release.questId;
};

export const validatedRuneProofPlatformReviewHarness = async (
  value: unknown,
): Promise<RuneProofPlatformReviewHarness | undefined> => {
  let candidate: Partial<RuneProofPlatformReviewHarness>;
  try {
    candidate = structuredClone(value) as Partial<RuneProofPlatformReviewHarness>;
  } catch {
    return undefined;
  }
  if (typeof candidate !== 'object' || candidate === null) return undefined;
  if (candidate.marker !== reviewHarnessMarker() || !isDenseArray(candidate.scenarios)) {
    return undefined;
  }
  if (candidate.scenarios.length !== REVIEW_SCENARIO_IDS.length) return undefined;
  const ids = candidate.scenarios.map(scenario => scenario?.id);
  if (
    new Set(ids).size !== REVIEW_SCENARIO_IDS.length
    || !REVIEW_SCENARIO_IDS.every((id, index) => ids[index] === id)
  ) return undefined;
  const scenarios: RuneProofPlatformReviewScenario[] = [];
  const questIds = new Set<string>();
  const slugs = new Set<string>();
  for (const [index, scenario] of candidate.scenarios.entries()) {
    const id = REVIEW_SCENARIO_IDS[index];
    if (
      typeof scenario !== 'object'
      || scenario === null
      || scenario.id !== id
      || !isNonblank(scenario.label)
      || !isRuneProofRequirementSnapshot(scenario.snapshot)
      || !isDenseArray(scenario.completedQuestIds)
      || !scenario.completedQuestIds.every(isNonblank)
      || new Set(scenario.completedQuestIds).size !== scenario.completedQuestIds.length
    ) return undefined;
    const pack = await compileReviewPack(scenario.pack, id);
    if (pack === undefined || questIds.has(pack.questId) || slugs.has(pack.catalogue.slug)) {
      return undefined;
    }
    const expectedCompleted = id === 'COMPLETE' ? [pack.questId] : [];
    if (
      scenario.completedQuestIds.length !== expectedCompleted.length
      || scenario.completedQuestIds.some((questId, completedIndex) => (
        questId !== expectedCompleted[completedIndex]
      ))
    ) return undefined;
    questIds.add(pack.questId);
    slugs.add(pack.catalogue.slug);
    scenarios.push({
      id,
      label: scenario.label,
      pack,
      snapshot: scenario.snapshot,
      completedQuestIds: [...scenario.completedQuestIds],
    });
  }
  try {
    const { buildRuneProofPackCoachModel } = await import('../utils/questStrategies/coach');
    for (const scenario of scenarios) {
      const projected = buildRuneProofPackCoachModel({
        pack: scenario.pack,
        progress: emptyReviewProgressFor(scenario.pack),
        requirementSnapshot: scenario.snapshot,
        completedQuestIds: new Set(scenario.completedQuestIds),
      });
      if (projected.proofState !== REVIEW_SCENARIO_PROOF_STATES[scenario.id]) {
        return undefined;
      }
    }
  } catch {
    return undefined;
  }
  return deepFreeze({
    marker: candidate.marker,
    scenarios,
  });
};
