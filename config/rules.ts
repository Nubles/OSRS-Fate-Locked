
import { DropSource } from '../types';

export const EQUIPMENT_TIER_MAX = 9;

export const DROP_RATES: Record<string, number> = {
  [DropSource.QUEST_NOVICE]: 25,
  [DropSource.QUEST_INTERMEDIATE]: 50,
  [DropSource.QUEST_EXPERIENCED]: 75,
  [DropSource.QUEST_MASTER]: 95,
  [DropSource.QUEST_GRANDMASTER]: 100,
  
  // Rebalanced 2026: the bulk repeatable sources (CAs 637 tasks, diaries 485,
  // collection log 1,905 slots, level-ups) were ~2x over-funding the 805-key
  // sink. Trimmed so total one-time earn ≈ 1.2x the sink — keys stay scarce, and
  // slayer & clues remain the flexible top-up income. See config/economy.ts.
  [DropSource.CA_EASY]: 8,
  [DropSource.CA_MEDIUM]: 15,
  [DropSource.CA_HARD]: 25,
  [DropSource.CA_ELITE]: 30,
  [DropSource.CA_MASTER]: 40,
  [DropSource.CA_GRANDMASTER]: 55,

  [DropSource.COLLECTION_LOG]: 8,

  [DropSource.DIARY_EASY]: 20,
  [DropSource.DIARY_MEDIUM]: 40,
  [DropSource.DIARY_HARD]: 65,
  [DropSource.DIARY_ELITE]: 85,
  
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

  // Repeatable endgame faucets — keep unlocked bosses/raids/activities/pets
  // earning keys long after the one-time sources (quests/diaries/CAs) dry up.
  [DropSource.BOSS_LOW]: 15,
  [DropSource.BOSS_MID]: 30,
  [DropSource.BOSS_HIGH]: 50,
  [DropSource.RAID]: 65,
  [DropSource.ACTIVITY_MINIGAME]: 10,
  [DropSource.ACTIVITY_SKILLING]: 15,
  [DropSource.ACTIVITY_INFERNO]: 35,
  [DropSource.PET]: 100,

  [DropSource.CUSTOM]: 50,
};
