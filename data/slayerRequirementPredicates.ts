import { QUEST_DATA } from './questData';
import type { RequirementPredicate } from '../utils/requirementPredicates';

/** Exact source clauses reviewed against the pinned chunk snapshot. Numeric suffixes
 * identify quest progress, not completed quests. Current progress/access is untracked. */
const MANUAL: Record<string, string> = {
  'Ancient Cavern access': 'Ancient Cavern access unlocked through Barbarian Training for this assignment',
  'Contact! 4': 'Contact! progressed to the required Scabarite access for this assignment',
  'Desert Treasure I 7c1': 'Desert Treasure I progressed to Smoke Dungeon access for this assignment',
  'Dock at Grimstone': 'Docked at Grimstone and a legal route to the assigned frost dragons is available',
  'Dragon Slayer I 1': 'Dragon Slayer I started sufficiently for this dragon assignment',
  'Lunar Diplomacy 6': 'Lunar Diplomacy progressed to Lunar Isle access for this Suqah assignment',
  "Mourning's End Part II 2": "Mourning's End Part II progressed to the access required for this dark beast assignment",
  "Olaf's Quest 5": "Olaf's Quest progressed to Brine Rat Cavern access",
  'Rum Deal 3': 'Rum Deal progressed to the required fever spider access',
  'Unlock the door (Magic axe hut)': 'The Magic axe hut door can be legally opened for this assignment',
  // The pinned source codeItems.tasksPlus expands this token to these two routes.
  'WildernessPirateAccess[+]': 'A legal accessible route to wilderness pirates or wilderness zombie pirates is available',
};

export function slayerRequirementPredicate(clause: string): RequirementPredicate {
  const completed = /^(.*?) Complete the quest$/.exec(clause);
  if (completed && Object.hasOwn(QUEST_DATA, completed[1].trim())) return { kind: 'quest', id: completed[1].trim() };
  if (Object.hasOwn(MANUAL, clause)) return { kind: 'manual', key: `slayer-source:${clause}`, label: MANUAL[clause] };
  return { kind: 'unknown', key: `slayer-source:${clause}`, label: `Unclassified Slayer requirement: ${clause}` };
}
