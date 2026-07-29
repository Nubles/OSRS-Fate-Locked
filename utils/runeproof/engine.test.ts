import { describe, expect, it } from 'vitest';
import type { RuneProofRunSnapshot } from '../../types';
import { compileItemGoal } from './goalCompiler';
import { createRuneProofEngine, createRuneProofExecutor, evaluateRuneProof, type RuneProofEngineSources } from './engine';

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
    sourceFamilyAccounting: { DROP: { ruleCount: 1, unresolvedCount: 0, ruleIds: ['plank-direct'], unresolvedIds: [], coverage }, PRODUCTION: { ruleCount: 0, unresolvedCount: 0, ruleIds: [], unresolvedIds: [], coverage }, RESOURCE_ENGINE: { ruleCount: 0, unresolvedCount: 0, ruleIds: [], unresolvedIds: [], coverage }, SHOP: { ruleCount: 0, unresolvedCount: 0, ruleIds: [], unresolvedIds: [], coverage }, SPAWN: { ruleCount: 1, unresolvedCount: 0, ruleIds: ['plank-stranded'], unresolvedIds: [], coverage } },
    provenanceCatalog: [],
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

  it('allows a verified positive witness under global PARTIAL coverage but gates a negative result as UNKNOWN', async () => {
    expect((await evaluateRuneProof({ goal }, snapshot(), sources('PARTIAL'))).status).toBe('OBTAINABLE');
    const noRoutes = sources('PARTIAL');
    noRoutes.acquisition.rules = [];
    noRoutes.acquisition.counts.rules = 0;
    expect((await evaluateRuneProof({ goal }, snapshot(), noRoutes)).status).toBe('UNKNOWN');
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
    document.acquisition.rules = [];
    document.acquisition.counts.rules = 0;
    const result = await evaluateRuneProof({ goal: questGoal }, snapshot({ currentLevels: { Magic: 12 } }), document);
    expect(result.status).toBe('OBTAINABLE');
    expect(result.goalId).toBe('quest:demo-quest');
  });
  it('treats a VERIFIED source document with unresolved sources as malformed', async () => {
    const contradictory = sources();
    contradictory.acquisition.unresolvedSources = [{ id: 'unresolved:plank:deadbeef' }] as never;
    contradictory.acquisition.counts.unresolvedSources = 1;
    expect((await evaluateRuneProof({ goal }, snapshot(), contradictory)).status).toBe('UNKNOWN');
  });
  it('uses the in-process engine with identical results when a Worker is unavailable', async () => {
    const document = sources();
    const inProcess = createRuneProofEngine(document);
    const selected = createRuneProofExecutor(document);
    expect(await selected.evaluate({ goal }, snapshot())).toEqual(await inProcess.evaluate({ goal }, snapshot()));
  });
});
