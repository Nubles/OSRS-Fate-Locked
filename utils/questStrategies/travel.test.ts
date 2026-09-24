import { describe, expect, it } from 'vitest';
import graph from '../../data/questWalkingGraph.json';
import { questStrategyFor } from '../../data/questWalkthroughs.public';
import { guideTravelFor, walkingRoute, type GuideTravelAccount, type QuestWalkingGraph } from './travel';
import type { ChunkKey } from '../questRoutes/model';

const account = (chunks: string[], quests: string[] = []): GuideTravelAccount => ({
  unlockedChunks: chunks as ChunkKey[],
  unlocks: { equipment: {}, skills: {}, levels: {}, regions: [], chunks, quests,
    guilds: [], merchants: [], mobility: [], minigames: [], slayerUnlocks: [] },
});
const node = (chunk: string, targets: string[], requirements: string[] = []) => ({
  chunk, requirements, edges: targets.map(to => ({ to, requirements: [] as string[] })),
});

describe('RuneProof walking permissions', () => {
  it('identifies the Tower bridge transit chunks even when all quest destinations are unlocked', () => {
    const destinations = ['50,50', '49,49', '50,49', '48,49'];
    const result = walkingRoute('12849-1', '12337-1', account(destinations));
    expect(result.status).toBe('NEEDS_CHUNKS');
    expect(result.missingChunks).toEqual(['49,50', '48,50']);
    expect(result.chunks).toEqual(['50,49', '49,49', '49,50', '48,50', '48,49']);
    expect(walkingRoute('12849-1', '12337-1', account([...destinations, '49,50', '48,50'])))
      .toMatchObject({ status: 'AVAILABLE', missingChunks: [] });
  });

  it('prefers a fully unlocked detour over a shorter locked route', () => {
    const sample: QuestWalkingGraph = { nodes: {
      a: node('1,1', ['b', 'c']), b: node('2,1', ['e']), c: node('1,2', ['d']),
      d: node('2,2', ['e']), e: node('3,1', []),
    } };
    const result = walkingRoute('a', 'e', account(['1,1', '1,2', '2,2', '3,1']), sample);
    expect(result.status).toBe('AVAILABLE');
    expect(result.chunks).toEqual(['1,1', '1,2', '2,2', '3,1']);
  });

  it('respects one-way paths and disconnected sections within the same unlocked chunk', () => {
    const sample: QuestWalkingGraph = { nodes: {
      a: node('1,1', ['b']), b: node('1,2', []), c: node('1,1', []),
    } };
    const state = account(['1,1', '1,2']);
    expect(walkingRoute('a', 'b', state, sample).status).toBe('AVAILABLE');
    expect(walkingRoute('b', 'a', state, sample).status).toBe('UNRESOLVED');
    expect(walkingRoute('a', 'c', state, sample).status).toBe('UNRESOLVED');
    expect(walkingRoute('a', 'a', account([]), sample).status).toBe('NEEDS_CHUNKS');
  });

  it('checks node and edge requirements, retaining unknown conditions as uncertainty', () => {
    const sample: QuestWalkingGraph = { nodes: {
      a: node('1,1', ['b']), b: node('1,2', [], ['Priest in Peril']),
    } };
    const state = account(['1,1', '1,2']);
    expect(walkingRoute('a', 'b', state, sample)).toMatchObject({
      status: 'NEEDS_REQUIREMENTS', requirements: ['Priest in Peril'],
    });
    expect(walkingRoute('a', 'b', account(['1,1', '1,2'], ['Priest in Peril']), sample).status).toBe('AVAILABLE');
    const edgeSample: QuestWalkingGraph = { nodes: {
      a: { ...node('1,1', []), edges: [{ to: 'b', requirements: ['Unknown toll condition'] }] },
      b: node('1,2', []),
    } };
    expect(walkingRoute('a', 'b', state, edgeSample)).toMatchObject({
      status: 'UNRESOLVED', requirements: ['Unknown toll condition'],
    });
  });

  it('reports missing connections instead of inventing adjacency', () => {
    expect(walkingRoute('missing', '12850-1', account(['50,50'])).status).toBe('UNRESOLVED');
  });

  it('checks the Al Kharid toll on an otherwise unlocked Rune Mysteries detour', () => {
    const chunks = ['48,49', '48,50', '49,50', '50,50', '51,50', '51,51', '51,52', '50,52', '50,53'];
    const toll = walkingRoute('12337-1', '12853-1', account(chunks));
    expect(toll).toMatchObject({ status: 'UNRESOLVED', missingChunks: [],
      requirements: ['Al Kharid gate: 10 coins unless Prince Ali Rescue is complete'] });
    expect(walkingRoute('12337-1', '12853-1', account(chunks, ['Prince Ali Rescue'])).status).toBe('AVAILABLE');
    const freeDetour = walkingRoute('12337-1', '12853-1', account([...chunks, '50,51']));
    expect(freeDetour).toMatchObject({ status: 'AVAILABLE', requirements: [] });
    expect(freeDetour.chunks).not.toContain('51,50');
  });

  it.each(["Cook's Assistant", 'Sheep Shearer', 'The Restless Ghost', 'Rune Mysteries', 'Imp Catcher'])(
    'connects every authored step in %s when route chunks are owned', questId => {
      const strategy = questStrategyFor(questId)!;
      const state = account([...new Set(Object.values(graph.nodes).map(entry => entry.chunk))]);
      const travel = guideTravelFor(questId, strategy.revision, strategy.actions, state);
      expect(travel).toHaveLength(strategy.actions.length);
      expect(travel[0].status).toBe('START');
      expect(travel.slice(1).every(leg => leg.status === 'AVAILABLE')).toBe(true);
    },
  );

  it('does not borrow the original location after an alternative source or guide revision change', () => {
    const strategy = questStrategyFor('The Restless Ghost')!;
    const state = account([...new Set(Object.values(graph.nodes).map(entry => entry.chunk))]);
    const actions = strategy.actions.map((action, index) => ({ ...action, usesAlternative: index === 1 }));
    const legs = guideTravelFor(strategy.questId, strategy.revision, actions, state);
    expect(legs[1].status).toBe('UNRESOLVED');
    expect(legs[2].status).toBe('UNRESOLVED');
    expect(legs[3].status).toBe('AVAILABLE');
    expect(guideTravelFor(strategy.questId, 'unreviewed', strategy.actions, state)
      .every(leg => leg.status === 'UNRESOLVED')).toBe(true);
  });
});
