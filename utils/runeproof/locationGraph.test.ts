import { beforeAll, describe, expect, it, vi } from 'vitest';
import fullChunkContent from '../../public/chunk-content.json';
import { chunkContentService } from '../../services/ChunkContentService';
import type { RuneProofRunSnapshot } from '../../types';
import { factId, type RequirementExpr } from './model';
import {
  calculateReachability,
  type LocationEdgeSource,
  type LocationGraph,
  type LocationNodeSource,
} from './locationGraph';

const noRequirements: RequirementExpr = { op: 'ALL', terms: [] };

const snapshot = (
  unlockedChunks: readonly string[],
  completedQuests: readonly string[] = [],
): RuneProofRunSnapshot => ({
  runId: 'run-1',
  runRevision: 1,
  gameModeId: 'chunked',
  equipmentTiers: {},
  skillCaps: {},
  currentLevels: {},
  unlockedAreas: [],
  unlockedChunks,
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
  completedQuests,
  completedDiaries: [],
  completedCombatAchievements: [],
  completedTasks: [],
  collectionLog: {},
});

const node = (
  id: string,
  surfaceChunk: string,
  overrides: Partial<LocationNodeSource> = {},
): LocationNodeSource => ({
  id,
  label: id,
  surfaceChunk,
  coverage: 'VERIFIED',
  ...overrides,
});

const edge = (
  id: string,
  from: string,
  to: string,
  overrides: Partial<LocationEdgeSource> = {},
): LocationEdgeSource => ({
  id,
  from,
  to,
  requirements: noRequirements,
  bidirectional: false,
  provenanceIds: [`audit:${id}`],
  ...overrides,
});

const graph = (
  nodes: readonly LocationNodeSource[],
  edges: readonly LocationEdgeSource[],
  startNodeId = 'home',
): LocationGraph => ({ startNodeId, nodes, edges });

describe('calculateReachability', () => {
  it('reaches two adjacent unlocked surface chunks from the start', () => {
    const result = calculateReachability(
      graph(
        [node('home', '50,50'), node('east', '51,50')],
        [edge('walk-east', 'home', 'east', { bidirectional: true })],
      ),
      snapshot(['50,50', '51,50']),
    );

    expect([...result.reachable]).toEqual(['home', 'east']);
    expect([...result.strandedSurfaceChunks]).toEqual([]);
    expect(result.distance.get('east')).toBe(1);
    expect(result.predecessorEdge.get('east')).toBe('walk-east');
    expect(result.coverage).toBe('VERIFIED');
  });

  it('reports an unlocked disconnected surface chunk as stranded', () => {
    const result = calculateReachability(
      graph([node('home', '50,50'), node('island', '60,60')], []),
      snapshot(['50,50', '60,60']),
    );

    expect([...result.reachable]).toEqual(['home']);
    expect([...result.strandedSurfaceChunks]).toEqual(['60,60']);
  });

  it('enters a dungeon only through its reachable entrance and satisfied gate', () => {
    const enterDungeon = edge('enter-dungeon', 'home', 'dungeon', {
      requirements: {
        op: 'FACT',
        fact: {
          id: factId('QUEST', 'Dragon Slayer I'),
          kind: 'QUEST',
          label: 'Dragon Slayer I',
        },
      },
    });
    const fixture = graph(
      [
        node('home', '50,50'),
        node('dungeon', '50,50', { parentId: 'home' }),
      ],
      [enterDungeon],
    );

    expect(calculateReachability(
      fixture,
      snapshot(['50,50']),
    ).reachable.has('dungeon')).toBe(false);
    expect(calculateReachability(
      fixture,
      snapshot(['50,50'], ['Dragon Slayer I']),
    ).reachable.has('dungeon')).toBe(true);
  });

  it('does not require a child interior coordinate to be separately unlocked', () => {
    const result = calculateReachability(
      graph(
        [
          node('home', '50,50'),
          node('cellar', '999,999', { parentId: 'home' }),
        ],
        [edge('stairs-down', 'home', 'cellar')],
      ),
      snapshot(['50,50']),
    );

    expect(result.reachable.has('cellar')).toBe(true);
    expect(result.strandedSurfaceChunks.has('999,999')).toBe(false);
  });

  it('keeps an exact boat or teleport edge blocked when its requirements fail', () => {
    const result = calculateReachability(
      graph(
        [node('home', '50,50'), node('island', '60,60')],
        [edge('charter-boat', 'home', 'island', {
          requirements: {
            op: 'FACT',
            fact: {
              id: factId('UNLOCK', 'Charter ships'),
              kind: 'UNLOCK',
              label: 'Charter ships',
            },
          },
        })],
      ),
      snapshot(['50,50', '60,60']),
    );

    expect(result.reachable.has('island')).toBe(false);
    expect([...result.strandedSurfaceChunks]).toEqual(['60,60']);
  });

  it('blocks malformed unaudited edges and degrades coverage to UNKNOWN', () => {
    const missingRequirements = {
      id: 'legacy-teleport',
      from: 'home',
      to: 'island',
      bidirectional: true,
      provenanceIds: [],
    } as unknown as LocationEdgeSource;
    const result = calculateReachability(
      graph(
        [node('home', '50,50'), node('island', '60,60')],
        [missingRequirements],
      ),
      snapshot(['50,50', '60,60']),
    );

    expect(result.reachable.has('island')).toBe(false);
    expect(result.coverage).toBe('UNKNOWN');
  });

  it('blocks an edge with no audited provenance and degrades coverage to UNKNOWN', () => {
    const result = calculateReachability(
      graph(
        [node('home', '50,50'), node('island', '60,60')],
        [edge('unproven-boat', 'home', 'island', { provenanceIds: [] })],
      ),
      snapshot(['50,50', '60,60']),
    );

    expect(result.reachable.has('island')).toBe(false);
    expect(result.coverage).toBe('UNKNOWN');
  });

  it('degrades partial location authoring to UNKNOWN coverage', () => {
    const result = calculateReachability(
      graph(
        [node('home', '50,50'), node('east', '51,50', { coverage: 'PARTIAL' })],
        [edge('walk-east', 'home', 'east')],
      ),
      snapshot(['50,50', '51,50']),
    );

    expect(result.reachable.has('east')).toBe(true);
    expect(result.coverage).toBe('UNKNOWN');
  });
});

describe('proof-grade location source access', () => {
  beforeAll(async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify(fullChunkContent),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )));
    expect(await chunkContentService.init()).toBe(true);
  });

  it('exposes only explicitly audited location nodes and edges', () => {
    expect(chunkContentService.locationNodes()).toEqual([
      {
        id: 'surface:50,50',
        label: 'Lumbridge starting chunk',
        surfaceChunk: '50,50',
        coverage: 'PARTIAL',
      },
    ]);
    expect(chunkContentService.locationEdges()).toEqual([]);
  });
});
