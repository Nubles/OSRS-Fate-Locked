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
  it('reads the source’s short skill levels and the picked doors as skill gates (accuracy audit S-9)', () => {
    expect(compileRawRequirements([entity('93 Slayer')])).toEqual([{ type: 'SKILL', skill: 'Slayer', level: 93, label: 'Slayer level 93' }]);
    expect(compileRawRequirements([entity('Unlock the door (Magic axe hut)')]))
      .toEqual([{ type: 'SKILL', skill: 'Thieving', level: 23, label: 'Thieving level 23' }]);
    expect(compileRawRequirements([entity("Unlock the door (Pirates' Hideout)")]))
      .toEqual([{ type: 'SKILL', skill: 'Thieving', level: 39, label: 'Thieving level 39' }]);
    expect(compileRawRequirements([entity('100 Coins')])).toEqual([{ type: 'UNRESOLVED', label: '100 Coins', raw: '100 Coins' }]);
  });

  it('checks a reviewed equipment gate against slot tiers, including absent and invalid values', () => {
    const gate = { type: 'EQUIPMENT' as const, slot: 'Neck' as const, tier: 1, label: 'Neck T1: Wear the ghostspeak amulet' };
    for (const tier of [undefined, 0, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(evaluateRouteGates([gate], unlocks({ equipment: tier === undefined ? {} : { Neck: tier } })))
        .toEqual({ blockers: [gate], hasDataGap: false });
    }
    for (const tier of [1, 2]) {
      expect(evaluateRouteGates([gate], unlocks({ equipment: { Neck: tier } })))
        .toEqual({ blockers: [], hasDataGap: false });
    }
  });

  it('distinguishes an unrecorded quest stage from missing completion', () => {
    const gates = compileRawRequirements([chunkEntry('Started The Giant Dwarf')]);
    expect(gates).toEqual([{
      type: 'QUEST_PROGRESS', questId: 'The Giant Dwarf', completion: 'satisfies',
      label: 'Started The Giant Dwarf', raw: 'Started The Giant Dwarf',
    }]);
    expect(evaluateRouteGates(gates, unlocks())).toEqual({ blockers: gates, hasDataGap: true });
    expect(evaluateRouteGates(gates, unlocks({ quests: ['The Giant Dwarf'] })))
      .toEqual({ blockers: [], hasDataGap: false });
  });

  it('closes the Crabclaw quest chamber after completion while keeping the normal cave open', () => {
    const cave = compileRawRequirements([chunkEntry('The Depths of Despair: read The Royal Accord of Twill')]);
    const chamber = compileRawRequirements([chunkEntry('The Depths of Despair: lower chamber before quest completion')]);
    const state = unlocks({ quests: ['The Depths of Despair'] });
    expect(evaluateRouteGates(cave, state)).toEqual({ blockers: [], hasDataGap: false });
    expect(evaluateRouteGates(chamber, state)).toEqual({ blockers: chamber, hasDataGap: false });
    expect(evaluateRouteGates(chamber, unlocks())).toEqual({ blockers: chamber, hasDataGap: true });
  });

  it('does not use completion to satisfy unreviewed quest-prefixed conditions', () => {
    const gates = compileRawRequirements([chunkEntry('Underground Pass: route and quest phase need confirmation')]);
    expect(evaluateRouteGates(gates, unlocks({ quests: ['Underground Pass', 'Regicide'] })))
      .toEqual({ blockers: gates, hasDataGap: true });
  });

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

  it('reads "60 Mining", the reviewed entrance wording, as a skill gate (the Mining Guild door)', () => {
    expect(compileRawRequirements([chunkEntry('60 Mining'), chunkEntry('91 Slayer')])).toEqual([
      { type: 'SKILL', skill: 'Mining', level: 60, label: 'Mining level 60' },
      { type: 'SKILL', skill: 'Slayer', level: 91, label: 'Slayer level 91' },
    ]);
    // A number before anything but a skill stays evidence for a person to check.
    expect(compileRawRequirements([entity('100 Kudos')])).toEqual([{ type: 'UNRESOLVED', label: '100 Kudos', raw: '100 Kudos' }]);
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

  it("needs Druidic Ritual for a Herblore level, such as the Alchemical Society interior's", () => {
    const gates = compileRawRequirements([entity('Herblore level 60')]);
    const herblore = { skills: { Herblore: 6 }, levels: { Herblore: 60 } };
    const ritual = { type: 'QUEST' as const, questId: 'Druidic Ritual', label: 'Druidic Ritual' };

    expect(evaluateRouteGates(gates, unlocks(herblore))).toEqual({ blockers: [ritual], hasDataGap: false });
    expect(evaluateRouteGates(gates, unlocks({ ...herblore, quests: ['Druidic Ritual'] })))
      .toEqual({ blockers: [], hasDataGap: false });
    // A source that names the quest itself reports it once.
    expect(evaluateRouteGates([...gates, ritual], unlocks(herblore)).blockers).toEqual([ritual]);
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

  it('reads "Play" a boss as that boss\'s unlock, for a shop taking its currency (Flakes \'n\' Flotsam)', () => {
    const gates = compileRawRequirements([entity('Play Tempoross')]);
    expect(gates).toEqual([{ type: 'UNLOCK', category: 'bosses', id: 'Tempoross', label: 'Tempoross' }]);
    expect(evaluateRouteGates(gates, unlocks()).blockers).toEqual(gates);
    expect(evaluateRouteGates(gates, unlocks({ bosses: ['Tempoross'] }))).toEqual({ blockers: [], hasDataGap: false });
    // Only "Play" reads as a boss's unlock: other wording naming a boss stays unresolved.
    expect(compileRawRequirements([entity('Access Tempoross')])[0]).toMatchObject({ type: 'UNRESOLVED' });
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

describe('requirements a place meets by itself', () => {
  it('drops "Enter the Wilderness" from the Wilderness Slayer Cave entrances, which are in the Wilderness', () => {
    expect(compileRawRequirements([{ raw: 'Enter the Wilderness', origin: 'ENTITY' }])).toEqual([]);
    expect(compileRawRequirements([{ raw: ' enter the  wilderness ', origin: 'CHUNK_ENTRY' }])).toEqual([]);
  });
});
