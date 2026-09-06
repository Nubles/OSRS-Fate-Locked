
import { DropSource } from '../types';
import type { RequirementPredicate } from '../utils/requirementPredicates';
import type { ChunkQuestGeography } from '../utils/questChunkGeography';

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
  /** Mode-specific destinations; does not change the existing Standard access policy. */
  chunkedGeography?: ChunkQuestGeography;
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
    kind: 'quest', accessPolicy: "regions",
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
    kind: 'quest', accessPolicy: 'locations',
    id: 'The Restless Ghost', name: 'The Restless Ghost',
    regions: ['Lumbridge'],
    locations: [
      {"id": "lumbridge-church","label": "Lumbridge church","standardAreas": ["Lumbridge"],"chunkOptions": [{"cx": 50,"cy": 50}]},
      {"id": "urhney-hut","label": "Father Urhney hut","standardAreas": ["Lumbridge"],"chunkOptions": [{"cx": 49,"cy": 49}]},
      {"id": "lumbridge-graveyard","label": "Lumbridge graveyard","standardAreas": ["Lumbridge"],"chunkOptions": [{"cx": 50,"cy": 49}]},
      {"id": "ghost-skull-entry","label": "Wizards' Tower basement entrance","standardAreas": ["Wizards' Tower"],"chunkOptions": [{"cx": 48,"cy": 49}]},
    ],
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
    kind: 'quest', accessPolicy: 'locations',
    id: 'Sheep Shearer', name: 'Sheep Shearer',
    regions: ['Lumbridge'],
    locations: [
      {"id": "fred-farm","label": "Fred the Farmer","standardAreas": ["Lumbridge"],"chunkOptions": [{"cx": 49,"cy": 51}]},
    ],
    skills: {}, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Shield of Arrav': {
    kind: 'quest', accessPolicy: "regions",
    id: 'Shield of Arrav', name: 'Shield of Arrav',
    regions: ['Varrock'],
    manualRequirements: ['A trustworthy partner in the opposite gang'],
    skills: {}, prereqs: [], points: 1,
    chunkedGeography: {"locations":[{"id":"candidate-1","label":"Varrock Palace","chunkOptions":[{"cx":50,"cy":54}]},{"id":"candidate-2","label":"Charlie / museum","chunkOptions":[{"cx":50,"cy":53}]}],"groups":[{"id":"gang-route","label":"Chosen gang route","routes":[{"id":"black-arm","label":"Black Arm Gang","locations":[{"id":"black-arm-base","label":"Black Arm Gang headquarters","chunkOptions":[{"cx":49,"cy":52}]}],"unknowns":[]},{"id":"phoenix","label":"Phoenix Gang","locations":[{"id":"phoenix-base","label":"Phoenix Gang ladder","chunkOptions":[{"cx":50,"cy":52}]}],"unknowns":[]}]}],"unknowns":["Gang affiliation"]},
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
    kind: 'quest', accessPolicy: 'locations',
    id: 'Vampyre Slayer', name: 'Vampyre Slayer',
    regions: ['Draynor Village', 'Varrock'],
    locations: [
      {"id": "morgan-house","label": "Morgan house","standardAreas": ["Draynor Village"],"chunkOptions": [{"cx": 48,"cy": 51}]},
      {"id": "harlow-inn","label": "Blue Moon Inn","standardAreas": ["Varrock"],"chunkOptions": [{"cx": 50,"cy": 53}]},
      {"id": "vampyre-manor","label": "Draynor Manor entrance","standardAreas": ["Draynor Village"],"chunkOptions": [{"cx": 48,"cy": 52}]},
    ],
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
  ,
    // Source-reconciled completion destinations; Standard policy remains unchanged.
    chunkedGeography: {
      "locations": [
        {
          "id": "al-kharid-palace",
          "label": "Al Kharid Palace",
          "chunkOptions": [
            {
              "cx": 51,
              "cy": 49
            }
          ]
        },
        {
          "id": "draynor-village-and-jail",
          "label": "Draynor Village and the jail",
          "chunkOptions": [
            {
              "cx": 48,
              "cy": 50
            }
          ]
        }
      ],
      "groups": [],
      "unknowns": [
        "The key print must be used at a legal furnace; the source permits any furnace, and the complete alternative furnace destinations are not yet represented."
      ]
    },
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
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"location-1","label":"Falador Castle","standardAreas":["Falador"],"chunkOptions":[{"cx":46,"cy":52}]},
      {"id":"location-2","label":"Varrock Palace library","standardAreas":["Varrock"],"chunkOptions":[{"cx":50,"cy":54}]},
      {"id":"location-3","label":"Thurgo hut","standardAreas":["Port Sarim"],"chunkOptions":[{"cx":46,"cy":49}]},
      {"id":"location-4","label":"Asgarnian Ice Dungeon entrance","standardAreas":["Asgarnian Ice Dungeon"],"chunkOptions":[{"cx":47,"cy":49}]},
    ],
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
    kind: 'quest', accessPolicy: 'locations',
    id: 'Pirate\'s Treasure', name: 'Pirate\'s Treasure',
    regions: ['Port Sarim', 'Falador', 'Varrock', 'Musa Point'],
    locations: [
      {"id": "port-sarim-rum","label": "Port Sarim docks and shop","standardAreas": ["Port Sarim"],"chunkOptions": [{"cx": 47,"cy": 50}]},
      {"id": "musa-rum-crate","label": "Musa Point rum shop and crate","standardAreas": ["Musa Point"],"chunkOptions": [{"cx": 45,"cy": 49}]},
      {"id": "pirate-chest","label": "Blue Moon Inn","standardAreas": ["Varrock"],"chunkOptions": [{"cx": 50,"cy": 53}]},
      {"id": "falador-treasure","label": "Falador Park","standardAreas": ["Falador"],"chunkOptions": [{"cx": 46,"cy": 52}]},
    ],
    skills: {}, prereqs: [], points: 2,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Dragon Slayer I': {
    kind: 'quest', accessPolicy: "regions",
    id: 'Dragon Slayer I', name: 'Dragon Slayer I',
    regions: ['Varrock', 'Edgeville', 'Draynor Village', 'Lumbridge', 'Rimmington', 'Port Sarim', 'Crandor'],
    skills: {"Quest Points":32}, prereqs: [], points: 2,
    chunkedGeography: {"locations":[{"id":"candidate-1","label":"Champions Guild","chunkOptions":[{"cx":49,"cy":52}]},{"id":"candidate-2","label":"Oziach / Oracle","chunkOptions":[{"cx":47,"cy":54}]},{"id":"candidate-3","label":"Wormbrain","chunkOptions":[{"cx":47,"cy":49}]},{"id":"candidate-4","label":"Melzar maze","chunkOptions":[{"cx":45,"cy":50}]},{"id":"candidate-5","label":"Ned","chunkOptions":[{"cx":48,"cy":50}]},{"id":"candidate-6","label":"Crandor entrance","chunkOptions":[{"cx":44,"cy":50}]},{"id":"klarense","label":"Klarense and quest ship","chunkOptions":[{"cx":47,"cy":50}]}],"groups":[{"id":"dwarven-mine-entry","label":"Reach the Dwarven Mine map fragment","routes":[{"id":"mountain-entrance","label":"Dwarven Mine mountain entrance","locations":[{"id":"mine-entrance","label":"Dwarven Mine entrance","chunkOptions":[{"cx":47,"cy":53}]}]},{"id":"other-mine-entry","label":"Another Dwarven Mine entrance","locations":[],"unknowns":["Another connected Dwarven Mine entry route has not been classified"]}]}],"unknowns":[]},
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
  ,
    // Source-reconciled completion destinations; Standard policy remains unchanged.
    chunkedGeography: {
      "locations": [
        {
          "id": "willow-start",
          "label": "Willow — Ice Mountain",
          "chunkOptions": [
            {
              "cx": 46,
              "cy": 53
            }
          ]
        },
        {
          "id": "checkal-atlas",
          "label": "Checkal and Atlas — Barbarian Village",
          "chunkOptions": [
            {
              "cx": 48,
              "cy": 53
            }
          ]
        },
        {
          "id": "marley",
          "label": "Marley — Edgeville",
          "chunkOptions": [
            {
              "cx": 48,
              "cy": 54
            }
          ]
        },
        {
          "id": "cook",
          "label": "Cook — Blue Moon Inn",
          "chunkOptions": [
            {
              "cx": 50,
              "cy": 53
            }
          ]
        },
        {
          "id": "burntof",
          "label": "Burntof — Falador",
          "chunkOptions": [
            {
              "cx": 46,
              "cy": 52
            }
          ]
        },
        {
          "id": "excavation",
          "label": "Willow excavation and Camdozaal entrance",
          "chunkOptions": [
            {
              "cx": 46,
              "cy": 54
            }
          ]
        }
      ],
      "groups": [],
      "unknowns": []
    },
  },
  'The Corsair Curse': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"port-sarim-farm","label":"Port Sarim farm","standardAreas":["Falador"],"chunkOptions":[{"cx":47,"cy":51}]},
      {"id":"rimmington-departure","label":"Rimmington departure","standardAreas":["Rimmington"],"chunkOptions":[{"cx":45,"cy":50}]},
      {"id":"corsair-cove","label":"Corsair Cove","standardAreas":["Corsair Cove"],"chunkOptions":[{"cx":39,"cy":44}]},
      {"id":"corsair-ship","label":"Corsair ship","standardAreas":["Corsair Cove"],"chunkOptions":[{"cx":40,"cy":44}]},
    ],
    id: 'The Corsair Curse', name: 'The Corsair Curse',
    regions: ['Rimmington', 'Falador', 'Corsair Cove'],
    skills: {}, prereqs: [], points: 2,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'X Marks the Spot': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"location-1","label":"Lumbridge pub and castle clues","standardAreas":["Lumbridge"],"chunkOptions":[{"cx":50,"cy":50}]},
      {"id":"location-2","label":"Draynor north clue","standardAreas":["Draynor Village"],"chunkOptions":[{"cx":48,"cy":51}]},
      {"id":"location-3","label":"Draynor market clue","standardAreas":["Draynor Village"],"chunkOptions":[{"cx":48,"cy":50}]},
      {"id":"location-4","label":"Veos in Port Sarim","standardAreas":["Port Sarim"],"chunkOptions":[{"cx":47,"cy":50}]},
    ],
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
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"location-1","label":"Swamp adventurers and leprechaun","standardAreas":["Lumbridge"],"chunkOptions":[{"cx":49,"cy":50}]},
      {"id":"location-2","label":"Entrana Dungeon entrance","standardAreas":["Entrana"],"chunkOptions":[{"cx":44,"cy":52}]},
      {"id":"location-3","label":"Zanaris shed","standardAreas":["Zanaris","Lumbridge"],"chunkOptions":[{"cx":50,"cy":49}]},
    ],
    id: 'Lost City', name: 'Lost City',
    regions: ['Lumbridge', 'Zanaris', 'Entrana'],
    skills: { 'Crafting': 31, 'Woodcutting': 36 }, prereqs: [], points: 3,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Witch\'s House': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"witch-s-house","label":"Witch's House","standardAreas":["Taverley"],"chunkOptions":[{"cx":45,"cy":54}]},
    ],
    id: 'Witch\'s House', name: 'Witch\'s House',
    regions: ['Taverley'],
    skills: {}, prereqs: [], points: 4,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Merlin\'s Crystal': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"camelot-castle","label":"Camelot Castle","standardAreas":["Camelot"],"chunkOptions":[{"cx":43,"cy":54}]},
      {"id":"camelot-western-staircase","label":"Camelot western staircase","standardAreas":["Camelot"],"chunkOptions":[{"cx":42,"cy":54}]},
      {"id":"catherby-and-keep-le-faye","label":"Catherby and Keep Le Faye","standardAreas":["Catherby"],"chunkOptions":[{"cx":43,"cy":53}]},
      {"id":"lady-of-the-lake","label":"Lady of the Lake","standardAreas":["Taverley"],"chunkOptions":[{"cx":45,"cy":53}]},
      {"id":"port-sarim-jewellery-shop","label":"Port Sarim jewellery shop","standardAreas":["Port Sarim"],"chunkOptions":[{"cx":47,"cy":50}]},
      {"id":"varrock-zamorak-altar","label":"Varrock Zamorak altar","standardAreas":["Varrock"],"chunkOptions":[{"cx":50,"cy":52}]},
    ],
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
  ,
    // Source-reconciled completion destinations; Standard policy remains unchanged.
    chunkedGeography: {
      "locations": [
        {
          "id": "achietties",
          "label": "Achietties — Heroes Guild entrance",
          "chunkOptions": [
            {
              "cx": 45,
              "cy": 54
            }
          ]
        },
        {
          "id": "firebird",
          "label": "Entrana firebird",
          "chunkOptions": [
            {
              "cx": 44,
              "cy": 52
            }
          ]
        },
        {
          "id": "armband",
          "label": "Brimhaven thieves armband task",
          "chunkOptions": [
            {
              "cx": 43,
              "cy": 49
            }
          ]
        }
      ],
      "groups": [
        {
          "id": "gang-base",
          "label": "Assigned gang headquarters",
          "routes": [
            {
              "id": "black-arm",
              "label": "Black Arm Gang",
              "locations": [
                {
                  "id": "katrine",
                  "label": "Katrine — Black Arm Gang",
                  "chunkOptions": [
                    {
                      "cx": 49,
                      "cy": 52
                    }
                  ]
                }
              ],
              "unknowns": [
                "Black Arm gang membership must match the player."
              ]
            },
            {
              "id": "phoenix",
              "label": "Phoenix Gang",
              "locations": [
                {
                  "id": "straven",
                  "label": "Straven — Phoenix Gang entrance",
                  "chunkOptions": [
                    {
                      "cx": 50,
                      "cy": 52
                    }
                  ]
                }
              ],
              "unknowns": [
                "Phoenix gang membership must match the player."
              ]
            }
          ]
        }
      ],
      "unknowns": [
        "The player’s Black Arm or Phoenix gang route must be identified; ownership of the other gang’s base does not satisfy their assigned route.",
        "Lava eel fishing destination and already-owned ice gloves must be reconciled with legal acquisition alternatives; the source’s Taverley example does not prove the Lava Maze is mandatory."
      ]
    },
  },
  'Scorpion Catcher': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"sorcerers-tower","label":"Sorcerers Tower","standardAreas":["Seers' Village"],"chunkOptions":[{"cx":42,"cy":53}]},
      {"id":"seers-village","label":"Seers Village","standardAreas":["Seers' Village"],"chunkOptions":[{"cx":42,"cy":54}]},
      {"id":"taverley-dungeon-entrance","label":"Taverley Dungeon entrance","standardAreas":["Taverley"],"chunkOptions":[{"cx":45,"cy":53}]},
      {"id":"edgeville-monastery","label":"Edgeville Monastery","standardAreas":["Edgeville"],"chunkOptions":[{"cx":47,"cy":54}]},
      {"id":"barbarian-outpost","label":"Barbarian Outpost","standardAreas":["Barbarian Outpost"],"chunkOptions":[{"cx":39,"cy":55}]},
    ],
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
  ,
    // Source-reconciled completion destinations; Standard policy remains unchanged.
    chunkedGeography: {
      "locations": [
        {
          "id": "dimintheis-house",
          "label": "Dimintheis's house in south-east Varrock",
          "chunkOptions": [
            {
              "cx": 51,
              "cy": 53
            }
          ]
        },
        {
          "id": "witchaven",
          "label": "Witchaven",
          "chunkOptions": [
            {
              "cx": 42,
              "cy": 51
            }
          ]
        },
        {
          "id": "catherby",
          "label": "Caleb's house in Catherby",
          "chunkOptions": [
            {
              "cx": 44,
              "cy": 53
            }
          ]
        },
        {
          "id": "dwarven-mine-boot",
          "label": "Chronozon — Edgeville dungeon entrance",
          "chunkOptions": [
            {
              "cx": 48,
              "cy": 54
            }
          ]
        },
        {
          "id": "north-al-kharid",
          "label": "North Al Kharid",
          "chunkOptions": [
            {
              "cx": 51,
              "cy": 50
            }
          ]
        },
        {
          "id": "al-kharid-mine",
          "label": "Al Kharid mine",
          "chunkOptions": [
            {
              "cx": 51,
              "cy": 51
            }
          ]
        },
        {
          "id": "jolly-boar-inn",
          "label": "Jolly Boar Inn",
          "chunkOptions": [
            {
              "cx": 51,
              "cy": 54
            }
          ]
        },
        {
          "id": "boot-entrance",
          "label": "Boot — Dwarven Mine surface entrance",
          "chunkOptions": [
            {
              "cx": 47,
              "cy": 53
            }
          ]
        }
      ],
      "groups": [],
      "unknowns": [
        "Perfect gold must be smelted and crafted at a legal furnace; the example Al Kharid furnace is not a universal mandatory destination, and alternative furnace access has not been modeled."
      ]
    },
  },
  'Tribal Totem': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"brimhaven","label":"Brimhaven","standardAreas":["Brimhaven"],"chunkOptions":[{"cx":43,"cy":49}]},
      {"id":"ardougne-depot-and-mansion","label":"Ardougne depot and mansion","standardAreas":["East Ardougne"],"chunkOptions":[{"cx":41,"cy":51}]},
    ],
    id: 'Tribal Totem', name: 'Tribal Totem',
    regions: ['Brimhaven', 'East Ardougne'],
    skills: { 'Thieving': 21 }, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Fishing Contest': {
    kind: 'quest', accessPolicy: "regions",
    id: 'Fishing Contest', name: 'Fishing Contest',
    regions: ['Hemenster'],
    skills: { 'Fishing': 10 }, prereqs: [], points: 1,
    chunkedGeography: {"locations":[{"id":"white-wolf-mountain-dwarf","label":"White Wolf Mountain dwarves","chunkOptions":[{"cx":44,"cy":54}]},{"id":"mcgrubor-s-wood","label":"McGrubor's Wood","chunkOptions":[{"cx":41,"cy":54}]},{"id":"hemenster-contest","label":"Hemenster contest","chunkOptions":[{"cx":41,"cy":53}]}],"groups":[],"unknowns":[]},
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
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"ardougne-flying-horse-inn","label":"Ardougne Flying Horse Inn","standardAreas":["East Ardougne"],"chunkOptions":[{"cx":40,"cy":51}]},
      {"id":"temple-of-ikov-entrance","label":"Temple of Ikov entrance","standardAreas":["Hemenster"],"chunkOptions":[{"cx":41,"cy":53}]},
      {"id":"lucien-house","label":"Lucien house","standardAreas":["Edgeville"],"chunkOptions":[{"cx":48,"cy":54}]},
    ],
    id: 'Temple of Ikov', name: 'Temple of Ikov',
    regions: ['Hemenster'],
    skills: { 'Thieving': 42 }, prereqs: [], points: 1, series: 'Mahjarrat',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Clock Tower': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"clock-tower","label":"Clock Tower","standardAreas":["East Ardougne"],"chunkOptions":[{"cx":40,"cy":50}]},
    ],
    id: 'Clock Tower', name: 'Clock Tower',
    regions: ['East Ardougne'],
    skills: {}, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Holy Grail': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"camelot-castle","label":"Camelot Castle","standardAreas":["Camelot"],"chunkOptions":[{"cx":43,"cy":54}]},
      {"id":"camelot-staircase","label":"Camelot staircase","standardAreas":["Camelot"],"chunkOptions":[{"cx":42,"cy":54}]},
      {"id":"entrana-church","label":"Entrana church","standardAreas":["Entrana"],"chunkOptions":[{"cx":44,"cy":52}]},
      {"id":"galahad-s-house","label":"Galahad's house","standardAreas":["Seers' Village"],"chunkOptions":[{"cx":40,"cy":54}]},
      {"id":"draynor-manor","label":"Draynor Manor","standardAreas":["Draynor Village"],"chunkOptions":[{"cx":48,"cy":52}]},
      {"id":"goblin-village","label":"Goblin Village","standardAreas":["Goblin Village"],"chunkOptions":[{"cx":46,"cy":54}]},
      {"id":"fisher-realm-entrance","label":"Fisher Realm entrance","standardAreas":["Brimhaven"],"chunkOptions":[{"cx":42,"cy":50}]},
    ],
    id: 'Holy Grail', name: 'Holy Grail',
    regions: ['Camelot', 'Seers\' Village', 'Entrana', 'Goblin Village', 'Draynor Village', 'Brimhaven'],
    skills: { 'Attack': 20 }, prereqs: ['Merlin\'s Crystal'], points: 2, series: 'Camelot',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Tree Gnome Village': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"khazard-battlefield","label":"Khazard battlefield","standardAreas":["Port Khazard"],"chunkOptions":[{"cx":39,"cy":50}]},
      {"id":"tree-gnome-village","label":"Tree Gnome Village","standardAreas":["Gnome Village"],"chunkOptions":[{"cx":39,"cy":49}]},
      {"id":"khazard-warlord","label":"Khazard warlord","standardAreas":["West Ardougne"],"chunkOptions":[{"cx":38,"cy":51}]},
    ],
    id: 'Tree Gnome Village', name: 'Tree Gnome Village',
    regions: ['Gnome Village'],
    skills: {}, prereqs: [], points: 2, series: 'Gnome',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Fight Arena': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"fight-arena","label":"Fight Arena","standardAreas":["Fight Arena"],"chunkOptions":[{"cx":40,"cy":49}]},
    ],
    id: 'Fight Arena', name: 'Fight Arena',
    regions: ['Fight Arena'],
    skills: {}, prereqs: [], points: 2, series: 'Mahjarrat',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Hazeel Cult': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"carnillean-mansion","label":"Carnillean mansion","standardAreas":["East Ardougne"],"chunkOptions":[{"cx":40,"cy":51}]},
      {"id":"cult-cave-and-valves","label":"Cult cave and valves","standardAreas":["East Ardougne"],"chunkOptions":[{"cx":40,"cy":50}]},
    ],
    id: 'Hazeel Cult', name: 'Hazeel Cult',
    regions: ['East Ardougne'],
    skills: {}, prereqs: [], points: 1, series: 'Mahjarrat',
    difficulty: DropSource.QUEST_NOVICE
  },
  'Sheep Herder': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"ardougne-church","label":"Ardougne church","standardAreas":["East Ardougne"],"chunkOptions":[{"cx":40,"cy":51}]},
      {"id":"sheep-enclosure-and-fields","label":"Sheep enclosure and fields","standardAreas":["East Ardougne"],"chunkOptions":[{"cx":40,"cy":52}]},
    ],
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
  ,
    // Source-reconciled completion destinations; Standard policy remains unchanged.
    chunkedGeography: {
      "locations": [
        {
          "id": "edmond",
          "label": "Edmond and Alrena — East Ardougne",
          "chunkOptions": [
            {
              "cx": 40,
              "cy": 52
            }
          ]
        },
        {
          "id": "martha",
          "label": "Martha — northern West Ardougne",
          "chunkOptions": [
            {
              "cx": 39,
              "cy": 52
            }
          ]
        },
        {
          "id": "plague-house",
          "label": "Plague house — West Ardougne",
          "chunkOptions": [
            {
              "cx": 39,
              "cy": 51
            }
          ]
        }
      ],
      "groups": [],
      "unknowns": []
    },
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
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"baxtorian-falls","label":"Baxtorian Falls","standardAreas":["Baxtorian Falls"],"chunkOptions":[{"cx":39,"cy":54}]},
      {"id":"hadley-s-house-and-glarial-s-tomb","label":"Hadley's house and Glarial's Tomb","standardAreas":["Baxtorian Falls"],"chunkOptions":[{"cx":39,"cy":53}]},
      {"id":"tree-gnome-village-dungeon-entrance","label":"Tree Gnome Village dungeon entrance","standardAreas":["Gnome Village"],"chunkOptions":[{"cx":39,"cy":49}]},
    ],
    id: 'Waterfall Quest', name: 'Waterfall Quest',
    regions: ['Gnome Village', 'Baxtorian Falls'],
    skills: {}, prereqs: [], points: 1, series: 'Elf',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Biohazard': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"elena-house","label":"Elena house","standardAreas":["East Ardougne"],"chunkOptions":[{"cx":40,"cy":52}]},
      {"id":"jerico-and-ardougne-castle","label":"Jerico and Ardougne Castle","standardAreas":["East Ardougne"],"chunkOptions":[{"cx":40,"cy":51}]},
      {"id":"west-ardougne","label":"West Ardougne","standardAreas":["West Ardougne"],"chunkOptions":[{"cx":39,"cy":51}]},
      {"id":"mourner-headquarters-yard","label":"Mourner headquarters yard","standardAreas":["West Ardougne"],"chunkOptions":[{"cx":39,"cy":52}]},
      {"id":"rimmington-chemist","label":"Rimmington chemist","standardAreas":["Rimmington"],"chunkOptions":[{"cx":45,"cy":50}]},
      {"id":"guidor-and-dancing-donkey","label":"Guidor and Dancing Donkey","standardAreas":["Varrock"],"chunkOptions":[{"cx":51,"cy":52}]},
    ],
    id: 'Biohazard', name: 'Biohazard',
    regions: ['East Ardougne', 'West Ardougne', 'Rimmington', 'Varrock'],
    skills: {}, prereqs: ['Plague City'], points: 3, series: 'Elf',
    difficulty: DropSource.QUEST_NOVICE
  },
  'Jungle Potion': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"location-1","label":"Trufitus","standardAreas":["Tai Bwo Wannai"],"chunkOptions":[{"cx":43,"cy":48}]},
      {"id":"location-2","label":"Snake weed and sito foil","standardAreas":["Tai Bwo Wannai"],"chunkOptions":[{"cx":43,"cy":47}]},
      {"id":"location-3","label":"Ardrigal and cave entrance","standardAreas":["Tai Bwo Wannai"],"chunkOptions":[{"cx":44,"cy":48}]},
      {"id":"location-4","label":"Volencia moss","standardAreas":["Shilo Village"],"chunkOptions":[{"cx":44,"cy":47}]},
    ],
    id: 'Jungle Potion', name: 'Jungle Potion',
    regions: ['Tai Bwo Wannai'],
    skills: { 'Herblore': 3 }, prereqs: ['Druidic Ritual'], points: 1,
    difficulty: DropSource.QUEST_NOVICE
  },
  'The Grand Tree': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"grand-tree-and-glough-house","label":"Grand Tree and Glough house","standardAreas":["Tree Gnome Stronghold"],"chunkOptions":[{"cx":38,"cy":54}]},
      {"id":"hazelmere-island","label":"Hazelmere island","standardAreas":["Feldip Hills"],"chunkOptions":[{"cx":41,"cy":48}]},
      {"id":"karamja-shipyard","label":"Karamja Shipyard","standardAreas":["Ship Yard"],"chunkOptions":[{"cx":46,"cy":47}]},
      {"id":"anita-house","label":"Anita house","standardAreas":["Tree Gnome Stronghold"],"chunkOptions":[{"cx":37,"cy":54}]},
    ],
    id: 'The Grand Tree', name: 'The Grand Tree',
    regions: ['Tree Gnome Stronghold', 'Feldip Hills', 'Ship Yard'],
    skills: { 'Agility': 25 }, prereqs: [], points: 5, series: 'Gnome',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Shilo Village': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"shilo-village-and-ah-za-rhoon-entrance","label":"Shilo Village and Ah Za Rhoon entrance","standardAreas":["Shilo Village"],"chunkOptions":[{"cx":45,"cy":46}]},
      {"id":"tai-bwo-wannai","label":"Tai Bwo Wannai","standardAreas":["Tai Bwo Wannai"],"chunkOptions":[{"cx":43,"cy":48}]},
      {"id":"cairn-isle-tomb-entrance","label":"Cairn Isle tomb entrance","standardAreas":["Shilo Village"],"chunkOptions":[{"cx":43,"cy":46}]},
      {"id":"rashiliyia-tomb-entrance","label":"Rashiliyia tomb entrance","standardAreas":["Tai Bwo Wannai"],"chunkOptions":[{"cx":45,"cy":48}]},
    ],
    id: 'Shilo Village', name: 'Shilo Village',
    regions: ['Shilo Village', 'Tai Bwo Wannai'],
    skills: { 'Crafting': 20, 'Agility': 32 }, prereqs: ['Jungle Potion'], points: 2,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Underground Pass': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"east-ardougne-castle","label":"East Ardougne Castle","standardAreas":["East Ardougne"],"chunkOptions":[{"cx":40,"cy":51}]},
      {"id":"underground-pass-entrance","label":"Underground Pass entrance","standardAreas":["West Ardougne"],"chunkOptions":[{"cx":38,"cy":51}]},
    ],
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
    kind: 'quest', accessPolicy: "regions",

    id: 'The Tourist Trap', name: 'The Tourist Trap',
    regions: ['Bedabin Camp', 'Shantay Pass'],
    skills: { 'Fletching': 10, 'Smithing': 20 }, prereqs: [], points: 2,
    chunkedGeography: {"locations":[{"id":"shantay-pass","label":"Shantay Pass","chunkOptions":[{"cx":51,"cy":48}]},{"id":"desert-mining-camp","label":"Desert Mining Camp","chunkOptions":[{"cx":51,"cy":47}]},{"id":"bedabin-camp","label":"Bedabin Camp","chunkOptions":[{"cx":49,"cy":47}]}],"groups":[],"unknowns":[]},
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Watchtower': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"watchtower-and-yanille-ogres","label":"Watchtower and Yanille ogres","standardAreas":["Yanille"],"chunkOptions":[{"cx":39,"cy":48}]},
      {"id":"southern-gu-tanoth-tunnel-entrance","label":"Southern Gu Tanoth tunnel entrance","standardAreas":["Feldip Hills"],"chunkOptions":[{"cx":39,"cy":46}]},
      {"id":"gu-tanoth-island","label":"Gu Tanoth island","standardAreas":["Feldip Hills"],"chunkOptions":[{"cx":40,"cy":47}]},
      {"id":"gu-tanoth-and-skavid-cave-entrances","label":"Gu Tanoth and Skavid cave entrances","standardAreas":["Feldip Hills"],"chunkOptions":[{"cx":39,"cy":47}]},
    ],
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
  ,
    // Source-reconciled completion destinations; Standard policy remains unchanged.
    chunkedGeography: {
      "locations": [
        {
          "id": "coal-truck-mine",
          "label": "Coal Truck Mine",
          "chunkOptions": [
            {
              "cx": 40,
              "cy": 54
            }
          ]
        },
        {
          "id": "baxtorian-falls",
          "label": "Baxtorian Falls",
          "chunkOptions": [
            {
              "cx": 39,
              "cy": 54
            }
          ]
        },
        {
          "id": "asgarnian-road",
          "label": "Asgarnian road by the Dwarven Mine",
          "chunkOptions": [
            {
              "cx": 47,
              "cy": 53
            }
          ]
        },
        {
          "id": "watchtower-cave",
          "label": "Watchtower and goblin cave entrance",
          "chunkOptions": [
            {
              "cx": 40,
              "cy": 53
            }
          ]
        }
      ],
      "groups": [],
      "unknowns": []
    },
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
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"exam-centre","label":"Exam Centre","standardAreas":["Digsite"],"chunkOptions":[{"cx":52,"cy":52}]},
      {"id":"varrock-museum","label":"Varrock Museum","standardAreas":["Varrock"],"chunkOptions":[{"cx":50,"cy":53}]},
      {"id":"digsite","label":"Digsite","standardAreas":["Digsite"],"chunkOptions":[{"cx":52,"cy":53}]},
    ],
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
    kind: 'quest', accessPolicy: "regions",
    id: 'Legends\' Quest', name: 'Legends\' Quest',
    regions: ['Legends\' Guild', 'Kharazi Jungle', 'Tai Bwo Wannai'],
    skills: { 'Quest Points': 107, 'Herblore': 45, 'Prayer': 42, 'Strength': 50, 'Agility': 50, 'Thieving': 50, 'Crafting': 50, 'Smithing': 50, 'Mining': 52, 'Woodcutting': 50, 'Magic': 56 },
    prereqs: ['Family Crest', 'Heroes\' Quest', 'Shilo Village', 'Underground Pass', 'Waterfall Quest'], points: 4,
    chunkedGeography: {"locations":[{"id":"legends-guild","label":"Legends' Guild","chunkOptions":[{"cx":42,"cy":52}]},{"id":"kharazi-western-caves","label":"Kharazi western caves","chunkOptions":[{"cx":43,"cy":45}]},{"id":"kharazi-centre","label":"Kharazi centre","chunkOptions":[{"cx":44,"cy":45}]},{"id":"kharazi-east","label":"Kharazi east","chunkOptions":[{"cx":45,"cy":45},{"cx":46,"cy":45}]}],"groups":[{"id":"facility-0","label":"Gold bowl anvil","routes":[{"id":"facility-0-reviewed","label":"Reviewed anvil destinations","locations":[{"id":"facility-0-destination","label":"Gold bowl anvil","chunkOptions":[{"cx":50,"cy":53}]}]},{"id":"facility-0-other","label":"Another compatible anvil","locations":[],"unknowns":["Access to another compatible anvil needs source review"]}]}],"unknowns":[]},
    difficulty: DropSource.QUEST_MASTER
  },
  'Big Chompy Bird Hunting': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"location-1","label":"Rantz and hunting clearing","standardAreas":["Feldip Hills"],"chunkOptions":[{"cx":41,"cy":46}]},
      {"id":"location-2","label":"Feldip swamp bubbles","standardAreas":["Feldip Hills"],"chunkOptions":[{"cx":40,"cy":46}]},
    ],
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
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"burthorpe","label":"Burthorpe","standardAreas":["Burthorpe"],"chunkOptions":[{"cx":45,"cy":55}]},
      {"id":"troll-arena","label":"Troll Arena","standardAreas":["Burthorpe"],"chunkOptions":[{"cx":45,"cy":56}]},
      {"id":"troll-stronghold-entrance","label":"Troll Stronghold entrance","standardAreas":["Burthorpe"],"chunkOptions":[{"cx":44,"cy":57}]},
    ],
    id: 'Troll Stronghold', name: 'Troll Stronghold',
    regions: ['Burthorpe'],
    skills: { 'Agility': 15 }, prereqs: ['Death Plateau'], points: 1, series: 'Troll',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Tai Bwo Wannai Trio': {
    kind: 'quest', accessPolicy: "regions",
    id: 'Tai Bwo Wannai Trio', name: 'Tai Bwo Wannai Trio',
    regions: ['Tai Bwo Wannai', 'Shilo Village', 'Brimhaven', 'Musa Point'],
    skills: { 'Agility': 15, 'Cooking': 30, 'Fishing': 5 }, prereqs: ['Jungle Potion'], points: 2,
    chunkedGeography: {"locations":[{"id":"candidate-1","label":"Timfraku","chunkOptions":[{"cx":43,"cy":48}]},{"id":"candidate-2","label":"Tiadeche","chunkOptions":[{"cx":45,"cy":48}]},{"id":"candidate-3","label":"Tamayu","chunkOptions":[{"cx":44,"cy":47}]},{"id":"candidate-4","label":"Tinsay","chunkOptions":[{"cx":43,"cy":46}]}],"groups":[],"unknowns":["Quest-specific acquisition choices"]},
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Regicide': {
    kind: 'quest', accessPolicy: "regions",
    id: 'Regicide', name: 'Regicide',
    regions: ['Tyras Camp', 'Iorwerth Camp', 'Isafdar', 'Arandar', 'East Ardougne', 'West Ardougne'],
    skills: { 'Agility': 56, 'Crafting': 10 }, prereqs: ['Underground Pass'], points: 3,
    chunkedGeography: {"locations":[{"id":"candidate-1","label":"Ardougne Castle","chunkOptions":[{"cx":40,"cy":51}]},{"id":"candidate-2","label":"Iorwerth Camp","chunkOptions":[{"cx":34,"cy":50}]},{"id":"candidate-3","label":"Tracker","chunkOptions":[{"cx":35,"cy":49}]},{"id":"candidate-4","label":"Tar swamp","chunkOptions":[{"cx":35,"cy":48}]},{"id":"candidate-5","label":"Chemist","chunkOptions":[{"cx":45,"cy":50}]},{"id":"underground-pass","label":"Underground Pass entrance","chunkOptions":[{"cx":38,"cy":51}]},{"id":"tyras-camp","label":"Tyras Camp","chunkOptions":[{"cx":34,"cy":49}]},{"id":"well-of-voyage-exit","label":"Well of Voyage surface exit","chunkOptions":[{"cx":36,"cy":50}]}],"groups":[{"id":"facility-0","label":"Quicklime furnace access","routes":[{"id":"facility-0-reviewed","label":"Reviewed furnace destinations","locations":[{"id":"facility-0-destination","label":"Quicklime furnace access","chunkOptions":[{"cx":50,"cy":50},{"cx":46,"cy":52}]}]},{"id":"facility-0-other","label":"Another compatible furnace","locations":[],"unknowns":["Access to another compatible furnace needs source review"]}]}],"unknowns":[]},
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Eadgar\'s Ruse': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"location-1","label":"Sanfew and Tegid","standardAreas":["Taverley"],"chunkOptions":[{"cx":45,"cy":53}]},
      {"id":"location-2","label":"Eadgar cave and thistle","standardAreas":["Burthorpe"],"chunkOptions":[{"cx":45,"cy":57}]},
      {"id":"location-3","label":"Troll Stronghold","standardAreas":["Burthorpe"],"chunkOptions":[{"cx":44,"cy":57}]},
      {"id":"location-4","label":"Ardougne Zoo parrot","standardAreas":["East Ardougne"],"chunkOptions":[{"cx":40,"cy":51}]},
    ],
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
    kind: 'quest', accessPolicy: "regions",
    id: 'The Fremennik Trials', name: 'The Fremennik Trials',
    regions: ['Rellekka'],
    skills: {}, prereqs: [], points: 3,
    chunkedGeography: {"locations":[{"id":"rellekka-trials","label":"Rellekka trials","chunkOptions":[{"cx":41,"cy":57}]},{"id":"fossegrimen-altar-and-council-workman","label":"Fossegrimen altar and council workman","chunkOptions":[{"cx":41,"cy":56}]},{"id":"seers-low-alcohol-keg","label":"Seers low alcohol keg","chunkOptions":[{"cx":42,"cy":54}]}],"groups":[{"id":"obtain-lyre","label":"Obtain an unenchanted lyre","routes":[{"id":"resident-drop","label":"resident-drop","locations":[{"id":"rellekka-lyre-drop","label":"Rellekka lyre-bearing residents","chunkOptions":[{"cx":41,"cy":57}]}],"unknowns":["Legal combat/drop acquisition from Lanzig, Borrokar, Lensa or Freidir"]},{"id":"craft-lyre","label":"craft-lyre","locations":[{"id":"swaying-tree","label":"Swaying tree","chunkOptions":[{"cx":42,"cy":56}]},{"id":"lalli","label":"Lalli","chunkOptions":[{"cx":43,"cy":56}]}],"unknowns":["40 Woodcutting, 40 Crafting, 25 Fletching and legal corresponding methods; usable spinning wheel (Rellekka wheel is unavailable before completion)"]}]}],"unknowns":["Reach the Draugen encounter"]}, series: 'Fremennik',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Horror from the Deep': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"lighthouse-entrance","label":"Lighthouse entrance","standardAreas":["Lighthouse"],"chunkOptions":[{"cx":39,"cy":56}]},
      {"id":"lighthouse-bridge","label":"Lighthouse bridge","standardAreas":["Lighthouse"],"chunkOptions":[{"cx":40,"cy":56}]},
      {"id":"barbarian-agility-course","label":"Barbarian agility course","standardAreas":["Barbarian Outpost"],"chunkOptions":[{"cx":39,"cy":55}]},
    ],
    id: 'Horror from the Deep', name: 'Horror from the Deep',
    regions: ['Lighthouse'],
    skills: { 'Agility': 35 }, prereqs: ["Alfred Grimhand's Barcrawl"], points: 2,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Throne of Miscellania': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"miscellania-castle","label":"Miscellania Castle","standardAreas":["Miscellania & Etceteria"],"chunkOptions":[{"cx":39,"cy":60}]},
      {"id":"etceteria-castle","label":"Etceteria Castle","standardAreas":["Miscellania & Etceteria"],"chunkOptions":[{"cx":40,"cy":60}]},
    ],
    id: 'Throne of Miscellania', name: 'Throne of Miscellania',
    regions: ['Miscellania & Etceteria'],
    skills: {}, prereqs: ['The Fremennik Trials', 'Heroes\' Quest'], points: 1, series: 'Miscellania',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Monkey Madness I': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"grand-tree","label":"Grand Tree","standardAreas":["Tree Gnome Stronghold"],"chunkOptions":[{"cx":38,"cy":54}]},
      {"id":"karamja-ship-yard","label":"Karamja Ship Yard","standardAreas":["Ship Yard"],"chunkOptions":[{"cx":46,"cy":47}]},
      {"id":"crash-island","label":"Crash Island","standardAreas":["Ape Atoll"],"chunkOptions":[{"cx":45,"cy":42}]},
      {"id":"ape-atoll-valley","label":"Ape Atoll valley","standardAreas":["Ape Atoll"],"chunkOptions":[{"cx":42,"cy":42}]},
      {"id":"marim","label":"Marim","standardAreas":["Ape Atoll"],"chunkOptions":[{"cx":43,"cy":43}]},
      {"id":"ape-atoll-dungeon-entrance","label":"Ape Atoll dungeon entrance","standardAreas":["Ape Atoll"],"chunkOptions":[{"cx":43,"cy":42}]},
      {"id":"monkey-child","label":"Monkey child","standardAreas":["Ape Atoll"],"chunkOptions":[{"cx":42,"cy":43}]},
      {"id":"ardougne-zoo","label":"Ardougne Zoo","standardAreas":["East Ardougne"],"chunkOptions":[{"cx":40,"cy":51}]},
    ],
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
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"location-1","label":"Troll Stronghold entrance","standardAreas":["Burthorpe"],"chunkOptions":[{"cx":44,"cy":57}]},
      {"id":"location-2","label":"Tenzing","standardAreas":["Warriors' Guild"],"chunkOptions":[{"cx":44,"cy":55}]},
      {"id":"location-3","label":"Dunstan","standardAreas":["Burthorpe"],"chunkOptions":[{"cx":45,"cy":55}]},
      {"id":"location-4","label":"Trollweiss cave entrance","standardAreas":["Mountain Camp"],"chunkOptions":[{"cx":44,"cy":58}]},
      {"id":"location-5","label":"Trollweiss sled slope and flowers","standardAreas":["Mountain Camp"],"chunkOptions":[{"cx":43,"cy":59}]},
    ],
    id: 'Troll Romance', name: 'Troll Romance',
    regions: ['Burthorpe', 'Warriors\' Guild'],
    skills: { 'Agility': 28 }, prereqs: ['Troll Stronghold'], points: 2,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'In Search of the Myreque': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"canifis","label":"Canifis","standardAreas":["Canifis"],"chunkOptions":[{"cx":54,"cy":54}]},
      {"id":"mort-ton-boat","label":"Mort'ton boat","standardAreas":["Mort'ton"],"chunkOptions":[{"cx":55,"cy":51}]},
      {"id":"myreque-bridge-and-hideout-entrance","label":"Myreque bridge and hideout entrance","standardAreas":["Mort Myre Swamp"],"chunkOptions":[{"cx":54,"cy":53}]},
    ],
    id: 'In Search of the Myreque', name: 'In Search of the Myreque',
    regions: ['Canifis', 'Mort Myre Swamp', 'Barrows'],
    skills: { 'Agility': 25 }, prereqs: ['Nature Spirit'], points: 2, series: 'Myreque',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Creature of Fenkenstrain': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"canifis-tavern","label":"Canifis tavern","standardAreas":["Canifis"],"chunkOptions":[{"cx":54,"cy":54}]},
      {"id":"fenkenstrain-castle-and-experiment-entrance","label":"Fenkenstrain castle and experiment entrance","standardAreas":["Fenkenstrain's Castle"],"chunkOptions":[{"cx":55,"cy":55}]},
      {"id":"haunted-woods-grave","label":"Haunted Woods grave","standardAreas":["Haunted Woods"],"chunkOptions":[{"cx":56,"cy":54}]},
      {"id":"mausoleum-graves","label":"Mausoleum graves","standardAreas":["Fenkenstrain's Castle"],"chunkOptions":[{"cx":54,"cy":55}]},
    ],
    id: 'Creature of Fenkenstrain', name: 'Creature of Fenkenstrain',
    regions: ['Canifis', 'Fenkenstrain\'s Castle', 'Haunted Woods'],
    skills: { 'Crafting': 20, 'Thieving': 25 }, prereqs: ["Priest in Peril"],
    manualRequirements: ["Started The Restless Ghost"], points: 2,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Roving Elves': {
    kind: 'quest', accessPolicy: "regions",
    id: 'Roving Elves', name: 'Roving Elves',
    regions: ['Tyras Camp', 'Isafdar', 'Baxtorian Falls'],
    skills: {}, prereqs: ['Regicide', 'Waterfall Quest'], points: 1,
    chunkedGeography: {"locations":[{"id":"glarial-s-tomb","label":"Glarial's Tomb","chunkOptions":[{"cx":39,"cy":53}]},{"id":"baxtorian-falls","label":"Baxtorian Falls","chunkOptions":[{"cx":39,"cy":54}]}],"groups":[{"id":"roving-elf-camp","label":"Islwyn and Eluned camp","routes":[{"id":"route-1","label":"Route 1","locations":[{"id":"tyras-clearing","label":"Tyras clearing","chunkOptions":[{"cx":34,"cy":49}]}],"unknowns":[]},{"id":"route-2","label":"Route 2","locations":[{"id":"south-isafdar-camp","label":"South Isafdar camp","chunkOptions":[{"cx":35,"cy":49}]}],"unknowns":[]}]}],"unknowns":[]}, series: 'Elf',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Ghosts Ahoy': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"ectofuntus-stairs","label":"Ectofuntus staircase","standardAreas":["Port Phasmatys"],"chunkOptions":[{"cx":57,"cy":55}]},
      {"id":"port-phasmatys","label":"Port Phasmatys","standardAreas":["Port Phasmatys"],"chunkOptions":[{"cx":57,"cy":54}]},
      {"id":"old-crone-s-house","label":"Old Crone's house","standardAreas":["Fenkenstrain's Castle"],"chunkOptions":[{"cx":54,"cy":55}]},
      {"id":"shipwreck","label":"Shipwreck","standardAreas":["Port Phasmatys"],"chunkOptions":[{"cx":56,"cy":55}]},
      {"id":"dragontooth-island","label":"Dragontooth Island","standardAreas":["Dragontooth Island"],"chunkOptions":[{"cx":59,"cy":55}]},
    ],
    id: 'Ghosts Ahoy', name: 'Ghosts Ahoy',
    regions: ['Port Phasmatys', 'Fenkenstrain\'s Castle'],
    skills: { 'Agility': 25, 'Cooking': 20 }, prereqs: ['Priest in Peril', 'The Restless Ghost'], points: 2,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'One Small Favour': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"shilo-village","label":"Shilo Village","standardAreas":["Shilo Village"],"chunkOptions":[{"cx":44,"cy":46}]},
      {"id":"kharazi-forester","label":"Kharazi forester","standardAreas":["Kharazi Jungle"],"chunkOptions":[{"cx":44,"cy":45}]},
      {"id":"port-sarim","label":"Port Sarim","standardAreas":["Port Sarim"],"chunkOptions":[{"cx":47,"cy":50}]},
      {"id":"draynor-village","label":"Draynor Village","standardAreas":["Draynor Village"],"chunkOptions":[{"cx":48,"cy":50}]},
      {"id":"h-a-m-hideout-entrance","label":"H.A.M. hideout entrance","standardAreas":["Lumbridge"],"chunkOptions":[{"cx":49,"cy":50}]},
      {"id":"fred-s-farm","label":"Fred's farm","standardAreas":["Lumbridge"],"chunkOptions":[{"cx":49,"cy":51}]},
      {"id":"seth-s-farm","label":"Seth's farm","standardAreas":["Lumbridge"],"chunkOptions":[{"cx":50,"cy":51}]},
      {"id":"varrock-armour-shop","label":"Varrock armour shop","standardAreas":["Varrock"],"chunkOptions":[{"cx":50,"cy":53}]},
      {"id":"varrock-apothecary","label":"Varrock Apothecary","standardAreas":["Varrock"],"chunkOptions":[{"cx":49,"cy":53}]},
      {"id":"barbarian-village","label":"Barbarian Village","standardAreas":["Barbarian Village"],"chunkOptions":[{"cx":48,"cy":53}]},
      {"id":"dwarven-mine-entrance","label":"Dwarven Mine entrance","standardAreas":["Dwarven Mine"],"chunkOptions":[{"cx":47,"cy":53}]},
      {"id":"taverley","label":"Taverley","standardAreas":["Taverley"],"chunkOptions":[{"cx":45,"cy":53}]},
      {"id":"white-wolf-mountain","label":"White Wolf Mountain","standardAreas":["Taverley"],"chunkOptions":[{"cx":44,"cy":54}]},
      {"id":"catherby","label":"Catherby","standardAreas":["Catherby"],"chunkOptions":[{"cx":43,"cy":53}]},
      {"id":"seers-village","label":"Seers' Village","standardAreas":["Seers' Village"],"chunkOptions":[{"cx":42,"cy":54}]},
      {"id":"goblin-cave-entrance","label":"Goblin cave entrance","standardAreas":["Hemenster"],"chunkOptions":[{"cx":41,"cy":53}]},
      {"id":"ardougne-north-east","label":"Ardougne north-east","standardAreas":["East Ardougne"],"chunkOptions":[{"cx":41,"cy":51}]},
      {"id":"port-khazard","label":"Port Khazard","standardAreas":["Port Khazard"],"chunkOptions":[{"cx":41,"cy":49}]},
      {"id":"rantz-s-clearing","label":"Rantz's clearing","standardAreas":["Feldip Hills"],"chunkOptions":[{"cx":41,"cy":46}]},
      {"id":"feldip-gnome-glider","label":"Feldip gnome glider","standardAreas":["Feldip Hills"],"chunkOptions":[{"cx":39,"cy":46}]},
    ],
    id: 'One Small Favour', name: 'One Small Favour',
    regions: ['Feldip Hills', 'Port Khazard', 'East Ardougne', 'Seers\' Village', 'Catherby', 'Kharazi Jungle', 'Shilo Village', 'Taverley', 'Port Sarim', 'Falador', 'Draynor Village', 'Lumbridge', 'Varrock'],
    skills: { 'Agility': 36, 'Crafting': 25, 'Herblore': 18, 'Smithing': 30 }, prereqs: ['Rune Mysteries', 'Shilo Village'], points: 2,
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Mountain Daughter': {
    kind: 'quest', accessPolicy: "regions",

    id: 'Mountain Daughter', name: 'Mountain Daughter',
    regions: ['Mountain Camp'],
    oneOf: [{ regions: ['Taverley'] }, { regions: ['Catherby'] }],
    skills: { 'Agility': 20 }, prereqs: [], points: 2,
    chunkedGeography: {"locations":[{"id":"mountain-camp","label":"Mountain Camp","chunkOptions":[{"cx":43,"cy":57}]},{"id":"svidi-forest","label":"Svidi forest","chunkOptions":[{"cx":42,"cy":57}]},{"id":"rellekka-longhall","label":"Rellekka longhall","chunkOptions":[{"cx":41,"cy":57}]},{"id":"white-wolf-mountain-bushes","label":"White Wolf Mountain bushes","chunkOptions":[{"cx":44,"cy":54}]}],"groups":[],"unknowns":[]},
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Between a Rock...': {
    kind: 'quest', accessPolicy: "regions",
    id: 'Between a Rock...', name: 'Between a Rock...',
    regions: ['Keldagrim', 'Dwarven Mine', 'Taverley'],
    skills: { 'Defence': 30, 'Mining': 40, 'Smithing': 50 }, prereqs: ['Dwarf Cannon', 'Fishing Contest'], points: 2,
    chunkedGeography: {"locations":[{"id":"keldagrim-entrance","label":"Keldagrim entrance","chunkOptions":[{"cx":42,"cy":58}]},{"id":"rolad-and-dwarven-mine","label":"Rolad and Dwarven Mine","chunkOptions":[{"cx":47,"cy":53}]},{"id":"white-wolf-mountain-tunnel","label":"White Wolf Mountain tunnel","chunkOptions":[{"cx":44,"cy":54}]}],"groups":[{"id":"facility-0","label":"Gold cannonball furnace","routes":[{"id":"facility-0-reviewed","label":"Reviewed furnace destinations","locations":[{"id":"facility-0-destination","label":"Gold cannonball furnace","chunkOptions":[{"cx":50,"cy":50},{"cx":46,"cy":52}]}]},{"id":"facility-0-other","label":"Another compatible furnace","locations":[],"unknowns":["Access to another compatible furnace needs source review"]}]}],"unknowns":[]},
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'The Feud': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"al-kharid","label":"Al Kharid","standardAreas":["Al Kharid"],"chunkOptions":[{"cx":51,"cy":50}]},
      {"id":"pollnivneach","label":"Pollnivneach","standardAreas":["Pollnivneach"],"chunkOptions":[{"cx":52,"cy":46}]},
    ],
    id: 'The Feud', name: 'The Feud',
    regions: ['Al Kharid', 'Pollnivneach'],
    skills: { 'Thieving': 30 }, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'The Golem': {
    kind: 'quest', accessPolicy: "regions",
    id: 'The Golem', name: 'The Golem',
    regions: ['Ruins of Uzer', 'Varrock'],
    skills: { 'Crafting': 20, 'Thieving': 25 }, prereqs: [], points: 1,
    chunkedGeography: {"locations":[{"id":"candidate-1","label":"Uzer","chunkOptions":[{"cx":54,"cy":48}]},{"id":"candidate-2","label":"Elissa","chunkOptions":[{"cx":52,"cy":53}]},{"id":"candidate-3","label":"Digsite Exam Centre","chunkOptions":[{"cx":52,"cy":52}]},{"id":"candidate-4","label":"Museum curator","chunkOptions":[{"cx":50,"cy":53}]}],"groups":[{"id":"museum-upstairs-route","label":"Reach the museum upstairs cabinet","routes":[{"id":"east-stairs","label":"Museum east staircase","locations":[{"id":"museum-east-stairs","label":"Museum east staircase object","chunkOptions":[{"cx":51,"cy":53}]}]},{"id":"other-stairs","label":"Another museum upstairs route","locations":[],"unknowns":["An alternative upstairs approach has not been verified"]}]}],"unknowns":[]},
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Desert Treasure I': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"bedabin-camp","label":"Bedabin Camp","standardAreas":["Bedabin Camp"],"chunkOptions":[{"cx":49,"cy":47}]},
      {"id":"digsite-exam-centre","label":"Digsite Exam Centre","standardAreas":["Digsite"],"chunkOptions":[{"cx":52,"cy":52}]},
      {"id":"bandit-camp","label":"Bandit Camp","standardAreas":["Bandit Camp"],"chunkOptions":[{"cx":49,"cy":46}]},
      {"id":"eblis-mirrors","label":"Eblis mirrors","standardAreas":["Bandit Camp"],"chunkOptions":[{"cx":50,"cy":46}]},
      {"id":"smoke-dungeon-well","label":"Smoke Dungeon well","standardAreas":["Pollnivneach"],"chunkOptions":[{"cx":51,"cy":46}]},
      {"id":"rasolo-and-shadow-dungeon-entrance","label":"Rasolo and Shadow Dungeon entrance","standardAreas":["Baxtorian Falls"],"chunkOptions":[{"cx":39,"cy":53}]},
      {"id":"canifis-tavern","label":"Canifis tavern","standardAreas":["Canifis"],"chunkOptions":[{"cx":54,"cy":54}]},
      {"id":"draynor-sewer-entrance","label":"Draynor sewer entrance","standardAreas":["Draynor Village"],"chunkOptions":[{"cx":48,"cy":51}]},
      {"id":"entrana-church","label":"Entrana church","standardAreas":["Entrana"],"chunkOptions":[{"cx":44,"cy":52}]},
      {"id":"dessous-graveyard","label":"Dessous graveyard","standardAreas":["Mort Myre Swamp"],"chunkOptions":[{"cx":55,"cy":53}]},
      {"id":"ice-gate-and-kamil","label":"Ice gate and Kamil","standardAreas":["Mountain Camp"],"chunkOptions":[{"cx":44,"cy":58}]},
      {"id":"ice-path-summit","label":"Ice Path summit","standardAreas":["Mountain Camp"],"chunkOptions":[{"cx":44,"cy":59}]},
      {"id":"jaldraocht-pyramid","label":"Jaldraocht Pyramid","standardAreas":["Bandit Camp"],"chunkOptions":[{"cx":50,"cy":45}]},
    ],
    id: 'Desert Treasure I', name: 'Desert Treasure I',
    regions: ['Bandit Camp', 'Bedabin Camp', 'Pollnivneach', 'Entrana', 'Burthorpe', 'Baxtorian Falls', 'Canifis', 'Mort Myre Swamp'],
    skills: { 'Thieving': 53, 'Firemaking': 50, 'Slayer': 10, 'Magic': 50 }, prereqs: ['The Dig Site', 'Temple of Ikov', 'The Tourist Trap', 'Troll Stronghold', 'Priest in Peril', 'Waterfall Quest'], points: 3, series: 'Mahjarrat',
    difficulty: DropSource.QUEST_MASTER
  },
  'Icthlarin\'s Little Helper': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"wanderer-s-camp","label":"Wanderer's camp","standardAreas":["Agility Pyramid"],"chunkOptions":[{"cx":51,"cy":44}]},
      {"id":"sophanem","label":"Sophanem","standardAreas":["Sophanem"],"chunkOptions":[{"cx":51,"cy":43}]},
    ],
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
  ,
    // Source-reconciled completion destinations; Standard policy remains unchanged.
    chunkedGeography: {
      "locations": [],
      "groups": [
        {
          "id": "cave-entry",
          "label": "Route to Juna",
          "routes": [
            {
              "id": "swamp",
              "label": "Lumbridge swamp cave",
              "locations": [
                {
                  "id": "swamp",
                  "label": "Lumbridge swamp cave entrance",
                  "chunkOptions": [
                    {
                      "cx": 49,
                      "cy": 49
                    }
                  ]
                }
              ]
            },
            {
              "id": "castle",
              "label": "Alternative castle route",
              "locations": [
                {
                  "id": "castle",
                  "label": "Lumbridge Castle cellar",
                  "chunkOptions": [
                    {
                      "cx": 50,
                      "cy": 50
                    }
                  ]
                }
              ],
              "unknowns": [
                "The castle route connection and required Lost Tribe progression need explicit verification."
              ]
            }
          ]
        }
      ],
      "unknowns": []
    },
  },
  'Zogre Flesh Eaters': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"jiggig-entrance","label":"Jiggig entrance","standardAreas":["Feldip Hills"],"chunkOptions":[{"cx":38,"cy":47}]},
      {"id":"east-yanille","label":"East Yanille","standardAreas":["Yanille"],"chunkOptions":[{"cx":40,"cy":48}]},
      {"id":"west-yanille-dragon-inn","label":"West Yanille Dragon Inn","standardAreas":["Yanille"],"chunkOptions":[{"cx":39,"cy":48}]},
    ],
    id: 'Zogre Flesh Eaters', name: 'Zogre Flesh Eaters',
    regions: ['Feldip Hills', 'Yanille'],
    skills: { 'Smithing': 4, 'Herblore': 8, 'Ranged': 30 }, prereqs: ['Big Chompy Bird Hunting', 'Jungle Potion'], points: 1,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'The Lost Tribe': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"lumbridge-castle","label":"Lumbridge Castle","standardAreas":["Lumbridge"],"chunkOptions":[{"cx":50,"cy":50}]},
      {"id":"varrock-castle-library","label":"Varrock Castle Library","standardAreas":["Varrock"],"chunkOptions":[{"cx":50,"cy":54}]},
      {"id":"goblin-village","label":"Goblin Village","standardAreas":["Goblin Village"],"chunkOptions":[{"cx":46,"cy":54}]},
      {"id":"ham-hideout-entrance","label":"HAM hideout entrance","standardAreas":["Lumbridge"],"chunkOptions":[{"cx":49,"cy":50}]},
    ],
    id: 'The Lost Tribe', name: 'The Lost Tribe',
    regions: ['Lumbridge', 'Varrock', 'Goblin Village'],
    skills: { 'Agility': 13, 'Mining': 17, 'Thieving': 13 }, prereqs: ['Goblin Diplomacy', 'Rune Mysteries'], points: 1, series: 'Dorgeshuun',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'The Giant Dwarf': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"keldagrim-entrance","label":"Keldagrim entrance","standardAreas":["Keldagrim"],"chunkOptions":[{"cx":42,"cy":58}]},
      {"id":"varrock-castle","label":"Varrock Castle","standardAreas":["Varrock"],"chunkOptions":[{"cx":50,"cy":54}]},
      {"id":"thurgo-s-hut","label":"Thurgo's hut","standardAreas":["Port Sarim"],"chunkOptions":[{"cx":46,"cy":49}]},
    ],
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
    kind: 'quest', accessPolicy: "regions",
    id: 'Mourning\'s End Part I', name: 'Mourning\'s End Part I',
    regions: ['Lletya', 'Tyras Camp', 'Isafdar', 'Arandar', 'West Ardougne'],
    skills: { 'Ranged': 60, 'Thieving': 50 }, prereqs: ['Roving Elves', 'Big Chompy Bird Hunting', 'Sheep Herder'], points: 2,
    chunkedGeography: {"locations":[{"id":"lletya","label":"Lletya","chunkOptions":[{"cx":36,"cy":49}]},{"id":"arandar-mourner","label":"Arandar mourner","chunkOptions":[{"cx":37,"cy":51}]},{"id":"tegid-s-laundry","label":"Tegid's laundry","chunkOptions":[{"cx":45,"cy":53}]},{"id":"mourner-headquarters","label":"Mourner Headquarters","chunkOptions":[{"cx":39,"cy":51}]},{"id":"feldip-toads","label":"Feldip toads","chunkOptions":[{"cx":40,"cy":46}]},{"id":"ardougne-sheep","label":"Ardougne sheep","chunkOptions":[{"cx":40,"cy":52}]},{"id":"rotten-apple","label":"Rotten apple","chunkOptions":[{"cx":39,"cy":52}]},{"id":"orchard-press","label":"Orchard apple press","chunkOptions":[{"cx":38,"cy":52}]}],"groups":[{"id":"roving-elf-camp","label":"Islwyn and Eluned camp","routes":[{"id":"route-1","label":"Route 1","locations":[{"id":"tyras-clearing","label":"Tyras clearing","chunkOptions":[{"cx":34,"cy":49}]}],"unknowns":[]},{"id":"route-2","label":"Route 2","locations":[{"id":"south-isafdar-camp","label":"South Isafdar camp","chunkOptions":[{"cx":35,"cy":49}]}],"unknowns":[]}]},{"id":"facility-0","label":"Toxic naphtha cooking range","routes":[{"id":"facility-0-reviewed","label":"Reviewed range destinations","locations":[{"id":"facility-0-destination","label":"Toxic naphtha cooking range","chunkOptions":[{"cx":46,"cy":50}]}]},{"id":"facility-0-other","label":"Another compatible range","locations":[],"unknowns":["Access to another compatible range needs source review"]}]}],"unknowns":[]},
    difficulty: DropSource.QUEST_MASTER
  },
  'Forgettable Tale...': {
    kind: 'quest', accessPolicy: "regions",
    id: 'Forgettable Tale...', name: 'Forgettable Tale of a Drunken Dwarf',
    regions: ['Keldagrim', 'Taverley'],
    skills: { 'Cooking': 22, 'Farming': 17 }, prereqs: ['The Giant Dwarf', 'Fishing Contest'], points: 2,
    chunkedGeography: {"locations":[],"groups":[],"unknowns":["Keldagrim entry route"]}, series: 'Red Axe',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Garden of Tranquillity': {
    kind: 'quest', accessPolicy: "regions",
    id: 'Garden of Tranquillity', name: 'Garden of Tranquillity',
    regions: ['Varrock', 'Draynor Village', 'Edgeville', 'Falador', 'Burthorpe', 'East Ardougne', 'Catherby', 'Port Phasmatys'],
    skills: { 'Farming': 25 }, prereqs: ['Creature of Fenkenstrain'], points: 2,
    chunkedGeography: {"locations":[{"id":"varrock-palace-garden","label":"Varrock Palace garden","chunkOptions":[{"cx":50,"cy":54}]},{"id":"draynor-wise-old-man","label":"Draynor Wise Old Man","chunkOptions":[{"cx":48,"cy":50}]},{"id":"falador-farming-patch","label":"Falador farming patch","chunkOptions":[{"cx":47,"cy":51}]},{"id":"port-phasmatys-farming-patch","label":"Port Phasmatys farming patch","chunkOptions":[{"cx":56,"cy":55}]},{"id":"ardougne-farming-patch","label":"Ardougne farming patch","chunkOptions":[{"cx":41,"cy":52}]},{"id":"catherby-farming-patch","label":"Catherby farming patch","chunkOptions":[{"cx":43,"cy":54}]},{"id":"white-tree-and-monastery","label":"White tree and Monastery","chunkOptions":[{"cx":47,"cy":54}]},{"id":"burthorpe-bernald","label":"Burthorpe Bernald","chunkOptions":[{"cx":45,"cy":55}]},{"id":"taverley-alain","label":"Taverley Alain","chunkOptions":[{"cx":45,"cy":53}]},{"id":"lumbridge-statue-and-bridge","label":"Lumbridge statue and bridge","chunkOptions":[{"cx":50,"cy":50}]},{"id":"falador-statue","label":"Falador statue","chunkOptions":[{"cx":46,"cy":52}]},{"id":"falador-north-gate-trolley-trigger","label":"Falador north gate trolley trigger","chunkOptions":[{"cx":46,"cy":53}]}],"groups":[{"id":"ring-disposal-recovery","label":"Set aside and recover the ring of charos","routes":[{"id":"well","label":"well","locations":[{"id":"edgeville-ring-well","label":"Edgeville ring well","chunkOptions":[{"cx":48,"cy":54}]}],"unknowns":[]},{"id":"destroy-and-recover","label":"destroy-and-recover","locations":[],"unknowns":["Recover a usable ring after destroying it"]}]}],"unknowns":[]},
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'A Tail of Two Cats': {
    kind: 'quest', accessPolicy: "regions",
    id: 'A Tail of Two Cats', name: 'A Tail of Two Cats',
    regions: ['Burthorpe', 'Varrock', 'Sophanem'],
    skills: {}, prereqs: ['Icthlarin\'s Little Helper'], points: 2,
    chunkedGeography: {"locations":[{"id":"candidate-1","label":"Unferth","chunkOptions":[{"cx":45,"cy":55}]},{"id":"candidate-2","label":"Gertrude","chunkOptions":[{"cx":49,"cy":53}]},{"id":"candidate-3","label":"Reldo","chunkOptions":[{"cx":50,"cy":54}]},{"id":"candidate-4","label":"Sphinx","chunkOptions":[{"cx":51,"cy":43}]},{"id":"candidate-5","label":"Apothecary","chunkOptions":[{"cx":49,"cy":53}]}],"groups":[],"unknowns":["Route evidence"]}, series: 'Dragonkin',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Wanted!': {
    kind: 'quest', accessPolicy: "regions",
    id: 'Wanted!', name: 'Wanted!',
    regions: ['Falador', 'Taverley', 'Varrock', 'Canifis'],
    skills: { 'Quest Points': 32 }, prereqs: ['Recruitment Drive', 'The Lost Tribe', 'Priest in Peril', 'Enter the Abyss'], points: 1,
    chunkedGeography: {"locations":[{"id":"candidate-1","label":"Falador Castle","chunkOptions":[{"cx":46,"cy":52}]},{"id":"candidate-2","label":"Taverley Dungeon","chunkOptions":[{"cx":45,"cy":53}]},{"id":"candidate-3","label":"Mage of Zamorak","chunkOptions":[{"cx":50,"cy":52}]},{"id":"candidate-4","label":"Canifis","chunkOptions":[{"cx":54,"cy":54}]}],"groups":[],"unknowns":["Assigned Solus clue sequence"]}, series: 'Temple Knight',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Mourning\'s End Part II': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"location-1","label":"Lletya / Arianwyn","standardAreas":["Lletya"],"chunkOptions":[{"cx":36,"cy":49}]},
      {"id":"location-2","label":"Mourner headquarters / Temple of Light passage","standardAreas":["West Ardougne"],"chunkOptions":[{"cx":39,"cy":51}]},
    ],
    id: 'Mourning\'s End Part II', name: 'Mourning\'s End Part II',
    regions: ['Lletya', 'West Ardougne'],
    skills: { 'Agility': 65 }, prereqs: ['Mourning\'s End Part I'], points: 2, series: 'Elf',
    difficulty: DropSource.QUEST_MASTER
  },
  'Rum Deal': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"location-1","label":"Pirate Pete / Braindeath Island passage","standardAreas":["Braindeath Island","Port Phasmatys"],"chunkOptions":[{"cx":57,"cy":55}]},
    ],
    id: 'Rum Deal', name: 'Rum Deal',
    regions: ['Port Phasmatys', 'Braindeath Island'],
    skills: { 'Farming': 40, 'Prayer': 47, 'Slayer': 42, 'Crafting': 42, 'Fishing': 50 }, prereqs: ['Zogre Flesh Eaters', 'Priest in Peril'], points: 2, series: 'Pirate',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Shadow of the Storm': {
    kind: 'quest', accessPolicy: "regions",
    id: 'Shadow of the Storm', name: 'Shadow of the Storm',
    regions: ['Al Kharid', 'Ruins of Uzer'],
    skills: { 'Crafting': 30 }, prereqs: ['Demon Slayer', 'The Golem'], points: 1,
    chunkedGeography: {"locations":[{"id":"candidate-1","label":"Father Reen","chunkOptions":[{"cx":51,"cy":49}]},{"id":"candidate-2","label":"Uzer ruins","chunkOptions":[{"cx":54,"cy":48}]}],"groups":[{"id":"facility-0","label":"Demonic sigil furnace access","routes":[{"id":"facility-0-reviewed","label":"Reviewed furnace destinations","locations":[{"id":"facility-0-destination","label":"Demonic sigil furnace access","chunkOptions":[{"cx":50,"cy":50},{"cx":46,"cy":52}]}]},{"id":"facility-0-other","label":"Another compatible furnace","locations":[],"unknowns":["Access to another compatible furnace needs source review"]}]}],"unknowns":[]},
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Making History': {
    kind: 'quest', accessPolicy: "regions",
    id: 'Making History', name: 'Making History',
    regions: ['Observatory', 'East Ardougne', 'Rellekka', 'Port Phasmatys'],
    skills: {}, prereqs: ['Priest in Peril', 'The Restless Ghost'], points: 3,
    chunkedGeography: {"locations":[{"id":"ardougne-market","label":"Ardougne market","chunkOptions":[{"cx":41,"cy":51}]},{"id":"castle-wars-excavation","label":"Observatory excavation","chunkOptions":[{"cx":38,"cy":49}]},{"id":"rellekka-south","label":"Rellekka south","chunkOptions":[{"cx":41,"cy":57}]},{"id":"port-phasmatys","label":"Port Phasmatys","chunkOptions":[{"cx":57,"cy":54}]},{"id":"ardougne-castle","label":"Ardougne Castle","chunkOptions":[{"cx":40,"cy":51}]},{"id":"outpost","label":"Outpost","chunkOptions":[{"cx":38,"cy":52}]}],"groups":[],"unknowns":[]},
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Ratcatchers': {
    kind: 'quest', accessPolicy: "regions",
    id: 'Ratcatchers', name: 'Ratcatchers',
    regions: ['Varrock', 'East Ardougne', 'Pollnivneach', 'Keldagrim', 'Port Sarim'],
    manualRequirements: ['Started The Giant Dwarf to access Keldagrim'],
    skills: {}, prereqs: ['Icthlarin\'s Little Helper'], points: 2,
    chunkedGeography: {"locations":[{"id":"gertrude-s-house","label":"Gertrude's house","chunkOptions":[{"cx":49,"cy":53}]},{"id":"varrock-sewer-entrance","label":"Varrock sewer entrance","chunkOptions":[{"cx":50,"cy":54}]},{"id":"ardougne","label":"Ardougne","chunkOptions":[{"cx":40,"cy":51}]},{"id":"hooknosed-jack","label":"Hooknosed Jack","chunkOptions":[{"cx":51,"cy":53}]},{"id":"jack-s-rat-building","label":"Jack's rat building","chunkOptions":[{"cx":51,"cy":52}]},{"id":"port-sarim-rat-pits","label":"Port Sarim Rat Pits","chunkOptions":[{"cx":47,"cy":50}]},{"id":"pollnivneach","label":"Pollnivneach","chunkOptions":[{"cx":52,"cy":46}]}],"groups":[{"id":"keldagrim-route","label":"Keldagrim route","routes":[{"id":"route-1","label":"Route 1","locations":[{"id":"ge-keldagrim-entrance","label":"Grand Exchange Keldagrim entrance","chunkOptions":[{"cx":49,"cy":54}]}],"unknowns":[]},{"id":"route-2","label":"Route 2","locations":[{"id":"rellekka-keldagrim-entrance","label":"Rellekka Keldagrim entrance","chunkOptions":[{"cx":42,"cy":58}]}],"unknowns":[]},{"id":"other-keldagrim-transport","label":"Other Keldagrim transport","locations":[],"unknowns":["Other Keldagrim transport"]}]}],"unknowns":[]},
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Spirits of the Elid': {
    kind: 'quest', accessPolicy: "regions",

    id: 'Spirits of the Elid', name: 'Spirits of the Elid',
    regions: ['Nardah'],
    skills: { 'Magic': 33, 'Ranged': 37, 'Mining': 37, 'Thieving': 37 }, prereqs: [], points: 2,
    chunkedGeography: {"locations":[{"id":"nardah","label":"Nardah","chunkOptions":[{"cx":53,"cy":45}]},{"id":"elid-waterfall-cave-entrance","label":"Elid waterfall cave entrance","chunkOptions":[{"cx":52,"cy":48}]},{"id":"nardah-crevice-entrance","label":"Nardah crevice entrance","chunkOptions":[{"cx":52,"cy":45}]}],"groups":[],"unknowns":[]},
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Devious Minds': {
    kind: 'quest', accessPolicy: 'regions-and-locations',
    id: 'Devious Minds', name: 'Devious Minds',
    regions: ['Paterdomus', 'Entrana', 'Falador'],
    locations: [LOCATIONS.edgevilleDitch],
    skills: { 'Smithing': 65, 'Runecraft': 50, 'Fletching': 50 }, prereqs: ['Wanted!', 'Troll Stronghold', 'Doric\'s Quest'], points: 1, series: 'Mahjarrat',
    difficulty: DropSource.QUEST_EXPERIENCED
  ,
    // Source-reconciled completion destinations; Standard policy remains unchanged.
    chunkedGeography: {
      "locations": [
        {
          "id": "monk",
          "label": "Monk — Paterdomus",
          "chunkOptions": [
            {
              "cx": 53,
              "cy": 54
            }
          ]
        },
        {
          "id": "whetstone",
          "label": "Doric’s whetstone",
          "chunkOptions": [
            {
              "cx": 46,
              "cy": 53
            }
          ]
        },
        {
          "id": "abyss-mage",
          "label": "Mage of Zamorak — Abyss entrance",
          "chunkOptions": [
            {
              "cx": 48,
              "cy": 55
            }
          ]
        },
        {
          "id": "entrana",
          "label": "Entrana church",
          "chunkOptions": [
            {
              "cx": 44,
              "cy": 52
            }
          ]
        },
        {
          "id": "tiffy",
          "label": "Sir Tiffy — Falador park",
          "chunkOptions": [
            {
              "cx": 46,
              "cy": 52
            }
          ]
        }
      ],
      "groups": [],
      "unknowns": []
    },
  },
  'The Hand in the Sand': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"location-1","label":"Bert and Yanille pub","standardAreas":["Yanille"],"chunkOptions":[{"cx":39,"cy":48}]},
      {"id":"location-2","label":"Yanille Wizards Guild","standardAreas":["Yanille"],"chunkOptions":[{"cx":40,"cy":48}]},
      {"id":"location-3","label":"Sandy office","standardAreas":["Brimhaven"],"chunkOptions":[{"cx":43,"cy":49}]},
      {"id":"location-4","label":"Betty shop","standardAreas":["Port Sarim"],"chunkOptions":[{"cx":47,"cy":50}]},
      {"id":"location-5","label":"Entrana sand pit","standardAreas":["Entrana"],"chunkOptions":[{"cx":43,"cy":52}]},
    ],
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
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"location-1","label":"Port Phasmatys inn","standardAreas":["Port Phasmatys"],"chunkOptions":[{"cx":57,"cy":54}]},
      {"id":"location-2","label":"Bill Teach ship","standardAreas":["Port Phasmatys"],"chunkOptions":[{"cx":57,"cy":54}]},
    ],
    id: 'Cabin Fever', name: 'Cabin Fever',
    regions: ['Port Phasmatys', 'Mos Le\'Harmless'],
    skills: { 'Ranged': 40, 'Smithing': 50, 'Crafting': 45, 'Agility': 42 }, prereqs: ['Pirate\'s Treasure', 'Rum Deal'], points: 2, series: 'Pirate',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Fairytale I - Growing Pains': {
    kind: 'quest', accessPolicy: "regions",
    id: 'Fairytale I - Growing Pains', name: 'Fairytale I - Growing Pains',
    regions: ['Draynor Village', 'Falador', 'Mort Myre Swamp', 'Zanaris'],
    skills: {}, prereqs: ['Lost City', 'Nature Spirit'], points: 2,
    chunkedGeography: {"locations":[{"id":"candidate-1","label":"Martin","chunkOptions":[{"cx":48,"cy":50}]},{"id":"candidate-2","label":"Zanaris entrance","chunkOptions":[{"cx":50,"cy":49}]},{"id":"candidate-3","label":"Dark Wizards Tower","chunkOptions":[{"cx":45,"cy":52}]},{"id":"candidate-4","label":"Malignius Mortifer","chunkOptions":[{"cx":46,"cy":51}]},{"id":"candidate-5","label":"Nature Grotto entrance","chunkOptions":[{"cx":53,"cy":52}]}],"groups":[],"unknowns":["Any five distinct farmers"]}, series: 'Fairy Tale',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'RFD: The Cook': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"lumbridge-castle","label":"Lumbridge Castle","standardAreas":["Lumbridge"],"chunkOptions":[{"cx":50,"cy":50}]},
    ],
    id: 'RFD: The Cook', name: 'RFD: Start (The Cook)',
    regions: ['Lumbridge'],
    skills: { 'Cooking': 10 }, prereqs: ['Cook\'s Assistant'], points: 1, series: 'Recipe for Disaster',
    difficulty: DropSource.QUEST_NOVICE
  },
  'RFD: Dwarf': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"lumbridge-castle","label":"Lumbridge Castle","standardAreas":["Lumbridge"],"chunkOptions":[{"cx":50,"cy":50}]},
      {"id":"white-wolf-tunnel","label":"White Wolf Mountain tunnel","standardAreas":["Taverley"],"chunkOptions":[{"cx":44,"cy":54}]},
    ],
    id: 'RFD: Dwarf', name: 'RFD: Dwarf',
    regions: ['Taverley', 'Falador'],
    skills: {}, prereqs: ['Fishing Contest'], points: 1, series: 'Recipe for Disaster',
    difficulty: DropSource.QUEST_NOVICE
  },
  'RFD: Goblins': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"lumbridge-castle","label":"Lumbridge Castle","standardAreas":["Lumbridge"],"chunkOptions":[{"cx":50,"cy":50}]},
      {"id":"goblin-village-kitchen-entrance","label":"Goblin Village kitchen entrance","standardAreas":["Goblin Village"],"chunkOptions":[{"cx":46,"cy":54}]},
    ],
    id: 'RFD: Goblins', name: 'RFD: Goblins',
    regions: ['Goblin Village'],
    skills: {}, prereqs: ['Goblin Diplomacy'], points: 1, series: 'Recipe for Disaster',
    difficulty: DropSource.QUEST_NOVICE
  },
  'RFD: Pirate Pete': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"lumbridge-castle","label":"Lumbridge Castle","standardAreas":["Lumbridge"],"chunkOptions":[{"cx":50,"cy":50}]},
      {"id":"port-khazard-diving-departure","label":"Port Khazard diving departure","standardAreas":["Port Khazard"],"chunkOptions":[{"cx":41,"cy":49}]},
    ],
    id: 'RFD: Pirate Pete', name: 'RFD: Pirate Pete',
    regions: ['Port Khazard'],
    skills: { 'Cooking': 31 }, prereqs: [], points: 1, series: 'Recipe for Disaster',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'RFD: Lumbridge Guide': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"location-1","label":"Lumbridge Castle dining room","standardAreas":["Lumbridge"],"chunkOptions":[{"cx":50,"cy":50}]},
      {"id":"location-2","label":"Wizards Tower","standardAreas":["Wizards' Tower"],"chunkOptions":[{"cx":48,"cy":49}]},
    ],
    id: 'RFD: Lumbridge Guide', name: 'RFD: Lumbridge Guide',
    regions: ['Wizards\' Tower'],
    skills: { 'Cooking': 40 }, prereqs: ['Big Chompy Bird Hunting', 'Biohazard', 'Demon Slayer', 'Murder Mystery', 'Nature Spirit', 'Priest in Peril', 'The Restless Ghost', 'Witch\'s House'], points: 1, series: 'Recipe for Disaster',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'RFD: Evil Dave': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"lumbridge-castle","label":"Lumbridge Castle","standardAreas":["Lumbridge"],"chunkOptions":[{"cx":50,"cy":50}]},
      {"id":"evil-dave-s-house","label":"Evil Dave's house","standardAreas":["Edgeville"],"chunkOptions":[{"cx":48,"cy":54}]},
    ],
    id: 'RFD: Evil Dave', name: 'RFD: Evil Dave',
    regions: ['Edgeville'],
    skills: { 'Cooking': 25 }, prereqs: ['Gertrude\'s Cat', 'Shadow of the Storm'], points: 1, series: 'Recipe for Disaster',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'RFD: Skrach Uglogwee': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"location-1","label":"Lumbridge Castle dining room","standardAreas":["Lumbridge"],"chunkOptions":[{"cx":50,"cy":50}]},
      {"id":"location-2","label":"Rantz and jubbly hunting","standardAreas":["Feldip Hills"],"chunkOptions":[{"cx":41,"cy":46}]},
      {"id":"location-3","label":"Karamja coast fire","standardAreas":["Tai Bwo Wannai"],"chunkOptions":[{"cx":43,"cy":48}]},
      {"id":"location-4","label":"Feldip swamp bubbles","standardAreas":["Feldip Hills"],"chunkOptions":[{"cx":40,"cy":46}]},
    ],
    id: 'RFD: Skrach Uglogwee', name: 'RFD: Skrach Uglogwee',
    regions: ['Feldip Hills', 'Tai Bwo Wannai'],
    skills: { 'Cooking': 41, 'Firemaking': 20 }, prereqs: ['Big Chompy Bird Hunting'], points: 1, series: 'Recipe for Disaster',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'RFD: Sir Amik Varze': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"lumbridge-castle","label":"Lumbridge Castle","standardAreas":["Lumbridge"],"chunkOptions":[{"cx":50,"cy":50}]},
      {"id":"draynor-village","label":"Draynor Village","standardAreas":["Draynor Village"],"chunkOptions":[{"cx":48,"cy":50}]},
      {"id":"zanaris-entrance","label":"Zanaris entrance","standardAreas":["Zanaris"],"chunkOptions":[{"cx":50,"cy":49}]},
    ],
    id: 'RFD: Sir Amik Varze', name: 'RFD: Sir Amik Varze',
    regions: ['Kharazi Jungle', 'Draynor Village', 'Zanaris'],
    skills: { 'Quest Points': 107 }, prereqs: ['Legends\' Quest'], points: 1, series: 'Recipe for Disaster',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'RFD: King Awowogei': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"lumbridge-castle","label":"Lumbridge Castle","standardAreas":["Lumbridge"],"chunkOptions":[{"cx":50,"cy":50}]},
      {"id":"marim-temple","label":"Marim temple","standardAreas":["Ape Atoll"],"chunkOptions":[{"cx":43,"cy":43}]},
      {"id":"monkey-agility-course","label":"Monkey agility course","standardAreas":["Ape Atoll"],"chunkOptions":[{"cx":43,"cy":42}]},
      {"id":"crash-island-snake-pit","label":"Crash Island snake pit","standardAreas":["Ape Atoll"],"chunkOptions":[{"cx":45,"cy":42}]},
      {"id":"red-banana-tree","label":"Red banana tree","standardAreas":["Ape Atoll"],"chunkOptions":[{"cx":42,"cy":43}]},
    ],
    id: 'RFD: King Awowogei', name: 'RFD: King Awowogei',
    regions: ['Ape Atoll'],
    skills: { 'Cooking': 70, 'Agility': 48 }, prereqs: ['Monkey Madness I'], points: 1, series: 'Recipe for Disaster',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'RFD: Finale': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"location-1","label":"Lumbridge Castle portal","standardAreas":["Lumbridge"],"chunkOptions":[{"cx":50,"cy":50}]},
    ],
    id: 'RFD: Finale', name: 'RFD: Finale',
    regions: ['Lumbridge'],
    skills: { 'Quest Points': 175 }, prereqs: ['RFD: The Cook', 'RFD: Dwarf', 'RFD: Goblins', 'RFD: Pirate Pete', 'RFD: Lumbridge Guide', 'RFD: Evil Dave', 'RFD: Skrach Uglogwee', 'RFD: Sir Amik Varze', 'RFD: King Awowogei'], points: 1, series: 'Recipe for Disaster',
    difficulty: DropSource.QUEST_MASTER
  },
  'In Aid of the Myreque': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"location-1","label":"Canifis Myreque passage","standardAreas":["Canifis"],"chunkOptions":[{"cx":54,"cy":54}]},
      {"id":"location-2","label":"Burgh de Rott village","standardAreas":["Burgh de Rott"],"chunkOptions":[{"cx":54,"cy":50}]},
      {"id":"location-3","label":"Burgh de Rott furnace","standardAreas":["Burgh de Rott"],"chunkOptions":[{"cx":55,"cy":50}]},
      {"id":"location-4","label":"Paterdomus entrance","standardAreas":["Paterdomus"],"chunkOptions":[{"cx":53,"cy":54}]},
    ],
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
    kind: 'quest', accessPolicy: "regions",
    id: 'Rag and Bone Man I', name: 'Rag and Bone Man I',
    regions: ['Draynor Village'],
    skills: {}, prereqs: [], points: 1,
    chunkedGeography: {"locations":[{"id":"candidate-1","label":"Odd Old Man","chunkOptions":[{"cx":52,"cy":54}]},{"id":"candidate-2","label":"Fortunato","chunkOptions":[{"cx":48,"cy":50}]}],"groups":[],"unknowns":["Eight required bone species"]}, series: 'Rag and Bone Man',
    difficulty: DropSource.QUEST_NOVICE
  },
  'Swan Song': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"piscatoris-fishing-colony","label":"Piscatoris Fishing Colony","standardAreas":["Piscatoris Fishing Colony"],"chunkOptions":[{"cx":36,"cy":57}]},
      {"id":"draynor-village","label":"Draynor Village","standardAreas":["Draynor Village"],"chunkOptions":[{"cx":48,"cy":50}]},
      {"id":"wizards-guild-basement","label":"Wizards' Guild basement","standardAreas":["Yanille"],"chunkOptions":[{"cx":40,"cy":48}]},
      {"id":"malignius-mortifer","label":"Malignius Mortifer","standardAreas":["Falador"],"chunkOptions":[{"cx":46,"cy":51}]},
      {"id":"crafting-guild","label":"Crafting Guild","standardAreas":["Crafting Guild"],"chunkOptions":[{"cx":45,"cy":51}]},
    ],
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
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"lumbridge-castle-and-caves","label":"Lumbridge Castle and caves","standardAreas":["Lumbridge"],"chunkOptions":[{"cx":50,"cy":50}]},
      {"id":"h-a-m-hideout-entrance","label":"H.A.M. hideout entrance","standardAreas":["Lumbridge"],"chunkOptions":[{"cx":49,"cy":50}]},
      {"id":"mill-trapdoor","label":"Mill trapdoor","standardAreas":["Lumbridge"],"chunkOptions":[{"cx":50,"cy":51}]},
    ],
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
  ,
    // Source-reconciled completion destinations; Standard policy remains unchanged.
    chunkedGeography: {
      "locations": [
        {
          "id": "martin",
          "label": "Martin — Draynor Village",
          "chunkOptions": [
            {
              "cx": 48,
              "cy": 50
            }
          ]
        },
        {
          "id": "zanaris-entry",
          "label": "Zanaris shed entrance",
          "chunkOptions": [
            {
              "cx": 50,
              "cy": 49
            }
          ]
        }
      ],
      "groups": [],
      "unknowns": [
        "The required AIR → DLR → DJQ → AJS fairy-ring sequence and CKP/DIR planes need canonical destination and alternate ring-access mapping; their off-map coordinates are not surface ownership."
      ]
    },
  },
  'Lunar Diplomacy': {
    kind: 'quest', accessPolicy: "regions",
    id: 'Lunar Diplomacy', name: 'Lunar Diplomacy',
    regions: ['Lunar Isle', 'Pirates\' Cove', 'Rellekka'],
    skills: { 'Herblore': 5, 'Crafting': 61, 'Defence': 40, 'Firemaking': 49, 'Magic': 65, 'Mining': 60, 'Woodcutting': 55 }, prereqs: ['The Fremennik Trials', 'Lost City', 'Rune Mysteries', 'Shilo Village'], points: 2,
    chunkedGeography: {"locations":[{"id":"rellekka-western-dock","label":"Rellekka western dock","chunkOptions":[{"cx":40,"cy":57}]},{"id":"rellekka-brundt","label":"Rellekka Brundt","chunkOptions":[{"cx":41,"cy":57}]},{"id":"pirates-cove-ship","label":"Pirates Cove ship","chunkOptions":[{"cx":34,"cy":59}]},{"id":"lunar-southeast-oneiromancer","label":"Lunar southeast Oneiromancer","chunkOptions":[{"cx":33,"cy":60}]},{"id":"moonclan-town-and-brazier","label":"Moonclan town and brazier","chunkOptions":[{"cx":32,"cy":61}]},{"id":"southwest-lunar-ring-dig-and-meteora","label":"Southwest Lunar ring dig and Meteora","chunkOptions":[{"cx":32,"cy":60}]},{"id":"lunar-mine-entrance","label":"Lunar mine entrance","chunkOptions":[{"cx":33,"cy":61}]}],"groups":[{"id":"air-altar-access","label":"Reach the air altar","routes":[{"id":"surface-ruins","label":"surface-ruins","locations":[{"id":"air-altar-ruins","label":"air altar ruins","chunkOptions":[{"cx":46,"cy":51}]}],"unknowns":["Legal air altar entry item"]},{"id":"abyss","label":"abyss","locations":[{"id":"wilderness-mage-of-zamorak","label":"Wilderness Mage of Zamorak","chunkOptions":[{"cx":48,"cy":55}]}],"unknowns":["Abyss entry and internal passage"]},{"id":"gotr","label":"gotr","locations":[{"id":"wizards-tower-basement-entrance","label":"Wizards Tower basement entrance","chunkOptions":[{"cx":48,"cy":49}]}],"unknowns":["Guardians of the Rift air portal"]}]},{"id":"fire-altar-access","label":"Reach the fire altar","routes":[{"id":"surface-ruins","label":"surface-ruins","locations":[{"id":"fire-altar-ruins","label":"fire altar ruins","chunkOptions":[{"cx":51,"cy":50}]}],"unknowns":["Legal fire altar entry item"]},{"id":"abyss","label":"abyss","locations":[{"id":"wilderness-mage-of-zamorak","label":"Wilderness Mage of Zamorak","chunkOptions":[{"cx":48,"cy":55}]}],"unknowns":["Abyss entry and internal passage"]},{"id":"gotr","label":"gotr","locations":[{"id":"wizards-tower-basement-entrance","label":"Wizards Tower basement entrance","chunkOptions":[{"cx":48,"cy":49}]}],"unknowns":["Guardians of the Rift fire portal"]}]},{"id":"water-altar-access","label":"Reach the water altar","routes":[{"id":"surface-ruins","label":"surface-ruins","locations":[{"id":"water-altar-ruins","label":"water altar ruins","chunkOptions":[{"cx":49,"cy":49}]}],"unknowns":["Legal water altar entry item"]},{"id":"abyss","label":"abyss","locations":[{"id":"wilderness-mage-of-zamorak","label":"Wilderness Mage of Zamorak","chunkOptions":[{"cx":48,"cy":55}]}],"unknowns":["Abyss entry and internal passage"]},{"id":"gotr","label":"gotr","locations":[{"id":"wizards-tower-basement-entrance","label":"Wizards Tower basement entrance","chunkOptions":[{"cx":48,"cy":49}]}],"unknowns":["Guardians of the Rift water portal"]}]},{"id":"earth-altar-access","label":"Reach the earth altar","routes":[{"id":"surface-ruins","label":"surface-ruins","locations":[{"id":"earth-altar-ruins","label":"earth altar ruins","chunkOptions":[{"cx":51,"cy":54}]}],"unknowns":["Legal earth altar entry item"]},{"id":"abyss","label":"abyss","locations":[{"id":"wilderness-mage-of-zamorak","label":"Wilderness Mage of Zamorak","chunkOptions":[{"cx":48,"cy":55}]}],"unknowns":["Abyss entry and internal passage"]},{"id":"gotr","label":"gotr","locations":[{"id":"wizards-tower-basement-entrance","label":"Wizards Tower basement entrance","chunkOptions":[{"cx":48,"cy":49}]}],"unknowns":["Guardians of the Rift earth portal"]}]}],"unknowns":["Make the lunar bar and helmet"]}, series: 'Fremennik',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'The Eyes of Glouphrie': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"brimstail-cave-entrance","label":"Brimstail cave entrance","standardAreas":["Tree Gnome Stronghold"],"chunkOptions":[{"cx":37,"cy":53}]},
      {"id":"hazelmere-island","label":"Hazelmere island","standardAreas":["Feldip Hills"],"chunkOptions":[{"cx":41,"cy":48}]},
      {"id":"grand-tree","label":"Grand Tree","standardAreas":["Tree Gnome Stronghold"],"chunkOptions":[{"cx":38,"cy":54}]},
      {"id":"northwest-gnome-stronghold","label":"Northwest Gnome Stronghold","standardAreas":["Tree Gnome Stronghold"],"chunkOptions":[{"cx":37,"cy":55}]},
      {"id":"gnome-stronghold-entrance","label":"Gnome Stronghold entrance","standardAreas":["Tree Gnome Stronghold"],"chunkOptions":[{"cx":38,"cy":52}]},
      {"id":"gnome-stronghold-spirit-tree","label":"Gnome Stronghold spirit tree","standardAreas":["Tree Gnome Stronghold"],"chunkOptions":[{"cx":38,"cy":53}]},
    ],
    id: 'The Eyes of Glouphrie', name: 'The Eyes of Glouphrie',
    regions: ['Tree Gnome Stronghold', 'Observatory', 'Feldip Hills'],
    skills: { 'Construction': 5, 'Magic': 46 }, prereqs: ['The Grand Tree'], points: 2, series: 'Gnome',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Darkness of Hallowvale': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"burgh-de-rott-hideout","label":"Burgh de Rott hideout","standardAreas":["Burgh de Rott"],"chunkOptions":[{"cx":54,"cy":50}]},
      {"id":"burgh-de-rott-boat","label":"Burgh de Rott boat","standardAreas":["Burgh de Rott"],"chunkOptions":[{"cx":55,"cy":49}]},
      {"id":"meiyerditch-wall-landing","label":"Meiyerditch wall landing","standardAreas":["Meiyerditch"],"chunkOptions":[{"cx":56,"cy":49}]},
      {"id":"south-meiyerditch","label":"South Meiyerditch","standardAreas":["Meiyerditch"],"chunkOptions":[{"cx":56,"cy":50}]},
      {"id":"paterdomus","label":"Paterdomus","standardAreas":["Paterdomus"],"chunkOptions":[{"cx":53,"cy":54}]},
      {"id":"west-paterdomus-bushes","label":"West Paterdomus bushes","standardAreas":["Silvarea"],"chunkOptions":[{"cx":52,"cy":54}]},
      {"id":"varrock-castle","label":"Varrock Castle","standardAreas":["Varrock"],"chunkOptions":[{"cx":50,"cy":54}]},
      {"id":"north-meiyerditch-wall","label":"North Meiyerditch wall","standardAreas":["Meiyerditch"],"chunkOptions":[{"cx":56,"cy":51}]},
      {"id":"east-castle-drakan-wall","label":"East Castle Drakan wall","standardAreas":["Darkmeyer"],"chunkOptions":[{"cx":56,"cy":52}]},
      {"id":"castle-drakan-sketches","label":"Castle Drakan sketches","standardAreas":["Darkmeyer"],"chunkOptions":[{"cx":55,"cy":52}]},
    ],
    id: 'Darkness of Hallowvale', name: 'Darkness of Hallowvale',
    regions: ['Burgh de Rott', 'Darkmeyer', 'Meiyerditch', 'Varrock', 'Paterdomus'],
    skills: { 'Construction': 5, 'Mining': 20, 'Thieving': 22, 'Agility': 26, 'Crafting': 32, 'Magic': 33, 'Strength': 40 }, prereqs: ['In Aid of the Myreque'], points: 2, series: 'Myreque',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'The Slug Menace': {
    kind: 'quest', accessPolicy: "regions",
    id: 'The Slug Menace', name: 'The Slug Menace',
    regions: ['Observatory', 'Witchaven', 'Falador'],
    manualRequirements: ['Access to all required elemental altars through one route: surface altars with Misthalin and Kharidian Desert; the Abyss through Edgeville with Enter the Abyss completed; or Guardians of the Rift with Misthalin and Temple of the Eye completed'],
    skills: { 'Crafting': 30, 'Runecraft': 30, 'Slayer': 30, 'Thieving': 30 }, prereqs: ['Sea Slug', 'Wanted!'], points: 1,
    chunkedGeography: {"locations":[{"id":"candidate-1","label":"Sir Tiffy","chunkOptions":[{"cx":46,"cy":52}]},{"id":"candidate-2","label":"Witchaven","chunkOptions":[{"cx":42,"cy":51}]},{"id":"candidate-3","label":"Jorral","chunkOptions":[{"cx":38,"cy":52}]},{"id":"candidate-4","label":"Fishing Platform","chunkOptions":[{"cx":43,"cy":51}]}],"groups":[],"unknowns":["Five rune altar access routes"]}, series: 'Temple Knight',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Elemental Workshop II': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"exam-centre","label":"Exam Centre","standardAreas":["Digsite"],"chunkOptions":[{"cx":52,"cy":52}]},
      {"id":"elemental-workshop-entrance","label":"Elemental Workshop entrance","standardAreas":["Seers' Village"],"chunkOptions":[{"cx":42,"cy":54}]},
    ],
    id: 'Elemental Workshop II', name: 'Elemental Workshop II',
    regions: ['Seers\' Village', 'Varrock'],
    skills: { 'Magic': 20, 'Smithing': 30 }, prereqs: ['Elemental Workshop I'], points: 1, series: 'Elemental Workshop',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'My Arm\'s Big Adventure': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"troll-stronghold","label":"Troll Stronghold","standardAreas":["Burthorpe"],"chunkOptions":[{"cx":44,"cy":57}]},
      {"id":"death-plateau-cooking-pot","label":"Death Plateau cooking pot","standardAreas":["Burthorpe"],"chunkOptions":[{"cx":44,"cy":56}]},
      {"id":"ardougne-dock","label":"Ardougne dock","standardAreas":["East Ardougne"],"chunkOptions":[{"cx":41,"cy":51}]},
      {"id":"brimhaven-dock","label":"Brimhaven dock","standardAreas":["Brimhaven"],"chunkOptions":[{"cx":43,"cy":50}]},
      {"id":"tai-bwo-wannai","label":"Tai Bwo Wannai","standardAreas":["Tai Bwo Wannai"],"chunkOptions":[{"cx":43,"cy":48}]},
    ],
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
  ,
    // Source-reconciled completion destinations; Standard policy remains unchanged.
    chunkedGeography: {
      "locations": [
        {
          "id": "west-entrana",
          "label": "West Entrana",
          "chunkOptions": [
            {
              "cx": 43,
              "cy": 52
            }
          ]
        },
        {
          "id": "south-taverley",
          "label": "South Taverley",
          "chunkOptions": [
            {
              "cx": 45,
              "cy": 53
            }
          ]
        },
        {
          "id": "sandpit",
          "label": "Entrana sandpit — quest sandbags",
          "chunkOptions": [
            {
              "cx": 44,
              "cy": 52
            }
          ]
        }
      ],
      "groups": [],
      "unknowns": []
    },
  },
  'Eagles\' Peak': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"ardougne-zoo","label":"Ardougne Zoo","standardAreas":["East Ardougne"],"chunkOptions":[{"cx":40,"cy":51}]},
      {"id":"eagles-peak-camp-and-entrance","label":"Eagles Peak camp and entrance","standardAreas":["Eagles' Peak"],"chunkOptions":[{"cx":36,"cy":54}]},
      {"id":"varrock-fancy-clothes-store","label":"Varrock fancy clothes store","standardAreas":["Varrock"],"chunkOptions":[{"cx":51,"cy":53}]},
    ],
    id: 'Eagles\' Peak', name: 'Eagles\' Peak',
    regions: ['Eagles\' Peak', 'Varrock'],
    skills: { 'Hunter': 27 }, prereqs: [], points: 2,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Animal Magnetism': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"draynor-manor","label":"Draynor Manor","standardAreas":["Draynor Village"],"chunkOptions":[{"cx":48,"cy":52}]},
      {"id":"alice-s-farm","label":"Alice's farm","standardAreas":["Port Phasmatys"],"chunkOptions":[{"cx":56,"cy":55}]},
      {"id":"old-crone-s-house","label":"Old Crone's house","standardAreas":["Fenkenstrain's Castle"],"chunkOptions":[{"cx":54,"cy":55}]},
      {"id":"rimmington-mine","label":"Rimmington mine","standardAreas":["Rimmington"],"chunkOptions":[{"cx":46,"cy":50}]},
      {"id":"burthorpe","label":"Burthorpe","standardAreas":["Burthorpe"],"chunkOptions":[{"cx":45,"cy":55}]},
    ],
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
    kind: 'quest', accessPolicy: "regions",

    id: 'Cold War', name: 'Cold War',
    regions: ['Rellekka', 'East Ardougne', 'Lumbridge'],
    skills: { 'Hunter': 10, 'Agility': 30, 'Crafting': 30, 'Construction': 34, 'Thieving': 15 }, prereqs: [],
    manualRequirements: ["Access to a crafting table 3"], points: 1,
    chunkedGeography: {"locations":[{"id":"location-1","label":"Ardougne Zoo","chunkOptions":[{"cx":40,"cy":51}]},{"id":"location-2","label":"Iceberg bird hide","chunkOptions":[{"cx":41,"cy":62}]},{"id":"location-3","label":"Larry in Rellekka","chunkOptions":[{"cx":42,"cy":58}]},{"id":"location-4","label":"Larry at Lumbridge sheep farm","chunkOptions":[{"cx":50,"cy":50}]},{"id":"location-5","label":"Sheep penguins","chunkOptions":[{"cx":50,"cy":51}]},{"id":"location-6","label":"Fred the Farmer","chunkOptions":[{"cx":49,"cy":51}]},{"id":"location-7","label":"Iceberg outpost entrance","chunkOptions":[{"cx":41,"cy":62}]},{"id":"iceberg-agility","label":"Iceberg agility course","chunkOptions":[{"cx":41,"cy":63}]}],"groups":[],"unknowns":["Crafting table access"]}, series: 'Penguin',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'The Fremennik Isles': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"location-1","label":"Mord Gunnars in Rellekka","standardAreas":["Rellekka"],"chunkOptions":[{"cx":41,"cy":57}]},
      {"id":"location-2","label":"Jatizso","standardAreas":["Jatizso"],"chunkOptions":[{"cx":37,"cy":59}]},
      {"id":"location-3","label":"Neitiznot","standardAreas":["Neitiznot"],"chunkOptions":[{"cx":36,"cy":59}]},
      {"id":"location-4","label":"Neitiznot northern bridges","standardAreas":["Neitiznot"],"chunkOptions":[{"cx":36,"cy":60}]},
      {"id":"location-5","label":"Ice Troll King cave entrance","standardAreas":["Neitiznot"],"chunkOptions":[{"cx":37,"cy":60}]},
    ],
    id: 'The Fremennik Isles', name: 'The Fremennik Isles',
    regions: ['Rellekka', 'Neitiznot', 'Jatizso'],
    skills: { 'Construction': 20 }, prereqs: ['The Fremennik Trials'], points: 1, series: 'Fremennik',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Tower of Life': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"location-1","label":"Tower of Life","standardAreas":["East Ardougne"],"chunkOptions":[{"cx":41,"cy":50}]},
    ],
    id: 'Tower of Life', name: 'Tower of Life',
    regions: ['East Ardougne'],
    skills: { 'Construction': 10 }, prereqs: [], points: 2,
    difficulty: DropSource.QUEST_NOVICE
  },
  'The Great Brain Robbery': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"mos-le-harmless","label":"Mos Le'Harmless","standardAreas":["Mos Le'Harmless"],"chunkOptions":[{"cx":57,"cy":46}]},
      {"id":"harmony-island","label":"Harmony Island","standardAreas":["Harmony Island"],"chunkOptions":[{"cx":59,"cy":44}]},
      {"id":"monastery","label":"Monastery","standardAreas":["Edgeville"],"chunkOptions":[{"cx":47,"cy":54}]},
      {"id":"fenkenstrain-s-castle","label":"Fenkenstrain's Castle","standardAreas":["Fenkenstrain's Castle"],"chunkOptions":[{"cx":55,"cy":55}]},
      {"id":"canifis","label":"Canifis","standardAreas":["Canifis"],"chunkOptions":[{"cx":54,"cy":54}]},
    ],
    id: 'The Great Brain Robbery', name: 'The Great Brain Robbery',
    regions: ['Canifis', 'Mos Le\'Harmless', 'Harmony Island', 'Edgeville'],
    manualRequirements: ['Access to a player-owned house workshop and crafting table, or the Grand Exchange'],
    skills: { 'Crafting': 16, 'Construction': 30, 'Prayer': 50 }, prereqs: ['Creature of Fenkenstrain', 'Cabin Fever', 'RFD: Pirate Pete'], points: 2, series: 'Pirate',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'What Lies Below': {
    kind: 'quest', accessPolicy: "regions",
    id: 'What Lies Below', name: 'What Lies Below',
    regions: ['Edgeville', 'Varrock'],
    skills: { 'Runecraft': 35 }, prereqs: ['Rune Mysteries'], points: 1,
    chunkedGeography: {"locations":[{"id":"candidate-1","label":"Rat Burgiss","chunkOptions":[{"cx":51,"cy":52}]},{"id":"candidate-2","label":"Outlaws","chunkOptions":[{"cx":48,"cy":54}]},{"id":"candidate-3","label":"Varrock Library","chunkOptions":[{"cx":50,"cy":54}]},{"id":"candidate-4","label":"Zaff","chunkOptions":[{"cx":50,"cy":53}]}],"groups":[],"unknowns":["Chaos altar access"]},
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
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"location-1","label":"Lumbridge Castle / Dorgesh-Kaan entrance","standardAreas":["Lumbridge"],"chunkOptions":[{"cx":50,"cy":50}]},
      {"id":"location-2","label":"Goblin Village","standardAreas":["Goblin Village"],"chunkOptions":[{"cx":46,"cy":54}]},
      {"id":"location-3","label":"Lumbridge Swamp H.A.M. entrance","standardAreas":["Lumbridge"],"chunkOptions":[{"cx":49,"cy":49}]},
    ],
    id: 'Another Slice of H.A.M.', name: 'Another Slice of H.A.M.',
    regions: ['Lumbridge', 'Goblin Village'],
    skills: { 'Attack': 15, 'Prayer': 25 }, prereqs: ['Death to the Dorgeshuun', 'The Dig Site', 'The Giant Dwarf'], points: 1, series: 'Dorgeshuun',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Dream Mentor': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"lunar-mine-entrance","label":"Lunar mine entrance","standardAreas":["Lunar Isle"],"chunkOptions":[{"cx":33,"cy":61}]},
      {"id":"lunar-town","label":"Lunar town","standardAreas":["Lunar Isle"],"chunkOptions":[{"cx":32,"cy":61}]},
      {"id":"oneiromancer","label":"Oneiromancer","standardAreas":["Lunar Isle"],"chunkOptions":[{"cx":33,"cy":60}]},
    ],
    id: 'Dream Mentor', name: 'Dream Mentor',
    regions: ['Lunar Isle'],
    skills: {}, combatLevel: 85, prereqs: ['Lunar Diplomacy', 'Eadgar\'s Ruse'], points: 2,
    difficulty: DropSource.QUEST_MASTER
  },
  'Grim Tales': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"location-1","label":"Sylas and beanstalk","standardAreas":["Taverley"],"chunkOptions":[{"cx":45,"cy":53}]},
      {"id":"location-2","label":"Grimgnash","standardAreas":["Taverley"],"chunkOptions":[{"cx":44,"cy":54}]},
      {"id":"location-3","label":"Rupert tower","standardAreas":["Goblin Village"],"chunkOptions":[{"cx":46,"cy":54}]},
      {"id":"location-4","label":"Witch house","standardAreas":["Taverley"],"chunkOptions":[{"cx":45,"cy":54}]},
    ],
    id: 'Grim Tales', name: 'Grim Tales',
    regions: ['Taverley', 'Goblin Village'],
    skills: { 'Farming': 45, 'Herblore': 52, 'Thieving': 58, 'Agility': 59, 'Woodcutting': 71 }, prereqs: ['Witch\'s House'], points: 1,
    difficulty: DropSource.QUEST_MASTER
  },
  'King\'s Ransom': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"sinclair-mansion","label":"Sinclair Mansion","standardAreas":["Seers' Village"],"chunkOptions":[{"cx":42,"cy":55}]},
      {"id":"seers-village-courthouse","label":"Seers Village courthouse","standardAreas":["Seers' Village"],"chunkOptions":[{"cx":42,"cy":54}]},
      {"id":"camelot-statue-and-castle","label":"Camelot statue and castle","standardAreas":["Camelot"],"chunkOptions":[{"cx":43,"cy":54}]},
      {"id":"black-knights-fortress-entrance","label":"Black Knights Fortress entrance","standardAreas":["Edgeville"],"chunkOptions":[{"cx":47,"cy":54}]},
      {"id":"wizard-cromperty","label":"Wizard Cromperty","standardAreas":["East Ardougne"],"chunkOptions":[{"cx":41,"cy":51}]},
    ],
    id: 'King\'s Ransom', name: 'King\'s Ransom',
    regions: ['East Ardougne', 'Seers\' Village', 'Camelot', 'Edgeville'],
    skills: { 'Magic': 45, 'Defence': 65 }, prereqs: ['Black Knights\' Fortress', 'Holy Grail', 'Murder Mystery', 'One Small Favour'], points: 1, series: 'Camelot',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Monkey Madness II': {
    kind: 'quest', accessPolicy: "regions",
    id: 'Monkey Madness II', name: 'Monkey Madness II',
    regions: ['Ape Atoll', 'Tree Gnome Stronghold', 'Entrana', 'Burthorpe'],
    manualRequirements: ['Unlocked the Gnome Stronghold balloon route'],
    skills: { 'Slayer': 69, 'Crafting': 70, 'Hunter': 60, 'Agility': 55, 'Thieving': 55, 'Firemaking': 60 }, prereqs: ['Monkey Madness I', 'Enlightened Journey', 'The Eyes of Glouphrie', 'Troll Stronghold', 'Watchtower', 'RFD: King Awowogei'], points: 4,
    chunkedGeography: {"locations":[{"id":"candidate-1","label":"Grand Tree","chunkOptions":[{"cx":38,"cy":54}]},{"id":"candidate-2","label":"Anita","chunkOptions":[{"cx":37,"cy":54}]},{"id":"candidate-3","label":"Auguste","chunkOptions":[{"cx":43,"cy":52}]},{"id":"candidate-4","label":"Garkor","chunkOptions":[{"cx":43,"cy":43}]},{"id":"candidate-5","label":"Monkey archer","chunkOptions":[{"cx":42,"cy":43}]},{"id":"candidate-6","label":"Zooknock dungeon entrance","chunkOptions":[{"cx":43,"cy":42}]},{"id":"candidate-7","label":"Troll Stronghold","chunkOptions":[{"cx":44,"cy":57}]},{"id":"candidate-8","label":"Keef","chunkOptions":[{"cx":39,"cy":47}]},{"id":"candidate-9","label":"Crash Site breach","chunkOptions":[{"cx":38,"cy":55}]},{"id":"nieve","label":"Nieve south of Grand Tree","chunkOptions":[{"cx":38,"cy":53}]}],"groups":[],"unknowns":["Variable NPC locations"]}, series: 'Gnome',
    difficulty: DropSource.QUEST_GRANDMASTER
  },
  'Client of Kourend': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"port-piscarilius-docks","label":"Port Piscarilius docks","standardAreas":["Piscarilius"],"chunkOptions":[{"cx":28,"cy":57}]},
      {"id":"piscarilius-general-store","label":"Piscarilius general store","standardAreas":["Piscarilius"],"chunkOptions":[{"cx":28,"cy":58}]},
      {"id":"hosidius-general-store","label":"Hosidius general store","standardAreas":["Hosidius"],"chunkOptions":[{"cx":27,"cy":56}]},
      {"id":"shayzien-general-store","label":"Shayzien general store","standardAreas":["Shayzien"],"chunkOptions":[{"cx":23,"cy":56}]},
      {"id":"lovakengj-general-store","label":"Lovakengj general store","standardAreas":["Lovakengj"],"chunkOptions":[{"cx":24,"cy":58}]},
      {"id":"arceuus-general-store","label":"Arceuus general store","standardAreas":["Arceuus"],"chunkOptions":[{"cx":26,"cy":58}]},
      {"id":"dark-altar","label":"Dark Altar","standardAreas":["Arceuus"],"chunkOptions":[{"cx":26,"cy":60}]},
    ],
    id: 'Client of Kourend', name: 'Client of Kourend',
    regions: ['Shayzien', 'Lovakengj', 'Arceuus', 'Hosidius', 'Piscarilius'],
    skills: {}, prereqs: ["X Marks the Spot"], points: 1, series: 'Great Kourend',
    difficulty: DropSource.QUEST_NOVICE
  },
  'Rag and Bone Man II': {
    kind: 'quest', accessPolicy: "regions",
    id: 'Rag and Bone Man II', name: 'Rag and Bone Man II',
    regions: ['Silvarea', 'Draynor Village', 'Taverley', 'Tree Gnome Stronghold', 'Feldip Hills', 'Nardah', 'Rellekka', 'Canifis', 'Haunted Woods', 'Fenkenstrain\'s Castle', 'Slayer Tower'],
    manualRequirements: [
      'Completed Horror from the Deep or started The Fremennik Trials for dagannoth access',
      'Reached an experiment after starting Creature of Fenkenstrain or completing Grim Tales',
      'Reached a listed fire giant source after partially completing Waterfall Quest or by an alternative route',
    ],
    skills: { 'Slayer': 40 }, prereqs: ['Rag and Bone Man I', 'Skippy and the Mogres'], points: 1,
    chunkedGeography: {"locations":[{"id":"odd-old-man-and-pot-boiler","label":"Odd Old Man and pot boiler","chunkOptions":[{"cx":52,"cy":54}]}],"groups":[],"unknowns":["Legal acquisition of bat wing","Legal acquisition of undead cow ribs","Legal acquisition of experiment bone","Legal acquisition of werewolf bone","Legal acquisition of ghoul bone","Legal acquisition of zombie bone","Legal acquisition of rat bone","Legal acquisition of cave goblin skull","Legal acquisition of jackal bone","Legal acquisition of snake spine","Legal acquisition of desert lizard bone","Legal acquisition of vulture wing","Legal acquisition of seagull wing","Legal acquisition of ice giant ribs","Legal acquisition of mogre bone","Legal acquisition of jogre bone","Legal acquisition of moss giant bone","Legal acquisition of fire giant bone","Legal acquisition of baby dragon bone","Legal acquisition of troll bone","Legal acquisition of rabbit bone","Legal acquisition of basilisk bone","Legal acquisition of dagannoth ribs","Legal acquisition of terrorbird wing","Legal acquisition of wolf bone","Legal acquisition of ogre ribs","Legal acquisition of zogre bone"]}, series: 'Rag and Bone Man',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Bone Voyage': {
    kind: 'quest', accessPolicy: "regions",
    id: 'Bone Voyage', name: 'Bone Voyage',
    regions: ['Varrock', 'Fossil Island', 'Port Sarim', 'Woodcutting Guild'],
    skills: {}, prereqs: ['The Dig Site'],
    manualRequirements: ["100 Kudos"], points: 1,
    chunkedGeography: {"locations":[{"id":"varrock-museum","label":"Varrock Museum","chunkOptions":[{"cx":50,"cy":53}]},{"id":"digsite-barge","label":"Digsite barge","chunkOptions":[{"cx":52,"cy":53}]},{"id":"varrock-sawmill","label":"Varrock Sawmill","chunkOptions":[{"cx":51,"cy":54}]},{"id":"woodcutting-guild","label":"Woodcutting Guild","chunkOptions":[{"cx":25,"cy":54}]},{"id":"port-sarim-pub","label":"Port Sarim pub","chunkOptions":[{"cx":47,"cy":50}]},{"id":"varrock-apothecary","label":"Varrock Apothecary","chunkOptions":[{"cx":49,"cy":53}]},{"id":"odd-old-man","label":"Odd Old Man","chunkOptions":[{"cx":52,"cy":54}]}],"groups":[],"unknowns":[]},
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'The Queen of Thieves': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"location-1","label":"Tomas Lawry","standardAreas":["Piscarilius"],"chunkOptions":[{"cx":28,"cy":59}]},
      {"id":"location-2","label":"Piscarilius streets / Warrens entrance","standardAreas":["Piscarilius"],"chunkOptions":[{"cx":28,"cy":58}]},
      {"id":"location-3","label":"Councillor Hughes house","standardAreas":["Hosidius"],"chunkOptions":[{"cx":26,"cy":57}]},
    ],
    id: 'The Queen of Thieves', name: 'The Queen of Thieves',
    regions: ['Hosidius', 'Piscarilius'],
    skills: { 'Thieving': 20 }, prereqs: ['Client of Kourend'], points: 1, series: 'Great Kourend',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'The Depths of Despair': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"lord-hosidius-house","label":"Lord Hosidius house","standardAreas":["Hosidius"],"chunkOptions":[{"cx":27,"cy":55}]},
      {"id":"arceuus-library","label":"Arceuus Library","standardAreas":["Arceuus"],"chunkOptions":[{"cx":25,"cy":59}]},
      {"id":"crabclaw-caves-entrance","label":"Crabclaw Caves entrance","standardAreas":["Hosidius"],"chunkOptions":[{"cx":25,"cy":53}]},
    ],
    id: 'The Depths of Despair', name: 'The Depths of Despair',
    regions: ['Hosidius', 'Arceuus'],
    skills: { 'Agility': 18 }, prereqs: ['Client of Kourend'], points: 1, series: 'Great Kourend',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Dragon Slayer II': {
    kind: 'quest', accessPolicy: "regions",
    id: 'Dragon Slayer II', name: 'Dragon Slayer II',
    regions: ['Draynor Village', 'Varrock', 'Falador', 'Baxtorian Falls', 'Corsair Cove', 'Lunar Isle', 'Rellekka', 'Shayzien', 'Crandor', 'Kharazi Jungle', 'Musa Point', 'Sophanem', 'Port Phasmatys', 'Fossil Island', 'Lithkren'],
    skills: { 'Magic': 75, 'Smithing': 70, 'Mining': 68, 'Crafting': 62, 'Agility': 60, 'Thieving': 60, 'Construction': 50, 'Hitpoints': 50, 'Quest Points': 200 }, prereqs: ['Legends\' Quest', 'Dream Mentor', 'A Tail of Two Cats', 'Animal Magnetism', 'Ghosts Ahoy', 'Bone Voyage', 'Client of Kourend'],
    manualRequirements: ["Started the pyre ship portion of Barbarian Training"], points: 5,
    chunkedGeography: {"locations":[{"id":"myths-guild-alec","label":"Myths Guild Alec","chunkOptions":[{"cx":38,"cy":44}]},{"id":"musa-point-pub-dallas","label":"Musa Point pub Dallas","chunkOptions":[{"cx":45,"cy":49}]},{"id":"karamja-volcano-entrance","label":"Karamja Volcano entrance","chunkOptions":[{"cx":44,"cy":49}]},{"id":"fossil-island-house-on-hill","label":"Fossil Island house on hill","chunkOptions":[{"cx":58,"cy":60}]},{"id":"fossil-island-map-search","label":"Fossil Island map search","chunkOptions":[{"cx":59,"cy":60}]},{"id":"museum-camp-jardric","label":"Museum Camp Jardric","chunkOptions":[{"cx":58,"cy":59}]},{"id":"fossil-island-rowboat","label":"Fossil Island rowboat","chunkOptions":[{"cx":57,"cy":60}]},{"id":"lithkren-entrance","label":"Lithkren entrance","chunkOptions":[{"cx":55,"cy":62}]},{"id":"sophanem-sphinx","label":"Sophanem Sphinx","chunkOptions":[{"cx":51,"cy":43}]},{"id":"oneiromancer","label":"Oneiromancer","chunkOptions":[{"cx":33,"cy":60}]},{"id":"lunar-dream-brazier","label":"Lunar dream brazier","chunkOptions":[{"cx":32,"cy":61}]},{"id":"shayzien-amelia","label":"Shayzien Amelia","chunkOptions":[{"cx":24,"cy":55}]},{"id":"shayzien-crypt-entrance","label":"Shayzien crypt entrance","chunkOptions":[{"cx":23,"cy":55}]},{"id":"varrock-reldo-and-roald","label":"Varrock Reldo and Roald","chunkOptions":[{"cx":50,"cy":54}]},{"id":"port-phasmatys-sarah","label":"Port Phasmatys Sarah","chunkOptions":[{"cx":57,"cy":54}]},{"id":"draynor-manor-ava","label":"Draynor Manor Ava","chunkOptions":[{"cx":48,"cy":52}]},{"id":"rellekka-brundt-and-torfinn","label":"Rellekka Brundt and Torfinn","chunkOptions":[{"cx":41,"cy":57}]},{"id":"ungael-vorkath","label":"Ungael Vorkath","chunkOptions":[{"cx":35,"cy":63}]},{"id":"kharazi-maze-entrance","label":"Kharazi maze entrance","chunkOptions":[{"cx":46,"cy":45}]},{"id":"ancient-cavern-whirlpool","label":"Ancient Cavern whirlpool","chunkOptions":[{"cx":39,"cy":54}]},{"id":"falador-amik","label":"Falador Amik","chunkOptions":[{"cx":46,"cy":52}]},{"id":"east-ardougne-lathas","label":"East Ardougne Lathas","chunkOptions":[{"cx":40,"cy":51}]}],"groups":[],"unknowns":["Reach roaming Bob","Reach the assigned Mort Myre dig location"]}, series: 'Dragonkin',
    difficulty: DropSource.QUEST_GRANDMASTER
  },
  'Tale of the Righteous': {
    kind: 'quest', accessPolicy: 'locations',
    id: 'Tale of the Righteous', name: 'Tale of the Righteous',
    regions: ['Mount Quidamortem', 'Shayzien', 'Arceuus'],
    locations: [{"id": "phileas-house","label": "Phileas house","standardAreas": ["Shayzien"],"chunkOptions": [{"cx": 24,"cy": 55}]},{"id": "arceuus-archive-entry","label": "Arceuus Library","standardAreas": ["Arceuus"],"chunkOptions": [{"cx": 25,"cy": 59}]},{"id": "shayzien-war-tent","label": "Shayzien War Tent","standardAreas": ["Shayzien"],"chunkOptions": [{"cx": 23,"cy": 56}]},{"id": "historian-duffy","label": "Historian Duffy","standardAreas": ["Mount Quidamortem"],"chunkOptions": [{"cx": 19,"cy": 55}]},{"id": "quidamortem-crevice","label": "Quidamortem crevice","standardAreas": ["Mount Quidamortem"],"chunkOptions": [{"cx": 18,"cy": 55}]}],
    skills: { 'Strength': 16, 'Mining': 10 }, prereqs: ['Client of Kourend'], points: 1, series: 'Great Kourend',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'A Taste of Hope': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"ver-sinhaza","label":"Ver Sinhaza","standardAreas":["Ver Sinhaza"],"chunkOptions":[{"cx":57,"cy":50}]},
      {"id":"meiyerditch-hideout","label":"Meiyerditch hideout","standardAreas":["Meiyerditch"],"chunkOptions":[{"cx":56,"cy":50}]},
      {"id":"serafina-house","label":"Serafina house","standardAreas":["Meiyerditch"],"chunkOptions":[{"cx":56,"cy":51}]},
    ],
    id: 'A Taste of Hope', name: 'A Taste of Hope',
    regions: ['Meiyerditch', 'Ver Sinhaza'],
    skills: { 'Crafting': 48, 'Agility': 45, 'Attack': 40, 'Herblore': 40, 'Slayer': 38 }, prereqs: ['Darkness of Hallowvale'], points: 1, series: 'Myreque',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Making Friends with My Arm': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"troll-stronghold-entrance","label":"Troll Stronghold entrance","standardAreas":["Burthorpe"],"chunkOptions":[{"cx":44,"cy":57}]},
      {"id":"larry-boat","label":"Larry boat","standardAreas":["Rellekka"],"chunkOptions":[{"cx":42,"cy":58}]},
      {"id":"weiss","label":"Weiss","standardAreas":["Weiss"],"chunkOptions":[{"cx":44,"cy":61}]},
      {"id":"east-weiss","label":"East Weiss","standardAreas":["Weiss"],"chunkOptions":[{"cx":45,"cy":61}]},
      {"id":"wise-old-man-house","label":"Wise Old Man house","standardAreas":["Draynor Village"],"chunkOptions":[{"cx":48,"cy":50}]},
      {"id":"varrock-apothecary","label":"Varrock Apothecary","standardAreas":["Varrock"],"chunkOptions":[{"cx":49,"cy":53}]},
    ],
    id: 'Making Friends with My Arm', name: 'Making Friends with My Arm',
    regions: ['Burthorpe', 'Rellekka', 'Weiss', 'Draynor Village', 'Varrock'],
    skills: { 'Firemaking': 66, 'Mining': 72, 'Construction': 35, 'Agility': 68 }, prereqs: ['My Arm\'s Big Adventure', 'Swan Song', 'Cold War', 'Romeo & Juliet'], points: 2, series: 'Troll',
    difficulty: DropSource.QUEST_MASTER
  },
  'The Forsaken Tower': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"lovakengj-assembly","label":"Lovakengj Assembly","standardAreas":["Lovakengj"],"chunkOptions":[{"cx":23,"cy":58}]},
      {"id":"wintertodt-camp","label":"Wintertodt camp","standardAreas":["Wintertodt Camp"],"chunkOptions":[{"cx":25,"cy":61}]},
      {"id":"forsaken-tower","label":"Forsaken Tower","standardAreas":["Lovakengj"],"chunkOptions":[{"cx":21,"cy":59}]},
    ],
    id: 'The Forsaken Tower', name: 'The Forsaken Tower',
    regions: ['Lovakengj'],
    skills: {}, prereqs: ['Client of Kourend'], points: 1, series: 'Great Kourend',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'The Ascent of Arceuus': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"location-1","label":"Mori","standardAreas":["Arceuus"],"chunkOptions":[{"cx":26,"cy":58}]},
      {"id":"location-2","label":"Councillor Andrews","standardAreas":["Kourend Castle"],"chunkOptions":[{"cx":25,"cy":57}]},
      {"id":"location-3","label":"Tower of Magic","standardAreas":["Arceuus"],"chunkOptions":[{"cx":24,"cy":59}]},
      {"id":"location-4","label":"Mount Karuulm entrance","standardAreas":["Mount Karuulm"],"chunkOptions":[{"cx":20,"cy":59}]},
      {"id":"location-5","label":"Grave","standardAreas":["Lovakengj"],"chunkOptions":[{"cx":21,"cy":58}]},
      {"id":"location-6","label":"Trapped soul tracking","standardAreas":["Mount Karuulm"],"chunkOptions":[{"cx":20,"cy":58}]},
      {"id":"location-7","label":"Arceuus altar rocks","standardAreas":["Arceuus"],"chunkOptions":[{"cx":26,"cy":60}]},
    ],
    id: 'The Ascent of Arceuus', name: 'The Ascent of Arceuus',
    regions: ['Arceuus'],
    skills: { 'Hunter': 12 }, prereqs: ['Client of Kourend'], points: 1, series: 'Great Kourend',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Song of the Elves': {
    kind: 'quest', accessPolicy: "regions",
    id: 'Song of the Elves', name: 'Song of the Elves',
    regions: ['Lletya', 'Zul-Andra', 'Poison Waste', 'Iorwerth Camp', 'Isafdar', 'Prifddinas', 'Arandar', 'East Ardougne', 'West Ardougne', 'Baxtorian Falls'],
    skills: { 'Agility': 70, 'Construction': 70, 'Farming': 70, 'Herblore': 70, 'Hunter': 70, 'Mining': 70, 'Smithing': 70, 'Woodcutting': 70 },
    prereqs: ['Mourning\'s End Part II', 'Making History', 'Druidic Ritual'], points: 4,
    chunkedGeography: {"locations":[{"id":"candidate-1","label":"Edmond","chunkOptions":[{"cx":40,"cy":52}]},{"id":"candidate-2","label":"Ardougne Castle","chunkOptions":[{"cx":40,"cy":51}]},{"id":"candidate-3","label":"Lletya","chunkOptions":[{"cx":36,"cy":49}]},{"id":"candidate-4","label":"Waterfall","chunkOptions":[{"cx":39,"cy":54}]},{"id":"candidate-5","label":"Well of Voyage","chunkOptions":[{"cx":36,"cy":50}]},{"id":"candidate-6","label":"Hefin","chunkOptions":[{"cx":35,"cy":48}]},{"id":"candidate-7","label":"Crwys","chunkOptions":[{"cx":34,"cy":50}]},{"id":"candidate-8","label":"Cadarn tracking","chunkOptions":[{"cx":35,"cy":49}]},{"id":"candidate-9","label":"Prifddinas finish","chunkOptions":[{"cx":35,"cy":51}]},{"id":"west-hideout","label":"West Ardougne hideout","chunkOptions":[{"cx":39,"cy":52}]},{"id":"west-grain","label":"Council and church grain","chunkOptions":[{"cx":39,"cy":51}]},{"id":"west-store","label":"Southwest grain and Chadwell","chunkOptions":[{"cx":38,"cy":51}]},{"id":"east-market","label":"East Ardougne market rebellion","chunkOptions":[{"cx":41,"cy":51}]},{"id":"meilyr-swamp","label":"Meilyr clue near Port Tyras","chunkOptions":[{"cx":34,"cy":48}]},{"id":"meilyr-zulandra","label":"Meilyr clue in Zul-Andra","chunkOptions":[{"cx":34,"cy":47}]}],"groups":[],"unknowns":[]}, series: 'Elf',
    difficulty: DropSource.QUEST_GRANDMASTER
  },
  'The Fremennik Exiles': {
    kind: 'quest', accessPolicy: "regions",
    id: 'The Fremennik Exiles', name: 'The Fremennik Exiles',
    regions: ['Rellekka', 'Lunar Isle'],
    skills: { 'Crafting': 65, 'Slayer': 60, 'Smithing': 60, 'Fishing': 60, 'Runecraft': 55 }, prereqs: ['The Fremennik Isles', 'Lunar Diplomacy', 'Mountain Daughter', 'Heroes\' Quest'], points: 2,
    chunkedGeography: {"locations":[{"id":"rellekka","label":"Rellekka","chunkOptions":[{"cx":41,"cy":57}]},{"id":"brundt-exile-camp","label":"Brundt exile camp","chunkOptions":[{"cx":42,"cy":56}]},{"id":"baba-yaga-s-house","label":"Baba Yaga's house","chunkOptions":[{"cx":32,"cy":61}]},{"id":"lunar-mine","label":"Lunar mine","chunkOptions":[{"cx":33,"cy":61}]},{"id":"astral-altar","label":"Astral altar","chunkOptions":[{"cx":33,"cy":60}]},{"id":"fossegrimen","label":"Fossegrimen","chunkOptions":[{"cx":41,"cy":56}]},{"id":"mountain-camp-geyser","label":"Mountain Camp geyser","chunkOptions":[{"cx":43,"cy":57}]},{"id":"isle-of-stone","label":"Isle of Stone entrance","chunkOptions":[{"cx":38,"cy":62}]}],"groups":[{"id":"facility-0","label":"Lunar ore furnace","routes":[{"id":"facility-0-reviewed","label":"Reviewed furnace destinations","locations":[{"id":"facility-0-destination","label":"Lunar ore furnace","chunkOptions":[{"cx":50,"cy":50},{"cx":46,"cy":52}]}]},{"id":"facility-0-other","label":"Another compatible furnace","locations":[],"unknowns":["Access to another compatible furnace needs source review"]}]},{"id":"facility-1","label":"V sigil anvil","routes":[{"id":"facility-1-reviewed","label":"Reviewed anvil destinations","locations":[{"id":"facility-1-destination","label":"V sigil anvil","chunkOptions":[{"cx":50,"cy":53}]}]},{"id":"facility-1-other","label":"Another compatible anvil","locations":[],"unknowns":["Access to another compatible anvil needs source review"]}]}],"unknowns":[]},
    difficulty: DropSource.QUEST_MASTER
  },
  'Sins of the Father': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"slepe","label":"Slepe","standardAreas":["Slepe"],"chunkOptions":[{"cx":58,"cy":51}]},
      {"id":"slepe-northern-trail","label":"Slepe northern trail","standardAreas":["Slepe"],"chunkOptions":[{"cx":58,"cy":52}]},
      {"id":"paterdomus","label":"Paterdomus","standardAreas":["Paterdomus"],"chunkOptions":[{"cx":53,"cy":54}]},
      {"id":"ivan-s-meeting","label":"Ivan's meeting","standardAreas":["Haunted Woods"],"chunkOptions":[{"cx":55,"cy":54}]},
      {"id":"burgh-de-rott","label":"Burgh de Rott","standardAreas":["Burgh de Rott"],"chunkOptions":[{"cx":54,"cy":50}]},
      {"id":"burgh-de-rott-boathouse","label":"Burgh de Rott boathouse","standardAreas":["Burgh de Rott"],"chunkOptions":[{"cx":55,"cy":49}]},
      {"id":"icyene-graveyard","label":"Icyene Graveyard","standardAreas":["Icyene Graveyard"],"chunkOptions":[{"cx":57,"cy":49}]},
      {"id":"meiyerditch-laboratory-entrance","label":"Meiyerditch laboratory entrance","standardAreas":["Meiyerditch"],"chunkOptions":[{"cx":56,"cy":51}]},
      {"id":"meiyerditch-hideout-entrance","label":"Meiyerditch hideout entrance","standardAreas":["Meiyerditch"],"chunkOptions":[{"cx":56,"cy":50}]},
      {"id":"darkmeyer-entrance","label":"Darkmeyer entrance","standardAreas":["Darkmeyer"],"chunkOptions":[{"cx":56,"cy":52}]},
      {"id":"lower-darkmeyer","label":"Lower Darkmeyer","standardAreas":["Darkmeyer"],"chunkOptions":[{"cx":57,"cy":52}]},
      {"id":"icyene-graveyard-north","label":"Icyene Graveyard north","standardAreas":["Icyene Graveyard"],"chunkOptions":[{"cx":58,"cy":50}]},
    ],
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
  ,
    // Source-reconciled completion destinations; Standard policy remains unchanged.
    chunkedGeography: {
      "locations": [
        {
          "id": "draynor-village",
          "label": "Draynor Village",
          "chunkOptions": [
            {
              "cx": 48,
              "cy": 50
            }
          ]
        },
        {
          "id": "south-falador-farm",
          "label": "South Falador Farm",
          "chunkOptions": [
            {
              "cx": 47,
              "cy": 51
            }
          ]
        },
        {
          "id": "sourhog-cave",
          "label": "Sourhog cave entrance east of Draynor Manor",
          "chunkOptions": [
            {
              "cx": 49,
              "cy": 52
            }
          ]
        },
        {
          "id": "spria",
          "label": "Spria — northern Draynor",
          "chunkOptions": [
            {
              "cx": 48,
              "cy": 51
            }
          ]
        }
      ],
      "groups": [],
      "unknowns": []
    },
  },
  'Getting Ahead': {
    kind: 'quest', accessPolicy: 'locations',
    id: 'Getting Ahead', name: 'Getting Ahead',
    regions: ['Kebos Lowlands', 'Molch'],
    locations: [{"id": "river-molch-homestead","label": "River Molch homestead","standardAreas": ["Molch"],"chunkOptions": [{"cx": 19,"cy": 57}]},{"id": "getting-ahead-cave","label": "Kebos cave entrance","standardAreas": ["Kebos Lowlands"],"chunkOptions": [{"cx": 18,"cy": 56}]}],
    skills: { 'Construction': 26, 'Crafting': 30 }, prereqs: [], points: 1, series: 'Twisted Tales',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'A Night at the Theatre': {
    kind: 'quest', accessPolicy: "regions",
    id: 'A Night at the Theatre', name: 'A Night at the Theatre',
    regions: ['Mort Myre Swamp', 'Ver Sinhaza'],
    skills: {}, prereqs: ['A Taste of Hope'], points: 2,
    chunkedGeography: {"locations":[{"id":"ver-sinhaza","label":"Ver Sinhaza","chunkOptions":[{"cx":57,"cy":50}]},{"id":"sisterhood-sanctuary-entrance","label":"Sisterhood Sanctuary entrance","chunkOptions":[{"cx":58,"cy":51}]},{"id":"nature-grotto-entrance","label":"Nature Grotto entrance","chunkOptions":[{"cx":53,"cy":52}]},{"id":"hespori-clearing","label":"Hespori clearing","chunkOptions":[{"cx":54,"cy":52}]},{"id":"araxyte-cave","label":"Araxyte cave entrance","chunkOptions":[{"cx":57,"cy":53}]}],"groups":[],"unknowns":[]},
    difficulty: DropSource.QUEST_MASTER
  },
  'The Blood Moon Rises': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"icyene-graveyard","label":"Icyene Graveyard","standardAreas":["Icyene Graveyard"],"chunkOptions":[{"cx":57,"cy":49}]},
      {"id":"old-man-ral-hideout-entrance","label":"Old Man Ral hideout entrance","standardAreas":["Meiyerditch"],"chunkOptions":[{"cx":56,"cy":50}]},
      {"id":"slepe-church","label":"Slepe church","standardAreas":["Slepe"],"chunkOptions":[{"cx":58,"cy":51}]},
      {"id":"crombwick-manor","label":"Crombwick Manor","standardAreas":["Slepe"],"chunkOptions":[{"cx":58,"cy":52}]},
      {"id":"paterdomus-entrance","label":"Paterdomus entrance","standardAreas":["Paterdomus"],"chunkOptions":[{"cx":53,"cy":54}]},
      {"id":"haunted-woods","label":"Haunted Woods","standardAreas":["Haunted Woods"],"chunkOptions":[{"cx":56,"cy":53}]},
      {"id":"burgh-de-rott-hideout","label":"Burgh de Rott hideout","standardAreas":["Burgh de Rott"],"chunkOptions":[{"cx":54,"cy":50}]},
      {"id":"theatre-of-blood","label":"Theatre of Blood","standardAreas":["Ver Sinhaza"],"chunkOptions":[{"cx":57,"cy":50}]},
      {"id":"abandoned-laboratory-entrance","label":"Abandoned laboratory entrance","standardAreas":["Burgh de Rott"],"chunkOptions":[{"cx":55,"cy":50}]},
      {"id":"barrows-broken-fence","label":"Barrows broken fence","standardAreas":["Barrows"],"chunkOptions":[{"cx":55,"cy":51}]},
    ],
    id: 'The Blood Moon Rises', name: 'The Blood Moon Rises',
    regions: ['Paterdomus', 'Icyene Graveyard', 'Meiyerditch', 'Darkmeyer', 'Slepe', 'Ver Sinhaza', 'Burgh de Rott', 'Barrows'],
    skills: { 'Slayer': 74, 'Woodcutting': 74, 'Smithing': 72, 'Cooking': 72, 'Fletching': 70, 'Mining': 66, 'Hunter': 65, 'Crafting': 64, 'Herblore': 64, 'Magic': 57 },
    prereqs: ['A Night at the Theatre', 'Sins of the Father'],
    points: 4, series: 'Myreque',
    difficulty: DropSource.QUEST_GRANDMASTER
  },
  'A Kingdom Divided': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"kingstown","label":"Kingstown","standardAreas":["Hosidius"],"chunkOptions":[{"cx":26,"cy":57}]},
      {"id":"kourend-castle","label":"Kourend Castle","standardAreas":["Kourend Castle"],"chunkOptions":[{"cx":25,"cy":57}]},
      {"id":"lovakengj-tavern","label":"Lovakengj tavern","standardAreas":["Lovakengj"],"chunkOptions":[{"cx":24,"cy":58}]},
      {"id":"piscarilius-docks","label":"Piscarilius docks","standardAreas":["Piscarilius"],"chunkOptions":[{"cx":28,"cy":57}]},
      {"id":"arceuus-library","label":"Arceuus Library","standardAreas":["Arceuus"],"chunkOptions":[{"cx":25,"cy":59}]},
      {"id":"forthos-ruins","label":"Forthos Ruins","standardAreas":["Hosidius"],"chunkOptions":[{"cx":26,"cy":55}]},
      {"id":"settlement-ruins","label":"Settlement Ruins","standardAreas":["Arceuus"],"chunkOptions":[{"cx":24,"cy":60}]},
      {"id":"legless-faun","label":"Legless Faun","standardAreas":["Piscarilius"],"chunkOptions":[{"cx":27,"cy":57}]},
      {"id":"rose-shack","label":"Rose shack","standardAreas":["Kebos Lowlands"],"chunkOptions":[{"cx":20,"cy":58}]},
      {"id":"lizard-dwelling","label":"Lizard dwelling","standardAreas":["Molch"],"chunkOptions":[{"cx":20,"cy":57}]},
      {"id":"kebos-egg-nest","label":"Kebos egg nest","standardAreas":["Kebos Lowlands"],"chunkOptions":[{"cx":19,"cy":56}]},
      {"id":"rose-burial","label":"Rose burial","standardAreas":["Kebos Lowlands"],"chunkOptions":[{"cx":19,"cy":58}]},
      {"id":"tower-of-magic","label":"Tower of Magic","standardAreas":["Arceuus"],"chunkOptions":[{"cx":24,"cy":59}]},
      {"id":"lord-hosidius-house","label":"Lord Hosidius house","standardAreas":["Hosidius"],"chunkOptions":[{"cx":27,"cy":55}]},
      {"id":"lovakengj-assembly","label":"Lovakengj Assembly","standardAreas":["Lovakengj"],"chunkOptions":[{"cx":23,"cy":58}]},
      {"id":"piscarilius-warrens-entrance","label":"Piscarilius Warrens entrance","standardAreas":["Piscarilius"],"chunkOptions":[{"cx":28,"cy":58}]},
      {"id":"shayzien-war-tent","label":"Shayzien war tent","standardAreas":["Shayzien"],"chunkOptions":[{"cx":23,"cy":56}]},
      {"id":"xerics-lookout","label":"Xerics Lookout","standardAreas":["Shayzien"],"chunkOptions":[{"cx":24,"cy":55}]},
      {"id":"mount-karuulm-elevator","label":"Mount Karuulm elevator","standardAreas":["Mount Karuulm"],"chunkOptions":[{"cx":20,"cy":59}]},
      {"id":"doors-of-dinh","label":"Doors of Dinh","standardAreas":["Wintertodt Camp"],"chunkOptions":[{"cx":25,"cy":61}]},
      {"id":"woodland-barbarian-prison","label":"Woodland barbarian prison","standardAreas":["Hosidius"],"chunkOptions":[{"cx":24,"cy":53}]},
      {"id":"shayzien-prison","label":"Shayzien prison","standardAreas":["Shayzien"],"chunkOptions":[{"cx":22,"cy":55}]},
      {"id":"shayzien-graveyard","label":"Shayzien graveyard","standardAreas":["Shayzien"],"chunkOptions":[{"cx":23,"cy":55}]},
      {"id":"arceuus-church","label":"Arceuus church","standardAreas":["Arceuus"],"chunkOptions":[{"cx":26,"cy":59}]},
      {"id":"chasm-of-fire-entrance","label":"Chasm of Fire entrance","standardAreas":["Shayzien"],"chunkOptions":[{"cx":22,"cy":57}]},
      {"id":"hosidius-vinery","label":"Hosidius vinery","standardAreas":["Hosidius"],"chunkOptions":[{"cx":28,"cy":55}]},
    ],
    id: 'A Kingdom Divided', name: 'A Kingdom Divided',
    regions: ['Shayzien', 'Lovakengj', 'Hosidius', 'Arceuus', 'Piscarilius'],
    skills: { 'Agility': 54, 'Thieving': 52, 'Woodcutting': 52, 'Herblore': 50, 'Mining': 42, 'Crafting': 38, 'Magic': 35 }, prereqs: ['The Depths of Despair', 'The Queen of Thieves', 'Tale of the Righteous', 'The Forsaken Tower', 'The Ascent of Arceuus'], points: 2, series: 'Great Kourend',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Land of the Goblins': {
    kind: 'quest', accessPolicy: "regions",
    id: 'Land of the Goblins', name: 'Land of the Goblins',
    regions: ['Hemenster', 'Lumbridge', 'Crafting Guild', 'Goblin Village'],
    skills: { 'Agility': 38, 'Thieving': 45, 'Fishing': 40, 'Herblore': 48 }, prereqs: ['Another Slice of H.A.M.', 'Fishing Contest'], points: 2,
    chunkedGeography: {"locations":[{"id":"candidate-2","label":"Goblin cave","chunkOptions":[{"cx":41,"cy":53}]},{"id":"candidate-3","label":"Makeover Mage","chunkOptions":[{"cx":45,"cy":51}]},{"id":"candidate-4","label":"Aggie","chunkOptions":[{"cx":48,"cy":50}]}],"groups":[],"unknowns":["Dorgesh-Kaan and machine access"]}, series: 'Dorgeshuun',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Temple of the Eye': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"al-kharid","label":"Al Kharid","standardAreas":["Al Kharid"],"chunkOptions":[{"cx":51,"cy":50}]},
      {"id":"varrock-chaos-temple","label":"Varrock chaos temple","standardAreas":["Varrock"],"chunkOptions":[{"cx":50,"cy":52}]},
      {"id":"varrock-tea-seller","label":"Varrock tea seller","standardAreas":["Varrock"],"chunkOptions":[{"cx":51,"cy":53}]},
      {"id":"wizards-tower","label":"Wizards' Tower","standardAreas":["Wizards' Tower"],"chunkOptions":[{"cx":48,"cy":49}]},
    ],
    id: 'Temple of the Eye', name: 'Temple of the Eye',
    regions: ['Al Kharid', 'Wizards\' Tower', 'Varrock'],
    skills: { 'Runecraft': 10 }, prereqs: ['Enter the Abyss'], points: 1, series: 'Order of Wizards',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Beneath Cursed Sands': {
    kind: 'quest', accessPolicy: "regions",

    id: 'Beneath Cursed Sands', name: 'Beneath Cursed Sands',
    regions: ['Sophanem'],
    skills: { 'Agility': 62, 'Crafting': 55, 'Firemaking': 55 }, prereqs: ['Contact!'], points: 2,
    chunkedGeography: {"locations":[{"id":"sophanem","label":"Sophanem","chunkOptions":[{"cx":51,"cy":43}]},{"id":"maisa-campsite","label":"Maisa campsite","chunkOptions":[{"cx":52,"cy":43}]},{"id":"jaltevas-pyramid","label":"Jaltevas Pyramid","chunkOptions":[{"cx":52,"cy":42}]},{"id":"west-necropolis","label":"West Necropolis","chunkOptions":[{"cx":51,"cy":42}]},{"id":"ullek-ritual-pillar","label":"Ullek ritual pillar","chunkOptions":[{"cx":53,"cy":43}]},{"id":"ullek-tomb-entrance","label":"Ullek tomb entrance","chunkOptions":[{"cx":53,"cy":44}]},{"id":"nardah","label":"Nardah","chunkOptions":[{"cx":53,"cy":45}]},{"id":"river-elid-lily","label":"River Elid lily","chunkOptions":[{"cx":52,"cy":45}]}],"groups":[],"unknowns":[]}, series: 'Kharidian',
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
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"location-1","label":"Kebos camp garden","standardAreas":["Kebos Lowlands"],"chunkOptions":[{"cx":20,"cy":54}]},
      {"id":"location-2","label":"Molch Island garden","standardAreas":["Molch"],"chunkOptions":[{"cx":21,"cy":56}]},
      {"id":"location-3","label":"Xeric shrine garden","standardAreas":["Molch"],"chunkOptions":[{"cx":20,"cy":56}]},
      {"id":"location-4","label":"Morra garden","standardAreas":["Shayzien"],"chunkOptions":[{"cx":22,"cy":54}]},
    ],
    id: 'The Garden of Death', name: 'The Garden of Death',
    regions: ['Molch'],
    skills: { 'Farming': 20 }, prereqs: [], points: 1, series: 'Twisted Tales',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Secrets of the North': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"carnillean-mansion","label":"Carnillean Mansion","standardAreas":["East Ardougne"],"chunkOptions":[{"cx":40,"cy":51}]},
      {"id":"fight-arena-bar","label":"Fight Arena bar","standardAreas":["Fight Arena"],"chunkOptions":[{"cx":40,"cy":49}]},
      {"id":"evelot-trail-and-hazeel-cave","label":"Evelot trail and Hazeel cave","standardAreas":["East Ardougne"],"chunkOptions":[{"cx":40,"cy":50}]},
      {"id":"evelot-encounter","label":"Evelot encounter","standardAreas":["East Ardougne"],"chunkOptions":[{"cx":41,"cy":50}]},
      {"id":"north-weiss","label":"North Weiss","standardAreas":["Weiss"],"chunkOptions":[{"cx":45,"cy":61}]},
      {"id":"weiss-cave-entrance","label":"Weiss cave entrance","standardAreas":["Weiss"],"chunkOptions":[{"cx":44,"cy":61}]},
    ],
    id: 'Secrets of the North', name: 'Secrets of the North',
    regions: ['East Ardougne', 'Weiss'],
    skills: { 'Agility': 69, 'Thieving': 64, 'Hunter': 56 },
    prereqs: ['Hazeel Cult', 'The General\'s Shadow', 'Making Friends with My Arm'], points: 2, series: 'Mahjarrat',
    difficulty: DropSource.QUEST_MASTER
  },
  'Desert Treasure II': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"ancient-vault","label":"Ancient Vault","standardAreas":["Nardah"],"chunkOptions":[{"cx":54,"cy":46}]},
      {"id":"exam-centre","label":"Exam Centre","standardAreas":["Digsite"],"chunkOptions":[{"cx":52,"cy":52}]},
      {"id":"digsite-winch","label":"Digsite winch","standardAreas":["Digsite"],"chunkOptions":[{"cx":52,"cy":53}]},
      {"id":"wizards-tower","label":"Wizards' Tower","standardAreas":["Wizards' Tower"],"chunkOptions":[{"cx":48,"cy":49}]},
      {"id":"weiss-cave-entrance","label":"Weiss cave entrance","standardAreas":["Weiss"],"chunkOptions":[{"cx":44,"cy":61}]},
      {"id":"camdozaal-entrance","label":"Camdozaal entrance","standardAreas":["Goblin Village"],"chunkOptions":[{"cx":46,"cy":54}]},
      {"id":"lovakengj-historian","label":"Lovakengj historian","standardAreas":["Lovakengj"],"chunkOptions":[{"cx":22,"cy":59}]},
      {"id":"kasonde-s-house","label":"Kasonde's house","standardAreas":["Hosidius"],"chunkOptions":[{"cx":27,"cy":56}]},
      {"id":"stranglewood-entrance","label":"Stranglewood entrance","standardAreas":["The Stranglewood"],"chunkOptions":[{"cx":19,"cy":54}]},
      {"id":"stranglewood-temple","label":"Stranglewood temple","standardAreas":["The Stranglewood"],"chunkOptions":[{"cx":18,"cy":53}]},
      {"id":"stranglewood-herb","label":"Stranglewood herb","standardAreas":["The Stranglewood"],"chunkOptions":[{"cx":17,"cy":53}]},
      {"id":"stranglewood-berry","label":"Stranglewood berry","standardAreas":["The Stranglewood"],"chunkOptions":[{"cx":17,"cy":51}]},
    ],
    id: 'Desert Treasure II', name: 'Desert Treasure II - The Fallen Empire',
    regions: ['Nardah', 'Goblin Village', 'Weiss', 'The Stranglewood', 'Digsite'],
    skills: { 'Magic': 75, 'Firemaking': 75, 'Thieving': 70, 'Herblore': 62, 'Runecraft': 60, 'Construction': 60 }, prereqs: ['Desert Treasure I', 'Secrets of the North', 'Enakhra\'s Lament', 'Temple of the Eye', 'The Garden of Death', 'Below Ice Mountain'], points: 5, series: 'Mahjarrat',
    difficulty: DropSource.QUEST_GRANDMASTER
  },
  'The Path of Glouphrie': {
    kind: 'quest', accessPolicy: "regions",
    id: 'The Path of Glouphrie', name: 'The Path of Glouphrie',
    regions: ['Gnome Village', 'Feldip Hills'],
    skills: { 'Strength': 60, 'Slayer': 56, 'Thieving': 56, 'Ranged': 47, 'Agility': 45 }, prereqs: ['The Eyes of Glouphrie', 'Waterfall Quest', 'Tree Gnome Village'], points: 2,
    chunkedGeography: {"locations":[{"id":"tree-gnome-village","label":"Tree Gnome Village","chunkOptions":[{"cx":39,"cy":49}]},{"id":"grand-tree","label":"Grand Tree","chunkOptions":[{"cx":38,"cy":54}]},{"id":"hazelmere-s-house","label":"Hazelmere's house","chunkOptions":[{"cx":41,"cy":48}]},{"id":"poison-waste","label":"Longramble and Poison Waste sewer entrance","chunkOptions":[{"cx":36,"cy":48}]}],"groups":[],"unknowns":[]}, series: 'Gnome',
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
  ,
    // Source-reconciled completion destinations; Standard policy remains unchanged.
    chunkedGeography: {
      "locations": [
        {
          "id": "varrock-square",
          "label": "Varrock square",
          "chunkOptions": [
            {
              "cx": 50,
              "cy": 53
            }
          ]
        },
        {
          "id": "varrock-palace",
          "label": "Varrock Palace",
          "chunkOptions": [
            {
              "cx": 50,
              "cy": 54
            }
          ]
        }
      ],
      "groups": [],
      "unknowns": [
        "The mandatory tailing sequence crosses the southern Varrock boundary in the source path; exact allowed player positions during the follow step require reconciliation."
      ]
    },
  },
  'Defender of Varrock': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"location-1","label":"Jolly Boar Inn and tracking","standardAreas":["Varrock"],"chunkOptions":[{"cx":51,"cy":54}]},
      {"id":"location-2","label":"Varrock north tracking / palace","standardAreas":["Varrock"],"chunkOptions":[{"cx":50,"cy":54}]},
      {"id":"location-3","label":"Zemouregal base entrance","standardAreas":["Silvarea"],"chunkOptions":[{"cx":52,"cy":54}]},
      {"id":"location-4","label":"Camdozaal entrance","standardAreas":["Goblin Village"],"chunkOptions":[{"cx":46,"cy":54}]},
      {"id":"location-5","label":"Varrock Square candidates","standardAreas":["Varrock"],"chunkOptions":[{"cx":50,"cy":53}]},
      {"id":"location-6","label":"Dimintheis house","standardAreas":["Varrock"],"chunkOptions":[{"cx":51,"cy":53}]},
    ],
    id: 'Defender of Varrock', name: 'Defender of Varrock',
    regions: ['Varrock', 'Goblin Village'],
    skills: { 'Smithing': 55, 'Hunter': 52 }, prereqs: ['Shield of Arrav', 'Romeo & Juliet', 'Demon Slayer', 'Temple of Ikov', 'Below Ice Mountain', 'Family Crest', 'Garden of Tranquillity', 'What Lies Below'], points: 2, series: 'Mahjarrat',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Twilight\'s Promise': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"location-1","label":"Sunrise Palace","standardAreas":["Civitas illa Fortis"],"chunkOptions":[{"cx":26,"cy":49}]},
      {"id":"location-2","label":"Fortis temple and bazaar","standardAreas":["Civitas illa Fortis"],"chunkOptions":[{"cx":26,"cy":48}]},
      {"id":"location-3","label":"Fortis knight and pub","standardAreas":["Civitas illa Fortis"],"chunkOptions":[{"cx":27,"cy":48}]},
      {"id":"location-4","label":"Cothon crate","standardAreas":["Civitas illa Fortis"],"chunkOptions":[{"cx":27,"cy":49}]},
      {"id":"location-5","label":"Colosseum entrance","standardAreas":["Civitas illa Fortis"],"chunkOptions":[{"cx":28,"cy":48}]},
      {"id":"location-6","label":"Fortis fountain","standardAreas":["Civitas illa Fortis"],"chunkOptions":[{"cx":27,"cy":47}]},
      {"id":"location-7","label":"Kualti headquarters","standardAreas":["Civitas illa Fortis"],"chunkOptions":[{"cx":25,"cy":49}]},
      {"id":"location-8","label":"Teomat","standardAreas":["Ralos' Rise"],"chunkOptions":[{"cx":22,"cy":49}]},
    ],
    id: 'Twilight\'s Promise', name: 'Twilight\'s Promise',
    regions: ['Ralos\' Rise', 'Civitas illa Fortis'],
    skills: {}, prereqs: ['Children of the Sun'], points: 1, series: 'Twilight Emissaries',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'At First Light': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"hunter-guild","label":"Hunter Guild","standardAreas":["Hunter's Guild"],"chunkOptions":[{"cx":24,"cy":47}]},
      {"id":"hunter-fox-and-crevice","label":"Hunter Fox and crevice","standardAreas":["Avium Savannah"],"chunkOptions":[{"cx":25,"cy":46}]},
      {"id":"locus-oasis","label":"Locus Oasis","standardAreas":["Avium Savannah"],"chunkOptions":[{"cx":26,"cy":46}]},
      {"id":"atza-workshop","label":"Atza workshop","standardAreas":["Civitas illa Fortis"],"chunkOptions":[{"cx":26,"cy":47}]},
    ],
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
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"locus-oasis","label":"Locus Oasis","standardAreas":["Avium Savannah"],"chunkOptions":[{"cx":26,"cy":46}]},
    ],
    id: 'The Ribbiting Tale', name: 'The Ribbiting Tale of a Lily Pad Labour Dispute',
    regions: ['Avium Savannah'],
    skills: { 'Woodcutting': 15 }, prereqs: ['Children of the Sun'], points: 1,
    difficulty: DropSource.QUEST_NOVICE
  },
  'While Guthix Sleeps': {
    kind: 'quest', accessPolicy: "regions",
    id: 'While Guthix Sleeps', name: 'While Guthix Sleeps',
    regions: ['Edgeville', 'Draynor Village', 'Warriors\' Guild', 'Taverley', 'Falador', 'Port Sarim'],
    skills: { 'Quest Points': 180, 'Thieving': 72, 'Magic': 67, 'Agility': 66, 'Farming': 65, 'Herblore': 65, 'Hunter': 62 },
    manualRequirements: ["Warriors' Guild access with Attack + Strength at least 130, or 99 Attack, or 99 Strength"],
    prereqs: [
      'Defender of Varrock', 'The Path of Glouphrie', 'Fight Arena', 'Dream Mentor',
      'The Hand in the Sand', 'Wanted!', 'Temple of the Eye', 'Tears of Guthix',
      'Nature Spirit', 'A Tail of Two Cats'
    ],
    points: 5,
    chunkedGeography: {"locations":[{"id":"taverley-ivy-and-thaerisk","label":"Taverley Ivy and Thaerisk","chunkOptions":[{"cx":45,"cy":53}]},{"id":"khazard-launderer","label":"Khazard Launderer","chunkOptions":[{"cx":40,"cy":49}]},{"id":"feldip-hunting-expert-and-broav-trap","label":"Feldip Hunting Expert and broav trap","chunkOptions":[{"cx":39,"cy":45}]},{"id":"movario-broken-table-entrance","label":"Movario broken table entrance","chunkOptions":[{"cx":39,"cy":50}]},{"id":"mcgrubor-wood-mercenaries","label":"McGrubor Wood mercenaries","chunkOptions":[{"cx":41,"cy":54}]},{"id":"falador-castle","label":"Falador Castle","chunkOptions":[{"cx":46,"cy":52}]},{"id":"draynor-shady-stranger","label":"Draynor shady stranger","chunkOptions":[{"cx":48,"cy":50}]},{"id":"port-sarim-betty","label":"Port Sarim Betty","chunkOptions":[{"cx":47,"cy":50}]},{"id":"warriors-guild-recruits","label":"Warriors Guild recruits","chunkOptions":[{"cx":44,"cy":55}]},{"id":"black-knights-fortress-entrance","label":"Black Knights Fortress entrance","chunkOptions":[{"cx":47,"cy":54}]}],"groups":[{"id":"tears-of-guthix-entry","label":"Reach Movario near Juna","routes":[{"id":"swamp-cave","label":"swamp-cave","locations":[{"id":"lumbridge-swamp-cave-entrance","label":"Lumbridge Swamp cave entrance","chunkOptions":[{"cx":49,"cy":49}]}],"unknowns":["Usable Swamp cave passage"]},{"id":"games-necklace","label":"games-necklace","locations":[],"unknowns":["Usable Games necklace Tears of Guthix teleport"]}]},{"id":"lunar-spellbook-activation","label":"Activate Lunar spellbook for required NPC Contact","routes":[{"id":"astral-altar","label":"astral-altar","locations":[{"id":"astral-altar","label":"Astral altar","chunkOptions":[{"cx":33,"cy":60}]}],"unknowns":[]},{"id":"poh-altar-or-magic-cape","label":"poh-altar-or-magic-cape","locations":[],"unknowns":["Usable POH altar or Magic cape switch"]}]}],"unknowns":["Use NPC Contact for recruitment","Lucien camp teleorb and chapel route"]}, series: 'Mahjarrat',
    difficulty: DropSource.QUEST_GRANDMASTER
  },
  'The Heart of Darkness': {
    kind: 'quest', accessPolicy: "regions",

    id: 'The Heart of Darkness', name: 'The Heart of Darkness',
    regions: ['Ralos\' Rise', 'Civitas illa Fortis'],
    skills: { 'Mining': 55, 'Thieving': 48, 'Slayer': 48, 'Agility': 46 }, prereqs: ['Twilight\'s Promise'], points: 2,
    chunkedGeography: {"locations":[{"id":"teomat","label":"Teomat","chunkOptions":[{"cx":22,"cy":49}]},{"id":"quetzacalli-gorge","label":"Quetzacalli Gorge","chunkOptions":[{"cx":23,"cy":50}]},{"id":"tower-of-ascension","label":"Tower of Ascension","chunkOptions":[{"cx":25,"cy":50}]},{"id":"tapoyauik-temple-and-ruin-entrance","label":"Tapoyauik Temple and ruin entrance","chunkOptions":[{"cx":26,"cy":50}]},{"id":"fortis-palace","label":"Fortis palace","chunkOptions":[{"cx":26,"cy":49}]}],"groups":[],"unknowns":[]}, series: 'Twilight Emissaries',
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
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"location-1","label":"Emelio and Renata","standardAreas":["Civitas illa Fortis"],"chunkOptions":[{"cx":27,"cy":48}]},
      {"id":"location-2","label":"Fortis spice merchant","standardAreas":["Civitas illa Fortis"],"chunkOptions":[{"cx":26,"cy":48}]},
      {"id":"location-3","label":"Alba farmhouse","standardAreas":["Civitas illa Fortis"],"chunkOptions":[{"cx":24,"cy":48}]},
      {"id":"location-4","label":"Wolf Den entrance","standardAreas":["Cam Torum"],"chunkOptions":[{"cx":23,"cy":48}]},
      {"id":"location-5","label":"Fortis Colosseum entrance","standardAreas":["Civitas illa Fortis"],"chunkOptions":[{"cx":28,"cy":48}]},
    ],
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
  ,
    // Source-reconciled completion destinations; Standard policy remains unchanged.
    chunkedGeography: {
      "locations": [
        {
          "id": "grand-museum",
          "label": "Grand Museum in Civitas illa Fortis",
          "chunkOptions": [
            {
              "cx": 26,
              "cy": 49
            }
          ]
        },
        {
          "id": "fortis-cothon",
          "label": "Fortis Cothon",
          "chunkOptions": [
            {
              "cx": 27,
              "cy": 48
            }
          ]
        },
        {
          "id": "port-sarim-betty",
          "label": "Betty's shop in Port Sarim",
          "chunkOptions": [
            {
              "cx": 47,
              "cy": 50
            }
          ]
        },
        {
          "id": "varrock-museum",
          "label": "Varrock Museum",
          "chunkOptions": [
            {
              "cx": 50,
              "cy": 53
            }
          ]
        },
        {
          "id": "storeroom",
          "label": "Varrock Museum northeast storeroom",
          "chunkOptions": [
            {
              "cx": 51,
              "cy": 54
            }
          ]
        }
      ],
      "groups": [],
      "unknowns": [
        "Trader Stan’s clue accepts alternate charter crewmembers at multiple ports; the full set of equivalent legal conversation destinations is not yet modeled."
      ]
    },
  },
  'The Curse of Arrav': {
    kind: 'quest', accessPolicy: "regions",

    id: 'The Curse of Arrav', name: 'The Curse of Arrav',
    regions: ['Varrock', 'Ruins of Uzer', 'Mountain Camp'],
    skills: { 'Agility': 61, 'Ranged': 62, 'Strength': 58, 'Thieving': 62, 'Mining': 64, 'Slayer': 37 }, prereqs: ['Defender of Varrock', 'Troll Romance'], points: 2,
    chunkedGeography: {"locations":[{"id":"location-1","label":"Elias and Uzer Mastaba","chunkOptions":[{"cx":54,"cy":47}]},{"id":"location-2","label":"Trollweiss approach cave","chunkOptions":[{"cx":44,"cy":58}]},{"id":"location-3","label":"Trollweiss cave entrance","chunkOptions":[{"cx":43,"cy":60}]},{"id":"location-4","label":"Arrav stronghold","chunkOptions":[{"cx":44,"cy":60}]},{"id":"location-5","label":"Zemouregal base entrance","chunkOptions":[{"cx":52,"cy":54}]}],"groups":[],"unknowns":[]}, series: 'Mahjarrat',
    difficulty: DropSource.QUEST_MASTER
  },
  'The Final Dawn': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"location-1","label":"Sunrise Palace","standardAreas":["Civitas illa Fortis"],"chunkOptions":[{"cx":26,"cy":49}]},
      {"id":"location-2","label":"Twilight Temple entrance","standardAreas":["Ralos' Rise"],"chunkOptions":[{"cx":26,"cy":50}]},
      {"id":"location-3","label":"Captain Vibia hideout","standardAreas":["Civitas illa Fortis"],"chunkOptions":[{"cx":25,"cy":48}]},
      {"id":"location-4","label":"Cam Torum entrance","standardAreas":["Cam Torum"],"chunkOptions":[{"cx":22,"cy":48}]},
      {"id":"location-5","label":"Tal Teklan","standardAreas":["Tlati Rainforest"],"chunkOptions":[{"cx":19,"cy":48}]},
      {"id":"location-6","label":"Crypt of Tonali entrance","standardAreas":["Tlati Rainforest"],"chunkOptions":[{"cx":20,"cy":47}]},
    ],
    id: 'The Final Dawn', name: 'The Final Dawn',
    regions: ['Tlati Rainforest', 'Civitas illa Fortis', 'Ralos\' Rise'],
    skills: { 'Thieving': 66, 'Fletching': 52, 'Runecraft': 52 }, prereqs: ['The Heart of Darkness', 'Perilous Moons'], points: 3, series: 'Twilight Emissaries',
    difficulty: DropSource.QUEST_MASTER
  },
  'Shadows of Custodia': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"auburnvale","label":"Auburnvale","standardAreas":["Auburnvale"],"chunkOptions":[{"cx":21,"cy":52}]},
      {"id":"custodia-cave-entrance","label":"Custodia cave entrance","standardAreas":["Auburnvale"],"chunkOptions":[{"cx":20,"cy":52}]},
      {"id":"ictus-in-east-auburnvale","label":"Ictus in east Auburnvale","standardAreas":["Auburnvale"],"chunkOptions":[{"cx":22,"cy":52}]},
    ],
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
  ,
    // Source-reconciled completion destinations; Standard policy remains unchanged.
    chunkedGeography: {
      "locations": [
        {
          "id": "tal-teklan-dock",
          "label": "Tal Teklan dock",
          "chunkOptions": [
            {
              "cx": 18,
              "cy": 48
            }
          ]
        },
        {
          "id": "tal-teok",
          "label": "Tal Teok and Tal Teklan",
          "chunkOptions": [
            {
              "cx": 19,
              "cy": 49
            }
          ]
        },
        {
          "id": "tlati-rainforest",
          "label": "Central Tlati Rainforest",
          "chunkOptions": [
            {
              "cx": 20,
              "cy": 48
            }
          ]
        },
        {
          "id": "tal-teklan",
          "label": "Tal Teklan quest contacts",
          "chunkOptions": [
            {
              "cx": 19,
              "cy": 48
            }
          ]
        }
      ],
      "groups": [],
      "unknowns": []
    },
  },
  'Pandemonium': {
    kind: 'quest', accessPolicy: 'locations',
    id: 'Pandemonium', name: 'Pandemonium',
    regions: [],
    locations: [LOCATIONS.portSarim],
    skills: {}, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_NOVICE
  ,
    // Source-reconciled completion destinations; Standard policy remains unchanged.
    chunkedGeography: {
      "locations": [
        {
          "id": "will",
          "label": "Will and Anne — Port Sarim",
          "chunkOptions": [
            {
              "cx": 47,
              "cy": 50
            }
          ]
        },
        {
          "id": "cargo",
          "label": "Port Sarim cargo dock",
          "chunkOptions": [
            {
              "cx": 47,
              "cy": 49
            }
          ]
        },
        {
          "id": "pandemonium",
          "label": "Pandemonium quest contacts and delivery",
          "chunkOptions": [
            {
              "cx": 47,
              "cy": 46
            }
          ]
        }
      ],
      "groups": [],
      "unknowns": [
        "The mandatory sailing legs and shipyard instance access require a legal route check; owning their destination chunks does not prove the voyage is possible.",
        "The mandatory shipwreck destination at 3031,3039 corresponds to 47,47, which is absent from the canonical ownership map; it cannot be replaced by an unrelated land chunk."
      ]
    },
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
  ,
    // Source-reconciled completion destinations; Standard policy remains unchanged.
    chunkedGeography: {
      "locations": [
        {
          "id": "the-pandemonium",
          "label": "The Pandemonium",
          "chunkOptions": [
            {
              "cx": 47,
              "cy": 46
            }
          ]
        },
        {
          "id": "port-sarim-docks",
          "label": "Port Sarim docks",
          "chunkOptions": [
            {
              "cx": 47,
              "cy": 49
            }
          ]
        },
        {
          "id": "thurgos-hut",
          "label": "Thurgo's hut south of Port Sarim",
          "chunkOptions": [
            {
              "cx": 46,
              "cy": 49
            }
          ]
        }
      ],
      "groups": [],
      "unknowns": [
        "The mandatory cargo delivery and sailing access to the sea crate need a legal sailing-route check, not only destination ownership."
      ]
    },
  },
  'Current Affairs': {
    kind: 'quest', accessPolicy: "regions",
    id: 'Current Affairs', name: 'Current Affairs',
    regions: ['Catherby'],
    skills: { 'Sailing': 22, 'Fishing': 10 }, prereqs: ['Pandemonium'], points: 1,
    chunkedGeography: {"locations":[{"id":"catherby-docks","label":"Catherby docks","chunkOptions":[{"cx":43,"cy":53}]},{"id":"catherby-east","label":"Catherby east","chunkOptions":[{"cx":44,"cy":53}]},{"id":"duck-endpoint","label":"Current duck endpoint","chunkOptions":[{"cx":43,"cy":51}]}],"groups":[],"unknowns":[]},
    difficulty: DropSource.QUEST_NOVICE
  },
  'Troubled Tortugans': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"remote-island","label":"Remote Island","standardAreas":["Remote Island"],"chunkOptions":[{"cx":46,"cy":40}]},
      {"id":"summer-shore-docks","label":"Summer Shore docks","standardAreas":["The Summer Shore"],"chunkOptions":[{"cx":49,"cy":37}]},
      {"id":"west-summer-shore","label":"West Summer Shore","standardAreas":["The Summer Shore"],"chunkOptions":[{"cx":48,"cy":37}]},
      {"id":"great-conch-western-trail","label":"Great Conch western trail","standardAreas":["The Great Conch"],"chunkOptions":[{"cx":48,"cy":38}]},
      {"id":"great-conch-grove","label":"Great Conch grove","standardAreas":["The Great Conch"],"chunkOptions":[{"cx":49,"cy":38}]},
      {"id":"little-pearl","label":"Little Pearl","standardAreas":["The Little Pearl"],"chunkOptions":[{"cx":52,"cy":34}]},
    ],
    id: 'Troubled Tortugans', name: 'Troubled Tortugans',
    regions: ['Remote Island', 'The Summer Shore', 'The Great Conch', 'The Little Pearl'],
    skills: { 'Slayer': 51, 'Construction': 48, 'Sailing': 45, 'Hunter': 45, 'Woodcutting': 40, 'Crafting': 34 }, prereqs: ['Pandemonium'], points: 1, series: 'Tortugan',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'The Red Reef': {
    kind: 'quest', accessPolicy: "regions",

    id: 'The Red Reef', name: 'The Red Reef',
    regions: ['Last Light'],
    skills: { Sailing: 52, Smithing: 48 }, prereqs: ['Troubled Tortugans'], points: 2,
    chunkedGeography: {"locations":[{"id":"great-conch-town","label":"Great Conch town","chunkOptions":[{"cx":49,"cy":37}]},{"id":"sacred-grove","label":"Sacred Grove","chunkOptions":[{"cx":49,"cy":38}]},{"id":"red-rock","label":"Red Rock","chunkOptions":[{"cx":43,"cy":39}]},{"id":"last-light","label":"Last Light","chunkOptions":[{"cx":44,"cy":36}]},{"id":"great-conch-dock","label":"Great Conch dock","chunkOptions":[{"cx":49,"cy":36}]}],"groups":[],"unknowns":["Reach and dive from the Zenith"]}, series: 'Tortugan',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'The Ides of Milk': {
    kind: 'quest', accessPolicy: 'locations',
    locations: [
      {"id":"cassius-s-pond","label":"Cassius's pond","standardAreas":["Lumbridge"],"chunkOptions":[{"cx":49,"cy":51}]},
      {"id":"gillie-s-cow-field","label":"Gillie's cow field","standardAreas":["Lumbridge"],"chunkOptions":[{"cx":50,"cy":51}]},
      {"id":"lumbridge-castle","label":"Lumbridge Castle","standardAreas":["Lumbridge"],"chunkOptions":[{"cx":50,"cy":50}]},
    ],
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
    kind: 'miniquest', accessPolicy: "regions",
    id: 'Barbarian Training', name: 'Barbarian Training',
    regions: ['Baxtorian Falls'],
    skills: { 'Fishing': 55, 'Firemaking': 35, 'Strength': 35, 'Agility': 15, 'Farming': 15, 'Crafting': 11, 'Smithing': 5, 'Herblore': 4 },
    prereqs: ['Tai Bwo Wannai Trio'], points: 0,
    chunkedGeography: {"locations":[{"id":"otto-s-grotto","label":"Otto's Grotto","chunkOptions":[{"cx":39,"cy":54}]}],"groups":[],"unknowns":["Barehand harpoon fishing","Seed planting patch","Sapling planting patch"]},
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Bear Your Soul': {
    kind: 'miniquest', accessPolicy: "regions",
    id: 'Bear Your Soul', name: 'Bear Your Soul',
    regions: ['Arceuus', 'Taverley'],
    skills: {}, prereqs: [], points: 0,
    chunkedGeography: {"locations":[{"id":"location-1","label":"Arceuus Library","chunkOptions":[{"cx":25,"cy":59}]},{"id":"location-2","label":"Soul Altar / Aretha","chunkOptions":[{"cx":28,"cy":60}]},{"id":"location-3","label":"Arceuus church","chunkOptions":[{"cx":26,"cy":59}]}],"groups":[{"id":"key-master-route","label":"Reach the Key Master","routes":[{"id":"agility-shortcut","label":"Taverley Dungeon Agility shortcut","locations":[{"id":"taverley-key-master","label":"Taverley Dungeon entrance","chunkOptions":[{"cx":45,"cy":53}]}],"requirements":[{"kind":"skill","skill":"Agility","level":70}]},{"id":"dusty-key","label":"Taverley Dungeon dusty key route","locations":[{"id":"taverley-key-master","label":"Taverley Dungeon entrance","chunkOptions":[{"cx":45,"cy":53}]}],"requirements":[{"kind":"item","id":"dusty-key","label":"Dusty key","usage":"hold"}]},{"id":"key-master-teleport","label":"Key master teleport","locations":[],"requirements":[{"kind":"item","id":"key-master-teleport","label":"Key master teleport","usage":"consume"}]}]}],"unknowns":[]},
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Curse of the Empty Lord': {
    kind: 'miniquest', accessPolicy: "regions",
    id: 'Curse of the Empty Lord', name: 'Curse of the Empty Lord',
    regions: ['Baxtorian Falls'],
    oneOf: [
      { regions: ['Wilderness Agility Course', 'Chaos Temple', "Rogues' Castle", 'Entrana', "Wizards' Tower"] },
      { regions: ['Wilderness Bandit Camp', 'Graveyard of Shadows', 'Port Sarim', 'Edgeville', 'Slayer Tower'] },
      { regions: ['Bandit Camp', 'Lava Maze', 'Tree Gnome Stronghold', 'Falador', 'Edgeville'] },
    ],
    skills: { 'Thieving': 53 }, prereqs: [],
    manualRequirements: ['Started Desert Treasure I', 'Started The Restless Ghost'],
    points: 0,
    chunkedGeography: {"locations":[{"id":"candidate-1","label":"Glarial tomb","chunkOptions":[{"cx":39,"cy":53}]}],"groups":[{"id":"assigned-ghost-path","label":"Assigned ghost sequence","routes":[{"id":"path-1","label":"Ghost path 1","locations":[{"id":"path-1-rennard","label":"Rennard","chunkOptions":[{"cx":47,"cy":61}]},{"id":"path-1-kharrim","label":"Kharrim","chunkOptions":[{"cx":46,"cy":59}]},{"id":"path-1-lennissa","label":"Lennissa","chunkOptions":[{"cx":44,"cy":52}]},{"id":"path-1-dhalak","label":"Dhalak","chunkOptions":[{"cx":48,"cy":49}]},{"id":"path-1-viggora","label":"Viggora","chunkOptions":[{"cx":51,"cy":61}]}],"unknowns":[]},{"id":"path-2","label":"Ghost path 2","locations":[{"id":"path-2-rennard","label":"Rennard","chunkOptions":[{"cx":47,"cy":57}]},{"id":"path-2-kharrim","label":"Kharrim","chunkOptions":[{"cx":49,"cy":57}]},{"id":"path-2-lennissa","label":"Lennissa","chunkOptions":[{"cx":47,"cy":50}]},{"id":"path-2-dhalak","label":"Dhalak","chunkOptions":[{"cx":47,"cy":54}]},{"id":"path-2-viggora","label":"Viggora","chunkOptions":[{"cx":53,"cy":55}]}],"unknowns":[]},{"id":"path-3","label":"Ghost path 3","locations":[{"id":"path-3-rennard","label":"Rennard","chunkOptions":[{"cx":49,"cy":46}]},{"id":"path-3-kharrim","label":"Kharrim","chunkOptions":[{"cx":48,"cy":60}]},{"id":"path-3-lennissa","label":"Lennissa","chunkOptions":[{"cx":37,"cy":54}]},{"id":"path-3-dhalak","label":"Dhalak","chunkOptions":[{"cx":47,"cy":52}]},{"id":"path-3-viggora","label":"Viggora","chunkOptions":[{"cx":48,"cy":54}]}],"unknowns":[]}]}],"unknowns":["Assigned ghost path"]}, series: 'Mahjarrat',
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
    kind: 'miniquest', accessPolicy: 'locations',
    locations: [
      {"id":"location-1","label":"South east of Rellekka.","standardAreas":["Rellekka"],"chunkOptions":[{"cx":42,"cy":56}]},
      {"id":"location-2","label":"South east of Varrock.","standardAreas":["Varrock"],"chunkOptions":[{"cx":51,"cy":52}]},
      {"id":"location-3","label":"South of Falador","standardAreas":["Falador"],"chunkOptions":[{"cx":46,"cy":51}]},
      {"id":"location-4","label":"North of Al Kharid","standardAreas":["Al Kharid"],"chunkOptions":[{"cx":51,"cy":50}]},
      {"id":"location-5","label":"Lumbridge Swamp.","standardAreas":["Lumbridge"],"chunkOptions":[{"cx":49,"cy":49}]},
      {"id":"location-6","label":"In the Grand Exchange.","standardAreas":["Varrock"],"chunkOptions":[{"cx":49,"cy":54}]},
      {"id":"location-7","label":"Near the Body Altar.","standardAreas":["Falador"],"chunkOptions":[{"cx":47,"cy":53}]},
      {"id":"location-8","label":"South west of the Tree Gnome Stronghold.","standardAreas":["Arandar"],"chunkOptions":[{"cx":37,"cy":52}]},
      {"id":"location-9","label":"North of Mudskipper Point.","standardAreas":["Port Sarim"],"chunkOptions":[{"cx":47,"cy":49}]},
      {"id":"location-10","label":"South of East Ardougne","standardAreas":["East Ardougne"],"chunkOptions":[{"cx":40,"cy":50}]},
      {"id":"location-11","label":"Centre of the Tree Gnome Stronghold.","standardAreas":["Tree Gnome Stronghold"],"chunkOptions":[{"cx":38,"cy":53}]},
    ],
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
  ,
    // Source-reconciled completion destinations; Standard policy remains unchanged.
    chunkedGeography: {
      "locations": [
        {
          "id": "edgeville-ditch",
          "label": "Edgeville ditch",
          "chunkOptions": [
            {
              "cx": 48,
              "cy": 55
            }
          ]
        },
        {
          "id": "varrock-south-gate",
          "label": "Varrock south gate",
          "chunkOptions": [
            {
              "cx": 50,
              "cy": 52
            }
          ]
        }
      ],
      "groups": [
        {
          "id": "essence-origins",
          "label": "Three distinct essence teleport origins",
          "routes": [
            {
              "id": "helper-route",
              "label": "Aubury, Sedridor and Cromperty",
              "locations": [
                {
                  "id": "aubury",
                  "label": "Aubury — Varrock",
                  "chunkOptions": [
                    {
                      "cx": 50,
                      "cy": 53
                    }
                  ]
                },
                {
                  "id": "sedridor",
                  "label": "Sedridor — Wizards Tower entrance",
                  "chunkOptions": [
                    {
                      "cx": 48,
                      "cy": 49
                    }
                  ]
                },
                {
                  "id": "cromperty",
                  "label": "Wizard Cromperty — East Ardougne",
                  "chunkOptions": [
                    {
                      "cx": 41,
                      "cy": 51
                    }
                  ]
                }
              ]
            },
            {
              "id": "other-origins",
              "label": "Other distinct essence mage combination",
              "locations": [],
              "unknowns": [
                "The source tracks Brimstail and Wizards Guild origins but does not provide a complete mapped and permission-checked alternative three-mage route."
              ]
            }
          ]
        }
      ],
      "unknowns": []
    },
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
    kind: 'miniquest', accessPolicy: 'locations',
    locations: [
      {"id":"god-wars-dungeon-entrance","label":"God Wars Dungeon entrance","standardAreas":["Burthorpe"],"chunkOptions":[{"cx":45,"cy":58}]},
    ],
    id: 'The Frozen Door', name: 'The Frozen Door',
    regions: ['Burthorpe'],
    skills: { 'Agility': 70, 'Strength': 70, 'Ranged': 70, 'Hitpoints': 70 },
    prereqs: ['Desert Treasure I'], points: 0,
    difficulty: DropSource.QUEST_MASTER
  },
  'The General\'s Shadow': {
    kind: 'miniquest', accessPolicy: "regions",

    id: 'The General\'s Shadow', name: 'The General\'s Shadow',
    regions: ['Rellekka', 'Observatory', 'Seers\' Village', 'Tree Gnome Stronghold', 'Tai Bwo Wannai', 'Falador', 'Shantay Pass'],
    skills: {}, prereqs: ['Fight Arena', 'Curse of the Empty Lord'], points: 0,
    chunkedGeography: {"locations":[{"id":"general-khazard-forest","label":"General Khazard forest","chunkOptions":[{"cx":42,"cy":56}]},{"id":"seers-village","label":"Seers Village","chunkOptions":[{"cx":42,"cy":54}]},{"id":"outpost-scout","label":"Outpost scout","chunkOptions":[{"cx":38,"cy":52}]},{"id":"draynor-manor-scout","label":"Draynor Manor scout","chunkOptions":[{"cx":48,"cy":52}]},{"id":"shantay-pass-scout","label":"Shantay Pass scout","chunkOptions":[{"cx":51,"cy":48}]},{"id":"karamja-scout","label":"Karamja scout","chunkOptions":[{"cx":44,"cy":47}]},{"id":"bouncer-cave-entrance","label":"Bouncer cave entrance","chunkOptions":[{"cx":41,"cy":53}]}],"groups":[],"unknowns":[]}, series: 'Mahjarrat',
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
    kind: 'miniquest', accessPolicy: "regions",
    id: 'Hopespear\'s Will', name: 'Hopespear\'s Will',
    regions: ['Hemenster'],
    skills: { 'Prayer': 50 },
    prereqs: ['Desert Treasure I', 'Fairytale II - Cure a Queen', 'Land of the Goblins'],
    manualRequirements: ['Started The Restless Ghost'], points: 0,
    chunkedGeography: {"locations":[{"id":"candidate-1","label":"Goblin cave entrance","chunkOptions":[{"cx":41,"cy":53}]}],"groups":[],"unknowns":["Yu'Biusk fairy ring access"]},
    difficulty: DropSource.QUEST_MASTER
  },
  'In Search of Knowledge': {
    kind: 'miniquest', accessPolicy: 'locations',
    locations: [
      {"id":"forthos-dungeon-entrance","label":"Forthos Dungeon entrance","standardAreas":["Hosidius"],"chunkOptions":[{"cx":26,"cy":55}]},
      {"id":"arceuus-library","label":"Arceuus Library","standardAreas":["Arceuus"],"chunkOptions":[{"cx":25,"cy":59}]},
    ],
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
  ,
    // Source-reconciled completion destinations; Standard policy remains unchanged.
    chunkedGeography: {
      "locations": [
        {
          "id": "necropolis-main-temple",
          "label": "Necropolis main temple",
          "chunkOptions": [
            {
              "cx": 52,
              "cy": 42
            }
          ]
        }
      ],
      "groups": [],
      "unknowns": [
        "The pinned helper has no Into the Tombs implementation; its tomb/raid completion route requires separately cited source evidence."
      ]
    },
  },
  'Lair of Tarn Razorlor': {
    kind: 'miniquest', accessPolicy: 'locations',
    locations: [
      {"id":"tarn-s-lair-entrance","label":"Tarn's Lair entrance","standardAreas":["Haunted Mine"],"chunkOptions":[{"cx":53,"cy":50}]},
    ],
    id: 'Lair of Tarn Razorlor', name: 'Lair of Tarn Razorlor',
    regions: ['Haunted Mine'],
    skills: { 'Slayer': 40 }, prereqs: ['Haunted Mine'], points: 0,
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Mage Arena I': {
    kind: 'miniquest', accessPolicy: 'locations',
    locations: [
      {"id":"mage-arena-entrance","label":"Mage Arena entrance","standardAreas":["Mage Arena"],"chunkOptions":[{"cx":48,"cy":61}]},
    ],
    id: 'Mage Arena I', name: 'Mage Arena I',
    regions: ['Mage Arena'],
    skills: { 'Magic': 60 }, prereqs: [], points: 0,
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Mage Arena II': {
    kind: 'miniquest', accessPolicy: "regions",
    id: 'Mage Arena II', name: 'Mage Arena II',
    regions: ['Mage Arena'],
    skills: { 'Magic': 75 }, prereqs: ['Mage Arena I'],
    manualRequirements: [
      'Cast Claws of Guthix, Flames of Zamorak, and Saradomin Strike 100 times each inside the Mage Arena',
      'Access to all three assigned demonic follower locations in the Wilderness',
    ],
    points: 0,
    chunkedGeography: {"locations":[{"id":"candidate-1","label":"Mage Arena cavern entrance","chunkOptions":[{"cx":48,"cy":61}]}],"groups":[],"unknowns":["Current Wilderness god spawns"]},
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
    kind: 'miniquest', accessPolicy: 'locations',
    locations: [
      {"id":"auburnvale-totem","label":"Auburnvale totem","standardAreas":["Auburnvale"],"chunkOptions":[{"cx":21,"cy":52}]},
    ],
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
