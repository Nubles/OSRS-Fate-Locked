/**
 * Accuracy audit, batch 4 (shops, guilds, banks and levels): each fix checked
 * against the shipped chunk data, so a resync or an edit that undoes one fails
 * here. Findings are named as the audit names them (S11, B1, G4…).
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import content from '../public/chunk-content.json';
import { ChunkContentService } from '../services/ChunkContentService';
import { createFreshState } from '../context/GameContext';
import { evaluateBankRequirements, evaluateEntityAccess } from '../utils/entityAccess';
import { BANKS } from './banks';
import { getActivityReq } from './activityRequirements';
import { RESOURCE_MAP } from './resourceData';
import { calculateSupplyChain } from '../utils/supplyChain';
import {
  FARMING_PATCH_LIST, GUILDS_LIST, MERCHANTS_LIST, MINIGAMES_LIST, MISTHALIN_AREAS, MOBILITY_LIST,
  REGIONS_LIST, SKILLS_LIST, BOSSES_LIST,
} from './items';
import { QUEST_DATA } from './questData';
import contentOverrides from './sources/chunk-content-overrides.json';
import type { UnlockState } from '../types';

const service = new ChunkContentService();
beforeAll(async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => content })));
  await service.init();
  vi.unstubAllGlobals();
});

const levels = (level: number) => Object.fromEntries(SKILLS_LIST.map(skill => [skill, level]));

/** A run that owns every area and unlock, has done every quest and has these levels. */
const everything = (level = 99, changes: Partial<UnlockState> = {}): UnlockState => ({
  ...createFreshState().unlocks,
  skills: levels(10),
  levels: levels(level),
  regions: [...REGIONS_LIST, ...MISTHALIN_AREAS],
  merchants: [...MERCHANTS_LIST],
  guilds: [...GUILDS_LIST],
  minigames: [...MINIGAMES_LIST],
  mobility: [...MOBILITY_LIST],
  farming: [...FARMING_PATCH_LIST],
  bosses: [...BOSSES_LIST],
  quests: Object.keys(QUEST_DATA),
  ...changes,
});

describe('S11: members content does not wait on a free-to-play tag', () => {
  it('leaves the Chunk Picker\'s "F2P Only" tag out of every requirement', () => {
    expect(JSON.stringify(content)).not.toContain('F2P Only');
  });

  it('lets a run that owns everything use the members shops the tag held at "needs confirmation"', () => {
    const shops: [string, number, number][] = [
      ['Garden Centre', 47, 52], ['Construction supplies', 51, 54], ["Harry's Fishing Shop", 44, 53],
      ['Fancy Clothes Store', 51, 53], ['Draynor Seed Market', 48, 50], ["Trader Stan's Trading Post", 28, 57],
      ['Slayer Equipment (shop)', 45, 55], ['Pie Shop', 49, 53], ['Farming Supplies', 43, 54],
      ["Hickton's Archery Emporium", 44, 53], ["Jatix's Herblore Shop", 45, 53], ['Ye olde Tea Shoppe', 51, 53],
    ];
    for (const [name, cx, cy] of shops) {
      expect(evaluateEntityAccess(name, 'shop', { cx, cy }, everything(), 'vanilla', service), name)
        .toEqual({ status: 'ALLOWED', reasons: [] });
    }
  });
});

/** Every quest but these. */
const questsWithout = (...missing: string[]) => Object.keys(QUEST_DATA).filter(quest => !missing.includes(quest));

describe('G4: each Farming Guild patch opens at its own tier', () => {
  const FARMING_GUILD = { cx: 19, cy: 58 };
  // The wiki's tiers (Farming Guild, oldid 15274002): beginner 45, intermediate 65, advanced 85.
  const TIERS: [string, number][] = [
    ['Allotment patch', 45], ['Flower Patch', 45], ['Bush Patch', 45], ['Cactus patch', 45],
    ['Herb patch', 65], ['Tree patch', 65], ['Anima patch', 65],
    ['Fruit Tree Patch', 85], ['Spirit Tree Patch', 85], ['Celastrus patch', 85], ['Redwood tree patch', 85],
  ];

  it.each(TIERS)('%s needs %i Farming and the guild', (patch, level) => {
    const access = (unlocks: UnlockState) => evaluateEntityAccess(patch, 'object', FARMING_GUILD, unlocks, 'vanilla', service);
    expect(access(everything(level))).toEqual({ status: 'ALLOWED', reasons: [] });
    expect(access(everything(level - 1))).toEqual({ status: 'NOT_READY', reasons: [`Farming level ${level}`] });
    expect(access(everything(99, { guilds: GUILDS_LIST.filter(guild => guild !== 'Farming Guild') })))
      .toEqual({ status: 'NOT_READY', reasons: ['Farming Guild'] });
  });

  it("leaves none of the source's tier wording, which no gate could check", () => {
    expect(JSON.stringify(content)).not.toContain('Access the Farming Guild#');
  });
});

describe('G5: the disease-free herb patches need the quests that open them', () => {
  // Herb patch, oldid 15359652: "unlocked with My Arm's Big Adventure and Making Friends with My Arm".
  it.each([
    ['Troll Stronghold', 44, 57, "My Arm's Big Adventure"],
    ['Weiss', 44, 61, 'Making Friends with My Arm'],
  ] as const)('the herb patch at %s needs %s', (_place, cx, cy, quest) => {
    const access = (unlocks: UnlockState) => evaluateEntityAccess('Herb patch', 'object', { cx, cy }, unlocks, 'vanilla', service);
    expect(access(everything())).toEqual({ status: 'ALLOWED', reasons: [] });
    expect(access(everything(99, { quests: questsWithout(quest) }))).toEqual({ status: 'NOT_READY', reasons: [quest] });
  });
});

/** The bank at this canonical chunk id, as the chunk panel and the RuneLite export judge it. */
const bankAccess = (id: string, unlocks: UnlockState) => {
  const coord = { cx: Math.floor(Number(id) / 256), cy: Number(id) % 256 };
  return evaluateBankRequirements(service.contentFor(coord.cx, coord.cy)!, coord, unlocks, service, 'vanilla');
};

describe('B1: a bank inside a guild needs the guild', () => {
  // The Hunter Guild's bank chest stands outside the guild (data/activityRequirements.ts).
  const OUTSIDE = new Set(['Hunter Guild']);
  const guildBanks = BANKS.flatMap(bank => {
    const guild = GUILDS_LIST.find(name => bank.name.includes(name));
    return guild && !OUTSIDE.has(guild) ? [{ id: bank.id, bank: bank.name, guild }] : [];
  });

  it('finds every guild bank', () => {
    expect(guildBanks.map(({ bank }) => bank).sort()).toEqual([
      'Crafting Guild', 'East Woodcutting Guild deposit box', 'Farming Guild', 'Fishing Guild',
      "Legends' Guild", "Myths' Guild", "Warriors' Guild", 'West Woodcutting Guild',
    ]);
  });

  it('opens each to a run that owns the guild and meets its entry requirement, and to no other', () => {
    for (const { id, bank, guild } of guildBanks) {
      expect(bankAccess(id, everything()), bank).toEqual({ status: 'ALLOWED', reasons: [] });
      const unowned = bankAccess(id, everything(99, { guilds: GUILDS_LIST.filter(name => name !== guild) }));
      expect(unowned.status, bank).toBe('NOT_READY');
      expect(unowned.reasons, bank).toContain(guild);
      const entry = getActivityReq(guild)!;
      // Below the guild's level, or without its quest.
      const short = entry.quests?.length ? everything(99, { quests: questsWithout(...entry.quests) }) : everything(1);
      expect(bankAccess(id, short).status, `${bank} without its entry requirement`).toBe('NOT_READY');
    }
  });
});

describe('B2: a town bank built in a quest needs the quest', () => {
  // List of banks, oldid 15315317.
  it.each([
    ['11310', 'Shilo Village', 'Shilo Village'], ['13099', 'Sophanem', 'Contact!'],
    ['9265', 'Lletya', "Mourning's End Part I"], ['10284', 'Corsair Cove', 'The Corsair Curse'],
    ['10300', 'Etceteria', 'Throne of Miscellania'], ['9275', 'Neitiznot', 'The Fremennik Isles'],
    ['9531', 'Jatizso', 'The Fremennik Isles'], ['13874', 'Burgh de Rott', 'In Aid of the Myreque'],
    ['14388', 'Darkmeyer', 'Sins of the Father'],
  ])('bank %s (%s) needs %s', (id, _bank, quest) => {
    expect(bankAccess(id, everything())).toEqual({ status: 'ALLOWED', reasons: [] });
    const without = bankAccess(id, everything(99, { quests: questsWithout(quest) }));
    expect(without.status).toBe('NOT_READY');
    expect(without.reasons).toContain(`Complete ${quest}`);
  });
});

describe('S14: any furnace smelts steel, mithril, adamantite and rune bars', () => {
  it.each([
    ['Steel Bar', 30, 'Iron Ore', 2], ['Mithril Bar', 50, 'Mithril Ore', 4],
    ['Adamantite Bar', 70, 'Adamantite Ore', 6], ['Rune Bar', 85, 'Runite Ore', 8],
  ] as const)('%s: %i Smithing at any furnace, with twice the Blast Furnace coal', (bar, level, ore, coal) => {
    expect(RESOURCE_MAP[bar].filter(source => source.type === 'SKILL' && source.name === 'Furnace')).toEqual([
      { type: 'SKILL', name: 'Furnace', regions: ['Any'], skills: { Smithing: level }, inputs: { [ore]: 1, Coal: coal } },
    ]);
  });

  it('plans a steel bar for a run that has no part of the Fremennik Province', () => {
    const state = createFreshState();
    state.gameModeId = 'vanilla';
    for (const skill of ['Smithing', 'Mining']) {
      state.unlocks.skills[skill] = 3;
      state.unlocks.levels[skill] = 30;
    }
    const routes = calculateSupplyChain('Steel Bar', state)!.sources;
    expect(state.unlocks.regions.some(region => /fremennik|rellekka|keldagrim/i.test(region))).toBe(false);
    expect(routes.find(route => route.source.name === 'Blast Furnace')!.status.isAvailable).toBe(false);
    expect(routes.find(route => route.source.name === 'Furnace')!.status).toMatchObject({ isAvailable: true, missing: [] });
  });
});

describe('reviewed chunk-content corrections', () => {
  it('cite a wiki revision for every rewrite and requirement, and reach the generated data', () => {
    for (const rewrite of contentOverrides.requirementRewrites) {
      expect(rewrite.source, rewrite.from).toMatch(/^https:\/\/oldschool\.runescape\.wiki\/w\/.+\?oldid=\d+$/);
      expect(rewrite.to.length, rewrite.from).toBeGreaterThan(0);
    }
    const taskUnlocks = content.taskUnlocks as Record<string, Record<string, Record<string, string[]>>>;
    for (const override of contentOverrides.entityRequirements) {
      const key = `${override.category}/${override.name}/${override.chunkId}`;
      expect(override.source, key).toMatch(/^https:\/\/oldschool\.runescape\.wiki\/w\/.+\?oldid=\d+$/);
      expect(taskUnlocks[override.category]?.[override.name]?.[override.chunkId], key)
        .toEqual([...override.requirements].sort());
    }
  });
});
