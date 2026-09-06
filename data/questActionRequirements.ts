import type { RequirementPredicate } from '../utils/requirementPredicates';

/** A reviewed contract covers compulsory quest actions AFTER supplies have been
 * acquired legally. A supply route must carry its own gathering/crafting/combat
 * gates; an empty action contract never proves that supply route or geography.
 * Source: Quest Helper at this pinned revision, reviewed 2026-09-06. */
const HELPER_REVISION = '633ab56e2eb3eb363f21da3fd75f6f2bc0fa073a';
const helperSource = (folder: string, file: string) =>
  `https://github.com/Zoinkwiz/quest-helper/blob/${HELPER_REVISION}/src/main/java/com/questhelper/helpers/quests/${folder}/${file}.java`;

interface QuestActionReview {
  source: string;
  symbols: string[];
  rationale: string;
  requirements: RequirementPredicate[];
}

export const QUEST_ACTION_REVIEWS: Readonly<Record<string, QuestActionReview>> = {
  'Rune Mysteries': {
    source: helperSource('runemysteries', 'RuneMysteries'),
    symbols: ['setupSteps', 'loadSteps', 'getItemRecommended'],
    rationale: 'Deliver the talisman, research package and notes through dialogue. No equipment is worn, rune essence is not mined, and recommended teleports are optional.',
    requirements: [],
  },
  "Cook's Assistant": {
    source: helperSource('cooksassistant', 'CooksAssistant'),
    symbols: ['finishQuest', 'loadSteps'],
    rationale: 'The Cook accepts prepared egg, milk and flour. Cooking is not performed to complete the quest; collecting these supplies is checked by the chosen acquisition route.',
    requirements: [],
  },
  "Doric's Quest": {
    source: helperSource('doricsquest', 'DoricsQuest'),
    symbols: ['talkToDoric', 'getGeneralRecommended', 'loadSteps'],
    rationale: 'Doric accepts prepared unnoted ores and clay. Mining 15 is explicitly recommended only for self-gathering, and no anvil action or equipped pickaxe is compulsory.',
    requirements: [],
  },
  'Romeo & Juliet': {
    source: helperSource('romeoandjuliet', 'RomeoAndJuliet'),
    symbols: ['talkToApothecary', 'givePotionToJuliet', 'loadSteps'],
    rationale: 'The Apothecary makes the potion when given berries. The player delivers messages and potion; no player Herblore method or worn equipment is required.',
    requirements: [],
  },
  'Sheep Shearer': {
    source: helperSource('sheepshearer', 'SheepShearer'),
    symbols: ['startStep', 'turnInBalls', 'setupRequirements'],
    rationale: 'Fred accepts 20 prepared balls of wool immediately. Shears and spinning are conditional acquisition-route requirements, not universal quest actions.',
    requirements: [],
  },
  'Imp Catcher': {
    source: helperSource('impcatcher', 'ImpCatcher'),
    symbols: ['turnInQuest', 'loadSteps', 'getCombatRequirements'],
    rationale: 'Mizgog accepts the four prepared beads. Killing imps belongs to a bead acquisition route. The rewarded amulet of accuracy does not have to be worn.',
    requirements: [],
  },
};

/** Undefined is unreviewed; [] is an explicit reviewed absence of action gates. */
export function reviewedQuestActionRequirements(questId: string): RequirementPredicate[] | undefined {
  return Object.hasOwn(QUEST_ACTION_REVIEWS, questId)
    ? QUEST_ACTION_REVIEWS[questId].requirements
    : undefined;
}
