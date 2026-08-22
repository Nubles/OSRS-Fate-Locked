import { describe, expect, expectTypeOf, it } from 'vitest';
import type { UnlockState } from '../../types';
import {
  compileRawRequirements,
  compileSourceRequirements,
  evaluateRouteGates,
  type RouteGateAccountState,
} from './accountRequirements';
import type { ExactItemSource } from './model';

type AnalysisUnlockSnapshot = RouteGateAccountState & Pick<UnlockState, 'regions' | 'chunks'>;

const unlocks = (overrides: Partial<UnlockState> = {}): UnlockState => ({
  equipment: {}, skills: {}, levels: {}, regions: [], mobility: [], arcana: [], housing: [],
  merchants: [], minigames: [], bosses: [], storage: [], guilds: [], farming: [],
  slayerUnlocks: [], quests: [], diaries: [], cas: [], completedTasks: [], collectionLog: {},
  ...overrides,
});

const entity = (raw: string) => ({ raw, origin: 'ENTITY' as const });
const chunkEntry = (raw: string) => ({ raw, origin: 'CHUNK_ENTRY' as const });

describe('account requirements', () => {
  it('compiles canonical quest-completion wording and reports an incomplete quest', () => {
    const gates = compileRawRequirements([entity('Priest in Peril Complete the quest')]);
    expect(gates).toEqual([{ type: 'QUEST', questId: 'Priest in Peril', label: 'Priest in Peril' }]);
    expect(evaluateRouteGates(gates, unlocks())).toEqual({ blockers: gates, hasDataGap: false });
    expect(evaluateRouteGates(gates, unlocks({ quests: ['Priest in Peril'] }))).toEqual({ blockers: [], hasDataGap: false });
  });

  it('accepts a canonical quest ID supplied by chunk entry requirements', () => {
    expect(compileRawRequirements([chunkEntry('Dragon Slayer I')])).toEqual([
      { type: 'QUEST', questId: 'Dragon Slayer I', label: 'Dragon Slayer I' },
    ]);
  });

  it('does not compile a bare canonical quest from entity evidence', () => {
    expect(compileRawRequirements([entity('Dragon Slayer I')])).toEqual([{
      type: 'UNRESOLVED', label: 'Dragon Slayer I', raw: 'Dragon Slayer I',
    }]);
  });

  it('reports a missing skill without hiding the route', () => {
    const gates = compileRawRequirements([entity('Woodcutting level 15')]);
    expect(evaluateRouteGates(gates, unlocks({ levels: { Woodcutting: 1 } }))).toEqual({
      blockers: [expect.objectContaining({ type: 'SKILL', skill: 'Woodcutting', level: 15 })], hasDataGap: false,
    });
  });

  it('requires both an unlocked skill tier and enough method-capped level', () => {
    const gates = compileRawRequirements([entity('Mining level 30')]);

    expect(evaluateRouteGates(gates, unlocks({
      skills: {},
      levels: { Mining: 30 },
    })).blockers).toEqual(gates);
    expect(evaluateRouteGates(gates, unlocks({
      skills: { Mining: 2 },
      levels: { Mining: 30 },
    })).blockers).toEqual(gates);
    expect(evaluateRouteGates(gates, unlocks({
      skills: { Mining: 3 },
      levels: { Mining: 30 },
    }))).toEqual({ blockers: [], hasDataGap: false });
  });

  it('compiles reviewed account-unlock aliases into their typed unlock categories', () => {
    expect(compileRawRequirements([
      entity('Access the Fishing Guild'), entity('Use the Sawmill Operator'), entity('Play Barbarian Assault'),
      entity('Use Fairy Rings'), entity('Broader Fletching required'),
    ])).toEqual([
      { type: 'UNLOCK', category: 'guilds', id: 'Fishing Guild', label: 'Fishing Guild' },
      { type: 'UNLOCK', category: 'merchants', id: 'Sawmill Operators', label: 'Sawmill Operators' },
      { type: 'UNLOCK', category: 'minigames', id: 'Barbarian Assault', label: 'Barbarian Assault' },
      { type: 'UNLOCK', category: 'mobility', id: 'Fairy Rings', label: 'Fairy Rings' },
      { type: 'UNLOCK', category: 'slayerUnlocks', id: 'Broader Fletching', label: 'Broader Fletching' },
    ]);
  });

  it('does not silently satisfy unknown requirement wording', () => {
    const gates = compileRawRequirements([entity('Access the sealed workshop')]);
    expect(gates).toEqual([{ type: 'UNRESOLVED', label: 'Access the sealed workshop', raw: 'Access the sealed workshop' }]);
    expect(evaluateRouteGates(gates, unlocks())).toEqual({ blockers: gates, hasDataGap: true });
  });

  it('appends compiled gates without changing source evidence', () => {
    const source: ExactItemSource = {
      id: 'spawn:plank:19,48:plank', output: { key: 'plank', name: 'Plank' }, outputQuantity: 1,
      kind: 'SPAWN', label: 'Plank', chunk: '19,48', rawRequirements: [chunkEntry('Children of the Sun')],
      gates: [{ type: 'SKILL', skill: 'Woodcutting', level: 1, label: 'Woodcutting level 1' }],
      deterministic: true, coverage: 'COMPLETE',
    };
    expect(compileSourceRequirements(source)).toEqual(expect.objectContaining({
      rawRequirements: [chunkEntry('Children of the Sun')],
      gates: [
        { type: 'SKILL', skill: 'Woodcutting', level: 1, label: 'Woodcutting level 1' },
        { type: 'QUEST', questId: 'Children of the Sun', label: 'Children of the Sun' },
      ],
    }));
    expect(source.gates).toHaveLength(1);
  });

  it('evaluates the same gates for full unlock state and analysis snapshots', () => {
    const account = unlocks({
      skills: { Mining: 3 },
      levels: { Mining: 30 },
      quests: ['Rune Mysteries'],
      merchants: ['Sawmill Operators'],
    });
    const snapshotUnlocks: AnalysisUnlockSnapshot = {
      skills: account.skills,
      levels: account.levels,
      regions: account.regions,
      chunks: account.chunks,
      quests: account.quests,
      guilds: account.guilds,
      merchants: account.merchants,
      minigames: account.minigames,
      mobility: account.mobility,
      slayerUnlocks: account.slayerUnlocks,
    };
    const gates = [
      { type: 'SKILL', skill: 'Mining', level: 30, label: 'Mining level 30' },
      { type: 'QUEST', questId: 'Rune Mysteries', label: 'Rune Mysteries' },
      { type: 'UNLOCK', category: 'merchants', id: 'Sawmill Operators', label: 'Sawmill Operators' },
    ] as const;

    expectTypeOf<UnlockState>().toMatchTypeOf<RouteGateAccountState>();
    expectTypeOf(snapshotUnlocks).toMatchTypeOf<RouteGateAccountState>();
    expect(evaluateRouteGates(gates, account)).toEqual({ blockers: [], hasDataGap: false });
    expect(evaluateRouteGates(gates, snapshotUnlocks)).toEqual(
      evaluateRouteGates(gates, account),
    );
  });
});
