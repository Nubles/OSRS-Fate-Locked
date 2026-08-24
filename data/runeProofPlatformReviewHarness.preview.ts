import type {
  RuneProofPlatformReviewHarness,
  RuneProofPlatformReviewScenario,
} from './questWalkthroughLoader';
import type { RuneProofCatalogueEntry } from './runeProofQuestCatalogue';
import type {
  RequirementExpression,
  RuneProofAction,
  RuneProofCompiledPack,
  RuneProofQuestPack,
} from '../utils/questStrategies/packModel';
import { compileRuneProofQuestPack } from '../utils/questStrategies/packCompiler';
import type { RuneProofRequirementSnapshot } from '../utils/questStrategies/requirements';

export const runeProofPlatformReviewHarnessRevision =
  'RUNEPROOF_PLATFORM_REVIEW_HARNESS_REVISION_V1_2026_08_22';
export const runeProofPreviewQaMarker = 'RUNEPROOF_PREVIEW_QA_BRANCH_COMBAT_V1';

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

const evidenceIds = ['review:runeproof-platform-harness'] as const;
const noGate: RequirementExpression = { kind: 'ALL', requirements: [] };

const manualGate = (
  confirmationId: string,
  prompt: string,
): RequirementExpression => ({
  kind: 'MANUAL_CONFIRMATION',
  id: confirmationId,
  confirmationId,
  prompt,
  evidenceIds,
});

const surfaceAction = (
  id: string,
  sourceOrder: number,
  instruction: string,
  dependsOn: readonly string[],
): RuneProofAction => ({
  id,
  sourceOrder,
  instruction,
  kind: 'TRAVEL',
  dependsOn,
  requirements: noGate,
  itemEffects: [],
  location: {
    kind: 'SURFACE',
    label: 'Reviewed Lumbridge route',
    chunks: ['50,50'],
    plane: 0,
    evidenceIds,
  },
  completion: { kind: 'ACTION_CONFIRMED' },
  alternatives: [],
  evidenceIds,
});

const catalogueFor = (questId: string, slug: string): RuneProofCatalogueEntry => ({
  questId,
  slug,
  kind: 'quest',
  membership: 'MEMBERS',
  wikiTitle: questId,
  sourceRevision: runeProofPlatformReviewHarnessRevision,
  sourceRevisionTimestamp: '2026-08-22T00:00:00Z',
  requirementStatus: 'VERIFIED',
  progressionPriority: 210,
  milestone: 5,
  requirementComplexity: {
    schemaVersion: 1,
    score: 20,
    baselineMilestone: 5,
    assignedMilestone: 5,
    dimensions: {},
    flags: ['PRIVATE_REVIEW_HARNESS'],
  },
});

const packDefinitionFor = (
  scenarioId: RuneProofPlatformReviewScenario['id'],
  preflight: RequirementExpression,
): Readonly<{
  definition: RuneProofQuestPack;
  catalogue: RuneProofCatalogueEntry;
}> => {
  const prefix = `runeproof-harness:${scenarioId.toLowerCase()}`;
  const questId = `RuneProof Platform Review Harness — ${scenarioId}`;
  const shared = surfaceAction(
    `${prefix}:shared-start`,
    1,
    'Confirm the reviewed shared starting point.',
    [],
  );
  const localStep: RuneProofAction = {
    ...surfaceAction(
      `${prefix}:local-step`,
      2,
      'Follow the reviewed local surface route.',
      [shared.id],
    ),
    itemEffects: [{ kind: 'ACQUIRE', itemKey: 'review token', quantity: 1 }],
    requirements: manualGate(
      `${prefix}:local-route`,
      'Confirm the reviewed local-route consequence.',
    ),
    alternatives: [{
      id: `${prefix}:reviewed-alternative`,
      label: 'Reviewed alternative entrance',
      kind: 'QUEST_ROUTE',
      evidenceIds,
      requirements: noGate,
      location: {
        kind: 'INSTANCE',
        label: 'Reviewed alternative instance entrance',
        instanceId: 'runeproof-review-instance',
        entranceChunks: ['51,50'],
        plane: 1,
        evidenceIds,
      },
    }],
  };
  const localCheckpoint: RuneProofAction = {
    ...surfaceAction(
      `${prefix}:local-checkpoint-step`,
      3,
      'Confirm the reviewed local-route checkpoint.',
      [localStep.id],
    ),
    completion: {
      kind: 'BRANCH_CHECKPOINT',
      checkpointId: `${prefix}:local-checkpoint`,
    },
  };
  const localCombat: RuneProofAction = {
    ...surfaceAction(
      `${prefix}:local-combat`,
      4,
      'Face the reviewed guardian after the local checkpoint.',
      [localCheckpoint.id],
    ),
    kind: 'KILL',
    combat: {
      id: `${prefix}:guardian`,
      encounter: 'Reviewed platform guardian',
      phases: ['Opening', 'Recovery'],
      mandatoryMechanics: ['Avoid the marked tile.'],
      equipmentCapabilities: ['A reviewed damage option'],
      recommendedSupplies: ['Food'],
      deathAndEscape: 'Escape through the reviewed entrance.',
      reentry: 'Return through the same entrance on plane 1.',
      confirmationId: `${prefix}:combat-ready`,
      evidenceIds,
    },
  };
  const localLaterCombat: RuneProofAction = {
    ...surfaceAction(
      `${prefix}:local-later-combat`,
      5,
      'Face the later reviewed guardian only when this action becomes current.',
      [localCombat.id],
    ),
    kind: 'KILL',
    combat: {
      id: `${prefix}:later-guardian`,
      encounter: 'Later reviewed platform guardian',
      phases: ['Later phase'],
      mandatoryMechanics: ['Wait for the reviewed opening.'],
      equipmentCapabilities: ['A reviewed damage option'],
      recommendedSupplies: ['Food'],
      deathAndEscape: 'Escape through the reviewed surface route.',
      reentry: 'Return to the reviewed surface route.',
      confirmationId: `${prefix}:later-combat-ready`,
      evidenceIds,
    },
  };
  const localComplete: RuneProofAction = {
    ...surfaceAction(
      `${prefix}:local-complete`,
      6,
      'Confirm the local review route is complete.',
      [localLaterCombat.id],
    ),
    kind: 'INFORMATION',
    completion: { kind: 'CANONICAL_QUEST_COMPLETED', questId },
  };
  const remoteStep: RuneProofAction = {
    ...surfaceAction(
      `${prefix}:remote-step`,
      2,
      'Enter the reviewed remote instance route.',
      [shared.id],
    ),
    requirements: manualGate(
      `${prefix}:remote-route`,
      'Confirm the reviewed remote-route consequence.',
    ),
    location: {
      kind: 'INSTANCE',
      label: 'Reviewed remote instance entrance',
      instanceId: 'runeproof-review-instance',
      entranceChunks: ['51,50'],
      plane: 1,
      evidenceIds,
    },
  };
  const remoteCheckpoint: RuneProofAction = {
    ...surfaceAction(
      `${prefix}:remote-checkpoint-step`,
      3,
      'Confirm the reviewed remote-route checkpoint.',
      [remoteStep.id],
    ),
    location: remoteStep.location,
    completion: {
      kind: 'BRANCH_CHECKPOINT',
      checkpointId: `${prefix}:remote-checkpoint`,
    },
  };
  const remoteComplete: RuneProofAction = {
    ...surfaceAction(
      `${prefix}:remote-complete`,
      4,
      'Confirm the remote review route is complete.',
      [remoteCheckpoint.id],
    ),
    kind: 'INFORMATION',
    completion: { kind: 'CANONICAL_QUEST_COMPLETED', questId },
  };
  const catalogue = catalogueFor(questId, `runeproof-platform-review-${scenarioId.toLowerCase()}`);
  const definition: RuneProofQuestPack = {
    schemaVersion: 1,
    questId,
    revision: `${runeProofPlatformReviewHarnessRevision}:${scenarioId}`,
    catalogueRevision: runeProofPlatformReviewHarnessRevision,
    sources: [{
      id: 'source:runeproof-platform-harness',
      kind: 'INDEPENDENT_REVIEW',
      uri: 'urn:runeproof:platform-review-harness:v1',
      revision: runeProofPlatformReviewHarnessRevision,
      revisionTimestamp: '2026-08-22T00:00:00Z',
      reviewedAt: '2026-08-22T00:00:00Z',
      author: 'Fate Locked',
      methodology: `Private synthetic platform review. ${runeProofPreviewQaMarker}`,
    }],
    evidence: [{
      id: evidenceIds[0],
      sourceId: 'source:runeproof-platform-harness',
      sourceLocator: `scenario:${scenarioId}`,
      decision: 'Exercise reviewed branch, location, alternative, and combat controls.',
    }],
    initialItems: [{
      item: { key: 'review tool', name: 'Review tool' },
      quantity: 1,
      supplyPolicy: 'PLAYER_OBTAINED',
      alternatives: [{ key: 'reviewed tool alternative', name: 'Reviewed tool alternative' }],
      evidenceIds,
    }],
    preflight,
    branches: [{
      id: 'local',
      label: 'Local',
      requirements: noGate,
      rank: { localRoutePenalty: 0, newUnlockCount: 0, riskCost: 0, tieBreak: 0 },
      actions: [localStep, localCheckpoint, localCombat, localLaterCombat, localComplete],
      checkpointIds: [`${prefix}:local-checkpoint`],
      evidenceIds,
    }, {
      id: 'remote',
      label: 'Remote',
      requirements: noGate,
      rank: { localRoutePenalty: 1, newUnlockCount: 1, riskCost: 1, tieBreak: 1 },
      actions: [remoteStep, remoteCheckpoint, remoteComplete],
      checkpointIds: [`${prefix}:remote-checkpoint`],
      evidenceIds,
    }],
    sharedActions: [shared],
    completion: {
      canonicalQuestId: questId,
      branchActionIds: {
        local: localComplete.id,
        remote: remoteComplete.id,
      },
      evidenceIds,
    },
    migrations: [],
  };
  return { definition, catalogue };
};

const packFor = (
  scenarioId: RuneProofPlatformReviewScenario['id'],
  preflight: RequirementExpression,
): RuneProofCompiledPack => {
  const { definition, catalogue } = packDefinitionFor(scenarioId, preflight);
  const compiled = compileRuneProofQuestPack(definition, {
    catalogue,
    expectedCatalogueRevision: runeProofPlatformReviewHarnessRevision,
  });
  const blocking = compiled.findings.filter(finding => finding.severity === 'BLOCKING');
  if (!compiled.pack || blocking.length > 0) {
    throw new Error(
      `RuneProof platform review scenario ${scenarioId} failed compilation: ${blocking
        .map(finding => finding.message).join('; ')}`,
    );
  }
  return compiled.pack;
};

const snapshot = (overrides: Partial<RuneProofRequirementSnapshot> = {}): RuneProofRequirementSnapshot => ({
  completedQuestIds: new Set<string>(),
  questPoints: 0,
  levels: { Mining: 99 },
  combatLevel: 126,
  regions: new Set(['Misthalin']),
  chunks: new Set(['50,50', '51,50']),
  canonicalUnlocks: {
    equipment: new Set<string>(),
    mobility: new Set<string>(),
    arcana: new Set<string>(),
    housing: new Set<string>(),
    guilds: new Set<string>(),
    merchants: new Set<string>(),
    minigames: new Set<string>(),
    bosses: new Set<string>(),
    storage: new Set<string>(),
    farming: new Set<string>(),
    slayer: new Set<string>(),
    banks: new Set<string>(),
    diaries: new Set<string>(),
    combatAchievements: new Set<string>(),
    tasks: new Set<string>(),
    collectionItems: new Set<string>(),
  },
  transportIds: new Set<string>(),
  itemQuantities: { 'review tool': 1 },
  itemAliases: { 'reviewed tool alternative': 'review tool' },
  confirmedManualIds: new Set<string>(),
  selectedBranchId: undefined,
  branchCheckpointIds: new Set<string>(),
  observedCanonicalCompletion: false,
  ...overrides,
});

const scenarioDefinitions: readonly Readonly<{
  id: RuneProofPlatformReviewScenario['id'];
  label: string;
  preflight: RequirementExpression;
  snapshot?: RuneProofRequirementSnapshot;
}>[] = [
  { id: 'READY', label: 'Ready', preflight: noGate },
  {
    id: 'CONFIRM',
    label: 'Confirm',
    preflight: {
      kind: 'MANUAL_CONFIRMATION',
      id: 'manual:review-harness',
      confirmationId: 'manual:review-harness',
      prompt: 'Confirm the reviewed platform consequence.',
      evidenceIds,
    },
  },
  {
    id: 'BLOCKED',
    label: 'Blocked',
    preflight: {
      kind: 'SKILL_LEVEL',
      id: 'skill:mining:99',
      skill: 'Mining',
      level: 99,
      evidenceIds,
    },
    snapshot: snapshot({ levels: { Mining: 1 } }),
  },
  {
    id: 'NEEDS_REVIEW',
    label: 'Needs review',
    preflight: {
      kind: 'SKILL_LEVEL',
      id: 'skill:review-skill:1',
      skill: 'Review Skill',
      level: 1,
      evidenceIds,
    },
  },
  { id: 'COMPLETE', label: 'Complete', preflight: noGate },
];

const scenarios = scenarioDefinitions.map((definition): RuneProofPlatformReviewScenario => {
  const pack = packFor(definition.id, definition.preflight);
  return deepFreeze({
    id: definition.id,
    label: definition.label,
    pack,
    snapshot: definition.snapshot ?? snapshot(),
    completedQuestIds: definition.id === 'COMPLETE' ? [pack.questId] : [],
  });
});

export const runeProofPlatformReviewHarness: RuneProofPlatformReviewHarness = deepFreeze({
  marker: 'RUNEPROOF_PLATFORM_REVIEW_HARNESS_V1',
  scenarios,
});
