import type { RuneProofCatalogueEntry } from '../../data/runeProofQuestCatalogue';
import type { RuneProofCatalogueSummary } from '../../data/questWalkthroughLoader';
import type {
  RequirementExpression,
  RuneProofAction,
  RuneProofCompiledPack,
  RuneProofInitialItemRequirement,
  RuneProofQuestPack,
  RuneProofProofState,
} from './packModel';
import type { RuneProofObjectiveCandidate } from './objectives';
import {
  selectRuneProofManualObligations,
  type RuneProofProgressSummary,
  type RuneProofQuestProgressV2,
} from './progress';
import type { RuneProofRequirementSnapshot } from './requirements';
import type {
  RuneProofBranchOptionModel,
  RuneProofInitialItemModel,
} from './coach';

const emptyRequirements: RequirementExpression = {
  kind: 'ALL',
  requirements: [],
};

const objectiveSlug = (questId: string): string => questId
  .normalize('NFKC')
  .toLowerCase()
  .replace(/[^a-z0-9]+/gu, '-')
  .replace(/^-|-$/gu, '');

export const candidate = (
  questId: string,
  proofState: RuneProofProofState,
  milestone: 1 | 2 | 3 | 4 | 5,
  progressionPriority: number,
  completed: number,
  total: number,
): RuneProofObjectiveCandidate => ({
  questId,
  milestone,
  progressionPriority,
  proofState,
  progress: { completed, total },
  actionable: proofState !== 'NEEDS_REVIEW' && proofState !== 'COMPLETE',
  ...(proofState === 'BLOCKED' ? {
    blockerReason: `Reviewed blocker for ${questId}.`,
    unblockAction: `Resolve ${questId}.`,
  } : {}),
});

export const catalogueSummary = (
  overrides: Partial<RuneProofCatalogueSummary> = {},
): RuneProofCatalogueSummary => {
  const questId = overrides.questId ?? 'Example Quest';
  const packDisposition = overrides.packDisposition ?? 'RELEASED';
  const released = packDisposition === 'RELEASED';
  return {
    questId,
    slug: overrides.slug ?? objectiveSlug(questId),
    kind: 'quest',
    membership: 'F2P',
    wikiTitle: questId,
    sourceRevision: 'fixture-source-revision',
    sourceRevisionTimestamp: '2026-08-22T00:00:00Z',
    requirementStatus: 'VERIFIED',
    progressionPriority: 1,
    milestone: 3,
    requirementComplexity: {
      schemaVersion: 1,
      score: 0,
      baselineMilestone: 3,
      assignedMilestone: 3,
      dimensions: {},
      flags: [],
    },
    catalogueRevision: 'fixture-catalogue-revision',
    packDisposition,
    reviewStatus: released
      ? overrides.lifecycle ?? 'PREVIEW_VALIDATED'
      : packDisposition,
    ...(released ? {
      lifecycle: 'PREVIEW_VALIDATED' as const,
      packRevision: 'fixture-pack-revision',
    } : {}),
    preflight: emptyRequirements,
    proofState: released ? 'READY' : 'NEEDS_REVIEW',
    playable: released,
    ...overrides,
  };
};

export const makeCatalogueSummaries = (
  count: number,
  options: Readonly<{ noPackQuestIds?: ReadonlySet<string> }> = {},
): readonly RuneProofCatalogueSummary[] => Array.from({ length: count }, (_, index) => {
  const questId = `Quest ${index + 1}`;
  const catalogueFields = {
    questId,
    kind: index < 191 ? 'quest' : 'miniquest',
    membership: index < 23 ? 'F2P' : 'MEMBERS',
    progressionPriority: index + 1,
  } as const;
  return catalogueSummary(options.noPackQuestIds?.has(questId) ? {
    ...catalogueFields,
    packDisposition: 'NO_PACK',
    reviewStatus: 'NO_PACK',
    lifecycle: undefined,
    packRevision: undefined,
    proofState: 'NEEDS_REVIEW',
    playable: false,
  } : catalogueFields);
});

export const progressSummary = (
  overrides: Partial<RuneProofProgressSummary> = {},
): RuneProofProgressSummary => ({
  questId: 'Example Quest',
  packRevision: 'fixture-pack-revision',
  selectedBranchId: undefined,
  completedActionCount: 0,
  totalActionCount: 0,
  complete: false,
  updatedAt: '2026-08-22T10:00:00.000Z',
  ...overrides,
});

export const readyRequirementSnapshot = (
  overrides: Partial<RuneProofRequirementSnapshot> = {},
): RuneProofRequirementSnapshot => ({
  completedQuestIds: new Set(['Rune Mysteries']),
  questPoints: 7,
  levels: { Mining: 15 },
  combatLevel: 20,
  regions: new Set(['Misthalin']),
  chunks: new Set(['50,50']),
  canonicalUnlocks: {
    equipment: new Set(),
    mobility: new Set(),
    arcana: new Set(),
    housing: new Set(),
    guilds: new Set(),
    merchants: new Set(),
    minigames: new Set(),
    bosses: new Set(),
    storage: new Set(),
    farming: new Set(),
    slayer: new Set(),
    banks: new Set(),
    diaries: new Set(),
    combatAchievements: new Set(),
    tasks: new Set(),
    collectionItems: new Set(),
  },
  transportIds: new Set(),
  availableBoostSourceIds: undefined,
  itemQuantities: undefined,
  itemAliases: undefined,
  confirmedManualIds: new Set(),
  selectedBranchId: undefined,
  branchCheckpointIds: new Set(),
  observedCanonicalCompletion: false,
  ...overrides,
});

export const branchOption = (
  id: string,
  overrides: Partial<RuneProofBranchOptionModel> = {},
): RuneProofBranchOptionModel => ({
  id,
  label: id.length === 0 ? id : id[0].toUpperCase() + id.slice(1),
  state: 'READY',
  evidenceComplete: true,
  recommended: false,
  recommendationReason: `Reviewed ${id} route.`,
  selected: false,
  pinned: false,
  progress: { completed: 0, total: 3 },
  switchConsequence: {
    sharedRetained: 0,
    inactive: 0,
    reactivated: 0,
  },
  ...overrides,
});

export const initialItemModel = (
  overrides: Partial<RuneProofInitialItemModel> = {},
): RuneProofInitialItemModel => ({
  canonicalItemKey: 'bucket of milk',
  label: 'Bucket of milk',
  quantity: 1,
  provenQuantity: 0,
  evidenceIds: ['review:example'],
  options: [{
    itemKey: 'bucket of milk',
    label: 'Bucket of milk',
    confirmed: false,
  }],
  ...overrides,
});

const surfaceLocation = {
  kind: 'SURFACE',
  label: 'Fixture location',
  chunks: ['0,0'],
  plane: 0,
  evidenceIds: ['review:example'],
} as const;

const action = (
  id: string,
  sourceOrder: number,
  completion: RuneProofAction['completion'],
  overrides: Partial<RuneProofAction> = {},
): RuneProofAction => ({
  id,
  sourceOrder,
  instruction: id,
  kind: 'INFORMATION',
  dependsOn: [],
  requirements: emptyRequirements,
  itemEffects: [],
  location: {
    ...surfaceLocation,
    chunks: [...surfaceLocation.chunks],
    evidenceIds: [...surfaceLocation.evidenceIds],
  },
  completion,
  alternatives: [],
  evidenceIds: ['review:example'],
  ...overrides,
});

const branchRequirements = (
  branchId: string,
  itemKey: string,
  manualId: string,
): RequirementExpression => ({
  kind: 'ALL',
  requirements: [
    {
      kind: 'MANUAL_CONFIRMATION',
      id: `${branchId}:manual-requirement`,
      confirmationId: manualId,
      prompt: `Confirm ${branchId}`,
      evidenceIds: ['review:example'],
    },
  ],
});

const branchItemRequirement = (
  branchId: string,
  itemKey: string,
): RequirementExpression => ({
  kind: 'ITEM',
  id: `${branchId}:item-requirement`,
  itemKey,
  quantity: 1,
  evidenceIds: ['review:example'],
});

export const skillRequirement = (
  skill: string,
  level: number,
): RequirementExpression => ({
  kind: 'SKILL_LEVEL',
  id: `skill:${skill}:${String(level)}`,
  skill,
  level,
  evidenceIds: ['review:example'],
});

export const manualRequirement = (
  confirmationId: string,
  prompt: string,
): RequirementExpression => ({
  kind: 'MANUAL_CONFIRMATION',
  id: `requirement:${confirmationId}`,
  confirmationId,
  prompt,
  evidenceIds: ['review:example'],
});

export const temporaryBoostRequirement = (
  overrides: Partial<Extract<RequirementExpression, { kind: 'TEMPORARY_BOOST' }>> = {},
): RequirementExpression => ({
  kind: 'TEMPORARY_BOOST',
  id: 'boost:mining:1:2',
  skill: 'Mining',
  baseLevel: 1,
  targetLevel: 2,
  boostSourceIds: ['global root'],
  timingPolicy: 'ACTION_WINDOW',
  evidenceIds: ['review:example'],
  ...overrides,
});

export const unresolvedRouteItemRequirement = (
  itemKey: string,
): RequirementExpression => ({
  kind: 'ITEM',
  id: `item:${itemKey}`,
  itemKey,
  quantity: 1,
  evidenceIds: ['review:example'],
});

export const transportRequirementWithFare = (
  itemKey: string,
  quantity: number,
): RequirementExpression => ({
  kind: 'TRANSPORT_ACCESS',
  id: `transport:${itemKey}`,
  transportId: 'fixture transport',
  origin: '0,0',
  destination: '1,0',
  oneWay: false,
  fare: { itemKey, quantity },
  evidenceIds: ['review:example'],
});

export const initialRoot = (
  key: string,
  alternatives: readonly string[] = [],
): RuneProofInitialItemRequirement => ({
  item: { key, name: key[0]?.toUpperCase() + key.slice(1) },
  quantity: 1,
  supplyPolicy: 'PLAYER_OBTAINED',
  alternatives: alternatives.map(alternative => ({
    key: alternative,
    name: alternative[0]?.toUpperCase() + alternative.slice(1),
  })),
  evidenceIds: ['review:example'],
});

export const addDuplicateReviewedMethods = (
  target: RuneProofAction,
  id: string,
): void => {
  (target as { preferredMethod: RuneProofAction['preferredMethod'] }).preferredMethod = {
    id,
    label: 'Preferred fixture method',
    kind: 'DIRECT_SOURCE',
    evidenceIds: ['review:example'],
  };
  (target as { alternatives: RuneProofAction['alternatives'] }).alternatives = [{
    id,
    label: 'Alternative fixture method',
    kind: 'QUEST_ROUTE',
    requirements: emptyRequirements,
    location: surfaceLocation,
    evidenceIds: ['review:example'],
  }];
};

export const exampleCatalogueEntry: RuneProofCatalogueEntry = {
  questId: 'Example Quest',
  slug: 'example-quest',
  kind: 'quest',
  membership: 'F2P',
  wikiTitle: 'Example Quest',
  sourceRevision: 'fixture-source-revision',
  sourceRevisionTimestamp: '2026-08-22T00:00:00Z',
  requirementStatus: 'VERIFIED',
  progressionPriority: 1,
  milestone: 3,
  requirementComplexity: {
    schemaVersion: 1,
    score: 0,
    baselineMilestone: 3,
    assignedMilestone: 3,
    dimensions: {},
    flags: [],
  },
};

export const branchingPackDefinition: RuneProofQuestPack = {
  schemaVersion: 1,
  questId: 'Example Quest',
  revision: 'fixture-pack-revision',
  catalogueRevision: 'catalogue-revision',
  sources: [{
    id: 'source:example',
    kind: 'INDEPENDENT_REVIEW',
    uri: 'urn:runeproof:fixture-review',
    revision: 'review-v1',
    revisionTimestamp: '2026-08-22T00:00:00.000Z',
    reviewedAt: '2026-08-22T00:00:00.000Z',
    author: 'Fixture reviewer',
    methodology: 'Literal compiler fixture review.',
  }],
  evidence: [{
    id: 'review:example',
    sourceId: 'source:example',
    sourceLocator: 'fixture:root',
    decision: 'Reviewed for compiler tests.',
  }],
  initialItems: [{
    item: { key: 'global root', name: 'Global root' },
    quantity: 1,
    supplyPolicy: 'PLAYER_OBTAINED',
    alternatives: [{ key: 'global alternative', name: 'Global alternative' }],
    evidenceIds: ['review:example'],
  }],
  preflight: {
    kind: 'MANUAL_CONFIRMATION',
    id: 'global:manual-requirement',
    confirmationId: 'global:manual',
    prompt: 'Confirm global preflight',
    evidenceIds: ['review:example'],
  },
  branches: [
    {
      id: 'local',
      label: 'Local route',
      requirements: branchRequirements('local', 'local token', 'local:manual'),
      rank: {
        localRoutePenalty: 0,
        newUnlockCount: 0,
        riskCost: 0,
        tieBreak: 0,
      },
      actions: [
        action('local:step', 2, { kind: 'ACTION_CONFIRMED' }, {
          dependsOn: ['shared:start'],
          itemEffects: [
            { kind: 'ACQUIRE', itemKey: 'local token', quantity: 1 },
            { kind: 'ACQUIRE', itemKey: 'local effect', quantity: 1 },
          ],
          combat: {
            id: 'local:combat-declaration',
            encounter: 'Local encounter',
            phases: ['Single reviewed phase'],
            mandatoryMechanics: ['Follow the reviewed mechanic.'],
            equipmentCapabilities: ['A reviewed damage option'],
            recommendedSupplies: ['Food'],
            deathAndEscape: 'Leave',
            reentry: 'Return',
            confirmationId: 'local:combat',
            evidenceIds: ['review:example'],
          },
        }),
        action('local:checkpoint-step', 3, {
          kind: 'BRANCH_CHECKPOINT',
          checkpointId: 'local:checkpoint',
        }, {
          dependsOn: ['local:step'],
          requirements: branchItemRequirement('local', 'local token'),
        }),
        action('local:complete', 4, {
          kind: 'CANONICAL_QUEST_COMPLETED',
          questId: 'Example Quest',
        }, { dependsOn: ['local:checkpoint-step'] }),
      ],
      checkpointIds: ['local:checkpoint'],
      evidenceIds: ['review:example'],
    },
    {
      id: 'remote',
      label: 'Remote route',
      requirements: branchRequirements('remote', 'remote token', 'remote:manual'),
      rank: {
        localRoutePenalty: 1,
        newUnlockCount: 1,
        riskCost: 1,
        tieBreak: 1,
      },
      actions: [
        action('remote:step', 2, { kind: 'ACTION_CONFIRMED' }, {
          dependsOn: ['shared:start'],
          itemEffects: [
            { kind: 'ACQUIRE', itemKey: 'remote token', quantity: 1 },
            { kind: 'ACQUIRE', itemKey: 'remote effect', quantity: 1 },
          ],
          combat: {
            id: 'remote:combat-declaration',
            encounter: 'Remote encounter',
            phases: ['Single reviewed phase'],
            mandatoryMechanics: ['Follow the reviewed mechanic.'],
            equipmentCapabilities: ['A reviewed damage option'],
            recommendedSupplies: ['Food'],
            deathAndEscape: 'Leave',
            reentry: 'Return',
            confirmationId: 'remote:combat',
            evidenceIds: ['review:example'],
          },
        }),
        action('remote:checkpoint-step', 3, {
          kind: 'BRANCH_CHECKPOINT',
          checkpointId: 'remote:checkpoint',
        }, {
          dependsOn: ['remote:step'],
          requirements: branchItemRequirement('remote', 'remote token'),
        }),
        action('remote:complete', 4, {
          kind: 'CANONICAL_QUEST_COMPLETED',
          questId: 'Example Quest',
        }, { dependsOn: ['remote:checkpoint-step'] }),
      ],
      checkpointIds: ['remote:checkpoint'],
      evidenceIds: ['review:example'],
    },
  ],
  sharedActions: [action('shared:start', 1, { kind: 'ACTION_CONFIRMED' })],
  completion: {
    canonicalQuestId: 'Example Quest',
    branchActionIds: {
      local: 'local:complete',
      remote: 'remote:complete',
    },
    evidenceIds: ['review:example'],
  },
  migrations: [],
};

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

export const branchingPack: RuneProofCompiledPack = deepFreeze({
  ...structuredClone(branchingPackDefinition),
  catalogue: structuredClone(exampleCatalogueEntry),
  findings: [],
});

export const emptyProgressFor = (
  pack: RuneProofCompiledPack,
  runId: string,
): RuneProofQuestProgressV2 => ({
  schemaVersion: 2,
  runId,
  questId: pack.questId,
  packRevision: pack.revision,
  confirmedActionIds: [],
  confirmedItemKeys: [],
  manualConfirmationIds: [],
  confirmedCheckpointIds: [],
  updatedAt: '2026-08-22T10:00:00.000Z',
});

const singleBranchPack = (
  questId: string,
  actions: readonly RuneProofAction[],
  overrides: Readonly<{
    preflight?: RequirementExpression;
    branchRequirements?: RequirementExpression;
    initialItems?: readonly RuneProofInitialItemRequirement[];
  }> = {},
): RuneProofCompiledPack => deepFreeze({
  ...structuredClone(branchingPack),
  questId,
  revision: `fixture-${objectiveSlug(questId)}-revision`,
  catalogue: {
    ...structuredClone(exampleCatalogueEntry),
    questId,
    slug: objectiveSlug(questId),
    wikiTitle: questId,
  },
  initialItems: structuredClone(overrides.initialItems ?? []),
  preflight: structuredClone(overrides.preflight ?? emptyRequirements),
  sharedActions: [],
  branches: [{
    id: 'main',
    label: 'Main route',
    requirements: structuredClone(overrides.branchRequirements ?? emptyRequirements),
    rank: {
      localRoutePenalty: 0,
      newUnlockCount: 0,
      riskCost: 0,
      tieBreak: 0,
    },
    actions: structuredClone(actions),
    checkpointIds: actions.flatMap(candidate => (
      candidate.completion.kind === 'BRANCH_CHECKPOINT'
        ? [candidate.completion.checkpointId]
        : []
    )),
    evidenceIds: ['review:example'],
  }],
  completion: {
    canonicalQuestId: questId,
    branchActionIds: { main: actions.at(-1)?.id ?? 'missing:completion' },
    evidenceIds: ['review:example'],
  },
  findings: [],
});

export const everyBranchNeedsReviewPack = (): RuneProofCompiledPack => {
  const pack = structuredClone(branchingPack);
  for (const branch of pack.branches) {
    (branch as { requirements: RequirementExpression }).requirements = {
      kind: 'UNRESOLVED_EVIDENCE',
      id: `unresolved:${branch.id}`,
      evidenceId: `audit:${branch.id}`,
      reason: `${branch.label} needs reviewed evidence.`,
      evidenceIds: ['review:example'],
    };
  }
  return deepFreeze(pack);
};

export const branchNeedsReviewPack = (
  source: RuneProofCompiledPack,
  branchId: string,
): RuneProofCompiledPack => {
  const pack = structuredClone(source);
  const branch = pack.branches.find(candidate => candidate.id === branchId);
  if (!branch) throw new Error(`Unknown fixture branch ${branchId}.`);
  (branch as { requirements: RequirementExpression }).requirements = {
    kind: 'UNRESOLVED_EVIDENCE',
    id: `unresolved:${branch.id}`,
    evidenceId: `audit:${branch.id}`,
    reason: `${branch.label} needs reviewed evidence.`,
    evidenceIds: ['review:example'],
  };
  return deepFreeze(pack);
};

export const combatPack: RuneProofCompiledPack = singleBranchPack(
  'Combat Quest',
  [action('combat:guardian', 1, { kind: 'ACTION_CONFIRMED' }, {
    instruction: 'Defeat the guardian using the reviewed encounter guide.',
    requirements: {
      kind: 'ALL',
      requirements: [
        skillRequirement('Mining', 15),
        {
          kind: 'CHUNK_ACCESS',
          id: 'chunk:50,50',
          chunk: '50,50',
          plane: 0,
          evidenceIds: ['review:example'],
        },
      ],
    },
    location: {
      kind: 'INSTANCE',
      label: 'Guardian arena',
      instanceId: 'guardian-arena',
      entranceChunks: ['50,50'],
      plane: 1,
      evidenceIds: ['review:example'],
    },
    combat: {
      id: 'combat:guardian',
      encounter: 'Guardian encounter',
      phases: ['Opening phase', 'Enraged phase'],
      mandatoryMechanics: ['Avoid the reviewed floor attack.'],
      equipmentCapabilities: ['A reliable damage option'],
      recommendedSupplies: ['Food', 'A teleport out'],
      deathAndEscape: 'Use the reviewed exit before supplies run out.',
      reentry: 'Return through the guardian-arena entrance.',
      confirmationId: 'combat:guardian:ready',
      evidenceIds: ['review:example'],
    },
  })],
);

export const initialItemPack = (input: Readonly<{
  canonicalItemKey: string;
  alternativeItemKey: string;
  reviewedQuantity: number;
}>): RuneProofCompiledPack => singleBranchPack(
  'Initial Item Quest',
  [action('initial-item:use', 1, { kind: 'ACTION_CONFIRMED' }, {
    requirements: {
      kind: 'ITEM',
      id: `item:${input.canonicalItemKey}`,
      itemKey: input.canonicalItemKey,
      quantity: input.reviewedQuantity,
      evidenceIds: ['review:example'],
    },
  })],
  {
    initialItems: [{
      item: {
        key: input.canonicalItemKey,
        name: input.canonicalItemKey[0]?.toUpperCase() + input.canonicalItemKey.slice(1),
      },
      quantity: input.reviewedQuantity,
      supplyPolicy: 'PLAYER_OBTAINED',
      alternatives: [{
        key: input.alternativeItemKey,
        name: input.alternativeItemKey[0]?.toUpperCase() + input.alternativeItemKey.slice(1),
      }],
      evidenceIds: ['review:example'],
    }],
  },
);

export const manualGatePack = (
  scope: 'PREFLIGHT' | 'ACTION',
): RuneProofCompiledPack => {
  const requirement: RequirementExpression = {
    kind: 'MANUAL_CONFIRMATION',
    id: `manual:${scope.toLowerCase()}:requirement`,
    confirmationId: `manual:${scope.toLowerCase()}`,
    prompt: 'Confirm the same reviewed route condition.',
    evidenceIds: ['review:example'],
  };
  return singleBranchPack(
    `Manual ${scope} Quest`,
    [action('manual-gate:action', 1, { kind: 'ACTION_CONFIRMED' }, {
      requirements: scope === 'ACTION' ? requirement : emptyRequirements,
    })],
    { preflight: scope === 'PREFLIGHT' ? requirement : emptyRequirements },
  );
};

export const manualAnyPack = (): RuneProofCompiledPack => singleBranchPack(
  'Manual Any Quest',
  [action('manual-any:action', 1, { kind: 'ACTION_CONFIRMED' })],
  {
    preflight: {
      kind: 'ANY',
      requirements: [
        manualRequirement('manual:first', 'Confirm the first reviewed choice.'),
        manualRequirement('manual:second', 'Confirm the second reviewed choice.'),
      ],
    },
  },
);

export const itemQuantityPack = (input: Readonly<{
  reviewedQuantity: number;
  requiredQuantity: number;
}>): RuneProofCompiledPack => singleBranchPack(
  'Item Quantity Quest',
  [action('item-quantity:pay', 1, {
    kind: 'MANUAL',
    confirmationId: 'manual:item-quantity:pay',
  }, {
    requirements: {
      kind: 'ITEM',
      id: 'item:coins',
      itemKey: 'coins',
      quantity: input.requiredQuantity,
      evidenceIds: ['review:example'],
    },
  })],
  { initialItems: [{ ...initialRoot('coins'), quantity: input.reviewedQuantity }] },
);

export const spentItemPack = (
  effectKind: 'CONSUME' | 'RETURN',
): RuneProofCompiledPack => singleBranchPack(
  `Spent Item ${effectKind} Quest`,
  [
    action('example:spend-token', 1, {
      kind: 'BRANCH_CHECKPOINT',
      checkpointId: 'payment-complete',
    }, {
      itemEffects: [{ kind: effectKind, itemKey: 'quest token', quantity: 1 }],
    }),
    action('example:needs-token-again', 2, { kind: 'ACTION_CONFIRMED' }, {
      dependsOn: ['example:spend-token'],
      requirements: {
        kind: 'ITEM',
        id: 'item:quest-token-again',
        itemKey: 'quest token',
        quantity: 1,
        evidenceIds: ['review:example'],
      },
    }),
  ],
  { initialItems: [initialRoot('quest token')] },
);

export const acquiredItemPack = (): RuneProofCompiledPack => singleBranchPack(
  'Acquired Item Quest',
  [
    action('example:acquire-token', 1, {
      kind: 'ITEM_CONFIRMED',
      itemKey: 'quest token',
    }, {
      itemEffects: [{ kind: 'ACQUIRE', itemKey: 'quest token', quantity: 2 }],
    }),
    action('example:use-acquired-token', 2, {
      kind: 'MANUAL',
      confirmationId: 'manual:use-acquired-token',
    }, {
      dependsOn: ['example:acquire-token'],
      requirements: {
        kind: 'ITEM',
        id: 'item:two-quest-tokens',
        itemKey: 'quest token',
        quantity: 2,
        evidenceIds: ['review:example'],
      },
    }),
  ],
);

export const fullyConfirmedProgress = (
  pack: RuneProofCompiledPack,
  branchId: string,
): RuneProofQuestProgressV2 => {
  const branch = pack.branches.find(candidate => candidate.id === branchId);
  if (!branch) throw new Error(`Unknown fixture branch ${branchId}.`);
  const route = [...pack.sharedActions, ...branch.actions]
    .sort((left, right) => left.sourceOrder - right.sourceOrder
      || left.id.localeCompare(right.id));
  const confirmedActionIds: string[] = [];
  const confirmedItemKeys = pack.initialItems
    .filter(root => root.supplyPolicy === 'PLAYER_OBTAINED')
    .map(root => root.item.key);
  const manualConfirmationIds: string[] = [];
  const confirmedCheckpointIds: string[] = [];
  const addSelectedManuals = (requirements: RequirementExpression): void => {
    const selected = selectRuneProofManualObligations(
      requirements,
      new Set(manualConfirmationIds),
    );
    selected.requirements.forEach(requirement => {
      if (!manualConfirmationIds.includes(requirement.confirmationId)) {
        manualConfirmationIds.push(requirement.confirmationId);
      }
    });
  };
  addSelectedManuals(pack.preflight);
  addSelectedManuals(branch.requirements);
  route.forEach(candidate => {
    addSelectedManuals(candidate.requirements);
    if (candidate.combat
      && !manualConfirmationIds.includes(candidate.combat.confirmationId)) {
      manualConfirmationIds.push(candidate.combat.confirmationId);
    }
    switch (candidate.completion.kind) {
      case 'ACTION_CONFIRMED':
      case 'CANONICAL_QUEST_COMPLETED':
        confirmedActionIds.push(candidate.id);
        break;
      case 'ITEM_CONFIRMED':
        if (!confirmedItemKeys.includes(candidate.completion.itemKey)) {
          confirmedItemKeys.push(candidate.completion.itemKey);
        }
        break;
      case 'MANUAL':
        if (!manualConfirmationIds.includes(candidate.completion.confirmationId)) {
          manualConfirmationIds.push(candidate.completion.confirmationId);
        }
        break;
      case 'BRANCH_CHECKPOINT':
        confirmedCheckpointIds.push(candidate.completion.checkpointId);
        break;
    }
  });
  return {
    ...emptyProgressFor(pack, 'run-a'),
    selectedBranchId: branchId,
    confirmedActionIds,
    confirmedItemKeys,
    manualConfirmationIds,
    confirmedCheckpointIds,
  };
};

export const packWithSharedBranchItemTarget = (
  pack: RuneProofCompiledPack,
  itemKey: string,
): RuneProofCompiledPack => {
  const changed = structuredClone(pack);
  for (const branch of changed.branches) {
    const step = branch.actions.find(candidate => candidate.id === `${branch.id}:step`);
    if (step) {
      (step as { completion: RuneProofAction['completion'] }).completion = {
        kind: 'ITEM_CONFIRMED',
        itemKey,
      };
    }
  }
  return deepFreeze(changed);
};

export const packWithSharedAndSingleBranchItemTarget = (
  pack: RuneProofCompiledPack,
  itemKey: string,
  branchId: string,
): RuneProofCompiledPack => {
  const changed = structuredClone(pack);
  const sharedAction = changed.sharedActions.find(action => action.id === 'shared:start');
  const branchAction = changed.branches
    .find(branch => branch.id === branchId)
    ?.actions.find(action => action.id === `${branchId}:step`);
  for (const target of [sharedAction, branchAction]) {
    if (target) {
      (target as { completion: RuneProofAction['completion'] }).completion = {
        kind: 'ITEM_CONFIRMED',
        itemKey,
      };
    }
  }
  return deepFreeze(changed);
};
