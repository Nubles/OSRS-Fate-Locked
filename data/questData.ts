
import { DropSource } from '../types';

export interface QuestData {
  id: string;
  name: string;
  regions: string[];
  skills: Record<string, number>;
  prereqs: string[];
  points: number;
  series?: string;
  difficulty: DropSource;
}

export const QUEST_DATA: Record<string, QuestData> = {
  // --- F2P Quests ---
  'Cook\'s Assistant': {
    id: 'Cook\'s Assistant', name: 'Cook\'s Assistant',
    regions: ['Misthalin'],
    skills: {}, prereqs: [], points: 1, series: 'Recipe for Disaster',
    difficulty: DropSource.QUEST_NOVICE
  },
  'Demon Slayer': {
    id: 'Demon Slayer', name: 'Demon Slayer',
    regions: ['Misthalin'],
    skills: {}, prereqs: [], points: 3, series: 'Demon Slayer',
    difficulty: DropSource.QUEST_NOVICE
  },
  'The Restless Ghost': {
    id: 'The Restless Ghost', name: 'The Restless Ghost',
    regions: ['Misthalin'],
    skills: {}, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Romeo & Juliet': {
    id: 'Romeo & Juliet', name: 'Romeo & Juliet',
    regions: ['Misthalin'],
    skills: {}, prereqs: [], points: 5,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Sheep Shearer': {
    id: 'Sheep Shearer', name: 'Sheep Shearer',
    regions: ['Misthalin'],
    skills: {}, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Shield of Arrav': {
    id: 'Shield of Arrav', name: 'Shield of Arrav',
    regions: ['Misthalin'],
    skills: {}, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Ernest the Chicken': {
    id: 'Ernest the Chicken', name: 'Ernest the Chicken',
    regions: ['Misthalin'],
    skills: {}, prereqs: [], points: 4,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Vampyre Slayer': {
    id: 'Vampyre Slayer', name: 'Vampyre Slayer',
    regions: ['Misthalin'],
    skills: {}, prereqs: [], points: 3,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Imp Catcher': {
    id: 'Imp Catcher', name: 'Imp Catcher',
    regions: ['Misthalin'],
    skills: {}, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Prince Ali Rescue': {
    id: 'Prince Ali Rescue', name: 'Prince Ali Rescue',
    regions: ['Kharidian Desert', 'Misthalin'],
    skills: {}, prereqs: [], points: 3, series: 'Kharidian',
    difficulty: DropSource.QUEST_NOVICE
  },
  'Doric\'s Quest': {
    id: 'Doric\'s Quest', name: 'Doric\'s Quest',
    regions: ['Asgarnia'], 
    skills: { 'Mining': 15 }, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Black Knights\' Fortress': {
    id: 'Black Knights\' Fortress', name: 'Black Knights\' Fortress',
    regions: ['Asgarnia'],
    skills: { 'Quest Points': 12 }, prereqs: [], points: 3,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Witch\'s Potion': {
    id: 'Witch\'s Potion', name: 'Witch\'s Potion',
    regions: ['Asgarnia'],
    skills: {}, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_NOVICE
  },
  'The Knight\'s Sword': {
    id: 'The Knight\'s Sword', name: 'The Knight\'s Sword',
    regions: ['Asgarnia', 'Misthalin'], 
    skills: { 'Mining': 10 }, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Goblin Diplomacy': {
    id: 'Goblin Diplomacy', name: 'Goblin Diplomacy',
    regions: ['Asgarnia'],
    skills: {}, prereqs: [], points: 5,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Pirate\'s Treasure': {
    id: 'Pirate\'s Treasure', name: 'Pirate\'s Treasure',
    regions: ['Asgarnia', 'Misthalin'],
    skills: {}, prereqs: [], points: 2,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Dragon Slayer I': {
    id: 'Dragon Slayer I', name: 'Dragon Slayer I',
    regions: ['Misthalin', 'Asgarnia', 'Karamja'],
    skills: { 'Quest Points': 32, 'Crafting': 8 }, prereqs: [], points: 2, series: 'Dragonkin',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Rune Mysteries': {
    id: 'Rune Mysteries', name: 'Rune Mysteries',
    regions: ['Misthalin'],
    skills: {}, prereqs: [], points: 1, series: 'Order of Wizards',
    difficulty: DropSource.QUEST_NOVICE
  },
  'Misthalin Mystery': {
    id: 'Misthalin Mystery', name: 'Misthalin Mystery',
    regions: ['Misthalin'],
    skills: {}, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Below Ice Mountain': {
    id: 'Below Ice Mountain', name: 'Below Ice Mountain',
    regions: ['Asgarnia'],
    skills: { 'Quest Points': 16 }, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_NOVICE
  },
  'The Corsair Curse': {
    id: 'The Corsair Curse', name: 'The Corsair Curse',
    regions: ['Asgarnia', 'Kandarin'],
    skills: {}, prereqs: [], points: 2,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'X Marks the Spot': {
    id: 'X Marks the Spot', name: 'X Marks the Spot',
    regions: ['Misthalin', 'Asgarnia'],
    skills: {}, prereqs: [], points: 1, series: 'Great Kourend',
    difficulty: DropSource.QUEST_NOVICE
  },

  // --- P2P Quests ---
  'Druidic Ritual': {
    id: 'Druidic Ritual', name: 'Druidic Ritual',
    regions: ['Asgarnia'],
    skills: {}, prereqs: [], points: 4,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Lost City': {
    id: 'Lost City', name: 'Lost City',
    regions: ['Misthalin', 'Islands & Others'],
    skills: { 'Crafting': 31, 'Woodcutting': 36 }, prereqs: [], points: 3,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Witch\'s House': {
    id: 'Witch\'s House', name: 'Witch\'s House',
    regions: ['Asgarnia'],
    skills: {}, prereqs: [], points: 4,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Merlin\'s Crystal': {
    id: 'Merlin\'s Crystal', name: 'Merlin\'s Crystal',
    regions: ['Kandarin'],
    skills: {}, prereqs: [], points: 6, series: 'Camelot',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Heroes\' Quest': {
    id: 'Heroes\' Quest', name: 'Heroes\' Quest',
    regions: ['Asgarnia', 'Misthalin', 'Kandarin', 'Karamja'],
    skills: { 'Quest Points': 55, 'Cooking': 53, 'Fishing': 53, 'Herblore': 25, 'Mining': 50 }, prereqs: ['Shield of Arrav', 'Lost City', 'Merlin\'s Crystal', 'Dragon Slayer I', 'Druidic Ritual'], points: 1,
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Scorpion Catcher': {
    id: 'Scorpion Catcher', name: 'Scorpion Catcher',
    regions: ['Kandarin'],
    skills: { 'Prayer': 31 }, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Family Crest': {
    id: 'Family Crest', name: 'Family Crest',
    regions: ['Asgarnia', 'Kandarin', 'Misthalin', 'Kharidian Desert'],
    skills: { 'Mining': 40, 'Smithing': 40, 'Magic': 59, 'Crafting': 40 }, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Tribal Totem': {
    id: 'Tribal Totem', name: 'Tribal Totem',
    regions: ['Karamja'],
    skills: { 'Thieving': 21 }, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Fishing Contest': {
    id: 'Fishing Contest', name: 'Fishing Contest',
    regions: ['Kandarin', 'Asgarnia'],
    skills: { 'Fishing': 10 }, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Monk\'s Friend': {
    id: 'Monk\'s Friend', name: 'Monk\'s Friend',
    regions: ['Kandarin'],
    skills: {}, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Temple of Ikov': {
    id: 'Temple of Ikov', name: 'Temple of Ikov',
    regions: ['Kandarin'],
    skills: { 'Thieving': 42, 'Ranged': 40 }, prereqs: [], points: 1, series: 'Mahjarrat',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Clock Tower': {
    id: 'Clock Tower', name: 'Clock Tower',
    regions: ['Kandarin'],
    skills: {}, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Holy Grail': {
    id: 'Holy Grail', name: 'Holy Grail',
    regions: ['Kandarin', 'Islands & Others'],
    skills: { 'Attack': 20 }, prereqs: ['Merlin\'s Crystal'], points: 2, series: 'Camelot',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Tree Gnome Village': {
    id: 'Tree Gnome Village', name: 'Tree Gnome Village',
    regions: ['Kandarin'],
    skills: {}, prereqs: [], points: 2, series: 'Gnome',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Fight Arena': {
    id: 'Fight Arena', name: 'Fight Arena',
    regions: ['Kandarin'],
    skills: {}, prereqs: [], points: 2, series: 'Mahjarrat',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Hazeel Cult': {
    id: 'Hazeel Cult', name: 'Hazeel Cult',
    regions: ['Kandarin'],
    skills: {}, prereqs: [], points: 1, series: 'Mahjarrat',
    difficulty: DropSource.QUEST_NOVICE
  },
  'Sheep Herder': {
    id: 'Sheep Herder', name: 'Sheep Herder',
    regions: ['Kandarin'],
    skills: {}, prereqs: [], points: 4,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Plague City': {
    id: 'Plague City', name: 'Plague City',
    regions: ['Kandarin'],
    skills: {}, prereqs: [], points: 1, series: 'Elf',
    difficulty: DropSource.QUEST_NOVICE
  },
  'Sea Slug': {
    id: 'Sea Slug', name: 'Sea Slug',
    regions: ['Kandarin'],
    skills: { 'Firemaking': 30 }, prereqs: [], points: 1, series: 'Temple Knight',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Waterfall Quest': {
    id: 'Waterfall Quest', name: 'Waterfall Quest',
    regions: ['Kandarin'],
    skills: {}, prereqs: [], points: 1, series: 'Elf',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Biohazard': {
    id: 'Biohazard', name: 'Biohazard',
    regions: ['Kandarin', 'Asgarnia'],
    skills: {}, prereqs: ['Plague City'], points: 3, series: 'Elf',
    difficulty: DropSource.QUEST_NOVICE
  },
  'Jungle Potion': {
    id: 'Jungle Potion', name: 'Jungle Potion',
    regions: ['Karamja'],
    skills: { 'Herblore': 3 }, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_NOVICE
  },
  'The Grand Tree': {
    id: 'The Grand Tree', name: 'The Grand Tree',
    regions: ['Kandarin'],
    skills: { 'Agility': 25 }, prereqs: [], points: 5, series: 'Gnome',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Shilo Village': {
    id: 'Shilo Village', name: 'Shilo Village',
    regions: ['Karamja'],
    skills: { 'Crafting': 20, 'Agility': 32 }, prereqs: ['Jungle Potion'], points: 2,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Underground Pass': {
    id: 'Underground Pass', name: 'Underground Pass',
    regions: ['Kandarin', 'Tirannwn'],
    skills: { 'Ranged': 25 }, prereqs: ['Biohazard'], points: 5, series: 'Elf',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Observatory Quest': {
    id: 'Observatory Quest', name: 'Observatory Quest',
    regions: ['Kandarin'],
    skills: { 'Crafting': 10 }, prereqs: [], points: 2,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'The Tourist Trap': {
    id: 'The Tourist Trap', name: 'The Tourist Trap',
    regions: ['Kharidian Desert'],
    skills: { 'Fletching': 10, 'Smithing': 20 }, prereqs: [], points: 2,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Watchtower': {
    id: 'Watchtower', name: 'Watchtower',
    regions: ['Kandarin'],
    skills: { 'Magic': 15, 'Thieving': 15, 'Agility': 25, 'Herblore': 14, 'Mining': 40 }, prereqs: [], points: 4,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Dwarf Cannon': {
    id: 'Dwarf Cannon', name: 'Dwarf Cannon',
    regions: ['Kandarin', 'Asgarnia'],
    skills: {}, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Murder Mystery': {
    id: 'Murder Mystery', name: 'Murder Mystery',
    regions: ['Kandarin'],
    skills: {}, prereqs: [], points: 3,
    difficulty: DropSource.QUEST_NOVICE
  },
  'The Dig Site': {
    id: 'The Dig Site', name: 'The Dig Site',
    regions: ['Misthalin'],
    skills: { 'Agility': 10, 'Herblore': 10, 'Thieving': 25 }, prereqs: [], points: 2, series: 'Mahjarrat',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Gertrude\'s Cat': {
    id: 'Gertrude\'s Cat', name: 'Gertrude\'s Cat',
    regions: ['Misthalin'],
    skills: {}, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Legends\' Quest': {
    id: 'Legends\' Quest', name: 'Legends\' Quest',
    regions: ['Kandarin'],
    skills: { 'Quest Points': 107, 'Herblore': 45, 'Prayer': 42, 'Strength': 50, 'Agility': 50, 'Thieving': 50, 'Crafting': 50, 'Smithing': 50, 'Mining': 52, 'Woodcutting': 50, 'Magic': 56 }, 
    prereqs: ['Family Crest', 'Heroes\' Quest', 'Shilo Village', 'Underground Pass', 'Waterfall Quest'], points: 4,
    difficulty: DropSource.QUEST_MASTER
  },
  'Big Chompy Bird Hunting': {
    id: 'Big Chompy Bird Hunting', name: 'Big Chompy Bird Hunting',
    regions: ['Kandarin'],
    skills: { 'Fletching': 5, 'Cooking': 30, 'Ranged': 30 }, prereqs: [], points: 2,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Elemental Workshop I': {
    id: 'Elemental Workshop I', name: 'Elemental Workshop I',
    regions: ['Kandarin'],
    skills: { 'Mining': 20, 'Smithing': 20, 'Crafting': 20 }, prereqs: [], points: 1, series: 'Elemental Workshop',
    difficulty: DropSource.QUEST_NOVICE
  },
  'Priest in Peril': {
    id: 'Priest in Peril', name: 'Priest in Peril',
    regions: ['Misthalin', 'Morytania'],
    skills: {}, prereqs: [], points: 1, series: 'Myreque',
    difficulty: DropSource.QUEST_NOVICE
  },
  'Nature Spirit': {
    id: 'Nature Spirit', name: 'Nature Spirit',
    regions: ['Morytania'],
    skills: { 'Crafting': 18 }, prereqs: ['Priest in Peril', 'The Restless Ghost'], points: 2, series: 'Myreque',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Death Plateau': {
    id: 'Death Plateau', name: 'Death Plateau',
    regions: ['Asgarnia'],
    skills: {}, prereqs: [], points: 1, series: 'Troll',
    difficulty: DropSource.QUEST_NOVICE
  },
  'Troll Stronghold': {
    id: 'Troll Stronghold', name: 'Troll Stronghold',
    regions: ['Asgarnia'],
    skills: { 'Agility': 15 }, prereqs: ['Death Plateau'], points: 1, series: 'Troll',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Tai Bwo Wannai Trio': {
    id: 'Tai Bwo Wannai Trio', name: 'Tai Bwo Wannai Trio',
    regions: ['Karamja'],
    skills: { 'Agility': 15, 'Cooking': 30, 'Fishing': 5 }, prereqs: ['Jungle Potion'], points: 2,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Regicide': {
    id: 'Regicide', name: 'Regicide',
    regions: ['Tirannwn'],
    skills: { 'Agility': 56, 'Crafting': 10 }, prereqs: ['Underground Pass'], points: 3, series: 'Elf',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Eadgar\'s Ruse': {
    id: 'Eadgar\'s Ruse', name: 'Eadgar\'s Ruse',
    regions: ['Asgarnia', 'Kandarin'],
    skills: { 'Herblore': 31 }, prereqs: ['Druidic Ritual', 'Troll Stronghold'], points: 1, series: 'Troll',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Shades of Mort\'ton': {
    id: 'Shades of Mort\'ton', name: 'Shades of Mort\'ton',
    regions: ['Morytania'],
    skills: { 'Crafting': 20, 'Herblore': 15, 'Firemaking': 5 }, prereqs: ['Priest in Peril'], points: 3,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'The Fremennik Trials': {
    id: 'The Fremennik Trials', name: 'The Fremennik Trials',
    regions: ['Fremennik'],
    skills: { 'Fletching': 25, 'Woodcutting': 40, 'Crafting': 40 }, prereqs: [], points: 3, series: 'Fremennik',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Horror from the Deep': {
    id: 'Horror from the Deep', name: 'Horror from the Deep',
    regions: ['Fremennik'],
    skills: { 'Agility': 35 }, prereqs: [], points: 2,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Throne of Miscellania': {
    id: 'Throne of Miscellania', name: 'Throne of Miscellania',
    regions: ['Fremennik'],
    skills: { 'Woodcutting': 45, 'Farming': 10, 'Mining': 30, 'Fishing': 35 }, prereqs: ['The Fremennik Trials', 'Heroes\' Quest'], points: 1, series: 'Miscellania',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Monkey Madness I': {
    id: 'Monkey Madness I', name: 'Monkey Madness I',
    regions: ['Kandarin', 'Islands & Others'],
    skills: {}, prereqs: ['The Grand Tree', 'Tree Gnome Village'], points: 3, series: 'Gnome',
    difficulty: DropSource.QUEST_MASTER
  },
  'Haunted Mine': {
    id: 'Haunted Mine', name: 'Haunted Mine',
    regions: ['Morytania'],
    skills: { 'Agility': 15, 'Runecraft': 35 }, prereqs: ['Priest in Peril'], points: 2,
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Troll Romance': {
    id: 'Troll Romance', name: 'Troll Romance',
    regions: ['Asgarnia'],
    skills: { 'Agility': 28 }, prereqs: ['Troll Stronghold'], points: 2,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'In Search of the Myreque': {
    id: 'In Search of the Myreque', name: 'In Search of the Myreque',
    regions: ['Morytania', 'Misthalin'],
    skills: { 'Agility': 25 }, prereqs: ['Nature Spirit'], points: 2, series: 'Myreque',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Creature of Fenkenstrain': {
    id: 'Creature of Fenkenstrain', name: 'Creature of Fenkenstrain',
    regions: ['Morytania'],
    skills: { 'Crafting': 20, 'Thieving': 25 }, prereqs: ['Priest in Peril', 'The Restless Ghost'], points: 2,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Roving Elves': {
    id: 'Roving Elves', name: 'Roving Elves',
    regions: ['Tirannwn'],
    skills: { 'Agility': 56 }, prereqs: ['Regicide', 'Waterfall Quest'], points: 1, series: 'Elf',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Ghosts Ahoy': {
    id: 'Ghosts Ahoy', name: 'Ghosts Ahoy',
    regions: ['Morytania'],
    skills: { 'Agility': 25, 'Cooking': 20 }, prereqs: ['Priest in Peril', 'The Restless Ghost'], points: 2,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'One Small Favour': {
    id: 'One Small Favour', name: 'One Small Favour',
    regions: ['Kandarin', 'Karamja', 'Asgarnia', 'Misthalin'],
    skills: { 'Agility': 36, 'Crafting': 25, 'Herblore': 18, 'Smithing': 30 }, prereqs: ['Rune Mysteries', 'Shilo Village'], points: 2,
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Mountain Daughter': {
    id: 'Mountain Daughter', name: 'Mountain Daughter',
    regions: ['Fremennik'],
    skills: { 'Agility': 20 }, prereqs: [], points: 2,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Between a Rock...': {
    id: 'Between a Rock...', name: 'Between a Rock...',
    regions: ['Fremennik'],
    skills: { 'Defence': 30, 'Mining': 40, 'Smithing': 50 }, prereqs: ['Dwarf Cannon', 'Fishing Contest'], points: 2,
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'The Feud': {
    id: 'The Feud', name: 'The Feud',
    regions: ['Kharidian Desert'],
    skills: { 'Thieving': 30 }, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'The Golem': {
    id: 'The Golem', name: 'The Golem',
    regions: ['Kharidian Desert'],
    skills: { 'Crafting': 20, 'Thieving': 25 }, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Desert Treasure I': {
    id: 'Desert Treasure I', name: 'Desert Treasure I',
    regions: ['Kharidian Desert', 'Asgarnia', 'Kandarin', 'Morytania', 'Wilderness'],
    skills: { 'Thieving': 53, 'Firemaking': 50, 'Slayer': 10, 'Magic': 50 }, prereqs: ['The Dig Site', 'Temple of Ikov', 'The Tourist Trap', 'Troll Stronghold', 'Priest in Peril', 'Waterfall Quest'], points: 3, series: 'Mahjarrat',
    difficulty: DropSource.QUEST_MASTER
  },
  'Icthlarin\'s Little Helper': {
    id: 'Icthlarin\'s Little Helper', name: 'Icthlarin\'s Little Helper',
    regions: ['Kharidian Desert'],
    skills: {}, prereqs: ['Gertrude\'s Cat'], points: 2, series: 'Kharidian',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Tears of Guthix': {
    id: 'Tears of Guthix', name: 'Tears of Guthix',
    regions: ['Misthalin'],
    skills: { 'Firemaking': 49, 'Crafting': 20, 'Mining': 20 }, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Zogre Flesh Eaters': {
    id: 'Zogre Flesh Eaters', name: 'Zogre Flesh Eaters',
    regions: ['Kandarin'],
    skills: { 'Smithing': 4, 'Herblore': 8, 'Ranged': 30, 'Strength': 10, 'Fletching': 30 }, prereqs: ['Big Chompy Bird Hunting', 'Jungle Potion'], points: 1,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'The Lost Tribe': {
    id: 'The Lost Tribe', name: 'The Lost Tribe',
    regions: ['Misthalin'],
    skills: { 'Agility': 13, 'Mining': 17, 'Thieving': 13 }, prereqs: ['Goblin Diplomacy', 'Rune Mysteries'], points: 1, series: 'Dorgeshuun',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'The Giant Dwarf': {
    id: 'The Giant Dwarf', name: 'The Giant Dwarf',
    regions: ['Fremennik'],
    skills: { 'Crafting': 12, 'Firemaking': 16, 'Magic': 33, 'Thieving': 14 }, prereqs: [], points: 2, series: 'Red Axe',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Recruitment Drive': {
    id: 'Recruitment Drive', name: 'Recruitment Drive',
    regions: ['Asgarnia'],
    skills: { 'Quest Points': 12 }, prereqs: ['Black Knights\' Fortress'], points: 1, series: 'Temple Knight',
    difficulty: DropSource.QUEST_NOVICE
  },
  'Mourning\'s End Part I': {
    id: 'Mourning\'s End Part I', name: 'Mourning\'s End Part I',
    regions: ['Tirannwn'],
    skills: { 'Ranged': 60, 'Thieving': 50 }, prereqs: ['Roving Elves', 'Big Chompy Bird Hunting', 'Sheep Herder'], points: 2, series: 'Elf',
    difficulty: DropSource.QUEST_MASTER
  },
  'Forgettable Tale...': {
    id: 'Forgettable Tale...', name: 'Forgettable Tale of a Drunken Dwarf',
    regions: ['Fremennik'],
    skills: { 'Cooking': 22, 'Farming': 17 }, prereqs: ['The Giant Dwarf', 'Fishing Contest'], points: 2, series: 'Red Axe',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Garden of Tranquillity': {
    id: 'Garden of Tranquillity', name: 'Garden of Tranquillity',
    regions: ['Misthalin'],
    skills: { 'Farming': 25 }, prereqs: ['Creature of Fenkenstrain'], points: 2,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'A Tail of Two Cats': {
    id: 'A Tail of Two Cats', name: 'A Tail of Two Cats',
    regions: ['Asgarnia', 'Misthalin'],
    skills: {}, prereqs: ['Icthlarin\'s Little Helper'], points: 2, series: 'Dragonkin',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Wanted!': {
    id: 'Wanted!', name: 'Wanted!',
    regions: ['Asgarnia'],
    skills: { 'Quest Points': 32, 'Slayer': 33 }, prereqs: ['Recruitment Drive', 'The Lost Tribe', 'Priest in Peril'], points: 1, series: 'Temple Knight',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Mourning\'s End Part II': {
    id: 'Mourning\'s End Part II', name: 'Mourning\'s End Part II',
    regions: ['Tirannwn'],
    skills: { 'Agility': 65 }, prereqs: ['Mourning\'s End Part I'], points: 2, series: 'Elf',
    difficulty: DropSource.QUEST_MASTER
  },
  'Rum Deal': {
    id: 'Rum Deal', name: 'Rum Deal',
    regions: ['Morytania', 'Islands & Others'],
    skills: { 'Farming': 40, 'Prayer': 47, 'Slayer': 42, 'Crafting': 42, 'Fishing': 50 }, prereqs: ['Zogre Flesh Eaters', 'Priest in Peril'], points: 2, series: 'Pirate',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Shadow of the Storm': {
    id: 'Shadow of the Storm', name: 'Shadow of the Storm',
    regions: ['Kharidian Desert'],
    skills: { 'Crafting': 30 }, prereqs: ['Demon Slayer', 'The Golem'], points: 1, series: 'Demon Slayer',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Making History': {
    id: 'Making History', name: 'Making History',
    regions: ['Kandarin'],
    skills: {}, prereqs: ['Priest in Peril', 'The Restless Ghost'], points: 3,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Ratcatchers': {
    id: 'Ratcatchers', name: 'Ratcatchers',
    regions: ['Misthalin'],
    skills: {}, prereqs: ['Icthlarin\'s Little Helper'], points: 2,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Spirits of the Elid': {
    id: 'Spirits of the Elid', name: 'Spirits of the Elid',
    regions: ['Kharidian Desert'],
    skills: { 'Magic': 33, 'Ranged': 37, 'Mining': 37, 'Thieving': 37 }, prereqs: [], points: 2,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Devious Minds': {
    id: 'Devious Minds', name: 'Devious Minds',
    regions: ['Misthalin', 'Asgarnia'],
    skills: { 'Smithing': 65, 'Runecraft': 50, 'Fletching': 50 }, prereqs: ['Wanted!', 'Troll Stronghold', 'Doric\'s Quest'], points: 1, series: 'Mahjarrat',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'The Hand in the Sand': {
    id: 'The Hand in the Sand', name: 'The Hand in the Sand',
    regions: ['Kandarin'],
    skills: { 'Thieving': 17, 'Crafting': 49 }, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Enakhra\'s Lament': {
    id: 'Enakhra\'s Lament', name: 'Enakhra\'s Lament',
    regions: ['Kharidian Desert'],
    skills: { 'Crafting': 50, 'Firemaking': 45, 'Magic': 39, 'Mining': 45 }, prereqs: [], points: 2, series: 'Mahjarrat',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Cabin Fever': {
    id: 'Cabin Fever', name: 'Cabin Fever',
    regions: ['Islands & Others'],
    skills: { 'Ranged': 40, 'Smithing': 50, 'Crafting': 45 }, prereqs: ['Pirate\'s Treasure', 'Rum Deal'], points: 2, series: 'Pirate',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Fairytale I - Growing Pains': {
    id: 'Fairytale I - Growing Pains', name: 'Fairytale I - Growing Pains',
    regions: ['Misthalin'],
    skills: {}, prereqs: ['Lost City', 'Nature Spirit'], points: 2, series: 'Fairy Tale',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'RFD: The Cook': {
    id: 'RFD: The Cook', name: 'RFD: Start (The Cook)',
    regions: ['Misthalin'],
    skills: { 'Cooking': 10 }, prereqs: ['Cook\'s Assistant'], points: 1, series: 'Recipe for Disaster',
    difficulty: DropSource.QUEST_NOVICE
  },
  'RFD: Dwarf': {
    id: 'RFD: Dwarf', name: 'RFD: Dwarf',
    regions: ['Asgarnia'],
    skills: {}, prereqs: ['Fishing Contest'], points: 1, series: 'Recipe for Disaster',
    difficulty: DropSource.QUEST_NOVICE
  },
  'RFD: Goblins': {
    id: 'RFD: Goblins', name: 'RFD: Goblins',
    regions: ['Asgarnia'],
    skills: { 'Cooking': 48 }, prereqs: ['Goblin Diplomacy'], points: 1, series: 'Recipe for Disaster',
    difficulty: DropSource.QUEST_NOVICE
  },
  'RFD: Pirate Pete': {
    id: 'RFD: Pirate Pete', name: 'RFD: Pirate Pete',
    regions: ['Misthalin', 'Asgarnia', 'Islands & Others'],
    skills: { 'Cooking': 31 }, prereqs: [], points: 1, series: 'Recipe for Disaster',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'RFD: Lumbridge Guide': {
    id: 'RFD: Lumbridge Guide', name: 'RFD: Lumbridge Guide',
    regions: ['Misthalin'],
    skills: { 'Cooking': 40 }, prereqs: ['Big Chompy Bird Hunting', 'Biohazard', 'Demon Slayer', 'Murder Mystery', 'Nature Spirit', 'Priest in Peril', 'The Restless Ghost', 'Witch\'s House'], points: 1, series: 'Recipe for Disaster',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'RFD: Evil Dave': {
    id: 'RFD: Evil Dave', name: 'RFD: Evil Dave',
    regions: ['Misthalin'],
    skills: { 'Cooking': 25, 'Magic': 25 }, prereqs: ['Gertrude\'s Cat', 'Shadow of the Storm'], points: 1, series: 'Recipe for Disaster',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'RFD: Skrach Uglogwee': {
    id: 'RFD: Skrach Uglogwee', name: 'RFD: Skrach Uglogwee',
    regions: ['Kandarin'],
    skills: { 'Cooking': 41, 'Firemaking': 20 }, prereqs: ['Big Chompy Bird Hunting'], points: 1, series: 'Recipe for Disaster',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'RFD: Sir Amik Varze': {
    id: 'RFD: Sir Amik Varze', name: 'RFD: Sir Amik Varze',
    regions: ['Asgarnia', 'Karamja', 'Misthalin', 'Islands & Others'],
    skills: { 'Cooking': 70, 'Quest Points': 107 }, prereqs: ['Legends\' Quest'], points: 1, series: 'Recipe for Disaster',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'RFD: King Awowogei': {
    id: 'RFD: King Awowogei', name: 'RFD: King Awowogei',
    regions: ['Islands & Others', 'Kandarin'],
    skills: { 'Cooking': 70, 'Agility': 48 }, prereqs: ['Monkey Madness I'], points: 1, series: 'Recipe for Disaster',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'RFD: Finale': {
    id: 'RFD: Finale', name: 'RFD: Finale',
    regions: ['Misthalin'],
    skills: { 'Quest Points': 175 }, prereqs: ['RFD: The Cook', 'RFD: Dwarf', 'RFD: Goblins', 'RFD: Pirate Pete', 'RFD: Lumbridge Guide', 'RFD: Evil Dave', 'RFD: Skrach Uglogwee', 'RFD: Sir Amik Varze', 'RFD: King Awowogei'], points: 1, series: 'Recipe for Disaster',
    difficulty: DropSource.QUEST_MASTER
  },
  'In Aid of the Myreque': {
    id: 'In Aid of the Myreque', name: 'In Aid of the Myreque',
    regions: ['Morytania'],
    skills: { 'Crafting': 25, 'Magic': 7, 'Mining': 15 },
    prereqs: ['In Search of the Myreque'],
    points: 2,
    series: 'Myreque',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'A Soul\'s Bane': {
    id: 'A Soul\'s Bane', name: 'A Soul\'s Bane',
    regions: ['Misthalin'],
    skills: {}, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Rag and Bone Man I': {
    id: 'Rag and Bone Man I', name: 'Rag and Bone Man I',
    regions: ['Misthalin'],
    skills: {}, prereqs: [], points: 1, series: 'Rag and Bone Man',
    difficulty: DropSource.QUEST_NOVICE
  },
  'Swan Song': {
    id: 'Swan Song', name: 'Swan Song',
    regions: ['Kandarin'],
    skills: { 'Quest Points': 100, 'Magic': 66, 'Cooking': 62, 'Fishing': 62, 'Smithing': 45, 'Firemaking': 42, 'Crafting': 40 }, prereqs: ['One Small Favour', 'Garden of Tranquillity'], points: 2,
    difficulty: DropSource.QUEST_MASTER
  },
  'Royal Trouble': {
    id: 'Royal Trouble', name: 'Royal Trouble',
    regions: ['Fremennik'],
    skills: { 'Agility': 40, 'Slayer': 40 }, prereqs: ['Throne of Miscellania'], points: 1, series: 'Miscellania',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Death to the Dorgeshuun': {
    id: 'Death to the Dorgeshuun', name: 'Death to the Dorgeshuun',
    regions: ['Misthalin'],
    skills: { 'Thieving': 23, 'Agility': 23 }, prereqs: ['The Lost Tribe'], points: 1, series: 'Dorgeshuun',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Fairytale II - Cure a Queen': {
    id: 'Fairytale II - Cure a Queen', name: 'Fairytale II - Cure a Queen',
    regions: ['Islands & Others'],
    skills: { 'Thieving': 40, 'Farming': 49, 'Herblore': 57 }, prereqs: ['Fairytale I - Growing Pains'], points: 2, series: 'Fairy Tale',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Lunar Diplomacy': {
    id: 'Lunar Diplomacy', name: 'Lunar Diplomacy',
    regions: ['Fremennik'],
    skills: { 'Crafting': 61, 'Defence': 40, 'Firemaking': 49, 'Magic': 65, 'Mining': 60, 'Woodcutting': 55 }, prereqs: ['The Fremennik Trials', 'Lost City', 'Rune Mysteries', 'Shilo Village'], points: 2, series: 'Fremennik',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'The Eyes of Glouphrie': {
    id: 'The Eyes of Glouphrie', name: 'The Eyes of Glouphrie',
    regions: ['Kandarin'],
    skills: { 'Construction': 5, 'Magic': 46 }, prereqs: ['The Grand Tree'], points: 2, series: 'Gnome',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Darkness of Hallowvale': {
    id: 'Darkness of Hallowvale', name: 'Darkness of Hallowvale',
    regions: ['Morytania'],
    skills: { 'Construction': 5, 'Mining': 20, 'Thieving': 22, 'Agility': 26, 'Crafting': 32, 'Magic': 33, 'Strength': 40 }, prereqs: ['In Aid of the Myreque'], points: 2, series: 'Myreque',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'The Slug Menace': {
    id: 'The Slug Menace', name: 'The Slug Menace',
    regions: ['Kandarin'],
    skills: { 'Crafting': 30, 'Runecraft': 30, 'Slayer': 30, 'Thieving': 30 }, prereqs: ['Sea Slug', 'Wanted!'], points: 1, series: 'Temple Knight',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Elemental Workshop II': {
    id: 'Elemental Workshop II', name: 'Elemental Workshop II',
    regions: ['Kandarin'],
    skills: { 'Magic': 20, 'Smithing': 30 }, prereqs: ['Elemental Workshop I'], points: 1, series: 'Elemental Workshop',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'My Arm\'s Big Adventure': {
    id: 'My Arm\'s Big Adventure', name: 'My Arm\'s Big Adventure',
    regions: ['Asgarnia'],
    skills: { 'Woodcutting': 10, 'Farming': 29 }, prereqs: ['Eadgar\'s Ruse', 'The Feud', 'Jungle Potion'], points: 1, series: 'Troll',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Enlightened Journey': {
    id: 'Enlightened Journey', name: 'Enlightened Journey',
    regions: ['Asgarnia', 'Kandarin', 'Misthalin'],
    skills: { 'Firemaking': 20, 'Farming': 30, 'Crafting': 36 }, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Eagles\' Peak': {
    id: 'Eagles\' Peak', name: 'Eagles\' Peak',
    regions: ['Kandarin'],
    skills: { 'Hunter': 27 }, prereqs: [], points: 2,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Animal Magnetism': {
    id: 'Animal Magnetism', name: 'Animal Magnetism',
    regions: ['Misthalin'],
    skills: { 'Slayer': 18, 'Crafting': 19, 'Ranged': 30, 'Woodcutting': 35 }, prereqs: ['The Restless Ghost', 'Ernest the Chicken', 'Priest in Peril'], points: 1,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Contact!': {
    id: 'Contact!', name: 'Contact!',
    regions: ['Kharidian Desert'],
    skills: {}, prereqs: ['Prince Ali Rescue', 'Icthlarin\'s Little Helper'], points: 1, series: 'Kharidian',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Cold War': {
    id: 'Cold War', name: 'Cold War',
    regions: ['Fremennik'],
    skills: { 'Hunter': 10, 'Agility': 30, 'Crafting': 30, 'Construction': 34 }, prereqs: [], points: 1, series: 'Penguin',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'The Fremennik Isles': {
    id: 'The Fremennik Isles', name: 'The Fremennik Isles',
    regions: ['Fremennik'],
    skills: { 'Construction': 20, 'Agility': 40 }, prereqs: ['The Fremennik Trials'], points: 1, series: 'Fremennik',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Tower of Life': {
    id: 'Tower of Life', name: 'Tower of Life',
    regions: ['Kandarin'],
    skills: { 'Construction': 10 }, prereqs: [], points: 2,
    difficulty: DropSource.QUEST_NOVICE
  },
  'The Great Brain Robbery': {
    id: 'The Great Brain Robbery', name: 'The Great Brain Robbery',
    regions: ['Islands & Others'],
    skills: { 'Crafting': 16, 'Construction': 30, 'Prayer': 50 }, prereqs: ['Creature of Fenkenstrain', 'Cabin Fever'], points: 2, series: 'Pirate',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'What Lies Below': {
    id: 'What Lies Below', name: 'What Lies Below',
    regions: ['Misthalin'],
    skills: { 'Runecraft': 35 }, prereqs: ['Rune Mysteries'], points: 1,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Olaf\'s Quest': {
    id: 'Olaf\'s Quest', name: 'Olaf\'s Quest',
    regions: ['Fremennik'],
    skills: { 'Firemaking': 40, 'Woodcutting': 50 }, prereqs: ['The Fremennik Trials'], points: 1,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Another Slice of H.A.M.': {
    id: 'Another Slice of H.A.M.', name: 'Another Slice of H.A.M.',
    regions: ['Misthalin'],
    skills: { 'Attack': 15, 'Prayer': 25 }, prereqs: ['Death to the Dorgeshuun', 'The Dig Site', 'The Giant Dwarf'], points: 1, series: 'Dorgeshuun',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Dream Mentor': {
    id: 'Dream Mentor', name: 'Dream Mentor',
    regions: ['Fremennik'],
    skills: { 'Combat': 85 }, prereqs: ['Lunar Diplomacy', 'Eadgar\'s Ruse'], points: 2,
    difficulty: DropSource.QUEST_MASTER
  },
  'Grim Tales': {
    id: 'Grim Tales', name: 'Grim Tales',
    regions: ['Asgarnia'],
    skills: { 'Farming': 45, 'Herblore': 52, 'Thieving': 58, 'Agility': 59, 'Woodcutting': 71 }, prereqs: ['Witch\'s House'], points: 1,
    difficulty: DropSource.QUEST_MASTER
  },
  'King\'s Ransom': {
    id: 'King\'s Ransom', name: 'King\'s Ransom',
    regions: ['Kandarin'],
    skills: { 'Magic': 45, 'Defence': 65 }, prereqs: ['Black Knights\' Fortress', 'Holy Grail', 'Murder Mystery', 'One Small Favour'], points: 1, series: 'Camelot',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Monkey Madness II': {
    id: 'Monkey Madness II', name: 'Monkey Madness II',
    regions: ['Islands & Others'],
    skills: { 'Slayer': 69, 'Crafting': 70, 'Hunter': 60, 'Agility': 55, 'Thieving': 55, 'Firemaking': 60 }, prereqs: ['Monkey Madness I', 'Enlightened Journey', 'The Eyes of Glouphrie', 'Troll Stronghold', 'Watchtower', 'RFD: King Awowogei'], points: 4, series: 'Gnome',
    difficulty: DropSource.QUEST_GRANDMASTER
  },
  'Client of Kourend': {
    id: 'Client of Kourend', name: 'Client of Kourend',
    regions: ['Kourend & Kebos'],
    skills: {}, prereqs: [], points: 1, series: 'Great Kourend',
    difficulty: DropSource.QUEST_NOVICE
  },
  'Rag and Bone Man II': {
    id: 'Rag and Bone Man II', name: 'Rag and Bone Man II',
    regions: ['Misthalin'],
    skills: { 'Slayer': 40, 'Defence': 20 }, prereqs: ['Rag and Bone Man I'], points: 1, series: 'Rag and Bone Man',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Bone Voyage': {
    id: 'Bone Voyage', name: 'Bone Voyage',
    regions: ['Misthalin', 'Islands & Others'],
    skills: {}, prereqs: ['The Dig Site'], points: 1,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'The Queen of Thieves': {
    id: 'The Queen of Thieves', name: 'The Queen of Thieves',
    regions: ['Kourend & Kebos'],
    skills: { 'Thieving': 20 }, prereqs: ['Client of Kourend'], points: 1, series: 'Great Kourend',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'The Depths of Despair': {
    id: 'The Depths of Despair', name: 'The Depths of Despair',
    regions: ['Kourend & Kebos'],
    skills: { 'Agility': 18 }, prereqs: ['Client of Kourend'], points: 1, series: 'Great Kourend',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Dragon Slayer II': {
    id: 'Dragon Slayer II', name: 'Dragon Slayer II',
    regions: ['Misthalin', 'Asgarnia', 'Kandarin', 'Fremennik', 'Kourend & Kebos'],
    skills: { 'Magic': 75, 'Smithing': 70, 'Mining': 68, 'Crafting': 62, 'Agility': 60, 'Thieving': 60, 'Construction': 50, 'Hunter': 50 }, prereqs: ['Legends\' Quest', 'Dream Mentor', 'A Tail of Two Cats', 'Animal Magnetism', 'Ghosts Ahoy', 'Bone Voyage', 'Client of Kourend'], points: 5, series: 'Dragonkin',
    difficulty: DropSource.QUEST_GRANDMASTER
  },
  'Tale of the Righteous': {
    id: 'Tale of the Righteous', name: 'Tale of the Righteous',
    regions: ['Kourend & Kebos'],
    skills: { 'Strength': 16, 'Mining': 10 }, prereqs: ['Client of Kourend'], points: 1, series: 'Great Kourend',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'A Taste of Hope': {
    id: 'A Taste of Hope', name: 'A Taste of Hope',
    regions: ['Morytania'],
    skills: { 'Crafting': 48, 'Agility': 45, 'Attack': 40, 'Herblore': 40, 'Slayer': 38 }, prereqs: ['Darkness of Hallowvale'], points: 1, series: 'Myreque',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Making Friends with My Arm': {
    id: 'Making Friends with My Arm', name: 'Making Friends with My Arm',
    regions: ['Asgarnia', 'Fremennik'],
    skills: { 'Firemaking': 66, 'Mining': 72, 'Construction': 35, 'Agility': 68 }, prereqs: ['My Arm\'s Big Adventure', 'Swan Song', 'Cold War', 'Romeo & Juliet'], points: 2, series: 'Troll',
    difficulty: DropSource.QUEST_MASTER
  },
  'The Forsaken Tower': {
    id: 'The Forsaken Tower', name: 'The Forsaken Tower',
    regions: ['Kourend & Kebos'],
    skills: {}, prereqs: ['Client of Kourend'], points: 1, series: 'Great Kourend',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'The Ascent of Arceuus': {
    id: 'The Ascent of Arceuus', name: 'The Ascent of Arceuus',
    regions: ['Kourend & Kebos'],
    skills: { 'Hunter': 12 }, prereqs: ['Client of Kourend'], points: 1, series: 'Great Kourend',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Song of the Elves': {
    id: 'Song of the Elves', name: 'Song of the Elves',
    regions: ['Tirannwn'],
    skills: { 'Agility': 70, 'Construction': 70, 'Farming': 70, 'Herblore': 70, 'Hunter': 70, 'Mining': 70, 'Smithing': 70, 'Woodcutting': 70 }, prereqs: ['Mourning\'s End Part II', 'Making History'], points: 4, series: 'Elf',
    difficulty: DropSource.QUEST_GRANDMASTER
  },
  'The Fremennik Exiles': {
    id: 'The Fremennik Exiles', name: 'The Fremennik Exiles',
    regions: ['Fremennik'],
    skills: { 'Crafting': 65, 'Slayer': 60, 'Smithing': 60, 'Fishing': 60, 'Runecraft': 55 }, prereqs: ['The Fremennik Isles', 'Lunar Diplomacy', 'Mountain Daughter', 'Heroes\' Quest'], points: 2, series: 'Fremennik',
    difficulty: DropSource.QUEST_MASTER
  },
  'Sins of the Father': {
    id: 'Sins of the Father', name: 'Sins of the Father',
    regions: ['Morytania'],
    skills: { 'Woodcutting': 62, 'Fletching': 60, 'Crafting': 56, 'Agility': 52, 'Slayer': 50 }, prereqs: ['A Taste of Hope', 'Vampyre Slayer'], points: 2, series: 'Myreque',
    difficulty: DropSource.QUEST_MASTER
  },
  'A Porcine of Interest': {
    id: 'A Porcine of Interest', name: 'A Porcine of Interest',
    regions: ['Misthalin'],
    skills: { 'Slayer': 1 }, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Getting Ahead': {
    id: 'Getting Ahead', name: 'Getting Ahead',
    regions: ['Kourend & Kebos'],
    skills: { 'Construction': 30, 'Crafting': 26 }, prereqs: [], points: 1, series: 'Twisted Tales',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'A Night at the Theatre': {
    id: 'A Night at the Theatre', name: 'A Night at the Theatre',
    regions: ['Morytania'],
    skills: {}, prereqs: ['A Taste of Hope'], points: 2,
    difficulty: DropSource.QUEST_MASTER
  },
  'A Kingdom Divided': {
    id: 'A Kingdom Divided', name: 'A Kingdom Divided',
    regions: ['Kourend & Kebos'],
    skills: { 'Agility': 54, 'Thieving': 52, 'Woodcutting': 52, 'Herblore': 50, 'Mining': 42, 'Crafting': 38, 'Magic': 35 }, prereqs: ['The Depths of Despair', 'Queen of Thieves', 'Tale of the Righteous', 'The Forsaken Tower', 'The Ascent of Arceuus'], points: 2, series: 'Great Kourend',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Land of the Goblins': {
    id: 'Land of the Goblins', name: 'Land of the Goblins',
    regions: ['Kandarin'],
    skills: { 'Agility': 48, 'Thieving': 48, 'Fishing': 40, 'Herblore': 40 }, prereqs: ['Another Slice of H.A.M.', 'Fishing Contest'], points: 2, series: 'Dorgeshuun',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Temple of the Eye': {
    id: 'Temple of the Eye', name: 'Temple of the Eye',
    regions: ['Kharidian Desert'],
    skills: { 'Runecraft': 10 }, prereqs: ['Enter the Abyss'], points: 1, series: 'Order of Wizards',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Beneath Cursed Sands': {
    id: 'Beneath Cursed Sands', name: 'Beneath Cursed Sands',
    regions: ['Kharidian Desert'],
    skills: { 'Agility': 62, 'Crafting': 55, 'Firemaking': 55 }, prereqs: ['Contact!'], points: 2, series: 'Kharidian',
    difficulty: DropSource.QUEST_MASTER
  },
  'Sleeping Giants': {
    id: 'Sleeping Giants', name: 'Sleeping Giants',
    regions: ['Kharidian Desert'],
    skills: { 'Smithing': 15 }, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'The Garden of Death': {
    id: 'The Garden of Death', name: 'The Garden of Death',
    regions: ['Kourend & Kebos'],
    skills: { 'Farming': 20 }, prereqs: [], points: 1, series: 'Twisted Tales',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Secrets of the North': {
    id: 'Secrets of the North', name: 'Secrets of the North',
    regions: ['Fremennik', 'Kharidian Desert'],
    skills: { 'Thieving': 64, 'Agility': 56 }, prereqs: ['Hazeel Cult', 'The General\'s Shadow', 'Making Friends with My Arm'], points: 2, series: 'Mahjarrat',
    difficulty: DropSource.QUEST_MASTER
  },
  'Desert Treasure II': {
    id: 'Desert Treasure II', name: 'Desert Treasure II - The Fallen Empire',
    regions: ['Kharidian Desert', 'Asgarnia', 'Fremennik', 'Kourend & Kebos', 'Morytania'],
    skills: { 'Magic': 75, 'Firemaking': 75, 'Thieving': 70, 'Herblore': 62, 'Runecraft': 60, 'Construction': 60, 'Prayer': 60 }, prereqs: ['Desert Treasure I', 'Secrets of the North', 'Enakhra\'s Lament', 'Temple of the Eye', 'The Garden of Death', 'Below Ice Mountain'], points: 5, series: 'Mahjarrat',
    difficulty: DropSource.QUEST_GRANDMASTER
  },
  'The Path of Glouphrie': {
    id: 'The Path of Glouphrie', name: 'The Path of Glouphrie',
    regions: ['Kandarin'],
    skills: { 'Strength': 60, 'Slayer': 56, 'Thieving': 56, 'Ranged': 47, 'Agility': 45 }, prereqs: ['The Eyes of Glouphrie', 'Waterfall Quest', 'Tree Gnome Village'], points: 2, series: 'Gnome',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Children of the Sun': {
    id: 'Children of the Sun', name: 'Children of the Sun',
    regions: ['Misthalin'],
    skills: {}, prereqs: [], points: 1, series: 'Twilight Emissaries',
    difficulty: DropSource.QUEST_NOVICE
  },
  'Defender of Varrock': {
    id: 'Defender of Varrock', name: 'Defender of Varrock',
    regions: ['Misthalin'],
    skills: { 'Smithing': 55, 'Hunter': 52 }, prereqs: ['Shield of Arrav', 'Romeo & Juliet', 'Demon Slayer', 'Temple of Ikov', 'Below Ice Mountain', 'Family Crest', 'Garden of Tranquillity', 'What Lies Below'], points: 2, series: 'Mahjarrat',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Twilight\'s Promise': {
    id: 'Twilight\'s Promise', name: 'Twilight\'s Promise',
    regions: ['Varlamore'],
    skills: {}, prereqs: ['Children of the Sun'], points: 1, series: 'Twilight Emissaries',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'At First Light': {
    id: 'At First Light', name: 'At First Light',
    regions: ['Varlamore'],
    skills: { 'Hunter': 46, 'Herblore': 30, 'Construction': 27 }, prereqs: ['Children of the Sun'], points: 1,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Perilous Moons': {
    id: 'Perilous Moons', name: 'Perilous Moons',
    regions: ['Varlamore'],
    skills: { 'Slayer': 48, 'Hunter': 20, 'Fishing': 20, 'Runecraft': 20, 'Construction': 10 }, prereqs: ['Twilight\'s Promise'], points: 2,
    difficulty: DropSource.QUEST_MASTER
  },
  'The Ribbiting Tale': {
    id: 'The Ribbiting Tale', name: 'The Ribbiting Tale of a Lily Pad Labour Dispute',
    regions: ['Varlamore'],
    skills: { 'Woodcutting': 15 }, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_NOVICE
  },
  'While Guthix Sleeps': {
    id: 'While Guthix Sleeps', name: 'While Guthix Sleeps',
    regions: ['Misthalin', 'Asgarnia', 'Kandarin'],
    skills: { 'Thieving': 72, 'Magic': 65, 'Herblore': 57, 'Agility': 56, 'Farming': 65, 'Hunter': 55 }, prereqs: ['Dream Mentor', 'Legends\' Quest', 'The Path of Glouphrie', 'Defender of Varrock'], points: 5, series: 'Mahjarrat',
    difficulty: DropSource.QUEST_GRANDMASTER
  },
  'The Heart of Darkness': {
    id: 'The Heart of Darkness', name: 'The Heart of Darkness',
    regions: ['Varlamore'],
    skills: { 'Mining': 55, 'Thieving': 48, 'Slayer': 48, 'Agility': 46 }, prereqs: ['Twilight\'s Promise', 'Meat and Greet'], points: 2, series: 'Twilight Emissaries',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Death on the Isle': {
    id: 'Death on the Isle', name: 'Death on the Isle',
    regions: ['Varlamore'],
    skills: { 'Thieving': 34, 'Agility': 32 }, prereqs: ['Children of the Sun'], points: 2,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Meat and Greet': {
    id: 'Meat and Greet', name: 'Meat and Greet',
    regions: ['Varlamore'],
    skills: { 'Cooking': 50 }, prereqs: ['Children of the Sun'], points: 1,
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Ethically Acquired Antiquities': {
    id: 'Ethically Acquired Antiquities', name: 'Ethically Acquired Antiquities',
    regions: ['Varlamore'],
    skills: { 'Thieving': 25 }, prereqs: ['Children of the Sun'], points: 1,
    difficulty: DropSource.QUEST_NOVICE
  },
  'The Curse of Arrav': {
    id: 'The Curse of Arrav', name: 'The Curse of Arrav',
    regions: ['Misthalin'],
    skills: { 'Agility': 64, 'Ranged': 64, 'Strength': 64, 'Thieving': 64, 'Mining': 64, 'Farming': 64 }, prereqs: ['Defender of Varrock', 'While Guthix Sleeps'], points: 2, series: 'Mahjarrat',
    difficulty: DropSource.QUEST_MASTER
  },
  'The Final Dawn': {
    id: 'The Final Dawn', name: 'The Final Dawn',
    regions: ['Varlamore'],
    skills: {}, prereqs: ['The Heart of Darkness'], points: 3, series: 'Twilight Emissaries',
    difficulty: DropSource.QUEST_MASTER
  },
  'Shadows of Custodia': {
    id: 'Shadows of Custodia', name: 'Shadows of Custodia',
    regions: ['Varlamore'],
    skills: {}, prereqs: [], points: 2,
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Scrambled!': {
    id: 'Scrambled!', name: 'Scrambled!',
    regions: ['Varlamore'],
    skills: {}, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Pandemonium': {
    id: 'Pandemonium', name: 'Pandemonium',
    regions: ['The Open Seas'],
    skills: {}, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Prying Times': {
    id: 'Prying Times', name: 'Prying Times',
    regions: ['The Open Seas'],
    skills: {}, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Current Affairs': {
    id: 'Current Affairs', name: 'Current Affairs',
    regions: ['The Open Seas'],
    skills: {}, prereqs: [], points: 1,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Troubled Tortugans': {
    id: 'Troubled Tortugans', name: 'Troubled Tortugans',
    regions: ['The Open Seas'],
    skills: {}, prereqs: [], points: 1, series: 'Tortugan',
    difficulty: DropSource.QUEST_EXPERIENCED
  },

  // --- Miniquests ---
  'Alfred Grimhand\'s Barcrawl': {
    id: 'Alfred Grimhand\'s Barcrawl', name: 'Alfred Grimhand\'s Barcrawl',
    regions: ['Kandarin'], // Barbarian Outpost start
    skills: {}, prereqs: [], points: 0,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Barbarian Training': {
    id: 'Barbarian Training', name: 'Barbarian Training',
    regions: ['Kandarin'], // Otto's Grotto
    skills: { 'Fishing': 48, 'Crafting': 11, 'Smithing': 35, 'Firemaking': 35, 'Strength': 15, 'Agility': 15, 'Herblore': 4 },
    prereqs: ['Tai Bwo Wannai Trio'], points: 0,
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Bear Your Soul': {
    id: 'Bear Your Soul', name: 'Bear Your Soul',
    regions: ['Kourend & Kebos'],
    skills: {}, prereqs: ['Client of Kourend'], points: 0, series: 'Great Kourend',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Curse of the Empty Lord': {
    id: 'Curse of the Empty Lord', name: 'Curse of the Empty Lord',
    regions: ['Misthalin'], // Starts in Varrock/Canifis connection or general ghostly robe hunt
    skills: {}, prereqs: ['Desert Treasure I'], points: 0, series: 'Mahjarrat',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Daddy\'s Home': {
    id: 'Daddy\'s Home', name: 'Daddy\'s Home',
    regions: ['Misthalin'], // Varrock
    skills: {}, prereqs: [], points: 0,
    difficulty: DropSource.QUEST_NOVICE
  },
  'The Enchanted Key': {
    id: 'The Enchanted Key', name: 'The Enchanted Key',
    regions: ['Misthalin'], // Start
    skills: {}, prereqs: ['Making History'], points: 0,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Enter the Abyss': {
    id: 'Enter the Abyss', name: 'Enter the Abyss',
    regions: ['Misthalin'], // Varrock
    skills: {}, prereqs: ['Rune Mysteries'], points: 0, series: 'Order of Wizards',
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'Family Pest': {
    id: 'Family Pest', name: 'Family Pest',
    regions: ['Misthalin'], // Lumbridge/Varrock
    skills: {}, prereqs: ['Family Crest'], points: 0,
    difficulty: DropSource.QUEST_INTERMEDIATE
  },
  'The Frozen Door': {
    id: 'The Frozen Door', name: 'The Frozen Door',
    regions: ['Asgarnia'], // God Wars Dungeon
    skills: { 'Agility': 70, 'Strength': 70, 'Ranged': 70, 'Hitpoints': 70 }, 
    prereqs: ['Desert Treasure I'], // GWD reqs usually imply access
    points: 0,
    difficulty: DropSource.QUEST_MASTER
  },
  'The General\'s Shadow': {
    id: 'The General\'s Shadow', name: 'The General\'s Shadow',
    regions: ['Kandarin'], // Fight Arena/Gnome area
    skills: {}, prereqs: ['Fight Arena', 'Curse of the Empty Lord'], points: 0, series: 'Mahjarrat',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'His Faithful Servants': {
    id: 'His Faithful Servants', name: 'His Faithful Servants',
    regions: ['Morytania'], // Barrows
    skills: { 'Prayer': 50 }, prereqs: ['Priest in Peril'], points: 0, series: 'Mahjarrat',
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Hopespear\'s Will': {
    id: 'Hopespear\'s Will', name: 'Hopespear\'s Will',
    regions: ['Asgarnia'], // Goblin Village
    skills: { 'Prayer': 50 }, prereqs: ['Land of the Goblins'], points: 0,
    difficulty: DropSource.QUEST_MASTER
  },
  'In Search of Knowledge': {
    id: 'In Search of Knowledge', name: 'In Search of Knowledge',
    regions: ['Kourend & Kebos'], // Arceuus
    skills: {}, prereqs: ['Client of Kourend'], points: 0,
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Into the Tombs': {
    id: 'Into the Tombs', name: 'Into the Tombs',
    regions: ['Kharidian Desert'],
    skills: {}, prereqs: ['Beneath Cursed Sands'], points: 0, series: 'Kharidian',
    difficulty: DropSource.QUEST_MASTER
  },
  'Lair of Tarn Razorlor': {
    id: 'Lair of Tarn Razorlor', name: 'Lair of Tarn Razorlor',
    regions: ['Morytania'], // Haunted Mine
    skills: { 'Slayer': 40 }, prereqs: ['Haunted Mine'], points: 0,
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Mage Arena I': {
    id: 'Mage Arena I', name: 'Mage Arena I',
    regions: ['Wilderness'],
    skills: { 'Magic': 60 }, prereqs: [], points: 0,
    difficulty: DropSource.QUEST_EXPERIENCED
  },
  'Mage Arena II': {
    id: 'Mage Arena II', name: 'Mage Arena II',
    regions: ['Wilderness'],
    skills: { 'Magic': 75 }, prereqs: ['Mage Arena I'], points: 0,
    difficulty: DropSource.QUEST_MASTER
  },
  'Skippy and the Mogres': {
    id: 'Skippy and the Mogres', name: 'Skippy and the Mogres',
    regions: ['Asgarnia'], // Mudskipper Point
    skills: { 'Cooking': 20 }, prereqs: [], points: 0,
    difficulty: DropSource.QUEST_NOVICE
  },
  'Vale Totems': {
    id: 'Vale Totems', name: 'Vale Totems',
    regions: ['Varlamore'],
    skills: {}, prereqs: ['Children of the Sun'], points: 0,
    difficulty: DropSource.QUEST_NOVICE
  }
};
