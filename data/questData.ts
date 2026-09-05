
import { DropSource } from '../types';
import type { RequirementPredicate } from '../utils/requirementPredicates';

export interface QuestLocationRequirement {
  id: string;
  label: string;
  standardAreas: string[];
  chunkOptions: Array<{ cx: number; cy: number }>;
}

export interface QuestRequirementOption {
  regions?: string[];
  guilds?: string[];
  locations?: QuestLocationRequirement[];
}

export type QuestKind = 'quest' | 'miniquest';
export type QuestAccessPolicy = 'regions' | 'locations' | 'regions-and-locations';

export interface QuestData {
  id: string;
  name: string;
  kind: QuestKind;
  accessPolicy: QuestAccessPolicy;
  regions: string[];
  locations?: QuestLocationRequirement[];
  skills: Record<string, number>;
  combatLevel?: number;
  manualRequirements?: string[];
  operationalRequirements?: RequirementPredicate[];
  prereqs: string[];
  points: number;
  series?: string;
  difficulty: DropSource;
  oneOf?: QuestRequirementOption[];
}

export const questAccessPolicyStructureErrors = (
  quest: Pick<QuestData, 'accessPolicy' | 'regions' | 'locations'>,
): string[] => {
  if (quest.accessPolicy === 'locations') {
    return quest.locations?.length
      ? []
      : ['locations policy requires at least one base location'];
  }
  if (quest.accessPolicy === 'regions-and-locations') {
    const errors: string[] = [];
    if (!quest.regions?.length) {
      errors.push('regions-and-locations policy requires at least one region');
    }
    if (!quest.locations?.length) {
      errors.push('regions-and-locations policy requires at least one base location');
    }
    return errors;
  }
  return [];
};

const LOCATIONS = {
  edgevilleDitch: { id: 'edgeville-ditch', label: 'Edgeville ditch', standardAreas: ['Edgeville'], chunkOptions: [{ cx: 48, cy: 55 }] },
  varrockSouthGate: { id: 'varrock-south-gate', label: 'Varrock south gate', standardAreas: ['Varrock'], chunkOptions: [{ cx: 50, cy: 52 }] },
  lavaMazeEntrance: { id: 'lava-maze-entrance', label: 'Lava Maze entrance', standardAreas: ['Lava Maze'], chunkOptions: [{ cx: 47, cy: 59 }] },
  draynorVillage: { id: 'draynor-village', label: 'Draynor Village', standardAreas: ['Draynor Village'], chunkOptions: [{ cx: 48, cy: 50 }] },
  southFaladorFarm: { id: 'south-falador-farm', label: 'South Falador Farm', standardAreas: ['Falador'], chunkOptions: [{ cx: 47, cy: 51 }] },
  civitas: { id: 'civitas-illa-fortis', label: 'Civitas illa Fortis', standardAreas: ['Civitas illa Fortis'], chunkOptions: [{ cx: 26, cy: 48 }] },
  portSarim: { id: 'port-sarim', label: 'Port Sarim', standardAreas: ['Port Sarim'], chunkOptions: [{ cx: 47, cy: 50 }] },
  varrockMuseum: { id: 'varrock-museum', label: 'Varrock Museum', standardAreas: ['Varrock'], chunkOptions: [{ cx: 50, cy: 53 }] },
  pandemonium: { id: 'the-pandemonium', label: 'The Pandemonium', standardAreas: ['The Pandemonium'], chunkOptions: [{ cx: 47, cy: 46 }] },
  barbarianOutpost: { id: 'barbarian-outpost', label: 'Barbarian Outpost', standardAreas: ['Barbarian Outpost'], chunkOptions: [{ cx: 39, cy: 55 }] },
  blueMoonInn: { id: 'blue-moon-inn', label: 'Blue Moon Inn', standardAreas: ['Varrock'], chunkOptions: [{ cx: 50, cy: 53 }] },
  grandTreeBar: { id: 'grand-tree-bar', label: 'Blurberry Bar in the Grand Tree', standardAreas: ['Tree Gnome Stronghold'], chunkOptions: [{ cx: 38, cy: 54 }] },
  brimhavenBar: { id: 'brimhaven-bar', label: "Dead Man's Chest in Brimhaven", standardAreas: ['Brimhaven'], chunkOptions: [{ cx: 43, cy: 49 }] },
  yanilleBar: { id: 'yanille-bar', label: 'Dragon Inn in Yanille', standardAreas: ['Yanille'], chunkOptions: [{ cx: 39, cy: 48 }] },
  eastArdougneBar: { id: 'east-ardougne-bar', label: 'Flying Horse Inn in East Ardougne', standardAreas: ['East Ardougne'], chunkOptions: [{ cx: 40, cy: 51 }] },
  seersVillageBar: { id: 'seers-village-bar', label: "Forester's Arms in Seers' Village", standardAreas: ["Seers' Village"], chunkOptions: [{ cx: 42, cy: 54 }] },
  jollyBoarInn: { id: 'jolly-boar-inn', label: 'Jolly Boar Inn', standardAreas: ['Varrock'], chunkOptions: [{ cx: 51, cy: 54 }] },
  musaPointBar: { id: 'musa-point-bar', label: 'Karamja Spirits Bar at Musa Point', standardAreas: ['Musa Point'], chunkOptions: [{ cx: 45, cy: 49 }] },
  faladorBar: { id: 'falador-bar', label: 'Rising Sun Inn in Falador', standardAreas: ['Falador'], chunkOptions: [{ cx: 46, cy: 52 }] },
  portSarimBar: { id: 'port-sarim-bar', label: 'Rusty Anchor in Port Sarim', standardAreas: ['Port Sarim'], chunkOptions: [{ cx: 47, cy: 50 }] },
  varrockPalace: { id: 'varrock-palace', label: "Marlo at Varrock's Estate Agent", standardAreas: ['Varrock'], chunkOptions: [{ cx: 50, cy: 54 }] },
  varrockCenter: { id: 'varrock-center', label: "Old Man Yarlo's house in Varrock", standardAreas: ['Varrock'], chunkOptions: [{ cx: 50, cy: 53 }] },
  lumberYard: { id: 'lumber-yard', label: 'Lumber Yard', standardAreas: ['Varrock'], chunkOptions: [{ cx: 51, cy: 54 }] },
  eastVarrockGate: { id: 'east-varrock-gate', label: "Dimintheis's house in south-east Varrock", standardAreas: ['Varrock'], chunkOptions: [{ cx: 51, cy: 53 }] },
  alKharidMine: { id: 'al-kharid-mine', label: 'Al Kharid mine', standardAreas: ['Al Kharid'], chunkOptions: [{ cx: 51, cy: 51 }] },
  eastCatherby: { id: 'east-catherby', label: "Caleb's house in Catherby", standardAreas: ['Catherby'], chunkOptions: [{ cx: 44, cy: 53 }] },
  barrows: { id: 'barrows', label: 'Barrows', standardAreas: ['Barrows'], chunkOptions: [{ cx: 55, cy: 51 }] },
  necropolisMainTemple: { id: 'necropolis-main-temple', label: 'Necropolis main temple', standardAreas: ['Sophanem'], chunkOptions: [{ cx: 52, cy: 42 }] },
  abandonedMine: { id: 'abandoned-mine', label: "Haunted Mine and Tarn's Lair", standardAreas: ['Haunted Mine'], chunkOptions: [{ cx: 53, cy: 50 }] },
  skippysCamp: { id: 'skippys-camp', label: "Skippy's camp south-east of Rimmington", standardAreas: ['Port Sarim'], chunkOptions: [{ cx: 46, cy: 49 }] },
} satisfies Record<string, QuestLocationRequirement>;

export const QUEST_DATA: Record<string, QuestData> = {
  // --- F2P Quests ---
  'Learning the Ropes': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Learning the Ropes', name: 'Learning the Ropes',
    regions: [],
    skills: {}, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Cook\'s Assistant': {
    kind: 'quest', accessPolicy: 'locations',
    id: 'Cook\'s Assistant', name: 'Cook\'s Assistant',
    regions: ["Misthalin"],
    locations: [
      { id: "lumbridge-castle", label: "Lumbridge Castle", standardAreas: ["Lumbridge"], chunkOptions: [{ cx: 50, cy: 50 }] },
    ],
    skills: {}, prereqs: [], points: 1, series: 'Recipe for Disaster',
    difficulty: DropSource.QUEST_NOVICE
  },
  'Demon Slayer': {
    kind: 'quest', accessPolicy: 'locations',
    id: 'Demon Slayer', name: 'Demon Slayer',
    regions: ["Misthalin"],
    locations: [
      { id: "varrock-square", label: "Varrock square", standardAreas: ["Varrock"], chunkOptions: [{ cx: 50, cy: 53 }] },
      { id: "varrock-palace", label: "Varrock Palace", standardAreas: ["Varrock"], chunkOptions: [{ cx: 50, cy: 54 }] },
      { id: "wizards-tower", label: "Wizards' Tower", standardAreas: ["Wizards' Tower"], chunkOptions: [{ cx: 48, cy: 49 }] },
      { id: "varrock-south-gate", label: "Varrock south gate", standardAreas: ["Varrock"], chunkOptions: [{ cx: 50, cy: 52 }] },
    ],
    skills: {}, prereqs: [], points: 3, series: 'Demon Slayer',
    difficulty: DropSource.QUEST_NOVICE
  },
  'The Restless Ghost': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'The Restless Ghost', name: 'The Restless Ghost',
    regions: ['Lumbridge'],
    skills: {}, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Romeo & Juliet': {
    kind: 'quest', accessPolicy: 'locations',
    id: 'Romeo & Juliet', name: 'Romeo & Juliet',
    regions: ['Misthalin'],
    locations: [
      { id: 'varrock-square', label: 'Varrock square', standardAreas: ['Varrock'], chunkOptions: [{ cx: 50, cy: 53 }] },
      { id: 'juliets-house', label: "Juliet's house in west Varrock", standardAreas: ['Varrock'], chunkOptions: [{ cx: 49, cy: 53 }] },
      { id: 'varrock-church', label: 'Varrock church', standardAreas: ['Varrock'], chunkOptions: [{ cx: 50, cy: 54 }] },
    ],
    skills: {}, prereqs: [], points: 5,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Sheep Shearer': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Sheep Shearer', name: 'Sheep Shearer',
    regions: ['Lumbridge'],
    skills: {}, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Shield of Arrav': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Shield of Arrav', name: 'Shield of Arrav',
    regions: ['Varrock'],
    manualRequirements: ['A trustworthy partner in the opposite gang'],
    skills: {}, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Ernest the Chicken': {
    kind: 'quest', accessPolicy: 'locations',
    id: 'Ernest the Chicken', name: 'Ernest the Chicken',
    regions: ["Misthalin"],
    locations: [
      { id: "draynor-manor", label: "Draynor Manor", standardAreas: ["Draynor Village"], chunkOptions: [{ cx: 48, cy: 52 }] },
    ],
    skills: {}, prereqs: [], points: 4,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Vampyre Slayer': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Vampyre Slayer', name: 'Vampyre Slayer',
    regions: ['Draynor Village', 'Varrock'],
    skills: {}, prereqs: [], points: 3,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Imp Catcher': {
    kind: 'quest', accessPolicy: 'locations',
    id: 'Imp Catcher', name: 'Imp Catcher',
    regions: ['Misthalin'],
    locations: [
      { id: 'wizards-tower', label: "Wizards' Tower", standardAreas: ["Wizards' Tower"], chunkOptions: [{ cx: 48, cy: 49 }] },
    ],
    skills: {}, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Prince Ali Rescue': {
    kind: 'quest', accessPolicy: 'locations',
    id: 'Prince Ali Rescue', name: 'Prince Ali Rescue',
    regions: ['Kharidian Desert', 'Misthalin'],
    locations: [
      { id: 'al-kharid-palace', label: 'Al Kharid Palace', standardAreas: ['Al Kharid'], chunkOptions: [{ cx: 51, cy: 49 }] },
      { id: 'draynor-village-and-jail', label: 'Draynor Village and the jail', standardAreas: ['Draynor Village'], chunkOptions: [{ cx: 48, cy: 50 }] },
    ],
    skills: {}, prereqs: [], points: 3, series: 'Kharidian',
    difficulty: DropSource.QUEST_NOVICE
  },
  'Doric\'s Quest': {
    kind: 'quest', accessPolicy: 'locations',
    id: 'Doric\'s Quest', name: 'Doric\'s Quest',
    regions: ["Asgarnia"],
    locations: [
      { id: "dorics-hut", label: "Doric's hut", standardAreas: ["Falador"], chunkOptions: [{ cx: 46, cy: 53 }] },
    ],
    skills: {}, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Black Knights\' Fortress': {
    kind: 'quest', accessPolicy: 'locations',
    id: 'Black Knights\' Fortress', name: 'Black Knights\' Fortress',
    regions: ["Asgarnia"],
    locations: [
      { id: "west-falador", label: "West Falador", standardAreas: ["Falador"], chunkOptions: [{ cx: 46, cy: 52 }] },
      { id: "black-knights-fortress", label: "Black Knights' Fortress", standardAreas: ["Edgeville"], chunkOptions: [{ cx: 47, cy: 54 }] },
    ],
    skills: { 'Quest Points': 12 }, prereqs: [], points: 3,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Witch\'s Potion': {
    kind: 'quest', accessPolicy: 'locations',
    id: 'Witch\'s Potion', name: 'Witch\'s Potion',
    regions: ['Asgarnia'],
    locations: [{
      id: 'rimmington', label: 'Rimmington',
      standardAreas: ['Rimmington'],
      chunkOptions: [{ cx: 46, cy: 50 }],
    }],
    skills: {}, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_NOVICE
  },
  'The Knight\'s Sword': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'The Knight\'s Sword', name: 'The Knight\'s Sword',
    regions: ['Falador', 'Port Sarim', 'Asgarnian Ice Dungeon', 'Varrock'],
    skills: { 'Mining': 10 }, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Goblin Diplomacy': {
    kind: 'quest', accessPolicy: 'locations',
    id: 'Goblin Diplomacy', name: 'Goblin Diplomacy',
    regions: ['Asgarnia'],
    locations: [
      { id: 'goblin-village', label: 'Goblin Village', standardAreas: ['Goblin Village'], chunkOptions: [{ cx: 46, cy: 54 }] },
    ],
    skills: {}, prereqs: [], points: 5,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Pirate\'s Treasure': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Pirate\'s Treasure', name: 'Pirate\'s Treasure',
    regions: ['Port Sarim', 'Falador', 'Varrock', 'Musa Point'],
    skills: {}, prereqs: [], points: 2,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Dragon Slayer I': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Dragon Slayer I', name: 'Dragon Slayer I',
    regions: ['Varrock', 'Edgeville', 'Draynor Village', 'Lumbridge', 'Rimmington', 'Port Sarim', 'Crandor'],
    skills: {"Quest Points":32}, prereqs: [], points: 2, series: 'Dragonkin',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Rune Mysteries': {
    kind: 'quest', accessPolicy: 'locations',
    id: 'Rune Mysteries', name: 'Rune Mysteries',
    regions: ['Misthalin'],
    locations: [
      { id: 'lumbridge-castle', label: 'Lumbridge Castle', standardAreas: ['Lumbridge'], chunkOptions: [{ cx: 50, cy: 50 }] },
      { id: 'wizards-tower', label: "Wizards' Tower", standardAreas: ["Wizards' Tower"], chunkOptions: [{ cx: 48, cy: 49 }] },
      { id: 'auburys-rune-shop', label: "Aubury's rune shop in Varrock", standardAreas: ['Varrock'], chunkOptions: [{ cx: 50, cy: 53 }] },
    ],
    skills: {}, prereqs: [], points: 1, series: 'Order of Wizards',
    difficulty: DropSource.QUEST_NOVICE
  },
  'Misthalin Mystery': {
    kind: 'quest', accessPolicy: 'locations',
    id: 'Misthalin Mystery', name: 'Misthalin Mystery',
    regions: ['Misthalin'],
    locations: [
      { id: 'misthalin-mystery-island', label: "Abigail and Hewey's island", standardAreas: ['Lumbridge'], chunkOptions: [{ cx: 50, cy: 49 }] },
    ],
    skills: {}, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Below Ice Mountain': {
    kind: 'quest', accessPolicy: 'locations',
    id: 'Below Ice Mountain', name: 'Below Ice Mountain',
    regions: ["Asgarnia","Misthalin"],
    locations: [
      { id: "west-falador", label: "West Falador", standardAreas: ["Falador"], chunkOptions: [{ cx: 46, cy: 52 }] },
      { id: "falador-north-gate", label: "Falador north gate", standardAreas: ["Falador"], chunkOptions: [{ cx: 46, cy: 53 }] },
      { id: "goblin-village", label: "Goblin Village", standardAreas: ["Goblin Village"], chunkOptions: [{ cx: 46, cy: 54 }] },
      { id: "edgeville", label: "Edgeville", standardAreas: ["Edgeville"], chunkOptions: [{ cx: 48, cy: 54 }] },
      { id: "varrock-south-gate", label: "Varrock south gate", standardAreas: ["Varrock"], chunkOptions: [{ cx: 50, cy: 52 }] },
      { id: "varrock-square", label: "Varrock square", standardAreas: ["Varrock"], chunkOptions: [{ cx: 50, cy: 53 }] },
    ],
    skills: { 'Quest Points': 16 }, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_NOVICE
  },
  'The Corsair Curse': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'The Corsair Curse', name: 'The Corsair Curse',
    regions: ['Rimmington', 'Falador', 'Corsair Cove'],
    skills: {}, prereqs: [], points: 2,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'X Marks the Spot': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'X Marks the Spot', name: 'X Marks the Spot',
    regions: ['Lumbridge', 'Draynor Village', 'Port Sarim'],
    skills: {}, prereqs: [], points: 1, series: 'Great Kourend',
    difficulty: DropSource.QUEST_NOVICE
  },

  // --- P2P Quests ---
  'Druidic Ritual': {
    kind: 'quest', accessPolicy: 'locations',
    id: 'Druidic Ritual', name: 'Druidic Ritual',
    regions: ["Asgarnia"],
    locations: [
      { id: "north-taverley", label: "North Taverley", standardAreas: ["Taverley"], chunkOptions: [{ cx: 45, cy: 54 }] },
      { id: "south-taverley", label: "South Taverley", standardAreas: ["Taverley"], chunkOptions: [{ cx: 45, cy: 53 }] },
    ],
    skills: {}, prereqs: [], points: 4,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Lost City': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Lost City', name: 'Lost City',
    regions: ['Lumbridge', 'Zanaris', 'Entrana'],
    skills: { 'Crafting': 31, 'Woodcutting': 36 }, prereqs: [], points: 3,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Witch\'s House': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Witch\'s House', name: 'Witch\'s House',
    regions: ['Taverley'],
    skills: {}, prereqs: [], points: 4,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Merlin\'s Crystal': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Merlin\'s Crystal', name: 'Merlin\'s Crystal',
    regions: ['Camelot', 'Seers\' Village', 'Catherby', 'Taverley', 'Port Sarim', 'Varrock'],
    skills: {}, prereqs: [], points: 6, series: 'Camelot',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Heroes\' Quest': {
    kind: 'quest', accessPolicy: 'regions-and-locations',
    id: 'Heroes\' Quest', name: 'Heroes\' Quest',
    regions: ['Taverley', 'Port Sarim', 'Entrana', 'Varrock', 'Brimhaven'],
    locations: [LOCATIONS.lavaMazeEntrance],
    skills: { 'Quest Points': 55, 'Cooking': 53, 'Fishing': 53, 'Herblore': 25, 'Mining': 50 }, prereqs: ['Shield of Arrav', 'Lost City', 'Merlin\'s Crystal', 'Dragon Slayer I'], points: 1,
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Scorpion Catcher': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Scorpion Catcher', name: 'Scorpion Catcher',
    regions: ['Barbarian Outpost', 'Seers\' Village', 'Taverley', 'Edgeville'],
    skills: { 'Prayer': 31 }, prereqs: ['Alfred Grimhand\'s Barcrawl'], points: 1,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Family Crest': {
    kind: 'quest', accessPolicy: 'locations',
    id: 'Family Crest', name: 'Family Crest',
    regions: ["Asgarnia","Kandarin","Misthalin","Kharidian Desert"],
    locations: [
      { id: "dimintheis-house", label: "Dimintheis's house in south-east Varrock", standardAreas: ["Varrock"], chunkOptions: [{ cx: 51, cy: 53 }] },
      { id: "witchaven", label: "Witchaven", standardAreas: ["Witchaven"], chunkOptions: [{ cx: 42, cy: 51 }] },
      { id: "catherby", label: "Caleb's house in Catherby", standardAreas: ["Catherby"], chunkOptions: [{ cx: 44, cy: 53 }] },
      { id: "dwarven-mine-boot", label: "Boot in the Dwarven Mine", standardAreas: ["Dwarven Mine"], chunkOptions: [{ cx: 48, cy: 54 }] },
      { id: "north-al-kharid", label: "North Al Kharid", standardAreas: ["Al Kharid"], chunkOptions: [{ cx: 51, cy: 50 }] },
      { id: "al-kharid-mine", label: "Al Kharid mine", standardAreas: ["Al Kharid"], chunkOptions: [{ cx: 51, cy: 51 }] },
      { id: "jolly-boar-inn", label: "Jolly Boar Inn", standardAreas: ["Varrock"], chunkOptions: [{ cx: 51, cy: 54 }] },
    ],
    skills: { 'Mining': 40, 'Smithing': 40, 'Magic': 59, 'Crafting': 40 }, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Tribal Totem': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Tribal Totem', name: 'Tribal Totem',
    regions: ['Brimhaven', 'East Ardougne'],
    skills: { 'Thieving': 21 }, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Fishing Contest': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Fishing Contest', name: 'Fishing Contest',
    regions: ['Hemenster'],
    skills: { 'Fishing': 10 }, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Monk\'s Friend': {
    kind: 'quest', accessPolicy: 'locations',
    id: 'Monk\'s Friend', name: 'Monk\'s Friend',
    regions: ['Kandarin'],
    locations: [
      { id: 'ardougne-monastery', label: 'Ardougne Monastery', standardAreas: ['East Ardougne'], chunkOptions: [{ cx: 40, cy: 50 }] },
    ],
    skills: {}, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Temple of Ikov': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Temple of Ikov', name: 'Temple of Ikov',
    regions: ['Hemenster'],
    skills: { 'Thieving': 42 }, prereqs: [], points: 1, series: 'Mahjarrat',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Clock Tower': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Clock Tower', name: 'Clock Tower',
    regions: ['East Ardougne'],
    skills: {}, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Holy Grail': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Holy Grail', name: 'Holy Grail',
    regions: ['Camelot', 'Seers\' Village', 'Entrana', 'Goblin Village', 'Draynor Village', 'Brimhaven'],
    skills: { 'Attack': 20 }, prereqs: ['Merlin\'s Crystal'], points: 2, series: 'Camelot',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Tree Gnome Village': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Tree Gnome Village', name: 'Tree Gnome Village',
    regions: ['Gnome Village'],
    skills: {}, prereqs: [], points: 2, series: 'Gnome',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Fight Arena': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Fight Arena', name: 'Fight Arena',
    regions: ['Fight Arena'],
    skills: {}, prereqs: [], points: 2, series: 'Mahjarrat',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Hazeel Cult': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Hazeel Cult', name: 'Hazeel Cult',
    regions: ['East Ardougne'],
    skills: {}, prereqs: [], points: 1, series: 'Mahjarrat',
    difficulty: DropSource.QUEST_NOVICE
  },
  'Sheep Herder': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Sheep Herder', name: 'Sheep Herder',
    regions: ['East Ardougne'],
    skills: {}, prereqs: [], points: 4,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Plague City': {
    kind: 'quest', accessPolicy: 'locations',
    id: 'Plague City', name: 'Plague City',
    regions: ['Kandarin'],
    locations: [
      { id: 'east-ardougne-edmond', label: "Edmond's house in East Ardougne", standardAreas: ['East Ardougne'], chunkOptions: [{ cx: 39, cy: 52 }] },
      { id: 'west-ardougne', label: 'West Ardougne', standardAreas: ['West Ardougne'], chunkOptions: [{ cx: 39, cy: 51 }] },
    ],
    skills: {}, prereqs: [], points: 1, series: 'Elf',
    difficulty: DropSource.QUEST_NOVICE
  },
  'Sea Slug': {
    kind: 'quest', accessPolicy: 'locations',
    id: 'Sea Slug', name: 'Sea Slug',
    regions: ['Kandarin'],
    locations: [
      { id: 'witchaven-coast', label: 'Witchaven coast', standardAreas: ['Witchaven'], chunkOptions: [{ cx: 42, cy: 51 }] },
      { id: 'fishing-platform', label: 'Fishing Platform', standardAreas: ['Witchaven'], chunkOptions: [{ cx: 43, cy: 51 }] },
    ],
    skills: { 'Firemaking': 30 }, prereqs: [], points: 1, series: 'Temple Knight',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Waterfall Quest': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Waterfall Quest', name: 'Waterfall Quest',
    regions: ['Gnome Village', 'Baxtorian Falls'],
    skills: {}, prereqs: [], points: 1, series: 'Elf',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Biohazard': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Biohazard', name: 'Biohazard',
    regions: ['East Ardougne', 'West Ardougne', 'Rimmington', 'Varrock'],
    skills: {}, prereqs: ['Plague City'], points: 3, series: 'Elf',
    difficulty: DropSource.QUEST_NOVICE
  },
  'Jungle Potion': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Jungle Potion', name: 'Jungle Potion',
    regions: ['Tai Bwo Wannai'],
    skills: { 'Herblore': 3 }, prereqs: ['Druidic Ritual'], points: 1,
    difficulty: DropSource.QUEST_NOVICE
  },
  'The Grand Tree': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'The Grand Tree', name: 'The Grand Tree',
    regions: ['Tree Gnome Stronghold', 'Feldip Hills', 'Ship Yard'],
    skills: { 'Agility': 25 }, prereqs: [], points: 5, series: 'Gnome',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Shilo Village': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Shilo Village', name: 'Shilo Village',
    regions: ['Shilo Village', 'Tai Bwo Wannai'],
    skills: { 'Crafting': 20, 'Agility': 32 }, prereqs: ['Jungle Potion'], points: 2,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Underground Pass': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Underground Pass', name: 'Underground Pass',
    regions: ['East Ardougne', 'West Ardougne'],
    skills: { 'Ranged': 25 }, prereqs: ['Biohazard'], points: 5, series: 'Elf',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Observatory Quest': {
    kind: 'quest', accessPolicy: 'locations',
    id: 'Observatory Quest', name: 'Observatory Quest',
    regions: ['Kandarin'],
    locations: [
      { id: 'observatory', label: 'Observatory and Observatory Dungeon', standardAreas: ['Observatory'], chunkOptions: [{ cx: 38, cy: 49 }] },
    ],
    skills: {}, prereqs: [], points: 2,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'The Tourist Trap': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'The Tourist Trap', name: 'The Tourist Trap',
    regions: ['Bedabin Camp', 'Shantay Pass'],
    skills: { 'Fletching': 10, 'Smithing': 20 }, prereqs: [], points: 2,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Watchtower': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Watchtower', name: 'Watchtower',
    regions: ['Yanille'],
    skills: { 'Magic': 14, 'Thieving': 15, 'Agility': 25, 'Herblore': 14, 'Mining': 40 }, prereqs: [], points: 4,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Dwarf Cannon': {
    kind: 'quest', accessPolicy: 'locations',
    id: 'Dwarf Cannon', name: 'Dwarf Cannon',
    regions: ["Kandarin","Asgarnia"],
    locations: [
      { id: "coal-truck-mine", label: "Coal Truck Mine", standardAreas: ["Seers' Village"], chunkOptions: [{ cx: 40, cy: 54 }] },
      { id: "baxtorian-falls", label: "Baxtorian Falls", standardAreas: ["Baxtorian Falls"], chunkOptions: [{ cx: 39, cy: 54 }] },
      { id: "asgarnian-road", label: "Asgarnian road by the Dwarven Mine", standardAreas: ["Dwarven Mine"], chunkOptions: [{ cx: 47, cy: 53 }] },
    ],
    skills: {}, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Murder Mystery': {
    kind: 'quest', accessPolicy: 'locations',
    id: 'Murder Mystery', name: 'Murder Mystery',
    regions: ['Kandarin'],
    locations: [{
      id: 'sinclair-mansion', label: 'Sinclair Mansion',
      standardAreas: ["Seers' Village"],
      chunkOptions: [{ cx: 42, cy: 55 }],
    }, {
      id: 'seers-village', label: "Seers' Village",
      standardAreas: ["Seers' Village"],
      chunkOptions: [{ cx: 42, cy: 54 }],
    }],
    skills: {}, prereqs: [], points: 3,
    difficulty: DropSource.QUEST_NOVICE
  },
  'The Dig Site': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'The Dig Site', name: 'The Dig Site',
    regions: ['Varrock', 'Digsite'],
    skills: { 'Agility': 10, 'Herblore': 10, 'Thieving': 25 }, prereqs: [], points: 2, series: 'Mahjarrat',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Gertrude\'s Cat': {
    kind: 'quest', accessPolicy: 'locations',
    id: 'Gertrude\'s Cat', name: 'Gertrude\'s Cat',
    regions: ['Misthalin'],
    locations: [
      { id: 'west-varrock', label: "Gertrude's house in west Varrock", standardAreas: ['Varrock'], chunkOptions: [{ cx: 49, cy: 53 }] },
      { id: 'varrock-square', label: 'Varrock square', standardAreas: ['Varrock'], chunkOptions: [{ cx: 50, cy: 53 }] },
      LOCATIONS.lumberYard,
    ],
    skills: {}, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Legends\' Quest': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Legends\' Quest', name: 'Legends\' Quest',
    regions: ['Legends\' Guild', 'Kharazi Jungle', 'Tai Bwo Wannai'],
    skills: { 'Quest Points': 107, 'Herblore': 45, 'Prayer': 42, 'Strength': 50, 'Agility': 50, 'Thieving': 50, 'Crafting': 50, 'Smithing': 50, 'Mining': 52, 'Woodcutting': 50, 'Magic': 56 }, 
    prereqs: ['Family Crest', 'Heroes\' Quest', 'Shilo Village', 'Underground Pass', 'Waterfall Quest'], points: 4,
    difficulty: DropSource.QUEST_MASTER
  },
  'Big Chompy Bird Hunting': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Big Chompy Bird Hunting', name: 'Big Chompy Bird Hunting',
    regions: ['Feldip Hills'],
    skills: { 'Fletching': 5, 'Cooking': 30, 'Ranged': 30 }, prereqs: [], points: 2,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Elemental Workshop I': {
    kind: 'quest', accessPolicy: 'locations',
    id: 'Elemental Workshop I', name: 'Elemental Workshop I',
    regions: ["Kandarin"],
    locations: [
      { id: "elemental-workshop", label: "Elemental Workshop in Seers' Village", standardAreas: ["Seers' Village"], chunkOptions: [{ cx: 42, cy: 54 }] },
    ],
    skills: { 'Mining': 20, 'Smithing': 20, 'Crafting': 20 }, prereqs: [], points: 1, series: 'Elemental Workshop',
    difficulty: DropSource.QUEST_NOVICE
  },
  'Priest in Peril': {
    kind: 'quest', accessPolicy: 'locations',
    id: 'Priest in Peril', name: 'Priest in Peril',
    regions: ['Misthalin', 'Morytania'],
    locations: [
      { id: 'varrock-palace', label: 'Varrock Palace', standardAreas: ['Varrock'], chunkOptions: [{ cx: 50, cy: 54 }] },
      { id: 'paterdomus', label: 'Paterdomus Temple and mausoleum', standardAreas: ['Paterdomus'], chunkOptions: [{ cx: 53, cy: 54 }] },
    ],
    skills: {}, prereqs: [], points: 1, series: 'Myreque',
    difficulty: DropSource.QUEST_NOVICE
  },
  'Nature Spirit': {
    kind: 'quest', accessPolicy: 'locations',
    id: 'Nature Spirit', name: 'Nature Spirit',
    regions: ['Morytania'],
    locations: [
      { id: 'paterdomus', label: 'Paterdomus and Drezel', standardAreas: ['Paterdomus'], chunkOptions: [{ cx: 53, cy: 54 }] },
      { id: 'nature-grotto', label: 'Nature Grotto in Mort Myre Swamp', standardAreas: ['Mort Myre Swamp'], chunkOptions: [{ cx: 53, cy: 52 }] },
    ],
    skills: {}, prereqs: ['Priest in Peril', 'The Restless Ghost'], points: 2, series: 'Myreque',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Death Plateau': {
    kind: 'quest', accessPolicy: 'locations',
    id: 'Death Plateau', name: 'Death Plateau',
    regions: ["Asgarnia"],
    locations: [
      { id: "burthorpe", label: "Burthorpe", standardAreas: ["Burthorpe"], chunkOptions: [{ cx: 45, cy: 55 }] },
      { id: "warriors-guild", label: "Warriors' Guild", standardAreas: ["Warriors' Guild"], chunkOptions: [{ cx: 44, cy: 55 }] },
      { id: "death-plateau", label: "Death Plateau", standardAreas: ["Burthorpe"], chunkOptions: [{ cx: 44, cy: 56 }] },
    ],
    skills: {}, prereqs: [], points: 1, series: 'Troll',
    difficulty: DropSource.QUEST_NOVICE
  },
  'Troll Stronghold': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Troll Stronghold', name: 'Troll Stronghold',
    regions: ['Burthorpe'],
    skills: { 'Agility': 15 }, prereqs: ['Death Plateau'], points: 1, series: 'Troll',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Tai Bwo Wannai Trio': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Tai Bwo Wannai Trio', name: 'Tai Bwo Wannai Trio',
    regions: ['Tai Bwo Wannai', 'Shilo Village', 'Brimhaven', 'Musa Point'],
    skills: { 'Agility': 15, 'Cooking': 30, 'Fishing': 5 }, prereqs: ['Jungle Potion'], points: 2,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Regicide': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Regicide', name: 'Regicide',
    regions: ['Tyras Camp', 'Iorwerth Camp', 'Isafdar', 'Arandar', 'East Ardougne', 'West Ardougne'],
    skills: { 'Agility': 56, 'Crafting': 10 }, prereqs: ['Underground Pass'], points: 3, series: 'Elf',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Eadgar\'s Ruse': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Eadgar\'s Ruse', name: 'Eadgar\'s Ruse',
    regions: ['Burthorpe', 'Taverley'],
    skills: { 'Herblore': 31 }, prereqs: ['Druidic Ritual', 'Troll Stronghold'], points: 1, series: 'Troll',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Shades of Mort\'ton': {
    kind: 'quest', accessPolicy: 'locations',
    id: 'Shades of Mort\'ton', name: 'Shades of Mort\'ton',
    regions: ['Morytania'],
    locations: [
      { id: 'mortton', label: "Mort'ton and the Flamtaer Temple", standardAreas: ["Mort'ton"], chunkOptions: [{ cx: 54, cy: 51 }] },
    ],
    skills: { 'Crafting': 20, 'Firemaking': 5, 'Herblore': 15 }, prereqs: ['Priest in Peril'], points: 3,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'The Fremennik Trials': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'The Fremennik Trials', name: 'The Fremennik Trials',
    regions: ['Rellekka'],
    skills: {}, prereqs: [], points: 3, series: 'Fremennik',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Horror from the Deep': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Horror from the Deep', name: 'Horror from the Deep',
    regions: ['Lighthouse'],
    skills: { 'Agility': 35 }, prereqs: ["Alfred Grimhand's Barcrawl"], points: 2,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Throne of Miscellania': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Throne of Miscellania', name: 'Throne of Miscellania',
    regions: ['Miscellania & Etceteria'],
    skills: {}, prereqs: ['The Fremennik Trials', 'Heroes\' Quest'], points: 1, series: 'Miscellania',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Monkey Madness I': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Monkey Madness I', name: 'Monkey Madness I',
    regions: ['Tree Gnome Stronghold', 'Ship Yard', 'Ape Atoll'],
    skills: {}, prereqs: ['The Grand Tree', 'Tree Gnome Village'], points: 3, series: 'Gnome',
    difficulty: DropSource.QUEST_MASTER
  },
  'Haunted Mine': {
    kind: 'quest', accessPolicy: 'locations',
    id: 'Haunted Mine', name: 'Haunted Mine',
    regions: ['Morytania'],
    locations: [
      LOCATIONS.abandonedMine,
    ],
    skills: { 'Crafting': 35 }, prereqs: ['Priest in Peril'], points: 2,
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Troll Romance': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Troll Romance', name: 'Troll Romance',
    regions: ['Burthorpe', 'Warriors\' Guild'],
    skills: { 'Agility': 28 }, prereqs: ['Troll Stronghold'], points: 2,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'In Search of the Myreque': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'In Search of the Myreque', name: 'In Search of the Myreque',
    regions: ['Canifis', 'Mort Myre Swamp', 'Barrows'],
    skills: { 'Agility': 25 }, prereqs: ['Nature Spirit'], points: 2, series: 'Myreque',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Creature of Fenkenstrain': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Creature of Fenkenstrain', name: 'Creature of Fenkenstrain',
    regions: ['Canifis', 'Fenkenstrain\'s Castle', 'Haunted Woods'],
    skills: { 'Crafting': 20, 'Thieving': 25 }, prereqs: ["Priest in Peril"],
    manualRequirements: ["Started The Restless Ghost"], points: 2,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Roving Elves': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Roving Elves', name: 'Roving Elves',
    regions: ['Tyras Camp', 'Isafdar', 'Baxtorian Falls'],
    skills: {}, prereqs: ['Regicide', 'Waterfall Quest'], points: 1, series: 'Elf',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Ghosts Ahoy': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Ghosts Ahoy', name: 'Ghosts Ahoy',
    regions: ['Port Phasmatys', 'Fenkenstrain\'s Castle'],
    skills: { 'Agility': 25, 'Cooking': 20 }, prereqs: ['Priest in Peril', 'The Restless Ghost'], points: 2,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'One Small Favour': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'One Small Favour', name: 'One Small Favour',
    regions: ['Feldip Hills', 'Port Khazard', 'East Ardougne', 'Seers\' Village', 'Catherby', 'Kharazi Jungle', 'Shilo Village', 'Taverley', 'Port Sarim', 'Falador', 'Draynor Village', 'Lumbridge', 'Varrock'],
    skills: { 'Agility': 36, 'Crafting': 25, 'Herblore': 18, 'Smithing': 30 }, prereqs: ['Rune Mysteries', 'Shilo Village'], points: 2,
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Mountain Daughter': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Mountain Daughter', name: 'Mountain Daughter',
    regions: ['Mountain Camp'],
    oneOf: [{ regions: ['Taverley'] }, { regions: ['Catherby'] }],
    skills: { 'Agility': 20 }, prereqs: [], points: 2,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Between a Rock...': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Between a Rock...', name: 'Between a Rock...',
    regions: ['Keldagrim', 'Dwarven Mine', 'Taverley'],
    skills: { 'Defence': 30, 'Mining': 40, 'Smithing': 50 }, prereqs: ['Dwarf Cannon', 'Fishing Contest'], points: 2,
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'The Feud': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'The Feud', name: 'The Feud',
    regions: ['Al Kharid', 'Pollnivneach'],
    skills: { 'Thieving': 30 }, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'The Golem': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'The Golem', name: 'The Golem',
    regions: ['Ruins of Uzer', 'Varrock'],
    skills: { 'Crafting': 20, 'Thieving': 25 }, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Desert Treasure I': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Desert Treasure I', name: 'Desert Treasure I',
    regions: ['Bandit Camp', 'Bedabin Camp', 'Pollnivneach', 'Entrana', 'Burthorpe', 'Baxtorian Falls', 'Canifis', 'Mort Myre Swamp'],
    skills: { 'Thieving': 53, 'Firemaking': 50, 'Slayer': 10, 'Magic': 50 }, prereqs: ['The Dig Site', 'Temple of Ikov', 'The Tourist Trap', 'Troll Stronghold', 'Priest in Peril', 'Waterfall Quest'], points: 3, series: 'Mahjarrat',
    difficulty: DropSource.QUEST_MASTER
  },
  'Icthlarin\'s Little Helper': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Icthlarin\'s Little Helper', name: 'Icthlarin\'s Little Helper',
    regions: ['Sophanem'],
    skills: {}, prereqs: ['Gertrude\'s Cat'], points: 2, series: 'Kharidian',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Tears of Guthix': {
    kind: 'quest', accessPolicy: 'locations',
    id: 'Tears of Guthix', name: 'Tears of Guthix',
    regions: ['Misthalin'],
    locations: [{
      id: 'lumbridge-swamp-caves', label: 'Lumbridge Swamp Caves', standardAreas: ['Lumbridge'],
      chunkOptions: [{ cx: 49, cy: 49 }, { cx: 50, cy: 50 }]
    }],
    skills: { 'Firemaking': 49, 'Crafting': 20, 'Mining': 20, 'Quest Points': 43 }, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Zogre Flesh Eaters': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Zogre Flesh Eaters', name: 'Zogre Flesh Eaters',
    regions: ['Feldip Hills', 'Yanille'],
    skills: { 'Smithing': 4, 'Herblore': 8, 'Ranged': 30 }, prereqs: ['Big Chompy Bird Hunting', 'Jungle Potion'], points: 1,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'The Lost Tribe': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'The Lost Tribe', name: 'The Lost Tribe',
    regions: ['Lumbridge', 'Varrock', 'Goblin Village'],
    skills: { 'Agility': 13, 'Mining': 17, 'Thieving': 13 }, prereqs: ['Goblin Diplomacy', 'Rune Mysteries'], points: 1, series: 'Dorgeshuun',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'The Giant Dwarf': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'The Giant Dwarf', name: 'The Giant Dwarf',
    regions: ['Keldagrim', 'Varrock', 'Port Sarim'],
    skills: { 'Crafting': 12, 'Firemaking': 16, 'Magic': 33, 'Thieving': 14 }, prereqs: [], points: 2, series: 'Red Axe',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Recruitment Drive': {
    kind: 'quest', accessPolicy: 'locations',
    id: 'Recruitment Drive', name: 'Recruitment Drive',
    regions: ['Asgarnia'],
    locations: [
      { id: 'west-falador', label: 'White Knights\' Castle and Falador Park', standardAreas: ['Falador'], chunkOptions: [{ cx: 46, cy: 52 }] },
    ],
    skills: {}, prereqs: ['Black Knights\' Fortress', 'Druidic Ritual'], points: 1, series: 'Temple Knight',
    difficulty: DropSource.QUEST_NOVICE
  },
  'Mourning\'s End Part I': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Mourning\'s End Part I', name: 'Mourning\'s End Part I',
    regions: ['Lletya', 'Tyras Camp', 'Isafdar', 'Arandar', 'West Ardougne'],
    skills: { 'Ranged': 60, 'Thieving': 50 }, prereqs: ['Roving Elves', 'Big Chompy Bird Hunting', 'Sheep Herder'], points: 2, series: 'Elf',
    difficulty: DropSource.QUEST_MASTER
  },
  'Forgettable Tale...': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Forgettable Tale...', name: 'Forgettable Tale of a Drunken Dwarf',
    regions: ['Keldagrim', 'Taverley'],
    skills: { 'Cooking': 22, 'Farming': 17 }, prereqs: ['The Giant Dwarf', 'Fishing Contest'], points: 2, series: 'Red Axe',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Garden of Tranquillity': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Garden of Tranquillity', name: 'Garden of Tranquillity',
    regions: ['Varrock', 'Draynor Village', 'Edgeville', 'Falador', 'Burthorpe', 'East Ardougne', 'Catherby', 'Port Phasmatys'],
    skills: { 'Farming': 25 }, prereqs: ['Creature of Fenkenstrain'], points: 2,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'A Tail of Two Cats': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'A Tail of Two Cats', name: 'A Tail of Two Cats',
    regions: ['Burthorpe', 'Varrock', 'Sophanem'],
    skills: {}, prereqs: ['Icthlarin\'s Little Helper'], points: 2, series: 'Dragonkin',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Wanted!': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Wanted!', name: 'Wanted!',
    regions: ['Falador', 'Taverley', 'Varrock', 'Canifis'],
    skills: { 'Quest Points': 32 }, prereqs: ['Recruitment Drive', 'The Lost Tribe', 'Priest in Peril', 'Enter the Abyss'], points: 1, series: 'Temple Knight',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Mourning\'s End Part II': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Mourning\'s End Part II', name: 'Mourning\'s End Part II',
    regions: ['Lletya', 'West Ardougne'],
    skills: { 'Agility': 65 }, prereqs: ['Mourning\'s End Part I'], points: 2, series: 'Elf',
    difficulty: DropSource.QUEST_MASTER
  },
  'Rum Deal': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Rum Deal', name: 'Rum Deal',
    regions: ['Port Phasmatys', 'Braindeath Island'],
    skills: { 'Farming': 40, 'Prayer': 47, 'Slayer': 42, 'Crafting': 42, 'Fishing': 50 }, prereqs: ['Zogre Flesh Eaters', 'Priest in Peril'], points: 2, series: 'Pirate',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Shadow of the Storm': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Shadow of the Storm', name: 'Shadow of the Storm',
    regions: ['Al Kharid', 'Ruins of Uzer'],
    skills: { 'Crafting': 30 }, prereqs: ['Demon Slayer', 'The Golem'], points: 1, series: 'Demon Slayer',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Making History': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Making History', name: 'Making History',
    regions: ['Observatory', 'East Ardougne', 'Rellekka', 'Port Phasmatys'],
    skills: {}, prereqs: ['Priest in Peril', 'The Restless Ghost'], points: 3,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Ratcatchers': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Ratcatchers', name: 'Ratcatchers',
    regions: ['Varrock', 'East Ardougne', 'Pollnivneach', 'Keldagrim', 'Port Sarim'],
    manualRequirements: ['Started The Giant Dwarf to access Keldagrim'],
    skills: {}, prereqs: ['Icthlarin\'s Little Helper'], points: 2,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Spirits of the Elid': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Spirits of the Elid', name: 'Spirits of the Elid',
    regions: ['Nardah'],
    skills: { 'Magic': 33, 'Ranged': 37, 'Mining': 37, 'Thieving': 37 }, prereqs: [], points: 2,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Devious Minds': {
    kind: 'quest', accessPolicy: 'regions-and-locations',
    id: 'Devious Minds', name: 'Devious Minds',
    regions: ['Paterdomus', 'Entrana', 'Falador'],
    locations: [LOCATIONS.edgevilleDitch],
    skills: { 'Smithing': 65, 'Runecraft': 50, 'Fletching': 50 }, prereqs: ['Wanted!', 'Troll Stronghold', 'Doric\'s Quest'], points: 1, series: 'Mahjarrat',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'The Hand in the Sand': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'The Hand in the Sand', name: 'The Hand in the Sand',
    regions: ['Yanille', 'Brimhaven', 'Entrana', 'Port Sarim'],
    skills: { 'Thieving': 17, 'Crafting': 49 }, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Enakhra\'s Lament': {
    kind: 'quest', accessPolicy: 'locations',
    id: 'Enakhra\'s Lament', name: 'Enakhra\'s Lament',
    regions: ["Kharidian Desert"],
    locations: [
      { id: "desert-quarry-and-temple", label: "Desert Quarry and Enakhra's Temple", standardAreas: ["Kharidian Desert"], chunkOptions: [{ cx: 49, cy: 45 }] },
    ],
    skills: { 'Crafting': 50, 'Firemaking': 45, 'Magic': 39, 'Prayer': 43 }, prereqs: [],
    manualRequirements: ["Must be on the standard spellbook"], points: 2, series: 'Mahjarrat',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Cabin Fever': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Cabin Fever', name: 'Cabin Fever',
    regions: ['Port Phasmatys', 'Mos Le\'Harmless'],
    skills: { 'Ranged': 40, 'Smithing': 50, 'Crafting': 45, 'Agility': 42 }, prereqs: ['Pirate\'s Treasure', 'Rum Deal'], points: 2, series: 'Pirate',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Fairytale I - Growing Pains': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Fairytale I - Growing Pains', name: 'Fairytale I - Growing Pains',
    regions: ['Draynor Village', 'Falador', 'Mort Myre Swamp', 'Zanaris'],
    skills: {}, prereqs: ['Lost City', 'Nature Spirit'], points: 2, series: 'Fairy Tale',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'RFD: The Cook': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'RFD: The Cook', name: 'RFD: Start (The Cook)',
    regions: ['Lumbridge'],
    skills: { 'Cooking': 10 }, prereqs: ['Cook\'s Assistant'], points: 1, series: 'Recipe for Disaster',
    difficulty: DropSource.QUEST_NOVICE
  },
  'RFD: Dwarf': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'RFD: Dwarf', name: 'RFD: Dwarf',
    regions: ['Taverley', 'Falador'],
    skills: {}, prereqs: ['Fishing Contest'], points: 1, series: 'Recipe for Disaster',
    difficulty: DropSource.QUEST_NOVICE
  },
  'RFD: Goblins': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'RFD: Goblins', name: 'RFD: Goblins',
    regions: ['Goblin Village'],
    skills: {}, prereqs: ['Goblin Diplomacy'], points: 1, series: 'Recipe for Disaster',
    difficulty: DropSource.QUEST_NOVICE
  },
  'RFD: Pirate Pete': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'RFD: Pirate Pete', name: 'RFD: Pirate Pete',
    regions: ['Port Khazard'],
    skills: { 'Cooking': 31 }, prereqs: [], points: 1, series: 'Recipe for Disaster',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'RFD: Lumbridge Guide': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'RFD: Lumbridge Guide', name: 'RFD: Lumbridge Guide',
    regions: ['Wizards\' Tower'],
    skills: { 'Cooking': 40 }, prereqs: ['Big Chompy Bird Hunting', 'Biohazard', 'Demon Slayer', 'Murder Mystery', 'Nature Spirit', 'Priest in Peril', 'The Restless Ghost', 'Witch\'s House'], points: 1, series: 'Recipe for Disaster',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'RFD: Evil Dave': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'RFD: Evil Dave', name: 'RFD: Evil Dave',
    regions: ['Edgeville'],
    skills: { 'Cooking': 25 }, prereqs: ['Gertrude\'s Cat', 'Shadow of the Storm'], points: 1, series: 'Recipe for Disaster',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'RFD: Skrach Uglogwee': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'RFD: Skrach Uglogwee', name: 'RFD: Skrach Uglogwee',
    regions: ['Feldip Hills', 'Tai Bwo Wannai'],
    skills: { 'Cooking': 41, 'Firemaking': 20 }, prereqs: ['Big Chompy Bird Hunting'], points: 1, series: 'Recipe for Disaster',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'RFD: Sir Amik Varze': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'RFD: Sir Amik Varze', name: 'RFD: Sir Amik Varze',
    regions: ['Kharazi Jungle', 'Draynor Village', 'Zanaris'],
    skills: { 'Quest Points': 107 }, prereqs: ['Legends\' Quest'], points: 1, series: 'Recipe for Disaster',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'RFD: King Awowogei': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'RFD: King Awowogei', name: 'RFD: King Awowogei',
    regions: ['Ape Atoll'],
    skills: { 'Cooking': 70, 'Agility': 48 }, prereqs: ['Monkey Madness I'], points: 1, series: 'Recipe for Disaster',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'RFD: Finale': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'RFD: Finale', name: 'RFD: Finale',
    regions: ['Lumbridge'],
    skills: { 'Quest Points': 175 }, prereqs: ['RFD: The Cook', 'RFD: Dwarf', 'RFD: Goblins', 'RFD: Pirate Pete', 'RFD: Lumbridge Guide', 'RFD: Evil Dave', 'RFD: Skrach Uglogwee', 'RFD: Sir Amik Varze', 'RFD: King Awowogei'], points: 1, series: 'Recipe for Disaster',
    difficulty: DropSource.QUEST_MASTER
  },
  'In Aid of the Myreque': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'In Aid of the Myreque', name: 'In Aid of the Myreque',
    regions: ['Burgh de Rott'],
    skills: { 'Agility': 25, 'Crafting': 25, 'Magic': 7, 'Mining': 15 },
    prereqs: ['In Search of the Myreque'],
    points: 2,
    series: 'Myreque',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'A Soul\'s Bane': {
    kind: 'quest', accessPolicy: 'locations',
    id: 'A Soul\'s Bane', name: 'A Soul\'s Bane',
    regions: ["Misthalin"],
    locations: [
      { id: "soul-bane-rift", label: "Rift east of Varrock", standardAreas: ["Varrock"], chunkOptions: [{ cx: 51, cy: 53 }] },
    ],
    skills: {}, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Rag and Bone Man I': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Rag and Bone Man I', name: 'Rag and Bone Man I',
    regions: ['Draynor Village'],
    skills: {}, prereqs: [], points: 1, series: 'Rag and Bone Man',
    difficulty: DropSource.QUEST_NOVICE
  },
  'Swan Song': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Swan Song', name: 'Swan Song',
    regions: ['Piscatoris Fishing Colony', 'Yanille', 'Draynor Village'],
    skills: { 'Quest Points': 100, 'Magic': 66, 'Cooking': 62, 'Fishing': 62, 'Smithing': 45, 'Firemaking': 42, 'Crafting': 40 },
    prereqs: ['One Small Favour', 'Garden of Tranquillity'], points: 2,
    difficulty: DropSource.QUEST_MASTER
  },
  'Royal Trouble': {
    kind: 'quest', accessPolicy: 'locations',
    id: 'Royal Trouble', name: 'Royal Trouble',
    regions: ['Fremennik'],
    locations: [
      { id: 'miscellania', label: 'Miscellania and its dungeon', standardAreas: ['Miscellania & Etceteria'], chunkOptions: [{ cx: 39, cy: 60 }] },
      { id: 'etceteria', label: 'Etceteria', standardAreas: ['Miscellania & Etceteria'], chunkOptions: [{ cx: 40, cy: 60 }] },
    ],
    skills: { 'Agility': 40, 'Slayer': 40 }, prereqs: ['Throne of Miscellania'], points: 1, series: 'Miscellania',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Death to the Dorgeshuun': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Death to the Dorgeshuun', name: 'Death to the Dorgeshuun',
    regions: ['Lumbridge'],
    skills: { 'Thieving': 23, 'Agility': 23 }, prereqs: ['The Lost Tribe'], points: 1, series: 'Dorgeshuun',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Fairytale II - Cure a Queen': {
    kind: 'quest', accessPolicy: 'locations',
    id: 'Fairytale II - Cure a Queen', name: 'Fairytale II - Cure a Queen',
    regions: ["Islands & Others","Misthalin","Kandarin","Tirannwn"],
    locations: [
      { id: "draynor-village", label: "Draynor Village", standardAreas: ["Draynor Village"], chunkOptions: [{ cx: 48, cy: 50 }] },
      { id: "zanaris", label: "Zanaris", standardAreas: ["Zanaris"], chunkOptions: [{ cx: 50, cy: 49 }] },
      { id: "poison-waste", label: "Poison Waste", standardAreas: ["Poison Waste"], chunkOptions: [{ cx: 34, cy: 48 }] },
      { id: "horseshoe-mine", label: "Horseshoe Mine", standardAreas: ["Brimhaven"], chunkOptions: [{ cx: 42, cy: 50 }] },
    ],
    skills: { 'Thieving': 40, 'Farming': 49, 'Herblore': 57 }, prereqs: ['Fairytale I - Growing Pains'], points: 2, series: 'Fairy Tale',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Lunar Diplomacy': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Lunar Diplomacy', name: 'Lunar Diplomacy',
    regions: ['Lunar Isle', 'Pirates\' Cove', 'Rellekka'],
    skills: { 'Herblore': 5, 'Crafting': 61, 'Defence': 40, 'Firemaking': 49, 'Magic': 65, 'Mining': 60, 'Woodcutting': 55 }, prereqs: ['The Fremennik Trials', 'Lost City', 'Rune Mysteries', 'Shilo Village'], points: 2, series: 'Fremennik',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'The Eyes of Glouphrie': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'The Eyes of Glouphrie', name: 'The Eyes of Glouphrie',
    regions: ['Tree Gnome Stronghold', 'Observatory', 'Feldip Hills'],
    skills: { 'Construction': 5, 'Magic': 46 }, prereqs: ['The Grand Tree'], points: 2, series: 'Gnome',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Darkness of Hallowvale': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Darkness of Hallowvale', name: 'Darkness of Hallowvale',
    regions: ['Burgh de Rott', 'Darkmeyer', 'Meiyerditch', 'Varrock', 'Paterdomus'],
    skills: { 'Construction': 5, 'Mining': 20, 'Thieving': 22, 'Agility': 26, 'Crafting': 32, 'Magic': 33, 'Strength': 40 }, prereqs: ['In Aid of the Myreque'], points: 2, series: 'Myreque',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'The Slug Menace': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'The Slug Menace', name: 'The Slug Menace',
    regions: ['Observatory', 'Witchaven', 'Falador'],
    manualRequirements: ['Access to all required elemental altars through one route: surface altars with Misthalin and Kharidian Desert; the Abyss through Edgeville with Enter the Abyss completed; or Guardians of the Rift with Misthalin and Temple of the Eye completed'],
    skills: { 'Crafting': 30, 'Runecraft': 30, 'Slayer': 30, 'Thieving': 30 }, prereqs: ['Sea Slug', 'Wanted!'], points: 1, series: 'Temple Knight',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Elemental Workshop II': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Elemental Workshop II', name: 'Elemental Workshop II',
    regions: ['Seers\' Village', 'Varrock'],
    skills: { 'Magic': 20, 'Smithing': 30 }, prereqs: ['Elemental Workshop I'], points: 1, series: 'Elemental Workshop',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'My Arm\'s Big Adventure': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'My Arm\'s Big Adventure', name: 'My Arm\'s Big Adventure',
    regions: ['Burthorpe', 'East Ardougne', 'Tai Bwo Wannai'],
    manualRequirements: ['60% Tai Bwo Wannai favour before starting the quest'],
    skills: { 'Woodcutting': 10, 'Farming': 29 }, prereqs: ['Eadgar\'s Ruse', 'The Feud', 'Jungle Potion'], points: 1, series: 'Troll',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Enlightened Journey': {
    kind: 'quest', accessPolicy: 'locations',
    id: 'Enlightened Journey', name: 'Enlightened Journey',
    regions: ["Asgarnia","Kandarin","Misthalin"],
    locations: [
      { id: "west-entrana", label: "West Entrana", standardAreas: ["Entrana"], chunkOptions: [{ cx: 43, cy: 52 }] },
      { id: "south-taverley", label: "South Taverley", standardAreas: ["Taverley"], chunkOptions: [{ cx: 45, cy: 53 }] },
    ],
    skills: {"Firemaking":20,"Farming":30,"Crafting":36,"Quest Points":20}, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Eagles\' Peak': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Eagles\' Peak', name: 'Eagles\' Peak',
    regions: ['Eagles\' Peak', 'Varrock'],
    skills: { 'Hunter': 27 }, prereqs: [], points: 2,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Animal Magnetism': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Animal Magnetism', name: 'Animal Magnetism',
    regions: ['Draynor Village', 'Burthorpe', 'Fenkenstrain\'s Castle'],
    skills: { 'Slayer': 18, 'Crafting': 19, 'Ranged': 30, 'Woodcutting': 35 }, prereqs: ['The Restless Ghost', 'Ernest the Chicken', 'Priest in Peril'], points: 1,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Contact!': {
    kind: 'quest', accessPolicy: 'locations',
    id: 'Contact!', name: 'Contact!',
    regions: ["Kharidian Desert"],
    locations: [
      { id: "sophanem", label: "Sophanem", standardAreas: ["Sophanem"], chunkOptions: [{ cx: 51, cy: 43 }] },
      { id: "al-kharid-palace", label: "Al Kharid Palace", standardAreas: ["Al Kharid"], chunkOptions: [{ cx: 51, cy: 49 }] },
    ],
    skills: {}, prereqs: ['Prince Ali Rescue', 'Icthlarin\'s Little Helper'], points: 1, series: 'Kharidian',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Cold War': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Cold War', name: 'Cold War',
    regions: ['Rellekka', 'East Ardougne', 'Lumbridge'],
    skills: { 'Hunter': 10, 'Agility': 30, 'Crafting': 30, 'Construction': 34, 'Thieving': 15 }, prereqs: [],
    manualRequirements: ["Access to a crafting table 3"], points: 1, series: 'Penguin',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'The Fremennik Isles': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'The Fremennik Isles', name: 'The Fremennik Isles',
    regions: ['Rellekka', 'Neitiznot', 'Jatizso'],
    skills: { 'Construction': 20 }, prereqs: ['The Fremennik Trials'], points: 1, series: 'Fremennik',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Tower of Life': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Tower of Life', name: 'Tower of Life',
    regions: ['East Ardougne'],
    skills: { 'Construction': 10 }, prereqs: [], points: 2,
    difficulty: DropSource.QUEST_NOVICE
  },
  'The Great Brain Robbery': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'The Great Brain Robbery', name: 'The Great Brain Robbery',
    regions: ['Canifis', 'Mos Le\'Harmless', 'Harmony Island', 'Edgeville'],
    manualRequirements: ['Access to a player-owned house workshop and crafting table, or the Grand Exchange'],
    skills: { 'Crafting': 16, 'Construction': 30, 'Prayer': 50 }, prereqs: ['Creature of Fenkenstrain', 'Cabin Fever', 'RFD: Pirate Pete'], points: 2, series: 'Pirate',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'What Lies Below': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'What Lies Below', name: 'What Lies Below',
    regions: ['Edgeville', 'Varrock'],
    skills: { 'Runecraft': 35 }, prereqs: ['Rune Mysteries'], points: 1,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Olaf\'s Quest': {
    kind: 'quest', accessPolicy: 'locations',
    id: 'Olaf\'s Quest', name: 'Olaf\'s Quest',
    regions: ['Fremennik'],
    locations: [
      { id: 'olafs-camp-and-cavern', label: "Olaf's camp and the Brine Rat Cavern", standardAreas: ['Rellekka'], chunkOptions: [{ cx: 42, cy: 58 }] },
      { id: 'rellekka', label: 'Rellekka', standardAreas: ['Rellekka'], chunkOptions: [{ cx: 41, cy: 57 }] },
    ],
    skills: { 'Firemaking': 40, 'Woodcutting': 50 }, prereqs: ['The Fremennik Trials'], points: 1,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Another Slice of H.A.M.': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Another Slice of H.A.M.', name: 'Another Slice of H.A.M.',
    regions: ['Lumbridge', 'Goblin Village'],
    skills: { 'Attack': 15, 'Prayer': 25 }, prereqs: ['Death to the Dorgeshuun', 'The Dig Site', 'The Giant Dwarf'], points: 1, series: 'Dorgeshuun',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Dream Mentor': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Dream Mentor', name: 'Dream Mentor',
    regions: ['Lunar Isle'],
    skills: {}, combatLevel: 85, prereqs: ['Lunar Diplomacy', 'Eadgar\'s Ruse'], points: 2,
    difficulty: DropSource.QUEST_MASTER
  },
  'Grim Tales': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Grim Tales', name: 'Grim Tales',
    regions: ['Taverley', 'Goblin Village'],
    skills: { 'Farming': 45, 'Herblore': 52, 'Thieving': 58, 'Agility': 59, 'Woodcutting': 71 }, prereqs: ['Witch\'s House'], points: 1,
    difficulty: DropSource.QUEST_MASTER
  },
  'King\'s Ransom': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'King\'s Ransom', name: 'King\'s Ransom',
    regions: ['East Ardougne', 'Seers\' Village', 'Camelot', 'Edgeville'],
    skills: { 'Magic': 45, 'Defence': 65 }, prereqs: ['Black Knights\' Fortress', 'Holy Grail', 'Murder Mystery', 'One Small Favour'], points: 1, series: 'Camelot',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Monkey Madness II': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Monkey Madness II', name: 'Monkey Madness II',
    regions: ['Ape Atoll', 'Tree Gnome Stronghold', 'Entrana', 'Burthorpe'],
    manualRequirements: ['Unlocked the Gnome Stronghold balloon route'],
    skills: { 'Slayer': 69, 'Crafting': 70, 'Hunter': 60, 'Agility': 55, 'Thieving': 55, 'Firemaking': 60 }, prereqs: ['Monkey Madness I', 'Enlightened Journey', 'The Eyes of Glouphrie', 'Troll Stronghold', 'Watchtower', 'RFD: King Awowogei'], points: 4, series: 'Gnome',
    difficulty: DropSource.QUEST_GRANDMASTER
  },
  'Client of Kourend': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Client of Kourend', name: 'Client of Kourend',
    regions: ['Shayzien', 'Lovakengj', 'Arceuus', 'Hosidius', 'Piscarilius'],
    skills: {}, prereqs: ["X Marks the Spot"], points: 1, series: 'Great Kourend',
    difficulty: DropSource.QUEST_NOVICE
  },
  'Rag and Bone Man II': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Rag and Bone Man II', name: 'Rag and Bone Man II',
    regions: ['Silvarea', 'Draynor Village', 'Taverley', 'Tree Gnome Stronghold', 'Feldip Hills', 'Nardah', 'Rellekka', 'Canifis', 'Haunted Woods', 'Fenkenstrain\'s Castle', 'Slayer Tower'],
    manualRequirements: [
      'Completed Horror from the Deep or started The Fremennik Trials for dagannoth access',
      'Reached an experiment after starting Creature of Fenkenstrain or completing Grim Tales',
      'Reached a listed fire giant source after partially completing Waterfall Quest or by an alternative route',
    ],
    skills: { 'Slayer': 40 }, prereqs: ['Rag and Bone Man I', 'Skippy and the Mogres'], points: 1, series: 'Rag and Bone Man',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Bone Voyage': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Bone Voyage', name: 'Bone Voyage',
    regions: ['Varrock', 'Fossil Island', 'Port Sarim', 'Woodcutting Guild'],
    skills: {}, prereqs: ['The Dig Site'],
    manualRequirements: ["100 Kudos"], points: 1,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'The Queen of Thieves': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'The Queen of Thieves', name: 'The Queen of Thieves',
    regions: ['Hosidius', 'Piscarilius'],
    skills: { 'Thieving': 20 }, prereqs: ['Client of Kourend'], points: 1, series: 'Great Kourend',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'The Depths of Despair': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'The Depths of Despair', name: 'The Depths of Despair',
    regions: ['Hosidius', 'Arceuus'],
    skills: { 'Agility': 18 }, prereqs: ['Client of Kourend'], points: 1, series: 'Great Kourend',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Dragon Slayer II': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Dragon Slayer II', name: 'Dragon Slayer II',
    regions: ['Draynor Village', 'Varrock', 'Falador', 'Baxtorian Falls', 'Corsair Cove', 'Lunar Isle', 'Rellekka', 'Shayzien', 'Crandor', 'Kharazi Jungle', 'Musa Point', 'Sophanem', 'Port Phasmatys', 'Fossil Island', 'Lithkren'],
    skills: { 'Magic': 75, 'Smithing': 70, 'Mining': 68, 'Crafting': 62, 'Agility': 60, 'Thieving': 60, 'Construction': 50, 'Hitpoints': 50, 'Quest Points': 200 }, prereqs: ['Legends\' Quest', 'Dream Mentor', 'A Tail of Two Cats', 'Animal Magnetism', 'Ghosts Ahoy', 'Bone Voyage', 'Client of Kourend'],
    manualRequirements: ["Started the pyre ship portion of Barbarian Training"], points: 5, series: 'Dragonkin',
    difficulty: DropSource.QUEST_GRANDMASTER
  },
  'Tale of the Righteous': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Tale of the Righteous', name: 'Tale of the Righteous',
    regions: ['Mount Quidamortem', 'Shayzien', 'Arceuus'],
    skills: { 'Strength': 16, 'Mining': 10 }, prereqs: ['Client of Kourend'], points: 1, series: 'Great Kourend',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'A Taste of Hope': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'A Taste of Hope', name: 'A Taste of Hope',
    regions: ['Meiyerditch', 'Ver Sinhaza'],
    skills: { 'Crafting': 48, 'Agility': 45, 'Attack': 40, 'Herblore': 40, 'Slayer': 38 }, prereqs: ['Darkness of Hallowvale'], points: 1, series: 'Myreque',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Making Friends with My Arm': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Making Friends with My Arm', name: 'Making Friends with My Arm',
    regions: ['Burthorpe', 'Rellekka', 'Weiss', 'Draynor Village', 'Varrock'],
    skills: { 'Firemaking': 66, 'Mining': 72, 'Construction': 35, 'Agility': 68 }, prereqs: ['My Arm\'s Big Adventure', 'Swan Song', 'Cold War', 'Romeo & Juliet'], points: 2, series: 'Troll',
    difficulty: DropSource.QUEST_MASTER
  },
  'The Forsaken Tower': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'The Forsaken Tower', name: 'The Forsaken Tower',
    regions: ['Lovakengj'],
    skills: {}, prereqs: ['Client of Kourend'], points: 1, series: 'Great Kourend',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'The Ascent of Arceuus': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'The Ascent of Arceuus', name: 'The Ascent of Arceuus',
    regions: ['Arceuus'],
    skills: { 'Hunter': 12 }, prereqs: ['Client of Kourend'], points: 1, series: 'Great Kourend',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Song of the Elves': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Song of the Elves', name: 'Song of the Elves',
    regions: ['Lletya', 'Zul-Andra', 'Poison Waste', 'Iorwerth Camp', 'Isafdar', 'Prifddinas', 'Arandar', 'East Ardougne', 'West Ardougne', 'Baxtorian Falls'],
    skills: { 'Agility': 70, 'Construction': 70, 'Farming': 70, 'Herblore': 70, 'Hunter': 70, 'Mining': 70, 'Smithing': 70, 'Woodcutting': 70 },
    prereqs: ['Mourning\'s End Part II', 'Making History', 'Druidic Ritual'], points: 4, series: 'Elf',
    difficulty: DropSource.QUEST_GRANDMASTER
  },
  'The Fremennik Exiles': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'The Fremennik Exiles', name: 'The Fremennik Exiles',
    regions: ['Rellekka', 'Lunar Isle'],
    skills: { 'Crafting': 65, 'Slayer': 60, 'Smithing': 60, 'Fishing': 60, 'Runecraft': 55 }, prereqs: ['The Fremennik Isles', 'Lunar Diplomacy', 'Mountain Daughter', 'Heroes\' Quest'], points: 2, series: 'Fremennik',
    difficulty: DropSource.QUEST_MASTER
  },
  'Sins of the Father': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Sins of the Father', name: 'Sins of the Father',
    regions: ['Paterdomus', 'Burgh de Rott', 'Meiyerditch', 'Darkmeyer', 'Slepe'],
    skills: { 'Agility': 52, 'Attack': 50, 'Crafting': 56, 'Fletching': 60, 'Magic': 49, 'Slayer': 50, 'Woodcutting': 62 },
    prereqs: ['A Taste of Hope', 'Vampyre Slayer'], points: 2, series: 'Myreque',
    difficulty: DropSource.QUEST_MASTER
  },
  'A Porcine of Interest': {
    kind: 'quest', accessPolicy: 'locations',
    id: 'A Porcine of Interest', name: 'A Porcine of Interest',
    regions: ["Misthalin","Asgarnia"],
    locations: [
      { id: "draynor-village", label: "Draynor Village", standardAreas: ["Draynor Village"], chunkOptions: [{ cx: 48, cy: 50 }] },
      { id: "south-falador-farm", label: "South Falador Farm", standardAreas: ["Falador"], chunkOptions: [{ cx: 47, cy: 51 }] },
    ],
    skills: {}, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Getting Ahead': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Getting Ahead', name: 'Getting Ahead',
    regions: ['Kebos Lowlands', 'Molch'],
    skills: { 'Construction': 26, 'Crafting': 30 }, prereqs: [], points: 1, series: 'Twisted Tales',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'A Night at the Theatre': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'A Night at the Theatre', name: 'A Night at the Theatre',
    regions: ['Mort Myre Swamp', 'Ver Sinhaza'],
    skills: {}, prereqs: ['A Taste of Hope'], points: 2,
    difficulty: DropSource.QUEST_MASTER
  },
  'The Blood Moon Rises': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'The Blood Moon Rises', name: 'The Blood Moon Rises',
    regions: ['Paterdomus', 'Icyene Graveyard', 'Meiyerditch', 'Darkmeyer', 'Slepe', 'Ver Sinhaza', 'Burgh de Rott', 'Barrows'],
    skills: { 'Slayer': 74, 'Woodcutting': 74, 'Smithing': 72, 'Cooking': 72, 'Fletching': 70, 'Mining': 66, 'Hunter': 65, 'Crafting': 64, 'Herblore': 64, 'Magic': 57 },
    prereqs: ['A Night at the Theatre', 'Sins of the Father'],
    points: 4, series: 'Myreque',
    difficulty: DropSource.QUEST_GRANDMASTER
  },
  'A Kingdom Divided': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'A Kingdom Divided', name: 'A Kingdom Divided',
    regions: ['Shayzien', 'Lovakengj', 'Hosidius', 'Arceuus', 'Piscarilius'],
    skills: { 'Agility': 54, 'Thieving': 52, 'Woodcutting': 52, 'Herblore': 50, 'Mining': 42, 'Crafting': 38, 'Magic': 35 }, prereqs: ['The Depths of Despair', 'The Queen of Thieves', 'Tale of the Righteous', 'The Forsaken Tower', 'The Ascent of Arceuus'], points: 2, series: 'Great Kourend',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Land of the Goblins': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Land of the Goblins', name: 'Land of the Goblins',
    regions: ['Hemenster', 'Lumbridge', 'Crafting Guild', 'Goblin Village'],
    skills: { 'Agility': 38, 'Thieving': 45, 'Fishing': 40, 'Herblore': 48 }, prereqs: ['Another Slice of H.A.M.', 'Fishing Contest'], points: 2, series: 'Dorgeshuun',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Temple of the Eye': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Temple of the Eye', name: 'Temple of the Eye',
    regions: ['Al Kharid', 'Wizards\' Tower', 'Varrock'],
    skills: { 'Runecraft': 10 }, prereqs: ['Enter the Abyss'], points: 1, series: 'Order of Wizards',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Beneath Cursed Sands': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Beneath Cursed Sands', name: 'Beneath Cursed Sands',
    regions: ['Sophanem'],
    skills: { 'Agility': 62, 'Crafting': 55, 'Firemaking': 55 }, prereqs: ['Contact!'], points: 2, series: 'Kharidian',
    difficulty: DropSource.QUEST_MASTER
  },
  'Sleeping Giants': {
    kind: 'quest', accessPolicy: 'locations',
    id: 'Sleeping Giants', name: 'Sleeping Giants',
    regions: ['Kharidian Desert'],
    locations: [
      { id: 'giants-plateau-foundry', label: "Giants' Plateau and Giants' Foundry", standardAreas: ["Giants' Plateau"], chunkOptions: [{ cx: 52, cy: 49 }] },
    ],
    skills: { 'Smithing': 15 }, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'The Garden of Death': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'The Garden of Death', name: 'The Garden of Death',
    regions: ['Molch'],
    skills: { 'Farming': 20 }, prereqs: [], points: 1, series: 'Twisted Tales',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Secrets of the North': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Secrets of the North', name: 'Secrets of the North',
    regions: ['East Ardougne', 'Weiss'],
    skills: { 'Agility': 69, 'Thieving': 64, 'Hunter': 56 },
    prereqs: ['Hazeel Cult', 'The General\'s Shadow', 'Making Friends with My Arm'], points: 2, series: 'Mahjarrat',
    difficulty: DropSource.QUEST_MASTER
  },
  'Desert Treasure II': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Desert Treasure II', name: 'Desert Treasure II - The Fallen Empire',
    regions: ['Nardah', 'Goblin Village', 'Weiss', 'The Stranglewood', 'Digsite'],
    skills: { 'Magic': 75, 'Firemaking': 75, 'Thieving': 70, 'Herblore': 62, 'Runecraft': 60, 'Construction': 60 }, prereqs: ['Desert Treasure I', 'Secrets of the North', 'Enakhra\'s Lament', 'Temple of the Eye', 'The Garden of Death', 'Below Ice Mountain'], points: 5, series: 'Mahjarrat',
    difficulty: DropSource.QUEST_GRANDMASTER
  },
  'The Path of Glouphrie': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'The Path of Glouphrie', name: 'The Path of Glouphrie',
    regions: ['Gnome Village', 'Feldip Hills'],
    skills: { 'Strength': 60, 'Slayer': 56, 'Thieving': 56, 'Ranged': 47, 'Agility': 45 }, prereqs: ['The Eyes of Glouphrie', 'Waterfall Quest', 'Tree Gnome Village'], points: 2, series: 'Gnome',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Children of the Sun': {
    kind: 'quest', accessPolicy: 'locations',
    id: 'Children of the Sun', name: 'Children of the Sun',
    regions: ["Misthalin"],
    locations: [
      { id: "varrock-square", label: "Varrock square", standardAreas: ["Varrock"], chunkOptions: [{ cx: 50, cy: 53 }] },
      { id: "varrock-palace", label: "Varrock Palace", standardAreas: ["Varrock"], chunkOptions: [{ cx: 50, cy: 54 }] },
    ],
    skills: {}, prereqs: [], points: 1, series: 'Twilight Emissaries',
    difficulty: DropSource.QUEST_NOVICE
  },
  'Defender of Varrock': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Defender of Varrock', name: 'Defender of Varrock',
    regions: ['Varrock', 'Goblin Village'],
    skills: { 'Smithing': 55, 'Hunter': 52 }, prereqs: ['Shield of Arrav', 'Romeo & Juliet', 'Demon Slayer', 'Temple of Ikov', 'Below Ice Mountain', 'Family Crest', 'Garden of Tranquillity', 'What Lies Below'], points: 2, series: 'Mahjarrat',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Twilight\'s Promise': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Twilight\'s Promise', name: 'Twilight\'s Promise',
    regions: ['Ralos\' Rise', 'Civitas illa Fortis'],
    skills: {}, prereqs: ['Children of the Sun'], points: 1, series: 'Twilight Emissaries',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'At First Light': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'At First Light', name: 'At First Light',
    regions: ['Hunter\'s Guild'],
    skills: { 'Hunter': 46, 'Herblore': 30, 'Construction': 27 }, prereqs: ["Children of the Sun","Eagles' Peak"], points: 1,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Perilous Moons': {
    kind: 'quest', accessPolicy: 'locations',
    id: 'Perilous Moons', name: 'Perilous Moons',
    regions: ['Varlamore'],
    locations: [
      { id: 'cam-torum-and-neypotzli', label: 'Cam Torum and Neypotzli', standardAreas: ['Cam Torum'], chunkOptions: [{ cx: 22, cy: 48 }] },
    ],
    skills: { 'Slayer': 48, 'Hunter': 20, 'Fishing': 20, 'Runecraft': 20, 'Construction': 10 },
    prereqs: ['Twilight\'s Promise'], points: 2,
    difficulty: DropSource.QUEST_MASTER
  },
  'The Ribbiting Tale': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'The Ribbiting Tale', name: 'The Ribbiting Tale of a Lily Pad Labour Dispute',
    regions: ['Avium Savannah'],
    skills: { 'Woodcutting': 15 }, prereqs: ['Children of the Sun'], points: 1,
    difficulty: DropSource.QUEST_NOVICE
  },
  'While Guthix Sleeps': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'While Guthix Sleeps', name: 'While Guthix Sleeps',
    regions: ['Edgeville', 'Draynor Village', 'Warriors\' Guild', 'Taverley', 'Falador', 'Port Sarim'],
    skills: { 'Quest Points': 180, 'Thieving': 72, 'Magic': 67, 'Agility': 66, 'Farming': 65, 'Herblore': 65, 'Hunter': 62 },
    manualRequirements: ["Warriors' Guild access with Attack + Strength at least 130, or 99 Attack, or 99 Strength"],
    prereqs: [
      'Defender of Varrock', 'The Path of Glouphrie', 'Fight Arena', 'Dream Mentor',
      'The Hand in the Sand', 'Wanted!', 'Temple of the Eye', 'Tears of Guthix',
      'Nature Spirit', 'A Tail of Two Cats'
    ],
    points: 5, series: 'Mahjarrat',
    difficulty: DropSource.QUEST_GRANDMASTER
  },
  'The Heart of Darkness': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'The Heart of Darkness', name: 'The Heart of Darkness',
    regions: ['Ralos\' Rise', 'Civitas illa Fortis'],
    skills: { 'Mining': 55, 'Thieving': 48, 'Slayer': 48, 'Agility': 46 }, prereqs: ['Twilight\'s Promise'], points: 2, series: 'Twilight Emissaries',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Death on the Isle': {
    kind: 'quest', accessPolicy: 'locations',
    id: 'Death on the Isle', name: 'Death on the Isle',
    regions: ["Varlamore"],
    locations: [
      { id: "villa-lucens", label: "Villa Lucens", standardAreas: ["Aldarin"], chunkOptions: [{ cx: 22, cy: 45 }] },
      { id: "aldarin-mansion", label: "Northern Aldarin mansion", standardAreas: ["Aldarin"], chunkOptions: [{ cx: 21, cy: 46 }] },
      { id: "villa-lucens-theatre", label: "Villa Lucens Theatre", standardAreas: ["Aldarin"], chunkOptions: [{ cx: 23, cy: 45 }] },
    ],
    skills: { 'Thieving': 34, 'Agility': 32 }, prereqs: ['Children of the Sun'], points: 2,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Meat and Greet': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Meat and Greet', name: 'Meat and Greet',
    regions: ['Civitas illa Fortis'],
    skills: {}, prereqs: ['Children of the Sun'], points: 1,
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Ethically Acquired Antiquities': {
    kind: 'quest', accessPolicy: 'locations',
    id: 'Ethically Acquired Antiquities', name: 'Ethically Acquired Antiquities',
    regions: ["Varlamore","Asgarnia","Misthalin"],
    locations: [
      { id: "grand-museum", label: "Grand Museum in Civitas illa Fortis", standardAreas: ["Civitas illa Fortis"], chunkOptions: [{ cx: 26, cy: 49 }] },
      { id: "fortis-cothon", label: "Fortis Cothon", standardAreas: ["Civitas illa Fortis"], chunkOptions: [{ cx: 27, cy: 48 }] },
      { id: "port-sarim-jail", label: "Port Sarim jail", standardAreas: ["Port Sarim"], chunkOptions: [{ cx: 47, cy: 49 }] },
      { id: "port-sarim-betty", label: "Betty's shop in Port Sarim", standardAreas: ["Port Sarim"], chunkOptions: [{ cx: 47, cy: 50 }] },
      { id: "varrock-museum", label: "Varrock Museum", standardAreas: ["Varrock"], chunkOptions: [{ cx: 50, cy: 53 }] },
    ],
    skills: { 'Thieving': 25 }, prereqs: ['Children of the Sun', 'Shield of Arrav'], points: 1,
    difficulty: DropSource.QUEST_NOVICE
  },
  'The Curse of Arrav': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'The Curse of Arrav', name: 'The Curse of Arrav',
    regions: ['Varrock', 'Ruins of Uzer', 'Mountain Camp'],
    skills: { 'Agility': 61, 'Ranged': 62, 'Strength': 58, 'Thieving': 62, 'Mining': 64, 'Slayer': 37 }, prereqs: ['Defender of Varrock', 'Troll Romance'], points: 2, series: 'Mahjarrat',
    difficulty: DropSource.QUEST_MASTER
  },
  'The Final Dawn': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'The Final Dawn', name: 'The Final Dawn',
    regions: ['Tlati Rainforest', 'Civitas illa Fortis', 'Ralos\' Rise'],
    skills: { 'Thieving': 66, 'Fletching': 52, 'Runecraft': 52 }, prereqs: ['The Heart of Darkness', 'Perilous Moons'], points: 3, series: 'Twilight Emissaries',
    difficulty: DropSource.QUEST_MASTER
  },
  'Shadows of Custodia': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Shadows of Custodia', name: 'Shadows of Custodia',
    regions: ['Auburnvale'],
    skills: { 'Slayer': 54, 'Fishing': 45, 'Construction': 41, 'Hunter': 36 }, prereqs: ['Children of the Sun'], points: 2,
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Scrambled!': {
    kind: 'quest', accessPolicy: 'locations',
    id: 'Scrambled!', name: 'Scrambled!',
    regions: ['Varlamore'],
    locations: [
      { id: 'tal-teklan-dock', label: 'Tal Teklan dock', standardAreas: ['Tlati Rainforest'], chunkOptions: [{ cx: 18, cy: 48 }] },
      { id: 'tal-teok', label: 'Tal Teok and Tal Teklan', standardAreas: ['Tlati Rainforest'], chunkOptions: [{ cx: 19, cy: 49 }] },
      { id: 'tlati-rainforest', label: 'Central Tlati Rainforest', standardAreas: ['Tlati Rainforest'], chunkOptions: [{ cx: 20, cy: 48 }] },
    ],
    skills: { 'Construction': 38, 'Cooking': 36, 'Smithing': 35 }, prereqs: ['Children of the Sun'], points: 1,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Pandemonium': {
    kind: 'quest', accessPolicy: 'locations',
    id: 'Pandemonium', name: 'Pandemonium',
    regions: [],
    locations: [LOCATIONS.portSarim],
    skills: {}, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Prying Times': {
    kind: 'quest', accessPolicy: 'locations',
    id: 'Prying Times', name: 'Prying Times',
    regions: ['The Open Seas'],
    locations: [
      { id: 'the-pandemonium', label: 'The Pandemonium', standardAreas: ['The Pandemonium'], chunkOptions: [{ cx: 47, cy: 46 }] },
      { id: 'port-sarim-docks', label: 'Port Sarim docks', standardAreas: ['Port Sarim'], chunkOptions: [{ cx: 47, cy: 49 }] },
      { id: 'thurgos-hut', label: "Thurgo's hut south of Port Sarim", standardAreas: ['Port Sarim'], chunkOptions: [{ cx: 46, cy: 49 }] },
    ],
    skills: { 'Smithing': 30, 'Sailing': 12 }, prereqs: ['Pandemonium', 'The Knight\'s Sword'],
    manualRequirements: ['One open Sailing task slot'], points: 1,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Current Affairs': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Current Affairs', name: 'Current Affairs',
    regions: ['Catherby'],
    skills: { 'Sailing': 22, 'Fishing': 10 }, prereqs: ['Pandemonium'], points: 1,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Troubled Tortugans': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Troubled Tortugans', name: 'Troubled Tortugans',
    regions: ['Remote Island', 'The Summer Shore', 'The Great Conch', 'The Little Pearl'],
    skills: { 'Slayer': 51, 'Construction': 48, 'Sailing': 45, 'Hunter': 45, 'Woodcutting': 40, 'Crafting': 34 }, prereqs: ['Pandemonium'], points: 1, series: 'Tortugan',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'The Red Reef': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'The Red Reef', name: 'The Red Reef',
    regions: ['Last Light'],
    skills: { Sailing: 52, Smithing: 48 }, prereqs: ['Troubled Tortugans'], points: 2, series: 'Tortugan',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'The Ides of Milk': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'The Ides of Milk', name: 'The Ides of Milk',
    regions: ['Lumbridge'],
    skills: {}, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Fallen From Grace': {
    kind: 'quest', accessPolicy: 'locations',
    id: 'Fallen From Grace', name: 'Fallen From Grace',
    regions: ['The Open Seas'],
    locations: [
      { id: 'auchrie', label: 'Auchrie', standardAreas: ['Wyrmscraig'], chunkOptions: [{ cx: 40, cy: 35 }] },
      { id: 'wyrmscraig-goat-pasture', label: 'Wyrmscraig Goat Pasture', standardAreas: ['Wyrmscraig'], chunkOptions: [{ cx: 40, cy: 34 }] },
      { id: 'ardeaglais', label: 'Ardeaglais', standardAreas: ['Wyrmscraig'], chunkOptions: [{ cx: 39, cy: 34 }] },
    ],
    skills: { Sailing: 62, Crafting: 60, Runecraft: 47, Mining: 53 }, prereqs: ['Pandemonium'], points: 2,
    difficulty: DropSource.QUEST_EXPERIENCED
  },

  // --- Miniquests ---
  'Alfred Grimhand\'s Barcrawl': {
    kind: 'miniquest', accessPolicy: 'locations',
    id: 'Alfred Grimhand\'s Barcrawl', name: 'Alfred Grimhand\'s Barcrawl',
    regions: ['Kandarin', 'Misthalin', 'Karamja', 'Asgarnia'],
    locations: [
      LOCATIONS.barbarianOutpost, LOCATIONS.blueMoonInn, LOCATIONS.grandTreeBar,
      LOCATIONS.brimhavenBar, LOCATIONS.yanilleBar, LOCATIONS.eastArdougneBar,
      LOCATIONS.seersVillageBar, LOCATIONS.jollyBoarInn, LOCATIONS.musaPointBar,
      LOCATIONS.faladorBar, LOCATIONS.portSarimBar,
    ],
    skills: {}, prereqs: [], points: 0,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Barbarian Training': {
    kind: 'miniquest', accessPolicy: 'regions',
    id: 'Barbarian Training', name: 'Barbarian Training',
    regions: ['Baxtorian Falls'],
    skills: { 'Fishing': 55, 'Firemaking': 35, 'Strength': 35, 'Agility': 15, 'Farming': 15, 'Crafting': 11, 'Smithing': 5, 'Herblore': 4 },
    prereqs: ['Tai Bwo Wannai Trio'], points: 0,
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Bear Your Soul': {
    kind: 'miniquest', accessPolicy: 'regions',
    id: 'Bear Your Soul', name: 'Bear Your Soul',
    regions: ['Arceuus', 'Taverley'],
    skills: {}, prereqs: [], points: 0, series: 'Great Kourend',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Curse of the Empty Lord': {
    kind: 'miniquest', accessPolicy: 'regions',
    id: 'Curse of the Empty Lord', name: 'Curse of the Empty Lord',
    regions: ['Baxtorian Falls'],
    oneOf: [
      { regions: ['Wilderness Agility Course', 'Chaos Temple', "Rogues' Castle", 'Entrana', "Wizards' Tower"] },
      { regions: ['Wilderness Bandit Camp', 'Graveyard of Shadows', 'Port Sarim', 'Edgeville', 'Slayer Tower'] },
      { regions: ['Bandit Camp', 'Lava Maze', 'Tree Gnome Stronghold', 'Falador', 'Edgeville'] },
    ],
    skills: { 'Thieving': 53 }, prereqs: [],
    manualRequirements: ['Started Desert Treasure I', 'Started The Restless Ghost'],
    points: 0, series: 'Mahjarrat',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Daddy\'s Home': {
    kind: 'miniquest', accessPolicy: 'locations',
    id: 'Daddy\'s Home', name: 'Daddy\'s Home',
    regions: ['Misthalin'],
    locations: [LOCATIONS.varrockPalace, LOCATIONS.varrockCenter, LOCATIONS.lumberYard],
    skills: {}, prereqs: [], points: 0,
    difficulty: DropSource.QUEST_NOVICE
  },
  'The Enchanted Key': {
    kind: 'miniquest', accessPolicy: 'regions',
    id: 'The Enchanted Key', name: 'The Enchanted Key',
    regions: ['Rellekka', 'Observatory', 'Tree Gnome Stronghold', 'East Ardougne', 'Arandar', 'Port Sarim', 'Falador', 'Lumbridge', 'Varrock', 'Al Kharid'],
    skills: {}, prereqs: ['Making History'], points: 0,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Enter the Abyss': {
    kind: 'miniquest', accessPolicy: 'locations',
    id: 'Enter the Abyss', name: 'Enter the Abyss',
    regions: ['Misthalin', 'Wilderness'],
    locations: [LOCATIONS.edgevilleDitch, LOCATIONS.varrockSouthGate],
    oneOf: [
      { regions: ['East Ardougne'] },
      { regions: ['Tree Gnome Stronghold'] },
      { guilds: ["Wizards' Guild"] },
    ],
    skills: {}, prereqs: ['Rune Mysteries'], points: 0, series: 'Order of Wizards',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Family Pest': {
    kind: 'miniquest', accessPolicy: 'locations',
    id: 'Family Pest', name: 'Family Pest',
    regions: ['Misthalin', 'Kharidian Desert', 'Kandarin'],
    locations: [
      LOCATIONS.eastVarrockGate, LOCATIONS.alKharidMine,
      LOCATIONS.eastCatherby, LOCATIONS.jollyBoarInn,
    ],
    skills: {}, prereqs: ['Family Crest'], points: 0,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'The Frozen Door': {
    kind: 'miniquest', accessPolicy: 'regions',
    id: 'The Frozen Door', name: 'The Frozen Door',
    regions: ['Burthorpe'],
    skills: { 'Agility': 70, 'Strength': 70, 'Ranged': 70, 'Hitpoints': 70 },
    prereqs: ['Desert Treasure I'], points: 0,
    difficulty: DropSource.QUEST_MASTER
  },
  'The General\'s Shadow': {
    kind: 'miniquest', accessPolicy: 'regions',
    id: 'The General\'s Shadow', name: 'The General\'s Shadow',
    regions: ['Rellekka', 'Observatory', 'Seers\' Village', 'Tree Gnome Stronghold', 'Tai Bwo Wannai', 'Falador', 'Shantay Pass'],
    skills: {}, prereqs: ['Fight Arena', 'Curse of the Empty Lord'], points: 0, series: 'Mahjarrat',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'His Faithful Servants': {
    kind: 'miniquest', accessPolicy: 'locations',
    id: 'His Faithful Servants', name: 'His Faithful Servants',
    regions: ['Morytania'], locations: [LOCATIONS.barrows],
    skills: {}, prereqs: ['Priest in Peril'], points: 0, series: 'Mahjarrat',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Hopespear\'s Will': {
    kind: 'miniquest', accessPolicy: 'regions',
    id: 'Hopespear\'s Will', name: 'Hopespear\'s Will',
    regions: ['Hemenster'],
    skills: { 'Prayer': 50 },
    prereqs: ['Desert Treasure I', 'Fairytale II - Cure a Queen', 'Land of the Goblins'],
    manualRequirements: ['Started The Restless Ghost'], points: 0,
    difficulty: DropSource.QUEST_MASTER
  },
  'In Search of Knowledge': {
    kind: 'miniquest', accessPolicy: 'regions',
    id: 'In Search of Knowledge', name: 'In Search of Knowledge',
    regions: ['Hosidius', 'Arceuus'],
    skills: {}, prereqs: [], points: 0,
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Into the Tombs': {
    kind: 'miniquest', accessPolicy: 'locations',
    id: 'Into the Tombs', name: 'Into the Tombs',
    regions: ['Kharidian Desert'], locations: [LOCATIONS.necropolisMainTemple],
    skills: {}, prereqs: ['Beneath Cursed Sands'], points: 0, series: 'Kharidian',
    difficulty: DropSource.QUEST_MASTER
  },
  'Lair of Tarn Razorlor': {
    kind: 'miniquest', accessPolicy: 'regions',
    id: 'Lair of Tarn Razorlor', name: 'Lair of Tarn Razorlor',
    regions: ['Haunted Mine'],
    skills: { 'Slayer': 40 }, prereqs: ['Haunted Mine'], points: 0,
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Mage Arena I': {
    kind: 'miniquest', accessPolicy: 'regions',
    id: 'Mage Arena I', name: 'Mage Arena I',
    regions: ['Mage Arena'],
    skills: { 'Magic': 60 }, prereqs: [], points: 0,
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Mage Arena II': {
    kind: 'miniquest', accessPolicy: 'regions',
    id: 'Mage Arena II', name: 'Mage Arena II',
    regions: ['Mage Arena'],
    skills: { 'Magic': 75 }, prereqs: ['Mage Arena I'],
    manualRequirements: [
      'Cast Claws of Guthix, Flames of Zamorak, and Saradomin Strike 100 times each inside the Mage Arena',
      'Access to all three assigned demonic follower locations in the Wilderness',
    ],
    points: 0,
    difficulty: DropSource.QUEST_MASTER
  },
  'Skippy and the Mogres': {
    kind: 'miniquest', accessPolicy: 'locations',
    id: 'Skippy and the Mogres', name: 'Skippy and the Mogres',
    regions: ['Asgarnia'], locations: [LOCATIONS.skippysCamp],
    skills: { 'Cooking': 20 }, prereqs: [], points: 0,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Vale Totems': {
    kind: 'miniquest', accessPolicy: 'regions',
    id: 'Vale Totems', name: 'Vale Totems',
    regions: ['Auburnvale'],
    skills: { 'Fletching': 20 }, prereqs: ['Children of the Sun'], points: 0,
    difficulty: DropSource.QUEST_NOVICE
  }
};
/** Canonical quest-point-cape membership: quests award points; optional miniquests do not. */
export const QUEST_CAPE_QUEST_IDS: readonly string[] = Object.freeze(
  Object.values(QUEST_DATA)
    .filter(quest => quest.kind === 'quest')
    .map(quest => quest.id),
);

export const hasCompletedQuestCapeRequirements = (
  completedQuestIds: readonly string[],
): boolean => {
  const completed = new Set(completedQuestIds);
  return QUEST_CAPE_QUEST_IDS.every(id => completed.has(id));
};
