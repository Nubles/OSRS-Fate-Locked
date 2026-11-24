/**
 * Builds data/chunkSkillNodes.ts: for each land chunk, the lowest tier at
 * which each skill can be trained there, from public/chunk-content.json. Chunked
 * mode's Skills rolls read it (utils/chunkedSkillPool.ts), so a Skills Key
 * only lands on a skill the run's chunks have something for.
 *
 * Besides real skills, three facts feed derived skills at roll time:
 *   @monster  something to fight (melee, Ranged, Magic, Prayer from bones)
 *   @slayer   a Slayer master
 *   @herb     a herb patch (Herblore's herbs)
 * Interiors count for the chunk they are entered from, when that entrance has
 * no requirements.
 *
 * Next to the facts it writes what the roll engine checks against the run:
 *   CHUNK_FARMING_PATCHES  each chunk's patch types and the level each needs,
 *                          so Farming counts only for patch types the run has
 *   CHUNK_ORE_SHOPS        chunks with a shop selling ore or bars (Smithing's
 *                          input without Mining): the shop's merchant type and
 *                          the Smithing level its stock first trains. Thieving
 *                          stalls are left out: the player steals from them.
 *   CHUNK_SKILL_SERVICES   what a skill needs from someone in the chunk, with
 *                          the merchant type that must be unlocked ('' none):
 *                          an essence mine teleport (Runecraft), an estate
 *                          agent, a sawmill or a plank shop (Construction), a
 *                          Hunter shop's traps (Hunter)
 *   CHUNK_ENTRY_QUESTS     the quests a chunk's entry needs (questSections and
 *                          ENTRY_QUEST_CHUNKS), so its content counts only
 *                          once those quests are done
 *   CHUNK_GUILD_GATES      chunks whose skill content sits inside a guild, so
 *                          it counts only with that guild unlocked
 *   CHUNK_PATCH_LOCKS      patches the game locks behind a quest or a diary
 *                          beyond the chunk's entry (PATCH_LOCKS)
 *   CHUNK_SERVICE_LOCKS    services whose only shop in the chunk the game
 *                          locks behind a quest, a guild or a level (SHOP_LOCKS)
 */
import { farmingPatchOf, trainingReqFor } from './skillChunkNodes';
import type { EntityKind } from '../services/ChunkContentService';
import { ALL_CHUNK_KEYS } from './chunkAdjacency';
import { tierBand, tierForLevel } from './skillTiers';
import { classifyShop } from './shopClassification';

type RawEntry = { m?: [string, number, number?][]; p?: string[]; o?: [string, number][]; s?: string[] };
interface RawDoc {
  chunks: Record<string, RawEntry>;
  interiors?: Record<string, { name?: string; content: RawEntry; entrances: { chunkId: string; requirements: string[] }[] }>;
  slayerMasters?: Record<string, unknown>;
  shopItems?: Record<string, string[]>;
  questSections?: Record<string, string[]>;
}

export type ChunkSkillNodes = Record<string, Record<string, number>>;

export interface ChunkSkillData {
  /** Per chunk, each fact's lowest level. */
  nodes: ChunkSkillNodes;
  /** Per chunk, each Farming patch type's level there. */
  patches: Record<string, Record<string, number>>;
  /** Per chunk with an ore or bar shop: each shop's merchant type and the lowest Smithing level its stock trains. */
  oreShops: Record<string, Record<string, number>>;
  /** Per service (SKILL_SERVICES), the chunks offering it and the merchant type it needs ('' for none). */
  services: Record<string, Record<string, string>>;
  /** Per chunk with facts, the quests its entry needs. */
  entryQuests: Record<string, string[]>;
  /** Per chunk, the guild its skills' content needs: [skills, guild]. */
  guildGates: Record<string, [string[], string]>;
  /** Per chunk, its patch types the game locks behind a quest or a diary (PATCH_LOCKS). */
  patchLocks: Record<string, Record<string, PatchLock>>;
  /** Per chunk, the services offered there only by a locked shop (SHOP_LOCKS), with the lock. */
  serviceLocks: Record<string, Record<string, ShopLock>>;
}

const HERB_PATCH = /\bherb patch\b/i;
const key = (id: string | number) => `${Math.floor(Number(id) / 256)},${Number(id) % 256}`;

/**
 * Agility courses, by the chunk their first obstacle stands in, at the course's
 * level (OSRS Wiki course requirements). The generic obstacle names ("Gap",
 * "Tightrope") say nothing about the course, so each entry names one obstacle
 * (or the interior entered from the chunk) that must be there; a course whose
 * marker leaves the data is dropped, and a test lists it. Shortcuts are left
 * out on purpose: most give no Agility experience, so a chunk with only a
 * shortcut can't train the skill, and counting it would hold Fate's Mercy shut.
 * Left out too: Ape Atoll (48, needs Monkey Madness I), the Werewolf course and
 * the Hallowed Sepulchre (their entrances have requirements), Prifddinas and
 * Dorgesh-Kaan (not in the data).
 */
export const AGILITY_COURSES: readonly { course: string; chunk: string; level: number; marker: string }[] = [
  { course: 'Gnome Stronghold Agility Course', chunk: '38,53', level: 1, marker: 'Log balance' },
  { course: 'Brimhaven Agility Arena', chunk: '43,49', level: 1, marker: 'Brimhaven Agility Arena' },
  // Draynor's 10 and the Shayzien basic course's 5 were removed on 8 May 2024; the Shayzien basic
  // and advanced courses both start at its Monkeybars, so the chunk's lowest is the basic course's 1.
  { course: 'Draynor Village Rooftop Course', chunk: '48,51', level: 1, marker: 'Tightrope' },
  { course: 'Al Kharid Rooftop Course', chunk: '51,49', level: 20, marker: 'Zip line' },
  { course: 'Varrock Rooftop Course', chunk: '50,53', level: 30, marker: 'Clothes line' },
  { course: 'Agility Pyramid', chunk: '52,44', level: 30, marker: 'Climbing rocks (Agility Pyramid entrance)' },
  { course: 'Barbarian Outpost Agility Course', chunk: '39,55', level: 35, marker: 'Ropeswing' },
  { course: 'Canifis Rooftop Course', chunk: '54,54', level: 40, marker: 'Tall tree' },
  { course: 'Shayzien Agility Course', chunk: '24,56', level: 1, marker: 'Monkeybars' },
  { course: 'Falador Rooftop Course', chunk: '47,52', level: 50, marker: 'Hand holds' },
  { course: 'Colossal Wyrm Agility Course', chunk: '25,45', level: 50, marker: 'Tightrope' },
  { course: 'Wilderness Agility Course', chunk: '46,61', level: 52, marker: 'Ropeswing' },
  { course: "Seers' Village Rooftop Course", chunk: '42,54', level: 60, marker: 'Tightrope' },
  { course: 'Pollnivneach Rooftop Course', chunk: '52,46', level: 70, marker: 'Tree (Pollnivneach Rooftop Course)' },
  { course: 'Rellekka Rooftop Course', chunk: '41,57', level: 80, marker: 'Pile of fish' },
  { course: 'Ardougne Rooftop Course', chunk: '41,51', level: 90, marker: 'Wooden Beams' },
];

/**
 * Each Mysterious ruins by its chunk: the altar it leads to and that altar's
 * Runecraft level (OSRS Wiki). Ruins in a chunk missing here train nothing; a
 * test checks every ruins in the data is listed. The cosmic (Zanaris, Lost
 * City), death (Mourning's End Part II) and blood (the inner Meiyerditch
 * Laboratories, Sins of the Father) ruins sit behind entrances with
 * requirements, so they never reach a chunk.
 */
export const RUNE_ALTAR_RUINS: Readonly<Record<string, { altar: string; level: number }>> = {
  '46,51': { altar: 'Air', level: 1 },
  '46,54': { altar: 'Mind', level: 2 },
  '49,49': { altar: 'Water', level: 5 },
  '51,54': { altar: 'Earth', level: 9 },
  '51,50': { altar: 'Fire', level: 14 },
  '47,53': { altar: 'Body', level: 20 },
  '47,56': { altar: 'Chaos', level: 35 },
  '44,47': { altar: 'Nature', level: 44 },
  '44,52': { altar: 'Law', level: 54 },
  '38,44': { altar: 'Wrath', level: 95 },
};
/**
 * Rows of a named interior that the name-only rules would misread there. The
 * Abandoned Mine's records also hold plain "Ore vein" rows, and the Wiki gives
 * "Ore vein" only for the Motherlode Mine, so they stay uncounted (the mine's
 * named veins still count). The second Braindeath Island record names its
 * Rum Deal spots plain "Fishing spot" (the first says "Fishing spot
 * (Braindeath Island)", which the resource rules drop); the island has no
 * other fishing. The Rogues' Den's 10-coin chest is in the maze's chest room
 * (OSRS Wiki 'Chest (10 coins)' puts it at 3053,5037, in the maze region, not
 * the lobby), and the Wiki ('Rogues' Den') says entering the maze "requires
 * level 50 in both Thieving and Agility", so it does not lower the chunk's
 * Thieving floor.
 */
const INTERIOR_NOT_TRAINING: Readonly<Record<string, RegExp>> = {
  'Abandoned Mine': /^ore vein$/i,
  'Braindeath Island': /^fishing spot$/i,
  "Rogues' Den": /^chest \(10 coins\)$/i,
};
const RUNE_ALTAR_INTERIOR = /^(air|mind|water|earth|fire|body|cosmic|chaos|astral|nature|law|death|blood|soul|wrath) altar$/i;

/**
 * Guild chunks whose skill content is inside the guild: each skill listed
 * needs the guild's own level (OSRS Wiki entry requirements) and, at roll
 * time, the guild unlock. The Crafting Guild's potter's wheels, pottery oven
 * and spinning wheels need its 40 Crafting; its mine's rocks keep their own
 * level (1), since its entry level is in Crafting, not Mining.
 */
export const GUILD_CHUNKS: Readonly<Record<string, { guild: string; skills: Readonly<Record<string, number>> }>> = {
  '40,53': { guild: 'Fishing Guild', skills: { Fishing: 68 } },
  '19,58': { guild: 'Farming Guild', skills: { Farming: 45 } },
  '24,54': { guild: 'Woodcutting Guild', skills: { Woodcutting: 60 } },
  '25,54': { guild: 'Woodcutting Guild', skills: { Woodcutting: 60 } },
  '45,51': { guild: 'Crafting Guild', skills: { Mining: 1, Crafting: 40 } },
};

/**
 * Guild chunks whose patches sit in wings with a higher level than the
 * guild's own (GUILD_CHUNKS): the Farming Guild's beginner tier (45) holds the
 * allotment, flower, bush and cactus patches, its west wing (65) the herb,
 * tree, Hespori and anima patches, its north wing (85) the fruit tree, spirit
 * tree, celastrus and redwood patches (OSRS Wiki 'Farming Guild').
 */
export const GUILD_PATCH_LEVELS: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  '19,58': { Herb: 65, 'Wood Tree': 65, 'Hespori Patch': 65, Anima: 65, 'Fruit Tree': 85, 'Spirit Tree': 85, Celastrus: 85, Redwood: 85 },
};

/** A quest (QUEST_DATA id) or an achievement diary tier (DIARY_DATA id) a patch needs done. */
export interface PatchLock { quest?: string; diary?: string }

/**
 * Patches the game locks behind a quest or a diary beyond the chunk's own
 * entry (OSRS Wiki 'Farming/Patch locations', 'Herb patch'). Each counts for
 * Farming, and a herb patch for Herblore, only once the run has it done. The
 * tracker records a quest only as done, so a patch the game opens partway
 * through a quest (The Summer Shore's) waits for the whole quest.
 */
export const PATCH_LOCKS: Readonly<Record<string, Readonly<Record<string, PatchLock>>>> = {
  '44,57': { Herb: { quest: "My Arm's Big Adventure" } }, // Troll Stronghold roof
  '44,61': { Herb: { quest: 'Making Friends with My Arm' } }, // Weiss: the Fire of Nourishment must be built too
  '59,44': { Herb: { diary: 'Morytania Elite' } }, // Harmony Island (its allotment is open)
  '26,46': { 'Hardwood Tree': { quest: 'The Ribbiting Tale' } }, // Locus Oasis
  '48,37': { Calquat: { quest: 'Troubled Tortugans' } }, // The Summer Shore: partial completion in the game
};

/**
 * Places the game opens only through a quest, beyond the chunk content's own
 * questSections (OSRS Wiki, each place's own page, 24 Nov 2026). A chunk here
 * counts only once the run has done every quest listed, merged with its
 * questSections (Morytania's Priest in Peril). The tracker records a quest
 * only as done, so a place the game opens partway through a quest (Jatizso,
 * Neitiznot, Tirannwn, Lletya, Weiss, Darkmeyer, Meiyerditch, the
 * Stranglewood) waits for the whole quest. Every way into each place needs
 * its quest, Sailing moorings included. Edge chunks that also hold land open
 * without the quest stay out: 36,58 (the Piscatoris Fishing Colony's north
 * shore), 18,53 (the Kebos coast by the Stranglewood rowboat), 37,52 (east of
 * the Arandar gate), 37,51 (Arandar Mountain above the Kandarin side), 34,48
 * and 35,48 (the Poison Waste, whose fairy ring DLR needs no quest), 35,47
 * (the sea south of Zul-Andra), 57,52 (East Darkmeyer runs into the swamp
 * that Slepe opens onto) and 44,62 (Weiss's shore, salvaged from a boat).
 */
export const ENTRY_QUEST_CHUNKS: Readonly<Record<string, readonly string[]>> = {
  // Neitiznot, Jatizso and the ice troll isles north of them: the Gunnars ferries open
  // once The Fremennik Isles is started, mooring needs it done.
  '36,59': ['The Fremennik Isles'], '37,59': ['The Fremennik Isles'],
  '36,60': ['The Fremennik Isles'], '37,60': ['The Fremennik Isles'],
  // Lunar Isle: "accessible to members who have progressed far enough into Lunar Diplomacy".
  '32,60': ['Lunar Diplomacy'], '32,61': ['Lunar Diplomacy'], '33,60': ['Lunar Diplomacy'], '33,61': ['Lunar Diplomacy'],
  // Miscellania and Etceteria: the Rellekka boat and fairy ring CIP need The Fremennik Trials;
  // the ring of wealth (Throne of Miscellania) and the mooring (Royal Trouble) come after it.
  '39,59': ['The Fremennik Trials'], '39,60': ['The Fremennik Trials'], '40,60': ['The Fremennik Trials'], '41,60': ['The Fremennik Trials'],
  // Crandor: by boat during Dragon Slayer I, then only through the Crandor and Karamja Dungeon.
  '44,50': ['Dragon Slayer I'], '44,51': ['Dragon Slayer I'],
  // Corsair Cove Resource Area: past Haris or the dungeon gate once Dragon Slayer I is done.
  '38,45': ['Dragon Slayer I'],
  // Shilo Village: "accessible after completing the Shilo Village quest".
  '44,46': ['Shilo Village'],
  // Weiss and its salt mine: "All methods of accessing Weiss require at least partial
  // completion of the quest Making Friends with My Arm".
  '44,61': ['Making Friends with My Arm'],
  // Tirannwn west of Arandar (Isafdar, the Tyras and Iorwerth camps, Port Tyras, Zul-Andra):
  // the Underground Pass once Regicide is started, every other way once it is done.
  '33,47': ['Regicide'], '33,48': ['Regicide'], '33,49': ['Regicide'], '33,50': ['Regicide'],
  '34,47': ['Regicide'], '34,49': ['Regicide'], '34,50': ['Regicide'],
  '35,49': ['Regicide'], '35,50': ['Regicide'], '36,50': ['Regicide'], '36,51': ['Regicide'],
  // Lletya: inside Tirannwn, entered once Mourning's End Part I is started.
  '36,49': ['Regicide', "Mourning's End Part I"],
  // Meiyerditch: "must begin the Darkness of Hallowvale quest before they may travel to Meiyerditch".
  '56,49': ['Darkness of Hallowvale'], '56,50': ['Darkness of Hallowvale'], '56,51': ['Darkness of Hallowvale'],
  // Darkmeyer: "can be entered with partial completion of the quest Sins of the Father".
  '56,52': ['Sins of the Father'],
  // The Stranglewood: the Kebos rowboat "is only available after starting Desert Treasure II",
  // and the ring of shadows is its reward.
  '17,51': ['Desert Treasure II'], '17,52': ['Desert Treasure II'], '17,53': ['Desert Treasure II'],
  '18,51': ['Desert Treasure II'], '18,52': ['Desert Treasure II'],
};

/**
 * Player-owned house portals (Construction is trained in your house). The
 * Castle Wars and Trouble Brewing portals in the data are minigame portals.
 */
export const HOUSE_PORTAL_CHUNKS: readonly string[] = ['22,46', '27,54', '39,48', '41,56', '43,49', '45,54', '46,50', '52,46'];

/** Sailing starts at a port: a dock the boat ties up at, or a shipwright. */
const PORT_OBJECT = /^gangplank \(sailing\)$/i;
const PORT_NPC = /^shipwright \w+$/i;

/**
 * The Smithing level a shop's stock first trains (OSRS Wiki smelting and
 * smithing levels): bronze is made from copper and tin together; coal, gold
 * bars and silver bars alone train nothing at a furnace or anvil.
 */
export const oreShopSmithingLevel = (items: readonly string[]): number | null => {
  const stock = new Set(items.map(item => item.toLowerCase()));
  const levels = [
    stock.has('bronze bar') || (stock.has('copper ore') && stock.has('tin ore')) ? 1 : null,
    stock.has('iron ore') || stock.has('iron bar') ? 15 : null,
    stock.has('silver ore') ? 20 : null,
    stock.has('steel bar') ? 30 : null,
    stock.has('gold ore') ? 40 : null,
    stock.has('mithril ore') || stock.has('mithril bar') ? 50 : null,
    stock.has('adamantite ore') || stock.has('adamantite bar') ? 70 : null,
    stock.has('runite ore') || stock.has('runite bar') ? 85 : null,
  ].filter((level): level is number => level !== null);
  return levels.length > 0 ? Math.min(...levels) : null;
};
/** A Thieving stall in the data's shop list: "Ardougne Silver Stall" beside a "Silver stall" object. */
const STALL_SHOP = /\bstall$/i;

/**
 * Who in a chunk gives a skill what it needs to be trained, by service:
 *   essence      teleports to the Rune essence mine once Rune Mysteries is done
 *                (Aubury, Wizard Cromperty, Archmage Sedridor, Brimstail;
 *                Wizard Distentor is left out, he is inside the Wizards' Guild)
 *   estateAgent  sells a house (Real Estate Agents)
 *   sawmill      turns logs into planks (Sawmill Operators)
 *   planks       a shop selling planks, by its merchant type
 *   traps        a Hunter shop's snares and box traps (Hunter Shops)
 */
export const SKILL_SERVICES = ['essence', 'estateAgent', 'sawmill', 'planks', 'traps'] as const;

/** A quest (QUEST_DATA id), a guild (GUILDS_LIST name) and skill levels a shop needs before it trades. */
export interface ShopLock { quest?: string; guild?: string; skills?: Readonly<Record<string, number>> }

/**
 * Skill shops the game locks beyond their chunk's entry. Razmire Builders
 * Merchants (Mort'ton) needs Shades of Mort'ton done (OSRS Wiki rev 15318751);
 * Imia's Supplies is inside the Hunter Guild and, like all its amenities,
 * needs 46 Hunter (rev 15399191). A service from a locked shop counts only once
 * the run has the lock; an unlocked shop in the same chunk wins over it.
 */
export const SHOP_LOCKS: Readonly<Record<string, ShopLock>> = {
  'Razmire Builders Merchants': { quest: "Shades of Mort'ton" },
  "Imia's Supplies": { guild: 'Hunter Guild', skills: { Hunter: 46 } },
};
const ESSENCE_NPC = /^(aubury|wizard cromperty|archmage sedridor|brimstail)$/i;
const ESTATE_AGENT_NPC = /^estate agent$/i;
const SAWMILL_NPC = /^sawmill operator$/i;

interface Source { entry: RawEntry; interior?: string }

export function buildChunkSkillNodes(doc: RawDoc): ChunkSkillData {
  const masters = new Set(Object.keys(doc.slayerMasters ?? {}));
  const shopItems = doc.shopItems ?? {};
  const oreShopLevels = new Map<string, number>();
  for (const [name, items] of Object.entries(shopItems)) {
    const level = oreShopSmithingLevel(items);
    if (level !== null && !STALL_SHOP.test(name) && classifyShop(name)) oreShopLevels.set(name, level);
  }
  const entriesById = new Map<string, Source[]>();
  const add = (id: string, source: Source) => entriesById.set(id, [...(entriesById.get(id) ?? []), source]);
  for (const [id, entry] of Object.entries(doc.chunks)) add(id, { entry });
  for (const interior of Object.values(doc.interiors ?? {})) {
    for (const route of interior.entrances) if (route.requirements.length === 0) add(route.chunkId, { entry: interior.content, interior: interior.name ?? '' });
  }
  const courses = new Map(AGILITY_COURSES.map(course => [course.chunk, course]));
  const nodes: ChunkSkillNodes = {};
  const patches: ChunkSkillData['patches'] = {};
  const oreShops: ChunkSkillData['oreShops'] = {};
  const services: ChunkSkillData['services'] = Object.fromEntries(SKILL_SERVICES.map(service => [service, {}]));
  const entryQuests: ChunkSkillData['entryQuests'] = {};
  const guildGates: ChunkSkillData['guildGates'] = {};
  const patchLocks: ChunkSkillData['patchLocks'] = {};
  const serviceLocks: ChunkSkillData['serviceLocks'] = {};
  for (const id of [...entriesById.keys()].sort((a, b) => Number(a) - Number(b))) {
    const chunk = key(id);
    if (!LAND.has(chunk)) continue;
    const guild = GUILD_CHUNKS[chunk];
    const floor = (skill: string, level: number) => Math.max(level, guild?.skills[skill] ?? 0);
    const patchFloor = (patch: string, level: number) => Math.max(floor('Farming', level), GUILD_PATCH_LEVELS[chunk]?.[patch] ?? 0);
    const facts: Record<string, number> = {};
    const note = (skill: string, level: number) => { facts[skill] = Math.min(facts[skill] ?? level, level); };
    const chunkPatches: Record<string, number> = {};
    const markers = new Set<string>();
    const chunkOreShops: Record<string, number> = {};
    const offers: Record<string, string> = {};
    const offerLocks: Record<string, ShopLock> = {};
    const offer = (service: typeof SKILL_SERVICES[number], merchant: string, lock?: ShopLock) => {
      // An unlocked shop beats a locked one; then one that needs no merchant beats one that does.
      const held = offerLocks[service];
      if (offers[service] !== undefined && !(held && !lock) && !(!held === !lock && merchant === '')) return;
      offers[service] = merchant;
      if (lock) offerLocks[service] = lock;
      else delete offerLocks[service];
    };
    for (const { entry, interior } of entriesById.get(id)!) {
      if (interior) markers.add(interior);
      for (const shop of entry.s ?? []) {
        const merchant = classifyShop(shop);
        const level = oreShopLevels.get(shop);
        if (merchant && level !== undefined) chunkOreShops[merchant] = Math.min(chunkOreShops[merchant] ?? level, level);
        if (merchant === 'Hunter Shops') offer('traps', merchant, SHOP_LOCKS[shop]);
        if (merchant && (shopItems[shop] ?? []).some(item => /^plank$/i.test(item))) offer('planks', merchant, SHOP_LOCKS[shop]);
      }
      for (const name of entry.p ?? []) {
        if (ESSENCE_NPC.test(name)) offer('essence', '');
        if (ESTATE_AGENT_NPC.test(name)) offer('estateAgent', 'Real Estate Agents');
        if (SAWMILL_NPC.test(name)) offer('sawmill', 'Sawmill Operators');
      }
      const named: [string, EntityKind][] = [
        ...(entry.o ?? []).map(([name]) => [name, 'object'] as [string, EntityKind]),
        ...(entry.p ?? []).map((name) => [name, 'npc'] as [string, EntityKind]),
        ...(entry.m ?? []).map(([name]) => [name, 'monster'] as [string, EntityKind]),
      ];
      for (const [name, kind] of named) {
        if (kind === 'object') markers.add(name);
        if ((kind === 'object' && PORT_OBJECT.test(name)) || (kind === 'npc' && PORT_NPC.test(name))) note('Sailing', 1);
        let req = trainingReqFor(name, kind);
        // A rune altar's own "Altar" is where runes are made, not a Prayer altar.
        if (req?.station && req.skill === 'Prayer' && interior && RUNE_ALTAR_INTERIOR.test(interior)) req = null;
        if (req && interior && INTERIOR_NOT_TRAINING[interior]?.test(name)) req = null;
        if (req && kind === 'object' && /^mysterious ruins$/i.test(name)) {
          const ruins = RUNE_ALTAR_RUINS[chunk];
          req = ruins ? { skill: 'Runecraft', level: ruins.level } : null;
        }
        const patch = kind === 'object' ? farmingPatchOf(name) : null;
        if (req) note(req.skill, patch && req.skill === 'Farming' ? patchFloor(patch, req.level) : floor(req.skill, req.level));
        if (patch && req) chunkPatches[patch] = Math.min(chunkPatches[patch] ?? 99, patchFloor(patch, req.level));
        if (kind === 'object' && HERB_PATCH.test(name) && patch === 'Herb') note('@herb', patchFloor(patch, req!.level));
        if (kind !== 'object' && masters.has(name)) note('@slayer', 1);
      }
      if ((entry.m ?? []).length > 0) note('@monster', 1);
    }
    const course = courses.get(chunk);
    if (course && markers.has(course.marker)) note('Agility', course.level);
    if (HOUSE_PORTAL_CHUNKS.includes(chunk) && markers.has('Portal')) note('Construction', 1);
    const hasShops = Object.keys(chunkOreShops).length > 0;
    if (Object.keys(facts).length === 0 && !hasShops && Object.keys(offers).length === 0) continue;
    if (Object.keys(facts).length > 0) nodes[chunk] = facts;
    if (Object.keys(chunkPatches).length > 0) patches[chunk] = chunkPatches;
    const locks = Object.entries(PATCH_LOCKS[chunk] ?? {}).filter(([type]) => chunkPatches[type] !== undefined);
    if (locks.length > 0) patchLocks[chunk] = Object.fromEntries(locks.map(([type, lock]) => [type, { ...lock }]));
    if (hasShops) oreShops[chunk] = chunkOreShops;
    for (const [service, merchant] of Object.entries(offers)) services[service][chunk] = merchant;
    if (Object.keys(offerLocks).length > 0) serviceLocks[chunk] = Object.fromEntries(Object.entries(offerLocks).map(([service, lock]) => [service, { ...lock }]));
    const quests = [...new Set([...(doc.questSections?.[id] ?? []), ...(ENTRY_QUEST_CHUNKS[chunk] ?? [])])];
    if (quests.length) entryQuests[chunk] = quests;
    const gatedSkills = Object.keys(guild?.skills ?? {}).filter(skill => facts[skill] !== undefined);
    if (guild && gatedSkills.length > 0) guildGates[chunk] = [gatedSkills, guild.guild];
  }
  return { nodes, patches, oreShops, services, entryQuests, guildGates, patchLocks, serviceLocks };
}

const LAND = new Set(ALL_CHUNK_KEYS);

/**
 * One fact's cell in a chunk's row: "." for none, else the tier of the lowest
 * level it needs (1-9, 0 for tier 10). A level above its tier's floor keeps
 * its exact value, which Chunked compares with the player's level (Al Kharid
 * rooftop is Agility 20, a tier-2 node a level-11 player can't use): a letter
 * for the tier (A for tier 10, B for tier 1 … J for tier 9), then how many
 * levels above the floor, so "B9" is level 10 and "J6" level 87.
 */
export const factCell = (level: number | undefined): string => {
  if (level === undefined) return '.';
  const tier = tierForLevel(level);
  const above = level - tierBand(tier).min;
  return above === 0 ? String(tier % 10) : `${String.fromCharCode(65 + (tier % 10))}${above}`;
};

/**
 * The generated file stores one string per chunk, one cell per fact in
 * CHUNK_SKILL_FACTS order (factCell). Compact because the roll engine loads
 * it with the app's first screen.
 */
export const chunkSkillNodesSource = (data: ChunkSkillData): string => {
  const { nodes } = data;
  const facts = [...new Set(Object.values(nodes).flatMap(Object.keys))].sort();
  const rows = Object.fromEntries(Object.entries(nodes).map(([key, levels]) => [key,
    facts.map(fact => factCell(levels[fact])).join('').replace(/\.+$/, '')]));
  // Patch types per chunk: one letter (its place in CHUNK_PATCH_TYPES) and its level, per type.
  const patchTypes = [...new Set(Object.values(data.patches).flatMap(Object.keys))].sort();
  const patches = Object.fromEntries(Object.entries(data.patches).map(([key, types]) => [key,
    Object.entries(types).sort(([a], [b]) => a.localeCompare(b))
      .map(([type, level]) => `${String.fromCharCode(97 + patchTypes.indexOf(type))}${level}`).join('')]));
  // Quest -> its chunks, as "cx:cy,cy-cy;cx:…" (runs of cy written as ranges).
  const questChunks: Record<string, string> = {};
  for (const quest of [...new Set(Object.values(data.entryQuests).flat())]) {
    const byColumn = new Map<number, number[]>();
    for (const [key, quests] of Object.entries(data.entryQuests)) {
      if (!quests.includes(quest)) continue;
      const [cx, cy] = key.split(',').map(Number);
      byColumn.set(cx, [...(byColumn.get(cx) ?? []), cy]);
    }
    questChunks[quest] = [...byColumn].sort(([a], [b]) => a - b).map(([cx, cys]) => {
      const runs: string[] = [];
      const sorted = [...cys].sort((a, b) => a - b);
      for (let i = 0; i < sorted.length; i++) {
        let j = i;
        while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
        runs.push(j === i ? `${sorted[i]}` : `${sorted[i]}-${sorted[j]}`);
        i = j;
      }
      return `${cx}:${runs.join(',')}`;
    }).join(';');
  }
  return `// AUTO-GENERATED by scripts/buildChunkSkillNodes.ts from public/chunk-content.json — do not edit by hand.\n`
    + `// Keyed "cx,cy"; one cell per fact: the tier its lowest level needs (0 = tier 10), "." for none. A level above\n`
    + `// its tier's floor is a letter for the tier (A = tier 10, B = tier 1 … J = tier 9) then how far above: "B9" is level 10.\n`
    + `// See utils/chunkSkillNodesBuild.ts.\n\n`
    + `export const CHUNK_SKILL_FACTS: readonly string[] = ${JSON.stringify(facts)};\n\n`
    + `export const CHUNK_SKILL_TIERS: Readonly<Record<string, string>> = ${JSON.stringify(rows)};\n\n`
    + `export const CHUNK_PATCH_TYPES: readonly string[] = ${JSON.stringify(patchTypes)};\n\n`
    + `// Farming patch types per chunk: a letter (a = CHUNK_PATCH_TYPES[0]) then the Farming level it needs.\n`
    + `export const CHUNK_FARMING_PATCHES: Readonly<Record<string, string>> = ${JSON.stringify(patches)};\n\n`
    + `// Chunk -> each ore or bar shop's merchant type and the Smithing level its stock first trains (no Thieving stalls).\n`
    + `export const CHUNK_ORE_SHOPS: Readonly<Record<string, Readonly<Record<string, number>>>> = ${JSON.stringify(data.oreShops)};\n\n`
    + `// Service -> chunk -> the merchant type it needs ("" for none): essence, estateAgent, sawmill, planks, traps.\n`
    + `export const CHUNK_SKILL_SERVICES: Readonly<Record<string, Readonly<Record<string, string>>>> = ${JSON.stringify(data.services)};\n\n`
    + `// Quest -> the chunks whose entry needs it: "cx:cy,cy-cy;cx:…".\n`
    + `export const CHUNK_ENTRY_QUESTS: Readonly<Record<string, string>> = ${JSON.stringify(questChunks)};\n\n`
    + `// Chunk -> [skills, guild]: those skills' content there is inside the guild.\n`
    + `export const CHUNK_GUILD_GATES: Readonly<Record<string, readonly [readonly string[], string]>> = ${JSON.stringify(data.guildGates)};\n\n`
    + `// Chunk -> patch type -> the quest or diary the game locks that patch behind.\n`
    + `export const CHUNK_PATCH_LOCKS: Readonly<Record<string, Readonly<Record<string, { readonly quest?: string; readonly diary?: string }>>>> = ${JSON.stringify(data.patchLocks)};\n\n`
    + `// Chunk -> service -> the quest, guild or levels its only shop there needs before it trades.\n`
    + `export const CHUNK_SERVICE_LOCKS: Readonly<Record<string, Readonly<Record<string, { readonly quest?: string; readonly guild?: string; readonly skills?: Readonly<Record<string, number>> }>>>> = ${JSON.stringify(data.serviceLocks)};\n`;
};
