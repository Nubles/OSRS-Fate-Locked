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
  sourceLabel?: string;
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
const factKinds = new Set<FactKind>([
  'ITEM',
  'QUEST',
  'SKILL_LEVEL',
  'UNLOCK',
  'LOCATION',
  'CAPABILITY',
]);

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
  assertRequirementExpression(expression, new Set<object>());
}

export function assertRuneProofReport(
  report: RuneProofReport,
): asserts report is RuneProofReport {
  if (!isRecord(report) || !isNonEmptyString(report.goalId)) {
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
  report.routes.forEach((route) => assertProofRoute(route, report.goalId));

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

function assertRequirementExpression(
  expression: unknown,
  active: Set<object>,
): void {
  if (!isRecord(expression)) {
    throw new Error('Invalid requirement expression');
  }
  if (active.has(expression)) {
    throw new Error('Cyclic requirement expression');
  }

  active.add(expression);
  try {
    if (expression.op === 'FACT') {
      assertFactRef(expression.fact);
      return;
    }
    if (expression.op === 'ALL' || expression.op === 'ANY') {
      if (!Array.isArray(expression.terms)) {
        throw new Error('Invalid requirement expression');
      }
      expression.terms.forEach((term) => assertRequirementExpression(term, active));
      return;
    }
    throw new Error('Invalid requirement expression');
  } finally {
    active.delete(expression);
  }
}

function assertProofRoute(route: unknown, goalId: string): asserts route is ProofRoute {
  if (!isRecord(route)
    || !isNonEmptyString(route.id)
    || typeof route.deterministic !== 'boolean'
    || !isFiniteNonNegativeNumber(route.prerequisiteCount)
    || !isFiniteNonNegativeNumber(route.recursiveIngredientCount)
    || !isFiniteNonNegativeNumber(route.travelDistance)
    || (route.probability !== null
      && (!isFiniteNumber(route.probability)
        || route.probability < 0
        || route.probability > 1))) {
    throw new Error('Invalid RuneProof route');
  }
  if (!isRecord(route.witness)) {
    throw new Error('Invalid RuneProof route');
  }
  assertProofWitness(route.witness, goalId);
}

function assertProofWitness(witness: unknown, goalId: string): asserts witness is ProofWitness {
  if (!isRecord(witness)
    || !isNonEmptyString(witness.rootFactId)
    || witness.rootFactId !== goalId
    || !isRecord(witness.steps)
    || Object.keys(witness.steps).length === 0
    || !isNonEmptyString(witness.sourceVersion)
    || !isNonEmptyString(witness.runId)
    || !isFiniteNonNegativeInteger(witness.runRevision)
    || !isNonEmptyString(witness.proofHash)) {
    throw new Error('Invalid ProofWitness');
  }

  const entries = Object.entries(witness.steps);
  entries.forEach(([stepId, step]) => {
    if (!isNonEmptyString(stepId)) {
      throw new Error('Invalid ProofWitness');
    }
    assertWitnessStep(step);
  });
  if (!entries.some(([, step]) => (step as WitnessStep).proves.id === witness.rootFactId)) {
    throw new Error('Invalid ProofWitness');
  }
  assertWitnessStepGraph(witness.steps as Record<string, WitnessStep>);
}

function assertWitnessStep(step: unknown): asserts step is WitnessStep {
  if (!isRecord(step)
    || !isNonEmptyString(step.ruleId)
    || (step.sourceLabel !== undefined && !isNonEmptyString(step.sourceLabel))
    || !Array.isArray(step.chosenTerms)
    || !step.chosenTerms.every(isNonEmptyString)
    || !Array.isArray(step.childStepIds)
    || !step.childStepIds.every(isNonEmptyString)) {
    throw new Error('Invalid WitnessStep');
  }
  assertFactRef(step.proves);
}

function assertWitnessStepGraph(steps: Record<string, WitnessStep>): void {
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (stepId: string): void => {
    if (visiting.has(stepId)) {
      throw new Error('Cyclic witness step');
    }
    if (visited.has(stepId)) {
      return;
    }
    if (!hasOwn(steps, stepId)) {
      throw new Error('Missing witness child step');
    }
    const step = steps[stepId];
    visiting.add(stepId);
    step.childStepIds.forEach(visit);
    visiting.delete(stepId);
    visited.add(stepId);
  };

  Object.keys(steps).forEach(visit);
}

function assertFactRef(fact: unknown): asserts fact is FactRef {
  if (!isRecord(fact)
    || !isNonEmptyString(fact.id)
    || !factKinds.has(fact.kind as FactKind)
    || !isNonEmptyString(fact.label)
    || (fact.quantity !== undefined && !isPositiveInteger(fact.quantity))
    || fact.id !== factId(fact.kind as FactKind, fact.label)) {
    throw new Error('Invalid FactRef');
  }
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isFiniteNonNegativeNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0;
}

function isFiniteNonNegativeInteger(value: unknown): value is number {
  return isFiniteNonNegativeNumber(value) && Number.isInteger(value);
}

function isPositiveInteger(value: unknown): value is number {
  return isFiniteNonNegativeInteger(value) && value > 0;
}
