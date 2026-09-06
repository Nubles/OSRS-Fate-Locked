import { describe, expect, it } from 'vitest';
import type { UnlockState } from '../../types';
import { evaluateSourceCondition, resolveSourceGraph, type SourceCondition, type SourceGraph, type SourceGraphContext } from './sourceGraph';

const unlocks: UnlockState = { equipment: {}, skills: {}, levels: {}, regions: [], chunks: [], mobility: [], arcana: [], housing: [],
  merchants: [], minigames: [], bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [], quests: [], diaries: [], cas: [], completedTasks: [], collectionLog: {} };
const context = (changes: Partial<SourceGraphContext> = {}): SourceGraphContext => ({ unlocks, observations: {}, inventory: {}, ...changes });
const observation = (id: string): SourceCondition => ({ kind: 'observation', id, prompt: `Have you ${id}?` });
const graph: SourceGraph = { entryNodeId: 'root', nodes: [
  { kind: 'conditional', id: 'root', branches: [{ condition: observation('started'), nodeId: 'route' }], defaultNodeId: 'start' },
  { kind: 'conditional', id: 'route', branches: [{ condition: observation('north'), nodeId: 'north' }], defaultNodeId: 'south' },
  { kind: 'action', id: 'start', title: 'Start', text: 'Speak to the quest giver.' },
  { kind: 'action', id: 'north', title: 'North', text: 'Follow the northern route.' },
  { kind: 'action', id: 'south', title: 'South', text: 'Follow the southern route.' },
] };

describe('source graph conditions', () => {
  it.each([
    ['all', false, undefined, 'unmet'], ['all', true, undefined, 'unknown'], ['all', true, true, 'met'],
    ['any', true, undefined, 'met'], ['any', false, undefined, 'unknown'], ['any', false, false, 'unmet'],
  ] as const)('uses decisive %s logic with %s and %s', (kind, a, b, expected) => {
    const verdict = evaluateSourceCondition({ kind, conditions: [observation('a'), observation('b')] }, context({ observations: { a, b } }));
    expect(verdict.state).toBe(expected);
    if (expected !== 'unknown') expect(verdict.questions).toEqual([]);
  });
  it('preserves unknown through NOT and nested expressions', () => {
    expect(evaluateSourceCondition({ kind: 'not', condition: observation('a') }, context()).state).toBe('unknown');
    expect(evaluateSourceCondition({ kind: 'not', condition: { kind: 'any', conditions: [observation('a'), observation('b')] } }, context({ observations: { a: true } })).state).toBe('unmet');
  });
  it('uses explicit inventory and never mutates or infers consumption', () => {
    const requirement: SourceCondition = { kind: 'item', id: 'rune', quantity: 3 };
    expect(evaluateSourceCondition(requirement, context()).state).toBe('unknown');
    expect(evaluateSourceCondition(requirement, context({ inventory: { rune: 0 } })).state).toBe('unmet');
    expect(evaluateSourceCondition(requirement, context({ inventory: { rune: -1 } })).state).toBe('unknown');
    const inventory = { rune: 3 };
    expect(evaluateSourceCondition(requirement, context({ inventory })).state).toBe('met');
    expect(inventory).toEqual({ rune: 3 });
  });
  it('keeps canonical unknowns separate from locked permissions and observation answers', () => {
    expect(evaluateSourceCondition({ kind: 'permission', predicate: { kind: 'method', skill: 'Magic', tier: 3 } }, context()).state).toBe('unmet');
    expect(evaluateSourceCondition({ kind: 'permission', predicate: { kind: 'manual', key: 'route', label: 'Legal route' } }, context({ observations: { route: true } })).state).toBe('unknown');
    expect(evaluateSourceCondition({ kind: 'permission', predicate: { kind: 'skill', skill: 'Magic', level: 70 } }, context({ unlocks: { ...unlocks, levels: { Magic: 70 } } })).state).toBe('met');
  });
  it('fails safely for unsupported, invalid, and cyclic conditions', () => {
    const cyclic: SourceCondition = { kind: 'all', conditions: [] };
    cyclic.conditions.push(cyclic);
    for (const condition of [cyclic, { kind: 'unsupported', reason: 'Dynamic destination' }, { kind: 'item', id: 'rune', quantity: 0 }] as SourceCondition[]) {
      expect(evaluateSourceCondition(condition, context()).state).toBe('unknown');
    }
  });
});

describe('source graph routes', () => {
  it('does not select defaults before earlier conditions are answered', () => {
    expect(resolveSourceGraph(graph, context())).toMatchObject({ state: 'unknown', path: ['root'], questions: [{ id: 'started' }] });
    expect(resolveSourceGraph(graph, context({ observations: { started: true } }))).toMatchObject({ state: 'unknown', path: ['root', 'route'] });
  });
  it('selects complete nested branches without mixing alternatives', () => {
    expect(resolveSourceGraph(graph, context({ observations: { started: false } }))).toMatchObject({ state: 'action', action: { id: 'start' } });
    expect(resolveSourceGraph(graph, context({ observations: { started: true, north: true } }))).toMatchObject({ state: 'action', action: { id: 'north' }, path: ['root', 'route', 'north'] });
    expect(resolveSourceGraph(graph, context({ observations: { started: true, north: false } }))).toMatchObject({ state: 'action', action: { id: 'south' } });
  });
  it('allows a proven false conjunction past an unanswered observation', () => {
    const fixture: SourceGraph = { entryNodeId: 'entry', nodes: [...graph.nodes, { kind: 'conditional', id: 'entry', branches: [
      { condition: { kind: 'all', conditions: [observation('unknown'), observation('no')] }, nodeId: 'north' },
    ], defaultNodeId: 'south' }] };
    expect(resolveSourceGraph(fixture, context({ observations: { no: false } }))).toMatchObject({ state: 'action', action: { id: 'south' } });
  });
  it('does not let route observations bypass mandatory canonical action permissions', () => {
    const fixture: SourceGraph = { entryNodeId: 'locked', nodes: [{ kind: 'action', id: 'locked', title: 'Enter', text: 'Enter the room.', requires: [observation('ready')],
      permissions: [{ kind: 'location', label: 'Required chunk', areas: ['Varrock'], chunks: ['50,54'] }] }] };
    const state = context({ gameModeId: 'chunked', observations: { ready: true, '50,54': true } });
    expect(resolveSourceGraph(fixture, state)).toMatchObject({ state: 'blocked', action: { id: 'locked' } });
    expect(resolveSourceGraph(fixture, { ...state, unlocks: { ...unlocks, chunks: ['50,54'] } }).state).toBe('action');
  });
  it('retains instructions when their unsupported action gate needs review', () => {
    const fixture: SourceGraph = { entryNodeId: 'action', nodes: [{ kind: 'action', id: 'action', title: 'Travel', text: 'Use the quest teleport.', requires: [{ kind: 'unsupported', reason: 'Teleport permission is unreviewed.' }] }] };
    expect(resolveSourceGraph(fixture, context())).toMatchObject({ state: 'unknown', action: { text: 'Use the quest teleport.' } });
  });
  it('handles graph cycles, duplicate IDs and missing references without selecting an action', () => {
    const cycle: SourceGraph = { entryNodeId: 'loop', nodes: [{ kind: 'conditional', id: 'loop', branches: [], defaultNodeId: 'loop' }] };
    expect(resolveSourceGraph(cycle, context()).state).toBe('unknown');
    expect(resolveSourceGraph({ ...graph, nodes: [...graph.nodes, graph.nodes[0]] }, context()).state).toBe('unknown');
    expect(resolveSourceGraph({ ...graph, entryNodeId: 'absent' }, context()).state).toBe('unknown');
  });
});
