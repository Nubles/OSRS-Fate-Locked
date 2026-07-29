import {
  assertRequirementExpr,
  type AcquisitionRule,
  type FactRef,
  type ProofWitness,
  type RequirementExpr,
  type WitnessStep,
} from './model';
import { canonicalJson } from './canonicalJson';

export interface VerifyProofInput {
  witness: ProofWitness;
  rules: ReadonlyMap<string, AcquisitionRule>;
  runFacts: ReadonlySet<string>;
  runId: string;
  runRevision: number;
  sourceVersion: string;
}

export interface VerifyProofResult {
  valid: boolean;
  stale: boolean;
  errors: string[];
}

const FACT_ID = /^(item|quest|skill-level|unlock|location|capability):[a-z0-9]+(?:-[a-z0-9]+)*$/;
const own = Object.prototype.hasOwnProperty;

export async function sha256Hex(value: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('Web Crypto SHA-256 is unavailable');
  }
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function hashProofWitness(witness: ProofWitness): Promise<string> {
  canonicalJson(witness);
  const { proofHash: _proofHash, ...content } = witness;
  return `sha256-${await sha256Hex(canonicalJson(content))}`;
}

export async function createProofCertificate(
  witness: ProofWitness,
): Promise<ProofWitness> {
  const canonical = canonicalJson(witness);
  const clone = JSON.parse(canonical) as ProofWitness;
  clone.proofHash = await hashProofWitness(clone);
  return deepFreeze(clone);
}

export async function verifyProof(
  input: VerifyProofInput,
): Promise<VerifyProofResult> {
  const errors: string[] = [];
  const { witness } = input;

  if (!isPlainRecord(witness)) {
    return result(false, false, ['Invalid proof witness']);
  }

  if (witness.runId !== input.runId) {
    errors.push(`Stale run ID: expected ${input.runId}, certificate has ${witness.runId}`);
  }
  if (witness.runRevision !== input.runRevision) {
    errors.push(
      `Stale run revision: expected ${input.runRevision}, certificate has ${
        witness.runRevision
      }`,
    );
  }
  if (witness.sourceVersion !== input.sourceVersion) {
    errors.push(
      `Stale source version: expected ${input.sourceVersion}, certificate has ${
        witness.sourceVersion
      }`,
    );
  }
  const stale = errors.length > 0;

  try {
    if (witness.proofHash !== await hashProofWitness(witness)) {
      errors.push('Proof hash mismatch');
    }
  } catch (error) {
    errors.push(`Invalid proof content: ${errorMessage(error)}`);
  }

  const runFacts = parseRunFacts(input.runFacts, errors);
  const validRules = validateRules(input.rules, errors);
  const steps = isPlainRecord(witness.steps)
    ? witness.steps as Record<string, unknown>
    : undefined;

  if (!isCanonicalFactId(witness.rootFactId)) {
    errors.push('Invalid root fact ID');
  }
  if (!steps) {
    errors.push('Invalid witness steps');
    return result(false, stale, errors);
  }
  if (!own.call(steps, 'root')) {
    errors.push('Missing root step');
  } else {
    const root = steps.root;
    if (isPlainRecord(root)
      && isPlainRecord(root.proves)
      && root.proves.id !== witness.rootFactId) {
      errors.push('Root step does not prove root fact');
    }
  }

  const rootCandidates = Object.entries(steps).filter(([, candidate]) =>
    isPlainRecord(candidate)
    && isPlainRecord(candidate.proves)
    && candidate.proves.id === witness.rootFactId);
  if (rootCandidates.length !== 1 || rootCandidates[0]?.[0] !== 'root') {
    errors.push('Ambiguous root step identity');
  }

  const active = new Set<string>();
  const visited = new Set<string>();
  const oneTimeUsage = new Map<string, number>();

  const visit = (stepId: string): void => {
    if (active.has(stepId)) {
      errors.push(`Cyclic witness traversal: ${stepId}`);
      return;
    }
    if (visited.has(stepId)) {
      errors.push(`Repeated witness traversal: ${stepId}`);
      return;
    }
    if (!own.call(steps, stepId)) {
      errors.push(`Missing child step: ${stepId}`);
      return;
    }
    visited.add(stepId);
    active.add(stepId);
    try {
      const candidate = steps[stepId];
      if (!isWitnessStep(candidate)) {
        errors.push(`Invalid witness step: ${stepId}`);
        return;
      }
      const step = candidate;
      if (!isValidFact(step.proves) || !isSafeQuantity(step.proves.quantity ?? 1)) {
        errors.push(`Invalid proved fact at step ${stepId}`);
        return;
      }
      if (!step.chosenTerms.every(isCanonicalFactToken)) {
        errors.push(`Invalid chosen term at step ${stepId}`);
        return;
      }

      if (step.ruleId.startsWith('seed:')) {
        verifySeedStep(stepId, step, runFacts, errors);
        return;
      }

      const rule = validRules.get(step.ruleId);
      if (!rule) {
        errors.push(`Unknown rule at step ${stepId}: ${step.ruleId}`);
        return;
      }
      if (!sameFactIdentity(rule.output, step.proves)) {
        errors.push(`Rule output mismatch at step ${stepId}`);
      }

      const demand = step.proves.quantity ?? 1;
      const operations = Math.ceil(demand / rule.outputQuantity);
      if ((rule.repeatability === 'ONE_TIME' || rule.repeatability === 'UNKNOWN')
        && demand > rule.outputQuantity) {
        errors.push(
          `${rule.repeatability} rule ${rule.id} proves ${demand} but capacity is ${
            rule.outputQuantity
          }`,
        );
      }
      if (rule.repeatability === 'ONE_TIME') {
        oneTimeUsage.set(rule.id, (oneTimeUsage.get(rule.id) ?? 0) + demand);
      }

      const matchingEnds = expressionMatchEnds(
        rule.requirements,
        operations,
        step.chosenTerms,
        0,
      ).filter(end => end === step.chosenTerms.length);
      if (matchingEnds.length === 0) {
        errors.push(`Chosen terms do not resolve rule expression at step ${stepId}`);
      } else if (matchingEnds.length > 1) {
        errors.push(`Chosen terms ambiguously resolve rule expression at step ${stepId}`);
      }

      let childIndex = 0;
      for (const chosenTerm of step.chosenTerms) {
        const childStepId = step.childStepIds[childIndex];
        if (childStepId !== undefined) {
          if (!own.call(steps, childStepId)) {
            errors.push(`Missing child step: ${childStepId}`);
            childIndex += 1;
            continue;
          }
          const child = steps[childStepId];
          if (isPlainRecord(child)
            && isPlainRecord(child.proves)
            && factToken(child.proves as unknown as FactRef) === chosenTerm) {
            childIndex += 1;
            visit(childStepId);
            continue;
          }
        }
        if (!runFactSatisfies(chosenTerm, runFacts)) {
          errors.push(`Unproven leaf at step ${stepId}: ${chosenTerm}`);
        }
      }
      for (; childIndex < step.childStepIds.length; childIndex += 1) {
        const childStepId = step.childStepIds[childIndex];
        errors.push(own.call(steps, childStepId)
          ? `Unexpected child step at ${stepId}: ${childStepId}`
          : `Missing child step: ${childStepId}`);
      }
    } finally {
      active.delete(stepId);
    }
  };

  if (own.call(steps, 'root')) visit('root');

  Object.keys(steps).sort(compareText).forEach(stepId => {
    if (!visited.has(stepId)) errors.push(`Unreachable witness step: ${stepId}`);
  });
  for (const [ruleId, usage] of [...oneTimeUsage].sort(([left], [right]) =>
    compareText(left, right))) {
    const capacity = validRules.get(ruleId)?.outputQuantity ?? 0;
    if (usage > capacity) {
      errors.push(`ONE_TIME rule ${ruleId} proves ${usage} but capacity is ${capacity}`);
    }
  }

  return result(errors.length === 0, stale, errors);
}

function verifySeedStep(
  stepId: string,
  step: WitnessStep,
  runFacts: ReadonlyMap<string, number>,
  errors: string[],
): void {
  if (step.ruleId !== `seed:${step.proves.id}`) {
    errors.push(`Invalid seed rule identity at step ${stepId}`);
  }
  if (step.chosenTerms.length > 0 || step.childStepIds.length > 0) {
    errors.push(`Seed step has dependencies: ${stepId}`);
  }
  const token = factToken(step.proves);
  if (!runFactSatisfies(token, runFacts)) {
    errors.push(`Seed fact is not supplied by the run at step ${stepId}: ${token}`);
  }
}

function validateRules(
  rules: ReadonlyMap<string, AcquisitionRule>,
  errors: string[],
): ReadonlyMap<string, AcquisitionRule> {
  const valid = new Map<string, AcquisitionRule>();
  const identities = new Set<string>();
  for (const [mapId, rule] of [...rules].sort(([left], [right]) =>
    compareText(left, right))) {
    if (!isPlainRecord(rule)
      || typeof rule.id !== 'string'
      || rule.id.length === 0
      || mapId !== rule.id) {
      errors.push(`Rule map identity mismatch: ${mapId}`);
      continue;
    }
    if (identities.has(rule.id)) {
      errors.push(`Duplicate rule identity: ${rule.id}`);
      continue;
    }
    identities.add(rule.id);
    if (!isValidFact(rule.output)) {
      errors.push(`Invalid output fact for rule ${rule.id}`);
      continue;
    }
    if (!isSafeQuantity(rule.outputQuantity)) {
      errors.push(`Invalid output quantity for rule ${rule.id}`);
      continue;
    }
    try {
      assertRequirementExpr(rule.requirements);
    } catch {
      errors.push(`Invalid requirement expression for rule ${rule.id}`);
      continue;
    }
    valid.set(rule.id, rule);
  }
  return valid;
}

function expressionMatchEnds(
  expression: RequirementExpr,
  operations: number,
  chosenTerms: readonly string[],
  start: number,
): number[] {
  if (expression.op === 'FACT') {
    const quantity = expression.fact.kind === 'ITEM'
      ? (expression.fact.quantity ?? 1) * operations
      : expression.fact.quantity ?? 1;
    return chosenTerms[start] === `${expression.fact.id}@${quantity}`
      ? [start + 1] : [];
  }
  if (expression.op === 'ANY') {
    return expression.terms.flatMap(term =>
      expressionMatchEnds(term, operations, chosenTerms, start));
  }
  return expression.terms.reduce<number[]>(
    (positions, term) => positions.flatMap(position =>
      expressionMatchEnds(term, operations, chosenTerms, position)),
    [start],
  );
}

function parseRunFacts(
  facts: ReadonlySet<string>,
  errors: string[],
): ReadonlyMap<string, number> {
  const parsed = new Map<string, number>();
  [...facts].sort(compareText).forEach(value => {
    const match = /^(.*?)(?:@([1-9][0-9]*))?$/.exec(value);
    const id = match?.[1] ?? '';
    const quantityText = match?.[2];
    const quantity = quantityText === undefined ? 1 : Number(quantityText);
    if (!isCanonicalFactId(id) || !isSafeQuantity(quantity)) {
      errors.push(`Invalid run fact: ${value}`);
      return;
    }
    parsed.set(id, Math.max(parsed.get(id) ?? 0, quantity));
  });
  return parsed;
}

function runFactSatisfies(
  token: string,
  runFacts: ReadonlyMap<string, number>,
): boolean {
  const separator = token.lastIndexOf('@');
  const id = token.slice(0, separator);
  const quantity = Number(token.slice(separator + 1));
  return (runFacts.get(id) ?? 0) >= quantity;
}

function isWitnessStep(value: unknown): value is WitnessStep {
  return isPlainRecord(value)
    && typeof value.ruleId === 'string'
    && value.ruleId.length > 0
    && Array.isArray(value.chosenTerms)
    && value.chosenTerms.every(term => typeof term === 'string')
    && Array.isArray(value.childStepIds)
    && value.childStepIds.every(id => typeof id === 'string' && id.length > 0)
    && isPlainRecord(value.proves);
}

function isValidFact(value: unknown): value is FactRef {
  try {
    assertRequirementExpr({
      op: 'FACT',
      fact: value as FactRef,
    });
    return true;
  } catch {
    return false;
  }
}

function sameFactIdentity(left: FactRef, right: FactRef): boolean {
  return left.id === right.id
    && left.kind === right.kind
    && left.label === right.label;
}

function factToken(fact: FactRef): string {
  return `${fact.id}@${fact.quantity ?? 1}`;
}

function isCanonicalFactToken(value: string): boolean {
  const match = /^(.*)@([1-9][0-9]*)$/.exec(value);
  return match !== null
    && isCanonicalFactId(match[1])
    && isSafeQuantity(Number(match[2]));
}

function isCanonicalFactId(value: unknown): value is string {
  return typeof value === 'string' && FACT_ID.test(value);
}

function isSafeQuantity(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value > 0;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function result(
  valid: boolean,
  stale: boolean,
  errors: readonly string[],
): VerifyProofResult {
  const orderedErrors = Object.freeze([...new Set(errors)].sort(compareText)) as string[];
  return Object.freeze({
    valid: valid && !stale && orderedErrors.length === 0,
    stale,
    errors: orderedErrors,
  });
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
