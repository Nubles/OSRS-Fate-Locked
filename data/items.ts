

export const SKILLS_LIST = [
  'Attack', 'Hitpoints', 'Mining', 
  'Strength', 'Agility', 'Smithing', 
  'Defence', 'Herblore', 'Fishing', 
  'Ranged', 'Thieving', 'Cooking', 
  'Prayer', 'Crafting', 'Firemaking', 
  'Magic', 'Fletching', 'Woodcutting', 
  'Runecraft', 'Slayer', 'Farming', 
  'Construction', 'Hunter', 'Sailing'
];

export const EQUIPMENT_SLOTS = [
  'Head', 'Cape', 'Neck', 'Ammo', 'Weapon', 'Body', 'Shield', 'Legs', 'Gloves', 'Boots', 'Ring'
];

export const MOBILITY_LIST = [
  'Spirit Trees', 'Fairy Rings', 'Gnome Gliders', 'Charter Ships', 'Teleport Tablets', 
  'Jewelry Teleports', 'Canoes', 'Balloon Transport', 'Mine Carts', 'Magic Carpets', 
  'Wilderness Obelisks', 'Minigame Teleports', 'Quetzal Network',
  'Mycelium Transport', 'Eagle Transport', 'Slayer Ring', 'Xeric\'s Talisman', 
  'Drakan\'s Medallion', 'Pharaoh\'s Sceptre', 'Crystal Teleport Seed', 'Royal Seed Pod'
];

export const ARCANA_LIST = [
  'Ancient Magicks', 'Lunar Spellbook', 'Arceuus Spellbook', 
  'Piety', 'Rigour', 'Augury', 'Preserve', 'Bones to Peaches', 
  'Dwarf Cannon', 'Chivalry'
];

export const POH_LIST = [
  'Costume Room', 'Chapel Altar', 'Portal Chamber', 'Portal Nexus', 'Restoration Pools', 
  'Jewellery Box', 'Lectern', 'Workshop Tools', 'Kitchen', 'Menagerie', 'Mounted Glory', 
  'Combat Dummy', 'Fairy Ring (POH)', 'Spirit Tree (POH)', 'Wilderness Obelisk', 
  'Mounted Mythical Cape', 'Mounted Xeric\'s Talisman', 'Mounted Digsite Pendant', 
  'Spellbook Altars', 'Armour Case', 'Magic Wardrobe', 'Cape Rack', 'Treasure Chest (Clues)', 
  'Toy Box', 'Armour Repair Stand', 'Telescope', 'Dungeon', 'Aquarium',
  'Bedroom (Servant)', 'Servant\'s Moneybag', 'Achievement Cape Hanger', 
  'Dining Table', 'Boss Lair', 'Throne Room', 'Garden Theme'
];

export const MERCHANTS_LIST = [
  'General Stores', 'Magic Shops', 'Archery Shops', 'Sword Shops', 'Food Shops', 
  'Fishing Shops', 'Clothes Shops', 'Farming Shops', 'Crafting Shops', 'Mining Shops', 
  'Gem Shops', 'Herblore Shops', 'Dye Shops', 'Axe Shops', 'Platebody Shops', 
  'Bars & Inns', 'Cooking Shops', 'Shield Shops', 'Scimitar Shops', 'Helmet Shops', 
  'Platelegs Shops', 'Plateskirt Shops', 'Chainbody Shops', 'Mace Shops', 
  'Staff Shops', 'Crossbow Shops', 'Hunter Shops', 'Candle Shops', 'Fur Traders', 
  'Jewellery Shops', 'Kebab Sellers', 'Silk Shops', 'Silver Shops', 'Spice Shops', 
  'Vegetable Shops', 'Wine Traders', 'Amulet Shops',
  'Slayer Equipment', 'Stonemasons', 'Sawmill Operators', 'Ore Merchants', 
  'Real Estate Agents', 'Tanners', 'Taxidermists', 'Decanters', 'Lost Property',
  'Warhammer Shops', 'Claw Shops', 'Halberd Shops', 'Pet Shops'
];

export const STORAGE_LIST = [
  'Looting Bag', 'Rune Pouch', 'Seed Box', 'Herb Sack', 'Gem Bag', 'Coal Bag', 'Fish Barrel', 
  'Tackle Box', 'Bolt Pouch', 'Plank Sack', 'Huntsman\'s Kit', 'Log Basket', 'Beginner STASH', 
  'Easy STASH', 'Medium STASH', 'Hard STASH', 'Elite STASH', 'Master STASH', 'Tool Leprechauns',
  'Meat Pouch', 'Essence Pouches', 'Master Scroll Book', 'Steel Key Ring', 'Bottomless Bucket',
  'Spice Pouch', 'Flamtaer Bag', 'Seed Vault', 'Fossil Storage'
];

export const GUILDS_LIST = [
  'Champions\' Guild', 'Cooks\' Guild', 'Crafting Guild', 'Mining Guild', 'Prayer Guild', 
  'Farming Guild', 'Fishing Guild', 'Heroes\' Guild', 'Hunters\' Guild', 'Legends\' Guild', 
  'Myths\' Guild', 'Ranging Guild', 'Rogues\' Den', 'Servants\' Guild', 'Warriors\' Guild', 
  'Wizards\' Guild', 'Woodcutting Guild'
];

export const FARMING_PATCH_LIST = [
  'Allotment', 'Herb', 'Flower', 'Hops', 'Bush', 'Wood Tree', 
  'Fruit Tree', 'Hardwood Tree', 'Cactus', 'Mushroom', 'Belladonna', 
  'Seaweed', 'Calquat', 'Spirit Tree', 'Celastrus', 'Redwood', 
  'Crystal Tree', 'Hespori Patch'
];

export const FARMING_UNLOCK_DETAILS: Record<string, string> = {
  'Allotment': "Potatoes, Watermelons, Snape Grass",
  'Herb': "Guam, Ranarr, Snapdragon, Torstol",
  'Flower': "Marigold, Limpwurt, White Lily",
  'Hops': "Barley, Jute, Yanillian",
  'Bush': "Redberry, Whiteberry, Poison Ivy",
  'Wood Tree': "Oak, Yew, Magic",
  'Fruit Tree': "Apple, Palm, Dragonfruit",
  'Hardwood Tree': "Teak, Mahogany",
  'Cactus': "Cactus Spine, Potato Cactus",
  'Mushroom': "Bittercap",
  'Belladonna': "Nightshade",
  'Seaweed': "Giant Seaweed",
  'Calquat': "Calquat Fruit",
  'Spirit Tree': "Teleport Network",
  'Celastrus': "Celastrus Bark",
  'Redwood': "Redwood Logs",
  'Crystal Tree': "Crystal Shards",
  'Hespori Patch': "Bottomless Bucket, Anima Seeds"
};

export const BOSSES_LIST = [
  'Chambers of Xeric', 'Theatre of Blood', 'Tombs of Amascut', 'The Gauntlet', 'The Nightmare', 
  'Phosani\'s Nightmare', 'Nex', 'Corporeal Beast', 'General Graardor', 'Commander Zilyana', 
  'Kree\'arra', 'K\'ril Tsutsaroth', 'Abyssal Sire', 'Alchemical Hydra', 'Cerberus', 
  'Grotesque Guardians', 'Kraken', 'Skotizo', 'Thermonuclear Smoke Devil', 'Araxxor', 
  'Artio', 'Callisto', 'Calvar\'ion', 'Chaos Elemental', 'Chaos Fanatic', 'Crazy Archaeologist', 
  'Scorpia', 'Spindel', 'Venenatis', 'Vet\'ion', 'Vorkath', 'Galvek', 'The Hueycoatl', 
  'Moons of Peril', 'Fortis Colosseum', 'Duke Sucellus', 'The Leviathan', 'The Whisperer', 
  'Vardorvis', 'Barrows Brothers', 'Bryophyta', 'Dagannoth Kings', 'Deranged Archaeologist', 
  'Giant Mole', 'Hespori', 'Kalphite Queen', 'King Black Dragon', 'Mimic', 'Obor', 
  'Phantom Muspah', 'Sarachnis', 'Scurrius', 'Zulrah', 'Wintertodt', 'Tempoross', 
  'Zalcano', 'TzHaar Fight Cave', 'Inferno', 'TzHaar-Ket-Rak\'s Challenges', 'Tormented Demons',
  'Amoxliatl', 'The Royal Titans', 'Yama', 'Doom of Mokhaiotl', 'Gemstone Crab',
  'Shellbane Gryphon'
];

export const MINIGAMES_LIST = [
  'Shooting Stars', 'Barbarian Assault', 'Bounty Hunter', 'Castle Wars', 'Clan Wars', 
  'Emir\'s Arena', 'Intelligence Gathering', 'Last Man Standing', 'Mage Arena', 
  'Nightmare Zone', 'Pest Control', 'Soul Wars', 'Temple Trekking', 'TzHaar Fight Pit', 
  'Archery Competition', 'Blast Furnace', 'Fishing Trawler', 'Giants\' Foundry', 'Gnome Ball', 
  'Gnome Restaurant', 'Guardians of the Rift', 'Impetuous Impulses', 'Mage Training Arena', 
  'Mahogany Homes', 'Mastering Mixology', 'Mess', 'Pyramid Plunder', 'Rogues\' Den', 
  'Sorceress\'s Garden', 'Stealing Artefacts', 'Tithe Farm', 'Trouble Brewing', 
  'Vale Totems', 'Volcanic Mine', 'Shades of Mort\'ton', 'Tai Bwo Wannai Cleanup', 
  'Warriors\' Guild', 'Burthorpe Games Room', 'Forestry', 'Rat Pits', 'Tears of Guthix',
  'Brimhaven Agility Arena', 'Hallowed Sepulchre', 'Barracuda Trials'
];

export const MISTHALIN_AREAS = [
  'Varrock', 'Lumbridge', 'Draynor Village', 'Wizards\' Tower', 'Edgeville', 
  'Barbarian Village', 'Digsite', 'Silvarea', 'Paterdomus'
];

export const REGION_GROUPS: Record<string, string[]> = {
  'Asgarnia': [
    'Falador', 'Port Sarim', 'Rimmington', 'Taverley', 'Burthorpe', 'Warriors\' Guild', 
    'Heroes\' Guild', 'Crafting Guild', 'Dwarven Mine', 'Ice Mountain', 'Asgarnian Ice Dungeon', 
    'Motherlode Mine', 'Goblin Village', 'Mudskipper Point', 'Void Knights\' Outpost', 'Entrana'
  ],
  'Kandarin': [
    'East Ardougne', 'West Ardougne', 'Catherby', 'Seers\' Village', 'Camelot', 'Yanille', 
    'Port Khazard', 'Hemenster', 'Fishing Guild', 'Ranging Guild', 'Legends\' Guild', 
    'Tree Gnome Stronghold', 'Gnome Village', 'Witchaven', 'Piscatoris Fishing Colony', 
    'Feldip Hills', 'Baxtorian Falls', 'Otto\'s Grotto', 'Barbarian Outpost', 'Fight Arena'
  ],
  'Karamja': [
    'Musa Point', 'Brimhaven', 'Tai Bwo Wannai', 'Shilo Village', 'Kharazi Jungle', 
    'Mor Ul Rek (TzHaar City)', 'Crandor'
  ],
  'Kharidian Desert': [
    'Al Kharid', 'Duel Arena / PvP Arena', 'Shantay Pass', 'Pollnivneach', 'Nardah', 
    'Sophanem', 'Menaphos', 'Bandit Camp', 'Bedabin Camp', 'Ruins of Uzer', 
    'Mage Training Arena', 'Agility Pyramid', 'Giants\' Plateau', 'Kalphite Lair'
  ],
  'Morytania': [
    'Canifis', 'Port Phasmatys', 'Mort\'ton', 'Barrows', 'Burgh de Rott', 'Meiyerditch', 
    'Darkmeyer', 'Slepe', 'Ver Sinhaza', 'Fenkenstrain\'s Castle', 'Slayer Tower', 
    'Mort Myre Swamp', 'Haunted Mine', 'Haunted Woods', 'Harmony Island', 
    'Mos Le\'Harmless', 'Braindeath Island', 'Dragontooth Island'
  ],
  'Fremennik': [
    'Rellekka', 'Neitiznot', 'Jatizso', 'Miscellania & Etceteria', 'Waterbirth Island', 
    'Lunar Isle', 'Mountain Camp', 'Lighthouse', 'Keldagrim'
  ],
  'Tirannwn': [
    'Prifddinas', 'Lletya', 'Tyras Camp', 'Elf Camp', 'Isafdar', 'Zul-Andra', 
    'Arandar', 'Gwenith', 'Iorwerth Camp'
  ],
  'Wilderness': [
    'Ferox Enclave', 'Wilderness Volcano', 'Chaos Temple', 'Rogues\' Castle', 'Lava Maze', 
    'Wilderness Bandit Camp', 'Dark Warriors\' Fortress', 'Graveyard of Shadows', 'Forgotten Cemetery',
    'Resource Area', 'Mage Arena', 'Scorpia\'s Cave', 'Fountain of Rune', 'Wilderness God Wars Dungeon'
  ],
  'Kourend & Kebos': [
    'Kourend Castle', 'Hosidius', 'Piscarilius', 'Shayzien', 'Lovakengj', 'Arceuus', 
    'Kebos Lowlands', 'Molch', 'Farming Guild', 'Woodcutting Guild', 'Mount Quidamortem', 
    'Mount Karuulm', 'Catacombs of Kourend', 'Land\'s End', 'Wintertodt Camp'
  ],
  'Varlamore': [
    'Civitas illa Fortis', 'Avium Savannah', 'Cam Torum', 'Ralos\' Rise', 'Darkfrost', 
    'Hunter\'s Guild', 'Aldarin', 'The Stranglewood'
  ],
  'Islands & Others': [
    'Fossil Island', 'Ape Atoll', 'Zanaris', 'Tutorial Island'
  ],
  'The Open Seas': [
    'Pandemonium', 'The Great Conch', 'The Little Pearl', 'Drumstick Isle', 'Ledger Island', 
    'Brittle Island', 'Vatricos Island', 'Laguna Auror', 'Chin Champa Island', 'Doggos Island', 
    'Splinter Island', 'Chard Island', 'Grimstone', 'Isle of Bones', 'Minotaur\'s Rest', 
    'The Pincers', 'Barracuda Trials', 'Crabclaw Isle', 'Isle of Souls (Expanded)'
  ]
};

export const REGIONS_LIST = Object.values(REGION_GROUPS).flat();