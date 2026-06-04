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

export interface ActivityReq {
  /** Hard skill-level gates, e.g. { Slayer: 91 }. */
  skills?: Record<string, number>;
  /** Required quests (canonical OSRS names; match QUEST_DATA where possible). */
  quests?: string[];
  /** Any gate that isn't a skill/quest. */
  note?: string;
}

export const ACTIVITY_REQUIREMENTS: Record<string, ActivityReq> = {
  // ===== Bosses & Raids =====================================================
  'Tombs of Amascut': { quests: ['Beneath Cursed Sands'] },
  'The Gauntlet': { quests: ['Song of the Elves'] },
  'Nex': { note: 'God Wars Dungeon access + a Frozen key from all four generals.' },
  'General Graardor': { note: 'God Wars Dungeon — 40 kill-count to enter the Bandos chamber.' },
  'Commander Zilyana': { note: 'God Wars Dungeon — 40 kill-count to enter the Saradomin chamber.' },
  "Kree'arra": { note: 'God Wars Dungeon — 40 kill-count to enter the Armadyl chamber.' },
  "K'ril Tsutsaroth": { note: 'God Wars Dungeon — 40 kill-count to enter the Zamorak chamber.' },
  'Abyssal Sire': { skills: { Slayer: 85 }, note: 'Abyssal demon Slayer task.' },
  'Alchemical Hydra': { skills: { Slayer: 95 }, note: 'Hydra Slayer task; Karuulm Slayer Dungeon.' },
  'Cerberus': { skills: { Slayer: 91 }, note: 'Hellhound Slayer task.' },
  'Grotesque Guardians': { skills: { Slayer: 75 }, note: 'Slayer Tower roof; needs a Brittle key.' },
  'Kraken': { skills: { Slayer: 87 }, note: 'Cave kraken Slayer task.' },
  'Thermonuclear Smoke Devil': { skills: { Slayer: 93 }, note: 'Smoke devil Slayer task.' },
  'Araxxor': { skills: { Slayer: 92 }, quests: ['Priest in Peril'], note: 'Araxyte/spider Slayer task or boss task.' },
  'Skotizo': { note: 'Summoned with a Dark totem in the Catacombs of Kourend.' },
  'Vorkath': { quests: ['Dragon Slayer II'] },
  'Galvek': { quests: ['Dragon Slayer II'], note: 'Fought during Dragon Slayer II.' },
  'Moons of Peril': { skills: { Slayer: 48 }, quests: ["Twilight's Promise"] },
  'Duke Sucellus': { quests: ['Desert Treasure II'] },
  'The Leviathan': { quests: ['Desert Treasure II'] },
  'The Whisperer': { quests: ['Desert Treasure II'] },
  'Vardorvis': { quests: ['Desert Treasure II'] },
  'Barrows Brothers': { quests: ['Priest in Peril'] },
  'Deranged Archaeologist': { quests: ['Bone Voyage'] },
  'Hespori': { skills: { Farming: 65 } },
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
  'Shellbane Gryphon': { skills: { Slayer: 51 }, quests: ['Troubled Tortugans'], note: 'Gryphon Slayer task.' },
  'Mimic': { note: 'From a Strange/Mysterious casket (Hard+ clue scrolls).' },

  // ===== Guilds =============================================================
  "Champions' Guild": { note: '32 Quest Points.' },
  "Cooks' Guild": { skills: { Cooking: 32 } },
  'Crafting Guild': { skills: { Crafting: 40 } },
  'Mining Guild': { skills: { Mining: 60 } },
  'Prayer Guild': { skills: { Prayer: 31 }, note: 'Edgeville Monastery chapel.' },
  'Farming Guild': { skills: { Farming: 45 }, note: 'Tiered access: 45 / 65 / 85 Farming.' },
  'Fishing Guild': { skills: { Fishing: 68 } },
  "Heroes' Guild": { quests: ["Heroes' Quest"] },
  'Hunter Guild': { quests: ['Children of the Sun'] },
  "Legends' Guild": { quests: ["Legends' Quest"] },
  "Myths' Guild": { quests: ['Dragon Slayer II'] },
  'Ranging Guild': { skills: { Ranged: 40 } },
  "Rogues' Den": { note: 'Free entry; the safecracking maze needs 50 Thieving & 50 Agility.' },
  "Servants' Guild": { note: 'Hire household servants (Construction).' },
  "Warriors' Guild": { note: '99 Attack or Strength, or 130 combined.' },
  "Wizards' Guild": { skills: { Magic: 66 } },
  'Woodcutting Guild': { skills: { Woodcutting: 60 } },

  // ===== Arcana (spellbooks & prayers) ======================================
  'Ancient Magicks': { quests: ['Desert Treasure I'] },
  'Lunar Spellbook': { quests: ['Lunar Diplomacy'] },
  'Arceuus Spellbook': { note: 'Swap at the bookcase in Arceuus, Kourend & Kebos.' },
  'Piety': { skills: { Prayer: 70, Defence: 70 }, quests: ["King's Ransom"], note: 'Knight Waves training grounds.' },
  'Rigour': { skills: { Prayer: 74 }, note: 'Dexterous prayer scroll (Chambers of Xeric).' },
  'Augury': { skills: { Prayer: 77 }, note: 'Arcane prayer scroll (Chambers of Xeric).' },
  'Preserve': { skills: { Prayer: 55 } },
  'Bones to Peaches': { note: 'Mage Training Arena reward shop.' },
  'Dwarf Cannon': { quests: ['Dwarf Cannon'] },
  'Chivalry': { skills: { Prayer: 60, Defence: 65 }, quests: ["King's Ransom"], note: 'Knight Waves training grounds.' },

  // ===== Mobility (quest-gated transport networks) ==========================
  'Spirit Trees': { quests: ['Tree Gnome Village'] },
  'Fairy Rings': { quests: ['Fairytale II - Cure a Queen'] },
  'Gnome Gliders': { quests: ['The Grand Tree'] },
  'Balloon Transport': { quests: ['Enlightened Journey'] },
  'Mine Carts': { quests: ['The Giant Dwarf'] },
  'Magic Carpets': { quests: ['The Feud'] },
  'Quetzal Network': { quests: ['Children of the Sun'] },
  'Mycelium Transport': { quests: ['Bone Voyage'] },
  'Eagle Transport': { quests: ["Eagles' Peak"] },
  "Drakan's Medallion": { quests: ['A Taste of Hope'] },
  'Royal Seed Pod': { quests: ['Monkey Madness II'] },
  "Pharaoh's Sceptre": { note: 'Pyramid Plunder reward (Sophanem).' },
  'Crystal Teleport Seed': { note: 'Crystal teleport seed (Prifddinas / elf content).' },
};

export const getActivityReq = (item: string): ActivityReq | undefined =>
  ACTIVITY_REQUIREMENTS[item];
