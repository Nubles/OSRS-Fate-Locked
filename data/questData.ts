
import { DropSource } from '../types';

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
  prereqs: string[];
  points: number;
  series?: string;
  difficulty: DropSource;
  oneOf?: QuestRequirementOption[];
}

const LOCATIONS = {
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
  skippysCamp: { id: 'skippys-camp', label: "Skippy's camp south-east of Rimmington", standardAreas: ['Rimmington'], chunkOptions: [{ cx: 46, cy: 49 }] },
} satisfies Record<string, QuestLocationRequirement>;

export const QUEST_DATA: Record<string, QuestData> = {
  // --- F2P Quests ---
  'Cook\'s Assistant': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Cook\'s Assistant', name: 'Cook\'s Assistant',
    regions: ['Misthalin'],
    skills: {}, prereqs: [], points: 1, series: 'Recipe for Disaster',
    difficulty: DropSource.QUEST_NOVICE
  },
  'Demon Slayer': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Demon Slayer', name: 'Demon Slayer',
    regions: ['Misthalin'],
    skills: {}, prereqs: [], points: 3, series: 'Demon Slayer',
    difficulty: DropSource.QUEST_NOVICE
  },
  'The Restless Ghost': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'The Restless Ghost', name: 'The Restless Ghost',
    regions: ['Misthalin'],
    skills: {}, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Romeo & Juliet': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Romeo & Juliet', name: 'Romeo & Juliet',
    regions: ['Misthalin'],
    skills: {}, prereqs: [], points: 5,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Sheep Shearer': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Sheep Shearer', name: 'Sheep Shearer',
    regions: ['Misthalin'],
    skills: {}, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Shield of Arrav': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Shield of Arrav', name: 'Shield of Arrav',
    regions: ['Misthalin'],
    skills: {}, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Ernest the Chicken': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Ernest the Chicken', name: 'Ernest the Chicken',
    regions: ['Misthalin'],
    skills: {}, prereqs: [], points: 4,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Vampyre Slayer': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Vampyre Slayer', name: 'Vampyre Slayer',
    regions: ['Misthalin'],
    skills: {}, prereqs: [], points: 3,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Imp Catcher': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Imp Catcher', name: 'Imp Catcher',
    regions: ['Misthalin'],
    skills: {}, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Prince Ali Rescue': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Prince Ali Rescue', name: 'Prince Ali Rescue',
    regions: ['Kharidian Desert', 'Misthalin'],
    skills: {}, prereqs: [], points: 3, series: 'Kharidian',
    difficulty: DropSource.QUEST_NOVICE
  },
  'Doric\'s Quest': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Doric\'s Quest', name: 'Doric\'s Quest',
    regions: ['Asgarnia'], 
    skills: { 'Mining': 15 }, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Black Knights\' Fortress': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Black Knights\' Fortress', name: 'Black Knights\' Fortress',
    regions: ['Asgarnia'],
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
    regions: ['Asgarnia', 'Misthalin'], 
    skills: { 'Mining': 10 }, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Goblin Diplomacy': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Goblin Diplomacy', name: 'Goblin Diplomacy',
    regions: ['Asgarnia'],
    skills: {}, prereqs: [], points: 5,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Pirate\'s Treasure': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Pirate\'s Treasure', name: 'Pirate\'s Treasure',
    regions: ['Asgarnia', 'Misthalin'],
    skills: {}, prereqs: [], points: 2,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Dragon Slayer I': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Dragon Slayer I', name: 'Dragon Slayer I',
    regions: ['Misthalin', 'Asgarnia', 'Karamja'],
    skills: { 'Quest Points': 32, 'Crafting': 8 }, prereqs: [], points: 2, series: 'Dragonkin',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Rune Mysteries': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Rune Mysteries', name: 'Rune Mysteries',
    regions: ['Misthalin'],
    skills: {}, prereqs: [], points: 1, series: 'Order of Wizards',
    difficulty: DropSource.QUEST_NOVICE
  },
  'Misthalin Mystery': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Misthalin Mystery', name: 'Misthalin Mystery',
    regions: ['Misthalin'],
    skills: {}, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Below Ice Mountain': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Below Ice Mountain', name: 'Below Ice Mountain',
    regions: ['Asgarnia'],
    skills: { 'Quest Points': 16 }, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_NOVICE
  },
  'The Corsair Curse': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'The Corsair Curse', name: 'The Corsair Curse',
    regions: ['Asgarnia', 'Kandarin'],
    skills: {}, prereqs: [], points: 2,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'X Marks the Spot': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'X Marks the Spot', name: 'X Marks the Spot',
    regions: ['Misthalin', 'Asgarnia'],
    skills: {}, prereqs: [], points: 1, series: 'Great Kourend',
    difficulty: DropSource.QUEST_NOVICE
  },

  // --- P2P Quests ---
  'Druidic Ritual': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Druidic Ritual', name: 'Druidic Ritual',
    regions: ['Asgarnia'],
    skills: {}, prereqs: [], points: 4,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Lost City': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Lost City', name: 'Lost City',
    regions: ['Misthalin', 'Islands & Others'],
    skills: { 'Crafting': 31, 'Woodcutting': 36 }, prereqs: [], points: 3,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Witch\'s House': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Witch\'s House', name: 'Witch\'s House',
    regions: ['Asgarnia'],
    skills: {}, prereqs: [], points: 4,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Merlin\'s Crystal': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Merlin\'s Crystal', name: 'Merlin\'s Crystal',
    regions: ['Kandarin'],
    skills: {}, prereqs: [], points: 6, series: 'Camelot',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Heroes\' Quest': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Heroes\' Quest', name: 'Heroes\' Quest',
    regions: ['Asgarnia', 'Misthalin', 'Kandarin', 'Karamja'],
    skills: { 'Quest Points': 55, 'Cooking': 53, 'Fishing': 53, 'Herblore': 25, 'Mining': 50 }, prereqs: ['Shield of Arrav', 'Lost City', 'Merlin\'s Crystal', 'Dragon Slayer I', 'Druidic Ritual'], points: 1,
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Scorpion Catcher': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Scorpion Catcher', name: 'Scorpion Catcher',
    regions: ['Kandarin'],
    skills: { 'Prayer': 31 }, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Family Crest': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Family Crest', name: 'Family Crest',
    regions: ['Asgarnia', 'Kandarin', 'Misthalin', 'Kharidian Desert'],
    skills: { 'Mining': 40, 'Smithing': 40, 'Magic': 59, 'Crafting': 40 }, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Tribal Totem': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Tribal Totem', name: 'Tribal Totem',
    regions: ['Karamja'],
    skills: { 'Thieving': 21 }, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Fishing Contest': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Fishing Contest', name: 'Fishing Contest',
    regions: ['Kandarin', 'Asgarnia'],
    skills: { 'Fishing': 10 }, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Monk\'s Friend': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Monk\'s Friend', name: 'Monk\'s Friend',
    regions: ['Kandarin'],
    skills: {}, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Temple of Ikov': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Temple of Ikov', name: 'Temple of Ikov',
    regions: ['Kandarin'],
    skills: { 'Thieving': 42, 'Ranged': 40 }, prereqs: [], points: 1, series: 'Mahjarrat',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Clock Tower': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Clock Tower', name: 'Clock Tower',
    regions: ['Kandarin'],
    skills: {}, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Holy Grail': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Holy Grail', name: 'Holy Grail',
    regions: ['Kandarin', 'Islands & Others'],
    skills: { 'Attack': 20 }, prereqs: ['Merlin\'s Crystal'], points: 2, series: 'Camelot',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Tree Gnome Village': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Tree Gnome Village', name: 'Tree Gnome Village',
    regions: ['Kandarin'],
    skills: {}, prereqs: [], points: 2, series: 'Gnome',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Fight Arena': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Fight Arena', name: 'Fight Arena',
    regions: ['Kandarin'],
    skills: {}, prereqs: [], points: 2, series: 'Mahjarrat',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Hazeel Cult': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Hazeel Cult', name: 'Hazeel Cult',
    regions: ['Kandarin'],
    skills: {}, prereqs: [], points: 1, series: 'Mahjarrat',
    difficulty: DropSource.QUEST_NOVICE
  },
  'Sheep Herder': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Sheep Herder', name: 'Sheep Herder',
    regions: ['Kandarin'],
    skills: {}, prereqs: [], points: 4,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Plague City': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Plague City', name: 'Plague City',
    regions: ['Kandarin'],
    skills: {}, prereqs: [], points: 1, series: 'Elf',
    difficulty: DropSource.QUEST_NOVICE
  },
  'Sea Slug': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Sea Slug', name: 'Sea Slug',
    regions: ['Kandarin'],
    skills: { 'Firemaking': 30 }, prereqs: [], points: 1, series: 'Temple Knight',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Waterfall Quest': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Waterfall Quest', name: 'Waterfall Quest',
    regions: ['Kandarin'],
    skills: {}, prereqs: [], points: 1, series: 'Elf',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Biohazard': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Biohazard', name: 'Biohazard',
    regions: ['Kandarin', 'Asgarnia'],
    skills: {}, prereqs: ['Plague City'], points: 3, series: 'Elf',
    difficulty: DropSource.QUEST_NOVICE
  },
  'Jungle Potion': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Jungle Potion', name: 'Jungle Potion',
    regions: ['Karamja'],
    skills: { 'Herblore': 3 }, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_NOVICE
  },
  'The Grand Tree': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'The Grand Tree', name: 'The Grand Tree',
    regions: ['Kandarin'],
    skills: { 'Agility': 25 }, prereqs: [], points: 5, series: 'Gnome',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Shilo Village': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Shilo Village', name: 'Shilo Village',
    regions: ['Karamja'],
    skills: { 'Crafting': 20, 'Agility': 32 }, prereqs: ['Jungle Potion'], points: 2,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Underground Pass': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Underground Pass', name: 'Underground Pass',
    regions: ['Kandarin', 'Tirannwn'],
    skills: { 'Ranged': 25 }, prereqs: ['Biohazard'], points: 5, series: 'Elf',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Observatory Quest': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Observatory Quest', name: 'Observatory Quest',
    regions: ['Kandarin'],
    skills: {}, prereqs: [], points: 2,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'The Tourist Trap': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'The Tourist Trap', name: 'The Tourist Trap',
    regions: ['Kharidian Desert'],
    skills: { 'Fletching': 10, 'Smithing': 20 }, prereqs: [], points: 2,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Watchtower': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Watchtower', name: 'Watchtower',
    regions: ['Kandarin'],
    skills: { 'Magic': 14, 'Thieving': 15, 'Agility': 25, 'Herblore': 14, 'Mining': 40 }, prereqs: [], points: 4,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Dwarf Cannon': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Dwarf Cannon', name: 'Dwarf Cannon',
    regions: ['Kandarin', 'Asgarnia'],
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
    regions: ['Misthalin'],
    skills: { 'Agility': 10, 'Herblore': 10, 'Thieving': 25 }, prereqs: [], points: 2, series: 'Mahjarrat',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Gertrude\'s Cat': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Gertrude\'s Cat', name: 'Gertrude\'s Cat',
    regions: ['Misthalin'],
    skills: {}, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Legends\' Quest': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Legends\' Quest', name: 'Legends\' Quest',
    regions: ['Kandarin'],
    skills: { 'Quest Points': 107, 'Herblore': 45, 'Prayer': 42, 'Strength': 50, 'Agility': 50, 'Thieving': 50, 'Crafting': 50, 'Smithing': 50, 'Mining': 52, 'Woodcutting': 50, 'Magic': 56 }, 
    prereqs: ['Family Crest', 'Heroes\' Quest', 'Shilo Village', 'Underground Pass', 'Waterfall Quest'], points: 4,
    difficulty: DropSource.QUEST_MASTER
  },
  'Big Chompy Bird Hunting': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Big Chompy Bird Hunting', name: 'Big Chompy Bird Hunting',
    regions: ['Kandarin'],
    skills: { 'Fletching': 5, 'Cooking': 30, 'Ranged': 30 }, prereqs: [], points: 2,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Elemental Workshop I': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Elemental Workshop I', name: 'Elemental Workshop I',
    regions: ['Kandarin'],
    skills: { 'Mining': 20, 'Smithing': 20, 'Crafting': 20 }, prereqs: [], points: 1, series: 'Elemental Workshop',
    difficulty: DropSource.QUEST_NOVICE
  },
  'Priest in Peril': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Priest in Peril', name: 'Priest in Peril',
    regions: ['Misthalin', 'Morytania'],
    skills: {}, prereqs: [], points: 1, series: 'Myreque',
    difficulty: DropSource.QUEST_NOVICE
  },
  'Nature Spirit': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Nature Spirit', name: 'Nature Spirit',
    regions: ['Morytania'],
    skills: { 'Crafting': 18 }, prereqs: ['Priest in Peril', 'The Restless Ghost'], points: 2, series: 'Myreque',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Death Plateau': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Death Plateau', name: 'Death Plateau',
    regions: ['Asgarnia'],
    skills: {}, prereqs: [], points: 1, series: 'Troll',
    difficulty: DropSource.QUEST_NOVICE
  },
  'Troll Stronghold': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Troll Stronghold', name: 'Troll Stronghold',
    regions: ['Asgarnia'],
    skills: { 'Agility': 15 }, prereqs: ['Death Plateau'], points: 1, series: 'Troll',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Tai Bwo Wannai Trio': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Tai Bwo Wannai Trio', name: 'Tai Bwo Wannai Trio',
    regions: ['Karamja'],
    skills: { 'Agility': 15, 'Cooking': 30, 'Fishing': 5 }, prereqs: ['Jungle Potion'], points: 2,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Regicide': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Regicide', name: 'Regicide',
    regions: ['Tirannwn'],
    skills: { 'Agility': 56, 'Crafting': 10 }, prereqs: ['Underground Pass'], points: 3, series: 'Elf',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Eadgar\'s Ruse': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Eadgar\'s Ruse', name: 'Eadgar\'s Ruse',
    regions: ['Asgarnia', 'Kandarin'],
    skills: { 'Herblore': 31 }, prereqs: ['Druidic Ritual', 'Troll Stronghold'], points: 1, series: 'Troll',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Shades of Mort\'ton': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Shades of Mort\'ton', name: 'Shades of Mort\'ton',
    regions: ['Morytania'],
    skills: { 'Crafting': 20, 'Herblore': 15, 'Firemaking': 5 }, prereqs: ['Priest in Peril'], points: 3,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'The Fremennik Trials': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'The Fremennik Trials', name: 'The Fremennik Trials',
    regions: ['Fremennik'],
    skills: { 'Fletching': 25, 'Woodcutting': 40, 'Crafting': 40 }, prereqs: [], points: 3, series: 'Fremennik',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Horror from the Deep': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Horror from the Deep', name: 'Horror from the Deep',
    regions: ['Fremennik'],
    skills: { 'Agility': 35 }, prereqs: [], points: 2,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Throne of Miscellania': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Throne of Miscellania', name: 'Throne of Miscellania',
    regions: ['Fremennik'],
    skills: { 'Woodcutting': 45, 'Farming': 10, 'Mining': 30, 'Fishing': 35 }, prereqs: ['The Fremennik Trials', 'Heroes\' Quest'], points: 1, series: 'Miscellania',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Monkey Madness I': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Monkey Madness I', name: 'Monkey Madness I',
    regions: ['Kandarin', 'Islands & Others'],
    skills: {}, prereqs: ['The Grand Tree', 'Tree Gnome Village'], points: 3, series: 'Gnome',
    difficulty: DropSource.QUEST_MASTER
  },
  'Haunted Mine': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Haunted Mine', name: 'Haunted Mine',
    regions: ['Morytania'],
    skills: { 'Crafting': 35 }, prereqs: ['Priest in Peril'], points: 2,
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Troll Romance': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Troll Romance', name: 'Troll Romance',
    regions: ['Asgarnia'],
    skills: { 'Agility': 28 }, prereqs: ['Troll Stronghold'], points: 2,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'In Search of the Myreque': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'In Search of the Myreque', name: 'In Search of the Myreque',
    regions: ['Morytania', 'Misthalin'],
    skills: { 'Agility': 25 }, prereqs: ['Nature Spirit'], points: 2, series: 'Myreque',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Creature of Fenkenstrain': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Creature of Fenkenstrain', name: 'Creature of Fenkenstrain',
    regions: ['Morytania'],
    skills: { 'Crafting': 20, 'Thieving': 25 }, prereqs: ['Priest in Peril', 'The Restless Ghost'], points: 2,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Roving Elves': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Roving Elves', name: 'Roving Elves',
    regions: ['Tirannwn'],
    skills: { 'Agility': 56 }, prereqs: ['Regicide', 'Waterfall Quest'], points: 1, series: 'Elf',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Ghosts Ahoy': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Ghosts Ahoy', name: 'Ghosts Ahoy',
    regions: ['Morytania'],
    skills: { 'Agility': 25, 'Cooking': 20 }, prereqs: ['Priest in Peril', 'The Restless Ghost'], points: 2,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'One Small Favour': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'One Small Favour', name: 'One Small Favour',
    regions: ['Kandarin', 'Karamja', 'Asgarnia', 'Misthalin'],
    skills: { 'Agility': 36, 'Crafting': 25, 'Herblore': 18, 'Smithing': 30 }, prereqs: ['Rune Mysteries', 'Shilo Village'], points: 2,
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Mountain Daughter': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Mountain Daughter', name: 'Mountain Daughter',
    regions: ['Fremennik'],
    skills: { 'Agility': 20 }, prereqs: [], points: 2,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Between a Rock...': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Between a Rock...', name: 'Between a Rock...',
    regions: ['Fremennik'],
    skills: { 'Defence': 30, 'Mining': 40, 'Smithing': 50 }, prereqs: ['Dwarf Cannon', 'Fishing Contest'], points: 2,
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'The Feud': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'The Feud', name: 'The Feud',
    regions: ['Kharidian Desert'],
    skills: { 'Thieving': 30 }, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'The Golem': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'The Golem', name: 'The Golem',
    regions: ['Kharidian Desert'],
    skills: { 'Crafting': 20, 'Thieving': 25 }, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Desert Treasure I': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Desert Treasure I', name: 'Desert Treasure I',
    regions: ['Kharidian Desert', 'Asgarnia', 'Kandarin', 'Morytania', 'Wilderness'],
    skills: { 'Thieving': 53, 'Firemaking': 50, 'Slayer': 10, 'Magic': 50 }, prereqs: ['The Dig Site', 'Temple of Ikov', 'The Tourist Trap', 'Troll Stronghold', 'Priest in Peril', 'Waterfall Quest'], points: 3, series: 'Mahjarrat',
    difficulty: DropSource.QUEST_MASTER
  },
  'Icthlarin\'s Little Helper': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Icthlarin\'s Little Helper', name: 'Icthlarin\'s Little Helper',
    regions: ['Kharidian Desert'],
    skills: {}, prereqs: ['Gertrude\'s Cat'], points: 2, series: 'Kharidian',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Tears of Guthix': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Tears of Guthix', name: 'Tears of Guthix',
    regions: ['Misthalin'],
    skills: { 'Firemaking': 49, 'Crafting': 20, 'Mining': 20 }, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Zogre Flesh Eaters': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Zogre Flesh Eaters', name: 'Zogre Flesh Eaters',
    regions: ['Kandarin'],
    skills: { 'Smithing': 4, 'Herblore': 8, 'Ranged': 30, 'Strength': 10, 'Fletching': 30 }, prereqs: ['Big Chompy Bird Hunting', 'Jungle Potion'], points: 1,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'The Lost Tribe': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'The Lost Tribe', name: 'The Lost Tribe',
    regions: ['Misthalin'],
    skills: { 'Agility': 13, 'Mining': 17, 'Thieving': 13 }, prereqs: ['Goblin Diplomacy', 'Rune Mysteries'], points: 1, series: 'Dorgeshuun',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'The Giant Dwarf': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'The Giant Dwarf', name: 'The Giant Dwarf',
    regions: ['Fremennik'],
    skills: { 'Crafting': 12, 'Firemaking': 16, 'Magic': 33, 'Thieving': 14 }, prereqs: [], points: 2, series: 'Red Axe',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Recruitment Drive': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Recruitment Drive', name: 'Recruitment Drive',
    regions: ['Asgarnia'],
    skills: { 'Quest Points': 12 }, prereqs: ['Black Knights\' Fortress'], points: 1, series: 'Temple Knight',
    difficulty: DropSource.QUEST_NOVICE
  },
  'Mourning\'s End Part I': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Mourning\'s End Part I', name: 'Mourning\'s End Part I',
    regions: ['Tirannwn'],
    skills: { 'Ranged': 60, 'Thieving': 50 }, prereqs: ['Roving Elves', 'Big Chompy Bird Hunting', 'Sheep Herder'], points: 2, series: 'Elf',
    difficulty: DropSource.QUEST_MASTER
  },
  'Forgettable Tale...': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Forgettable Tale...', name: 'Forgettable Tale of a Drunken Dwarf',
    regions: ['Fremennik'],
    skills: { 'Cooking': 22, 'Farming': 17 }, prereqs: ['The Giant Dwarf', 'Fishing Contest'], points: 2, series: 'Red Axe',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Garden of Tranquillity': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Garden of Tranquillity', name: 'Garden of Tranquillity',
    regions: ['Misthalin'],
    skills: { 'Farming': 25 }, prereqs: ['Creature of Fenkenstrain'], points: 2,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'A Tail of Two Cats': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'A Tail of Two Cats', name: 'A Tail of Two Cats',
    regions: ['Asgarnia', 'Misthalin'],
    skills: {}, prereqs: ['Icthlarin\'s Little Helper'], points: 2, series: 'Dragonkin',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Wanted!': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Wanted!', name: 'Wanted!',
    regions: ['Asgarnia'],
    skills: { 'Quest Points': 32 }, prereqs: ['Recruitment Drive', 'The Lost Tribe', 'Priest in Peril'], points: 1, series: 'Temple Knight',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Mourning\'s End Part II': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Mourning\'s End Part II', name: 'Mourning\'s End Part II',
    regions: ['Tirannwn'],
    skills: { 'Agility': 65 }, prereqs: ['Mourning\'s End Part I'], points: 2, series: 'Elf',
    difficulty: DropSource.QUEST_MASTER
  },
  'Rum Deal': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Rum Deal', name: 'Rum Deal',
    regions: ['Morytania', 'Islands & Others'],
    skills: { 'Farming': 40, 'Prayer': 47, 'Slayer': 42, 'Crafting': 42, 'Fishing': 50 }, prereqs: ['Zogre Flesh Eaters', 'Priest in Peril'], points: 2, series: 'Pirate',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Shadow of the Storm': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Shadow of the Storm', name: 'Shadow of the Storm',
    regions: ['Kharidian Desert'],
    skills: { 'Crafting': 30 }, prereqs: ['Demon Slayer', 'The Golem'], points: 1, series: 'Demon Slayer',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Making History': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Making History', name: 'Making History',
    regions: ['Kandarin'],
    skills: {}, prereqs: ['Priest in Peril', 'The Restless Ghost'], points: 3,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Ratcatchers': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Ratcatchers', name: 'Ratcatchers',
    regions: ['Misthalin'],
    skills: {}, prereqs: ['Icthlarin\'s Little Helper'], points: 2,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Spirits of the Elid': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Spirits of the Elid', name: 'Spirits of the Elid',
    regions: ['Kharidian Desert'],
    skills: { 'Magic': 33, 'Ranged': 37, 'Mining': 37, 'Thieving': 37 }, prereqs: [], points: 2,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Devious Minds': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Devious Minds', name: 'Devious Minds',
    regions: ['Misthalin', 'Asgarnia'],
    skills: { 'Smithing': 65, 'Runecraft': 50, 'Fletching': 50 }, prereqs: ['Wanted!', 'Troll Stronghold', 'Doric\'s Quest'], points: 1, series: 'Mahjarrat',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'The Hand in the Sand': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'The Hand in the Sand', name: 'The Hand in the Sand',
    regions: ['Kandarin'],
    skills: { 'Thieving': 17, 'Crafting': 49 }, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Enakhra\'s Lament': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Enakhra\'s Lament', name: 'Enakhra\'s Lament',
    regions: ['Kharidian Desert'],
    skills: { 'Crafting': 50, 'Firemaking': 45, 'Magic': 39, 'Prayer': 43 }, prereqs: [], points: 2, series: 'Mahjarrat',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Cabin Fever': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Cabin Fever', name: 'Cabin Fever',
    regions: ['Islands & Others'],
    skills: { 'Ranged': 40, 'Smithing': 50, 'Crafting': 45, 'Agility': 42 }, prereqs: ['Pirate\'s Treasure', 'Rum Deal'], points: 2, series: 'Pirate',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Fairytale I - Growing Pains': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Fairytale I - Growing Pains', name: 'Fairytale I - Growing Pains',
    regions: ['Misthalin'],
    skills: {}, prereqs: ['Lost City', 'Nature Spirit'], points: 2, series: 'Fairy Tale',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'RFD: The Cook': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'RFD: The Cook', name: 'RFD: Start (The Cook)',
    regions: ['Misthalin'],
    skills: { 'Cooking': 10 }, prereqs: ['Cook\'s Assistant'], points: 1, series: 'Recipe for Disaster',
    difficulty: DropSource.QUEST_NOVICE
  },
  'RFD: Dwarf': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'RFD: Dwarf', name: 'RFD: Dwarf',
    regions: ['Asgarnia'],
    skills: {}, prereqs: ['Fishing Contest'], points: 1, series: 'Recipe for Disaster',
    difficulty: DropSource.QUEST_NOVICE
  },
  'RFD: Goblins': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'RFD: Goblins', name: 'RFD: Goblins',
    regions: ['Asgarnia'],
    skills: {}, prereqs: ['Goblin Diplomacy'], points: 1, series: 'Recipe for Disaster',
    difficulty: DropSource.QUEST_NOVICE
  },
  'RFD: Pirate Pete': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'RFD: Pirate Pete', name: 'RFD: Pirate Pete',
    regions: ['Misthalin', 'Asgarnia', 'Islands & Others'],
    skills: { 'Cooking': 31 }, prereqs: [], points: 1, series: 'Recipe for Disaster',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'RFD: Lumbridge Guide': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'RFD: Lumbridge Guide', name: 'RFD: Lumbridge Guide',
    regions: ['Misthalin'],
    skills: { 'Cooking': 40 }, prereqs: ['Big Chompy Bird Hunting', 'Biohazard', 'Demon Slayer', 'Murder Mystery', 'Nature Spirit', 'Priest in Peril', 'The Restless Ghost', 'Witch\'s House'], points: 1, series: 'Recipe for Disaster',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'RFD: Evil Dave': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'RFD: Evil Dave', name: 'RFD: Evil Dave',
    regions: ['Misthalin'],
    skills: { 'Cooking': 25 }, prereqs: ['Gertrude\'s Cat', 'Shadow of the Storm'], points: 1, series: 'Recipe for Disaster',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'RFD: Skrach Uglogwee': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'RFD: Skrach Uglogwee', name: 'RFD: Skrach Uglogwee',
    regions: ['Kandarin'],
    skills: { 'Cooking': 41, 'Firemaking': 20 }, prereqs: ['Big Chompy Bird Hunting'], points: 1, series: 'Recipe for Disaster',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'RFD: Sir Amik Varze': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'RFD: Sir Amik Varze', name: 'RFD: Sir Amik Varze',
    regions: ['Asgarnia', 'Karamja', 'Misthalin', 'Islands & Others'],
    skills: { 'Quest Points': 107 }, prereqs: ['Legends\' Quest'], points: 1, series: 'Recipe for Disaster',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'RFD: King Awowogei': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'RFD: King Awowogei', name: 'RFD: King Awowogei',
    regions: ['Islands & Others', 'Kandarin'],
    skills: { 'Cooking': 70, 'Agility': 48 }, prereqs: ['Monkey Madness I'], points: 1, series: 'Recipe for Disaster',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'RFD: Finale': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'RFD: Finale', name: 'RFD: Finale',
    regions: ['Misthalin'],
    skills: { 'Quest Points': 175 }, prereqs: ['RFD: The Cook', 'RFD: Dwarf', 'RFD: Goblins', 'RFD: Pirate Pete', 'RFD: Lumbridge Guide', 'RFD: Evil Dave', 'RFD: Skrach Uglogwee', 'RFD: Sir Amik Varze', 'RFD: King Awowogei'], points: 1, series: 'Recipe for Disaster',
    difficulty: DropSource.QUEST_MASTER
  },
  'In Aid of the Myreque': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'In Aid of the Myreque', name: 'In Aid of the Myreque',
    regions: ['Morytania'],
    skills: { 'Crafting': 25, 'Magic': 7, 'Mining': 15 },
    prereqs: ['In Search of the Myreque'],
    points: 2,
    series: 'Myreque',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'A Soul\'s Bane': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'A Soul\'s Bane', name: 'A Soul\'s Bane',
    regions: ['Misthalin'],
    skills: {}, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Rag and Bone Man I': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Rag and Bone Man I', name: 'Rag and Bone Man I',
    regions: ['Misthalin'],
    skills: {}, prereqs: [], points: 1, series: 'Rag and Bone Man',
    difficulty: DropSource.QUEST_NOVICE
  },
  'Swan Song': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Swan Song', name: 'Swan Song',
    regions: ['Kandarin'],
    skills: { 'Quest Points': 100, 'Magic': 66, 'Cooking': 62, 'Fishing': 62, 'Smithing': 45, 'Firemaking': 42, 'Crafting': 40 }, prereqs: ['One Small Favour', 'Garden of Tranquillity'], points: 2,
    difficulty: DropSource.QUEST_MASTER
  },
  'Royal Trouble': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Royal Trouble', name: 'Royal Trouble',
    regions: ['Fremennik'],
    skills: { 'Agility': 40, 'Slayer': 40 }, prereqs: ['Throne of Miscellania'], points: 1, series: 'Miscellania',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Death to the Dorgeshuun': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Death to the Dorgeshuun', name: 'Death to the Dorgeshuun',
    regions: ['Misthalin'],
    skills: { 'Thieving': 23, 'Agility': 23 }, prereqs: ['The Lost Tribe'], points: 1, series: 'Dorgeshuun',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Fairytale II - Cure a Queen': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Fairytale II - Cure a Queen', name: 'Fairytale II - Cure a Queen',
    regions: ['Islands & Others'],
    skills: { 'Thieving': 40, 'Farming': 49, 'Herblore': 57 }, prereqs: ['Fairytale I - Growing Pains'], points: 2, series: 'Fairy Tale',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Lunar Diplomacy': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Lunar Diplomacy', name: 'Lunar Diplomacy',
    regions: ['Fremennik'],
    skills: { 'Crafting': 61, 'Defence': 40, 'Firemaking': 49, 'Magic': 65, 'Mining': 60, 'Woodcutting': 55 }, prereqs: ['The Fremennik Trials', 'Lost City', 'Rune Mysteries', 'Shilo Village'], points: 2, series: 'Fremennik',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'The Eyes of Glouphrie': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'The Eyes of Glouphrie', name: 'The Eyes of Glouphrie',
    regions: ['Kandarin'],
    skills: { 'Construction': 5, 'Magic': 46 }, prereqs: ['The Grand Tree'], points: 2, series: 'Gnome',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Darkness of Hallowvale': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Darkness of Hallowvale', name: 'Darkness of Hallowvale',
    regions: ['Morytania'],
    skills: { 'Construction': 5, 'Mining': 20, 'Thieving': 22, 'Agility': 26, 'Crafting': 32, 'Magic': 33, 'Strength': 40 }, prereqs: ['In Aid of the Myreque'], points: 2, series: 'Myreque',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'The Slug Menace': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'The Slug Menace', name: 'The Slug Menace',
    regions: ['Kandarin'],
    skills: { 'Crafting': 30, 'Runecraft': 30, 'Slayer': 30, 'Thieving': 30 }, prereqs: ['Sea Slug', 'Wanted!'], points: 1, series: 'Temple Knight',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Elemental Workshop II': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Elemental Workshop II', name: 'Elemental Workshop II',
    regions: ['Kandarin'],
    skills: { 'Magic': 20, 'Smithing': 30 }, prereqs: ['Elemental Workshop I'], points: 1, series: 'Elemental Workshop',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'My Arm\'s Big Adventure': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'My Arm\'s Big Adventure', name: 'My Arm\'s Big Adventure',
    regions: ['Asgarnia'],
    skills: { 'Woodcutting': 10, 'Farming': 29 }, prereqs: ['Eadgar\'s Ruse', 'The Feud', 'Jungle Potion'], points: 1, series: 'Troll',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Enlightened Journey': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Enlightened Journey', name: 'Enlightened Journey',
    regions: ['Asgarnia', 'Kandarin', 'Misthalin'],
    skills: { 'Firemaking': 20, 'Farming': 30, 'Crafting': 36 }, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Eagles\' Peak': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Eagles\' Peak', name: 'Eagles\' Peak',
    regions: ['Kandarin'],
    skills: { 'Hunter': 27 }, prereqs: [], points: 2,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Animal Magnetism': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Animal Magnetism', name: 'Animal Magnetism',
    regions: ['Misthalin'],
    skills: { 'Slayer': 18, 'Crafting': 19, 'Ranged': 30, 'Woodcutting': 35 }, prereqs: ['The Restless Ghost', 'Ernest the Chicken', 'Priest in Peril'], points: 1,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Contact!': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Contact!', name: 'Contact!',
    regions: ['Kharidian Desert'],
    skills: {}, prereqs: ['Prince Ali Rescue', 'Icthlarin\'s Little Helper'], points: 1, series: 'Kharidian',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Cold War': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Cold War', name: 'Cold War',
    regions: ['Fremennik'],
    skills: { 'Hunter': 10, 'Agility': 30, 'Crafting': 30, 'Construction': 34, 'Thieving': 15 }, prereqs: [], points: 1, series: 'Penguin',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'The Fremennik Isles': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'The Fremennik Isles', name: 'The Fremennik Isles',
    regions: ['Fremennik'],
    skills: { 'Construction': 20, 'Agility': 40 }, prereqs: ['The Fremennik Trials'], points: 1, series: 'Fremennik',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Tower of Life': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Tower of Life', name: 'Tower of Life',
    regions: ['Kandarin'],
    skills: { 'Construction': 10 }, prereqs: [], points: 2,
    difficulty: DropSource.QUEST_NOVICE
  },
  'The Great Brain Robbery': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'The Great Brain Robbery', name: 'The Great Brain Robbery',
    regions: ['Islands & Others'],
    skills: { 'Crafting': 16, 'Construction': 30, 'Prayer': 50 }, prereqs: ['Creature of Fenkenstrain', 'Cabin Fever'], points: 2, series: 'Pirate',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'What Lies Below': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'What Lies Below', name: 'What Lies Below',
    regions: ['Misthalin'],
    skills: { 'Runecraft': 35 }, prereqs: ['Rune Mysteries'], points: 1,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Olaf\'s Quest': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Olaf\'s Quest', name: 'Olaf\'s Quest',
    regions: ['Fremennik'],
    skills: { 'Firemaking': 40, 'Woodcutting': 50 }, prereqs: ['The Fremennik Trials'], points: 1,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Another Slice of H.A.M.': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Another Slice of H.A.M.', name: 'Another Slice of H.A.M.',
    regions: ['Misthalin'],
    skills: { 'Attack': 15, 'Prayer': 25 }, prereqs: ['Death to the Dorgeshuun', 'The Dig Site', 'The Giant Dwarf'], points: 1, series: 'Dorgeshuun',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Dream Mentor': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Dream Mentor', name: 'Dream Mentor',
    regions: ['Fremennik'],
    skills: {}, combatLevel: 85, prereqs: ['Lunar Diplomacy', 'Eadgar\'s Ruse'], points: 2,
    difficulty: DropSource.QUEST_MASTER
  },
  'Grim Tales': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Grim Tales', name: 'Grim Tales',
    regions: ['Asgarnia'],
    skills: { 'Farming': 45, 'Herblore': 52, 'Thieving': 58, 'Agility': 59, 'Woodcutting': 71 }, prereqs: ['Witch\'s House'], points: 1,
    difficulty: DropSource.QUEST_MASTER
  },
  'King\'s Ransom': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'King\'s Ransom', name: 'King\'s Ransom',
    regions: ['Kandarin'],
    skills: { 'Magic': 45, 'Defence': 65 }, prereqs: ['Black Knights\' Fortress', 'Holy Grail', 'Murder Mystery', 'One Small Favour'], points: 1, series: 'Camelot',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Monkey Madness II': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Monkey Madness II', name: 'Monkey Madness II',
    regions: ['Islands & Others'],
    skills: { 'Slayer': 69, 'Crafting': 70, 'Hunter': 60, 'Agility': 55, 'Thieving': 55, 'Firemaking': 60 }, prereqs: ['Monkey Madness I', 'Enlightened Journey', 'The Eyes of Glouphrie', 'Troll Stronghold', 'Watchtower', 'RFD: King Awowogei'], points: 4, series: 'Gnome',
    difficulty: DropSource.QUEST_GRANDMASTER
  },
  'Client of Kourend': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Client of Kourend', name: 'Client of Kourend',
    regions: ['Kourend & Kebos'],
    skills: {}, prereqs: [], points: 1, series: 'Great Kourend',
    difficulty: DropSource.QUEST_NOVICE
  },
  'Rag and Bone Man II': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Rag and Bone Man II', name: 'Rag and Bone Man II',
    regions: ['Misthalin'],
    skills: { 'Slayer': 40, 'Defence': 20 }, prereqs: ['Rag and Bone Man I'], points: 1, series: 'Rag and Bone Man',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Bone Voyage': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Bone Voyage', name: 'Bone Voyage',
    regions: ['Misthalin', 'Islands & Others'],
    skills: {}, prereqs: ['The Dig Site'], points: 1,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'The Queen of Thieves': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'The Queen of Thieves', name: 'The Queen of Thieves',
    regions: ['Kourend & Kebos'],
    skills: { 'Thieving': 20 }, prereqs: ['Client of Kourend'], points: 1, series: 'Great Kourend',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'The Depths of Despair': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'The Depths of Despair', name: 'The Depths of Despair',
    regions: ['Kourend & Kebos'],
    skills: { 'Agility': 18 }, prereqs: ['Client of Kourend'], points: 1, series: 'Great Kourend',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Dragon Slayer II': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Dragon Slayer II', name: 'Dragon Slayer II',
    regions: ['Misthalin', 'Asgarnia', 'Kandarin', 'Fremennik', 'Kourend & Kebos'],
    skills: { 'Magic': 75, 'Smithing': 70, 'Mining': 68, 'Crafting': 62, 'Agility': 60, 'Thieving': 60, 'Construction': 50, 'Hitpoints': 50, 'Quest Points': 200 }, prereqs: ['Legends\' Quest', 'Dream Mentor', 'A Tail of Two Cats', 'Animal Magnetism', 'Ghosts Ahoy', 'Bone Voyage', 'Client of Kourend'], points: 5, series: 'Dragonkin',
    difficulty: DropSource.QUEST_GRANDMASTER
  },
  'Tale of the Righteous': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Tale of the Righteous', name: 'Tale of the Righteous',
    regions: ['Kourend & Kebos'],
    skills: { 'Strength': 16, 'Mining': 10 }, prereqs: ['Client of Kourend'], points: 1, series: 'Great Kourend',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'A Taste of Hope': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'A Taste of Hope', name: 'A Taste of Hope',
    regions: ['Morytania'],
    skills: { 'Crafting': 48, 'Agility': 45, 'Attack': 40, 'Herblore': 40, 'Slayer': 38 }, prereqs: ['Darkness of Hallowvale'], points: 1, series: 'Myreque',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Making Friends with My Arm': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Making Friends with My Arm', name: 'Making Friends with My Arm',
    regions: ['Asgarnia', 'Fremennik'],
    skills: { 'Firemaking': 66, 'Mining': 72, 'Construction': 35, 'Agility': 68 }, prereqs: ['My Arm\'s Big Adventure', 'Swan Song', 'Cold War', 'Romeo & Juliet'], points: 2, series: 'Troll',
    difficulty: DropSource.QUEST_MASTER
  },
  'The Forsaken Tower': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'The Forsaken Tower', name: 'The Forsaken Tower',
    regions: ['Kourend & Kebos'],
    skills: {}, prereqs: ['Client of Kourend'], points: 1, series: 'Great Kourend',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'The Ascent of Arceuus': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'The Ascent of Arceuus', name: 'The Ascent of Arceuus',
    regions: ['Kourend & Kebos'],
    skills: { 'Hunter': 12 }, prereqs: ['Client of Kourend'], points: 1, series: 'Great Kourend',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Song of the Elves': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Song of the Elves', name: 'Song of the Elves',
    regions: ['Tirannwn'],
    skills: { 'Agility': 70, 'Construction': 70, 'Farming': 70, 'Herblore': 70, 'Hunter': 70, 'Mining': 70, 'Smithing': 70, 'Woodcutting': 70 }, prereqs: ['Mourning\'s End Part II', 'Making History'], points: 4, series: 'Elf',
    difficulty: DropSource.QUEST_GRANDMASTER
  },
  'The Fremennik Exiles': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'The Fremennik Exiles', name: 'The Fremennik Exiles',
    regions: ['Fremennik'],
    skills: { 'Crafting': 65, 'Slayer': 60, 'Smithing': 60, 'Fishing': 60, 'Runecraft': 55 }, prereqs: ['The Fremennik Isles', 'Lunar Diplomacy', 'Mountain Daughter', 'Heroes\' Quest'], points: 2, series: 'Fremennik',
    difficulty: DropSource.QUEST_MASTER
  },
  'Sins of the Father': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Sins of the Father', name: 'Sins of the Father',
    regions: ['Morytania'],
    skills: { 'Woodcutting': 62, 'Fletching': 60, 'Crafting': 56, 'Agility': 52, 'Slayer': 50, 'Attack': 50, 'Firemaking': 66, 'Magic': 49 }, prereqs: ['A Taste of Hope', 'Vampyre Slayer'], points: 2, series: 'Myreque',
    difficulty: DropSource.QUEST_MASTER
  },
  'A Porcine of Interest': {
    kind: 'quest', accessPolicy: 'regions-and-locations',
    id: 'A Porcine of Interest', name: 'A Porcine of Interest',
    regions: ['Misthalin'],
    locations: [LOCATIONS.draynorVillage, LOCATIONS.southFaladorFarm],
    skills: { 'Slayer': 1 }, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Getting Ahead': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Getting Ahead', name: 'Getting Ahead',
    regions: ['Kourend & Kebos'],
    skills: { 'Construction': 26, 'Crafting': 30 }, prereqs: [], points: 1, series: 'Twisted Tales',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'A Night at the Theatre': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'A Night at the Theatre', name: 'A Night at the Theatre',
    regions: ['Morytania'],
    skills: {}, prereqs: ['A Taste of Hope'], points: 2,
    difficulty: DropSource.QUEST_MASTER
  },
  'A Kingdom Divided': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'A Kingdom Divided', name: 'A Kingdom Divided',
    regions: ['Kourend & Kebos'],
    skills: { 'Agility': 54, 'Thieving': 52, 'Woodcutting': 52, 'Herblore': 50, 'Mining': 42, 'Crafting': 38, 'Magic': 35 }, prereqs: ['The Depths of Despair', 'The Queen of Thieves', 'Tale of the Righteous', 'The Forsaken Tower', 'The Ascent of Arceuus'], points: 2, series: 'Great Kourend',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Land of the Goblins': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Land of the Goblins', name: 'Land of the Goblins',
    regions: ['Kandarin'],
    skills: { 'Agility': 38, 'Thieving': 45, 'Fishing': 40, 'Herblore': 48 }, prereqs: ['Another Slice of H.A.M.', 'Fishing Contest'], points: 2, series: 'Dorgeshuun',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Temple of the Eye': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Temple of the Eye', name: 'Temple of the Eye',
    regions: ['Kharidian Desert'],
    skills: { 'Runecraft': 10 }, prereqs: ['Enter the Abyss'], points: 1, series: 'Order of Wizards',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Beneath Cursed Sands': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Beneath Cursed Sands', name: 'Beneath Cursed Sands',
    regions: ['Kharidian Desert'],
    skills: { 'Agility': 62, 'Crafting': 55, 'Firemaking': 55 }, prereqs: ['Contact!'], points: 2, series: 'Kharidian',
    difficulty: DropSource.QUEST_MASTER
  },
  'Sleeping Giants': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Sleeping Giants', name: 'Sleeping Giants',
    regions: ['Kharidian Desert'],
    skills: { 'Smithing': 15 }, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'The Garden of Death': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'The Garden of Death', name: 'The Garden of Death',
    regions: ['Kourend & Kebos'],
    skills: { 'Farming': 20 }, prereqs: [], points: 1, series: 'Twisted Tales',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Secrets of the North': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Secrets of the North', name: 'Secrets of the North',
    regions: ['Fremennik', 'Kharidian Desert'],
    skills: { 'Thieving': 64, 'Agility': 69, 'Hunter': 56 }, prereqs: ['Hazeel Cult', 'The General\'s Shadow', 'Making Friends with My Arm'], points: 2, series: 'Mahjarrat',
    difficulty: DropSource.QUEST_MASTER
  },
  'Desert Treasure II': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Desert Treasure II', name: 'Desert Treasure II - The Fallen Empire',
    regions: ['Kharidian Desert', 'Asgarnia', 'Fremennik', 'Kourend & Kebos', 'Morytania'],
    skills: { 'Magic': 75, 'Firemaking': 75, 'Thieving': 70, 'Herblore': 62, 'Runecraft': 60, 'Construction': 60 }, prereqs: ['Desert Treasure I', 'Secrets of the North', 'Enakhra\'s Lament', 'Temple of the Eye', 'The Garden of Death', 'Below Ice Mountain'], points: 5, series: 'Mahjarrat',
    difficulty: DropSource.QUEST_GRANDMASTER
  },
  'The Path of Glouphrie': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'The Path of Glouphrie', name: 'The Path of Glouphrie',
    regions: ['Kandarin'],
    skills: { 'Strength': 60, 'Slayer': 56, 'Thieving': 56, 'Ranged': 47, 'Agility': 45 }, prereqs: ['The Eyes of Glouphrie', 'Waterfall Quest', 'Tree Gnome Village'], points: 2, series: 'Gnome',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Children of the Sun': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Children of the Sun', name: 'Children of the Sun',
    regions: ['Misthalin'],
    skills: {}, prereqs: [], points: 1, series: 'Twilight Emissaries',
    difficulty: DropSource.QUEST_NOVICE
  },
  'Defender of Varrock': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Defender of Varrock', name: 'Defender of Varrock',
    regions: ['Misthalin'],
    skills: { 'Smithing': 55, 'Hunter': 52 }, prereqs: ['Shield of Arrav', 'Romeo & Juliet', 'Demon Slayer', 'Temple of Ikov', 'Below Ice Mountain', 'Family Crest', 'Garden of Tranquillity', 'What Lies Below'], points: 2, series: 'Mahjarrat',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Twilight\'s Promise': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Twilight\'s Promise', name: 'Twilight\'s Promise',
    regions: ['Varlamore'],
    skills: {}, prereqs: ['Children of the Sun'], points: 1, series: 'Twilight Emissaries',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'At First Light': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'At First Light', name: 'At First Light',
    regions: ['Varlamore'],
    skills: { 'Hunter': 46, 'Herblore': 30, 'Construction': 27 }, prereqs: ['Children of the Sun'], points: 1,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Perilous Moons': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Perilous Moons', name: 'Perilous Moons',
    regions: ['Varlamore'],
    skills: { 'Slayer': 48, 'Hunter': 20, 'Fishing': 20, 'Runecraft': 20, 'Construction': 10 }, prereqs: ['Twilight\'s Promise'], points: 2,
    difficulty: DropSource.QUEST_MASTER
  },
  'The Ribbiting Tale': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'The Ribbiting Tale', name: 'The Ribbiting Tale of a Lily Pad Labour Dispute',
    regions: ['Varlamore'],
    skills: { 'Woodcutting': 15 }, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_NOVICE
  },
  'While Guthix Sleeps': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'While Guthix Sleeps', name: 'While Guthix Sleeps',
    regions: ['Misthalin', 'Asgarnia', 'Kandarin'],
    skills: { 'Thieving': 72, 'Agility': 66, 'Farming': 65, 'Hunter': 62, 'Quest Points': 180 }, prereqs: ['Dream Mentor', 'Legends\' Quest', 'The Path of Glouphrie', 'Defender of Varrock'], points: 5, series: 'Mahjarrat',
    difficulty: DropSource.QUEST_GRANDMASTER
  },
  'The Heart of Darkness': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'The Heart of Darkness', name: 'The Heart of Darkness',
    regions: ['Varlamore'],
    skills: { 'Mining': 55, 'Thieving': 48, 'Slayer': 48, 'Agility': 46 }, prereqs: ['Twilight\'s Promise', 'Meat and Greet'], points: 2, series: 'Twilight Emissaries',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Death on the Isle': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Death on the Isle', name: 'Death on the Isle',
    regions: ['Varlamore'],
    skills: { 'Thieving': 34, 'Agility': 32 }, prereqs: ['Children of the Sun'], points: 2,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Meat and Greet': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Meat and Greet', name: 'Meat and Greet',
    regions: ['Varlamore'],
    skills: {}, prereqs: ['Children of the Sun'], points: 1,
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Ethically Acquired Antiquities': {
    kind: 'quest', accessPolicy: 'regions-and-locations',
    id: 'Ethically Acquired Antiquities', name: 'Ethically Acquired Antiquities',
    regions: ['Varlamore'],
    locations: [LOCATIONS.civitas, LOCATIONS.portSarim, LOCATIONS.varrockMuseum],
    skills: { 'Thieving': 25 }, prereqs: ['Children of the Sun', 'Shield of Arrav'], points: 1,
    difficulty: DropSource.QUEST_NOVICE
  },
  'The Curse of Arrav': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'The Curse of Arrav', name: 'The Curse of Arrav',
    regions: ['Misthalin'],
    skills: { 'Agility': 61, 'Ranged': 62, 'Strength': 58, 'Thieving': 62, 'Mining': 64, 'Slayer': 37 }, prereqs: ['Defender of Varrock', 'Troll Romance'], points: 2, series: 'Mahjarrat',
    difficulty: DropSource.QUEST_MASTER
  },
  'The Final Dawn': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'The Final Dawn', name: 'The Final Dawn',
    regions: ['Varlamore'],
    skills: { 'Thieving': 66, 'Fletching': 52, 'Runecraft': 52 }, prereqs: ['The Heart of Darkness', 'Perilous Moons'], points: 3, series: 'Twilight Emissaries',
    difficulty: DropSource.QUEST_MASTER
  },
  'Shadows of Custodia': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Shadows of Custodia', name: 'Shadows of Custodia',
    regions: ['Varlamore'],
    skills: { 'Slayer': 54, 'Fishing': 45, 'Construction': 41, 'Hunter': 36 }, prereqs: ['Children of the Sun'], points: 2,
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Scrambled!': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Scrambled!', name: 'Scrambled!',
    regions: ['Varlamore'],
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
    kind: 'quest', accessPolicy: 'regions',
    id: 'Prying Times', name: 'Prying Times',
    regions: ['The Open Seas'],
    skills: { 'Smithing': 30, 'Sailing': 12 }, prereqs: ['Pandemonium', 'The Knight\'s Sword'],
    manualRequirements: ['One open Sailing task slot'], points: 1,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Current Affairs': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Current Affairs', name: 'Current Affairs',
    regions: ['The Open Seas'],
    skills: { 'Sailing': 22, 'Fishing': 10 }, prereqs: ['Pandemonium'], points: 1,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Troubled Tortugans': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'Troubled Tortugans', name: 'Troubled Tortugans',
    regions: ['The Open Seas'],
    skills: { 'Slayer': 51, 'Construction': 48, 'Sailing': 45, 'Hunter': 45, 'Woodcutting': 40, 'Crafting': 34 }, prereqs: ['Pandemonium'], points: 1, series: 'Tortugan',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'The Red Reef': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'The Red Reef', name: 'The Red Reef',
    regions: ['The Open Seas'],
    skills: { Sailing: 52, Smithing: 48 }, prereqs: ['Troubled Tortugans'], points: 2, series: 'Tortugan',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'The Ides of Milk': {
    kind: 'quest', accessPolicy: 'regions',
    id: 'The Ides of Milk', name: 'The Ides of Milk',
    regions: ['Misthalin'],
    skills: {}, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_NOVICE
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
    regions: ['Kandarin'],
    skills: { 'Fishing': 55, 'Firemaking': 35, 'Strength': 35, 'Agility': 15, 'Farming': 15, 'Crafting': 11, 'Smithing': 5, 'Herblore': 4 },
    prereqs: ['Tai Bwo Wannai Trio'], points: 0,
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Bear Your Soul': {
    kind: 'miniquest', accessPolicy: 'regions',
    id: 'Bear Your Soul', name: 'Bear Your Soul',
    regions: ['Kourend & Kebos', 'Asgarnia'],
    skills: {}, prereqs: [], points: 0, series: 'Great Kourend',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Curse of the Empty Lord': {
    kind: 'miniquest', accessPolicy: 'regions',
    id: 'Curse of the Empty Lord', name: 'Curse of the Empty Lord',
    regions: ['Asgarnia', 'Kandarin', 'Wilderness'],
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
    regions: ['Fremennik', 'Kandarin', 'Tirannwn', 'Asgarnia', 'Misthalin', 'Kharidian Desert'],
    skills: {}, prereqs: ['Making History'], points: 0,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Enter the Abyss': {
    kind: 'miniquest', accessPolicy: 'regions',
    id: 'Enter the Abyss', name: 'Enter the Abyss',
    regions: ['Misthalin', 'Wilderness'],
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
    regions: ['Asgarnia'],
    skills: { 'Agility': 70, 'Strength': 70, 'Ranged': 70, 'Hitpoints': 70 },
    prereqs: ['Desert Treasure I'], points: 0,
    difficulty: DropSource.QUEST_MASTER
  },
  'The General\'s Shadow': {
    kind: 'miniquest', accessPolicy: 'regions',
    id: 'The General\'s Shadow', name: 'The General\'s Shadow',
    regions: ['Fremennik', 'Kandarin', 'Karamja', 'Asgarnia', 'Kharidian Desert'],
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
    regions: ['Kandarin'],
    skills: { 'Prayer': 50 },
    prereqs: ['Desert Treasure I', 'Fairytale II - Cure a Queen', 'Land of the Goblins'],
    manualRequirements: ['Started The Restless Ghost'], points: 0,
    difficulty: DropSource.QUEST_MASTER
  },
  'In Search of Knowledge': {
    kind: 'miniquest', accessPolicy: 'regions',
    id: 'In Search of Knowledge', name: 'In Search of Knowledge',
    regions: ['Kourend & Kebos'],
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
    regions: ['Morytania'],
    skills: { 'Slayer': 40 }, prereqs: ['Haunted Mine'], points: 0,
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Mage Arena I': {
    kind: 'miniquest', accessPolicy: 'regions',
    id: 'Mage Arena I', name: 'Mage Arena I',
    regions: ['Wilderness'],
    skills: { 'Magic': 60 }, prereqs: [], points: 0,
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Mage Arena II': {
    kind: 'miniquest', accessPolicy: 'regions',
    id: 'Mage Arena II', name: 'Mage Arena II',
    regions: ['Wilderness'],
    skills: { 'Magic': 75 }, prereqs: ['Mage Arena I'],
    manualRequirements: [
      'Cast Claws of Guthix, Flames of Zamorak, and Saradomin Strike 100 times each inside the Mage Arena',
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
    regions: ['Varlamore'],
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