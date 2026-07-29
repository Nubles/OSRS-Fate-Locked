import { describe, expect, it } from 'vitest';
import type { RuneProofRunSnapshot } from '../../types';
import {
  compileItemGoal,
  compileProductionActivityGoals,
  compileProductionDiaryGoals,
  type CompiledGoal,
} from './goalCompiler';
import { createRuneProofEngine, createRuneProofExecutor, evaluateRuneProof, type RuneProofEngineSources } from './engine';
import type { GameModeRules } from '../../config/gameModes';

const goal = compileItemGoal({ id: 'item:plank', label: 'Plank' }, 1);

const snapshot = (overrides: Partial<RuneProofRunSnapshot> = {}): RuneProofRunSnapshot => ({
  runId: 'run-a', runRevision: 4, gameModeId: 'chunked', equipmentTiers: {}, skillCaps: {},
  currentLevels: {}, unlockedAreas: [], unlockedChunks: ['1,1'], unlockedMobility: [],
  unlockedArcana: [], unlockedHousing: [], unlockedMerchants: [], unlockedMinigames: [],
  unlockedBosses: [], unlockedStorage: [], unlockedGuilds: [], unlockedFarming: [],
  unlockedSlayer: [], unlockedBanks: [], completedQuests: [], completedDiaries: [],
  completedCombatAchievements: [], completedTasks: [], collectionLog: {}, ...overrides,
});

const sources = (coverage: 'VERIFIED' | 'PARTIAL' = 'VERIFIED'): RuneProofEngineSources => ({
  sourceVersion: 'source-a',
  sourceAudit: { sourceVersion: 'audit-a', questCoverage: 'VERIFIED', chunkCoverage: 'VERIFIED', acquisitionCoverage: coverage },
  locationGraph: {
    startNodeId: 'home',
    nodes: [
      { id: 'home', label: 'Home', surfaceChunk: '0,0', coverage: 'VERIFIED' },
      { id: 'plank-yard', label: 'Plank yard', surfaceChunk: '1,1', coverage: 'VERIFIED' },
      { id: 'stranded', label: 'Stranded', surfaceChunk: '2,2', coverage: 'VERIFIED' },
    ],
    edges: [{ id: 'home-plank', from: 'home', to: 'plank-yard', bidirectional: true, provenanceIds: ['edge:home-plank'], requirements: { op: 'ALL', terms: [] } }],
  },
  acquisition: {
    schemaVersion: 1, sourceVersion: 'source-a', counts: { rules: 2, unresolvedSources: 0 }, acquisitionCoverage: coverage,
    sourceFamilyCoverage: { DROP: coverage, PRODUCTION: coverage, RESOURCE_ENGINE: coverage, SHOP: coverage, SPAWN: coverage },
    sourceFamilyAccounting: { DROP: { ruleCount: 0, unresolvedCount: 0, ruleIds: [], unresolvedIds: [], coverage }, PRODUCTION: { ruleCount: 0, unresolvedCount: 0, ruleIds: [], unresolvedIds: [], coverage }, RESOURCE_ENGINE: { ruleCount: 0, unresolvedCount: 0, ruleIds: [], unresolvedIds: [], coverage }, SHOP: { ruleCount: 0, unresolvedCount: 0, ruleIds: [], unresolvedIds: [], coverage }, SPAWN: { ruleCount: 2, unresolvedCount: 0, ruleIds: ['plank-direct', 'plank-stranded'], unresolvedIds: [], coverage } },
    provenanceCatalog: [
      { id: 'rule:direct', kind: 'UNKNOWN', coverage, ruleIds: ['plank-direct'], unresolvedIds: [] },
      { id: 'rule:stranded', kind: 'UNKNOWN', coverage, ruleIds: ['plank-stranded'], unresolvedIds: [] },
    ],
    unresolvedSources: [],
    rules: [
      { id: 'plank-direct', output: { id: 'item:plank', kind: 'ITEM', label: 'Plank' }, outputQuantity: 1, sourceKind: 'SPAWN', sourceLabel: 'yard', locationId: 'plank-yard', requirements: { op: 'ALL', terms: [] }, repeatability: 'REPEATABLE', probability: null, coverage, provenanceIds: ['rule:direct'] },
      { id: 'plank-stranded', output: { id: 'item:plank', kind: 'ITEM', label: 'Plank' }, outputQuantity: 1, sourceKind: 'SPAWN', sourceLabel: 'stranded', locationId: 'stranded', requirements: { op: 'ALL', terms: [] }, repeatability: 'REPEATABLE', probability: null, coverage, provenanceIds: ['rule:stranded'] },
    ],
  },
});

describe('evaluateRuneProof', () => {
  it('proves only the direct current-chunk plank route and emits a replayable immutable certificate', async () => {
    const result = await evaluateRuneProof({ goal, includeAlternatives: true }, snapshot(), sources());
    expect(result.status).toBe('OBTAINABLE');
    expect(result.routes).toHaveLength(1);
    expect(result.routes[0].witness.steps.root.ruleId).toBe('plank-direct');
    expect(Object.isFrozen(result.routes[0].witness.steps)).toBe(true);
  });

  it('does not allow an unlocked but stranded chunk to supply a source', async () => {
    const result = await evaluateRuneProof({ goal }, snapshot({ unlockedChunks: ['1,1', '2,2'] }), sources());
    expect(result.routes.map(route => route.witness.steps.root.ruleId)).toEqual(['plank-direct']);
  });

  it('allows a verified positive witness under unrelated global PARTIAL coverage but gates a negative result as UNKNOWN', async () => {
    const complete = sources();
    const globallyPartial = {
      ...complete,
      sourceAudit: {
        ...complete.sourceAudit,
        acquisitionCoverage: 'PARTIAL' as const,
      },
    };
    expect((await evaluateRuneProof({ goal }, snapshot(), globallyPartial)).status).toBe('OBTAINABLE');
    const noRoutes = sources('PARTIAL');
    clearRules(noRoutes);
    expect((await evaluateRuneProof({ goal }, snapshot(), noRoutes)).status).toBe('UNKNOWN');
  });

  it('returns usable current-chunk guidance for an exact PARTIAL item route without issuing a certificate', async () => {
    const incomplete = sources();
    incomplete.acquisition.rules[0].coverage = 'PARTIAL';
    incomplete.acquisition.provenanceCatalog[0].coverage = 'PARTIAL';

    const result = await evaluateRuneProof({ goal }, snapshot(), incomplete);

    expect(result).toMatchObject({
      status: 'OBTAINABLE',
      coverage: 'PARTIAL',
      routesComplete: false,
      explanation: expect.stringMatching(/current chunk data/i),
    });
    expect(result.routes[0].witness.steps.root.ruleId).toBe('plank-direct');
    expect(result.routes[0].witness.proofHash).not.toMatch(/^sha256-/);
  });

  it('shows missing unlocks from a known PARTIAL current-chunk route without claiming they are unavoidable', async () => {
    const incomplete = sources();
    incomplete.acquisition.rules[0].coverage = 'PARTIAL';
    incomplete.acquisition.rules[0].requirements = {
      op: 'FACT',
      fact: { id: 'unlock:access-yard', kind: 'UNLOCK', label: 'Access yard' },
    };
    incomplete.acquisition.provenanceCatalog[0].coverage = 'PARTIAL';

    const result = await evaluateRuneProof({ goal }, snapshot(), incomplete);

    expect(result).toMatchObject({
      status: 'BLOCKED',
      coverage: 'PARTIAL',
      routesComplete: false,
      blockers: [{ factIds: ['unlock:access-yard'], labels: ['Access yard'] }],
      unavoidableBlockerFactIds: [],
      explanation: expect.stringMatching(/missing requirements/i),
    });
  });

  it('does not let PARTIAL route guidance mask independent UNKNOWN audit coverage', async () => {
    const incomplete = sources();
    incomplete.acquisition.rules[0].coverage = 'PARTIAL';
    incomplete.acquisition.provenanceCatalog[0].coverage = 'PARTIAL';
    incomplete.sourceAudit.chunkCoverage = 'UNKNOWN';

    const result = await evaluateRuneProof({ goal }, snapshot(), incomplete);

    expect(result).toMatchObject({ status: 'UNKNOWN', routes: [], routesComplete: false });
  });

  it('fails closed for a malformed runtime goal coverage value', async () => {
    const malformedGoal = { ...goal, coverage: 'BROKEN' as never };

    expect(await evaluateRuneProof({ goal: malformedGoal }, snapshot(), sources()))
      .toMatchObject({ status: 'UNKNOWN', routes: [], routesComplete: false });
  });

  it('fails closed with a valid fallback identity when the runtime goal is missing', async () => {
    const result = await evaluateRuneProof(
      { goal: null } as unknown as import('./engine').RuneProofQuery,
      snapshot(),
      sources(),
    );

    expect(result).toMatchObject({
      goalId: 'goal:invalid',
      status: 'UNKNOWN',
      routes: [],
      routesComplete: false,
    });
  });

  it('does not emit an empty goal identity for a malformed runtime goal', async () => {
    const result = await evaluateRuneProof(
      { goal: { ...goal, id: '' } },
      snapshot(),
      sources(),
    );

    expect(result).toMatchObject({
      goalId: 'goal:invalid',
      status: 'UNKNOWN',
      routes: [],
      routesComplete: false,
    });
  });

  it('keeps UNKNOWN acquisition evidence out of current-chunk guidance', async () => {
    const incomplete = sources();
    incomplete.acquisition.rules[0].coverage = 'UNKNOWN';
    incomplete.acquisition.provenanceCatalog[0].coverage = 'UNKNOWN';

    expect((await evaluateRuneProof({ goal }, snapshot(), incomplete)).status)
      .toBe('UNKNOWN');
  });

  it('returns UNKNOWN for a synthetic non-item goal when the acquisition corpus is unavailable', async () => {
    const unavailable = sources();
    clearRules(unavailable);
    unavailable.acquisition.acquisitionCoverage = 'UNKNOWN';
    Object.keys(unavailable.acquisition.sourceFamilyCoverage).forEach(key => {
      const family = key as keyof typeof unavailable.acquisition.sourceFamilyCoverage;
      unavailable.acquisition.sourceFamilyCoverage[family] = 'UNKNOWN';
      unavailable.acquisition.sourceFamilyAccounting[family].coverage = 'UNKNOWN';
    });
    const nonItemGoal: CompiledGoal = {
      id: 'quest:verified-empty',
      kind: 'QUEST',
      label: 'Verified empty',
      requirement: { op: 'ALL', terms: [] },
      coverage: 'VERIFIED',
      provenanceIds: ['quest-audit:verified-empty'],
      sourceVersion: 'verified-empty-v1',
    };

    expect((await evaluateRuneProof({ goal: nonItemGoal }, snapshot(), unavailable)).status)
      .toBe('UNKNOWN');
  });

  it('honors custom Lumbridge-only territory when evaluating an acquisition route', async () => {
    const mappedSources = (): RuneProofEngineSources => {
      const document = sources();
      document.locationGraph.nodes[0].surfaceChunk = '50,50';
      document.locationGraph.nodes[1].surfaceChunk = '50,52';
      return document;
    };
    const custom = snapshot({
      gameModeId: 'custom',
      modeRules: customModeRules({ startArea: 'lumbridge' }),
      unlockedChunks: [],
    });

    expect((await evaluateRuneProof({ goal }, custom, mappedSources())).status)
      .toBe('IMPOSSIBLE');
    expect((await evaluateRuneProof(
      { goal },
      { ...custom, unlockedAreas: ['Varrock'] },
      mappedSources(),
    )).status).toBe('OBTAINABLE');
  });

  it('uses known requirements from an incomplete quest as guidance without claiming a proof', async () => {
    const incompleteQuest: CompiledGoal = {
      id: 'quest:known-requirements',
      kind: 'QUEST',
      label: 'Known requirements',
      requirement: {
        op: 'FACT',
        fact: { id: 'unlock:quest-start', kind: 'UNLOCK', label: 'Quest start' },
      },
      coverage: 'UNKNOWN',
      provenanceIds: ['quest-audit:incomplete'],
      sourceVersion: 'incomplete-quest-v1',
    };

    const blocked = await evaluateRuneProof({ goal: incompleteQuest }, snapshot(), sources());
    expect(blocked).toMatchObject({
      status: 'BLOCKED',
      coverage: 'PARTIAL',
      routesComplete: false,
      blockers: [{ factIds: ['unlock:quest-start'], labels: ['Quest start'] }],
      unavoidableBlockerFactIds: [],
      explanation: expect.stringMatching(/known requirements/i),
    });

    const ready = await evaluateRuneProof(
      { goal: incompleteQuest },
      snapshot({ unlockedAreas: ['Quest start'] }),
      sources(),
    );
    expect(ready).toMatchObject({
      status: 'OBTAINABLE',
      coverage: 'PARTIAL',
      routesComplete: false,
      explanation: expect.stringMatching(/known requirements/i),
    });
    expect(ready.routes[0].witness.proofHash).not.toMatch(/^sha256-/);
  });

  it('uses incomplete production goals only when they contain modeled requirements', async () => {
    const activity = compileProductionActivityGoals().find(candidate =>
      candidate.requirement.op === 'ALL' && candidate.requirement.terms.length === 0);
    const diary = compileProductionDiaryGoals().find(candidate =>
      candidate.label === 'Ardougne Easy');
    expect(activity).toBeDefined();
    expect(diary).toBeDefined();
    const manualQuest: CompiledGoal = {
      id: 'quest:manual-demo',
      kind: 'QUEST',
      label: 'Manual demo',
      requirement: { op: 'ALL', terms: [] },
      coverage: 'UNKNOWN',
      provenanceIds: ['unstructured:manual-demo'],
      sourceVersion: 'manual-demo-v1',
    };
    const ready = snapshot({
      skillCaps: { Thieving: 1 },
      currentLevels: { Thieving: 5 },
      completedQuests: ['Rune Mysteries', 'Plague City'],
    });

    for (const emptyDefinition of [activity!, manualQuest]) {
      expect((await evaluateRuneProof({ goal: emptyDefinition }, ready, sources())).status)
        .toBe('UNKNOWN');
    }
    expect(await evaluateRuneProof({ goal: diary! }, ready, sources()))
      .toMatchObject({
        status: 'OBTAINABLE',
        coverage: 'PARTIAL',
        routesComplete: false,
        explanation: expect.stringMatching(/known requirements/i),
      });
  });

  it('treats malformed source data as UNKNOWN', async () => {
    const malformed = sources() as unknown as RuneProofEngineSources;
    malformed.acquisition.rules = [{ id: 'bad' }] as never;
    expect((await evaluateRuneProof({ goal }, snapshot(), malformed)).status).toBe('UNKNOWN');
  });
  it('evaluates a compiled quest requirement through a synthetic current-run goal rule', async () => {
    const questGoal = {
      id: 'quest:demo-quest', kind: 'QUEST', label: 'Demo Quest', coverage: 'VERIFIED',
      provenanceIds: [], sourceVersion: 'goal-a',
      requirement: { op: 'ALL', terms: [{ op: 'FACT', fact: { id: 'skill-level:magic', kind: 'SKILL_LEVEL', label: 'Magic', quantity: 12 } }] },
    } as unknown as import('./goalCompiler').CompiledGoal;
    const document = sources();
    clearRules(document);
    const result = await evaluateRuneProof({ goal: questGoal }, snapshot({
      skillCaps: { Magic: 2 },
      currentLevels: { Magic: 12 },
    }), document);
    expect(result.status).toBe('OBTAINABLE');
    expect(result.goalId).toBe('quest:demo-quest');
  });
  it('treats a VERIFIED source document with unresolved sources as malformed', async () => {
    const contradictory = sources();
    contradictory.acquisition.unresolvedSources = [{ id: 'unresolved:plank:deadbeef' }] as never;
    contradictory.acquisition.counts.unresolvedSources = 1;
    expect((await evaluateRuneProof({ goal }, snapshot(), contradictory)).status).toBe('UNKNOWN');
  });
  it('rejects family accounting IDs assigned to the wrong source family', async () => {
    const misassigned = sources();
    const spawn = misassigned.acquisition.sourceFamilyAccounting.SPAWN;
    const shop = misassigned.acquisition.sourceFamilyAccounting.SHOP;
    spawn.ruleIds = ['plank-stranded'];
    spawn.ruleCount = 1;
    shop.ruleIds = ['plank-direct'];
    shop.ruleCount = 1;
    expect((await evaluateRuneProof({ goal }, snapshot(), misassigned)).status).toBe('UNKNOWN');
  });
  it('rejects duplicate family accounting IDs', async () => {
    const duplicated = sources();
    const spawn = duplicated.acquisition.sourceFamilyAccounting.SPAWN;
    spawn.ruleIds = [...spawn.ruleIds, 'plank-direct'];
    spawn.ruleCount = 3;
    expect((await evaluateRuneProof({ goal }, snapshot(), duplicated)).status).toBe('UNKNOWN');
  });
  it('rejects payloads on provenance kinds that do not permit them', async () => {
    const malformed = sources();
    malformed.acquisition.provenanceCatalog[0].payload = {
      type: 'RULE',
    } as never;
    expect((await evaluateRuneProof({ goal }, snapshot(), malformed)).status).toBe('UNKNOWN');
  });
  it('uses the in-process engine with identical results when a Worker is unavailable', async () => {
    const document = sources();
    const inProcess = createRuneProofEngine(document);
    const selected = createRuneProofExecutor(document);
    expect(await selected.evaluate({ goal }, snapshot())).toEqual(await inProcess.evaluate({ goal }, snapshot()));
  });
});
function clearRules(document: RuneProofEngineSources): void {
  document.acquisition.rules = [];
  document.acquisition.counts.rules = 0;
  document.acquisition.provenanceCatalog = [];
  Object.values(document.acquisition.sourceFamilyAccounting)
    .forEach(accounting => {
      accounting.ruleCount = 0;
      accounting.ruleIds = [];
    });
}

function customModeRules(
  overrides: Partial<GameModeRules> = {},
): Readonly<GameModeRules> {
  return Object.freeze({
    pityEnabled: true,
    pityThreshold: 50,
    omniChanceBase: 2,
    ritualCostMultiplier: 1,
    regionModifiers: false,
    bankLocks: true,
    ...overrides,
  });
}
