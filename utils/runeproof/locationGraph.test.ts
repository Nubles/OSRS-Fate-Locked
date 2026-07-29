import { beforeAll, describe, expect, it, vi } from 'vitest';
import fullChunkContent from '../../public/chunk-content.json';
import { chunkContentService } from '../../services/ChunkContentService';
import type { RuneProofRunSnapshot } from '../../types';
import type { GameModeRules } from '../../config/gameModes';
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
  overrides: Partial<RuneProofRunSnapshot> = {},
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
  ...overrides,
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

  it('uses unlocked regions outside Chunked mode but never as a Chunked substitute', () => {
    const world = graph(
      [node('home', '50,50'), node('al-kharid', '51,50')],
      [edge('walk-east', 'home', 'al-kharid')],
    );
    const standard = calculateReachability(world, snapshot([], [], {
      gameModeId: 'vanilla',
      unlockedAreas: ['Al Kharid'],
    }));
    const chunked = calculateReachability(world, snapshot([], [], {
      gameModeId: 'chunked',
      unlockedAreas: ['Al Kharid'],
    }));

    expect([...standard.reachable]).toContain('al-kharid');
    expect([...chunked.reachable]).not.toContain('al-kharid');
  });

  it('honors custom Lumbridge-only and no-free-area starts', () => {
    const world = graph(
      [node('home', '50,50'), node('varrock', '50,52')],
      [edge('walk-north', 'home', 'varrock')],
    );
    const lumbridgeOnly = calculateReachability(world, snapshot([], [], {
      gameModeId: 'custom',
      modeRules: customModeRules({ startArea: 'lumbridge' }),
    }));
    const noFreeArea = calculateReachability(world, snapshot([], [], {
      gameModeId: 'custom',
      modeRules: customModeRules({ startArea: 'none' }),
    }));
    const explicitlyUnlocked = calculateReachability(world, snapshot([], [], {
      gameModeId: 'custom',
      modeRules: customModeRules({ startArea: 'none' }),
      unlockedAreas: ['Lumbridge', 'Varrock'],
    }));

    expect([...lumbridgeOnly.reachable]).toEqual(['home']);
    expect([...noFreeArea.reachable]).toEqual([]);
    expect([...explicitlyUnlocked.reachable]).toEqual(['home', 'varrock']);
  });

  it('uses exact chunks for a custom chunk-granularity policy', () => {
    const world = graph(
      [node('home', '50,50'), node('varrock', '50,52')],
      [edge('walk-north', 'home', 'varrock')],
    );
    const namedOnly = calculateReachability(world, snapshot([], [], {
      gameModeId: 'custom',
      modeRules: customModeRules({ startArea: 'none', chunkGranularity: true }),
      unlockedAreas: ['Varrock'],
    }));
    const exactChunk = calculateReachability(world, snapshot(['50,52'], [], {
      gameModeId: 'custom',
      modeRules: customModeRules({ startArea: 'none', chunkGranularity: true }),
      unlockedAreas: ['Varrock'],
    }));

    expect([...namedOnly.reachable]).toEqual(['home']);
    expect([...exactChunk.reachable]).toEqual(['home', 'varrock']);
  });

  it('enforces effective skill caps on a gated child-location edge', () => {
    const dungeon = graph(
      [
        node('home', '50,50'),
        node('dungeon', '50,50', { parentId: 'home' }),
      ],
      [edge('enter-dungeon', 'home', 'dungeon', {
        requirements: {
          op: 'FACT',
          fact: {
            id: factId('SKILL_LEVEL', 'Agility'),
            kind: 'SKILL_LEVEL',
            label: 'Agility',
            quantity: 42,
          },
        },
      })],
    );

    expect(calculateReachability(dungeon, snapshot([], [], {
      skillCaps: { Agility: 1 },
      currentLevels: { Agility: 99 },
    })).reachable.has('dungeon')).toBe(false);
    expect(calculateReachability(dungeon, snapshot([], [], {
      skillCaps: { Agility: 10 },
      currentLevels: { Agility: 99 },
    })).reachable.has('dungeon')).toBe(true);
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

  it.each([
    {
      name: 'non-object node',
      fixture: graph(
        [node('home', '50,50'), null as unknown as LocationNodeSource],
        [],
      ),
    },
    {
      name: 'empty node id',
      fixture: graph(
        [node('home', '50,50'), node('', '51,50')],
        [edge('walk', 'home', '')],
      ),
    },
    {
      name: 'duplicate node id',
      fixture: graph(
        [node('home', '50,50'), node('target', '51,50'), node('target', '52,50')],
        [edge('walk', 'home', 'target')],
      ),
    },
    {
      name: 'empty node label',
      fixture: graph(
        [node('home', '50,50'), node('target', '51,50', { label: '' })],
        [edge('walk', 'home', 'target')],
      ),
    },
    {
      name: 'invalid node coverage',
      fixture: graph(
        [
          node('home', '50,50'),
          node('target', '51,50', { coverage: 'COMPLETE' as 'VERIFIED' }),
        ],
        [edge('walk', 'home', 'target')],
      ),
    },
    {
      name: 'invalid surface chunk',
      fixture: graph(
        [node('home', '50,50'), node('target', 'not-a-chunk')],
        [edge('walk', 'home', 'target')],
      ),
    },
    {
      name: 'non-string parent',
      fixture: graph(
        [node('home', '50,50'), node('target', '51,50', {
          parentId: 42 as unknown as string,
        })],
        [edge('enter', 'home', 'target')],
      ),
    },
    {
      name: 'missing parent',
      fixture: graph(
        [node('home', '50,50'), node('target', '51,50', { parentId: 'missing' })],
        [edge('enter', 'home', 'target')],
      ),
    },
    {
      name: 'cyclic parent chain',
      fixture: graph(
        [
          node('home', '50,50'),
          node('target', '51,50', { parentId: 'nested' }),
          node('nested', '51,50', { parentId: 'target' }),
        ],
        [edge('enter', 'home', 'target')],
      ),
    },
    {
      name: 'empty edge id',
      fixture: graph(
        [node('home', '50,50'), node('target', '51,50')],
        [edge('', 'home', 'target')],
      ),
    },
    {
      name: 'duplicate edge id',
      fixture: graph(
        [node('home', '50,50'), node('target', '51,50')],
        [edge('walk', 'home', 'target'), edge('walk', 'home', 'target')],
      ),
    },
    {
      name: 'dangling endpoint',
      fixture: graph(
        [node('home', '50,50'), node('target', '51,50')],
        [edge('walk', 'home', 'missing')],
      ),
    },
    {
      name: 'dangling source endpoint',
      fixture: graph(
        [node('home', '50,50'), node('target', '51,50')],
        [edge('walk', 'missing', 'target')],
      ),
    },
    {
      name: 'non-boolean direction',
      fixture: graph(
        [node('home', '50,50'), node('target', '51,50')],
        [edge('walk', 'home', 'target', {
          bidirectional: 'yes' as unknown as boolean,
        })],
      ),
    },
    {
      name: 'malformed requirement expression',
      fixture: graph(
        [node('home', '50,50'), node('target', '51,50')],
        [edge('walk', 'home', 'target', {
          requirements: { op: 'NONE' } as unknown as RequirementExpr,
        })],
      ),
    },
    {
      name: 'malformed provenance id',
      fixture: graph(
        [node('home', '50,50'), node('target', '51,50')],
        [edge('walk', 'home', 'target', {
          provenanceIds: [42 as unknown as string],
        })],
      ),
    },
  ])('blocks affected traversal for malformed $name authoring', ({ fixture }) => {
    expect(() => calculateReachability(
      fixture,
      snapshot(['50,50', '51,50', '52,50']),
    )).not.toThrow();

    const result = calculateReachability(
      fixture,
      snapshot(['50,50', '51,50', '52,50']),
    );
    expect([...result.reachable]).toEqual(['home']);
    expect(result.coverage).toBe('UNKNOWN');
  });

  it.each([
    {
      name: 'nodes collection',
      fixture: { startNodeId: 'home', nodes: null, edges: [] } as unknown as LocationGraph,
      reachable: [],
    },
    {
      name: 'edges collection',
      fixture: {
        startNodeId: 'home',
        nodes: [node('home', '50,50')],
        edges: null,
      } as unknown as LocationGraph,
      reachable: ['home'],
    },
    {
      name: 'start node id',
      fixture: graph([node('home', '50,50')], [], ''),
      reachable: [],
    },
    {
      name: 'child start node',
      fixture: graph(
        [node('home', '50,50'), node('child', '50,50', { parentId: 'home' })],
        [],
        'child',
      ),
      reachable: [],
    },
  ])('rejects malformed graph $name without throwing', ({ fixture, reachable }) => {
    expect(() => calculateReachability(fixture, snapshot(['50,50']))).not.toThrow();
    const result = calculateReachability(fixture, snapshot(['50,50']));
    expect([...result.reachable]).toEqual(reachable);
    expect(result.coverage).toBe('UNKNOWN');
  });
  it('blocks child entry from a reachable node other than its declared parent', () => {
    const result = calculateReachability(
      graph(
        [
          node('home', '50,50'),
          node('other', '51,50'),
          node('dungeon', '50,50', { parentId: 'home' }),
        ],
        [
          edge('walk-other', 'home', 'other'),
          edge('wrong-entrance', 'other', 'dungeon'),
        ],
      ),
      snapshot(['50,50', '51,50']),
    );

    expect(result.reachable.has('other')).toBe(true);
    expect(result.reachable.has('dungeon')).toBe(false);
    expect(result.coverage).toBe('UNKNOWN');
  });

  it('reaches nested children through each exact declared parent', () => {
    const result = calculateReachability(
      graph(
        [
          node('home', '50,50'),
          node('dungeon', '999,999', { parentId: 'home' }),
          node('chamber', '998,998', { parentId: 'dungeon' }),
        ],
        [
          edge('enter-dungeon', 'home', 'dungeon'),
          edge('enter-chamber', 'dungeon', 'chamber'),
        ],
      ),
      snapshot(['50,50']),
    );

    expect([...result.reachable]).toEqual(['home', 'dungeon', 'chamber']);
    expect(result.distance.get('chamber')).toBe(2);
    expect(result.coverage).toBe('VERIFIED');
  });

  it('preserves parallel routes when one requirement is blocked and another passes', () => {
    const result = calculateReachability(
      graph(
        [node('home', '50,50'), node('target', '51,50')],
        [
          edge('blocked-route', 'home', 'target', {
            requirements: {
              op: 'FACT',
              fact: {
                id: factId('QUEST', 'Missing Quest'),
                kind: 'QUEST',
                label: 'Missing Quest',
              },
            },
          }),
          edge('passing-route', 'home', 'target'),
        ],
      ),
      snapshot(['50,50', '51,50']),
    );

    expect(result.reachable.has('target')).toBe(true);
    expect(result.predecessorEdge.get('target')).toBe('passing-route');
    expect(result.coverage).toBe('VERIFIED');
  });

  it('chooses the lowest stable edge id when parallel routes both pass', () => {
    const result = calculateReachability(
      graph(
        [node('home', '50,50'), node('target', '51,50')],
        [
          edge('z-route', 'home', 'target'),
          edge('a-route', 'home', 'target'),
        ],
      ),
      snapshot(['50,50', '51,50']),
    );

    expect(result.reachable.has('target')).toBe(true);
    expect(result.predecessorEdge.get('target')).toBe('a-route');
    expect(result.coverage).toBe('VERIFIED');
  });

  it('allows bidirectional nested child edges in both authored directions', () => {
    const locations = [
      node('home', '50,50'),
      node('dungeon', '999,999', { parentId: 'home' }),
      node('chamber', '998,998', { parentId: 'dungeon' }),
    ];
    const fixtures = [
      graph(locations, [
        edge('home-door', 'home', 'dungeon', { bidirectional: true }),
        edge('chamber-door', 'dungeon', 'chamber', { bidirectional: true }),
      ]),
      graph(locations, [
        edge('home-door', 'dungeon', 'home', { bidirectional: true }),
        edge('chamber-door', 'chamber', 'dungeon', { bidirectional: true }),
      ]),
    ];

    for (const fixture of fixtures) {
      const result = calculateReachability(fixture, snapshot(['50,50']));
      expect([...result.reachable]).toEqual(['home', 'dungeon', 'chamber']);
      expect(result.predecessorEdge.get('dungeon')).toBe('home-door');
      expect(result.predecessorEdge.get('chamber')).toBe('chamber-door');
      expect(result.coverage).toBe('VERIFIED');
    }
  });

  it('rejects a bidirectional sibling-to-sibling shortcut', () => {
    const result = calculateReachability(
      graph(
        [
          node('home', '50,50'),
          node('dungeon', '999,999', { parentId: 'home' }),
          node('sibling', '998,998', { parentId: 'home' }),
        ],
        [
          edge('enter-dungeon', 'home', 'dungeon'),
          edge('sibling-shortcut', 'dungeon', 'sibling', { bidirectional: true }),
        ],
      ),
      snapshot(['50,50']),
    );

    expect(result.reachable.has('dungeon')).toBe(true);
    expect(result.reachable.has('sibling')).toBe(false);
    expect(result.coverage).toBe('UNKNOWN');
  });
  it('traverses a bidirectional edge in reverse', () => {
    const result = calculateReachability(
      graph(
        [node('home', '50,50'), node('east', '51,50')],
        [edge('walk', 'home', 'east', { bidirectional: true })],
        'east',
      ),
      snapshot(['50,50', '51,50']),
    );

    expect([...result.reachable]).toEqual(['east', 'home']);
    expect(result.predecessorEdge.get('home')).toBe('walk');
  });

  it('does not traverse a one-way edge in reverse', () => {
    const result = calculateReachability(
      graph(
        [node('home', '50,50'), node('east', '51,50')],
        [edge('walk', 'home', 'east')],
        'east',
      ),
      snapshot(['50,50', '51,50']),
    );

    expect([...result.reachable]).toEqual(['east']);
    expect([...result.strandedSurfaceChunks]).toEqual(['50,50']);
  });

  it('satisfies non-empty ALL and ANY expressions from snapshot facts', () => {
    const quest = {
      op: 'FACT' as const,
      fact: {
        id: factId('QUEST', 'Dragon Slayer I'),
        kind: 'QUEST' as const,
        label: 'Dragon Slayer I',
      },
    };
    const guild = {
      op: 'FACT' as const,
      fact: {
        id: factId('UNLOCK', 'Heroes Guild'),
        kind: 'UNLOCK' as const,
        label: 'Heroes Guild',
      },
    };
    const result = calculateReachability(
      graph(
        [node('home', '50,50'), node('all', '51,50'), node('any', '52,50')],
        [
          edge('all-gate', 'home', 'all', {
            requirements: { op: 'ALL', terms: [quest, guild] },
          }),
          edge('any-gate', 'home', 'any', {
            requirements: {
              op: 'ANY',
              terms: [
                {
                  op: 'FACT',
                  fact: {
                    id: factId('QUEST', 'Missing Quest'),
                    kind: 'QUEST',
                    label: 'Missing Quest',
                  },
                },
                guild,
              ],
            },
          }),
        ],
      ),
      snapshot(['50,50', '51,50', '52,50'], ['Dragon Slayer I'], {
        unlockedGuilds: ['Heroes Guild'],
      }),
    );

    expect(result.reachable.has('all')).toBe(true);
    expect(result.reachable.has('any')).toBe(true);
    const missingAllTerm = calculateReachability(
      graph(
        [node('home', '50,50'), node('all', '51,50')],
        [edge('all-gate', 'home', 'all', {
          requirements: { op: 'ALL', terms: [quest, guild] },
        })],
      ),
      snapshot(['50,50', '51,50'], ['Dragon Slayer I']),
    );
    expect(missingAllTerm.reachable.has('all')).toBe(false);
  });

  it('applies the SKILL_LEVEL boundary exactly', () => {
    const fixture = graph(
      [node('home', '50,50'), node('guild', '51,50')],
      [edge('skill-gate', 'home', 'guild', {
        requirements: {
          op: 'FACT',
          fact: {
            id: factId('SKILL_LEVEL', 'Agility'),
            kind: 'SKILL_LEVEL',
            label: 'Agility',
            quantity: 42,
          },
        },
      })],
    );

    expect(calculateReachability(
      fixture,
      snapshot(['50,50', '51,50'], [], {
        skillCaps: { Agility: 5 },
        currentLevels: { Agility: 41 },
      }),
    ).reachable.has('guild')).toBe(false);
    expect(calculateReachability(
      fixture,
      snapshot(['50,50', '51,50'], [], {
        skillCaps: { Agility: 5 },
        currentLevels: { Agility: 42 },
      }),
    ).reachable.has('guild')).toBe(true);
  });

  it('satisfies UNLOCK and CAPABILITY facts from their exact snapshot domains', () => {
    const result = calculateReachability(
      graph(
        [node('home', '50,50'), node('guild', '51,50'), node('fairy-ring', '52,50')],
        [
          edge('guild-gate', 'home', 'guild', {
            requirements: {
              op: 'FACT',
              fact: {
                id: factId('UNLOCK', 'Heroes Guild'),
                kind: 'UNLOCK',
                label: 'Heroes Guild',
              },
            },
          }),
          edge('fairy-ring-gate', 'home', 'fairy-ring', {
            requirements: {
              op: 'FACT',
              fact: {
                id: factId('CAPABILITY', 'Fairy rings'),
                kind: 'CAPABILITY',
                label: 'Fairy rings',
              },
            },
          }),
        ],
      ),
      snapshot(['50,50', '51,50', '52,50'], [], {
        unlockedGuilds: ['Heroes Guild'],
        unlockedMobility: ['Fairy rings'],
      }),
    );

    expect(result.reachable.has('guild')).toBe(true);
    expect(result.reachable.has('fairy-ring')).toBe(true);
  });

  it('fails ITEM and LOCATION requirements closed', () => {
    const result = calculateReachability(
      graph(
        [node('home', '50,50'), node('item-target', '51,50'), node('location-target', '52,50')],
        [
          edge('item-gate', 'home', 'item-target', {
            requirements: {
              op: 'FACT',
              fact: {
                id: factId('ITEM', 'Coins'),
                kind: 'ITEM',
                label: 'Coins',
              },
            },
          }),
          edge('location-gate', 'home', 'location-target', {
            requirements: {
              op: 'FACT',
              fact: {
                id: factId('LOCATION', 'Varrock'),
                kind: 'LOCATION',
                label: 'Varrock',
              },
            },
          }),
        ],
      ),
      snapshot(['50,50', '51,50', '52,50']),
    );

    expect(result.reachable.has('item-target')).toBe(false);
    expect(result.reachable.has('location-target')).toBe(false);
  });
  it('strands every unauthored owned chunk and degrades coverage to UNKNOWN', () => {
    const result = calculateReachability(
      graph([node('home', '50,50')], []),
      snapshot(['50,50', '70,70']),
    );

    expect([...result.reachable]).toEqual(['home']);
    expect([...result.strandedSurfaceChunks]).toEqual(['70,70']);
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

const serviceEdge = edge('audited-test-edge', 'surface:50,50', 'surface:51,50', {
  requirements: { op: 'ALL', terms: [] },
  provenanceIds: ['audit:test-edge'],
});




describe('proof-grade location source access', () => {
  beforeAll(async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({
        ...fullChunkContent,
        locationEdges: [serviceEdge],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )));
    expect(await chunkContentService.init()).toBe(true);
  });

  it('exposes only explicitly audited location nodes and edges', () => {
    expect(chunkContentService.locationNodes())
      .toEqual(fullChunkContent.locationNodes);
    expect(chunkContentService.locationEdges()).toEqual([serviceEdge]);
  });

  it('returns defensive deep copies that caller mutation cannot corrupt', () => {
    const firstNodes = chunkContentService.locationNodes();
    const firstEdges = chunkContentService.locationEdges();
    firstNodes[0].coverage = 'UNKNOWN';
    firstNodes.push(node('injected', '51,50'));
    firstEdges[0].id = 'mutated';
    firstEdges[0].provenanceIds.push('mutated:source');
    if (firstEdges[0].requirements.op !== 'ALL') {
      throw new Error('Expected ALL fixture');
    }
    firstEdges[0].requirements.terms.push({
      op: 'FACT',
      fact: {
        id: factId('QUEST', 'Injected Quest'),
        kind: 'QUEST',
        label: 'Injected Quest',
      },
    });

    expect(chunkContentService.locationNodes())
      .toEqual(fullChunkContent.locationNodes);
    expect(chunkContentService.locationEdges()).toEqual([serviceEdge]);
  });
});

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
