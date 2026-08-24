export type RuneProofCoverageDimensionId =
  | 'identity' | 'preflight' | 'coreRoute' | 'locations'
  | 'transport' | 'instances' | 'items' | 'branches'
  | 'combatManual' | 'evidence' | 'progressMigration' | 'completion';

export type RuneProofCoverageDisposition =
  | 'VALIDATED' | 'NOT_REQUIRED' | 'NEEDS_REVIEW';

export interface RuneProofPackValidationSnapshot {
  readonly schemaVersion: 1;
  readonly catalogueRevision: string;
  readonly packs: readonly {
    readonly questId: string;
    readonly packRevision: string;
    readonly blockingFindingIds: readonly string[];
    readonly findingDimensions: Readonly<Record<
      string,
      readonly RuneProofCoverageDimensionId[]
    >>;
    readonly semanticDisposition: Readonly<Record<
      Exclude<RuneProofCoverageDimensionId, 'identity'>,
      RuneProofCoverageDisposition
    >>;
  }[];
}

export interface RuneProofCoverageDimension {
  readonly applicability: 'REQUIRED' | 'NOT_REQUIRED' | 'NEEDS_REVIEW';
  readonly modelled: boolean;
  readonly validated: boolean;
  readonly previewApproved: boolean;
  readonly publicApproved: boolean;
  readonly findingIds: readonly string[];
}

export interface RuneProofCoverageRow {
  readonly questId: string;
  readonly slug: string;
  readonly kind: 'quest' | 'miniquest';
  readonly membership: 'F2P' | 'MEMBERS';
  readonly milestone: 1 | 2 | 3 | 4 | 5;
  readonly progressionPriority: number;
  readonly packRevision?: string;
  readonly compilerValid: boolean;
  readonly previewApproved: boolean;
  readonly publicApproved: boolean;
  readonly dimensions: Readonly<Record<
    RuneProofCoverageDimensionId,
    RuneProofCoverageDimension
  >>;
}

export interface RuneProofCoverageDimensionSummary {
  readonly required: number;
  readonly notRequired: number;
  readonly needsReview: number;
  readonly modelled: number;
  readonly validated: number;
  readonly previewApproved: number;
  readonly publicApproved: number;
  readonly findingCount: number;
}

export interface RuneProofCoverageSummary {
  readonly totalObjectives: number;
  readonly quests: number;
  readonly miniquests: number;
  readonly f2p: number;
  readonly members: number;
  readonly compilerValidPacks: number;
  readonly previewApprovedPacks: number;
  readonly publicApprovedPacks: number;
  readonly dimensions: Readonly<Record<
    RuneProofCoverageDimensionId,
    RuneProofCoverageDimensionSummary
  >>;
}

export interface RuneProofCoverageSnapshot {
  readonly schemaVersion: 1;
  readonly catalogueRevision: string;
  readonly rows: readonly RuneProofCoverageRow[];
  readonly summary: RuneProofCoverageSummary;
}
