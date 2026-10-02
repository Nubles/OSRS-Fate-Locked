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
import { SKILL_UNLOCK_DATA } from './skillUnlocks';
import { resourceReqFor } from '../utils/chunkResources';
import { skillChunkNodes } from '../utils/skillChunkNodes';
import { chunkContentService } from '../services/ChunkContentService';
import { classifyShop } from '../utils/shopClassification';
import shopOverrides from './sources/shop-overrides.json';
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
  await chunkContentService.init();
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

describe('S16: the level gates agree with the skill table', () => {
  type Raw = { o?: [string, number][]; p?: string[]; m?: [string, number][] };
  const raw = content as unknown as { chunks: Record<string, Raw>; interiors: Record<string, { content: Raw }> };
  const entries = [...Object.values(raw.chunks), ...Object.values(raw.interiors).map(interior => interior.content)];
  const objects = [...new Set(entries.flatMap(entry => (entry.o ?? []).map(([name]) => name)))];
  /** "Lvl N: a, b" lines of one skill's table, as [N, item] pairs. */
  const unlocksOf = (skill: string) => Object.values(SKILL_UNLOCK_DATA[skill]).flat().flatMap(line => {
    const match = line.match(/^Lvl (\d+): (.+)$/);
    return match ? match[2].split(', ').map(item => [Number(match[1]), item] as const) : [];
  });

  it('opens each tree at the level its logs need', () => {
    const checked: string[] = [];
    for (const [level, item] of unlocksOf('Woodcutting')) {
      const logs = item.match(/^(.+) Logs$/)?.[1];
      if (!logs) continue;
      for (const name of objects.filter(object => object.toLowerCase().includes(`${logs.toLowerCase()} tree`) && !/patch/i.test(object))) {
        expect(resourceReqFor(name), name).toEqual({ skill: 'Woodcutting', level });
        checked.push(name);
      }
    }
    expect(checked).toEqual(expect.arrayContaining([
      'Jatoba tree', 'Mature juniper tree', 'Blisterwood Tree', 'Camphor tree', 'Ironwood tree', 'Rosewood tree',
    ]));
  });

  it('opens each impling at the level that catches it', () => {
    const hunter = new Map(skillChunkNodes('Hunter').map(node => [node.name.toLowerCase(), node.level]));
    const checked: string[] = [];
    for (const [level, item] of unlocksOf('Hunter')) {
      const kind = item.match(/^(.+) Implings$/)?.[1];
      if (!kind) continue;
      const name = `${kind.toLowerCase()} impling`;
      if (!hunter.has(name)) continue;
      expect(hunter.get(name), name).toBe(level);
      checked.push(name);
    }
    expect(checked.length).toBeGreaterThanOrEqual(11);
  });

  it('opens each stall the table names at its level', () => {
    const checked: string[] = [];
    for (const [level, item] of unlocksOf('Thieving')) {
      const kinds = item.match(/^(.+) Stalls$/)?.[1];
      if (!kinds) continue;
      for (const kind of kinds.split(' & ')) {
        const stall = kind === 'Vegetable' ? 'veg stall' : `${kind.toLowerCase()} stall`;
        for (const name of objects.filter(object => object.toLowerCase().startsWith(stall))) {
          expect(resourceReqFor(name), name).toEqual({ skill: 'Thieving', level });
          checked.push(name);
        }
      }
    }
    expect(checked).toEqual(expect.arrayContaining(['Veg stall', 'Fruit Stall', 'Ore stall', 'Tea stall', 'Gem stall']));
  });
});

type RawPlace = { s?: string[] };
const rawContent = content as unknown as {
  chunks: Record<string, RawPlace>;
  interiors: Record<string, { content: RawPlace; requirements: { shop?: Record<string, string[]> } }>;
  shopItems: Record<string, string[]>;
  taskUnlocks: { Shops?: Record<string, Record<string, string[]>> };
};
/** Every shop name in the data, placed or known only from its stock. */
const allShops = [...new Set([
  ...Object.values(rawContent.chunks).flatMap(entry => entry.s ?? []),
  ...Object.values(rawContent.interiors).flatMap(entry => entry.content.s ?? []),
  ...Object.keys(rawContent.shopItems),
])];

describe('S1 to S10: each shop sits in the category its stock calls for', () => {
  it('puts every shop the audit names where its stock belongs', () => {
    expect(Object.fromEntries([
      'The Runic Emporium', "Regath's Wares", 'The Lost Pickaxe', "King's Axe Inn", "Efaritay's Supplies",
      "Ivan's Supplies", "TzHaar-Hur-Tel's Equipment Store", "TzHaar-Hur-Zal's Equipment Store", 'Temple Supplies',
      "Sian's Ranged Weaponry", 'Ore seller',
    ].map(shop => [shop, classifyShop(shop)]))).toEqual({
      'The Runic Emporium': 'Magic Shops', "Regath's Wares": 'Magic Shops',
      'The Lost Pickaxe': 'Bars & Inns', "King's Axe Inn": 'Bars & Inns',
      "Efaritay's Supplies": 'Weapon Shops', "Ivan's Supplies": 'Weapon Shops',
      "TzHaar-Hur-Tel's Equipment Store": 'Weapon Shops', "TzHaar-Hur-Zal's Equipment Store": 'Weapon Shops',
      'Temple Supplies': 'Reward Shops', "Sian's Ranged Weaponry": 'Archery Shops', 'Ore seller': 'Ore Merchants',
    });
  });

  it('sells runes only in magic shops, but for one general store left for review', () => {
    // Durrik's Goods, a general store, also sells cosmic and death runes; the audit noted it,
    // and it has no ruling yet.
    const sellers = allShops.filter(shop => (rawContent.shopItems[shop.replace(/\.$/, '')] ?? []).some(item => / rune$/.test(item)));
    expect(sellers.filter(shop => classifyShop(shop) !== 'Magic Shops')).toEqual(["Durrik's Goods"]);
  });

  it('sells obsidian gear and the vampyre flails only in weapon shops', () => {
    const sellers = allShops.filter(shop => (rawContent.shopItems[shop.replace(/\.$/, '')] ?? [])
      .some(item => /^(toktz-|tzhaar-ket-|obsidian )|flail$|^sunspear$/i.test(item)));
    expect(sellers.length).toBeGreaterThanOrEqual(4);
    expect(sellers.filter(shop => classifyShop(shop) !== 'Weapon Shops')).toEqual([]);
  });

  it("opens Efaritay's Supplies only after The Blood Moon Rises (S5)", () => {
    const shop = (unlocks: UnlockState) => evaluateEntityAccess("Efaritay's Supplies", 'shop', { cx: 56, cy: 52, sourceId: '10105' }, unlocks, 'vanilla', service);
    expect(shop(everything())).toEqual({ status: 'ALLOWED', reasons: [] });
    expect(shop(everything(99, { quests: questsWithout('The Blood Moon Rises') }))).toEqual({ status: 'NOT_READY', reasons: ['The Blood Moon Rises'] });
  });
});

describe('reviewed shop records', () => {
  it('cite a wiki revision, and give every place the shop stands its requirements', () => {
    for (const record of shopOverrides.records as Array<{ name: string; source: { url: string; revision: number }; requirements?: string[]; replaces?: string[] }>) {
      expect(record.source.url, record.name).toMatch(new RegExp(`\\?oldid=${record.source.revision}$`));
      if (!record.requirements?.length && !record.replaces?.length) continue;
      const places = [
        ...Object.entries(rawContent.chunks).filter(([, entry]) => entry.s?.includes(record.name))
          .map(([id]) => rawContent.taskUnlocks.Shops?.[record.name]?.[id] ?? []),
        ...Object.values(rawContent.interiors).filter(entry => entry.content.s?.includes(record.name))
          .map(entry => entry.requirements.shop?.[record.name] ?? []),
      ];
      expect(places.length, record.name).toBeGreaterThan(0);
      for (const requirements of places) {
        expect(requirements, record.name).toEqual(expect.arrayContaining(record.requirements ?? []));
        for (const replaced of record.replaces ?? []) expect(requirements, record.name).not.toContain(replaced);
      }
    }
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
