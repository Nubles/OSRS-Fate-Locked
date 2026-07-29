import { describe, expect, it } from 'vitest';
import {
  createProofCertificate,
  hashProofWitness,
  sha256Hex,
  verifyProof,
} from './proof';
import {
  factId,
  type AcquisitionRule,
  type FactRef,
  type ProofWitness,
  type RequirementExpr,
  type WitnessStep,
} from './model';

const empty: RequirementExpr = { op: 'ALL', terms: [] };

describe('proof certificates', () => {
  it('replays a nested ALL/ANY proof from its root to only supplied run facts', async () => {
    const cake = item('Cake');
    const quest = fact('QUEST', 'Cook\'s Assistant');
    const key = item('Kitchen key');
    const missing = item('Missing token');
    const cakeRule = rule('make-cake', cake, {
      requirements: {
        op: 'ALL',
        terms: [
          {
            op: 'ANY',
            terms: [
              { op: 'FACT', fact: missing },
              { op: 'FACT', fact: key },
            ],
          },
          { op: 'FACT', fact: quest },
        ],
      },
    });
    const witness = await certificate(cake, {
      root: step(cakeRule, cake, [token(key), token(quest)], []),
    });

    const result = await verifyProof(input(witness, [cakeRule], [
      key.id,
      quest.id,
    ]));

    expect(result).toEqual({ valid: true, stale: false, errors: [] });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.errors)).toBe(true);
  });

  it('replays evaluator-style seed child steps without consulting evaluator state', async () => {
    const pie = item('Pie');
    const flour = item('Flour');
    const pieRule = rule('make-pie', pie, {
      requirements: { op: 'FACT', fact: flour },
    });
    const witness = await certificate(pie, {
      root: step(pieRule, pie, [token(flour)], ['flour-seed']),
      'flour-seed': seedStep(flour),
    });

    await expect(verifyProof(input(witness, [pieRule], [flour.id])))
      .resolves.toEqual({ valid: true, stale: false, errors: [] });
  });

  it('fails closed when a referenced child step is deleted', async () => {
    const pie = item('Pie');
    const flour = item('Flour');
    const pieRule = rule('make-pie', pie, {
      requirements: { op: 'FACT', fact: flour },
    });
    const witness = await certificate(pie, {
      root: step(pieRule, pie, [token(flour)], ['flour-seed']),
      'flour-seed': seedStep(flour),
    });
    const deleted = structuredClone(witness);
    delete deleted.steps['flour-seed'];
    deleted.proofHash = await hashProofWitness(deleted);

    const result = await verifyProof(input(deleted, [pieRule], [flour.id]));

    expect(result.valid).toBe(false);
    expect(result.stale).toBe(false);
    expect(result.errors).toContain('Missing child step: flour-seed');
  });

  it('marks exact run and source binding mismatches stale and invalid', async () => {
    const cake = item('Cake');
    const cakeRule = rule('cake', cake);
    const witness = await certificate(cake, {
      root: step(cakeRule, cake),
    });

    const wrongRun = await verifyProof({
      ...input(witness, [cakeRule]),
      runId: 'other-run',
      runRevision: 8,
    });
    const wrongSource = await verifyProof({
      ...input(witness, [cakeRule]),
      sourceVersion: 'source-v2',
    });

    expect(wrongRun).toMatchObject({ valid: false, stale: true });
    expect(wrongRun.errors).toEqual([
      'Stale run ID: expected other-run, certificate has run-1',
      'Stale run revision: expected 8, certificate has 7',
    ]);
    expect(wrongSource).toMatchObject({ valid: false, stale: true });
    expect(wrongSource.errors).toEqual([
      'Stale source version: expected source-v2, certificate has source-v1',
    ]);
  });

  it('uses Web Crypto SHA-256 and hashes canonical witness content without proofHash', async () => {
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );

    const cake = item('Cake');
    const cakeRule = rule('cake', cake);
    const forward = rawWitness(cake, {
      root: step(cakeRule, cake),
      spare: seedStep(item('Spare')),
    });
    const reverse = rawWitness(cake, {
      spare: seedStep(item('Spare')),
      root: step(cakeRule, cake),
    });
    forward.proofHash = 'ignored-one';
    reverse.proofHash = 'ignored-two';

    const forwardHash = await hashProofWitness(forward);
    const reverseHash = await hashProofWitness(reverse);

    expect(forwardHash).toMatch(/^sha256-[0-9a-f]{64}$/);
    expect(reverseHash).toBe(forwardHash);
  });

  it('rejects a hash mismatch even when the replay graph is otherwise valid', async () => {
    const cake = item('Cake');
    const cakeRule = rule('cake', cake);
    const witness = await certificate(cake, {
      root: step(cakeRule, cake),
    });
    const tampered = { ...witness, proofHash: `sha256-${'0'.repeat(64)}` };

    const result = await verifyProof(input(tampered, [cakeRule]));

    expect(result).toMatchObject({ valid: false, stale: false });
    expect(result.errors).toContain('Proof hash mismatch');
  });

  it('rejects a wrong or structurally ambiguous ANY selection', async () => {
    const goal = item('Goal');
    const key = item('Key');
    const wrong = item('Wrong');
    const wrongRule = rule('wrong-any', goal, {
      requirements: {
        op: 'ANY',
        terms: [
          { op: 'FACT', fact: key },
          { op: 'FACT', fact: wrong },
        ],
      },
    });
    const ambiguousRule = rule('ambiguous-any', goal, {
      requirements: {
        op: 'ANY',
        terms: [
          { op: 'FACT', fact: key },
          { op: 'ALL', terms: [{ op: 'FACT', fact: key }] },
        ],
      },
    });
    const wrongWitness = await certificate(goal, {
      root: step(wrongRule, goal, [token(item('Neither'))]),
    });
    const ambiguousWitness = await certificate(goal, {
      root: step(ambiguousRule, goal, [token(key)]),
    });

    const wrongResult = await verifyProof(input(wrongWitness, [wrongRule], [key.id]));
    const ambiguousResult = await verifyProof(
      input(ambiguousWitness, [ambiguousRule], [key.id]),
    );

    expect(wrongResult.errors).toContain(
      'Chosen terms do not resolve rule expression at step root',
    );
    expect(ambiguousResult.errors).toContain(
      'Chosen terms ambiguously resolve rule expression at step root',
    );
  });

  it('rejects rule, output identity, and demanded quantity mismatches', async () => {
    const reward = item('Reward');
    const other = item('Other');
    const rewardRule = rule('one-reward', reward, {
      repeatability: 'ONE_TIME',
      outputQuantity: 1,
    });
    const wrongRuleWitness = await certificate(reward, {
      root: { ...step(rewardRule, reward), ruleId: 'missing-rule' },
    });
    const wrongOutputWitness = await certificate(reward, {
      root: step(rewardRule, other),
    });
    const wrongQuantityWitness = await certificate(reward, {
      root: step(rewardRule, { ...reward, quantity: 2 }),
    });

    expect((await verifyProof(input(wrongRuleWitness, [rewardRule]))).errors)
      .toContain('Unknown rule at step root: missing-rule');
    expect((await verifyProof(input(wrongOutputWitness, [rewardRule]))).errors)
      .toContain('Rule output mismatch at step root');
    expect((await verifyProof(input(wrongQuantityWitness, [rewardRule]))).errors)
      .toContain('ONE_TIME rule one-reward proves 2 but capacity is 1');
  });

  it('rejects malformed repeatability before replaying a rule', async () => {
    const reward = item('Reward');
    const malformedRule = rule('malformed-reward', reward, {
      repeatability: 'UNBOUNDED' as AcquisitionRule['repeatability'],
    });
    const witness = await certificate(reward, {
      root: step(malformedRule, reward),
    });

    expect((await verifyProof(input(witness, [malformedRule]))).errors)
      .toContain('Invalid repeatability for rule malformed-reward');
  });

  it('uses model assertions to reject non-canonical fact IDs and rule expressions', async () => {
    const goal = item('Goal');
    const malformedGoal = { ...goal, id: 'ITEM:Goal' };
    const malformedRule = rule('goal', goal, {
      requirements: {
        op: 'FACT',
        fact: { ...item('Key'), id: 'item:KEY' },
      },
    });
    const malformedStepWitness = await certificate(goal, {
      root: step(rule('goal', goal), malformedGoal),
    });
    const malformedRuleWitness = await certificate(goal, {
      root: step(malformedRule, goal, [token(item('Key'))]),
    });

    expect((await verifyProof(
      input(malformedStepWitness, [rule('goal', goal)]),
    )).errors).toContain('Invalid proved fact at step root');
    expect((await verifyProof(
      input(malformedRuleWitness, [malformedRule], [item('Key').id]),
    )).errors).toContain('Invalid requirement expression for rule goal');
  });

  it('does not let seed leaves masquerade as rules or rules masquerade as run facts', async () => {
    const goal = item('Goal');
    const key = item('Key');
    const goalRule = rule('goal', goal, {
      requirements: { op: 'FACT', fact: key },
    });
    const missingSeed = await certificate(goal, {
      root: step(goalRule, goal, [token(key)], ['key']),
      key: seedStep(key),
    });
    const unknownRule = await certificate(goal, {
      root: step(goalRule, goal, [token(key)], ['key']),
      key: { ...seedStep(key), ruleId: 'not-a-seed-or-rule' },
    });

    expect((await verifyProof(input(missingSeed, [goalRule]))).errors)
      .toContain('Seed fact is not supplied by the run at step key: item:key@1');
    expect((await verifyProof(input(unknownRule, [goalRule], [key.id]))).errors)
      .toContain('Unknown rule at step key: not-a-seed-or-rule');
  });

  it('rejects repeated traversal, cycles, unreachable steps, and unproven leaves', async () => {
    const goal = item('Goal');
    const key = item('Key');
    const repeatedRule = rule('repeated', goal, {
      requirements: {
        op: 'ALL',
        terms: [
          { op: 'FACT', fact: key },
          { op: 'FACT', fact: key },
        ],
      },
    });
    const repeated = await certificate(goal, {
      root: step(repeatedRule, goal, [token(key), token(key)], ['key', 'key']),
      key: seedStep(key),
    });
    const cycleRule = rule('cycle', goal, {
      requirements: { op: 'FACT', fact: goal },
    });
    const cycle = await certificate(goal, {
      root: step(cycleRule, goal, [token(goal)], ['root']),
    });
    const unproven = await certificate(goal, {
      root: step(rule('needs-key', goal, {
        requirements: { op: 'FACT', fact: key },
      }), goal, [token(key)]),
      spare: seedStep(item('Spare')),
    });

    expect((await verifyProof(input(repeated, [repeatedRule], [key.id]))).errors)
      .toContain('Repeated witness traversal: key');
    expect((await verifyProof(input(cycle, [cycleRule]))).errors)
      .toContain('Cyclic witness traversal: root');
    const unprovenErrors = (await verifyProof(input(
      unproven,
      [rule('needs-key', goal, {
        requirements: { op: 'FACT', fact: key },
      })],
    ))).errors;
    expect(unprovenErrors).toContain('Unproven leaf at step root: item:key@1');
    expect(unprovenErrors).toContain('Unreachable witness step: spare');
  });

  it('enforces global ONE_TIME capacity by exact rule identity', async () => {
    const goal = item('Goal');
    const left = item('Left');
    const right = item('Right');
    const tokenFact = item('Token');
    const goalRule = rule('goal', goal, {
      requirements: {
        op: 'ALL',
        terms: [
          { op: 'FACT', fact: left },
          { op: 'FACT', fact: right },
        ],
      },
    });
    const leftRule = rule('left', left, {
      requirements: { op: 'FACT', fact: tokenFact },
    });
    const rightRule = rule('right', right, {
      requirements: { op: 'FACT', fact: tokenFact },
    });
    const firstTokenRule = rule('one-token', tokenFact, {
      repeatability: 'ONE_TIME',
    });
    const secondTokenRule = rule('other-one-token', tokenFact, {
      repeatability: 'ONE_TIME',
    });
    const steps: Record<string, WitnessStep> = {
      root: step(goalRule, goal, [token(left), token(right)], ['left', 'right']),
      left: step(leftRule, left, [token(tokenFact)], ['token-a']),
      right: step(rightRule, right, [token(tokenFact)], ['token-b']),
      'token-a': step(firstTokenRule, tokenFact),
      'token-b': step(firstTokenRule, tokenFact),
    };
    const oversubscribed = await certificate(goal, steps);
    const separate = await certificate(goal, {
      ...steps,
      'token-b': step(secondTokenRule, tokenFact),
    });

    expect((await verifyProof(input(oversubscribed, [
      goalRule, leftRule, rightRule, firstTokenRule,
    ]))).errors).toContain(
      'ONE_TIME rule one-token proves 2 but capacity is 1',
    );
    await expect(verifyProof(input(separate, [
      goalRule, leftRule, rightRule, firstTokenRule, secondTokenRule,
    ]))).resolves.toEqual({ valid: true, stale: false, errors: [] });
  });

  it('returns deterministic sorted errors and defensively immutable certificates', async () => {
    const goal = item('Goal');
    const goalRule = rule('goal', goal);
    const source = rawWitness(goal, {
      root: { ...step(goalRule, goal), childStepIds: ['missing'] },
      spare: seedStep(item('Spare')),
    });
    const certificateValue = await createProofCertificate(source);
    source.steps.root.proves.label = 'Mutated';

    const result = await verifyProof({
      ...input(certificateValue, [goalRule]),
      runRevision: 99,
    });

    expect(certificateValue.steps.root.proves.label).toBe('Goal');
    expect(Object.isFrozen(certificateValue)).toBe(true);
    expect(Object.isFrozen(certificateValue.steps.root.proves)).toBe(true);
    expect(result.errors).toEqual([...result.errors].sort());
  });
});

function fact(kind: FactRef['kind'], label: string): FactRef {
  return { id: factId(kind, label), kind, label };
}

function item(label: string): FactRef {
  return fact('ITEM', label);
}

function token(value: FactRef): string {
  return `${value.id}@${value.quantity ?? 1}`;
}

function rule(
  id: string,
  output: FactRef,
  overrides: Partial<AcquisitionRule> = {},
): AcquisitionRule {
  return {
    id,
    output,
    outputQuantity: 1,
    sourceKind: 'PRODUCTION',
    sourceLabel: id,
    locationId: 'location:home',
    requirements: empty,
    repeatability: 'REPEATABLE',
    probability: null,
    coverage: 'VERIFIED',
    provenanceIds: [`test:${id}`],
    ...overrides,
  };
}

function step(
  acquisitionRule: AcquisitionRule,
  proves: FactRef,
  chosenTerms: string[] = [],
  childStepIds: string[] = [],
): WitnessStep {
  return {
    ruleId: acquisitionRule.id,
    proves,
    chosenTerms,
    childStepIds,
  };
}

function seedStep(proves: FactRef): WitnessStep {
  return {
    ruleId: `seed:${proves.id}`,
    proves,
    chosenTerms: [],
    childStepIds: [],
  };
}

function rawWitness(
  rootFact: FactRef,
  steps: Record<string, WitnessStep>,
): ProofWitness {
  return {
    rootFactId: rootFact.id,
    steps,
    sourceVersion: 'source-v1',
    runId: 'run-1',
    runRevision: 7,
    proofHash: 'pending',
  };
}

async function certificate(
  rootFact: FactRef,
  steps: Record<string, WitnessStep>,
): Promise<ProofWitness> {
  return createProofCertificate(rawWitness(rootFact, steps));
}

function input(
  witness: ProofWitness,
  rules: readonly AcquisitionRule[],
  runFacts: readonly string[] = [],
) {
  return {
    witness,
    rules: new Map(rules.map(acquisitionRule => [
      acquisitionRule.id,
      acquisitionRule,
    ])),
    runFacts: new Set(runFacts),
    runId: 'run-1',
    runRevision: 7,
    sourceVersion: 'source-v1',
  };
}
