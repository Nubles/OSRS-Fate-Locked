
import { DropSource } from '../types';

export interface CATier {
  id: string; // e.g. "Easy"
  pointsRequired: number; // Official cumulative points required for this reward tier
  recommendedStats: string;
  keyUnlocks: string[]; // Important bosses or items
  difficulty: DropSource;
}

export const CA_DATA: Record<string, CATier> = {
  'Easy': {
    id: 'Easy',
    pointsRequired: 41,
    recommendedStats: 'Base 60 Combat, 50 Slayer',
    keyUnlocks: ['Wintertodt', 'Obor', 'Bryophyta', 'KBD', 'Tempoross'],
    difficulty: DropSource.CA_EASY
  },
  'Medium': {
    id: 'Medium',
    pointsRequired: 161,
    recommendedStats: 'Base 70 Combat, 77 Slayer',
    keyUnlocks: ['Barrows', 'Giant Mole', 'Sarachnis', 'Dagannoth Kings', 'Hespori'],
    difficulty: DropSource.CA_MEDIUM
  },
  'Hard': {
    id: 'Hard',
    pointsRequired: 419,
    recommendedStats: 'Base 80 Combat, 85 Slayer',
    keyUnlocks: ['Zulrah', 'Vorkath', 'Grotesque Guardians', 'God Wars Dungeon', 'Muspah'],
    difficulty: DropSource.CA_HARD
  },
  'Elite': {
    id: 'Elite',
    pointsRequired: 1075,
    recommendedStats: 'Base 90 Combat, 90 Slayer',
    keyUnlocks: ['Chambers of Xeric', 'Gauntlet', 'Hydra', 'Nightmare', 'Sire', 'Cerberus'],
    difficulty: DropSource.CA_ELITE
  },
  'Master': {
    id: 'Master',
    pointsRequired: 1940,
    recommendedStats: 'Maxed Combat, 95 Slayer',
    keyUnlocks: ['Theatre of Blood', 'Inferno', 'Corrupted Gauntlet', 'Nex', 'Phosani'],
    difficulty: DropSource.CA_MASTER
  },
  'Grandmaster': {
    id: 'Grandmaster',
    pointsRequired: 2672,
    recommendedStats: 'Maxed, BiS Gear',
    keyUnlocks: ['All Content (Speedruns & Perfect kills)'],
    difficulty: DropSource.CA_GRANDMASTER
  }
};
