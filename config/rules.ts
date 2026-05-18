
import { DropSource } from '../types';

export const EQUIPMENT_TIER_MAX = 9;

export const DROP_RATES: Record<string, number> = {
  [DropSource.QUEST_NOVICE]: 25,
  [DropSource.QUEST_INTERMEDIATE]: 50,
  [DropSource.QUEST_EXPERIENCED]: 75,
  [DropSource.QUEST_MASTER]: 95,
  [DropSource.QUEST_GRANDMASTER]: 100,
  
  [DropSource.CA_EASY]: 10,
  [DropSource.CA_MEDIUM]: 20,
  [DropSource.CA_HARD]: 35,
  [DropSource.CA_ELITE]: 50,
  [DropSource.CA_MASTER]: 75,
  [DropSource.CA_GRANDMASTER]: 100,
  
  [DropSource.COLLECTION_LOG]: 20,
  
  [DropSource.DIARY_EASY]: 33,
  [DropSource.DIARY_MEDIUM]: 66,
  [DropSource.DIARY_HARD]: 99,
  [DropSource.DIARY_ELITE]: 100,
  
  // Specific Slayer Master Rates
  [DropSource.SLAYER_BEGINNER]: 5,
  [DropSource.SLAYER_MAZCHNA]: 10,
  [DropSource.SLAYER_VANNAKA]: 20,
  [DropSource.SLAYER_CHAELDAR]: 25,
  [DropSource.SLAYER_KONAR]: 35,
  [DropSource.SLAYER_NIEVE]: 45,
  [DropSource.SLAYER_KRYSTILIA]: 65,
  [DropSource.SLAYER_DURADEL]: 70,
  [DropSource.SLAYER_BOSS]: 80,

  [DropSource.CLUE_BEGINNER]: 5,
  [DropSource.CLUE_EASY]: 10,
  [DropSource.CLUE_MEDIUM]: 20,
  [DropSource.CLUE_HARD]: 35,
  [DropSource.CLUE_ELITE]: 65,
  [DropSource.CLUE_MASTER]: 80,
  
  [DropSource.CUSTOM]: 50,
};
