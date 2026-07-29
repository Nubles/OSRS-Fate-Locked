import type { RuneProofRunSnapshot } from '../../../types';
import { compileItemGoal, type CompiledGoal } from '../goalCompiler';
import type { RuneProofSourceDocument } from '../acquisitionIndex';
import type { RuneProofEngineSources } from '../engine';
import type { LocationGraph } from '../locationGraph';
import { factId, type AcquisitionRule, type FactKind, type FactRef, type RequirementExpr } from '../model';

const SOURCE_VERSION = 'plank-fixture-v1';
const empty: RequirementExpr = { op: 'ALL', terms: [] };

export interface PlankFixtureOptions {
  readonly rules?: readonly AcquisitionRule[];
  readonly coverage?: 'VERIFIED' | 'PARTIAL';
  readonly snapshot?: Partial<RuneProofRunSnapshot>;
}

export interface PlankFixture {
  readonly goal: CompiledGoal;
  readonly snapshot: RuneProofRunSnapshot;
  readonly sources: RuneProofEngineSources;
  readonly rulesById: () => ReadonlyMap<string, AcquisitionRule>;
  readonly runFacts: () => ReadonlySet<string>;
}

export function createPlankFixture(options: PlankFixtureOptions = {}): PlankFixture {
  const rules = [...(options.rules ?? [
    plankSource('plank-monster-drop', {
      sourceKind: 'DROP', sourceLabel: 'Lumberyard goblin', locationId: 'lumberyard', probability: 0.25,
    }),
    plankSource('plank-town-shop', { sourceKind: 'SHOP', sourceLabel: 'Far town shop', locationId: 'town-shop' }),
    plankSource('plank-construction', {
      sourceKind: 'PRODUCTION', sourceLabel: 'Construction bench', locationId: 'lumberyard',
      requirements: requirement('CAPABILITY', 'Construction'),
    }),
  ])];
  const snapshot = runSnapshot(options.snapshot);
  const sources = engineSources(rules, options.coverage ?? 'VERIFIED');
  return {
    goal: compileItemGoal({ id: 'item:plank', label: 'Plank' }, 1),
    snapshot,
    sources,
    rulesById: () => new Map(rules.map(rule => [rule.id, rule])),
    runFacts: () => new Set([
      'location:home@1',
      'location:lumberyard@1',
      ...snapshot.completedQuests.map(label => `${factId('QUEST', label)}@1`),
    ]),
  };
}

export function plankSource(
  id: string,
  overrides: Partial<AcquisitionRule> = {},
): AcquisitionRule {
  return {
    id,
    output: fact('ITEM', 'Plank'),
    outputQuantity: 1,
    sourceKind: 'DROP',
    sourceLabel: id,
    locationId: 'lumberyard',
    requirements: empty,
    repeatability: 'REPEATABLE',
    probability: 0.25,
    coverage: 'VERIFIED',
    provenanceIds: [`fixture:${id}`],
    ...overrides,
  };
}

export function fact(kind: FactKind, label: string, quantity?: number): FactRef {
  return { id: factId(kind, label), kind, label, ...(quantity === undefined ? {} : { quantity }) };
}

export function requirement(kind: FactKind, label: string, quantity?: number): RequirementExpr {
  return { op: 'FACT', fact: fact(kind, label, quantity) };
}

export const plankLocationGraph: LocationGraph = {
  startNodeId: 'home',
  nodes: [
    { id: 'home', label: 'Home', surfaceChunk: '0,0', coverage: 'VERIFIED' },
    { id: 'lumberyard', label: 'Current lumberyard', surfaceChunk: '1,1', coverage: 'VERIFIED' },
    { id: 'stranded-island', label: 'Stranded island', surfaceChunk: '2,2', coverage: 'VERIFIED' },
    { id: 'town-shop', label: 'Far town shop', surfaceChunk: '3,3', coverage: 'VERIFIED' },
    { id: 'gated-dungeon', label: 'Gated dungeon', surfaceChunk: '1,1', parentId: 'lumberyard', coverage: 'VERIFIED' },
  ],
  edges: [
    { id: 'walk-to-lumberyard', from: 'home', to: 'lumberyard', bidirectional: true, requirements: empty, provenanceIds: ['fixture:walk-to-lumberyard'] },
    { id: 'enter-gated-dungeon', from: 'lumberyard', to: 'gated-dungeon', bidirectional: false, requirements: requirement('QUEST', 'Dungeon access'), provenanceIds: ['fixture:enter-gated-dungeon'] },
  ],
};

function runSnapshot(overrides: Partial<RuneProofRunSnapshot> = {}): RuneProofRunSnapshot {
  return {
    runId: 'plank-run', runRevision: 7, gameModeId: 'chunked', equipmentTiers: {}, skillCaps: {}, currentLevels: {},
    unlockedAreas: [], unlockedChunks: ['1,1'], unlockedMobility: [], unlockedArcana: [], unlockedHousing: [],
    unlockedMerchants: [], unlockedMinigames: [], unlockedBosses: [], unlockedStorage: [], unlockedGuilds: [],
    unlockedFarming: [], unlockedSlayer: [], unlockedBanks: [], completedQuests: [], completedDiaries: [],
    completedCombatAchievements: [], completedTasks: [], collectionLog: {}, ...overrides,
  };
}

function engineSources(
  rules: AcquisitionRule[],
  coverage: 'VERIFIED' | 'PARTIAL',
): RuneProofEngineSources {
  return {
    sourceVersion: SOURCE_VERSION,
    sourceAudit: {
      sourceVersion: SOURCE_VERSION,
      questCoverage: coverage,
      chunkCoverage: coverage,
      acquisitionCoverage: coverage,
    },
    locationGraph: plankLocationGraph,
    acquisition: sourceDocument(rules, coverage),
  };
}

function sourceDocument(
  rules: AcquisitionRule[],
  coverage: 'VERIFIED' | 'PARTIAL',
): RuneProofSourceDocument {
  const families = ['DROP', 'PRODUCTION', 'RESOURCE_ENGINE', 'SHOP', 'SPAWN'] as const;
  const sourceFamilyCoverage = Object.fromEntries(families.map(family => [family, coverage])) as RuneProofSourceDocument['sourceFamilyCoverage'];
  const sourceFamilyAccounting = Object.fromEntries(families.map(family => {
    const familyRules = rules.filter(rule => rule.sourceKind === family);
    return [family, { ruleCount: familyRules.length, unresolvedCount: 0, ruleIds: familyRules.map(rule => rule.id), unresolvedIds: [], coverage }];
  })) as RuneProofSourceDocument['sourceFamilyAccounting'];
  const provenanceCatalog = [...new Set(rules.flatMap(rule =>
    rule.provenanceIds))].sort().map(id => ({
      id,
      kind: 'UNKNOWN' as const,
      coverage,
      ruleIds: rules.filter(rule => rule.provenanceIds.includes(id))
        .map(rule => rule.id),
      unresolvedIds: [],
    }));
  return {
    schemaVersion: 1,
    sourceVersion: SOURCE_VERSION,
    counts: { rules: rules.length, unresolvedSources: 0 },
    acquisitionCoverage: coverage,
    sourceFamilyCoverage,
    sourceFamilyAccounting,
    provenanceCatalog,
    rules,
    unresolvedSources: [],
  };
}
