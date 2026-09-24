
import { DropSource } from '../types';

export interface CATier {
  id: string; // e.g. "Easy"
  pointsRequired: number; // Official cumulative points required for this reward tier
  recommendedStats: string;
  /** Bosses central to this tier, by their exact Bosses-table names (CALog shows
   *  each as owned or locked). */
  keyUnlocks: string[];
  difficulty: DropSource;
}

export const CA_DATA: Record<string, CATier> = {
  'Easy': {
    id: 'Easy',
    pointsRequired: 41,
    recommendedStats: 'Base 60 Combat, 50 Slayer',
    keyUnlocks: ['Wintertodt', 'Obor', 'Bryophyta', 'King Black Dragon', 'Tempoross'],
    difficulty: DropSource.CA_EASY
  },
  'Medium': {
    id: 'Medium',
    pointsRequired: 169,
    recommendedStats: 'Base 70 Combat, 77 Slayer',
    keyUnlocks: ['Barrows Brothers', 'Giant Mole', 'Sarachnis', 'Dagannoth Kings', 'Hespori'],
    difficulty: DropSource.CA_MEDIUM
  },
  'Hard': {
    id: 'Hard',
    pointsRequired: 436,
    recommendedStats: 'Base 80 Combat, 85 Slayer',
    keyUnlocks: ['Zulrah', 'Vorkath', 'Grotesque Guardians', 'General Graardor', 'Phantom Muspah'],
    difficulty: DropSource.CA_HARD
  },
  'Elite': {
    id: 'Elite',
    pointsRequired: 1100,
    recommendedStats: 'Base 90 Combat, 90 Slayer',
    keyUnlocks: ['Chambers of Xeric', 'The Gauntlet', 'Alchemical Hydra', 'The Nightmare', 'Abyssal Sire', 'Cerberus'],
    difficulty: DropSource.CA_ELITE
  },
  'Master': {
    id: 'Master',
    pointsRequired: 1965,
    recommendedStats: 'Maxed Combat, 95 Slayer',
    keyUnlocks: ['Theatre of Blood', 'Inferno', 'The Gauntlet', 'Nex', "Phosani's Nightmare"],
    difficulty: DropSource.CA_MASTER
  },
  'Grandmaster': {
    id: 'Grandmaster',
    pointsRequired: 2697,
    recommendedStats: 'Maxed, BiS Gear',
    keyUnlocks: ['Chambers of Xeric', 'Theatre of Blood', 'Tombs of Amascut', 'Fortis Colosseum', 'Inferno'],
    difficulty: DropSource.CA_GRANDMASTER
  }
};
