import { describe, expect, it } from 'vitest';
import { compileRuneProofQuestPack } from './packCompiler';
import { requirementAny } from './packModel';
import { validateRequirementExpression } from './requirements';
import {
  addDuplicateReviewedMethods,
  branchingPackDefinition,
  exampleCatalogueEntry,
  initialRoot,
  manualRequirement,
  skillRequirement,
  temporaryBoostRequirement,
  transportRequirementWithFare,
  unresolvedRouteItemRequirement,
} from './testFixtures';

const context = {
  catalogue: exampleCatalogueEntry,
  expectedCatalogueRevision: 'catalogue-revision',
} as const;

describe('RuneProof pack compiler', () => {
  it('accepts no-gate ALL, rejects empty ANY, and stops at the node cap', () => {
    expect(validateRequirementExpression({ kind: 'ALL', requirements: [] }).valid)
      .toBe(true);
    expect(validateRequirementExpression({ kind: 'ANY', requirements: [] }).valid)
      .toBe(false);
    const requirements = Array.from({ length: 3_000 }, (_, index) => ({
      kind: 'MANUAL_CONFIRMATION',
      id: `manual:${index}`,
      confirmationId: `manual:${index}`,
      prompt: `Confirm ${index}.`,
      evidenceIds: ['review:example'],
    }));
    Object.defineProperty(requirements, 2_500, {
      enumerable: true,
      get: () => { throw new Error('traversed beyond global cap'); },
    });
    const validation = validateRequirementExpression({ kind: 'ALL', requirements });
    expect(validation.errors.filter(error => error.includes('2048 nodes')))
      .toHaveLength(1);
  });

  it('deep-freezes a valid pack and keeps both valid branches', () => {
    const result = compileRuneProofQuestPack(branchingPackDefinition, context);
    expect(result.findings).toEqual([]);
    expect(result.rejectedBranchIds).toEqual([]);
    expect(result.pack?.branches.map(branch => branch.id)).toEqual(['local', 'remote']);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.pack)).toBe(true);
    expect(Object.isFrozen(result.pack?.branches[0].actions)).toBe(true);
  });

  it('accepts a reviewed world-gathered transformation with no consumed inputs', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    changed.branches[0].actions[0].preferredMethod = {
      id: 'method:gather-output',
      label: 'Gather the reviewed output',
      kind: 'TRANSFORMATION',
      evidenceIds: ['review:example'],
    };
    changed.branches[0].actions[0].itemEffects.push({
      kind: 'PRODUCE',
      itemKey: 'world gathered output',
      quantity: 1,
      from: [],
    });

    const result = compileRuneProofQuestPack(changed, context);

    expect(result.findings).toEqual([]);
    expect(result.pack?.branches[0].actions[0].itemEffects).toContainEqual({
      kind: 'PRODUCE',
      itemKey: 'world gathered output',
      quantity: 1,
      from: [],
    });
  });

  it('rejects one broken ledger without hiding a valid sibling branch', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    changed.branches[1].actions[0].itemEffects.push(
      { kind: 'CONSUME', itemKey: 'missing item', quantity: 1 },
    );
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.pack?.branches.map(branch => branch.id)).toEqual(['local']);
    expect(Object.keys(result.pack!.completion.branchActionIds)).toEqual(['local']);
    expect(result.rejectedBranchIds).toEqual(['remote']);
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'BROKEN_ITEM_LEDGER',
      branchId: 'remote',
    }));
  });

  it('emits deterministic sorted unique finding IDs', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    changed.branches[1].actions[0].itemEffects = [
      { kind: 'CONSUME', itemKey: 'missing item', quantity: 1 },
    ];
    changed.branches[0].actions[0].location.chunks = [];
    const first = compileRuneProofQuestPack(changed, context).findings;
    const second = compileRuneProofQuestPack(changed, context).findings;
    expect(first.map(finding => finding.id)).toEqual(second.map(finding => finding.id));
    expect(first.map(finding => finding.id)).toEqual(
      [...first.map(finding => finding.id)].sort(),
    );
    expect(new Set(first.map(finding => finding.id)).size).toBe(first.length);
  });

  it('isolates missing player-visible evidence to its owning branch', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    changed.branches[0].actions[0].evidenceIds = [];
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.pack?.branches.map(branch => branch.id)).toEqual(['remote']);
    expect(result.rejectedBranchIds).toEqual(['local']);
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'SOURCE_MISMATCH',
      branchId: 'local',
      severity: 'BLOCKING',
    }));
  });

  it.each([
    ['blank source ID', (pack: any) => { pack.sources[0].id = ' '; }],
    ['invalid source timestamp', (pack: any) => {
      pack.sources[0].revisionTimestamp = 'not-a-time';
    }],
    ['review before source revision', (pack: any) => {
      pack.sources[0].revisionTimestamp = '2026-08-22T12:00:00.000Z';
      pack.sources[0].reviewedAt = '2026-08-22T11:00:00.000Z';
    }],
    ['blank evidence decision', (pack: any) => { pack.evidence[0].decision = ''; }],
  ])('rejects malformed pack provenance: %s', (_label, mutate) => {
    const changed: any = structuredClone(branchingPackDefinition);
    mutate(changed);
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.pack).toBeUndefined();
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'SOURCE_MISMATCH',
      scope: 'PACK',
    }));
  });

  it('rejects duplicate temporary-boost source IDs in its owning branch', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    changed.branches[0].actions[0].requirements = temporaryBoostRequirement({
      boostSourceIds: ['global root', 'global root'],
    });
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.rejectedBranchIds).toContain('local');
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'INVALID_REQUIREMENT_REFERENCE',
      branchId: 'local',
    }));
  });

  it('rejects a mixed deterministic/manual ANY whose completion path is ambiguous', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    changed.branches[0].actions[0].requirements = requirementAny(
      skillRequirement('Mining', 99),
      manualRequirement('manual:fallback', 'Confirm the reviewed fallback.'),
    );
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.rejectedBranchIds).toContain('local');
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'INVALID_REQUIREMENT_REFERENCE',
      branchId: 'local',
    }));
  });

  it('rejects duplicate migration source revisions', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    const migration = (id: string) => ({
      id,
      fromRevision: 'pack-v0',
      actionIds: {},
      itemKeys: {},
      branchIds: {},
      manualConfirmationIds: {},
      checkpointIds: {},
    });
    changed.migrations = [migration('migration:a'), migration('migration:b')];
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.pack).toBeUndefined();
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'INVALID_MIGRATION',
      severity: 'BLOCKING',
    }));
  });

  it.each([
    ['source order', (pack: any) => {
      pack.branches[0].actions[0].sourceOrder = Number.POSITIVE_INFINITY;
    }, 'INVALID_ORDER'],
    ['branch rank', (pack: any) => {
      pack.branches[0].rank.riskCost = Number.NaN;
    }, 'INVALID_RANK'],
  ])('isolates invalid numeric %s', (_label, mutate, code) => {
    const changed: any = structuredClone(branchingPackDefinition);
    mutate(changed);
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.pack?.branches.map(branch => branch.id)).toEqual(['remote']);
    expect(result.findings).toContainEqual(expect.objectContaining({
      code,
      branchId: 'local',
    }));
  });

  it.each([
    ['checkpoint', (pack: any) => {
      pack.branches[0].actions[0].completion = {
        kind: 'BRANCH_CHECKPOINT', checkpointId: 'missing:checkpoint',
      };
    }],
    ['item', (pack: any) => {
      pack.branches[0].actions[0].completion = {
        kind: 'ITEM_CONFIRMED', itemKey: 'missing item',
      };
    }],
    ['branch state', (pack: any) => {
      pack.branches[0].requirements = {
        kind: 'BRANCH_STATE',
        id: 'branch-state:missing',
        branchId: 'local',
        checkpointId: 'missing:checkpoint',
        evidenceIds: ['review:example'],
      };
    }],
  ])('rejects a branch-local unresolved %s proof target', (_label, mutate) => {
    const changed: any = structuredClone(branchingPackDefinition);
    mutate(changed);
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.pack?.branches.map(branch => branch.id)).toEqual(['remote']);
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'INVALID_PROOF_REFERENCE',
      branchId: 'local',
    }));
  });

  it.each([
    ['item requirement', () => unresolvedRouteItemRequirement('missing item')],
    ['transport fare', () => transportRequirementWithFare('missing fare', 1)],
  ])('rejects an unsatisfiable route %s', (_label, requirement) => {
    const changed: any = structuredClone(branchingPackDefinition);
    changed.branches[0].actions[0].requirements = requirement();
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.rejectedBranchIds).toContain('local');
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'INVALID_PROOF_REFERENCE',
      branchId: 'local',
    }));
  });

  it('fails closed for a pack-wide duplicate action ID', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    changed.branches[1].actions[0].id = 'local:step';
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.pack).toBeUndefined();
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'DUPLICATE_ID',
      severity: 'BLOCKING',
      scope: 'PACK',
    }));
  });

  it('fails closed for duplicate branch IDs before completion-map lookup', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    changed.branches[1].id = changed.branches[0].id;
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.pack).toBeUndefined();
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'DUPLICATE_ID',
      severity: 'BLOCKING',
      scope: 'PACK',
    }));
  });

  it.each([
    ['duplicate canonical roots', [initialRoot('token'), initialRoot('token')]],
    ['an alternative owned by another canonical root', [
      initialRoot('first', ['second']),
      initialRoot('second'),
    ]],
  ])('fails closed for ambiguous item families: %s', (_label, initialItems) => {
    const changed: any = structuredClone(branchingPackDefinition);
    changed.initialItems = initialItems;
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.pack).toBeUndefined();
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'INVALID_PROOF_REFERENCE',
      scope: 'PACK',
    }));
  });

  it('rejects duplicate preferred/alternative method IDs within one action', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    addDuplicateReviewedMethods(changed.branches[0].actions[0], 'method:same');
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.rejectedBranchIds).toContain('local');
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'DUPLICATE_ID',
      branchId: 'local',
    }));
  });

  it.each([
    ['dangling dependency', (pack: any) => {
      pack.branches[0].actions[0].dependsOn = ['missing'];
    }, 'DANGLING_DEPENDENCY'],
    ['cycle', (pack: any) => {
      pack.branches[0].actions[0].dependsOn = ['local:checkpoint-step'];
      pack.branches[0].actions[1].dependsOn = ['local:step'];
    }, 'DEPENDENCY_CYCLE'],
  ])('isolates a branch-local %s', (_label, mutate, code) => {
    const changed: any = structuredClone(branchingPackDefinition);
    mutate(changed);
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.pack?.branches.map(branch => branch.id)).toEqual(['remote']);
    expect(Object.keys(result.pack!.completion.branchActionIds)).toEqual(['remote']);
    expect(result.rejectedBranchIds).toEqual(['local']);
    expect(result.findings).toContainEqual(expect.objectContaining({
      code,
      branchId: 'local',
      severity: 'BLOCKING',
    }));
  });

  it('requires subjective combat guidance to have manual confirmation and evidence', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    changed.branches[0].actions[0].combat = {
      id: 'combat:example',
      encounter: 'Example guardian',
      phases: ['Single phase'],
      mandatoryMechanics: ['Avoid the marked tile.'],
      equipmentCapabilities: ['A reviewed damage option'],
      recommendedSupplies: ['Food'],
      deathAndEscape: 'Escape through the entrance.',
      reentry: 'Return through the reviewed entrance.',
      confirmationId: '',
      evidenceIds: [],
    };
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.rejectedBranchIds).toContain('local');
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'MISSING_COMBAT_CONFIRMATION',
      branchId: 'local',
    }));
  });
});

describe('pack-wide compiler invariants', () => {
  it.each([
    ['schema version', (pack: any) => { pack.schemaVersion = 2; }, 'schemaVersion'],
    ['quest identity', (pack: any) => { pack.questId = 'Other Quest'; }, 'questId'],
    ['catalogue revision', (pack: any) => { pack.catalogueRevision = 'old'; }, 'catalogueRevision'],
    ['pack revision', (pack: any) => { pack.revision = ' '; }, 'revision'],
    ['unknown pack field', (pack: any) => { pack.unmodelled = true; }, 'pack:keys'],
  ])('fails closed for invalid %s', (_label, mutate, discriminator) => {
    const changed: any = structuredClone(branchingPackDefinition);
    mutate(changed);
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.pack).toBeUndefined();
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'IDENTITY_MISMATCH',
      scope: 'PACK',
      id: expect.stringContaining(encodeURIComponent(discriminator)),
    }));
  });

  it.each([
    ['duplicate source ID', (pack: any) => { pack.sources.push(pack.sources[0]); }, 'DUPLICATE_ID'],
    ['dangling evidence source', (pack: any) => { pack.evidence[0].sourceId = 'missing'; }, 'SOURCE_MISMATCH'],
    ['independent review author', (pack: any) => { pack.sources[0].author = ''; }, 'SOURCE_MISMATCH'],
    ['independent review methodology', (pack: any) => { pack.sources[0].methodology = ''; }, 'SOURCE_MISMATCH'],
  ])('rejects malformed source-table invariant: %s', (_label, mutate, code) => {
    const changed: any = structuredClone(branchingPackDefinition);
    mutate(changed);
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.pack).toBeUndefined();
    expect(result.findings).toContainEqual(expect.objectContaining({ code, scope: 'PACK' }));
  });

  it('requires a wiki URL to be HTTPS on the OSRS wiki and pinned to its revision', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    changed.sources[0] = {
      id: 'wiki:example',
      kind: 'WIKI_REVISION',
      uri: 'https://oldschool.runescape.wiki/w/Example_Quest?oldid=99',
      revision: '100',
      revisionTimestamp: '2026-08-22T00:00:00.000Z',
      reviewedAt: '2026-08-22T00:00:00.000Z',
    };
    changed.evidence[0].sourceId = 'wiki:example';
    const stale = compileRuneProofQuestPack(changed, context);
    expect(stale.pack).toBeUndefined();
    expect(stale.findings).toContainEqual(expect.objectContaining({
      code: 'STALE_EVIDENCE', scope: 'PACK',
    }));

    changed.sources[0].uri = 'http://example.com/?oldid=100';
    const wrongHost = compileRuneProofQuestPack(changed, context);
    expect(wrongHost.findings).toContainEqual(expect.objectContaining({
      code: 'SOURCE_MISMATCH', scope: 'PACK',
    }));
  });

  it('matches quest-data source revision identity to the catalogue entry', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    changed.sources[0] = {
      id: 'quest-data:example',
      kind: 'QUEST_DATA',
      uri: 'urn:runeproof:quest-data',
      revision: 'wrong',
      revisionTimestamp: exampleCatalogueEntry.sourceRevisionTimestamp,
      reviewedAt: exampleCatalogueEntry.sourceRevisionTimestamp,
    };
    changed.evidence[0].sourceId = 'quest-data:example';
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.pack).toBeUndefined();
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'STALE_EVIDENCE', scope: 'PACK',
    }));
  });

  it.each([
    ['initial item', (pack: any) => { pack.initialItems[0].evidenceIds = []; }],
    ['preflight', (pack: any) => { pack.preflight.evidenceIds = []; }],
    ['shared action', (pack: any) => { pack.sharedActions[0].evidenceIds = []; }],
    ['completion', (pack: any) => { pack.completion.evidenceIds = []; }],
  ])('treats missing shared %s evidence as pack-wide', (_label, mutate) => {
    const changed: any = structuredClone(branchingPackDefinition);
    mutate(changed);
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.pack).toBeUndefined();
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'SOURCE_MISMATCH', scope: 'PACK', severity: 'BLOCKING',
    }));
  });

  it('rejects conflicting reuse of a manual confirmation ID across branches', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    changed.branches[1].requirements.requirements[0].confirmationId = 'local:manual';
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.pack).toBeUndefined();
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'DUPLICATE_ID', scope: 'PACK',
    }));
  });

  it('allows identical manual declaration semantics to be reused across branches', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    const shared = manualRequirement('manual:shared', 'Confirm the shared reviewed state.');
    changed.branches[0].actions[0].requirements = shared;
    changed.branches[1].actions[0].requirements = structuredClone(shared);
    expect(compileRuneProofQuestPack(changed, context).pack?.branches.map(branch => branch.id))
      .toEqual(['local', 'remote']);
  });

  it('validates completion branch keys against original branch cardinality', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    delete changed.completion.branchActionIds.remote;
    changed.completion.branchActionIds.unknown = 'remote:complete';
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.pack).toBeUndefined();
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'CONFLICTING_COMPLETION', scope: 'PACK',
    }));
  });

  it('fails closed when a shared action depends on a branch action', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    changed.sharedActions[0].dependsOn = ['local:step'];
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.pack).toBeUndefined();
    expect(result.rejectedBranchIds).toEqual([]);
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'DANGLING_DEPENDENCY', scope: 'PACK', actionId: 'shared:start',
    }));
  });

  it('fails closed for duplicate checkpoint declarations across branches', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    changed.branches[1].checkpointIds[0] = 'local:checkpoint';
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.pack).toBeUndefined();
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'DUPLICATE_ID', scope: 'PACK',
    }));
  });

  it('treats unresolved pack preflight evidence as a blocking reviewed finding', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    changed.preflight = {
      kind: 'UNRESOLVED_EVIDENCE',
      id: 'unresolved:pack',
      evidenceId: 'review:example',
      reason: 'The source is contradictory.',
      evidenceIds: ['review:example'],
    };
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.pack).toBeUndefined();
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'UNRESOLVED_REQUIREMENT', scope: 'PACK',
    }));
  });

  it('fails closed when preflight asks for more than reviewed initial supply', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    changed.preflight = {
      kind: 'ITEM', id: 'preflight:item', itemKey: 'global root', quantity: 2,
      evidenceIds: ['review:example'],
    };
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.pack).toBeUndefined();
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'INVALID_PROOF_REFERENCE', scope: 'PACK',
    }));
  });
});

describe('branch-local compiler invariants', () => {
  it.each([
    ['empty surface chunks', (action: any) => { action.location.chunks = []; }],
    ['duplicate surface chunks', (action: any) => { action.location.chunks = ['0,0', '0,0']; }],
    ['noninteger surface plane', (action: any) => { action.location.plane = 0.5; }],
    ['blank instance ID', (action: any) => {
      action.location = {
        kind: 'INSTANCE', label: 'Instance', instanceId: '', entranceChunks: ['0,0'],
        plane: 0, evidenceIds: ['review:example'],
      };
    }],
  ])('isolates invalid location: %s', (_label, mutate) => {
    const changed: any = structuredClone(branchingPackDefinition);
    mutate(changed.branches[0].actions[0]);
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.pack?.branches.map(branch => branch.id)).toEqual(['remote']);
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'INVALID_LOCATION', branchId: 'local',
    }));
  });

  it('isolates an unknown action field instead of accepting unmodelled route data', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    changed.branches[0].actions[0].unmodelled = true;
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.pack?.branches.map(branch => branch.id)).toEqual(['remote']);
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'INVALID_PROOF_REFERENCE', branchId: 'local', actionId: 'local:step',
    }));
  });

  it('isolates missing alternative evidence and unresolved alternative requirements', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    changed.branches[0].actions[0].alternatives = [{
      id: 'alternative:missing',
      label: 'Unreviewed alternative',
      kind: 'QUEST_ROUTE',
      requirements: unresolvedRouteItemRequirement('missing alternative item'),
      evidenceIds: [],
    }];
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.pack?.branches.map(branch => branch.id)).toEqual(['remote']);
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'SOURCE_MISMATCH', branchId: 'local',
    }));
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'INVALID_PROOF_REFERENCE', branchId: 'local',
    }));
  });

  it('allows a manual-only ANY acknowledgement choice', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    changed.branches[0].actions[0].requirements = requirementAny(
      manualRequirement('manual:first', 'Confirm the first reviewed option.'),
      manualRequirement('manual:second', 'Confirm the second reviewed option.'),
    );
    expect(compileRuneProofQuestPack(changed, context).pack?.branches.map(branch => branch.id))
      .toEqual(['local', 'remote']);
  });

  it('rejects a branch-state pair whose branch declaration is absent', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    changed.branches[0].requirements = {
      kind: 'BRANCH_STATE', id: 'state:missing-branch', branchId: 'missing',
      evidenceIds: ['review:example'],
    };
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.pack?.branches.map(branch => branch.id)).toEqual(['remote']);
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'INVALID_PROOF_REFERENCE', branchId: 'local',
    }));
  });

  it.each([
    ['equal source order', (pack: any) => { pack.branches[0].actions[0].sourceOrder = 1; }, 'INVALID_ORDER'],
    ['forward dependency', (pack: any) => {
      pack.branches[0].actions[0].dependsOn = ['local:checkpoint-step'];
    }, 'INVALID_ORDER'],
    ['cross-branch dependency', (pack: any) => {
      pack.branches[0].actions[0].dependsOn = ['remote:step'];
    }, 'DANGLING_DEPENDENCY'],
    ['unreachable action', (pack: any) => {
      pack.branches[0].actions[1].dependsOn = ['shared:start'];
    }, 'UNREACHABLE_COMPLETION'],
  ])('isolates graph violation: %s', (_label, mutate, code) => {
    const changed: any = structuredClone(branchingPackDefinition);
    mutate(changed);
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.pack?.branches.map(branch => branch.id)).toEqual(['remote']);
    expect(result.findings).toContainEqual(expect.objectContaining({
      code, branchId: 'local', severity: 'BLOCKING',
    }));
  });

  it.each([
    ['wrong mapped action', (pack: any) => {
      pack.completion.branchActionIds.local = 'local:checkpoint-step';
    }],
    ['second canonical completion', (pack: any) => {
      pack.branches[0].actions[0].completion = {
        kind: 'CANONICAL_QUEST_COMPLETED', questId: 'Example Quest',
      };
    }],
    ['nonterminal completion', (pack: any) => {
      pack.branches[0].actions[1].dependsOn = ['local:complete'];
    }],
  ])('isolates invalid route completion: %s', (_label, mutate) => {
    const changed: any = structuredClone(branchingPackDefinition);
    mutate(changed);
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.pack?.branches.map(branch => branch.id)).toEqual(['remote']);
    expect(result.findings.some(finding => finding.branchId === 'local'
      && (finding.code === 'CONFLICTING_COMPLETION'
        || finding.code === 'UNREACHABLE_COMPLETION'))).toBe(true);
  });

  it('accepts an action gate supplied by an earlier composite-completable action', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    changed.branches[0].actions[1].requirements = unresolvedRouteItemRequirement('local token');
    expect(compileRuneProofQuestPack(changed, context).pack?.branches.map(branch => branch.id))
      .toEqual(['local', 'remote']);
  });

  it('rejects an action gate first supplied by that same action', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    changed.branches[0].actions[0].requirements = unresolvedRouteItemRequirement('local token');
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.pack?.branches.map(branch => branch.id)).toEqual(['remote']);
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'INVALID_PROOF_REFERENCE', branchId: 'local', actionId: 'local:step',
    }));
  });

  it('does not turn subjective combat recommendations into deterministic blockers', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    changed.branches[0].actions[0].combat.recommendedSupplies = ['An unavailable luxury item'];
    changed.branches[0].actions[0].combat.equipmentCapabilities = ['A subjective capability'];
    expect(compileRuneProofQuestPack(changed, context).pack?.branches.map(branch => branch.id))
      .toEqual(['local', 'remote']);
  });

  it('turns unresolved branch evidence into a branch-local finding', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    changed.branches[0].requirements = {
      kind: 'UNRESOLVED_EVIDENCE',
      id: 'unresolved:local',
      evidenceId: 'review:example',
      reason: 'The route is contradictory.',
      evidenceIds: ['review:example'],
    };
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.pack?.branches.map(branch => branch.id)).toEqual(['remote']);
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'UNRESOLVED_REQUIREMENT', branchId: 'local',
    }));
  });
});

describe('migration isolation and pruning', () => {
  const migration = {
    id: 'migration:v0',
    fromRevision: 'fixture-pack-v0',
    actionIds: { 'old:remote-action': 'remote:step' },
    itemKeys: { 'old remote token': 'remote token' },
    branchIds: { 'old:remote': 'remote' },
    manualConfirmationIds: { 'old:remote-manual': 'remote:manual' },
    checkpointIds: { 'old:remote-checkpoint': 'remote:checkpoint' },
  } as const;

  it('prunes every mapping whose destination belongs only to a rejected branch', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    changed.migrations = [migration];
    changed.branches[1].actions[0].itemEffects.push(
      { kind: 'CONSUME', itemKey: 'missing item', quantity: 1 },
    );
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.pack?.branches.map(branch => branch.id)).toEqual(['local']);
    expect(result.pack?.migrations).toEqual([{
      id: 'migration:v0',
      fromRevision: 'fixture-pack-v0',
      actionIds: {}, itemKeys: {}, branchIds: {}, manualConfirmationIds: {}, checkpointIds: {},
    }]);
  });

  it('retains a semantically identical reused manual destination on a legal sibling', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    const shared = manualRequirement('manual:shared', 'Confirm shared reviewed state.');
    changed.branches[0].actions[0].requirements = shared;
    changed.branches[1].actions[0].requirements = structuredClone(shared);
    changed.migrations = [{
      ...migration,
      actionIds: {}, itemKeys: {}, branchIds: {}, checkpointIds: {},
      manualConfirmationIds: { 'old:shared': 'manual:shared' },
    }];
    changed.branches[0].actions[0].itemEffects = [
      { kind: 'CONSUME', itemKey: 'missing item', quantity: 1 },
    ];
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.pack?.branches.map(branch => branch.id)).toEqual(['remote']);
    expect(result.pack?.migrations[0].manualConfirmationIds)
      .toEqual({ 'old:shared': 'manual:shared' });
  });

  it('fails closed for an unresolved surviving migration destination', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    changed.migrations = [{ ...migration, actionIds: { old: 'missing' }, itemKeys: {}, branchIds: {}, manualConfirmationIds: {}, checkpointIds: {} }];
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.pack).toBeUndefined();
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'INVALID_MIGRATION', scope: 'PACK',
    }));
  });

  it('fails closed for an ambiguous item destination across accepted branches', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    changed.branches[0].actions[0].itemEffects.push({
      kind: 'ACQUIRE', itemKey: 'shared branch proof', quantity: 1,
    });
    changed.branches[1].actions[0].itemEffects.push({
      kind: 'ACQUIRE', itemKey: 'shared branch proof', quantity: 1,
    });
    changed.migrations = [{
      ...migration,
      actionIds: {}, branchIds: {}, manualConfirmationIds: {}, checkpointIds: {},
      itemKeys: { 'old shared proof': 'shared branch proof' },
    }];
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.pack).toBeUndefined();
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'INVALID_MIGRATION', scope: 'PACK',
    }));
  });

  it.each([
    ['current source revision', (entry: any, pack: any) => { entry.fromRevision = pack.revision; }],
    ['self-map', (entry: any) => { entry.actionIds = { same: 'same' }; }],
    ['noncanonical item key', (entry: any) => { entry.itemKeys = { ' Old': 'remote token' }; }],
    ['unknown field', (entry: any) => { entry.unmodelled = true; }],
  ])('rejects invalid migration shape: %s', (_label, mutate) => {
    const changed: any = structuredClone(branchingPackDefinition);
    const entry: any = structuredClone(migration);
    mutate(entry, changed);
    changed.migrations = [entry];
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.pack).toBeUndefined();
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'INVALID_MIGRATION', scope: 'PACK',
    }));
  });
});

describe('fail-closed boundary and normalization invariants', () => {
  it('treats nonenumerable own array indexes as dense without inspecting descriptors', () => {
    const requirements: any[] = [];
    Object.defineProperty(requirements, 0, {
      configurable: true,
      enumerable: false,
      value: manualRequirement('manual:nonenumerable', 'Confirm the reviewed state.'),
    });
    expect(validateRequirementExpression({ kind: 'ALL', requirements })).toEqual({
      valid: true,
      errors: [],
    });
  });

  it.each([
    ['missing itemEffects', (action: any) => { delete action.itemEffects; }],
    ['missing completion', (action: any) => { delete action.completion; }],
    ['missing dependencies', (action: any) => { delete action.dependsOn; }],
    ['malformed production inputs', (action: any) => {
      action.itemEffects = [{
        kind: 'PRODUCE', itemKey: 'malformed output', quantity: 1,
      }];
    }],
    ['non-array production inputs', (action: any) => {
      action.itemEffects = [{
        kind: 'PRODUCE', itemKey: 'malformed output', quantity: 1, from: {},
      }];
    }],
    ['invalid production input quantity', (action: any) => {
      action.itemEffects = [{
        kind: 'PRODUCE', itemKey: 'malformed output', quantity: 1,
        from: [{ itemKey: 'malformed input', quantity: 0 }],
      }];
    }],
  ])('returns a structured branch finding for %s instead of throwing', (_label, mutate) => {
    const changed: any = structuredClone(branchingPackDefinition);
    mutate(changed.branches[0].actions[0]);
    expect(() => compileRuneProofQuestPack(changed, context)).not.toThrow();
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.pack?.branches.map(branch => branch.id)).toEqual(['remote']);
    expect(result.rejectedBranchIds).toEqual(['local']);
    expect(result.findings).toContainEqual(expect.objectContaining({
      branchId: 'local', severity: 'BLOCKING',
    }));
  });

  it.each([
    ['equal source order', (pack: any) => {
      const second = structuredClone(pack.sharedActions[0]);
      second.id = 'shared:second';
      second.sourceOrder = 1;
      pack.sharedActions.push(second);
      pack.branches.forEach((branch: any) => {
        branch.actions[0].dependsOn.push('shared:second');
      });
    }, 'INVALID_ORDER'],
    ['dependency cycle', (pack: any) => {
      const second = structuredClone(pack.sharedActions[0]);
      second.id = 'shared:second';
      second.sourceOrder = 2;
      second.dependsOn = ['shared:start'];
      pack.sharedActions[0].dependsOn = ['shared:second'];
      pack.sharedActions.push(second);
      pack.branches.forEach((branch: any) => {
        branch.actions.forEach((action: any) => { action.sourceOrder += 1; });
        branch.actions[0].dependsOn = ['shared:second'];
      });
    }, 'DEPENDENCY_CYCLE'],
  ])('treats a shared graph %s as pack-wide', (_label, mutate, code) => {
    const changed: any = structuredClone(branchingPackDefinition);
    mutate(changed);
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.pack).toBeUndefined();
    expect(result.rejectedBranchIds).toEqual([]);
    expect(result.findings).toContainEqual(expect.objectContaining({
      code, scope: 'PACK', severity: 'BLOCKING',
    }));
  });

  it('normalizes an exact redundant self-alias out of the compiled item family', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    changed.initialItems[0].alternatives.push({ key: 'global root', name: 'Global root' });
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.pack?.initialItems[0].alternatives).toEqual([
      { key: 'global alternative', name: 'Global alternative' },
    ]);
    expect(changed.initialItems[0].alternatives).toHaveLength(2);
  });

  it('does not admit a quest-provided initial family into pack preflight supply', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    changed.initialItems[0].supplyPolicy = 'QUEST_PROVIDED';
    changed.preflight = {
      kind: 'ITEM', id: 'preflight:quest-provided', itemKey: 'global root', quantity: 1,
      evidenceIds: ['review:example'],
    };
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.pack).toBeUndefined();
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'INVALID_PROOF_REFERENCE', scope: 'PACK',
    }));
  });

  it('allows combat phase copy to be empty when reviewed mechanics remain explicit', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    changed.branches[0].actions[0].combat.phases = [];
    expect(compileRuneProofQuestPack(changed, context).pack?.branches.map(branch => branch.id))
      .toEqual(['local', 'remote']);
  });

  it('requires route family effects to name the canonical root, not an alias', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    changed.branches[0].actions[0].itemEffects = [{
      kind: 'RETAIN', itemKey: 'global alternative', quantity: 1,
    }];
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.pack?.branches.map(branch => branch.id)).toEqual(['remote']);
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'BROKEN_ITEM_LEDGER', branchId: 'local',
    }));
  });

  it('allows ITEM_CONFIRMED to target a declared initial alternative', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    changed.branches[0].actions[0].completion = {
      kind: 'ITEM_CONFIRMED', itemKey: 'global alternative',
    };
    expect(compileRuneProofQuestPack(changed, context).pack?.branches.map(branch => branch.id))
      .toEqual(['local', 'remote']);
  });

  it('rejects a noncanonical temporary-boost source item ID branch-locally', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    changed.branches[0].actions[0].requirements = temporaryBoostRequirement({
      boostSourceIds: [' Global root'],
    });
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.pack?.branches.map(branch => branch.id)).toEqual(['remote']);
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'INVALID_REQUIREMENT_REFERENCE', branchId: 'local',
    }));
  });

  it('fails closed when explicit MANUAL completions reuse an ID with different instructions', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    changed.branches[0].actions[0].completion = {
      kind: 'MANUAL', confirmationId: 'manual:completion-shared',
    };
    changed.branches[1].actions[0].completion = {
      kind: 'MANUAL', confirmationId: 'manual:completion-shared',
    };
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.pack).toBeUndefined();
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'DUPLICATE_ID', scope: 'PACK',
    }));
  });

  it('keeps finding IDs stable when malformed source rows are reordered', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    changed.sources.push({
      id: 'source:second', kind: 'CHUNK_PICKER', uri: '', revision: 'v1',
      revisionTimestamp: 'bad', reviewedAt: 'bad',
    });
    const first = compileRuneProofQuestPack(changed, context).findings.map(finding => finding.id);
    changed.sources.reverse();
    const second = compileRuneProofQuestPack(changed, context).findings.map(finding => finding.id);
    expect(second).toEqual(first);
  });
});

describe('review fixes: malformed runtime ownership boundary', () => {
  it('rejects a non-record shared action pack-wide instead of filtering it', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    changed.sharedActions = [null];
    expect(() => compileRuneProofQuestPack(changed, context)).not.toThrow();
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.pack).toBeUndefined();
    expect(result.rejectedBranchIds).toEqual([]);
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'INVALID_PROOF_REFERENCE', scope: 'PACK', severity: 'BLOCKING',
    }));
  });

  it('rejects a non-record branch action without disabling its sibling', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    changed.branches[0].actions[0] = null;
    expect(() => compileRuneProofQuestPack(changed, context)).not.toThrow();
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.pack?.branches.map(branch => branch.id)).toEqual(['remote']);
    expect(result.rejectedBranchIds).toEqual(['local']);
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'INVALID_PROOF_REFERENCE', scope: 'ACTION', branchId: 'local',
      actionId: 'blank-action-id', severity: 'BLOCKING',
    }));
  });

  it('rejects a non-record branch without throwing or retaining its completion map', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    changed.branches[0] = null;
    expect(() => compileRuneProofQuestPack(changed, context)).not.toThrow();
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.pack?.branches.map(branch => branch.id)).toEqual(['remote']);
    expect(result.pack?.completion.branchActionIds).toEqual({ remote: 'remote:complete' });
    expect(result.rejectedBranchIds).toEqual(['blank-branch-id']);
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'INVALID_PROOF_REFERENCE', scope: 'BRANCH', branchId: 'blank-branch-id',
      severity: 'BLOCKING',
    }));
  });

  it('isolates a branch action with a Symbol source order without coercing it', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    changed.branches[0].actions[0].sourceOrder = Symbol('invalid-order');
    expect(() => compileRuneProofQuestPack(changed, context)).not.toThrow();
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.pack?.branches.map(branch => branch.id)).toEqual(['remote']);
    expect(result.rejectedBranchIds).toEqual(['local']);
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'INVALID_ORDER', branchId: 'local', actionId: 'local:step',
    }));
  });

  it('rejects a shared action with a Symbol source order pack-wide', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    changed.sharedActions[0].sourceOrder = Symbol('invalid-order');
    expect(() => compileRuneProofQuestPack(changed, context)).not.toThrow();
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.pack).toBeUndefined();
    expect(result.rejectedBranchIds).toEqual([]);
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'INVALID_ORDER', scope: 'PACK', actionId: 'shared:start',
    }));
  });
});

describe('review fixes: bounded requirement semantics', () => {
  it('does not semantically traverse requirement elements beyond the 2048-node cap', () => {
    const requirements = Array.from({ length: 3_000 }, (_, index) => ({
      kind: 'MANUAL_CONFIRMATION',
      id: `manual:bounded:${index}`,
      confirmationId: `manual:bounded:${index}`,
      prompt: `Confirm bounded requirement ${index}.`,
      evidenceIds: ['review:example'],
    }));
    Object.defineProperty(requirements, 2_500, {
      enumerable: true,
      get: () => { throw new Error('semantic traversal passed the node cap'); },
    });
    const changed: any = structuredClone(branchingPackDefinition);
    changed.branches[0].actions[0].requirements = { kind: 'ALL', requirements };
    expect(() => compileRuneProofQuestPack(changed, context)).not.toThrow();
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.pack?.branches.map(branch => branch.id)).toEqual(['remote']);
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'INVALID_REQUIREMENT_REFERENCE', branchId: 'local', actionId: 'local:step',
    }));
  });

  it('does not semantically traverse a requirement object beyond depth 32', () => {
    const depthTrap: Record<string, unknown> = { kind: 'ALL' };
    Object.defineProperty(depthTrap, 'requirements', {
      enumerable: true,
      get: () => { throw new Error('semantic traversal passed the depth cap'); },
    });
    let expression: unknown = depthTrap;
    for (let depth = 0; depth < 33; depth += 1) {
      expression = { kind: 'ALL', requirements: [expression] };
    }
    const changed: any = structuredClone(branchingPackDefinition);
    changed.branches[0].actions[0].requirements = expression;
    expect(() => compileRuneProofQuestPack(changed, context)).not.toThrow();
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.pack?.branches.map(branch => branch.id)).toEqual(['remote']);
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'INVALID_REQUIREMENT_REFERENCE', branchId: 'local', actionId: 'local:step',
    }));
  });
});

describe('review fixes: exact own keys and safe migration records', () => {
  it('rejects a nonenumerable unknown pack field', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    Object.defineProperty(changed, 'hiddenUnmodelledField', {
      configurable: true,
      enumerable: false,
      value: true,
    });
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.pack).toBeUndefined();
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'IDENTITY_MISMATCH', scope: 'PACK', severity: 'BLOCKING',
    }));
  });

  it('rejects a nonenumerable modelled pack field instead of silently normalizing it', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    Object.defineProperty(changed, 'revision', {
      configurable: true,
      enumerable: false,
      value: changed.revision,
    });
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.pack).toBeUndefined();
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'IDENTITY_MISMATCH', scope: 'PACK', severity: 'BLOCKING',
    }));
  });

  it('preserves an accepted __proto__ migration source as an own data key', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    const actionIds = Object.create(null) as Record<string, string>;
    Object.defineProperty(actionIds, '__proto__', {
      configurable: true,
      enumerable: true,
      value: 'local:step',
    });
    changed.migrations = [{
      id: 'migration:prototype-source',
      fromRevision: 'fixture-pack-v0',
      actionIds,
      itemKeys: {},
      branchIds: {},
      manualConfirmationIds: {},
      checkpointIds: {},
    }];
    const result = compileRuneProofQuestPack(changed, context);
    const compiled = result.pack?.migrations[0].actionIds;
    expect(Object.prototype.hasOwnProperty.call(compiled, '__proto__')).toBe(true);
    expect(compiled?.__proto__).toBe('local:step');
    expect(Object.isFrozen(compiled)).toBe(true);
  });
});

describe('review fixes: stable non-wiki source URIs', () => {
  it('rejects non-wiki source text that is not a parseable URI', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    changed.sources[0].uri = 'reviewed by the fixture author';
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.pack).toBeUndefined();
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'SOURCE_MISMATCH', scope: 'PACK', severity: 'BLOCKING',
    }));
  });

  it('accepts a parseable stable URN for a non-wiki source', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    changed.sources[0].uri = 'urn:runeproof:independent-review:fixture-v1';
    expect(compileRuneProofQuestPack(changed, context).pack?.branches.map(branch => branch.id))
      .toEqual(['local', 'remote']);
  });
});

describe('review fixes: exact initial-item self identity', () => {
  it('rejects a same-key alternative whose display name contradicts the root', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    changed.initialItems[0].alternatives.push({ key: 'global root', name: 'GLOBAL ROOT' });
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.pack).toBeUndefined();
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'INVALID_PROOF_REFERENCE', scope: 'PACK', severity: 'BLOCKING',
    }));
  });
});

describe('review fixes: duplicate compiler finding IDs', () => {
  it('turns identical duplicate finding IDs into one deterministic pack rejection', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    changed.sources.push(structuredClone(changed.sources[0]), structuredClone(changed.sources[0]));
    const first = compileRuneProofQuestPack(changed, context);
    const second = compileRuneProofQuestPack(changed, context);
    const collisions = first.findings.filter(finding => (
      finding.code === 'DUPLICATE_ID'
      && finding.scope === 'PACK'
      && finding.message.includes('Compiler findings collided')
    ));
    expect(first.pack).toBeUndefined();
    expect(collisions).toHaveLength(1);
    expect(first.findings.map(finding => finding.id)).toEqual(
      [...new Set(first.findings.map(finding => finding.id))],
    );
    expect(second.findings).toEqual(first.findings);
  });

  it('emits one finding for missing completion evidence', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    changed.completion.evidenceIds = [];
    const result = compileRuneProofQuestPack(changed, context);
    const completionEvidence = result.findings.filter(finding => (
      finding.code === 'SOURCE_MISMATCH'
      && finding.scope === 'PACK'
      && finding.message.includes('Completion metadata must carry')
    ));
    expect(result.pack).toBeUndefined();
    expect(completionEvidence).toHaveLength(1);
    expect(result.findings.some(finding => finding.message.includes('Compiler findings collided')))
      .toBe(false);
  });
});

describe('review fix round 2: malformed branch completion exactness', () => {
  it('rejects surplus completion keys pack-wide when one original branch is non-record', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    changed.branches[0] = null;
    changed.completion.branchActionIds.surplus = 'remote:complete';
    expect(() => compileRuneProofQuestPack(changed, context)).not.toThrow();
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.pack).toBeUndefined();
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'CONFLICTING_COMPLETION', scope: 'PACK', severity: 'BLOCKING',
    }));
  });

  it('requires every identifiable branch key even when another original branch is non-record', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    changed.branches[0] = null;
    changed.completion.branchActionIds = {
      opaqueOriginalSlot: 'local:complete',
      surplusInsteadOfRemote: 'remote:complete',
    };
    expect(() => compileRuneProofQuestPack(changed, context)).not.toThrow();
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.pack).toBeUndefined();
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'CONFLICTING_COMPLETION', scope: 'PACK', severity: 'BLOCKING',
    }));
  });
});

describe('review fix round 3: duplicate readable branch completion exactness', () => {
  it('rejects a surplus completion key when both original branch IDs are readable duplicates', () => {
    const changed: any = structuredClone(branchingPackDefinition);
    changed.branches[0].id = 'remote';
    changed.completion.branchActionIds = {
      remote: 'remote:complete',
      surplus: 'local:complete',
    };
    const result = compileRuneProofQuestPack(changed, context);
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'CONFLICTING_COMPLETION', scope: 'PACK', severity: 'BLOCKING',
    }));
  });
});
