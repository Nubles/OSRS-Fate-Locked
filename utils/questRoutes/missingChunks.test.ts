import { describe, expect, it } from 'vitest';
import { minimalMissingChunkOptions } from './missingChunks';
import type { ItemRoute, RouteGate } from './model';

const questGate: RouteGate = { type: 'QUEST', questId: 'druidic_ritual', label: 'Druidic Ritual' };

const route = (
  id: string,
  chunks: ItemRoute['chunks'],
  blockers: RouteGate[] = [],
  hasDataGap = false,
): ItemRoute => ({
  id,
  item: { key: 'test-item', name: 'Test item' },
  outputQuantity: 1,
  sourceKind: 'SPAWN',
  sourceLabel: id,
  chunks,
  steps: [],
  blockers,
  deterministic: true,
  recursiveCost: 0,
  consumedIngredientCost: 0,
  skillUnlockCost: 0,
  skillLevelCost: 0,
  travelCost: 0,
  hasDataGap,
});

describe('minimalMissingChunkOptions', () => {
  it('drops a strict superset when a one-chunk option exists', () => {
    expect(minimalMissingChunkOptions([
      route('needs-a-and-b', ['5,10', '2,1']),
      route('needs-a', ['2,1']),
    ], new Set())).toEqual([{
      chunks: ['2,1'],
      routeIds: ['needs-a'],
      remainingGates: [],
    }]);
  });

  it('merges equal missing sets with stable route ids and gates', () => {
    expect(minimalMissingChunkOptions([
      route('route-b', ['10,1', '2,9'], [questGate]),
      route('route-a', ['2,9', '10,1'], [questGate]),
    ], new Set())).toEqual([{
      chunks: ['2,9', '10,1'],
      routeIds: ['route-a', 'route-b'],
      remainingGates: [questGate],
    }]);
  });

  it('keeps genuinely different one-chunk alternatives', () => {
    expect(minimalMissingChunkOptions([
      route('west', ['1,2']),
      route('east', ['3,4']),
    ], new Set())).toEqual([
      { chunks: ['1,2'], routeIds: ['west'], remainingGates: [] },
      { chunks: ['3,4'], routeIds: ['east'], remainingGates: [] },
    ]);
  });

  it('does not mutate the routes used to calculate advisory options', () => {
    const lockedRoute = route('gated', ['2,9', '10,1'], [questGate]);
    const before = structuredClone(lockedRoute);

    const options = minimalMissingChunkOptions([lockedRoute], new Set(['10,1']));

    expect(options).toEqual([{
      chunks: ['2,9'],
      routeIds: ['gated'],
      remainingGates: [questGate],
    }]);
    expect(lockedRoute).toEqual(before);
  });
  it('keeps same-chunk routes with different blockers as separate alternatives', () => {
    const gateA: RouteGate = { type: 'QUEST', questId: 'a-quest', label: 'A quest' };
    const gateB: RouteGate = { type: 'QUEST', questId: 'b-quest', label: 'B quest' };
    expect(minimalMissingChunkOptions([
      route('route-b', ['2,9'], [gateB]),
      route('route-a', ['2,9'], [gateA]),
    ], new Set())).toEqual([
      { chunks: ['2,9'], routeIds: ['route-a'], remainingGates: [gateA] },
      { chunks: ['2,9'], routeIds: ['route-b'], remainingGates: [gateB] },
    ]);
  });
  it('keeps a usable superset when the smaller chunk route is blocked', () => {
    expect(minimalMissingChunkOptions([
      route('blocked-subset', ['2,9'], [questGate]),
      route('usable-superset', ['2,9', '10,1']),
    ], new Set())).toEqual([
      { chunks: ['2,9'], routeIds: ['blocked-subset'], remainingGates: [questGate] },
      { chunks: ['2,9', '10,1'], routeIds: ['usable-superset'], remainingGates: [] },
    ]);
  });
  it('keeps a complete superset when the smaller chunk route is incomplete', () => {
    expect(minimalMissingChunkOptions([
      route('incomplete-subset', ['2,9'], [], true),
      route('complete-superset', ['2,9', '10,1']),
    ], new Set())).toEqual([
      { chunks: ['2,9'], routeIds: ['incomplete-subset'], remainingGates: [] },
      { chunks: ['2,9', '10,1'], routeIds: ['complete-superset'], remainingGates: [] },
    ]);
  });
  it('keeps the same canonical gate representative when equivalent routes reverse', () => {
    const canonical: RouteGate = { type: 'QUEST', questId: 'shared-quest', label: 'A access' };
    const alternate: RouteGate = { type: 'QUEST', questId: 'shared-quest', label: 'Z access' };
    const routes = [
      route('route-a', ['2,9'], [canonical]),
      route('route-b', ['2,9'], [alternate]),
    ];
    const forward = minimalMissingChunkOptions(routes, new Set());
    const reversed = minimalMissingChunkOptions([...routes].reverse(), new Set());
    expect(forward).toEqual(reversed);
    expect(forward[0].remainingGates).toEqual([canonical]);
  });
  it('uses code-unit ordering for canonically equivalent gate labels', () => {
    const composed: RouteGate = { type: 'QUEST', questId: 'accented-quest', label: '\u00e9' };
    const decomposed: RouteGate = { type: 'QUEST', questId: 'accented-quest', label: 'e\u0301' };
    const routes = [
      route('route-a', ['2,9'], [composed]),
      route('route-b', ['2,9'], [decomposed]),
    ];
    const forward = minimalMissingChunkOptions(routes, new Set());
    const reversed = minimalMissingChunkOptions([...routes].reverse(), new Set());
    expect(forward).toEqual(reversed);
    expect(forward[0].remainingGates).toEqual([decomposed]);
  });
});
