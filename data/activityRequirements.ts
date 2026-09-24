// Access requirements (skill levels + quests) for Activities & Utility content.
//
// Surfaced on activity cards next to the region tag so a player can see, at a
// glance, what gates an activity: the quest(s) and skill level(s) actually
// required to access/fight it. Recommended (not required) levels are NOT listed
// here — only hard gates. Newer (2024-2026) bosses were verified against the
// OSRS Wiki; classic content from well-established requirements.
//
// Hard gates use structured fields; notes are descriptive only.

import { ACTIVITY_ACCESS_AREAS } from './activityAccess';
import type { QuestProgressRequirement } from './questProgress';

export interface ActivityReq {
  /** Hard skill-level gates, e.g. { Slayer: 91 }. */
  skills?: Record<string, number>;
  /** Required quests (canonical OSRS names; match QUEST_DATA where possible). */
  quests?: string[];
  /** Named areas that must be reachable in the selected game mode. */
  requiredAreas?: string[];
  /** Minimum real OSRS combat level. */
  combatLevel?: number;
  /** Minimum real OSRS total level. */
  totalLevel?: number;
  questPoints?: number;
  warriorsGuildEntry?: boolean;
  /** Explicitly incomplete access metadata must not imply readiness. */
  unverified?: boolean;
  /** External progress a player must explicitly confirm after machine gates pass. */
  manualRequirements?: string[];
  questProgress?: QuestProgressRequirement[];
  /** One complete route is sufficient, including manual external checks. */
  oneOf?: Array<{ skills?: Record<string, number>; diaries?: string[]; manualRequirements?: string[] }>;
  /** Any gate that isn't a skill/quest. */
  note?: string;
}

const GOD_WARS_ENTRY = ['Unlocked God Wars Dungeon access through Troll Stronghold progress (defeated Dad), or the Easy Combat Achievement hilt teleport; entry also requires 60 Strength or Agility and a rope for first entry'];
const GOD_WARS_CHAMBER = 'Meet this faction’s kill-count requirement for your Combat Achievement tier, or use an ecumenical key';

export const ACTIVITY_REQUIREMENTS: Record<string, ActivityReq> = {
  // ===== Bosses & Raids =====================================================
  'Tombs of Amascut': { quests: ['Beneath Cursed Sands'] },
  'The Gauntlet': { quests: ['Song of the Elves'] },
  'Nex': {
    skills: { Strength: 70, Agility: 70, Ranged: 70, Hitpoints: 70 },
    manualRequirements: [...GOD_WARS_ENTRY, 'Completed The Frozen Door miniquest with a frozen key from all four generals', 'Meet the Ancient Prison kill-count requirement for your Combat Achievement tier, or use an ecumenical key'],
  },
  'General Graardor': { skills: { Strength: 70 }, manualRequirements: [...GOD_WARS_ENTRY, GOD_WARS_CHAMBER] },
  'Commander Zilyana': { skills: { Agility: 70 }, manualRequirements: [...GOD_WARS_ENTRY, GOD_WARS_CHAMBER] },
  "Kree'arra": { skills: { Ranged: 70 }, manualRequirements: [...GOD_WARS_ENTRY, GOD_WARS_CHAMBER] },
  "K'ril Tsutsaroth": { skills: { Hitpoints: 70 }, manualRequirements: [...GOD_WARS_ENTRY, GOD_WARS_CHAMBER] },
  'Abyssal Sire': { skills: { Slayer: 85 }, manualRequirements: ['Abyssal demon Slayer task.'] },
  'Alchemical Hydra': { skills: { Slayer: 95 }, manualRequirements: ['Hydra Slayer task; Karuulm Slayer Dungeon.'] },
  'Cerberus': { skills: { Slayer: 91 }, manualRequirements: ['Hellhound Slayer task.'] },
  'Grotesque Guardians': { skills: { Slayer: 75 }, manualRequirements: ['Permanently unlocked the Slayer Tower roof using a brittle key', 'An active gargoyle or Grotesque Guardians boss Slayer task'] },
  'Kraken': { skills: { Slayer: 87 }, manualRequirements: ['Cave kraken Slayer task.'] },
  'Thermonuclear Smoke Devil': { skills: { Slayer: 93 }, manualRequirements: ['Smoke devil Slayer task.'] },
  'Araxxor': { skills: { Slayer: 92 }, quests: ['Priest in Peril'], manualRequirements: ['Araxyte/spider Slayer task or boss task.'] },
  'Skotizo': { manualRequirements: ['Summoned with a Dark totem in the Catacombs of Kourend.'] },
  'Vorkath': { quests: ['Dragon Slayer II'] },
  'Galvek': { quests: ['Dragon Slayer II'], note: 'Fought during Dragon Slayer II.' },
  'Moons of Peril': { skills: { Slayer: 48, Hunter: 20, Fishing: 20 }, quests: ['Perilous Moons'], note: 'Repeatable boss access after completing Perilous Moons.' },
  'Duke Sucellus': { quests: ['Desert Treasure II'] },
  'The Leviathan': { quests: ['Desert Treasure II'] },
  'The Whisperer': { quests: ['Desert Treasure II'] },
  'Vardorvis': { quests: ['Desert Treasure II'] },
  'Barrows Brothers': { quests: ['Priest in Peril'] },
  'Deranged Archaeologist': { quests: ['Bone Voyage'] },
  'Hespori': { skills: { Farming: 65 } },
  'Coral Nursery': { manualRequirements: ['Complete Troubled Tortugans; requires diving apparatus + fishbowl helmet, or a Medallion of the deep.'] },
  'Phantom Muspah': { quests: ['Secrets of the North'] },
  'Zulrah': { quests: ['Regicide'] },
  'Wintertodt': { skills: { Firemaking: 50 } },
  'Tempoross': { skills: { Fishing: 35 } },
  'Zalcano': { quests: ['Song of the Elves'] },
  'Tormented Demons': { quests: ['While Guthix Sleeps'] },
  'Amoxliatl': { quests: ['The Heart of Darkness'] },
  'Yama': { quests: ['A Kingdom Divided'] },
  'Doom of Mokhaiotl': { quests: ['The Final Dawn'] },
  'Gemstone Crab': { quests: ['Children of the Sun'] },
  'Shellbane Gryphon': { skills: { Slayer: 51 }, quests: ['Troubled Tortugans'], manualRequirements: ['Gryphon Slayer task.'] },
  'The Mad Angel': { quests: ['Fallen From Grace'], requiredAreas: ['Wyrmscraig'] },
  'Mimic': { manualRequirements: ['Opted in at the strange casket in Watson’s house', 'Obtained a Mimic from an elite or master reward casket'] },

  "Calvar'ion": { oneOf: [{ diaries: ['Wilderness Hard'] }, { manualRequirements: ["Have an active Vet'ion boss Slayer task (a skeleton task does not qualify)"] }] },
  'Obor': { manualRequirements: ['Permanently unlocked Obor’s lair using a giant key (first access only)'] },
  'Bryophyta': { manualRequirements: ['Permanently unlocked Bryophyta’s lair using a mossy key (first access only)'] },

  // ===== Guilds =============================================================
  "Champions' Guild": { questPoints: 32, requiredAreas: ["Champions' Guild"] },
  "Cooks' Guild": { skills: { Cooking: 32 } },
  'Crafting Guild': { skills: { Crafting: 40 } },
  'Mining Guild': { skills: { Mining: 60 } },
  'Prayer Guild': { skills: { Prayer: 31 }, note: 'Edgeville Monastery chapel.' },
  'Farming Guild': { skills: { Farming: 45 }, requiredAreas: ['Farming Guild'], note: 'Tiered access: 45 / 65 / 85 Farming.' },
  'Fishing Guild': { skills: { Fishing: 68 } },
  "Heroes' Guild": { quests: ["Heroes' Quest"] },
  'Hunter Guild': { skills: { Hunter: 46 }, quests: ['Children of the Sun'], note: 'Guild services require 46 Hunter; the exterior bank chest is unrestricted.' },
  "Legends' Guild": { quests: ["Legends' Quest"] },
  "Myths' Guild": { quests: ['Dragon Slayer II'] },
  'Ranging Guild': { skills: { Ranged: 40 } },
  "Rogues' Den": { note: 'Free entry; the safecracking maze needs 50 Thieving & 50 Agility.' },
  "Servants' Guild": { note: 'Hire household servants (Construction).' },
  "Warriors' Guild": {
    warriorsGuildEntry: true,
    requiredAreas: ["Warriors' Guild"],
    note: '99 Attack or Strength, or 130 combined.',
  },
  "Wizards' Guild": { skills: { Magic: 66 } },
  'Woodcutting Guild': { skills: { Woodcutting: 60 } },

  // ===== Arcana (spellbooks & prayers) ======================================
  'Ancient Magicks': { quests: ['Desert Treasure I'] },
  'Lunar Spellbook': { quests: ['Lunar Diplomacy'] },
  'Arceuus Spellbook': { note: 'Swap at the bookcase in Arceuus, Kourend & Kebos.' },
  'Piety': { skills: { Prayer: 70, Defence: 70 }, quests: ["King's Ransom"], manualRequirements: ['Knight Waves training grounds.'] },
  'Rigour': { skills: { Prayer: 74, Defence: 70 }, manualRequirements: ['Unlocked Rigour using a dexterous prayer scroll'] },
  'Augury': { skills: { Prayer: 77, Defence: 70 }, manualRequirements: ['Unlocked Augury using an arcane prayer scroll'] },
  'Preserve': { skills: { Prayer: 55 }, manualRequirements: ['Unlocked Preserve using a torn prayer scroll'] },
  'Bones to Peaches': { skills: { Magic: 60 }, manualRequirements: ['Unlocked Bones to Peaches from the Mage Training Arena reward shop'], note: '60 Magic is required to cast the spell.' },
  'Dwarf Cannon': { quests: ['Dwarf Cannon'] },
  'Chivalry': { skills: { Prayer: 60, Defence: 65 }, quests: ["King's Ransom"], manualRequirements: ['Knight Waves training grounds.'] },
  'God Spells': { skills: { Magic: 60 }, manualRequirements: ['Mage Arena: Saradomin Strike / Claws of Guthix / Flames of Zamorak.'] },
  'Mage Arena II': { skills: { Magic: 75 }, manualRequirements: ['Imbued god capes & stronger god spells.'] },

  // ===== Minigames (hard gates only; many minigames have no requirement) =====
  'Pest Control': {
    requiredAreas: ["Void Knights' Outpost"],
    combatLevel: 40,
    note: 'Novice boat.',
  },
  'Barbarian Assault': { requiredAreas: ['Barbarian Outpost'] },
  'Bounty Hunter': {
    combatLevel: 32,
    manualRequirements: ['At least 12 hours of account play time'],
  },
  'Castle Wars': { requiredAreas: ['Castle Wars'] },
  'Soul Wars': {
    combatLevel: 40,
    totalLevel: 500,
    manualRequirements: ['Completed the Soul Wars tutorial once'],
  },
  'Mage Arena': { skills: { Magic: 60 } },
  'Guardians of the Rift': { skills: { Runecraft: 27 }, quests: ['Temple of the Eye'] },
  'Tithe Farm': { skills: { Farming: 34 } },
  'Hallowed Sepulchre': { skills: { Agility: 52 }, quests: ['Sins of the Father'] },
  "Giants' Foundry": { skills: { Smithing: 15 }, quests: ['Sleeping Giants'] },
  'Mastering Mixology': { skills: { Herblore: 60 } },
  'Volcanic Mine': { skills: { Mining: 50 }, quests: ['Bone Voyage'], manualRequirements: ['150 Kudos and permission from Peter at the Museum Camp'] },
  'Pyramid Plunder': { skills: { Thieving: 21 }, questProgress: [{ quest: "Icthlarin's Little Helper", label: "Gained access to Sophanem by starting Icthlarin's Little Helper" }] },
  'Trouble Brewing': { skills: { Cooking: 40 }, quests: ['Cabin Fever'] },
  'Tai Bwo Wannai Cleanup': { quests: ['Jungle Potion'] },
  "Shades of Mort'ton": { quests: ["Shades of Mort'ton"] },
  'Temple Trekking': { quests: ['In Aid of the Myreque'] },
  'Impetuous Impulses': { skills: { Hunter: 17 }, quests: ['Lost City'] },
  'Rat Pits': { quests: ['Ratcatchers'] },
  'Vale Totems': { skills: { Fletching: 20 }, note: 'Vale Totems miniquest (Auburn Valley).' },
  'Barracuda Trials': { skills: { Sailing: 30 }, note: 'Trials at 30 / 55 / 72 Sailing; the 72 trial needs Regicide.' },
  'Blast Furnace': { note: '60 Smithing to use free; under 60, pay a fee.' },
  'Nightmare Zone': {
    manualRequirements: ['Completed at least five quests with bosses eligible for Nightmare Zone'],
    requiredAreas: ['Yanille'],
    note: 'Requires several quests completed for the dream bosses.',
  },
  "Sorceress's Garden": { note: 'Gardens gated by Thieving level (1 / 27 / 45 / 65 / 85).' },
  'Stealing Artefacts': { skills: { Thieving: 49 }, manualRequirements: ['Have a lockpick or hair clip'], note: 'Piscarilius access (Kourend & Kebos).' },
  'Mess': { note: "Hosidius kitchen — a cook's duties in Great Kourend." },

  // ===== Player-Owned House (Construction room-build levels) ================
  // Only the standard room-build levels and Superior Garden features, which are
  // well-established. Individual furniture upgrade tiers are deliberately omitted.
  'Kitchen': { skills: { Construction: 5 } },
  'Menagerie': { skills: { Construction: 37 } },
  'Costume Room': { skills: { Construction: 42 } },
  'Chapel Altar': { skills: { Construction: 45 }, note: 'Chapel room; better altars need higher Construction.' },
  'Portal Chamber': { skills: { Construction: 50 } },
  'Throne Room': { skills: { Construction: 60 } },
  'Dungeon': { skills: { Construction: 70 } },
  'Portal Nexus': { skills: { Construction: 72 } },
  'Mounted Coins': { skills: { Construction: 80 }, note: 'Achievement gallery display.' },
  'Mounted Glory': { skills: { Construction: 47 } },
  'Spirit Tree (POH)': { skills: { Construction: 75, Farming: 83 }, quests: ['Tree Gnome Village'], note: 'Superior Garden: build at 75 Construction and 83 Farming; Tree Gnome Village unlocks travel.' },
  'Wilderness Obelisk': { skills: { Construction: 80 }, note: 'Superior Garden.' },
  'Fairy Ring (POH)': { skills: { Construction: 85 }, quests: ['Fairytale II - Cure a Queen'], note: 'Building requires the fairy enchantment sold after full Fairytale II completion.' },

  // ===== Mobility (quest-gated transport networks) ==========================
  'Spirit Trees': { quests: ['Tree Gnome Village'] },
  'Fairy Rings': { manualRequirements: ['Reached fairy ring access during Fairytale II - Cure a Queen (full completion is not required)'] },
  'Gnome Gliders': { quests: ['The Grand Tree'] },
  'Balloon Transport': { quests: ['Enlightened Journey'] },
  'Mine Carts': { quests: ['The Giant Dwarf'] },
  'Magic Carpets': { note: 'Basic routes require only a fare. Quest restrictions vary by destination.' },
  'Quetzal Network': { questProgress: [{ quest: "Twilight's Promise", label: "Received Renu during Twilight's Promise to unlock the quetzal network" }] },
  'Mycelium Transport': { quests: ['Bone Voyage'] },
  'Eagle Transport': { quests: ["Eagles' Peak"] },
  'Ectophial': { quests: ['Ghosts Ahoy'] },
  'Enchanted Lyre': { quests: ['The Fremennik Trials'] },
  'Digsite Pendant': { quests: ['The Dig Site'], manualRequirements: ['Learned the digsite pendant enchantment at Varrock Museum'], note: 'Base Digsite teleport. Fossil Island additionally needs Bone Voyage and the destination machine unlock. Pendants cannot be recharged and crumble after five uses.' },
  'Camulet': { note: "Enakhra's Lament quest reward (desert teleport)." },
  'Kharedst\'s Memoirs': { note: 'Reward from the five Great Kourend mini-quests (Client of Kourend).' },
  'Ring of the Elements': { note: 'Guardians of the Rift reward (Runecraft altar teleports).' },
  'Colossal Pouch': { skills: { Runecraft: 85 }, note: 'Guardians of the Rift.' },
  'Gricoller\'s Can': { skills: { Farming: 34 }, note: 'Tithe Farm reward.' },
  'Dizana\'s Quiver': { note: 'Fortis Colosseum reward (ammo storage).' },
  'Forestry Kit': { note: 'Forestry Shop (anima-infused bark).' },
  "Drakan's Medallion": { quests: ['A Taste of Hope'] },
  'Royal Seed Pod': { quests: ['Monkey Madness II'] },
  "Pharaoh's Sceptre": { note: 'Pyramid Plunder reward (Sophanem).' },
  'Crystal Teleport Seed': { note: 'Crystal teleport seed (Prifddinas / elf content).' },

  // ---- Bosses with an access gate (most others have no hard requirement) -----
  'Inferno': { manualRequirements: ['Complete the Fight Cave (TzTok-Jad) to enter.'] },
  "Phosani's Nightmare": { manualRequirements: ['Defeated The Nightmare at least once'] },
  'Fortis Colosseum': { note: 'Varlamore — high-level combat (Sol Heredit).' },
  'The Hueycoatl': { note: 'Varlamore.' },
  'The Royal Titans': { note: 'Asgarnian Ice Dungeon.' },
  'TzHaar Fight Cave': { note: 'Mor Ul Rek — high-level combat.' },

  // ---- Minigames with a gate -------------------------------------------------
  'Fishing Trawler': {
    requiredAreas: ['Port Khazard'],
    note: 'No Fishing level is needed to join; 15 Fishing is required for fish rewards and the minigame teleport.',
  },
  'Gnome Ball': { requiredAreas: ['Tree Gnome Stronghold'] },
  'Gnome Restaurant': { requiredAreas: ['Tree Gnome Stronghold'] },
  'TzHaar Fight Pit': {
    requiredAreas: ['Mor Ul Rek (TzHaar City)'],
  },
  'Burthorpe Games Room': { requiredAreas: ['Burthorpe'] },
  'Mage Training Arena': { requiredAreas: ['Mage Training Arena'] },
  'Mahogany Homes': { note: 'Construction (contracts tiered 1 / 20 / 50 / 70).' },
  'Forestry': { note: 'Woodcutting (Forestry events).' },
  'Tears of Guthix': { quests: ['Tears of Guthix'] },
  'Brimhaven Agility Arena': { note: 'Agility (Brimhaven).' },

  // ---- Farming patches (access/level-gated; basic patches need nothing) ------
  'Hardwood Tree': { quests: ['Bone Voyage'], note: 'Fossil Island.' },
  'Seaweed': { quests: ['Bone Voyage'], note: 'Underwater, Fossil Island.' },
  'Spirit Tree': { skills: { Farming: 83 }, note: 'Grow a spirit tree.' },
  'Celastrus': { skills: { Farming: 85 }, note: 'Farming Guild (high tier).' },
  'Redwood': { skills: { Farming: 90 }, note: 'Farming Guild (high tier).' },
  'Crystal Tree': { skills: { Farming: 74 }, quests: ['Song of the Elves'], note: 'Prifddinas.' },
  'Hespori Patch': { skills: { Farming: 65 } },
  'Anima': { skills: { Farming: 76 }, note: 'Farming Guild intermediate section; planting requires 76 Farming.' },
  'Vinery': { skills: { Farming: 36 }, requiredAreas: ['Hosidius'], note: 'Grape patches.' },

  // ---- Mobility (gated teleport items) ---------------------------------------
  'Canoes': { note: 'Woodcutting (stations at 12 / 27 / 42 / 57).' },
  'Slayer Ring': { manualRequirements: ['Own a purchased Slayer ring, or craft one with 75 Crafting and Ring bling unlocked'], note: 'Crafting requires 75 Crafting; purchased rings have no Crafting requirement.' },
  "Xeric's Talisman": { note: 'Great Kourend (Architectural Alliance miniquest).' },

  // ---- Player-owned house facilities (Construction) --------------------------
  'Restoration Pools': { skills: { Construction: 65 } },
  'Jewellery Box': { skills: { Construction: 81 }, note: 'Basic box (ornate at 91).' },
  'Lectern': { skills: { Construction: 40 }, note: 'Study.' },
  'Workshop Tools': { skills: { Construction: 15 }, note: 'Workshop.' },
  'Combat Dummy': { skills: { Construction: 48 } },
  'Mounted Mythical Cape': { skills: { Construction: 47 } },
  "Mounted Xeric's Talisman": { note: 'Superior garden teleport (Construction).' },
  'Mounted Digsite Pendant': { note: 'Superior garden teleport (Construction).' },
  'Spellbook Altars': { note: 'Chapel / altar (Construction).' },
  'Armour Case': { note: 'Costume room (Construction).' },
  'Magic Wardrobe': { note: 'Costume room (Construction).' },
  'Cape Rack': { note: 'Costume room (Construction).' },
  'Treasure Chest (Clues)': { note: 'Costume room (Construction).' },
  'Toy Box': { note: 'Costume room (Construction).' },
  'Armour Repair Stand': { skills: { Construction: 55 }, note: 'Repairs Barrows armour.' },
  'Telescope': { skills: { Construction: 44 }, note: 'Study.' },
  'Aquarium': { unverified: true, note: 'Legacy entry: an OSRS housing facility has not been verified.' },
  'Bedroom (Servant)': { skills: { Construction: 20 } },
  "Servant's Moneybag": { skills: { Construction: 58 } },
  'Achievement Cape Hanger': { skills: { Construction: 80 }, note: 'Cape hanger in the achievement gallery; display an owned eligible cape.' },
  'Dining Table': { skills: { Construction: 10 }, note: 'Dining room.' },
  'Boss Lair': { skills: { Construction: 87 }, note: 'Boss lair display in the achievement gallery. Displaying a boss requires its jar and a kill.' },
  'Garden Theme': { skills: { Construction: 1 } },

  // ---- Storage (quest/level gated, or notable source) ------------------------
  'Flamtaer Bag': { quests: ["Shades of Mort'ton"] },
  'Seed Vault': { skills: { Farming: 45 }, requiredAreas: ['Farming Guild'], note: 'Seed storage inside the Farming Guild.' },
  'Fossil Storage': { quests: ['Bone Voyage'], note: 'Fossil Island museum.' },
  'Plank Sack': { note: 'Mahogany Homes reward.' },
  "Huntsman's Kit": { note: 'Varlamore (Hunter Guild).' },
  'Meat Pouch': { note: 'Crafted from Hunter furs with a needle and thread.' },
  'Essence Pouches': { note: 'Larger pouches need higher Runecraft.' },
  'Seed Box': { note: 'Tithe Farm reward.' },
  'Herb Sack': { note: 'Purchased with Slayer reward points or Tithe Farm points.' },
  'Gem Bag': { note: 'Motherlode Mine reward.' },
  'Coal Bag': { note: 'Motherlode Mine / Prospector reward.' },
  'Fish Barrel': { note: 'Tempoross reward.' },
  'Tackle Box': { note: 'Tempoross reward pool.' },
  'Log Basket': { note: 'Forestry Shop reward.' },
  'Beginner STASH': { note: 'Clue STASH unit (Construction).' },
  'Easy STASH': { note: 'Clue STASH unit (Construction).' },
  'Medium STASH': { note: 'Clue STASH unit (Construction).' },
  'Hard STASH': { note: 'Clue STASH unit (Construction).' },
  'Elite STASH': { note: 'Clue STASH unit (Construction).' },
  'Master STASH': { note: 'Clue STASH unit (Construction).' },
};

/**
 * Resolve readiness from the curated non-geographic gates plus the canonical
 * boss/minigame access map. Keeping the area source in one place prevents an
 * Omni-unlocked activity from appearing ready while its location is blocked.
 */
export const getActivityReq = (item: string): ActivityReq | undefined => {
  const requirement = ACTIVITY_REQUIREMENTS[item];
  const requiredAreas = ACTIVITY_ACCESS_AREAS[item];
  if (!requirement && !requiredAreas) return undefined;
  return {
    ...requirement,
    ...(requiredAreas ? { requiredAreas: [...requiredAreas] } : {}),
  };
};
