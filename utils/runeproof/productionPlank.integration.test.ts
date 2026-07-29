import { describe, expect, it } from 'vitest';
import chunkDocumentJson from '../../public/chunk-content.json';
import sourceDocumentJson from '../../public/runeproof-sources.json';
import goalIndexJson from '../../data/runeproof-goal-index.json';
import { loadRuneProofSourceAudit } from '../../data/runeProofSourceAudit';
import type { RuneProofRunSnapshot } from '../../types';
import { RuneProofExportRegistry, RuneProofService } from '../../services/RuneProofService';
import type { RuneProofSourceDocument } from './acquisitionIndex';
import { createRuneProofEngine, evaluateRuneProof, type RuneProofEngineSources } from './engine';
import { compileItemGoal } from './goalCompiler';
import { calculateReachability } from './locationGraph';
import { factId } from './model';
import { verifyProof } from './proof';

const acquisition = sourceDocumentJson as unknown as RuneProofSourceDocument;
const chunkDocument = chunkDocumentJson as unknown as {
  locationNodes: RuneProofEngineSources['locationGraph']['nodes'];
  locationEdges: RuneProofEngineSources['locationGraph']['edges'];
  chunks: Record<string, { i?: string[] }>;
};
const sources: RuneProofEngineSources = {
  sourceVersion: acquisition.sourceVersion,
  sourceAudit: await loadRuneProofSourceAudit(),
  acquisition,
  locationGraph: {
    startNodeId: 'surface:50,50',
    nodes: chunkDocument.locationNodes,
    edges: chunkDocument.locationEdges,
  },
};
const goal = compileItemGoal({ id: 'item:plank', label: 'Plank' }, 1);
const corridor = [
  '50,51', '50,52', '50,53', '50,54',
  '50,55', '49,55', '49,56', '49,57',
];

describe('production RuneProof Plank slice', () => {
  it.each([
    ['node label', (graph: RuneProofEngineSources['locationGraph']) => {
      graph.nodes[0].label += ' tampered';
    }],
    ['edge requirements', (graph: RuneProofEngineSources['locationGraph']) => {
      graph.edges[0].requirements = {
        op: 'FACT',
        fact: {
          id: 'quest:tampered',
          kind: 'QUEST',
          label: 'Tampered',
        },
      };
    }],
    ['edge provenance', (graph: RuneProofEngineSources['locationGraph']) => {
      graph.edges[0].provenanceIds = ['chunk-route:audit:tampered'];
    }],
  ])('fails closed when the runtime %s differs from the exact source identity', async (
    _case,
    mutate,
  ) => {
    const locationGraph = structuredClone(sources.locationGraph);
    mutate(locationGraph);
    const report = await evaluateRuneProof(
      { goal },
      snapshot(),
      { ...sources, locationGraph },
    );

    expect(report.status).toBe('UNKNOWN');
    expect(report.explanation).toContain('location graph identity');
  });

  it('indexes and proves the audited Graveyard floor spawn', async () => {
    expect(chunkDocument.chunks['12601']?.i).toContain('Plank');
    expect(goalIndexJson.rules).toContainEqual(expect.objectContaining({
      output: expect.objectContaining({ id: 'item:plank', label: 'Plank' }),
    }));
    const report = await evaluateRuneProof({ goal }, snapshot(), sources);
    expect(report.explanation).toBeUndefined();
    expect(report).toMatchObject({ status: 'OBTAINABLE' });
    const root = report.routes[0]?.witness.steps.root;
    const replay = await verifyProof({
      witness: report.routes[0].witness,
      rules: new Map(acquisition.rules.map(rule => [rule.id, rule])),
      runFacts: new Set([
        ...sources.locationGraph.nodes.map(node =>
          `${factId('LOCATION', node.id)}@1`),
      ]),
      runId: 'production-plank-run',
      runRevision: 7,
      sourceVersion: 'sha256-2d39e087d9bdcab72f27a0492bf6bc2abf97a33760b17ec84d80f7d8c956b382',
    });

    expect(report.status).toBe('OBTAINABLE');
    expect(root).toMatchObject({
      sourceLabel: 'Graveyard of Shadows plank spawn',
      proves: { id: 'item:plank' },
    });
    expect(replay).toEqual({ valid: true, stale: false, errors: [] });
  });

  it('fails closed when any intermediate current chunk is missing', async () => {
    const missingVarrockPalace = snapshot({
      unlockedChunks: corridor.filter(chunk => chunk !== '50,54'),
    });
    const report = await evaluateRuneProof({ goal }, missingVarrockPalace, sources);
    const reachability = calculateReachability(
      sources.locationGraph,
      missingVarrockPalace,
    );

    expect(report.status).toBe('UNKNOWN');
    expect(report.routes).toEqual([]);
    expect(report.explanation).toContain('50,54');
    expect(report.explanation).toContain('not a complete impossibility claim');
    expect(reachability.reachable.has('surface:49,57')).toBe(false);
    expect(reachability.strandedSurfaceChunks.has('49,57')).toBe(true);
  });

  it('exports the same production route label for RuneLite', async () => {
    const registry = new RuneProofExportRegistry();
    const service = new RuneProofService(
      createRuneProofEngine(sources),
      () => snapshot(),
      registry,
    );
    await service.evaluate({ goal });

    const [summary] = await registry.select({
      runId: 'production-plank-run',
      runRevision: 7,
      sourceVersion: 'sha256-2d39e087d9bdcab72f27a0492bf6bc2abf97a33760b17ec84d80f7d8c956b382',
      pinnedGoalIds: ['item:plank'],
    });
   expect(summary).toMatchObject({
      goalId: 'item:plank',
      status: 'OBTAINABLE',
      routeLabels: ['Graveyard of Shadows plank spawn'],
      sourceVersion: 'sha256-2d39e087d9bdcab72f27a0492bf6bc2abf97a33760b17ec84d80f7d8c956b382',
      runRevision: 7,
    });
    expect(summary.proofHash)
      .toBe('sha256-4c92d010f99e5e1d3742716c57dc8ad5dba679df0de6b60dac412381624c745e');
  });
});

function snapshot(
  overrides: Partial<RuneProofRunSnapshot> = {},
): RuneProofRunSnapshot {
  return {
    runId: 'production-plank-run',
    runRevision: 7,
    gameModeId: 'chunked',
    equipmentTiers: {},
    skillCaps: {},
    currentLevels: {},
    unlockedAreas: [],
    unlockedChunks: corridor,
    unlockedMobility: [],
    unlockedArcana: [],
    unlockedHousing: [],
    unlockedMerchants: [],
    unlockedMinigames: [],
    unlockedBosses: [],
    unlockedStorage: [],
    unlockedGuilds: [],
    unlockedFarming: [],
    unlockedSlayer: [],
    unlockedBanks: [],
    completedQuests: [],
    completedDiaries: [],
    completedCombatAchievements: [],
    completedTasks: [],
    collectionLog: {},
    ...overrides,
  };
}
