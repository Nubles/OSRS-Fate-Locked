import { SERVICE_CATALOG } from './serviceCatalog';
import { AREA_CATALOG } from './areaCatalog';


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

export const MOBILITY_LIST = SERVICE_CATALOG.filter(row => row.category === 'mobility').map(row => row.name);

export const ARCANA_LIST = [
  'Ancient Magicks', 'Lunar Spellbook', 'Arceuus Spellbook', 
  'Piety', 'Rigour', 'Augury', 'Preserve', 'Bones to Peaches',
  'Dwarf Cannon', 'Chivalry', 'God Spells', 'Mage Arena II'
];

export const POH_LIST = [
  'Costume Room', 'Chapel Altar', 'Portal Chamber', 'Portal Nexus', 'Restoration Pools', 
  'Jewellery Box', 'Lectern', 'Workshop Tools', 'Kitchen', 'Menagerie', 'Mounted Glory', 
  'Combat Dummy', 'Fairy Ring (POH)', 'Spirit Tree (POH)', 'Wilderness Obelisk', 
  'Mounted Mythical Cape', 'Mounted Xeric\'s Talisman', 'Mounted Digsite Pendant', 
  'Spellbook Altars', 'Armour Case', 'Magic Wardrobe', 'Cape Rack', 'Treasure Chest (Clues)', 
  'Toy Box', 'Armour Repair Stand', 'Telescope', 'Dungeon', 'Aquarium',
  'Bedroom (Servant)', 'Servant\'s Moneybag', 'Achievement Cape Hanger', 
  'Dining Table', 'Boss Lair', 'Throne Room', 'Garden Theme',
  'Mounted Coins'
];

export const MERCHANTS_LIST = SERVICE_CATALOG.filter(row => row.category === 'merchants').map(row => row.name);

export const STORAGE_LIST = [
  'Looting Bag', 'Rune Pouch', 'Seed Box', 'Herb Sack', 'Gem Bag', 'Coal Bag', 'Fish Barrel', 
  'Tackle Box', 'Bolt Pouch', 'Plank Sack', 'Huntsman\'s Kit', 'Log Basket', 'Beginner STASH', 
  'Easy STASH', 'Medium STASH', 'Hard STASH', 'Elite STASH', 'Master STASH', 'Tool Leprechauns',
  'Meat Pouch', 'Essence Pouches', 'Master Scroll Book', 'Steel Key Ring', 'Bottomless Bucket',
  'Spice Pouch', 'Flamtaer Bag', 'Seed Vault', 'Fossil Storage',
  'Colossal Pouch', 'Dizana\'s Quiver', 'Forestry Kit', 'Gricoller\'s Can'
];

export const GUILDS_LIST = [
  'Champions\' Guild', 'Cooks\' Guild', 'Crafting Guild', 'Mining Guild', 'Prayer Guild', 
  'Farming Guild', 'Fishing Guild', 'Heroes\' Guild', 'Hunter Guild', 'Legends\' Guild',
  'Myths\' Guild', 'Ranging Guild', 'Rogues\' Den', 'Servants\' Guild', 'Warriors\' Guild',
  'Wizards\' Guild', 'Woodcutting Guild'
];

// Slayer reward-point "Unlocks" (verified against the OSRS wiki Slayer Rewards
// interface): monster-assignment unlocks, the finishing-blow toggles, and the
// crafting/utility unlocks bought with Slayer points.
export const SLAYER_UNLOCKS_LIST = [
  'Malevolent Masquerade', 'Broader Fletching', 'Ring Bling', 'Bigger and Badder',
  'Like a Boss', 'Task Storage', 'Gargoyle Smasher', 'Slug Salter', 'Reptile Freezer',
  "'Shroom Sprayer", 'Duly Noted', 'Stop the Wyvern', 'Double Trouble',
  'Seeing Red', 'Watch the Birdie', 'Hot Stuff', 'Reptile Got Ripped', 'Basilocked',
  'Actual Vampyre Slayer', 'I Wildy More Slayer', 'Warped Reality', 'Lured In',
  'Wings Spread'
];

export const FARMING_PATCH_LIST = [
  'Allotment', 'Herb', 'Flower', 'Hops', 'Bush', 'Wood Tree', 
  'Fruit Tree', 'Hardwood Tree', 'Cactus', 'Mushroom', 'Belladonna', 
  'Seaweed', 'Calquat', 'Spirit Tree', 'Celastrus', 'Redwood', 
  'Crystal Tree', 'Hespori Patch', 'Anima', 'Vinery', 'Coral Nursery'
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
  'Hespori Patch': "Bottomless Bucket, Anima Seeds",
  'Anima': "Attas, Iasor, Kronos",
  'Vinery': "Grapes (for wine)",
  'Coral Nursery': "Coral (potion ingredients)"
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
  'Shellbane Gryphon', 'Maggot King', 'The Mad Angel'
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

// Labels remain the legacy save/UI boundary; identity and hierarchy live in the catalogue.
export const MISTHALIN_AREAS = AREA_CATALOG.filter(area => area.parentId === 'area:0001').map(area => area.name);
export const REGION_GROUPS: Record<string, string[]> = Object.fromEntries(
  AREA_CATALOG.filter(area => !area.parentId && area.id !== 'area:0001').map(parent => [
    parent.name, AREA_CATALOG.filter(area => area.parentId === parent.id).map(area => area.name),
  ]),
);

export const REGIONS_LIST = Object.values(REGION_GROUPS).flat();
