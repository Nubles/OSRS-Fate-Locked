import { describe, expect, it } from 'vitest';
import type { RequirementExpression } from './packModel';
import {
  evaluateRequirementExpression,
  type RuneProofRequirementSnapshot,
  validateRequirementExpression,
} from './requirements';

const snapshot = {
  completedQuestIds: new Set(['Rune Mysteries']),
  questPoints: 7,
  levels: { Mining: 15 },
  combatLevel: 20,
  regions: new Set(['Misthalin']),
  chunks: new Set(['50,50']),
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
  availableBoostSourceIds: new Set<string>(),
  itemQuantities: undefined,
  itemAliases: undefined,
  confirmedManualIds: new Set<string>(),
  selectedBranchId: undefined,
  branchCheckpointIds: new Set<string>(),
  observedCanonicalCompletion: false,
} as const satisfies RuneProofRequirementSnapshot;

const reviewed = ['review:example'] as const;

describe('requirement expression validation', () => {
  it('accepts the empty ALL identity and rejects empty ANY', () => {
    expect(validateRequirementExpression({ kind: 'ALL', requirements: [] }))
      .toEqual({ valid: true, errors: [] });
    expect(validateRequirementExpression({ kind: 'ANY', requirements: [] }))
      .toEqual({
        valid: false,
        errors: ['$.requirements must not be empty for ANY'],
      });
  });

  it('rejects sparse arrays without reading missing requirement values', () => {
    const requirements = new Array(2);
    requirements[1] = {
      kind: 'QUEST_COMPLETED', id: 'quest:rune-mysteries', questId: 'Rune Mysteries',
      evidenceIds: reviewed,
    };

    expect(validateRequirementExpression({ kind: 'ALL', requirements })).toEqual({
      valid: false,
      errors: ['$.requirements must be a dense array'],
    });
  });

  it('rejects unknown discriminants, blank stable IDs, and unexpected fields', () => {
    expect(validateRequirementExpression({
      kind: 'MAYBE', id: ' ', evidenceIds: reviewed, extra: true,
    })).toEqual({
      valid: false,
      errors: [
        '$.kind is unknown',
        '$.id must be a nonblank string',
        '$ has unexpected field(s): extra',
      ],
    });
  });

  it('rejects non-positive numeric gates and non-integer planes', () => {
    const expression = {
      kind: 'ALL',
      requirements: [
        { kind: 'QUEST_POINTS', id: 'qp', points: 0, evidenceIds: reviewed },
        { kind: 'ITEM', id: 'item', itemKey: 'rope', quantity: Number.POSITIVE_INFINITY, evidenceIds: reviewed },
        { kind: 'CHUNK_ACCESS', id: 'chunk', chunk: '50,50', plane: 0.5, evidenceIds: reviewed },
      ],
    };

    expect(validateRequirementExpression(expression).errors).toEqual([
      '$.requirements[0].points must be a positive integer',
      '$.requirements[1].quantity must be a positive integer',
      '$.requirements[2].plane must be an integer',
    ]);
  });

  it('stops validation at depth 32', () => {
    let expression: unknown = {
      kind: 'QUEST_COMPLETED', id: 'quest:rune-mysteries', questId: 'Rune Mysteries',
      evidenceIds: reviewed,
    };
    for (let depth = 0; depth < 33; depth += 1) {
      expression = { kind: 'ALL', requirements: [expression] };
    }

    expect(validateRequirementExpression(expression).errors).toEqual([
      '$.requirements[0].requirements[0].requirements[0].requirements[0].requirements[0].requirements[0].requirements[0].requirements[0].requirements[0].requirements[0].requirements[0].requirements[0].requirements[0].requirements[0].requirements[0].requirements[0].requirements[0].requirements[0].requirements[0].requirements[0].requirements[0].requirements[0].requirements[0].requirements[0].requirements[0].requirements[0].requirements[0].requirements[0].requirements[0].requirements[0].requirements[0].requirements[0].requirements[0] exceeds depth 32',
    ]);
  });

  it('stops at 2048 nodes without traversing later accessors', () => {
    const requirements = Array.from({ length: 3_000 }, (_, index) => ({
      kind: 'MANUAL_CONFIRMATION',
      id: `manual:${index}`,
      confirmationId: `manual:${index}`,
      prompt: `Confirm ${index}.`,
      evidenceIds: reviewed,
    }));
    Object.defineProperty(requirements, 2_500, {
      enumerable: true,
      get: () => { throw new Error('traversed beyond global cap'); },
    });

    const validation = validateRequirementExpression({ kind: 'ALL', requirements });
    expect(validation.errors).toEqual(['requirement expression exceeds 2048 nodes']);
  });
});

describe('requirement expressions', () => {
  it('uses BLOCKED only for a known unmet deterministic gate', () => {
    const result = evaluateRequirementExpression({
      kind: 'SKILL_LEVEL', id: 'skill:mining:30', skill: 'Mining', level: 30,
      evidenceIds: ['quest-data'],
    }, snapshot);
    expect(result).toMatchObject({ state: 'BLOCKED', blockerIds: ['skill:mining:30'] });
  });

  it('uses CONFIRM when deterministic gates pass but manual proof remains', () => {
    const result = evaluateRequirementExpression({
      kind: 'ALL',
      requirements: [
        { kind: 'REGION_ACCESS', id: 'region:misthalin', regionId: 'Misthalin', evidenceIds: ['quest-data'] },
        {
          kind: 'MANUAL_CONFIRMATION',
          id: 'manual:partner',
          confirmationId: 'partner-ready',
          prompt: 'Confirm the opposite-gang partner is ready.',
          evidenceIds: ['review:partner'],
        },
      ],
    }, snapshot);
    expect(result).toMatchObject({ state: 'CONFIRM', manualConfirmationIds: ['partner-ready'] });
  });

  it('propagates unresolved evidence as NEEDS_REVIEW through ANY', () => {
    const result = evaluateRequirementExpression({
      kind: 'ANY',
      requirements: [{
        kind: 'UNRESOLVED_EVIDENCE',
        id: 'unknown:route',
        evidenceId: 'audit:route',
        reason: 'Route wording is unresolved.',
        evidenceIds: ['audit:route'],
      }],
    }, snapshot);
    expect(result.state).toBe('NEEDS_REVIEW');
  });

  it('uses reviewed boost evidence but confirms timing that cannot be observed', () => {
    const result = evaluateRequirementExpression({
      kind: 'TEMPORARY_BOOST',
      id: 'boost:mining:57:60',
      skill: 'Mining',
      baseLevel: 57,
      targetLevel: 60,
      boostSourceIds: ['dwarven-stout-m'],
      timingPolicy: 'ACTION_WINDOW',
      evidenceIds: ['review:boost'],
    }, {
      ...snapshot,
      levels: { Mining: 57 },
      availableBoostSourceIds: new Set(['dwarven-stout-m']),
    });
    expect(result.state).toBe('CONFIRM');
  });

  it('proves instance access from a reviewed reachable entrance', () => {
    const result = evaluateRequirementExpression({
      kind: 'INSTANCE_ACCESS',
      id: 'instance:example',
      instanceId: 'example-instance',
      entranceChunks: ['50,50'],
      plane: 0,
      evidenceIds: ['review:instance'],
    }, snapshot);
    expect(result.state).toBe('READY');
  });

  it('resolves an exact reviewed item alternative through its canonical root', () => {
    const result = evaluateRequirementExpression({
      kind: 'ITEM',
      id: 'item:bronze-pickaxe',
      itemKey: 'bronze pickaxe',
      quantity: 1,
      evidenceIds: ['review:pickaxe-family'],
    }, {
      ...snapshot,
      itemQuantities: { pickaxe: 1 },
      itemAliases: { 'bronze pickaxe': 'pickaxe' },
    });
    expect(result.state).toBe('READY');
  });

  it('blocks a reviewed transport when its origin is unreachable', () => {
    const result = evaluateRequirementExpression({
      kind: 'TRANSPORT_ACCESS',
      id: 'transport:example-ferry',
      transportId: 'example-ferry',
      origin: '99,99',
      destination: '100,100',
      oneWay: true,
      evidenceIds: ['review:ferry'],
    }, {
      ...snapshot,
      transportIds: new Set(['example-ferry']),
    });
    expect(result).toMatchObject({
      state: 'BLOCKED',
      blockerIds: ['transport:example-ferry'],
    });
  });

  it('returns COMPLETE before validating stale or malformed preflight input', () => {
    const result = evaluateRequirementExpression({
      kind: 'ANY', requirements: [],
    }, { ...snapshot, observedCanonicalCompletion: true });

    expect(result).toEqual({
      state: 'COMPLETE',
      blockerIds: [],
      manualConfirmationIds: [],
      unresolvedEvidenceIds: [],
      reasons: [],
      unblockActions: [],
      advisories: [],
    });
  });

  it('fails closed when uncompiled input supplies an empty ANY', () => {
    const result = evaluateRequirementExpression({ kind: 'ANY', requirements: [] }, snapshot);

    expect(result).toMatchObject({
      state: 'NEEDS_REVIEW',
      unresolvedEvidenceIds: ['validation:requirement-expression'],
      reasons: ['$.requirements must not be empty for ANY'],
    });
  });

  it('gives unresolved evidence precedence over deterministic and manual ALL children', () => {
    const result = evaluateRequirementExpression({
      kind: 'ALL',
      requirements: [
        { kind: 'SKILL_LEVEL', id: 'skill:mining:30', skill: 'Mining', level: 30, evidenceIds: reviewed },
        { kind: 'MANUAL_CONFIRMATION', id: 'manual:route', confirmationId: 'route', prompt: 'Confirm route.', evidenceIds: reviewed },
        { kind: 'UNRESOLVED_EVIDENCE', id: 'unknown:route', evidenceId: 'audit:route', reason: 'Route unresolved.', evidenceIds: reviewed },
      ],
    }, snapshot);

    expect(result).toMatchObject({
      state: 'NEEDS_REVIEW',
      blockerIds: ['skill:mining:30'],
      manualConfirmationIds: ['route'],
      unresolvedEvidenceIds: ['audit:route'],
      reasons: [
        'Requires Mining 30; effective level is 15.',
        'Confirm route.',
        'Route unresolved.',
      ],
    });
  });

  it('stable-deduplicates ALL copy in expression order', () => {
    const child = {
      kind: 'MANUAL_CONFIRMATION' as const,
      id: 'manual:route',
      confirmationId: 'route',
      prompt: 'Confirm route.',
      evidenceIds: reviewed,
    };
    const result = evaluateRequirementExpression({
      kind: 'ALL', requirements: [child, child],
    }, snapshot);

    expect(result.manualConfirmationIds).toEqual(['route']);
    expect(result.reasons).toEqual(['Confirm route.']);
    expect(result.unblockActions).toEqual(['Confirm: Confirm route.']);
  });

  it('selects the first READY ANY child without leaking losing blockers', () => {
    const result = evaluateRequirementExpression({
      kind: 'ANY',
      requirements: [
        { kind: 'QUEST_COMPLETED', id: 'quest:missing', questId: 'Missing Quest', evidenceIds: reviewed },
        { kind: 'REGION_ACCESS', id: 'region:misthalin', regionId: 'Misthalin', evidenceIds: reviewed },
      ],
    }, snapshot);

    expect(result).toEqual({
      state: 'READY',
      blockerIds: [],
      manualConfirmationIds: [],
      unresolvedEvidenceIds: [],
      reasons: [],
      unblockActions: [],
      advisories: [],
    });
  });

  it('selects CONFIRM over unresolved and blocked ANY alternatives', () => {
    const result = evaluateRequirementExpression({
      kind: 'ANY',
      requirements: [
        { kind: 'UNRESOLVED_EVIDENCE', id: 'unknown', evidenceId: 'audit', reason: 'Unknown.', evidenceIds: reviewed },
        { kind: 'MANUAL_CONFIRMATION', id: 'manual', confirmationId: 'manual', prompt: 'Confirm it.', evidenceIds: reviewed },
        { kind: 'QUEST_COMPLETED', id: 'quest:missing', questId: 'Missing Quest', evidenceIds: reviewed },
      ],
    }, snapshot);

    expect(result).toMatchObject({
      state: 'CONFIRM',
      manualConfirmationIds: ['manual'],
      unresolvedEvidenceIds: [],
      blockerIds: [],
    });
  });

  it('uses BLOCKED for ANY only when every alternative is a known blocker', () => {
    const result = evaluateRequirementExpression({
      kind: 'ANY',
      requirements: [
        { kind: 'QUEST_COMPLETED', id: 'quest:first', questId: 'First', evidenceIds: reviewed },
        { kind: 'QUEST_COMPLETED', id: 'quest:second', questId: 'Second', evidenceIds: reviewed },
      ],
    }, snapshot);

    expect(result).toMatchObject({
      state: 'BLOCKED',
      blockerIds: ['quest:first'],
      reasons: ['Requires quest completion: First.'],
    });
  });

  it('fails closed for unknown canonical skill evidence', () => {
    const result = evaluateRequirementExpression({
      kind: 'SKILL_LEVEL', id: 'skill:unknown:2', skill: 'Unknown Skill', level: 2,
      evidenceIds: reviewed,
    }, snapshot);

    expect(result).toMatchObject({
      state: 'NEEDS_REVIEW',
      unresolvedEvidenceIds: ['skill:unknown:2'],
      reasons: ['No canonical level evidence is available for Unknown Skill.'],
    });
  });
});

describe('atomic requirement evaluation', () => {
  it('uses literal Quest Point blocker copy and conventional pluralization', () => {
    const one = evaluateRequirementExpression({
      kind: 'QUEST_POINTS', id: 'qp:8', points: 8, evidenceIds: reviewed,
    }, snapshot);
    const many = evaluateRequirementExpression({
      kind: 'QUEST_POINTS', id: 'qp:10', points: 10, evidenceIds: reviewed,
    }, snapshot);

    expect(one).toMatchObject({
      reasons: ['Requires 8 Quest Points; current total is 7.'],
      unblockActions: ['Earn 1 more Quest Point.'],
    });
    expect(many.unblockActions).toEqual(['Earn 3 more Quest Points.']);
  });

  it('returns READY when the current skill already meets a boost target', () => {
    const result = evaluateRequirementExpression({
      kind: 'TEMPORARY_BOOST', id: 'boost:mining', skill: 'Mining', baseLevel: 10,
      targetLevel: 15, boostSourceIds: ['stout'], timingPolicy: 'ACTION_WINDOW', evidenceIds: reviewed,
    }, snapshot);

    expect(result.state).toBe('READY');
  });

  it('blocks a boost below its base gate before considering source evidence', () => {
    const result = evaluateRequirementExpression({
      kind: 'TEMPORARY_BOOST', id: 'boost:mining', skill: 'Mining', baseLevel: 20,
      targetLevel: 25, boostSourceIds: ['stout'], timingPolicy: 'ACTION_WINDOW', evidenceIds: reviewed,
    }, snapshot);

    expect(result).toMatchObject({
      state: 'BLOCKED',
      reasons: ['Requires base Mining 20; effective level is 15.'],
      unblockActions: ['Raise Mining to 20.'],
    });
  });

  it('confirms unobserved source evidence before manual boost timing', () => {
    const result = evaluateRequirementExpression({
      kind: 'TEMPORARY_BOOST', id: 'boost:mining', skill: 'Mining', baseLevel: 15,
      targetLevel: 20, boostSourceIds: ['stout'], timingPolicy: 'MANUAL_TIMING', evidenceIds: reviewed,
    }, { ...snapshot, availableBoostSourceIds: undefined });

    expect(result).toMatchObject({
      state: 'CONFIRM',
      manualConfirmationIds: ['boost:mining'],
      reasons: ['Confirm a reviewed boost source is available for Mining 20.'],
      unblockActions: ['Confirm: Confirm a reviewed boost source is available for Mining 20.'],
    });
  });

  it('blocks manual boost timing when observed source evidence is missing', () => {
    const result = evaluateRequirementExpression({
      kind: 'TEMPORARY_BOOST', id: 'boost:mining', skill: 'Mining', baseLevel: 15,
      targetLevel: 20, boostSourceIds: ['stout'], timingPolicy: 'MANUAL_TIMING', evidenceIds: reviewed,
    }, { ...snapshot, availableBoostSourceIds: new Set() });

    expect(result).toMatchObject({
      state: 'BLOCKED',
      blockerIds: ['boost:mining'],
      reasons: ['Requires a reviewed boost source for Mining 20.'],
      unblockActions: ['Obtain one of: stout.'],
    });
  });

  it('confirms manual timing after an observed reviewed boost source is present', () => {
    const result = evaluateRequirementExpression({
      kind: 'TEMPORARY_BOOST', id: 'boost:mining', skill: 'Mining', baseLevel: 15,
      targetLevel: 20, boostSourceIds: ['stout'], timingPolicy: 'MANUAL_TIMING', evidenceIds: reviewed,
    }, { ...snapshot, availableBoostSourceIds: new Set(['stout']) });

    expect(result).toMatchObject({
      state: 'CONFIRM',
      manualConfirmationIds: ['boost:mining'],
      reasons: ['Confirm the reviewed Mining boost to 20 at the required timing.'],
    });
  });

  it('confirms unobserved boost inventory and blocks an observed missing source', () => {
    const expression = {
      kind: 'TEMPORARY_BOOST' as const,
      id: 'boost:mining',
      skill: 'Mining',
      baseLevel: 15,
      targetLevel: 20,
      boostSourceIds: ['stout', 'spicy-stew'],
      timingPolicy: 'ACTION_WINDOW' as const,
      evidenceIds: reviewed,
    };

    const unobserved = evaluateRequirementExpression(expression, {
      ...snapshot, availableBoostSourceIds: undefined,
    });
    const missing = evaluateRequirementExpression(expression, snapshot);

    expect(unobserved).toMatchObject({
      state: 'CONFIRM',
      reasons: ['Confirm a reviewed boost source is available for Mining 20.'],
      unblockActions: ['Confirm: Confirm a reviewed boost source is available for Mining 20.'],
    });
    expect(missing).toMatchObject({
      state: 'BLOCKED',
      blockerIds: ['boost:mining'],
      unblockActions: ['Obtain one of: stout, spicy-stew.'],
    });
  });

  it('checks objective combat, region, and chunk gates without capability guesses', () => {
    const expression: RequirementExpression = {
      kind: 'ALL',
      requirements: [
        { kind: 'COMBAT_LEVEL', id: 'combat:21', level: 21, evidenceIds: reviewed },
        { kind: 'REGION_ACCESS', id: 'region:kandarin', regionId: 'Kandarin', evidenceIds: reviewed },
        { kind: 'CHUNK_ACCESS', id: 'chunk:51,50', chunk: '51,50', plane: 0, evidenceIds: reviewed },
      ],
    };

    const result = evaluateRequirementExpression(expression, snapshot);
    expect(result).toMatchObject({
      state: 'BLOCKED',
      blockerIds: ['combat:21', 'region:kandarin', 'chunk:51,50'],
      reasons: [
        'Requires combat level 21; current level is 20.',
        'Requires access to Kandarin.',
        'Requires chunk 51,50 on plane 0.',
      ],
    });
  });

  it('requires transport origin and unlock but not a reachable destination', () => {
    const expression: RequirementExpression = {
      kind: 'TRANSPORT_ACCESS',
      id: 'transport:ferry', transportId: 'ferry', origin: '50,50', destination: '99,99',
      oneWay: true, evidenceIds: reviewed,
    };
    const locked = evaluateRequirementExpression(expression, snapshot);
    const ready = evaluateRequirementExpression(expression, {
      ...snapshot, transportIds: new Set(['ferry']),
    });

    expect(locked).toMatchObject({
      state: 'BLOCKED',
      reasons: ['Requires transport ferry.'],
    });
    expect(ready).toMatchObject({
      state: 'READY',
      advisories: ['Transport ferry is one-way from 50,50 to 99,99; review a separate return route.'],
    });
  });

  it('does not expose one-way consequence copy for an unusable transport', () => {
    const result = evaluateRequirementExpression({
      kind: 'TRANSPORT_ACCESS',
      id: 'transport:ferry', transportId: 'ferry', origin: '99,99', destination: '100,100',
      oneWay: true, evidenceIds: reviewed,
    }, snapshot);

    expect(result.advisories).toEqual([]);
  });

  it('confirms unknown transport fare inventory and blocks observed insufficient fare', () => {
    const expression: RequirementExpression = {
      kind: 'TRANSPORT_ACCESS',
      id: 'transport:ferry', transportId: 'ferry', origin: '50,50', destination: '99,99',
      oneWay: false, fare: { itemKey: 'fare-token', quantity: 2 }, evidenceIds: reviewed,
    };
    const account = { ...snapshot, transportIds: new Set(['ferry']) };

    expect(evaluateRequirementExpression(expression, account)).toMatchObject({
      state: 'CONFIRM',
      reasons: ['Confirm 2 × fare-token is available for transport ferry.'],
    });
    expect(evaluateRequirementExpression(expression, {
      ...account, itemQuantities: { tokens: 1 }, itemAliases: { 'fare-token': 'tokens' },
    })).toMatchObject({
      state: 'BLOCKED',
      reasons: ['Requires 2 × fare-token for transport ferry; confirmed 1.'],
    });
  });

  it('blocks an instance only when every reviewed entrance is unreachable', () => {
    const result = evaluateRequirementExpression({
      kind: 'INSTANCE_ACCESS', id: 'instance:cave', instanceId: 'cave',
      entranceChunks: ['51,50', '52,50'], plane: 0, evidenceIds: reviewed,
    }, snapshot);

    expect(result).toMatchObject({
      state: 'BLOCKED',
      reasons: ['Requires a reachable entrance to cave.'],
      unblockActions: ['Unlock one reviewed entrance chunk: 51,50, 52,50.'],
    });
  });

  it('confirms unknown item inventory and blocks an observed insufficient quantity', () => {
    const expression = {
      kind: 'ITEM' as const, id: 'item:rope', itemKey: 'rope', quantity: 2, evidenceIds: reviewed,
    };

    expect(evaluateRequirementExpression(expression, snapshot)).toMatchObject({
      state: 'CONFIRM',
      manualConfirmationIds: ['item:rope'],
      reasons: ['Confirm you have 2 × rope.'],
    });
    expect(evaluateRequirementExpression(expression, {
      ...snapshot, itemQuantities: { rope: 1 },
    })).toMatchObject({
      state: 'BLOCKED',
      reasons: ['Requires 2 × rope; confirmed 1.'],
    });
  });

  it.each([
    ['EQUIPMENT', 'equipment'], ['MOBILITY', 'mobility'], ['ARCANA', 'arcana'],
    ['HOUSING', 'housing'], ['GUILD', 'guilds'], ['MERCHANT', 'merchants'],
    ['MINIGAME', 'minigames'], ['BOSS', 'bosses'], ['STORAGE', 'storage'],
    ['FARMING', 'farming'], ['SLAYER', 'slayer'], ['BANK', 'banks'],
    ['DIARY', 'diaries'], ['COMBAT_ACHIEVEMENT', 'combatAchievements'],
    ['TASK', 'tasks'], ['COLLECTION_ITEM', 'collectionItems'],
  ] as const)('maps %s to the canonical %s snapshot set', (unlockType, setName) => {
    const result = evaluateRequirementExpression({
      kind: 'CANONICAL_UNLOCK', id: `unlock:${unlockType}`, unlockType,
      unlockId: 'exact-id', evidenceIds: reviewed,
    }, {
      ...snapshot,
      canonicalUnlocks: { ...snapshot.canonicalUnlocks, [setName]: new Set(['exact-id']) },
    });

    expect(result.state).toBe('READY');
  });

  it('requires an exact selected branch and checkpoint', () => {
    const result = evaluateRequirementExpression({
      kind: 'BRANCH_STATE', id: 'branch:remote', branchId: 'remote', checkpointId: 'paid-fare',
      evidenceIds: reviewed,
    }, { ...snapshot, selectedBranchId: 'remote' });

    expect(result).toMatchObject({
      state: 'BLOCKED',
      reasons: ['Requires route remote at checkpoint paid-fare.'],
      unblockActions: ['Select route remote and reach checkpoint paid-fare.'],
    });
  });

  it('accepts exact manual confirmation IDs and preserves authored unresolved reasons', () => {
    const manual = evaluateRequirementExpression({
      kind: 'MANUAL_CONFIRMATION', id: 'manual:partner', confirmationId: 'partner',
      prompt: 'Partner is ready.', evidenceIds: reviewed,
    }, { ...snapshot, confirmedManualIds: new Set(['partner']) });
    const unresolved = evaluateRequirementExpression({
      kind: 'UNRESOLVED_EVIDENCE', id: 'unknown:route', evidenceId: 'audit:route',
      reason: 'Route audit is stale.', evidenceIds: reviewed,
    }, snapshot);

    expect(manual.state).toBe('READY');
    expect(unresolved).toMatchObject({
      state: 'NEEDS_REVIEW',
      unresolvedEvidenceIds: ['audit:route'],
      reasons: ['Route audit is stale.'],
      blockerIds: [],
    });
  });
});
