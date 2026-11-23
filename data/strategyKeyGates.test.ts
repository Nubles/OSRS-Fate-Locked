// Strategy Guide entries whose content sits behind a Key the run must roll:
// a boss's drops, a minigame's or guild's rewards, a teleport or spell that
// uses a Mobility or Arcana Key, a patch that uses a Farming Patches Key.
// Each one must ask for that Key, both on its guide card and on a pinned goal,
// and stop asking once the Key is held. The sweep at the end catches a new
// entry that names a boss, minigame or guild but asks for no Key.
import { describe, expect, it } from 'vitest';
import { STRATEGY_DATABASE } from './requirements';
import { QUEST_DATA } from './questData';
import { DIARY_DATA } from './diaryData';
import { analyzeRequirement } from '../components/StrategyGuide';
import { calculateGoalProgress } from '../utils/goalLogic';
import { TableType, type UnlockState } from '../types';
import { BOSSES_LIST, GUILDS_LIST, MINIGAMES_LIST, REGIONS_LIST, SKILLS_LIST } from '../constants';

type KeyTable = 'bosses' | 'minigames' | 'guilds' | 'mobility' | 'arcana' | 'farming' | 'merchants';
/** One Key an entry needs: any one of these names, held in this table. */
type KeyNeed = { table: KeyTable; any: string[] };
const B = (...any: string[]): KeyNeed => ({ table: 'bosses', any });
const M = (...any: string[]): KeyNeed => ({ table: 'minigames', any });
const G = (...any: string[]): KeyNeed => ({ table: 'guilds', any });
const MOB = (...any: string[]): KeyNeed => ({ table: 'mobility', any });
const ARC = (...any: string[]): KeyNeed => ({ table: 'arcana', any });
const FARM = (...any: string[]): KeyNeed => ({ table: 'farming', any });
const MER = (...any: string[]): KeyNeed => ({ table: 'merchants', any });

/** Every entry whose content comes from one Key-locked source (Wiki source in brackets). */
const KEY_GATED: Record<string, KeyNeed[]> = {
  // Bosses
  'Hydra Leather': [B('Alchemical Hydra')], // Hydra leather: dropped by the Alchemical Hydra
  'Ferocious Gloves': [B('Alchemical Hydra')],
  'Crystal Tool Seed': [B('Zalcano')], // Crystal tool seed: a drop from Zalcano
  'Pyromancer Outfit': [B('Wintertodt')], // Pyromancer outfit: Wintertodt reward cart
  'Dragon Axe (Wintertodt)': [B('Wintertodt')],
  'Dragon Harpoon (Tempoross)': [B('Tempoross')],
  "Scorpia's Cave": [B('Scorpia')], // Odium/Malediction shard 3: dropped by Scorpia
  'Eternal/Pegasian/Primordial Crystals': [B('Cerberus')],
  'Mud Battlestaff': [B('Dagannoth Kings')],
  'Seercull': [B('Dagannoth Kings')],
  'Warrior Ring': [B('Dagannoth Kings')],
  'Berserker Ring': [B('Dagannoth Kings')],
  'Archers Ring': [B('Dagannoth Kings')],
  'Seers Ring': [B('Dagannoth Kings')],
  'Dragon Axe (Dagannoth)': [B('Dagannoth Kings')],
  'Dragon Pickaxe (Chaos Ele)': [B('Chaos Elemental')],
  'Dragon Pickaxe (Wildy Bosses)': [B('Callisto', 'Venenatis', "Vet'ion")],
  'Dragon Pickaxe (KBD)': [B('King Black Dragon')],
  'Dragon Pickaxe (KQ)': [B('Kalphite Queen')],
  'Godsword Assembly': [B('General Graardor', 'Commander Zilyana', "Kree'arra", "K'ril Tsutsaroth")],
  'Avernic Defender': [B('Theatre of Blood')],
  // Minigames
  "Farmer's Outfit": [M('Tithe Farm')],
  'Imbued Rings (NMZ)': [M('Nightmare Zone')],
  'Imbued Rings (Soul Wars)': [M('Soul Wars')],
  'Ectoplasmator': [M('Soul Wars')],
  'Imbued Rings (PvP Arena)': [M("Emir's Arena")], // Scroll of imbuing: Emir's Arena reward shop
  "Rogues' Outfit": [M("Rogues' Den")],
  'Wall Safes': [M("Rogues' Den")],
  "Zealot's Robes": [M("Shades of Mort'ton")],
  'Sacred Oil': [M("Shades of Mort'ton")],
  'Lumberjack Outfit': [M('Temple Trekking', 'Forestry')], // Lumberjack outfit: Forestry shop or Temple Trekking
  'Granite Body': [M('Barbarian Assault')],
  'Dragon Pickaxe (Volcanic Mine)': [M('Volcanic Mine')],
  'Mess Hall': [M('Mess')],
  // The competition is its own minigame Key, held inside the Ranging Guild.
  'Ranging Guild (Minigame)': [M('Archery Competition'), G('Ranging Guild')],
  // Guilds
  'Rune Defender': [G("Warriors' Guild")], // as Warriors' Guild (Cyclopes)
  "Warriors' Guild (Cyclopes)": [G("Warriors' Guild")],
  'Mining Gloves': [G('Mining Guild')], // Mining gloves: Mining Guild Mineral Exchange
  'Mining Guild (Amethyst)': [G('Mining Guild')],
  'Hunter Rumours': [G('Hunter Guild')], // Hunters' Rumours: the Burrow under the Hunter Guild
  'Redwoods': [G('Woodcutting Guild')], // Redwood tree: Woodcutting Guild
  "Champions' Challenge": [G("Champions' Guild")],
  "Heroes' Guild Dungeon (Blue Dragons)": [G("Heroes' Guild")],
  'Mystic Robes (Blue/Shop)': [G("Wizards' Guild")],
  // Merchants
  'Sawmill Operator': [MER('Sawmill Operators')],
  'Stonemason': [MER('Stonemasons')],
  // Mobility, Arcana and Farming Patches Keys
  'Fairy Ring DJR (Chasm)': [MOB('Fairy Rings')],
  'Fairy Ring BJS (Zulrah)': [MOB('Fairy Rings')],
  'Fairy Ring DKS (Polar)': [MOB('Fairy Rings')],
  'Fairy Ring CIQ (Yanille)': [MOB('Fairy Rings')],
  'Fairy Ring ALP (Lighthouse)': [MOB('Fairy Rings')],
  'Fairy Ring CKS (Canifis)': [MOB('Fairy Rings')],
  'Fairy Ring DKP (Karambwan)': [MOB('Fairy Rings')],
  'Fairy Ring BIP (Poly)': [MOB('Fairy Rings')],
  'Fairy Ring CIR (Mount K)': [MOB('Fairy Rings')],
  'Fairy Ring BLP (TzHaar)': [MOB('Fairy Rings')],
  'Games Necklace (Wintertodt)': [MOB('Jewelry Teleports')],
  'Games Necklace (Barb Assault)': [MOB('Jewelry Teleports')],
  'Dueling Ring (Ferox)': [MOB('Jewelry Teleports')],
  'Dueling Ring (Castle Wars)': [MOB('Jewelry Teleports')],
  'Necklace of Passage': [MOB('Jewelry Teleports')],
  'Skills Necklace': [MOB('Jewelry Teleports')],
  'Combat Bracelet': [MOB('Jewelry Teleports')],
  'Ring of Wealth (Miscellania)': [MOB('Jewelry Teleports')],
  'Superglass Make': [ARC('Lunar Spellbook')],
  'Tan Leather (Spell)': [ARC('Lunar Spellbook')],
  'Magic Imbue': [ARC('Lunar Spellbook')],
  'Spin Flax': [ARC('Lunar Spellbook')],
  'Plank Make': [ARC('Lunar Spellbook')],
  'Resurrect Crops': [ARC('Arceuus Spellbook')],
  'Demonic Offering': [ARC('Arceuus Spellbook')],
  'Dark Lure': [ARC('Arceuus Spellbook')],
  'Degrime (Herbs)': [ARC('Arceuus Spellbook')],
  'Farming Guild Spirit Tree': [G('Farming Guild'), FARM('Spirit Tree')],
  'Port Sarim Spirit Tree': [FARM('Spirit Tree')],
  'Etceteria Spirit Tree': [FARM('Spirit Tree')],
  'Brimhaven Spirit Tree': [FARM('Spirit Tree')],
  'Hosidius Spirit Tree': [FARM('Spirit Tree')],
  'Harmony Island (Herb Patch)': [FARM('Herb')],
};

/** Everything but Keys: every region, skill at 99, quest and diary. */
const everythingButKeys = (): UnlockState => ({
  equipment: {}, regions: [...REGIONS_LIST],
  skills: Object.fromEntries(SKILLS_LIST.map(s => [s, 10])),
  levels: Object.fromEntries(SKILLS_LIST.map(s => [s, 99])),
  mobility: [], arcana: [], housing: [], merchants: [], minigames: [],
  bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [],
  quests: Object.keys(QUEST_DATA), diaries: Object.keys(DIARY_DATA), cas: [], completedTasks: [], collectionLog: {},
});

const unlockText = (need: KeyNeed) => 'Unlock: ' + need.any.join(' or ');

describe('Strategy Guide entries ask for the Key of the content they come from', () => {
  for (const [key, needs] of Object.entries(KEY_GATED)) {
    it(key, () => {
      const req = STRATEGY_DATABASE[key];
      expect(req, key).toBeDefined();
      const none = everythingButKeys();
      expect(analyzeRequirement(req, none, 'vanilla').isCategoryUnlocked).toBe(false);
      const missing = calculateGoalProgress(req, none, 'vanilla').missing.filter(m => m.startsWith('Unlock: '));
      expect(missing).toEqual(needs.map(unlockText));

      // Each Key is needed: holding all the others is not enough.
      needs.forEach((_, skip) => {
        const partial = everythingButKeys();
        needs.forEach((need, i) => { if (i !== skip) partial[need.table] = [need.any[0]]; });
        expect(analyzeRequirement(req, partial, 'vanilla').isCategoryUnlocked).toBe(false);
      });
      // Any one name of each Key will do.
      for (const pick of [0, -1]) {
        const held = everythingButKeys();
        for (const need of needs) held[need.table] = [need.any.at(pick)!];
        expect(analyzeRequirement(req, held, 'vanilla').isCategoryUnlocked).toBe(true);
        expect(calculateGoalProgress(req, held, 'vanilla').missing.filter(m => m.startsWith('Unlock: '))).toEqual([]);
      }
    });
  }
});

describe('a Key-gated entry is never read as a quest', () => {
  it('no entry outside the quest category has a quest name as its id', () => {
    // A goal card judges an id that names a quest as that quest, whatever its category.
    // Royal Trouble (More Resources) is that quest's own reward, so it follows the quest on purpose.
    const questReward = new Set(['Royal Trouble (More Resources)']);
    const clashes = Object.entries(STRATEGY_DATABASE)
      .filter(([key, req]) => req.category !== TableType.QUESTS && QUEST_DATA[req.id] && !questReward.has(key))
      .map(([key, req]) => `${key} (${req.id})`);
    expect(clashes).toEqual([]);
  });
});

// Names too general to mean the Key when they appear in a description.
const GENERIC = new Set(['Mess', 'Forestry', 'Shooting Stars', 'Mage Arena']);
const KEYED_SOURCES = [...new Set([...BOSSES_LIST, ...MINIGAMES_LIST, ...GUILDS_LIST])].filter(n => !GENERIC.has(n));
const mentions = (text: string, name: string) =>
  new RegExp(`(^|[^A-Za-z'])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^A-Za-z])`, 'i').test(text);

/**
 * Entries that name a boss, minigame or guild in their description but are
 * not its rewards, so they rightly ask for no Key of it.
 */
const NAMES_A_SOURCE_BUT_FREE: Record<string, string> = {
  'Dark Totem': 'The totem pieces drop in the Catacombs of Kourend; only Skotizo itself is the boss Key.',
  'Limestone Mine': 'A free mine; Temple Trekking is only one use of its limestone.',
  'Potato Cactus (Kalphite)': 'Ground spawns in the Kalphite Lair, not drops of the Kalphite Queen.',
  'Seedicide': 'No such item in the game (left for the owner); it asks for no Key until then.',
};

describe('a new entry that names a Key-locked source asks for its Key', () => {
  it('every entry whose description names a boss, minigame or guild is Key-gated or listed as free', () => {
    const none = everythingButKeys();
    const unlisted: string[] = [];
    for (const [key, req] of Object.entries(STRATEGY_DATABASE)) {
      if (req.category === TableType.QUESTS || req.category === TableType.DIARIES) continue;
      const named = KEYED_SOURCES.filter(name => mentions(req.description ?? '', name));
      if (!named.length || key in NAMES_A_SOURCE_BUT_FREE) continue;
      if (analyzeRequirement(req, none, 'vanilla').isCategoryUnlocked) unlisted.push(`${key} (${named.join(', ')})`);
    }
    expect(unlisted).toEqual([]);
  });
  it('the free list holds only entries that exist and still ask for no Key', () => {
    const none = everythingButKeys();
    for (const key of Object.keys(NAMES_A_SOURCE_BUT_FREE)) {
      expect(STRATEGY_DATABASE[key], key).toBeDefined();
      expect(analyzeRequirement(STRATEGY_DATABASE[key], none, 'vanilla').isCategoryUnlocked, key).toBe(true);
    }
  });
});
