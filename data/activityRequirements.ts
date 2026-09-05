// Access requirements (skill levels + quests) for Activities & Utility content.
//
// Surfaced on activity cards next to the region tag so a player can see, at a
// glance, what gates an activity: the quest(s) and skill level(s) actually
// required to access/fight it. Recommended (not required) levels are NOT listed
// here — only hard gates. Newer (2024-2026) bosses were verified against the
// OSRS Wiki; classic content from well-established requirements.
//
// `note` carries gates that aren't a plain skill/quest (Quest Points,
// Slayer-task-only, item unlocks, kill-count, etc.).

import type { RequirementPredicate } from '../utils/requirementPredicates';
import { ACTIVITY_ACCESS_AREAS } from './activityAccess';

export interface ActivityReq {
  predicates?: RequirementPredicate[];
  noteIsInformational?: true;
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
  /** External progress a player must explicitly confirm after machine gates pass. */
  manualRequirements?: string[];
  /** Any gate that isn't a skill/quest. */
  note?: string;
}

export const ACTIVITY_REQUIREMENTS: Record<string, ActivityReq> = {
  // ===== Bosses & Raids =====================================================
  'Tombs of Amascut': { quests: ['Beneath Cursed Sands'] },
  'The Gauntlet': { quests: ['Song of the Elves'] },
  'Nex': {
    manualRequirements: [
      'A complete Frozen key from all four God Wars Dungeon generals',
    ],
  },
  'General Graardor': { predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'God Wars Dungeon — 40 kill-count to enter the Bandos chamber.' }], note: 'God Wars Dungeon — 40 kill-count to enter the Bandos chamber.' },
  'Commander Zilyana': { predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'God Wars Dungeon — 40 kill-count to enter the Saradomin chamber.' }], note: 'God Wars Dungeon — 40 kill-count to enter the Saradomin chamber.' },
  "Kree'arra": { predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'God Wars Dungeon — 40 kill-count to enter the Armadyl chamber.' }], note: 'God Wars Dungeon — 40 kill-count to enter the Armadyl chamber.' },
  "K'ril Tsutsaroth": { predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'God Wars Dungeon — 40 kill-count to enter the Zamorak chamber.' }], note: 'God Wars Dungeon — 40 kill-count to enter the Zamorak chamber.' },
  'Abyssal Sire': { skills: { Slayer: 85 }, predicates: [{ kind: 'slayerTask', id: 'Abyssal demon Slayer task.', label: 'Abyssal demon Slayer task.' }], note: 'Abyssal demon Slayer task.' },
  'Alchemical Hydra': { skills: { Slayer: 95 }, predicates: [{ kind: 'slayerTask', id: 'Hydra Slayer task; Karuulm Slayer Dungeon.', label: 'Hydra Slayer task; Karuulm Slayer Dungeon.' }], note: 'Hydra Slayer task; Karuulm Slayer Dungeon.' },
  'Cerberus': { skills: { Slayer: 91 }, predicates: [{ kind: 'slayerTask', id: 'Hellhound Slayer task.', label: 'Hellhound Slayer task.' }], note: 'Hellhound Slayer task.' },
  'Grotesque Guardians': { skills: { Slayer: 75 }, predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Slayer Tower roof; needs a Brittle key.' }], note: 'Slayer Tower roof; needs a Brittle key.' },
  'Kraken': { skills: { Slayer: 87 }, predicates: [{ kind: 'slayerTask', id: 'Cave kraken Slayer task.', label: 'Cave kraken Slayer task.' }], note: 'Cave kraken Slayer task.' },
  'Thermonuclear Smoke Devil': { skills: { Slayer: 93 }, predicates: [{ kind: 'slayerTask', id: 'Smoke devil Slayer task.', label: 'Smoke devil Slayer task.' }], note: 'Smoke devil Slayer task.' },
  'Araxxor': { skills: { Slayer: 92 }, quests: ['Priest in Peril'], predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Araxyte/spider Slayer task or boss task.' }], note: 'Araxyte/spider Slayer task or boss task.' },
  'Skotizo': { predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Summoned with a Dark totem in the Catacombs of Kourend.' }], note: 'Summoned with a Dark totem in the Catacombs of Kourend.' },
  'Vorkath': { quests: ['Dragon Slayer II'] },
  'Galvek': { quests: ['Dragon Slayer II'], predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Fought during Dragon Slayer II.' }], note: 'Fought during Dragon Slayer II.' },
  'Moons of Peril': { skills: { Slayer: 48 }, quests: ["Twilight's Promise"] },
  'Duke Sucellus': { quests: ['Desert Treasure II'] },
  'The Leviathan': { quests: ['Desert Treasure II'] },
  'The Whisperer': { quests: ['Desert Treasure II'] },
  'Vardorvis': { quests: ['Desert Treasure II'] },
  'Barrows Brothers': { quests: ['Priest in Peril'] },
  'Deranged Archaeologist': { quests: ['Bone Voyage'] },
  'Hespori': { skills: { Farming: 65 }, predicates: [{ kind: 'manual', key: 'hespori-grown', label: 'Hespori seed planted and fully grown' }] },
  'Coral Nursery': { predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Complete Troubled Tortugans; requires diving apparatus + fishbowl helmet, or a Medallion of the deep.' }], note: 'Complete Troubled Tortugans; requires diving apparatus + fishbowl helmet, or a Medallion of the deep.' },
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
  'Shellbane Gryphon': { skills: { Slayer: 51 }, quests: ['Troubled Tortugans'], predicates: [{ kind: 'slayerTask', id: 'Gryphon Slayer task.', label: 'Gryphon Slayer task.' }], note: 'Gryphon Slayer task.' },
  'The Mad Angel': { quests: ['Fallen From Grace'] },
  'Mimic': { predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'From a Strange/Mysterious casket (Hard+ clue scrolls).' }], note: 'From a Strange/Mysterious casket (Hard+ clue scrolls).' },

  // ===== Guilds =============================================================
  "Champions' Guild": { predicates: [{ kind: 'questPoints', count: 32 }] },
  "Cooks' Guild": { skills: { Cooking: 32 } },
  'Crafting Guild': { skills: { Crafting: 40 } },
  'Mining Guild': { skills: { Mining: 60 } },
  'Prayer Guild': { skills: { Prayer: 31 }, predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Edgeville Monastery chapel.' }], note: 'Edgeville Monastery chapel.' },
  'Farming Guild': { skills: { Farming: 45 }, predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Tiered access: 45 / 65 / 85 Farming.' }], note: 'Tiered access: 45 / 65 / 85 Farming.' },
  'Fishing Guild': { skills: { Fishing: 68 } },
  "Heroes' Guild": { quests: ["Heroes' Quest"] },
  'Hunter Guild': { quests: ['Children of the Sun'] },
  "Legends' Guild": { quests: ["Legends' Quest"] },
  "Myths' Guild": { quests: ['Dragon Slayer II'] },
  'Ranging Guild': { skills: { Ranged: 40 } },
  "Rogues' Den": { predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Free entry; the safecracking maze needs 50 Thieving & 50 Agility.' }], note: 'Free entry; the safecracking maze needs 50 Thieving & 50 Agility.' },
  "Servants' Guild": { predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Hire household servants (Construction).' }], note: 'Hire household servants (Construction).' },
  "Warriors' Guild": {
    predicates: [{ kind: 'unknown', key: 'legacy-note', label: '99 Attack or Strength, or 130 combined.' }], note: '99 Attack or Strength, or 130 combined.',
  },
  "Wizards' Guild": { skills: { Magic: 66 } },
  'Woodcutting Guild': { skills: { Woodcutting: 60 } },

  // ===== Arcana (spellbooks & prayers) ======================================
  'Ancient Magicks': { quests: ['Desert Treasure I'] },
  'Lunar Spellbook': { quests: ['Lunar Diplomacy'] },
  'Arceuus Spellbook': { predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Swap at the bookcase in Arceuus, Kourend & Kebos.' }], note: 'Swap at the bookcase in Arceuus, Kourend & Kebos.' },
  'Piety': { skills: { Prayer: 70, Defence: 70 }, quests: ["King's Ransom"], predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Knight Waves training grounds.' }], note: 'Knight Waves training grounds.' },
  'Rigour': { skills: { Prayer: 74 }, predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Dexterous prayer scroll (Chambers of Xeric).' }], note: 'Dexterous prayer scroll (Chambers of Xeric).' },
  'Augury': { skills: { Prayer: 77 }, predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Arcane prayer scroll (Chambers of Xeric).' }], note: 'Arcane prayer scroll (Chambers of Xeric).' },
  'Preserve': { skills: { Prayer: 55 } },
  'Bones to Peaches': { predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Mage Training Arena reward shop.' }], note: 'Mage Training Arena reward shop.' },
  'Dwarf Cannon': { quests: ['Dwarf Cannon'] },
  'Chivalry': { skills: { Prayer: 60, Defence: 65 }, quests: ["King's Ransom"], predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Knight Waves training grounds.' }], note: 'Knight Waves training grounds.' },
  'God Spells': { skills: { Magic: 60 }, predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Mage Arena: Saradomin Strike / Claws of Guthix / Flames of Zamorak.' }], note: 'Mage Arena: Saradomin Strike / Claws of Guthix / Flames of Zamorak.' },
  'Mage Arena II': { skills: { Magic: 75 }, predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Imbued god capes & stronger god spells.' }], note: 'Imbued god capes & stronger god spells.' },

  // ===== Minigames (hard gates only; many minigames have no requirement) =====
  'Pest Control': {
    combatLevel: 40,
    noteIsInformational: true, note: 'Novice boat.',
  },
  'Barbarian Assault': { },
  'Bounty Hunter': {
    combatLevel: 32,
    manualRequirements: ['At least 12 hours of account play time'],
  },
  'Castle Wars': { },
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
  'Volcanic Mine': { skills: { Mining: 50 }, quests: ['Bone Voyage'] },
  'Pyramid Plunder': { skills: { Thieving: 21 }, quests: ["Icthlarin's Little Helper"] },
  'Trouble Brewing': { skills: { Cooking: 40 }, quests: ['Cabin Fever'] },
  'Tai Bwo Wannai Cleanup': { quests: ['Jungle Potion'] },
  "Shades of Mort'ton": { quests: ["Shades of Mort'ton"] },
  'Temple Trekking': { quests: ['In Aid of the Myreque'] },
  'Impetuous Impulses': { skills: { Hunter: 17 }, quests: ['Lost City'] },
  'Rat Pits': { quests: ['Ratcatchers'] },
  'Vale Totems': { skills: { Fletching: 20 }, predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Vale Totems miniquest (Auburn Valley).' }], note: 'Vale Totems miniquest (Auburn Valley).' },
  'Barracuda Trials': { skills: { Sailing: 30 }, predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Trials at 30 / 55 / 72 Sailing; the 72 trial needs Regicide.' }], note: 'Trials at 30 / 55 / 72 Sailing; the 72 trial needs Regicide.' },
  'Blast Furnace': { predicates: [{ kind: 'unknown', key: 'legacy-note', label: '60 Smithing to use free; under 60, pay a fee.' }], note: '60 Smithing to use free; under 60, pay a fee.' },
  'Nightmare Zone': {
    predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Requires several quests completed for the dream bosses.' }], note: 'Requires several quests completed for the dream bosses.',
  },
  "Sorceress's Garden": { predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Gardens gated by Thieving level (1 / 27 / 45 / 65 / 85).' }], note: 'Gardens gated by Thieving level (1 / 27 / 45 / 65 / 85).' },
  'Stealing Artefacts': { predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Piscarilius access (Kourend & Kebos).' }], note: 'Piscarilius access (Kourend & Kebos).' },
  'Mess': { predicates: [{ kind: 'unknown', key: 'legacy-note', label: "Hosidius kitchen — a cook's duties in Great Kourend." }], note: "Hosidius kitchen — a cook's duties in Great Kourend." },

  // ===== Player-Owned House (Construction room-build levels) ================
  // Only the standard room-build levels and Superior Garden features, which are
  // well-established. Individual furniture upgrade tiers are deliberately omitted.
  'Kitchen': { skills: { Construction: 5 } },
  'Menagerie': { skills: { Construction: 37 } },
  'Costume Room': { skills: { Construction: 42 } },
  'Chapel Altar': { skills: { Construction: 45 }, predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Chapel room; better altars need higher Construction.' }], note: 'Chapel room; better altars need higher Construction.' },
  'Portal Chamber': { skills: { Construction: 50 } },
  'Throne Room': { skills: { Construction: 60 } },
  'Dungeon': { skills: { Construction: 70 } },
  'Portal Nexus': { skills: { Construction: 72 } },
  'Mounted Coins': { skills: { Construction: 80 }, predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Achievement gallery display.' }], note: 'Achievement gallery display.' },
  'Mounted Glory': { skills: { Construction: 47 } },
  'Spirit Tree (POH)': { skills: { Construction: 75 }, predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Superior Garden.' }], note: 'Superior Garden.' },
  'Wilderness Obelisk': { skills: { Construction: 80 }, predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Superior Garden.' }], note: 'Superior Garden.' },
  'Fairy Ring (POH)': { skills: { Construction: 85 }, predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Superior Garden.' }], note: 'Superior Garden.' },

  // ===== Mobility (quest-gated transport networks) ==========================
  'Spirit Trees': { quests: ['Tree Gnome Village'] },
  'Fairy Rings': { predicates: [{ kind: 'manual', key: 'fairy-ring-progress', label: 'Fairytale II progressed far enough to use fairy rings' }] },
  'Gnome Gliders': { quests: ['The Grand Tree'] },
  'Balloon Transport': { quests: ['Enlightened Journey'] },
  'Mine Carts': { quests: ['The Giant Dwarf'] },
  'Magic Carpets': { quests: ['The Feud'] },
  'Quetzal Network': { quests: ['Children of the Sun'] },
  'Mycelium Transport': { quests: ['Bone Voyage'] },
  'Eagle Transport': { quests: ["Eagles' Peak"] },
  'Ectophial': { quests: ['Ghosts Ahoy'] },
  'Enchanted Lyre': { quests: ['The Fremennik Trials'] },
  'Digsite Pendant': { quests: ['Bone Voyage'], predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Charged at the Digsite / Fossil Island.' }], note: 'Charged at the Digsite / Fossil Island.' },
  'Camulet': { predicates: [{ kind: 'unknown', key: 'legacy-note', label: "Enakhra's Lament quest reward (desert teleport)." }], note: "Enakhra's Lament quest reward (desert teleport)." },
  'Kharedst\'s Memoirs': { predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Reward from the five Great Kourend mini-quests (Client of Kourend).' }], note: 'Reward from the five Great Kourend mini-quests (Client of Kourend).' },
  'Ring of the Elements': { predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Guardians of the Rift reward (Runecraft altar teleports).' }], note: 'Guardians of the Rift reward (Runecraft altar teleports).' },
  'Colossal Pouch': { skills: { Runecraft: 85 }, predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Guardians of the Rift.' }], note: 'Guardians of the Rift.' },
  'Gricoller\'s Can': { skills: { Farming: 34 }, predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Tithe Farm reward.' }], note: 'Tithe Farm reward.' },
  'Dizana\'s Quiver': { predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Fortis Colosseum reward (ammo storage).' }], note: 'Fortis Colosseum reward (ammo storage).' },
  'Forestry Kit': { predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Forestry Shop (anima-infused bark).' }], note: 'Forestry Shop (anima-infused bark).' },
  "Drakan's Medallion": { quests: ['A Taste of Hope'] },
  'Royal Seed Pod': { quests: ['Monkey Madness II'] },
  "Pharaoh's Sceptre": { predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Pyramid Plunder reward (Sophanem).' }], note: 'Pyramid Plunder reward (Sophanem).' },
  'Crystal Teleport Seed': { predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Crystal teleport seed (Prifddinas / elf content).' }], note: 'Crystal teleport seed (Prifddinas / elf content).' },

  // ---- Bosses with an access gate (most others have no hard requirement) -----
  'Inferno': { predicates: [{ kind: 'manual', key: 'inferno-access', label: 'Fire cape sacrificed to unlock Inferno access' }] },
  "Phosani's Nightmare": { predicates: [{ kind: 'bossKill', id: 'nightmare', count: 1, label: 'At least one ordinary Nightmare kill' }] },
  'Fortis Colosseum': { predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Varlamore — high-level combat (Sol Heredit).' }], note: 'Varlamore — high-level combat (Sol Heredit).' },
  'The Hueycoatl': { predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Varlamore.' }], note: 'Varlamore.' },
  'The Royal Titans': { predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Asgarnian Ice Dungeon.' }], note: 'Asgarnian Ice Dungeon.' },
  'TzHaar Fight Cave': { predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Mor Ul Rek — high-level combat.' }], note: 'Mor Ul Rek — high-level combat.' },

  // ---- Minigames with a gate -------------------------------------------------
  'Fishing Trawler': {
    skills: { Fishing: 15 },
    },
  'Gnome Ball': { },
  'Gnome Restaurant': { },
  'TzHaar Fight Pit': {
    },
  'Burthorpe Games Room': { },
  'Mage Training Arena': { },
  'Mahogany Homes': { predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Construction (contracts tiered 1 / 20 / 50 / 70).' }], note: 'Construction (contracts tiered 1 / 20 / 50 / 70).' },
  'Forestry': { predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Woodcutting (Forestry events).' }], note: 'Woodcutting (Forestry events).' },
  'Tears of Guthix': { quests: ['Tears of Guthix'] },
  'Brimhaven Agility Arena': { predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Agility (Brimhaven).' }], note: 'Agility (Brimhaven).' },

  // ---- Farming patches (access/level-gated; basic patches need nothing) ------
  'Hardwood Tree': { quests: ['Bone Voyage'], predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Fossil Island.' }], note: 'Fossil Island.' },
  'Seaweed': { quests: ['Bone Voyage'], predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Underwater, Fossil Island.' }], note: 'Underwater, Fossil Island.' },
  'Spirit Tree': { skills: { Farming: 83 }, predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Grow a spirit tree.' }], note: 'Grow a spirit tree.' },
  'Celastrus': { skills: { Farming: 85 }, predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Farming Guild (high tier).' }], note: 'Farming Guild (high tier).' },
  'Redwood': { skills: { Farming: 90 }, predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Farming Guild (high tier).' }], note: 'Farming Guild (high tier).' },
  'Crystal Tree': { quests: ['Song of the Elves'], predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Prifddinas.' }], note: 'Prifddinas.' },
  'Hespori Patch': { skills: { Farming: 65 } },
  'Anima': { skills: { Farming: 85 }, predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Farming Guild (high tier).' }], note: 'Farming Guild (high tier).' },
  'Vinery': { skills: { Farming: 65 }, predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Hosidius.' }], note: 'Hosidius.' },

  // ---- Mobility (gated teleport items) ---------------------------------------
  'Canoes': { predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Woodcutting (stations at 12 / 27 / 42 / 57).' }], note: 'Woodcutting (stations at 12 / 27 / 42 / 57).' },
  'Slayer Ring': { skills: { Slayer: 75 }, predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Craft after reaching 75 Slayer.' }], note: 'Craft after reaching 75 Slayer.' },
  "Xeric's Talisman": { predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Great Kourend (Architectural Alliance miniquest).' }], note: 'Great Kourend (Architectural Alliance miniquest).' },

  // ---- Player-owned house facilities (Construction) --------------------------
  'Restoration Pools': { skills: { Construction: 65 } },
  'Jewellery Box': { skills: { Construction: 71 }, predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Basic box (ornate at 91).' }], note: 'Basic box (ornate at 91).' },
  'Lectern': { skills: { Construction: 40 }, predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Study.' }], note: 'Study.' },
  'Workshop Tools': { skills: { Construction: 15 }, predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Workshop.' }], note: 'Workshop.' },
  'Combat Dummy': { skills: { Construction: 48 } },
  'Mounted Mythical Cape': { skills: { Construction: 47 } },
  "Mounted Xeric's Talisman": { predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Superior garden teleport (Construction).' }], note: 'Superior garden teleport (Construction).' },
  'Mounted Digsite Pendant': { predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Superior garden teleport (Construction).' }], note: 'Superior garden teleport (Construction).' },
  'Spellbook Altars': { predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Chapel / altar (Construction).' }], note: 'Chapel / altar (Construction).' },
  'Armour Case': { predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Costume room (Construction).' }], note: 'Costume room (Construction).' },
  'Magic Wardrobe': { predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Costume room (Construction).' }], note: 'Costume room (Construction).' },
  'Cape Rack': { predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Costume room (Construction).' }], note: 'Costume room (Construction).' },
  'Treasure Chest (Clues)': { predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Costume room (Construction).' }], note: 'Costume room (Construction).' },
  'Toy Box': { predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Costume room (Construction).' }], note: 'Costume room (Construction).' },
  'Armour Repair Stand': { skills: { Construction: 55 }, predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Repairs Barrows armour.' }], note: 'Repairs Barrows armour.' },
  'Telescope': { skills: { Construction: 44 }, predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Study.' }], note: 'Study.' },
  'Aquarium': { skills: { Construction: 63 } },
  'Bedroom (Servant)': { skills: { Construction: 20 } },
  "Servant's Moneybag": { skills: { Construction: 58 } },
  'Achievement Cape Hanger': { skills: { Construction: 80 } },
  'Dining Table': { skills: { Construction: 10 }, predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Dining room.' }], note: 'Dining room.' },
  'Boss Lair': { skills: { Construction: 87 }, predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Achievement gallery display.' }], note: 'Achievement gallery display.' },
  'Garden Theme': { skills: { Construction: 1 } },

  // ---- Storage (quest/level gated, or notable source) ------------------------
  'Flamtaer Bag': { quests: ["Shades of Mort'ton"] },
  'Seed Vault': { quests: ['Bone Voyage'], predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Fossil Island.' }], note: 'Fossil Island.' },
  'Fossil Storage': { quests: ['Bone Voyage'], predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Fossil Island museum.' }], note: 'Fossil Island museum.' },
  'Plank Sack': { predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Mahogany Homes reward.' }], note: 'Mahogany Homes reward.' },
  "Huntsman's Kit": { predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Varlamore (Hunter Guild).' }], note: 'Varlamore (Hunter Guild).' },
  'Meat Pouch': { predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Forestry shop.' }], note: 'Forestry shop.' },
  'Essence Pouches': { predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Larger pouches need higher Runecraft.' }], note: 'Larger pouches need higher Runecraft.' },
  'Seed Box': { predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Tithe Farm reward.' }], note: 'Tithe Farm reward.' },
  'Herb Sack': { predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Slayer reward (or Master Farmers).' }], note: 'Slayer reward (or Master Farmers).' },
  'Gem Bag': { predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Motherlode Mine reward.' }], note: 'Motherlode Mine reward.' },
  'Coal Bag': { predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Motherlode Mine / Prospector reward.' }], note: 'Motherlode Mine / Prospector reward.' },
  'Fish Barrel': { predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Tempoross reward.' }], note: 'Tempoross reward.' },
  'Tackle Box': { predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Fishing Trawler reward.' }], note: 'Fishing Trawler reward.' },
  'Log Basket': { predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Forestry / Hallowed Sepulchre.' }], note: 'Forestry / Hallowed Sepulchre.' },
  'Beginner STASH': { predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Clue STASH unit (Construction).' }], note: 'Clue STASH unit (Construction).' },
  'Easy STASH': { predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Clue STASH unit (Construction).' }], note: 'Clue STASH unit (Construction).' },
  'Medium STASH': { predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Clue STASH unit (Construction).' }], note: 'Clue STASH unit (Construction).' },
  'Hard STASH': { predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Clue STASH unit (Construction).' }], note: 'Clue STASH unit (Construction).' },
  'Elite STASH': { predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Clue STASH unit (Construction).' }], note: 'Clue STASH unit (Construction).' },
  'Master STASH': { predicates: [{ kind: 'unknown', key: 'legacy-note', label: 'Clue STASH unit (Construction).' }], note: 'Clue STASH unit (Construction).' },
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
