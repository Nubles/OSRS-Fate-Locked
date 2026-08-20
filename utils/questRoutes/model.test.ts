import { describe, expect, it } from 'vitest';
import {
  canonicalItemKey,
  chunkKey,
  validateQuestRequirement,
  validateRoute,
  validateSource,
  type RouteGate,
} from './model';

describe('RuneProof model invariants', () => {
  it('normalises cosmetic item spelling without merging different items', () => {
    expect(canonicalItemKey('  Bolt of cloth ')).toBe('bolt of cloth');
    expect(canonicalItemKey('Clay')).not.toBe(canonicalItemKey('Soft clay'));
  });

  it('uses the app chunk coordinate identity', () => {
    expect(chunkKey(21, 52)).toBe('21,52');
  });

  it('rejects non-positive quest quantities', () => {
    expect(() => validateQuestRequirement({
      item: { key: 'plank', name: 'Plank' },
      quantity: 0,
      supplyPolicy: 'PLAYER_OBTAINED',
    })).toThrow('quantity');
  });

  it('keeps an unresolved raw gate attached to its source', () => {
    const source = validateSource({
      id: 'shop:sawmill:21,52:plank',
      output: { key: 'plank', name: 'Plank' },
      outputQuantity: 1,
      kind: 'SHOP',
      label: 'Sawmill',
      chunk: '21,52',
      rawRequirements: [],
      gates: [{ type: 'UNRESOLVED', label: 'Check source access', raw: 'Access the workshop' }],
      deterministic: true,
      coverage: 'COMPLETE',
    });
    expect(source.gates[0].type).toBe('UNRESOLVED');
  });
  const malformedGates: RouteGate[] = [
    { type: 'QUEST', questId: '', label: 'Quest access' },
    { type: 'UNLOCK', category: 'guilds', id: '', label: 'Guild access' },
    { type: 'SKILL', skill: '', level: 1, label: 'Skill access' },
    { type: 'SKILL', skill: 'Crafting', level: Infinity, label: 'Skill access' },
    { type: 'SKILL', skill: 'Crafting', level: 0, label: 'Skill access' },
    { type: 'QUEST', questId: 'druidic_ritual', label: '' },
    { type: 'UNRESOLVED', label: 'Check access', raw: '' },
  ];

  it.each(malformedGates)('rejects malformed source gates: %o', (gate) => {
    expect(() => validateSource({
      id: 'shop:sawmill:21,52:plank',
      output: { key: 'plank', name: 'Plank' },
      outputQuantity: 1,
      kind: 'SHOP',
      label: 'Sawmill',
      chunk: '21,52',
      rawRequirements: [],
      gates: [gate],
      deterministic: true,
      coverage: 'COMPLETE',
    })).toThrow();
  });

  it('rejects malformed blockers on a route', () => {
    expect(() => validateRoute({
      id: 'route:plank:sawmill',
      item: { key: 'plank', name: 'Plank' },
      outputQuantity: 1,
      sourceKind: 'SHOP',
      sourceLabel: 'Sawmill',
      chunks: ['21,52'],
      steps: [],
      blockers: [{ type: 'QUEST', questId: '', label: 'Quest access' }],
      deterministic: true,
      recursiveCost: 0,
      consumedIngredientCost: 0,
      skillUnlockCost: 0,
      skillLevelCost: 0,
      travelCost: 0,
      hasDataGap: false,
    })).toThrow();
  });

  it('rejects malformed step-local blockers on a route', () => {
    expect(() => validateRoute({
      id: 'route:plank:sawmill',
      item: { key: 'plank', name: 'Plank' },
      outputQuantity: 1,
      sourceKind: 'SHOP',
      sourceLabel: 'Sawmill',
      chunks: ['21,52'],
      steps: [{
        id: 'source:sawmill',
        label: 'Sawmill',
        gates: [],
        blockers: [{ type: 'QUEST', questId: '', label: 'Quest access' }],
        requiresChunkUnlock: false,
        hasDataGap: false,
      }],
      blockers: [],
      deterministic: true,
      recursiveCost: 0,
      consumedIngredientCost: 0,
      skillUnlockCost: 0,
      skillLevelCost: 0,
      travelCost: 0,
      hasDataGap: false,
    })).toThrow();
  });
  it('rejects malformed step gates on a route', () => {
    expect(() => validateRoute({
      id: 'route:plank:sawmill',
      item: { key: 'plank', name: 'Plank' },
      outputQuantity: 1,
      sourceKind: 'SHOP',
      sourceLabel: 'Sawmill',
      chunks: ['21,52'],
      steps: [{
        id: 'travel:sawmill',
        label: 'Travel to the sawmill',
        gates: [{ type: 'UNRESOLVED', label: 'Check access', raw: '' }],
        requiresChunkUnlock: false,
        hasDataGap: false,
      }],
      blockers: [],
      deterministic: true,
      recursiveCost: 0,
      consumedIngredientCost: 0,
      skillUnlockCost: 0,
      skillLevelCost: 0,
      travelCost: 0,
      hasDataGap: false,
    })).toThrow();
  });
});
