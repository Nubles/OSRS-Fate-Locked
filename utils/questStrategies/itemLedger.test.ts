import { describe, expect, it } from 'vitest';
import type { RuneProofItemEffect } from './packModel';
import {
  evaluateRuneProofItemLedger,
  replayRuneProofConfirmedItemLedger,
} from './itemLedger';

const action = (
  id: string,
  sourceOrder: number,
  itemEffects: readonly RuneProofItemEffect[],
  dependsOn: readonly string[] = [],
) => ({ id, sourceOrder, dependsOn, itemEffects });

describe('RuneProof branch item ledger', () => {
  it('balances transformation, reuse, return, and quest-provided supply', () => {
    const result = evaluateRuneProofItemLedger({
      questId: 'Example',
      branchId: 'main',
      initialItems: [{
        item: { key: 'knife', name: 'Knife' },
        quantity: 1,
        supplyPolicy: 'PLAYER_OBTAINED',
      }],
      actions: [
        action('example:receive', 1, [
          { kind: 'QUEST_PROVIDED', itemKey: 'raw token', quantity: 1 },
        ]),
        action('example:cut', 2, [
          { kind: 'REUSE', itemKey: 'knife', quantity: 1 },
          {
            kind: 'PRODUCE',
            itemKey: 'cut token',
            quantity: 1,
            from: [{ itemKey: 'raw token', quantity: 1 }],
          },
        ]),
        action('example:return', 3, [
          { kind: 'RETURN', itemKey: 'cut token', quantity: 1 },
        ]),
      ],
    });

    expect(result.findings).toEqual([]);
    expect(result.finalQuantities).toEqual({ knife: 1 });
  });

  it('rejects only the branch that consumes unavailable quantity', () => {
    const result = evaluateRuneProofItemLedger({
      questId: 'Example',
      branchId: 'remote',
      initialItems: [],
      actions: [action('example:pay', 1, [
        { kind: 'CONSUME', itemKey: 'coins', quantity: 10 },
      ])],
    });

    expect(result.findings).toEqual([
      expect.objectContaining({
        code: 'BROKEN_ITEM_LEDGER',
        scope: 'BRANCH',
        branchId: 'remote',
        actionId: 'example:pay',
      }),
    ]);
    expect(result.finalQuantities).not.toHaveProperty('phantom output');
  });

  it('does not add a produced output after an input underflow', () => {
    const result = evaluateRuneProofItemLedger({
      questId: 'Example',
      branchId: 'remote',
      initialItems: [],
      actions: [action('example:craft', 1, [{
        kind: 'PRODUCE',
        itemKey: 'phantom output',
        quantity: 1,
        from: [{ itemKey: 'missing input', quantity: 1 }],
      }])],
    });

    expect(result.findings).toHaveLength(1);
    expect(result.finalQuantities).toEqual({});
  });

  it('does not turn quest-provided items into preflight acquisitions', () => {
    const result = evaluateRuneProofItemLedger({
      questId: 'Example',
      branchId: 'main',
      initialItems: [{
        item: { key: 'quest tool', name: 'Quest tool' },
        quantity: 1,
        supplyPolicy: 'QUEST_PROVIDED',
      }],
      actions: [action('example:use', 1, [
        { kind: 'RETAIN', itemKey: 'quest tool', quantity: 1 },
      ])],
    });

    expect(result.findings[0]?.message).toContain('quest tool');
  });

  it('replays exact confirmed root quantities and removes spent items', () => {
    const roots = [{
      item: { key: 'coins', name: 'Coins' },
      quantity: 10,
      supplyPolicy: 'PLAYER_OBTAINED' as const,
    }];

    expect(replayRuneProofConfirmedItemLedger({
      initialItems: roots,
      actions: [],
      confirmedInitialItemKeys: new Set(['coins']),
      completedActionIds: new Set(),
    })).toEqual({ coins: 10 });
    expect(replayRuneProofConfirmedItemLedger({
      initialItems: roots,
      actions: [action('example:pay', 1, [
        { kind: 'CONSUME', itemKey: 'coins', quantity: 10 },
      ])],
      confirmedInitialItemKeys: new Set(['coins']),
      completedActionIds: new Set(['example:pay']),
    })).toEqual({});
  });

  it('accepts an exact reviewed family alternative as canonical root proof', () => {
    expect(replayRuneProofConfirmedItemLedger({
      initialItems: [{
        item: { key: 'pickaxe', name: 'Pickaxe' },
        quantity: 1,
        supplyPolicy: 'PLAYER_OBTAINED',
        alternatives: [
          { key: 'bronze pickaxe', name: 'Bronze pickaxe' },
          { key: 'iron pickaxe', name: 'Iron pickaxe' },
        ],
      }],
      actions: [],
      confirmedInitialItemKeys: new Set(['bronze pickaxe']),
      completedActionIds: new Set(),
    })).toEqual({ pickaxe: 1 });
  });

  it('applies acquire, consume, retain, lend replacement, and reusable-tool effects', () => {
    const result = evaluateRuneProofItemLedger({
      questId: 'Example',
      branchId: 'main',
      initialItems: [
        {
          item: { key: 'hammer', name: 'Hammer' },
          quantity: 1,
          supplyPolicy: 'PLAYER_OBTAINED',
        },
        {
          item: { key: 'coins', name: 'Coins' },
          quantity: 10,
          supplyPolicy: 'PLAYER_OBTAINED',
        },
      ],
      actions: [
        action('example:acquire', 1, [
          { kind: 'ACQUIRE', itemKey: 'raw material', quantity: 2 },
        ]),
        action('example:work', 2, [
          { kind: 'RETAIN', itemKey: 'hammer', quantity: 1 },
          { kind: 'REUSE', itemKey: 'hammer', quantity: 1 },
          { kind: 'CONSUME', itemKey: 'raw material', quantity: 1 },
          {
            kind: 'LEND',
            itemKey: 'coins',
            quantity: 10,
            replacementItemKey: 'loan receipt',
          },
        ]),
      ],
    });

    expect(result.findings).toEqual([]);
    expect(result.finalQuantities).toEqual({
      hammer: 1,
      'loan receipt': 10,
      'raw material': 1,
    });
  });

  it('validates retain and reuse against the quantity at action opening', () => {
    const result = evaluateRuneProofItemLedger({
      questId: 'Example',
      branchId: 'main',
      initialItems: [{
        item: { key: 'tool', name: 'Tool' },
        quantity: 1,
        supplyPolicy: 'PLAYER_OBTAINED',
      }],
      actions: [action('example:use-up-tool', 1, [
        { kind: 'CONSUME', itemKey: 'tool', quantity: 1 },
        { kind: 'RETAIN', itemKey: 'tool', quantity: 1 },
        { kind: 'REUSE', itemKey: 'tool', quantity: 1 },
      ])],
    });

    expect(result).toEqual({ finalQuantities: {}, findings: [] });
  });

  it('sorts actions by source order and then ID before applying effects', () => {
    const result = evaluateRuneProofItemLedger({
      questId: 'Example',
      branchId: 'main',
      initialItems: [],
      actions: [
        action('example:z-consume', 2, [
          { kind: 'CONSUME', itemKey: 'token', quantity: 1 },
        ]),
        action('example:z-same-order', 1, [
          { kind: 'CONSUME', itemKey: 'token', quantity: 1 },
        ]),
        action('example:a-same-order', 1, [
          { kind: 'ACQUIRE', itemKey: 'token', quantity: 2 },
        ]),
      ],
    });

    expect(result).toEqual({ finalQuantities: {}, findings: [] });
  });

  it('rolls back the entire action and skips later effects after a failure', () => {
    const result = evaluateRuneProofItemLedger({
      questId: 'Example',
      branchId: 'main',
      initialItems: [],
      actions: [action('example:invalid-transaction', 1, [
        { kind: 'ACQUIRE', itemKey: 'rolled back', quantity: 1 },
        { kind: 'CONSUME', itemKey: 'missing', quantity: 1 },
        { kind: 'QUEST_PROVIDED', itemKey: 'never applied', quantity: 1 },
      ])],
    });

    expect(result.findings).toHaveLength(1);
    expect(result.finalQuantities).toEqual({});
  });

  it.each([
    ['ACQUIRE', { kind: 'ACQUIRE', itemKey: 'target', quantity: 0 }],
    ['PRODUCE', { kind: 'PRODUCE', itemKey: 'target', quantity: 1.5, from: [] }],
    ['CONSUME', { kind: 'CONSUME', itemKey: 'stock', quantity: -1 }],
    ['RETAIN', { kind: 'RETAIN', itemKey: 'stock', quantity: 0 }],
    ['RETURN', { kind: 'RETURN', itemKey: 'stock', quantity: 1.5 }],
    ['LEND', { kind: 'LEND', itemKey: 'stock', quantity: -1 }],
    ['REUSE', { kind: 'REUSE', itemKey: 'stock', quantity: 0 }],
    ['QUEST_PROVIDED', { kind: 'QUEST_PROVIDED', itemKey: 'target', quantity: 1.5 }],
  ] as const)('rejects a nonpositive or noninteger %s quantity', (_kind, effect) => {
    const result = evaluateRuneProofItemLedger({
      questId: 'Example',
      branchId: 'quantity',
      initialItems: [{
        item: { key: 'stock', name: 'Stock' },
        quantity: 2,
        supplyPolicy: 'PLAYER_OBTAINED',
      }],
      actions: [action('example:bad-quantity', 1, [effect])],
    });

    expect(result.findings).toEqual([
      expect.objectContaining({
        code: 'BROKEN_ITEM_LEDGER',
        branchId: 'quantity',
        actionId: 'example:bad-quantity',
      }),
    ]);
    expect(result.finalQuantities).toEqual({ stock: 2 });
  });

  it('rejects an invalid transformation input quantity without consuming inputs', () => {
    const result = evaluateRuneProofItemLedger({
      questId: 'Example',
      branchId: 'quantity',
      initialItems: [{
        item: { key: 'stock', name: 'Stock' },
        quantity: 2,
        supplyPolicy: 'PLAYER_OBTAINED',
      }],
      actions: [action('example:bad-input-quantity', 1, [{
        kind: 'PRODUCE',
        itemKey: 'target',
        quantity: 1,
        from: [{ itemKey: 'stock', quantity: 0 }],
      }])],
    });

    expect(result.findings[0]).toEqual(expect.objectContaining({
      actionId: 'example:bad-input-quantity',
    }));
    expect(result.finalQuantities).toEqual({ stock: 2 });
  });

  it.each([
    ['CONSUME', { kind: 'CONSUME', itemKey: 'stock', quantity: 3 }],
    ['RETAIN', { kind: 'RETAIN', itemKey: 'stock', quantity: 3 }],
    ['RETURN', { kind: 'RETURN', itemKey: 'stock', quantity: 3 }],
    ['LEND', { kind: 'LEND', itemKey: 'stock', quantity: 3 }],
    ['REUSE', { kind: 'REUSE', itemKey: 'stock', quantity: 3 }],
  ] as const)('rejects a %s underflow without changing the action-opening ledger', (_kind, effect) => {
    const result = evaluateRuneProofItemLedger({
      questId: 'Example',
      branchId: 'underflow',
      initialItems: [{
        item: { key: 'stock', name: 'Stock' },
        quantity: 2,
        supplyPolicy: 'PLAYER_OBTAINED',
      }],
      actions: [action('example:underflow', 1, [effect])],
    });

    expect(result.findings).toHaveLength(1);
    expect(result.finalQuantities).toEqual({ stock: 2 });
  });

  it.each([0, -1, 1.5])('rejects invalid initial quantity %s instead of seeding it', quantity => {
    const result = evaluateRuneProofItemLedger({
      questId: 'Example',
      branchId: 'invalid-root',
      initialItems: [{
        item: { key: 'bad root', name: 'Bad root' },
        quantity,
        supplyPolicy: 'PLAYER_OBTAINED',
      }],
      actions: [],
    });

    expect(result.findings).toEqual([
      expect.objectContaining({
        code: 'BROKEN_ITEM_LEDGER',
        scope: 'BRANCH',
        branchId: 'invalid-root',
        actionId: undefined,
      }),
    ]);
    expect(result.finalQuantities).toEqual({});
  });

  it('uses stable finding IDs and finding order for sorted actions', () => {
    const input = {
      questId: 'Example',
      branchId: 'main',
      initialItems: [],
      actions: [
        action('example:z', 2, [
          { kind: 'CONSUME', itemKey: 'z', quantity: 1 },
        ]),
        action('example:a', 1, [
          { kind: 'CONSUME', itemKey: 'a', quantity: 1 },
        ]),
      ],
    } as const;

    const first = evaluateRuneProofItemLedger(input);
    const second = evaluateRuneProofItemLedger(input);

    expect(first.findings.map(finding => finding.actionId)).toEqual([
      'example:a',
      'example:z',
    ]);
    expect(first.findings.map(finding => finding.id)).toEqual([
      'BROKEN_ITEM_LEDGER|BRANCH|Example|1%3Amain|1%3Aexample%3Aa|a',
      'BROKEN_ITEM_LEDGER|BRANCH|Example|1%3Amain|1%3Aexample%3Az|z',
    ]);
    expect(second).toEqual(first);
  });

  it('reports an ambiguous reviewed alternative instead of guessing a family root', () => {
    const result = evaluateRuneProofItemLedger({
      questId: 'Example',
      branchId: 'families',
      initialItems: [
        {
          item: { key: 'tool one', name: 'Tool one' },
          quantity: 1,
          supplyPolicy: 'PLAYER_OBTAINED',
          alternatives: [{ key: 'shared tool', name: 'Shared tool' }],
        },
        {
          item: { key: 'tool two', name: 'Tool two' },
          quantity: 1,
          supplyPolicy: 'PLAYER_OBTAINED',
          alternatives: [{ key: 'shared tool', name: 'Shared tool' }],
        },
      ],
      actions: [],
    });

    expect(result.findings).toEqual([
      expect.objectContaining({
        code: 'BROKEN_ITEM_LEDGER',
        scope: 'BRANCH',
        branchId: 'families',
        actionId: undefined,
        message: expect.stringContaining('shared tool'),
      }),
    ]);
  });

  it('returns a sorted frozen snapshot without mutating caller-owned inputs', () => {
    const initialItems = [{
      item: { key: 'middle', name: 'Middle' },
      quantity: 1,
      supplyPolicy: 'PLAYER_OBTAINED' as const,
    }];
    const actions = [
      action('example:z', 2, [
        { kind: 'ACQUIRE', itemKey: 'z-last', quantity: 1 },
      ]),
      action('example:a', 1, [
        { kind: 'ACQUIRE', itemKey: 'a-first', quantity: 1 },
      ]),
    ];

    const result = evaluateRuneProofItemLedger({
      questId: 'Example',
      branchId: 'main',
      initialItems,
      actions,
    });

    expect(Object.keys(result.finalQuantities)).toEqual(['a-first', 'middle', 'z-last']);
    expect(Object.isFrozen(result.finalQuantities)).toBe(true);
    expect(initialItems).toEqual([{
      item: { key: 'middle', name: 'Middle' },
      quantity: 1,
      supplyPolicy: 'PLAYER_OBTAINED',
    }]);
    expect(actions.map(entry => entry.id)).toEqual(['example:z', 'example:a']);
  });

  it('replays all lifecycle effects in stable dependency order', () => {
    const actions = [
      action('example:finish', 4, [
        { kind: 'RETURN', itemKey: 'quest token', quantity: 1 },
        { kind: 'CONSUME', itemKey: 'log', quantity: 1 },
      ], ['example:lend']),
      action('example:receive', 1, [
        { kind: 'ACQUIRE', itemKey: 'twine', quantity: 1 },
        { kind: 'QUEST_PROVIDED', itemKey: 'quest token', quantity: 1 },
      ]),
      action('example:lend', 3, [
        {
          kind: 'LEND',
          itemKey: 'bow',
          quantity: 1,
          replacementItemKey: 'loan receipt',
        },
      ], ['example:craft']),
      action('example:craft', 2, [
        { kind: 'RETAIN', itemKey: 'hammer', quantity: 1 },
        { kind: 'REUSE', itemKey: 'hammer', quantity: 1 },
        {
          kind: 'PRODUCE',
          itemKey: 'bow',
          quantity: 1,
          from: [
            { itemKey: 'log', quantity: 1 },
            { itemKey: 'twine', quantity: 1 },
          ],
        },
      ], ['example:receive']),
    ];

    expect(replayRuneProofConfirmedItemLedger({
      initialItems: [
        {
          item: { key: 'hammer', name: 'Hammer' },
          quantity: 1,
          supplyPolicy: 'PLAYER_OBTAINED',
        },
        {
          item: { key: 'log', name: 'Log' },
          quantity: 2,
          supplyPolicy: 'PLAYER_OBTAINED',
        },
      ],
      actions,
      confirmedInitialItemKeys: new Set(['hammer', 'log']),
      completedActionIds: new Set(actions.map(entry => entry.id)),
    })).toEqual({ hammer: 1, 'loan receipt': 1 });
  });

  it('replays only completed actions whose dependencies already replayed', () => {
    const actions = [
      action('example:dependent', 2, [
        { kind: 'ACQUIRE', itemKey: 'dependent output', quantity: 1 },
      ], ['example:root']),
      action('example:root', 1, [
        { kind: 'ACQUIRE', itemKey: 'root output', quantity: 1 },
      ]),
      action('example:unconfirmed', 3, [
        { kind: 'ACQUIRE', itemKey: 'unconfirmed output', quantity: 1 },
      ], ['example:dependent']),
      action('example:missing-dependency', 4, [
        { kind: 'ACQUIRE', itemKey: 'impossible output', quantity: 1 },
      ], ['example:never']),
    ];

    expect(replayRuneProofConfirmedItemLedger({
      initialItems: [],
      actions,
      confirmedInitialItemKeys: new Set(),
      completedActionIds: new Set([
        'example:root',
        'example:dependent',
        'example:missing-dependency',
      ]),
    })).toEqual({ 'dependent output': 1, 'root output': 1 });
  });

  it('rolls back corrupt completed actions and does not replay their dependents', () => {
    expect(replayRuneProofConfirmedItemLedger({
      initialItems: [{
        item: { key: 'coin', name: 'Coin' },
        quantity: 1,
        supplyPolicy: 'PLAYER_OBTAINED',
      }],
      actions: [
        action('example:corrupt', 1, [
          { kind: 'ACQUIRE', itemKey: 'rolled back gift', quantity: 1 },
          { kind: 'CONSUME', itemKey: 'coin', quantity: 2 },
        ]),
        action('example:dependent', 2, [
          { kind: 'ACQUIRE', itemKey: 'impossible prize', quantity: 1 },
        ], ['example:corrupt']),
      ],
      confirmedInitialItemKeys: new Set(['coin']),
      completedActionIds: new Set(['example:corrupt', 'example:dependent']),
    })).toEqual({ coin: 1 });
  });

  it('does not seed unconfirmed, quest-provided, invalid, or ambiguous roots', () => {
    const initialItems = [
      {
        item: { key: 'unconfirmed', name: 'Unconfirmed' },
        quantity: 2,
        supplyPolicy: 'PLAYER_OBTAINED' as const,
      },
      {
        item: { key: 'quest root', name: 'Quest root' },
        quantity: 1,
        supplyPolicy: 'QUEST_PROVIDED' as const,
      },
      {
        item: { key: 'invalid', name: 'Invalid' },
        quantity: 0,
        supplyPolicy: 'PLAYER_OBTAINED' as const,
      },
      {
        item: { key: 'family one', name: 'Family one' },
        quantity: 1,
        supplyPolicy: 'PLAYER_OBTAINED' as const,
        alternatives: [{ key: 'shared', name: 'Shared' }],
      },
      {
        item: { key: 'family two', name: 'Family two' },
        quantity: 1,
        supplyPolicy: 'PLAYER_OBTAINED' as const,
        alternatives: [{ key: 'shared', name: 'Shared' }],
      },
    ];

    const result = replayRuneProofConfirmedItemLedger({
      initialItems,
      actions: [],
      confirmedInitialItemKeys: new Set(['quest root', 'invalid', 'shared']),
      completedActionIds: new Set(),
    });

    expect(result).toEqual({});
    expect(Object.isFrozen(result)).toBe(true);
  });
});
