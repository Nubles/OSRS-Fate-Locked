
import { DropSource } from '../types';

export interface DiaryTier {
  id: string; // e.g. "Ardougne Easy"
  region: string;
  tier: 'Easy' | 'Medium' | 'Hard' | 'Elite';
  difficulty: DropSource;
  skills: Record<string, number>;
  quests: string[];
  requiredRegions: string[]; // Extra regions needed besides the main one
}

export const DIARY_DATA: Record<string, DiaryTier> = {
  // --- ARDOUGNE ---
  'Ardougne Easy': {
    id: 'Ardougne Easy', region: 'Kandarin', tier: 'Easy', difficulty: DropSource.DIARY_EASY,
    skills: { 'Thieving': 5 }, quests: ['Rune Mysteries', 'Plague City'], requiredRegions: ['Kandarin']
  },
  'Ardougne Medium': {
    id: 'Ardougne Medium', region: 'Kandarin', tier: 'Medium', difficulty: DropSource.DIARY_MEDIUM,
    skills: { 'Agility': 39, 'Farming': 31, 'Firemaking': 50, 'Magic': 51, 'Strength': 38, 'Thieving': 38 },
    quests: ['Enlightened Journey', 'The Hand in the Sand', 'Tower of Life', 'Sea Slug'], requiredRegions: ['Kandarin', 'Asgarnia', 'Misthalin']
  },
  'Ardougne Hard': {
    id: 'Ardougne Hard', region: 'Kandarin', tier: 'Hard', difficulty: DropSource.DIARY_HARD,
    skills: { 'Agility': 65, 'Construction': 50, 'Crafting': 35, 'Farming': 65, 'Fishing': 53, 'Hunter': 59, 'Magic': 66, 'Mining': 52, 'Prayer': 42, 'Runecraft': 65, 'Smithing': 68, 'Thieving': 72, 'Woodcutting': 50 },
    quests: ['Monkey Madness I', 'Legends\' Quest', 'Mourning\'s End Part I', 'Watchtower'], requiredRegions: ['Kandarin', 'Tirannwn', 'Islands & Others']
  },
  'Ardougne Elite': {
    id: 'Ardougne Elite', region: 'Kandarin', tier: 'Elite', difficulty: DropSource.DIARY_ELITE,
    skills: { 'Agility': 90, 'Cooking': 91, 'Crafting': 35, 'Farming': 85, 'Fishing': 81, 'Fletching': 69, 'Herblore': 45, 'Magic': 94, 'Smithing': 91, 'Thieving': 82 },
    quests: ['Desert Treasure I', 'Song of the Elves'], requiredRegions: ['Kandarin', 'Tirannwn', 'Kharidian Desert']
  },
  // --- DESERT ---
  'Desert Easy': {
    id: 'Desert Easy', region: 'Kharidian Desert', tier: 'Easy', difficulty: DropSource.DIARY_EASY,
    skills: { 'Hunter': 5, 'Thieving': 21 }, quests: [], requiredRegions: ['Kharidian Desert']
  },
  'Desert Medium': {
    id: 'Desert Medium', region: 'Kharidian Desert', tier: 'Medium', difficulty: DropSource.DIARY_MEDIUM,
    skills: { 'Agility': 30, 'Construction': 20, 'Crafting': 30, 'Firemaking': 45, 'Herblore': 36, 'Hunter': 47, 'Magic': 39, 'Mining': 37, 'Prayer': 43, 'Slayer': 22, 'Thieving': 25, 'Woodcutting': 35 },
    quests: ['The Golem', 'Eagles\' Peak', 'Spirits of the Elid', 'Enakhra\'s Lament'], requiredRegions: ['Kharidian Desert', 'Kandarin']
  },
  'Desert Hard': {
    id: 'Desert Hard', region: 'Kharidian Desert', tier: 'Hard', difficulty: DropSource.DIARY_HARD,
    skills: { 'Agility': 75, 'Construction': 70, 'Crafting': 61, 'Firemaking': 50, 'Fletching': 10, 'Herblore': 50, 'Hunter': 67, 'Magic': 94, 'Mining': 70, 'Prayer': 70, 'Slayer': 65, 'Smithing': 50, 'Thieving': 65 },
    quests: ['Desert Treasure I', 'Contact!', 'Dream Mentor', 'The Tourist Trap'], requiredRegions: ['Kharidian Desert', 'Fremennik']
  },
  'Desert Elite': {
    id: 'Desert Elite', region: 'Kharidian Desert', tier: 'Elite', difficulty: DropSource.DIARY_ELITE,
    skills: { 'Construction': 78, 'Cooking': 85, 'Crafting': 80, 'Fletching': 95, 'Herblore': 90, 'Magic': 94, 'Prayer': 85, 'Slayer': 93, 'Thieving': 91 },
    quests: ['Desert Treasure II'], requiredRegions: ['Kharidian Desert', 'Morytania', 'Asgarnia', 'Fremennik']
  },
  // --- FALADOR ---
  'Falador Easy': {
    id: 'Falador Easy', region: 'Asgarnia', tier: 'Easy', difficulty: DropSource.DIARY_EASY,
    skills: { 'Agility': 5, 'Construction': 16, 'Mining': 10, 'Smithing': 13, 'Thieving': 13 }, 
    quests: ['The Knight\'s Sword', 'Doric\'s Quest'], requiredRegions: ['Asgarnia']
  },
  'Falador Medium': {
    id: 'Falador Medium', region: 'Asgarnia', tier: 'Medium', difficulty: DropSource.DIARY_MEDIUM,
    skills: { 'Agility': 42, 'Cooking': 20, 'Crafting': 40, 'Defence': 20, 'Farming': 23, 'Firemaking': 49, 'Magic': 37, 'Mining': 40, 'Prayer': 10, 'Ranged': 19, 'Slayer': 32, 'Strength': 37, 'Thieving': 40, 'Woodcutting': 30 }, 
    quests: ['Ratcatchers', 'Skippy and the Mogres', 'Recruitment Drive'], requiredRegions: ['Asgarnia', 'Misthalin', 'Kandarin', 'Kharidian Desert']
  },
  'Falador Hard': {
    id: 'Falador Hard', region: 'Asgarnia', tier: 'Hard', difficulty: DropSource.DIARY_HARD,
    skills: { 'Agility': 59, 'Construction': 50, 'Crafting': 31, 'Defence': 50, 'Farming': 45, 'Firemaking': 30, 'Herblore': 52, 'Mining': 60, 'Prayer': 70, 'Runecraft': 56, 'Slayer': 72, 'Smithing': 40, 'Thieving': 58, 'Woodcutting': 71 }, 
    quests: ['Heroes\' Quest', 'Grim Tales', 'The Slug Menace'], requiredRegions: ['Asgarnia', 'Kandarin', 'Misthalin']
  },
  'Falador Elite': {
    id: 'Falador Elite', region: 'Asgarnia', tier: 'Elite', difficulty: DropSource.DIARY_ELITE,
    skills: { 'Agility': 80, 'Farming': 91, 'Herblore': 81, 'Magic': 96, 'Mining': 17, 'Runecraft': 88, 'Smithing': 13, 'Thieving': 13, 'Woodcutting': 75 }, 
    quests: [], requiredRegions: ['Asgarnia', 'Karamja']
  },
  // --- FREMENNIK ---
  'Fremennik Easy': {
    id: 'Fremennik Easy', region: 'Fremennik', tier: 'Easy', difficulty: DropSource.DIARY_EASY,
    skills: { 'Crafting': 23, 'Firemaking': 15, 'Hunter': 11, 'Mining': 20, 'Smithing': 20, 'Thieving': 5, 'Woodcutting': 15 }, 
    quests: ['The Fremennik Trials'], requiredRegions: ['Fremennik']
  },
  'Fremennik Medium': {
    id: 'Fremennik Medium', region: 'Fremennik', tier: 'Medium', difficulty: DropSource.DIARY_MEDIUM,
    skills: { 'Agility': 35, 'Construction': 37, 'Defence': 30, 'Hunter': 35, 'Mining': 40, 'Slayer': 47, 'Smithing': 50, 'Thieving': 42, 'Woodcutting': 56 }, 
    quests: ['Eagles\' Peak', 'Between a Rock...', 'The Giant Dwarf', 'Olaf\'s Quest'], requiredRegions: ['Fremennik', 'Kandarin']
  },
  'Fremennik Hard': {
    id: 'Fremennik Hard', region: 'Fremennik', tier: 'Hard', difficulty: DropSource.DIARY_HARD,
    skills: { 'Agility': 35, 'Construction': 20, 'Crafting': 61, 'Herblore': 66, 'Hunter': 55, 'Magic': 72, 'Mining': 70, 'Smithing': 60, 'Thieving': 75, 'Woodcutting': 56 }, 
    quests: ['The Fremennik Isles', 'Lunar Diplomacy', 'Royal Trouble', 'Throne of Miscellania'], requiredRegions: ['Fremennik']
  },
  'Fremennik Elite': {
    id: 'Fremennik Elite', region: 'Fremennik', tier: 'Elite', difficulty: DropSource.DIARY_ELITE,
    skills: { 'Agility': 80, 'Crafting': 80, 'Fletching': 25, 'Hitpoints': 70, 'Magic': 82, 'Prayer': 85, 'Runecraft': 77, 'Slayer': 83, 'Smithing': 90, 'Strength': 70 }, 
    quests: ['Dragon Slayer II'], requiredRegions: ['Fremennik', 'Misthalin', 'Kandarin']
  },
  // --- KANDARIN ---
  'Kandarin Easy': {
    id: 'Kandarin Easy', region: 'Kandarin', tier: 'Easy', difficulty: DropSource.DIARY_EASY,
    skills: { 'Agility': 20, 'Farming': 13, 'Fishing': 16 }, 
    quests: ['Waterfall Quest', 'Monk\'s Friend'], requiredRegions: ['Kandarin']
  },
  'Kandarin Medium': {
    id: 'Kandarin Medium', region: 'Kandarin', tier: 'Medium', difficulty: DropSource.DIARY_MEDIUM,
    skills: { 'Agility': 36, 'Cooking': 43, 'Farming': 26, 'Fishing': 46, 'Fletching': 50, 'Herblore': 48, 'Magic': 45, 'Mining': 30, 'Ranged': 40, 'Strength': 22, 'Thieving': 47 }, 
    quests: ['Alfred Grimhand\'s Barcrawl', 'Elemental Workshop II', 'Waterfall Quest'], requiredRegions: ['Kandarin']
  },
  'Kandarin Hard': {
    id: 'Kandarin Hard', region: 'Kandarin', tier: 'Hard', difficulty: DropSource.DIARY_HARD,
    skills: { 'Agility': 60, 'Construction': 50, 'Crafting': 10, 'Defence': 70, 'Firemaking': 65, 'Fishing': 70, 'Fletching': 70, 'Herblore': 45, 'Magic': 56, 'Prayer': 70, 'Smithing': 75, 'Strength': 50, 'Thieving': 53, 'Woodcutting': 60 }, 
    quests: ['King\'s Ransom', 'Legends\' Quest'], requiredRegions: ['Kandarin', 'Asgarnia', 'Misthalin']
  },
  'Kandarin Elite': {
    id: 'Kandarin Elite', region: 'Kandarin', tier: 'Elite', difficulty: DropSource.DIARY_ELITE,
    skills: { 'Agility': 60, 'Construction': 50, 'Cooking': 80, 'Crafting': 85, 'Farming': 79, 'Firemaking': 85, 'Fishing': 76, 'Herblore': 86, 'Magic': 87, 'Smithing': 90 }, 
    quests: ['Barbarian Training'], requiredRegions: ['Kandarin']
  },
  // --- KARAMJA ---
  'Karamja Easy': {
    id: 'Karamja Easy', region: 'Karamja', tier: 'Easy', difficulty: DropSource.DIARY_EASY,
    skills: { 'Agility': 15, 'Mining': 40 }, quests: ['Jungle Potion'], requiredRegions: ['Karamja']
  },
  'Karamja Medium': {
    id: 'Karamja Medium', region: 'Karamja', tier: 'Medium', difficulty: DropSource.DIARY_MEDIUM,
    skills: { 'Agility': 12, 'Cooking': 16, 'Farming': 27, 'Fishing': 65, 'Hunter': 41, 'Mining': 40, 'Woodcutting': 50 }, 
    quests: ['Tai Bwo Wannai Trio', 'Shilo Village', 'The Grand Tree'], requiredRegions: ['Karamja', 'Kandarin']
  },
  'Karamja Hard': {
    id: 'Karamja Hard', region: 'Karamja', tier: 'Hard', difficulty: DropSource.DIARY_HARD,
    skills: { 'Agility': 53, 'Cooking': 30, 'Magic': 59, 'Mining': 52, 'Ranged': 42, 'Runecraft': 44, 'Slayer': 50, 'Smithing': 40, 'Strength': 50, 'Thieving': 50, 'Woodcutting': 34 }, 
    quests: ['Legends\' Quest', 'Tai Bwo Wannai Trio', 'Shilo Village'], requiredRegions: ['Karamja', 'Kandarin']
  },
  'Karamja Elite': {
    id: 'Karamja Elite', region: 'Karamja', tier: 'Elite', difficulty: DropSource.DIARY_ELITE,
    skills: { 'Agility': 15, 'Cooking': 22, 'Farming': 72, 'Herblore': 87, 'Runecraft': 91, 'Slayer': 87 }, 
    quests: [], requiredRegions: ['Karamja']
  },
  // --- KOUREND ---
  'Kourend Easy': {
    id: 'Kourend Easy', region: 'Kourend & Kebos', tier: 'Easy', difficulty: DropSource.DIARY_EASY,
    skills: { 'Construction': 25, 'Fishing': 20, 'Herblore': 12, 'Mining': 15, 'Thieving': 25 }, 
    quests: ['Client of Kourend'], requiredRegions: ['Kourend & Kebos']
  },
  'Kourend Medium': {
    id: 'Kourend Medium', region: 'Kourend & Kebos', tier: 'Medium', difficulty: DropSource.DIARY_MEDIUM,
    skills: { 'Agility': 49, 'Crafting': 30, 'Farming': 45, 'Firemaking': 50, 'Fishing': 43, 'Hunter': 35, 'Magic': 25, 'Mining': 42, 'Slayer': 50, 'Woodcutting': 50 }, 
    quests: ['The Depths of Despair', 'Queen of Thieves', 'Tale of the Righteous', 'The Forsaken Tower', 'The Ascent of Arceuus'], requiredRegions: ['Kourend & Kebos']
  },
  'Kourend Hard': {
    id: 'Kourend Hard', region: 'Kourend & Kebos', tier: 'Hard', difficulty: DropSource.DIARY_HARD,
    skills: { 'Agility': 49, 'Construction': 50, 'Crafting': 38, 'Farming': 74, 'Magic': 66, 'Mining': 65, 'Slayer': 62, 'Smithing': 70, 'Thieving': 49, 'Woodcutting': 60 }, 
    quests: ['Dream Mentor', 'Architectural Alliance'], requiredRegions: ['Kourend & Kebos', 'Fremennik']
  },
  'Kourend Elite': {
    id: 'Kourend Elite', region: 'Kourend & Kebos', tier: 'Elite', difficulty: DropSource.DIARY_ELITE,
    skills: { 'Cooking': 84, 'Crafting': 38, 'Farming': 85, 'Firemaking': 85, 'Fishing': 82, 'Fletching': 40, 'Herblore': 90, 'Magic': 95, 'Mining': 38, 'Prayer': 85, 'Runecraft': 77, 'Slayer': 95, 'Smithing': 40, 'Woodcutting': 90 }, 
    quests: ['Dragon Slayer II', 'A Kingdom Divided'], requiredRegions: ['Kourend & Kebos', 'Misthalin', 'Fremennik']
  },
  // --- LUMBRIDGE ---
  'Lumbridge Easy': {
    id: 'Lumbridge Easy', region: 'Misthalin', tier: 'Easy', difficulty: DropSource.DIARY_EASY,
    skills: { 'Agility': 10, 'Firemaking': 15, 'Fishing': 15, 'Mining': 15, 'Runecraft': 5, 'Slayer': 7, 'Woodcutting': 15 }, 
    quests: ['Cook\'s Assistant', 'Rune Mysteries', 'The Restless Ghost'], requiredRegions: ['Misthalin']
  },
  'Lumbridge Medium': {
    id: 'Lumbridge Medium', region: 'Misthalin', tier: 'Medium', difficulty: DropSource.DIARY_MEDIUM,
    skills: { 'Agility': 20, 'Crafting': 38, 'Fishing': 30, 'Hunter': 15, 'Magic': 31, 'Prayer': 40, 'Range': 30, 'Runecraft': 23, 'Strength': 30, 'Thieving': 30, 'Woodcutting': 36 }, 
    quests: ['Lost City'], requiredRegions: ['Misthalin', 'Islands & Others']
  },
  'Lumbridge Hard': {
    id: 'Lumbridge Hard', region: 'Misthalin', tier: 'Hard', difficulty: DropSource.DIARY_HARD,
    skills: { 'Agility': 46, 'Crafting': 50, 'Farming': 63, 'Firemaking': 65, 'Magic': 60, 'Prayer': 52, 'Runecraft': 59, 'Woodcutting': 57 }, 
    quests: ['Recipe for Disaster', 'Desert Treasure I'], requiredRegions: ['Misthalin', 'Kharidian Desert', 'Asgarnia']
  },
  'Lumbridge Elite': {
    id: 'Lumbridge Elite', region: 'Misthalin', tier: 'Elite', difficulty: DropSource.DIARY_ELITE,
    skills: { 'Agility': 70, 'Farming': 63, 'Magic': 70, 'Ranged': 70, 'Runecraft': 76, 'Smithing': 88, 'Strength': 70, 'Thieving': 72, 'Woodcutting': 75 }, 
    quests: ['Quest Point Cape'], requiredRegions: ['Misthalin'] 
  },
  // --- MORYTANIA ---
  'Morytania Easy': {
    id: 'Morytania Easy', region: 'Morytania', tier: 'Easy', difficulty: DropSource.DIARY_EASY,
    skills: { 'Cooking': 12, 'Crafting': 15, 'Farming': 23, 'Slayer': 15 }, 
    quests: ['Nature Spirit', 'Priest in Peril', 'The Restless Ghost'], requiredRegions: ['Morytania', 'Misthalin']
  },
  'Morytania Medium': {
    id: 'Morytania Medium', region: 'Morytania', tier: 'Medium', difficulty: DropSource.DIARY_MEDIUM,
    skills: { 'Agility': 42, 'Cooking': 40, 'Fishing': 50, 'Herblore': 22, 'Hunter': 29, 'Slayer': 42, 'Smithing': 50, 'Thieving': 42, 'Woodcutting': 45 }, 
    quests: ['Cabin Fever', 'Ghosts Ahoy'], requiredRegions: ['Morytania', 'Islands & Others']
  },
  'Morytania Hard': {
    id: 'Morytania Hard', region: 'Morytania', tier: 'Hard', difficulty: DropSource.DIARY_HARD,
    skills: { 'Agility': 71, 'Construction': 50, 'Defence': 70, 'Farming': 53, 'Firemaking': 50, 'Magic': 66, 'Mining': 55, 'Prayer': 70, 'Slayer': 58, 'Smithing': 50, 'Thieving': 53, 'Woodcutting': 50 }, 
    quests: ['Desert Treasure I', 'King\'s Ransom', 'Haunted Mine'], requiredRegions: ['Morytania', 'Kandarin', 'Kharidian Desert']
  },
  'Morytania Elite': {
    id: 'Morytania Elite', region: 'Morytania', tier: 'Elite', difficulty: DropSource.DIARY_ELITE,
    skills: { 'Attack': 70, 'Crafting': 84, 'Defence': 70, 'Firemaking': 80, 'Fishing': 96, 'Magic': 83, 'Ranged': 70, 'Slayer': 85, 'Strength': 76 }, 
    quests: ['Lunar Diplomacy'], requiredRegions: ['Morytania', 'Fremennik']
  },
  // --- VARROCK ---
  'Varrock Easy': {
    id: 'Varrock Easy', region: 'Misthalin', tier: 'Easy', difficulty: DropSource.DIARY_EASY,
    skills: { 'Agility': 13, 'Crafting': 8, 'Fishing': 20, 'Mining': 15, 'Runecraft': 9, 'Thieving': 5 }, 
    quests: ['Rune Mysteries'], requiredRegions: ['Misthalin']
  },
  'Varrock Medium': {
    id: 'Varrock Medium', region: 'Misthalin', tier: 'Medium', difficulty: DropSource.DIARY_MEDIUM,
    skills: { 'Agility': 30, 'Combat': 40, 'Farming': 30, 'Firemaking': 40, 'Herblore': 10, 'Magic': 25, 'Mining': 40, 'Thieving': 25, 'Woodcutting': 40 }, 
    quests: ['Enlightened Journey', 'Gertrude\'s Cat', 'Garden of Tranquillity', 'Tree Gnome Village'], requiredRegions: ['Misthalin', 'Kandarin']
  },
  'Varrock Hard': {
    id: 'Varrock Hard', region: 'Misthalin', tier: 'Hard', difficulty: DropSource.DIARY_HARD,
    skills: { 'Agility': 51, 'Construction': 50, 'Farming': 68, 'Firemaking': 60, 'Hunter': 66, 'Magic': 54, 'Prayer': 52, 'Ranged': 40, 'Thieving': 53, 'Woodcutting': 60 }, 
    quests: ['Desert Treasure I'], requiredRegions: ['Misthalin', 'Kharidian Desert']
  },
  'Varrock Elite': {
    id: 'Varrock Elite', region: 'Misthalin', tier: 'Elite', difficulty: DropSource.DIARY_ELITE,
    skills: { 'Cooking': 95, 'Fletching': 81, 'Herblore': 90, 'Magic': 86, 'Runecraft': 78, 'Smithing': 89 }, 
    quests: ['Dream Mentor', 'Rune Mysteries'], requiredRegions: ['Misthalin', 'Fremennik']
  },
  // --- WESTERN PROVINCES ---
  'Western Easy': {
    id: 'Western Easy', region: 'Kandarin', tier: 'Easy', difficulty: DropSource.DIARY_EASY,
    skills: { 'Fletching': 10, 'Hunter': 9, 'Mining': 15, 'Ranged': 30 }, 
    quests: ['Big Chompy Bird Hunting', 'Biohazard', 'Plague City', 'Roving Elves'], requiredRegions: ['Kandarin', 'Tirannwn']
  },
  'Western Medium': {
    id: 'Western Medium', region: 'Kandarin', tier: 'Medium', difficulty: DropSource.DIARY_MEDIUM,
    skills: { 'Agility': 37, 'Combat': 40, 'Cooking': 42, 'Firemaking': 35, 'Fishing': 46, 'Fletching': 5, 'Hunter': 31, 'Mining': 40, 'Ranged': 30, 'Woodcutting': 35 }, 
    quests: ['The Eyes of Glouphrie', 'Big Chompy Bird Hunting', 'Eagles\' Peak', 'Monkey Madness I', 'One Small Favour', 'Underground Pass'], requiredRegions: ['Kandarin', 'Islands & Others']
  },
  'Western Hard': {
    id: 'Western Hard', region: 'Kandarin', tier: 'Hard', difficulty: DropSource.DIARY_HARD,
    skills: { 'Agility': 56, 'Combat': 100, 'Construction': 50, 'Cooking': 70, 'Farming': 68, 'Firemaking': 50, 'Fishing': 62, 'Fletching': 5, 'Hunter': 69, 'Magic': 64, 'Mining': 70, 'Prayer': 70, 'Ranged': 70, 'Thieving': 50, 'Woodcutting': 50 }, 
    quests: ['Mourning\'s End Part I', 'Swan Song', 'Regicide'], requiredRegions: ['Kandarin', 'Tirannwn']
  },
  'Western Elite': {
    id: 'Western Elite', region: 'Kandarin', tier: 'Elite', difficulty: DropSource.DIARY_ELITE,
    skills: { 'Agility': 85, 'Construction': 50, 'Cooking': 42, 'Defence': 40, 'Farming': 75, 'Firemaking': 35, 'Fletching': 85, 'Magic': 75, 'Prayer': 42, 'Ranged': 40, 'Slayer': 93, 'Strength': 40, 'Thieving': 85 }, 
    quests: [], requiredRegions: ['Kandarin', 'Tirannwn']
  },
  // --- WILDERNESS ---
  'Wilderness Easy': {
    id: 'Wilderness Easy', region: 'Wilderness', tier: 'Easy', difficulty: DropSource.DIARY_EASY,
    skills: { 'Agility': 15, 'Magic': 21, 'Mining': 15 }, 
    quests: ['Enter the Abyss'], requiredRegions: ['Wilderness', 'Misthalin']
  },
  'Wilderness Medium': {
    id: 'Wilderness Medium', region: 'Wilderness', tier: 'Medium', difficulty: DropSource.DIARY_MEDIUM,
    skills: { 'Agility': 60, 'Construction': 1, 'Magic': 60, 'Mining': 55, 'Slayer': 50, 'Smithing': 50, 'Strength': 60, 'Woodcutting': 61 }, 
    quests: ['Between a Rock...'], requiredRegions: ['Wilderness', 'Fremennik']
  },
  'Wilderness Hard': {
    id: 'Wilderness Hard', region: 'Wilderness', tier: 'Hard', difficulty: DropSource.DIARY_HARD,
    skills: { 'Agility': 64, 'Combat': 60, 'Firemaking': 50, 'Fishing': 53, 'Hunter': 67, 'Magic': 66, 'Prayer': 52, 'Slayer': 68, 'Smithing': 75 }, 
    quests: ['Death Plateau', 'Desert Treasure I'], requiredRegions: ['Wilderness', 'Asgarnia', 'Kharidian Desert']
  },
  'Wilderness Elite': {
    id: 'Wilderness Elite', region: 'Wilderness', tier: 'Elite', difficulty: DropSource.DIARY_ELITE,
    skills: { 'Agility': 60, 'Combat': 60, 'Construction': 50, 'Cooking': 90, 'Firemaking': 75, 'Fishing': 85, 'Fletching': 5, 'Magic': 96, 'Mining': 85, 'Slayer': 83, 'Smithing': 90, 'Strength': 60, 'Thieving': 84, 'Woodcutting': 75 }, 
    quests: ['Desert Treasure I', 'King\'s Ransom'], requiredRegions: ['Wilderness']
  },
};