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
  it('indexes and proves the audited Graveyard floor spawn', async () => {
    expect(chunkDocument.chunks['12601']?.i).toContain('Plank');
    expect(goalIndexJson.rules).toContainEqual(expect.objectContaining({
      output: expect.objectContaining({ id: 'item:plank', label: 'Plank' }),
    }));
    const report = await evaluateRuneProof({ goal }, snapshot(), sources);
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
      sourceVersion: 'sha256-11f41a94ae88378d6298776592ad99e5e5c136a3caf22ae4bb929a2473e08b56',
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
      sourceVersion: 'sha256-11f41a94ae88378d6298776592ad99e5e5c136a3caf22ae4bb929a2473e08b56',
      pinnedGoalIds: ['item:plank'],
    });
   expect(summary).toMatchObject({
      goalId: 'item:plank',
      status: 'OBTAINABLE',
      routeLabels: ['Graveyard of Shadows plank spawn'],
      sourceVersion: 'sha256-11f41a94ae88378d6298776592ad99e5e5c136a3caf22ae4bb929a2473e08b56',
      runRevision: 7,
    });
    expect(summary.proofHash)
      .toBe('sha256-f2bce146dc6aa3387fd8c71a1f623a860f1dd262a919188371d00800179124f4');
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
