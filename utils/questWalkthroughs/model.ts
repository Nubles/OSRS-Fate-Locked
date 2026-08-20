import type { ChunkKey, ItemRef, RouteGate } from '../questRoutes/model';

export type WalkthroughActionKind =
  | 'TALK_TO'
  | 'ACQUIRE'
  | 'USE_ITEM'
  | 'INTERACT_OBJECT'
  | 'KILL'
  | 'TRAVEL'
  | 'DIALOGUE'
  | 'INFORMATION';

export type WalkthroughConfidence =
  | 'EXACT'
  | 'REVIEWED'
  | 'AMBIGUOUS'
  | 'UNMAPPED';

export type WalkthroughEntityKind = 'npc' | 'object';

export interface WalkthroughEntityRef {
  readonly kind: WalkthroughEntityKind;
  readonly name: string;
}

export interface WalkthroughItemRef {
  readonly item: ItemRef;
  readonly quantity: number;
  readonly supplyPolicy: 'PLAYER_OBTAINED' | 'QUEST_PROVIDED';
}

export type QuestActionCompletionRule =
  | { readonly kind: 'MANUAL' }
  | { readonly kind: 'ITEM_CONFIRMED'; readonly itemKey: string }
  | { readonly kind: 'QUEST_COMPLETED'; readonly questId: string };

export type QuestActionPreferredMethod =
  | { readonly kind: 'DIRECT_SOURCE'; readonly itemKey: string; readonly sourceLabel: string }
  | { readonly kind: 'TRANSFORMATION'; readonly recipeId: string };

export interface QuestActionCoachMetadata {
  readonly fulfils: readonly WalkthroughItemRef[];
  readonly completion: QuestActionCompletionRule;
  readonly preferredMethod?: QuestActionPreferredMethod;
  readonly fallbackPolicy: 'BLOCK_THEN_ALTERNATIVES' | 'INTERCHANGEABLE' | 'NONE';
}

export interface WalkthroughSkillRequirement {
  readonly skill: string;
  readonly level: number;
}

export type WalkthroughLocationDirective =
  | { readonly kind: 'EXPLICIT_CHUNKS'; readonly chunks: readonly ChunkKey[] }
  | { readonly kind: 'EXACT_ENTITY'; readonly entity: WalkthroughEntityRef }
  | {
      readonly kind: 'INHERITED_TARGET';
      readonly targetEntity: WalkthroughEntityRef;
      readonly sourceActionId: string;
    }
  | {
      readonly kind: 'REVIEWED_ALIAS';
      readonly alias: string;
      readonly chunks: readonly ChunkKey[];
      readonly reviewer: string;
      readonly reviewedAt: string;
      readonly evidence: string;
      readonly rationale: string;
    }
  | { readonly kind: 'NONE' };

export interface QuestWalkthroughActionDefinition {
  readonly id: string;
  readonly section: 'PREPARE' | 'QUEST';
  readonly sourceOrder: number;
  readonly kind: WalkthroughActionKind;
  readonly confidence: WalkthroughConfidence;
  readonly displayText: string;
  readonly rawWikiLineIds: readonly string[];
  readonly chunkPickerTaskId?: string;
  readonly dependsOn: readonly string[];
  readonly entities: readonly WalkthroughEntityRef[];
  readonly items: readonly WalkthroughItemRef[];
  readonly gates: readonly RouteGate[];
  readonly location: WalkthroughLocationDirective;
  readonly coach?: QuestActionCoachMetadata;
}

export interface QuestWalkthroughDefinition {
  readonly questId: string;
  readonly revision: string;
  readonly releaseStatus: 'PREVIEW_ONLY' | 'APPROVED';
  readonly source: {
    readonly wikiTitle: string;
    readonly wikiRevision: string;
    readonly wikiRevisionTimestamp: string;
    readonly wikiUrl: string;
    readonly wikiLicence: 'CC BY-NC-SA 3.0';
    readonly wikiLicenceUrl: string;
    readonly chunkPickerRepository: 'source-chunk/chunk-picker-v2';
    readonly chunkPickerCommit: string;
    readonly chunkPickerLicenceStatus: 'UNVERIFIED' | 'PERMISSION_RECORDED';
    readonly permissionReference?: string;
  };
  readonly sourceLines: readonly {
    readonly id: string;
    readonly section: string;
    readonly sourceOrder: number;
    readonly rawText: string;
  }[];
  readonly actions: readonly QuestWalkthroughActionDefinition[];
}

export type WalkthroughLocationEvidenceKind =
  | 'EXPLICIT_CHUNK'
  | 'EXACT_ENTITY'
  | 'INHERITED_TARGET'
  | 'REVIEWED_ALIAS'
  | 'NONE';

export interface ResolvedWalkthroughLocation {
  readonly confidence: WalkthroughConfidence;
  readonly evidenceKind: WalkthroughLocationEvidenceKind;
  readonly chunks: readonly ChunkKey[];
  readonly candidateChunks: readonly ChunkKey[];
  readonly explanation: string;
  readonly sourceEntity?: WalkthroughEntityRef;
  readonly sourceActionId?: string;
  readonly review?: {
    readonly reviewer: string;
    readonly reviewedAt: string;
    readonly evidence: string;
    readonly rationale: string;
  };
}

export type ResolvedWalkthroughAction =
  Omit<QuestWalkthroughActionDefinition, 'location'> & {
    readonly definition: QuestWalkthroughActionDefinition;
    readonly location: ResolvedWalkthroughLocation;
  };

export type ResolvedQuestWalkthrough =
  Omit<QuestWalkthroughDefinition, 'actions'> & {
    readonly actions: readonly ResolvedWalkthroughAction[];
  };

export type WalkthroughProofActionState =
  | 'READY_HERE'
  | 'REQUIREMENT_MISSING'
  | 'CHUNK_LOCKED'
  | 'LOCATION_NEEDS_REVIEW'
  | 'ITEM_EVIDENCE_INCOMPLETE'
  | 'INFORMATION';

export type WalkthroughBlocker =
  | { readonly kind: 'CHUNK'; readonly chunk: ChunkKey; readonly label: string }
  | { readonly kind: 'ITEM'; readonly itemKey: string; readonly label: string }
  | { readonly kind: 'GATE'; readonly gate: RouteGate; readonly label: string }
  | { readonly kind: 'DEPENDENCY'; readonly actionId: string; readonly label: string }
  | { readonly kind: 'LOCATION'; readonly label: string };

export interface EvaluatedWalkthroughAction {
  readonly definition: QuestWalkthroughActionDefinition;
  readonly location: ResolvedWalkthroughLocation;
  readonly state: WalkthroughProofActionState;
  readonly blockers: readonly WalkthroughBlocker[];
  readonly itemPreparation: readonly {
    readonly itemKey: string;
    readonly analysisState: string;
    readonly obtainableNow: boolean;
  }[];
}

export interface QuestWalkthroughAnalysis {
  readonly questId: string;
  readonly releaseStatus: QuestWalkthroughDefinition['releaseStatus'];
  readonly status: 'READY' | 'BLOCKED' | 'INCOMPLETE';
  readonly actions: readonly EvaluatedWalkthroughAction[];
  readonly blockers: readonly WalkthroughBlocker[];
  readonly hasIncompleteEvidence: boolean;
  readonly sourceLines: QuestWalkthroughDefinition['sourceLines'];
  readonly source: QuestWalkthroughDefinition['source'];
}
