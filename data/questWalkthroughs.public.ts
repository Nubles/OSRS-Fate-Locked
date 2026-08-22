import { f2pQuestMembershipFor } from './f2pQuestMembership';
import { reviewedQuestRequirements } from './questItemRequirements';
import { publicQuestWalkthroughReleaseFor } from './questWalkthroughPublicRelease';
import {
  questStrategyFromWalkthrough,
  type QuestStrategyDefinition,
} from '../utils/questStrategies/model';
import type {
  QuestActionCoachMetadata,
  QuestWalkthroughActionDefinition,
  QuestWalkthroughDefinition,
  WalkthroughActionKind,
  WalkthroughItemRef,
} from '../utils/questWalkthroughs/model';
import type { ChunkKey } from '../utils/questRoutes/model';

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

const item = (key: string, name: string) => ({ key, name });

const playerItem = (
  key: string,
  name: string,
  quantity = 1,
): WalkthroughItemRef => ({
  item: item(key, name),
  quantity,
  supplyPolicy: 'PLAYER_OBTAINED',
});

const questItem = (
  key: string,
  name: string,
  quantity = 1,
): WalkthroughItemRef => ({
  item: item(key, name),
  quantity,
  supplyPolicy: 'QUEST_PROVIDED',
});

const coach = (
  overrides: Partial<QuestActionCoachMetadata> = {},
): QuestActionCoachMetadata => ({
  consumes: [],
  fulfils: [],
  completion: { kind: 'MANUAL' },
  fallbackPolicy: 'NONE',
  ...overrides,
});

interface PublicActionInput {
  readonly id: string;
  readonly sourceOrder: number;
  readonly kind: WalkthroughActionKind;
  readonly displayText: string;
  readonly chunk: ChunkKey;
  readonly dependsOn?: readonly string[];
  readonly items?: readonly WalkthroughItemRef[];
  readonly coach: QuestActionCoachMetadata;
}

const action = ({
  id,
  sourceOrder,
  kind,
  displayText,
  chunk,
  dependsOn = [],
  items = [],
  coach: actionCoach,
}: PublicActionInput): QuestWalkthroughActionDefinition => ({
  id,
  section: 'QUEST',
  sourceOrder,
  kind,
  confidence: 'EXACT',
  displayText,
  rawWikiLineIds: [],
  dependsOn,
  entities: [],
  items,
  gates: [],
  location: { kind: 'EXPLICIT_CHUNKS', chunks: [chunk] },
  coach: actionCoach,
});

const independentlyAuthoredSource = (
  wikiTitle: string,
  wikiRevision: string,
  wikiRevisionTimestamp: string,
): QuestWalkthroughDefinition['source'] => ({
  kind: 'INDEPENDENT_REVIEW',
  author: 'Fate Locked',
  authoredAt: '2026-08-22',
  methodology: 'Independently authored quest steps and F2P chunk locations.',
  wikiTitle,
  wikiRevision,
  wikiRevisionTimestamp,
  wikiUrl: `https://oldschool.runescape.wiki/w/${wikiTitle
    .split('/')
    .map(part => encodeURIComponent(part.replace(/\s+/g, '_')).replace(/'/g, '%27'))
    .join('/')}?oldid=${wikiRevision}`,
  wikiLicence: 'CC BY-NC-SA 3.0',
  wikiLicenceUrl: 'https://creativecommons.org/licenses/by-nc-sa/3.0/',
});

const publicDefinition = (
  questId: string,
  wikiRevision: string,
  wikiRevisionTimestamp: string,
  actions: readonly QuestWalkthroughActionDefinition[],
): QuestWalkthroughDefinition => {
  const release = publicQuestWalkthroughReleaseFor(questId);
  const membership = f2pQuestMembershipFor(questId);
  if (!release || !membership) throw new Error(`Missing public RuneProof release metadata for ${questId}.`);

  return {
    questId,
    revision: release.revision,
    releaseStatus: release.releaseStatus,
    source: independentlyAuthoredSource(membership.wikiTitle, wikiRevision, wikiRevisionTimestamp),
    sourceLines: [],
    actions,
  };
};

const cookActions = [
  action({
    id: 'cooks-assistant:start-quest',
    sourceOrder: 1,
    kind: 'TALK_TO',
    displayText: 'Speak with the Cook in Lumbridge Castle to begin.',
    chunk: '50,50',
    coach: coach(),
  }),
  action({
    id: 'cooks-assistant:take-pot',
    sourceOrder: 2,
    kind: 'ACQUIRE',
    displayText: 'Take the empty pot from the Cook\'s kitchen.',
    chunk: '50,50',
    dependsOn: ['cooks-assistant:start-quest'],
    coach: coach({ fulfils: [playerItem('pot', 'Pot')] }),
  }),
  action({
    id: 'cooks-assistant:take-bucket',
    sourceOrder: 3,
    kind: 'ACQUIRE',
    displayText: 'Collect a bucket from the Lumbridge Castle cellar.',
    chunk: '50,50',
    dependsOn: ['cooks-assistant:take-pot'],
    coach: coach({ fulfils: [playerItem('bucket', 'Bucket')] }),
  }),
  action({
    id: 'cooks-assistant:milk-cow',
    sourceOrder: 4,
    kind: 'USE_ITEM',
    displayText: 'Use the bucket on a dairy cow in the Lumbridge field.',
    chunk: '50,51',
    dependsOn: ['cooks-assistant:take-bucket'],
    items: [playerItem('bucket', 'Bucket')],
    coach: coach({
      consumes: [playerItem('bucket', 'Bucket')],
      fulfils: [playerItem('bucket of milk', 'Bucket of milk')],
      completion: { kind: 'ITEM_CONFIRMED', itemKey: 'bucket of milk' },
      fallbackPolicy: 'BLOCK_THEN_ALTERNATIVES',
      preferredMethod: { kind: 'TRANSFORMATION', recipeId: 'milk-cow' },
    }),
  }),
  action({
    id: 'cooks-assistant:take-egg',
    sourceOrder: 5,
    kind: 'ACQUIRE',
    displayText: 'Pick up an egg at the chicken farm beside the cow field.',
    chunk: '50,51',
    dependsOn: ['cooks-assistant:milk-cow'],
    coach: coach({
      fulfils: [playerItem('egg', 'Egg')],
      completion: { kind: 'ITEM_CONFIRMED', itemKey: 'egg' },
      fallbackPolicy: 'BLOCK_THEN_ALTERNATIVES',
    }),
  }),
  action({
    id: 'cooks-assistant:pick-grain',
    sourceOrder: 6,
    kind: 'ACQUIRE',
    displayText: 'Pick grain outside Mill Lane Mill.',
    chunk: '49,51',
    dependsOn: ['cooks-assistant:take-egg'],
    coach: coach({
      fulfils: [playerItem('grain', 'Grain')],
      preferredMethod: { kind: 'TRANSFORMATION', recipeId: 'pick-wheat' },
    }),
  }),
  action({
    id: 'cooks-assistant:make-flour',
    sourceOrder: 7,
    kind: 'USE_ITEM',
    displayText: 'Grind the grain at Mill Lane Mill and collect the flour in your pot.',
    chunk: '49,51',
    dependsOn: ['cooks-assistant:pick-grain'],
    items: [playerItem('grain', 'Grain'), playerItem('pot', 'Pot')],
    coach: coach({
      consumes: [playerItem('grain', 'Grain'), playerItem('pot', 'Pot')],
      fulfils: [playerItem('pot of flour', 'Pot of flour')],
      completion: { kind: 'ITEM_CONFIRMED', itemKey: 'pot of flour' },
      fallbackPolicy: 'BLOCK_THEN_ALTERNATIVES',
      preferredMethod: { kind: 'TRANSFORMATION', recipeId: 'grain-to-flour' },
    }),
  }),
  action({
    id: 'cooks-assistant:return-to-cook',
    sourceOrder: 8,
    kind: 'TALK_TO',
    displayText: 'Return to the Cook with the milk, egg, and pot of flour.',
    chunk: '50,50',
    dependsOn: ['cooks-assistant:make-flour'],
    items: [
      playerItem('bucket of milk', 'Bucket of milk'),
      playerItem('egg', 'Egg'),
      playerItem('pot of flour', 'Pot of flour'),
    ],
    coach: coach({
      consumes: [
        playerItem('bucket of milk', 'Bucket of milk'),
        playerItem('egg', 'Egg'),
        playerItem('pot of flour', 'Pot of flour'),
      ],
    }),
  }),
  action({
    id: 'cooks-assistant:complete',
    sourceOrder: 9,
    kind: 'INFORMATION',
    displayText: 'Cook\'s Assistant is complete.',
    chunk: '50,50',
    dependsOn: ['cooks-assistant:return-to-cook'],
    coach: coach({ completion: { kind: 'QUEST_COMPLETED', questId: "Cook's Assistant" } }),
  }),
] as const;

const sheepActions = [
  action({
    id: 'sheep-shearer:start-with-fred',
    sourceOrder: 1,
    kind: 'TALK_TO',
    displayText: 'Ask Fred the Farmer, north of Lumbridge, for work.',
    chunk: '49,51',
    coach: coach({ fulfils: [questItem('shears', 'Shears')] }),
  }),
  action({
    id: 'sheep-shearer:shear-wool',
    sourceOrder: 2,
    kind: 'USE_ITEM',
    displayText: 'Use Fred\'s shears on nearby sheep until you have 20 wool.',
    chunk: '49,51',
    dependsOn: ['sheep-shearer:start-with-fred'],
    items: [questItem('shears', 'Shears')],
    coach: coach({
      fulfils: [playerItem('wool', 'Wool', 20)],
      preferredMethod: { kind: 'TRANSFORMATION', recipeId: 'shear-sheep' },
    }),
  }),
  action({
    id: 'sheep-shearer:spin-wool',
    sourceOrder: 3,
    kind: 'USE_ITEM',
    displayText: 'Spin the 20 wool into 20 balls of wool upstairs in Lumbridge Castle.',
    chunk: '50,50',
    dependsOn: ['sheep-shearer:shear-wool'],
    coach: coach({
      consumes: [playerItem('wool', 'Wool', 20)],
      fulfils: [playerItem('ball of wool', 'Ball of wool', 20)],
      completion: { kind: 'ITEM_CONFIRMED', itemKey: 'ball of wool' },
      fallbackPolicy: 'BLOCK_THEN_ALTERNATIVES',
      preferredMethod: { kind: 'TRANSFORMATION', recipeId: 'spin-wool' },
    }),
  }),
  action({
    id: 'sheep-shearer:return-to-fred',
    sourceOrder: 4,
    kind: 'TALK_TO',
    displayText: 'Take 20 unnoted balls of wool back to Fred.',
    chunk: '49,51',
    dependsOn: ['sheep-shearer:spin-wool'],
    items: [playerItem('ball of wool', 'Ball of wool', 20)],
    coach: coach({ consumes: [playerItem('ball of wool', 'Ball of wool', 20)] }),
  }),
  action({
    id: 'sheep-shearer:complete',
    sourceOrder: 5,
    kind: 'INFORMATION',
    displayText: 'Sheep Shearer is complete.',
    chunk: '49,51',
    dependsOn: ['sheep-shearer:return-to-fred'],
    coach: coach({ completion: { kind: 'QUEST_COMPLETED', questId: 'Sheep Shearer' } }),
  }),
] as const;

const restlessGhostActions = [
  action({
    id: 'the-restless-ghost:start-with-aereck',
    sourceOrder: 1,
    kind: 'TALK_TO',
    displayText: 'Talk to Father Aereck in Lumbridge church to begin.',
    chunk: '50,50',
    coach: coach(),
  }),
  action({
    id: 'the-restless-ghost:get-amulet',
    sourceOrder: 2,
    kind: 'TALK_TO',
    displayText: 'Visit Father Urhney in western Lumbridge Swamp and take the ghostspeak amulet.',
    chunk: '49,49',
    dependsOn: ['the-restless-ghost:start-with-aereck'],
    coach: coach({ fulfils: [questItem('ghostspeak amulet', 'Ghostspeak amulet')] }),
  }),
  action({
    id: 'the-restless-ghost:talk-to-ghost',
    sourceOrder: 3,
    kind: 'TALK_TO',
    displayText: 'Wear the ghostspeak amulet and speak to the ghost in Lumbridge graveyard.',
    chunk: '50,49',
    dependsOn: ['the-restless-ghost:get-amulet'],
    items: [questItem('ghostspeak amulet', 'Ghostspeak amulet')],
    coach: coach(),
  }),
  action({
    id: 'the-restless-ghost:take-skull',
    sourceOrder: 4,
    kind: 'INTERACT_OBJECT',
    displayText: 'Search the altar in the Wizards\' Tower basement for the ghost\'s skull, then leave without fighting the skeleton.',
    chunk: '48,49',
    dependsOn: ['the-restless-ghost:talk-to-ghost'],
    coach: coach({ fulfils: [questItem("ghost's skull", "Ghost's skull")] }),
  }),
  action({
    id: 'the-restless-ghost:return-to-ghost',
    sourceOrder: 5,
    kind: 'TRAVEL',
    displayText: 'Return to the restless ghost in Lumbridge graveyard with the skull.',
    chunk: '50,49',
    dependsOn: ['the-restless-ghost:take-skull'],
    coach: coach(),
  }),
  action({
    id: 'the-restless-ghost:use-skull',
    sourceOrder: 6,
    kind: 'USE_ITEM',
    displayText: 'Use the skull on the graveyard coffin.',
    chunk: '50,49',
    dependsOn: ['the-restless-ghost:return-to-ghost'],
    items: [questItem("ghost's skull", "Ghost's skull")],
    coach: coach({ consumes: [questItem("ghost's skull", "Ghost's skull")] }),
  }),
  action({
    id: 'the-restless-ghost:complete',
    sourceOrder: 7,
    kind: 'INFORMATION',
    displayText: 'The Restless Ghost is complete.',
    chunk: '50,49',
    dependsOn: ['the-restless-ghost:use-skull'],
    coach: coach({ completion: { kind: 'QUEST_COMPLETED', questId: 'The Restless Ghost' } }),
  }),
] as const;

const runeMysteriesActions = [
  action({
    id: 'rune-mysteries:start-with-duke',
    sourceOrder: 1,
    kind: 'TALK_TO',
    displayText: 'Ask Duke Horacio in Lumbridge Castle about a quest and take the air talisman.',
    chunk: '50,50',
    coach: coach({ fulfils: [questItem('air talisman', 'Air talisman')] }),
  }),
  action({
    id: 'rune-mysteries:take-talisman-to-sedridor',
    sourceOrder: 2,
    kind: 'TALK_TO',
    displayText: 'Give the air talisman to Archmage Sedridor in the Wizards\' Tower basement.',
    chunk: '48,49',
    dependsOn: ['rune-mysteries:start-with-duke'],
    items: [questItem('air talisman', 'Air talisman')],
    coach: coach({
      consumes: [questItem('air talisman', 'Air talisman')],
      fulfils: [questItem('research package', 'Research package')],
    }),
  }),
  action({
    id: 'rune-mysteries:take-package-to-aubury',
    sourceOrder: 3,
    kind: 'TALK_TO',
    displayText: 'Deliver Sedridor\'s research package to Aubury in Varrock.',
    chunk: '50,53',
    dependsOn: ['rune-mysteries:take-talisman-to-sedridor'],
    items: [questItem('research package', 'Research package')],
    coach: coach({
      consumes: [questItem('research package', 'Research package')],
      fulfils: [questItem('research notes', 'Research notes')],
    }),
  }),
  action({
    id: 'rune-mysteries:return-notes-to-sedridor',
    sourceOrder: 4,
    kind: 'TALK_TO',
    displayText: 'Bring Aubury\'s research notes back to Sedridor.',
    chunk: '48,49',
    dependsOn: ['rune-mysteries:take-package-to-aubury'],
    items: [questItem('research notes', 'Research notes')],
    coach: coach({ consumes: [questItem('research notes', 'Research notes')] }),
  }),
  action({
    id: 'rune-mysteries:complete',
    sourceOrder: 5,
    kind: 'INFORMATION',
    displayText: 'Rune Mysteries is complete.',
    chunk: '48,49',
    dependsOn: ['rune-mysteries:return-notes-to-sedridor'],
    coach: coach({ completion: { kind: 'QUEST_COMPLETED', questId: 'Rune Mysteries' } }),
  }),
] as const;

const impAction = (
  colour: 'black' | 'red' | 'white' | 'yellow',
  sourceOrder: number,
): QuestWalkthroughActionDefinition => action({
  id: `imp-catcher:get-${colour}-bead`,
  sourceOrder,
  kind: 'KILL',
  displayText: `Kill imps around Draynor Village until you receive a ${colour} bead.`,
  chunk: '48,50',
  coach: coach({
    fulfils: [playerItem(`${colour} bead`, `${colour[0].toUpperCase()}${colour.slice(1)} bead`)],
    completion: { kind: 'ITEM_CONFIRMED', itemKey: `${colour} bead` },
    fallbackPolicy: 'INTERCHANGEABLE',
  }),
});

const impCatcherActions = [
  impAction('black', 1),
  impAction('red', 2),
  impAction('white', 3),
  impAction('yellow', 4),
  action({
    id: 'imp-catcher:give-beads-to-mizgog',
    sourceOrder: 5,
    kind: 'TALK_TO',
    displayText: 'Take all four beads to Wizard Mizgog at the Wizards\' Tower.',
    chunk: '48,49',
    dependsOn: [
      'imp-catcher:get-black-bead',
      'imp-catcher:get-red-bead',
      'imp-catcher:get-white-bead',
      'imp-catcher:get-yellow-bead',
    ],
    items: [
      playerItem('black bead', 'Black bead'),
      playerItem('red bead', 'Red bead'),
      playerItem('white bead', 'White bead'),
      playerItem('yellow bead', 'Yellow bead'),
    ],
    coach: coach({
      consumes: [
        playerItem('black bead', 'Black bead'),
        playerItem('red bead', 'Red bead'),
        playerItem('white bead', 'White bead'),
        playerItem('yellow bead', 'Yellow bead'),
      ],
    }),
  }),
  action({
    id: 'imp-catcher:complete',
    sourceOrder: 6,
    kind: 'INFORMATION',
    displayText: 'Imp Catcher is complete.',
    chunk: '48,49',
    dependsOn: ['imp-catcher:give-beads-to-mizgog'],
    coach: coach({ completion: { kind: 'QUEST_COMPLETED', questId: 'Imp Catcher' } }),
  }),
] as const;

export const questWalkthroughCatalogue: readonly QuestWalkthroughDefinition[] = deepFreeze([
  publicDefinition("Cook's Assistant", '15238952', '2026-06-24T23:03:17Z', cookActions),
  publicDefinition('Sheep Shearer', '14457888', '2023-08-26T20:09:01Z', sheepActions),
  publicDefinition('The Restless Ghost', '15070492', '2025-11-28T02:58:15Z', restlessGhostActions),
  publicDefinition('Rune Mysteries', '15205463', '2026-05-03T11:22:42Z', runeMysteriesActions),
  publicDefinition('Imp Catcher', '14649872', '2024-05-05T03:30:56Z', impCatcherActions),
]);

const walkthroughByQuestId = new Map(
  questWalkthroughCatalogue.map(walkthrough => [walkthrough.questId, walkthrough]),
);

export const questWalkthroughFor = (
  questId: string,
): QuestWalkthroughDefinition | undefined => walkthroughByQuestId.get(questId);

const compileQuestStrategyCatalogue = (): readonly QuestStrategyDefinition[] => (
  questWalkthroughCatalogue.flatMap((walkthrough) => {
    const membership = f2pQuestMembershipFor(walkthrough.questId);
    const roots = reviewedQuestRequirements(walkthrough.questId);
    if (!membership || !roots) return [];

    const strategy = questStrategyFromWalkthrough(walkthrough, {
      membership,
      rootRequirements: roots.items,
    });
    return strategy ? [strategy] : [];
  })
);

export const questStrategyCatalogue: readonly QuestStrategyDefinition[] = deepFreeze(
  compileQuestStrategyCatalogue(),
);

export const questStrategyFor = (questId: string): QuestStrategyDefinition | undefined => (
  questStrategyCatalogue.find(strategy => strategy.questId === questId)
);
