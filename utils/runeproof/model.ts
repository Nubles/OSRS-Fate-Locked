export type RuneProofStatus =
  | 'OBTAINABLE'
  | 'OBTAINABLE_RNG'
  | 'BLOCKED'
  | 'IMPOSSIBLE'
  | 'UNKNOWN';

export type Coverage = 'VERIFIED' | 'PARTIAL' | 'UNKNOWN';
export type FactKind =
  | 'ITEM'
  | 'QUEST'
  | 'SKILL_LEVEL'
  | 'UNLOCK'
  | 'LOCATION'
  | 'CAPABILITY';
export type SourceKind =
  | 'SHOP'
  | 'DROP'
  | 'SPAWN'
  | 'PRODUCTION'
  | 'GATHERING'
  | 'QUEST_REWARD'
  | 'MINIGAME'
  | 'PICKPOCKET'
  | 'CLUE';

export interface FactRef {
  id: string;
  kind: FactKind;
  label: string;
  quantity?: number;
}

export type RequirementExpr =
  | { op: 'FACT'; fact: FactRef }
  | { op: 'ALL'; terms: RequirementExpr[] }
  | { op: 'ANY'; terms: RequirementExpr[] };

export interface LocationRef {
  id: string;
  label: string;
  surfaceChunk: string;
  parentId?: string;
}

export interface AcquisitionRule {
  id: string;
  output: FactRef;
  outputQuantity: number;
  sourceKind: SourceKind;
  sourceLabel: string;
  locationId: string;
  requirements: RequirementExpr;
  repeatability: 'REPEATABLE' | 'ONE_TIME' | 'UNKNOWN';
  probability: number | null;
  coverage: Coverage;
  provenanceIds: string[];
}

export interface WitnessStep {
  ruleId: string;
  proves: FactRef;
  chosenTerms: string[];
  childStepIds: string[];
}

export interface ProofWitness {
  rootFactId: string;
  steps: Record<string, WitnessStep>;
  sourceVersion: string;
  runId: string;
  runRevision: number;
  proofHash: string;
}

export interface ProofRoute {
  id: string;
  deterministic: boolean;
  prerequisiteCount: number;
  recursiveIngredientCount: number;
  travelDistance: number;
  probability: number | null;
  witness: ProofWitness;
}

export interface MinimalBlocker {
  factIds: string[];
  labels: string[];
}

export interface RuneProofReport {
  goalId: string;
  status: RuneProofStatus;
  coverage: Coverage;
  routes: ProofRoute[];
  blockers: MinimalBlocker[];
  unavoidableBlockerFactIds: string[];
  routesComplete: boolean;
  explanation?: string;
}

const statuses = new Set<RuneProofStatus>([
  'OBTAINABLE',
  'OBTAINABLE_RNG',
  'BLOCKED',
  'IMPOSSIBLE',
  'UNKNOWN',
]);

const coverages = new Set<Coverage>(['VERIFIED', 'PARTIAL', 'UNKNOWN']);

export function normalizeId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function factId(kind: FactKind, label: string): string {
  return `${normalizeId(kind)}:${normalizeId(label)}`;
}

export function assertRequirementExpr(
  expression: RequirementExpr,
): asserts expression is RequirementExpr {
  if (!isRecord(expression)) {
    throw new Error('Invalid requirement expression');
  }

  if (expression.op === 'FACT') {
    if (!isRecord(expression.fact)) {
      throw new Error('Invalid requirement expression');
    }
    return;
  }

  if (expression.op === 'ALL' || expression.op === 'ANY') {
    if (!Array.isArray(expression.terms)) {
      throw new Error('Invalid requirement expression');
    }
    expression.terms.forEach((term) => assertRequirementExpr(term));
    return;
  }

  throw new Error('Invalid requirement expression');
}

export function assertRuneProofReport(
  report: RuneProofReport,
): asserts report is RuneProofReport {
  if (!isRecord(report)) {
    throw new Error('Invalid RuneProof report');
  }
  if (!statuses.has(report.status as RuneProofStatus)) {
    throw new Error('Invalid RuneProof status');
  }
  if (!coverages.has(report.coverage as Coverage)) {
    throw new Error('Invalid RuneProof coverage');
  }
  if (!Array.isArray(report.routes) || !Array.isArray(report.blockers)) {
    throw new Error('Invalid RuneProof report routes or blockers');
  }

  switch (report.status) {
    case 'OBTAINABLE':
      if (report.routes[0]?.deterministic !== true) {
        throw new Error('OBTAINABLE requires a deterministic first route');
      }
      break;
    case 'OBTAINABLE_RNG':
      if (report.routes.length === 0) {
        throw new Error('OBTAINABLE_RNG requires at least one route');
      }
      if (report.routes.some((route) => route.deterministic)) {
        throw new Error('OBTAINABLE_RNG cannot include deterministic routes');
      }
      break;
    case 'BLOCKED':
      if (report.blockers.length === 0) {
        throw new Error('BLOCKED requires at least one blocker');
      }
      break;
    case 'IMPOSSIBLE':
      if (report.coverage !== 'VERIFIED') {
        throw new Error('IMPOSSIBLE requires VERIFIED coverage');
      }
      if (report.routesComplete !== true) {
        throw new Error('IMPOSSIBLE requires routesComplete: true');
      }
      break;
    case 'UNKNOWN':
      if (Array.isArray(report.unavoidableBlockerFactIds)
        && report.unavoidableBlockerFactIds.length > 0) {
        throw new Error('UNKNOWN cannot claim unavoidable blocker facts');
      }
      break;
  }

  if (!Array.isArray(report.unavoidableBlockerFactIds)
    || typeof report.routesComplete !== 'boolean') {
    throw new Error('Invalid RuneProof completeness fields');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
