import type { RuneProofCatalogueEntry } from '../../data/runeProofQuestCatalogue';
import type { ChunkKey, QuestItemRequirement } from '../questRoutes/model';
import type { WalkthroughActionKind } from '../questWalkthroughs/model';

export type RuneProofProofState =
  | 'READY'
  | 'CONFIRM'
  | 'BLOCKED'
  | 'NEEDS_REVIEW'
  | 'COMPLETE';

interface RequirementBase {
  readonly id: string;
  readonly evidenceIds: readonly string[];
}

export type RuneProofAtomicRequirement = RequirementBase & (
  | { readonly kind: 'QUEST_COMPLETED'; readonly questId: string }
  | { readonly kind: 'QUEST_POINTS'; readonly points: number }
  | { readonly kind: 'SKILL_LEVEL'; readonly skill: string; readonly level: number }
  | {
      readonly kind: 'TEMPORARY_BOOST';
      readonly skill: string;
      readonly baseLevel: number;
      readonly targetLevel: number;
      readonly boostSourceIds: readonly string[];
      readonly timingPolicy: 'QUEST_START' | 'ACTION_WINDOW' | 'MANUAL_TIMING';
    }
  | { readonly kind: 'COMBAT_LEVEL'; readonly level: number }
  | { readonly kind: 'REGION_ACCESS'; readonly regionId: string }
  | { readonly kind: 'CHUNK_ACCESS'; readonly chunk: ChunkKey; readonly plane: number }
  | {
      readonly kind: 'TRANSPORT_ACCESS';
      readonly transportId: string;
      readonly origin: ChunkKey;
      readonly destination: ChunkKey;
      readonly oneWay: boolean;
      readonly fare?: Readonly<{ itemKey: string; quantity: number }>;
    }
  | {
      readonly kind: 'INSTANCE_ACCESS';
      readonly instanceId: string;
      readonly entranceChunks: readonly ChunkKey[];
      readonly plane: number;
    }
  | {
      readonly kind: 'ITEM';
      readonly itemKey: string;
      readonly quantity: number;
    }
  | {
      readonly kind: 'CANONICAL_UNLOCK';
      readonly unlockType:
        | 'EQUIPMENT' | 'MOBILITY' | 'ARCANA' | 'HOUSING'
        | 'GUILD' | 'MERCHANT' | 'MINIGAME' | 'BOSS'
        | 'STORAGE' | 'FARMING' | 'SLAYER' | 'BANK'
        | 'DIARY' | 'COMBAT_ACHIEVEMENT' | 'TASK' | 'COLLECTION_ITEM';
      readonly unlockId: string;
    }
  | { readonly kind: 'BRANCH_STATE'; readonly branchId: string; readonly checkpointId?: string }
  | { readonly kind: 'MANUAL_CONFIRMATION'; readonly confirmationId: string; readonly prompt: string }
  | {
      readonly kind: 'UNRESOLVED_EVIDENCE';
      readonly evidenceId: string;
      readonly reason: string;
    }
);

export type RequirementExpression =
  | { readonly kind: 'ALL'; readonly requirements: readonly RequirementExpression[] }
  | { readonly kind: 'ANY'; readonly requirements: readonly RequirementExpression[] }
  | RuneProofAtomicRequirement;

export interface ReviewedSourceReference {
  readonly id: string;
  readonly kind: 'QUEST_DATA' | 'WIKI_REVISION' | 'CHUNK_PICKER' | 'INDEPENDENT_REVIEW';
  readonly uri: string;
  readonly revision: string;
  readonly revisionTimestamp: string;
  readonly reviewedAt: string;
  readonly author?: string;
  readonly methodology?: string;
}

export interface ReviewedEvidenceReference {
  readonly id: string;
  readonly sourceId: string;
  readonly sourceLocator: string;
  readonly decision: string;
}

export type ReviewedLocationReference =
  | {
      readonly kind: 'SURFACE';
      readonly label: string;
      readonly chunks: readonly ChunkKey[];
      readonly plane: number;
      readonly evidenceIds: readonly string[];
    }
  | {
      readonly kind: 'INSTANCE';
      readonly label: string;
      readonly instanceId: string;
      readonly entranceChunks: readonly ChunkKey[];
      readonly plane: number;
      readonly evidenceIds: readonly string[];
    };

export type RuneProofItemEffect =
  | { readonly kind: 'ACQUIRE'; readonly itemKey: string; readonly quantity: number }
  | {
      readonly kind: 'PRODUCE';
      readonly itemKey: string;
      readonly quantity: number;
      readonly from: readonly Readonly<{ itemKey: string; quantity: number }>[];
    }
  | { readonly kind: 'CONSUME'; readonly itemKey: string; readonly quantity: number }
  | { readonly kind: 'RETAIN'; readonly itemKey: string; readonly quantity: number }
  | { readonly kind: 'RETURN'; readonly itemKey: string; readonly quantity: number }
  | {
      readonly kind: 'LEND';
      readonly itemKey: string;
      readonly quantity: number;
      readonly replacementItemKey?: string;
    }
  | { readonly kind: 'REUSE'; readonly itemKey: string; readonly quantity: number }
  | { readonly kind: 'QUEST_PROVIDED'; readonly itemKey: string; readonly quantity: number };

export type RuneProofActionCompletion =
  | { readonly kind: 'ACTION_CONFIRMED' }
  | { readonly kind: 'MANUAL'; readonly confirmationId: string }
  | { readonly kind: 'ITEM_CONFIRMED'; readonly itemKey: string }
  | { readonly kind: 'BRANCH_CHECKPOINT'; readonly checkpointId: string }
  | { readonly kind: 'CANONICAL_QUEST_COMPLETED'; readonly questId: string };

export interface ReviewedMethodReference {
  readonly id: string;
  readonly label: string;
  readonly kind: 'DIRECT_SOURCE' | 'TRANSFORMATION' | 'QUEST_ROUTE';
  readonly evidenceIds: readonly string[];
}

export interface ReviewedAlternativeReference extends ReviewedMethodReference {
  readonly requirements: RequirementExpression;
  readonly location?: ReviewedLocationReference;
}

export interface RuneProofCombatReadiness {
  readonly id: string;
  readonly encounter: string;
  readonly phases: readonly string[];
  readonly mandatoryMechanics: readonly string[];
  readonly equipmentCapabilities: readonly string[];
  readonly recommendedSupplies: readonly string[];
  readonly deathAndEscape: string;
  readonly reentry: string;
  readonly confirmationId: string;
  readonly evidenceIds: readonly string[];
}

export interface RuneProofAction {
  readonly id: string;
  readonly sourceOrder: number;
  readonly instruction: string;
  readonly kind: WalkthroughActionKind;
  readonly dependsOn: readonly string[];
  readonly requirements: RequirementExpression;
  readonly itemEffects: readonly RuneProofItemEffect[];
  readonly location: ReviewedLocationReference;
  readonly completion: RuneProofActionCompletion;
  readonly preferredMethod?: ReviewedMethodReference;
  readonly alternatives: readonly ReviewedAlternativeReference[];
  readonly combat?: RuneProofCombatReadiness;
  readonly evidenceIds: readonly string[];
}

export interface ReviewedBranchRank {
  readonly localRoutePenalty: number;
  readonly newUnlockCount: number;
  readonly riskCost: number;
  readonly tieBreak: number;
}

export interface RuneProofBranch {
  readonly id: string;
  readonly label: string;
  readonly requirements: RequirementExpression;
  readonly rank: ReviewedBranchRank;
  readonly actions: readonly RuneProofAction[];
  readonly checkpointIds: readonly string[];
  readonly evidenceIds: readonly string[];
}

export type RuneProofInitialItemRequirement = QuestItemRequirement & Readonly<{
  evidenceIds: readonly string[];
}>;

export interface RuneProofCompletionDefinition {
  readonly canonicalQuestId: string;
  readonly branchActionIds: Readonly<Record<string, string>>;
  readonly evidenceIds: readonly string[];
}

export interface RuneProofProgressMigration {
  readonly id: string;
  readonly fromRevision: string;
  readonly actionIds: Readonly<Record<string, string>>;
  readonly itemKeys: Readonly<Record<string, string>>;
  readonly branchIds: Readonly<Record<string, string>>;
  readonly manualConfirmationIds: Readonly<Record<string, string>>;
  readonly checkpointIds: Readonly<Record<string, string>>;
}

export interface RuneProofQuestPack {
  readonly schemaVersion: 1;
  readonly questId: string;
  readonly revision: string;
  readonly catalogueRevision: string;
  readonly sources: readonly ReviewedSourceReference[];
  readonly evidence: readonly ReviewedEvidenceReference[];
  readonly initialItems: readonly RuneProofInitialItemRequirement[];
  readonly preflight: RequirementExpression;
  readonly branches: readonly RuneProofBranch[];
  readonly sharedActions: readonly RuneProofAction[];
  readonly completion: RuneProofCompletionDefinition;
  readonly migrations: readonly RuneProofProgressMigration[];
}

export type RuneProofFindingCode =
  | 'IDENTITY_MISMATCH' | 'SOURCE_MISMATCH' | 'STALE_EVIDENCE'
  | 'UNRESOLVED_REQUIREMENT' | 'INVALID_REQUIREMENT_REFERENCE'
  | 'INVALID_LOCATION' | 'INVALID_TRANSPORT' | 'INVALID_PROOF_REFERENCE'
  | 'DUPLICATE_ID' | 'DANGLING_DEPENDENCY' | 'DEPENDENCY_CYCLE'
  | 'INVALID_ORDER' | 'INVALID_RANK' | 'UNREACHABLE_COMPLETION'
  | 'BROKEN_ITEM_LEDGER' | 'CONFLICTING_COMPLETION'
  | 'MISSING_COMBAT_CONFIRMATION' | 'INVALID_MIGRATION';

export interface RuneProofCompileFinding {
  readonly id: string;
  readonly severity: 'BLOCKING' | 'WARNING';
  readonly code: RuneProofFindingCode;
  readonly scope: 'PACK' | 'BRANCH' | 'ACTION';
  readonly questId: string;
  readonly branchId?: string;
  readonly actionId?: string;
  readonly message: string;
  readonly evidenceIds: readonly string[];
}

export interface RuneProofCompiledPack extends RuneProofQuestPack {
  readonly catalogue: RuneProofCatalogueEntry;
  readonly branches: readonly RuneProofBranch[];
  readonly findings: readonly RuneProofCompileFinding[];
}

export interface RuneProofCompileResult {
  readonly pack?: RuneProofCompiledPack;
  readonly findings: readonly RuneProofCompileFinding[];
  readonly rejectedBranchIds: readonly string[];
}

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

export const requirementAll = (
  ...requirements: readonly RequirementExpression[]
): Extract<RequirementExpression, { kind: 'ALL' }> =>
  deepFreeze({ kind: 'ALL', requirements: [...requirements] });

export const requirementAny = (
  ...requirements: readonly RequirementExpression[]
): Extract<RequirementExpression, { kind: 'ANY' }> =>
  deepFreeze({ kind: 'ANY', requirements: [...requirements] });

export const runeProofFindingId = (
  identity: Pick<
    RuneProofCompileFinding,
    'code' | 'scope' | 'questId' | 'branchId' | 'actionId'
  >,
  discriminator: string,
): string => [
  identity.code,
  identity.scope,
  identity.questId,
  identity.branchId === undefined ? '0' : `1:${identity.branchId}`,
  identity.actionId === undefined ? '0' : `1:${identity.actionId}`,
  discriminator,
].map(part => encodeURIComponent(part)).join('|');

export const defineRuneProofQuestPack = (
  pack: RuneProofQuestPack,
): RuneProofQuestPack => deepFreeze(structuredClone(pack));
