/**
 * Independently phrased article details for the five reviewed public guides.
 *
 * Reviewed against the full Wiki revisions linked below, preserved in the local
 * September 2026 requirements audit. Step locations and the selected gathering
 * routes also use questWalkthroughs.public.ts / quest-walkthrough-review.json.
 * The Restless Ghost entrance and equipment facts have the additional review in
 * data/sources/quest-step-evidence-review.json. No harvested candidate is used.
 *
 * Destination labels describe where to act, not a verified path through every
 * intermediate chunk. Floor names come from the Wiki, never Chunk Picker section
 * suffixes. OSRS quest facts remain separate from Fate's current-run restrictions.
 */

export interface QuestGuideArticleStep {
  readonly section: string;
  readonly location: string;
  readonly context?: string;
  readonly details?: readonly string[];
}

export interface QuestGuideArticle {
  readonly questId: string;
  readonly guideRevision: string;
  readonly startPoint: string;
  readonly difficulty?: string;
  readonly length?: string;
  readonly requirements: readonly string[];
  readonly itemsRequired: readonly string[];
  readonly itemsObtained: readonly string[];
  readonly recommended: readonly string[];
  readonly enemies: readonly string[];
  readonly rewards: readonly string[];
  readonly sourceUrl: string;
  readonly guideNotes?: readonly string[];
  readonly links?: readonly { readonly label: string; readonly url: string }[];
  readonly steps: Readonly<Record<string, QuestGuideArticleStep>>;
}

const articles: readonly QuestGuideArticle[] = [
  {
    questId: "Cook's Assistant",
    guideRevision: 'runeproof-public-cooks-assistant-v1',
    startPoint: 'The Cook in the ground-floor kitchen of Lumbridge Castle.',
    difficulty: 'Novice',
    length: 'Very short',
    requirements: ['No quest or skill prerequisites.'],
    itemsRequired: ['1 egg', '1 bucket of milk', '1 pot of flour'],
    itemsObtained: [
      'An empty pot from the castle kitchen and a bucket from the cellar.',
      'The ingredients can be gathered along this guide; grain is used to make the flour.',
    ],
    recommended: [],
    enemies: ['No combat required.'],
    rewards: ['1 quest point', '300 Cooking XP', 'Permission to use the Cook-o-matic 100 range in Lumbridge Castle.'],
    sourceUrl: 'https://oldschool.runescape.wiki/w/Cook%27s_Assistant?oldid=15320469',
    steps: {
      'cooks-assistant:start-quest': {
        section: 'Helping the Cook',
        location: 'Lumbridge Castle kitchen',
        context: 'Ground floor',
        details: ['The Cook needs an egg, milk and flour. This route gathers the ingredients around Lumbridge.'],
      },
      'cooks-assistant:take-pot': {
        section: 'Collecting the ingredients',
        location: 'Lumbridge Castle kitchen',
        context: 'Ground floor',
        details: ['Look for the empty pot on the kitchen table. Keep it for collecting flour.'],
      },
      'cooks-assistant:take-bucket': {
        section: 'Collecting the ingredients',
        location: 'Lumbridge Castle cellar',
        context: 'Below the kitchen; enter through the castle',
        details: ['Collect the bucket before going to the dairy cow.'],
      },
      'cooks-assistant:milk-cow': {
        section: 'Collecting the ingredients',
        location: 'Lumbridge cow field',
        details: ['Use the empty bucket on a dairy cow. A dairy cow wears a cowbell.'],
      },
      'cooks-assistant:take-egg': {
        section: 'Collecting the ingredients',
        location: 'Chicken farm beside the Lumbridge cow field',
        details: ['Pick up an egg from the ground.'],
      },
      'cooks-assistant:pick-grain': {
        section: 'Making flour',
        location: 'Wheat field beside Mill Lane Mill',
        details: ['Pick grain and keep the empty pot with you.'],
      },
      'cooks-assistant:make-flour': {
        section: 'Making flour',
        location: 'Mill Lane Mill',
        context: 'Top-floor hopper and ground-floor flour bin',
        details: ['Put the grain into the hopper upstairs and operate the lever.', 'Return to the ground floor and collect flour from the bin with the empty pot.'],
      },
      'cooks-assistant:return-to-cook': {
        section: 'Delivering the ingredients',
        location: 'Lumbridge Castle kitchen',
        context: 'Ground floor',
        details: ['Speak to the Cook while carrying the three ingredients.'],
      },
      'cooks-assistant:complete': {
        section: 'Delivering the ingredients',
        location: 'Lumbridge Castle kitchen',
        context: 'Ground floor',
      },
    },
  },
  {
    questId: 'Sheep Shearer',
    guideRevision: 'runeproof-public-sheep-shearer-v2',
    startPoint: 'Fred the Farmer at the house beside the sheep pen north of Lumbridge Castle.',
    difficulty: 'Novice',
    length: 'Very short',
    requirements: ['No official quest or skill prerequisites.', 'Crafting T1 is needed to spin wool. You can instead bring 20 unnoted balls of wool obtained from a permitted source.'],
    itemsRequired: ['20 unnoted balls of wool'],
    itemsObtained: ['Fred supplies shears if you need them.', 'Shear 20 wool and spin it into the balls of wool along this route.'],
    recommended: ['21 free inventory spaces let you carry the shears and all 20 wool at once; smaller trips also work.'],
    enemies: ['No combat required. Avoid attacking the rams in the sheep pen.'],
    rewards: ['1 quest point', '150 Crafting XP', '60 coins'],
    sourceUrl: 'https://oldschool.runescape.wiki/w/Sheep_Shearer?oldid=15271780',
    steps: {
      'sheep-shearer:start-with-fred': {
        section: 'Helping Fred',
        location: "Fred the Farmer's house",
        details: ['Ask Fred for work. He provides shears if you do not already have them.', 'Already have 20 unnoted balls of wool? They can be handed in without shearing and spinning more.'],
      },
      'sheep-shearer:shear-wool': {
        section: 'Shearing the sheep',
        location: "Sheep pen east of Fred's house",
        details: ['Shear ordinary sheep until you have 20 wool. Rams and the disguised penguins cannot be sheared.', 'If a sheep moves away, try again. Hiding attack options can prevent an accidental attack on a ram.'],
      },
      'sheep-shearer:spin-wool': {
        section: 'Spinning the wool',
        location: 'Lumbridge Castle spinning wheel',
        context: 'One floor above ground, in the southern room',
        details: ['Unlock Crafting T1 before using the spinning wheel with wool in your inventory.', 'Already have 20 unnoted balls of wool from a permitted source? Confirm them in the guide to skip shearing and spinning.', 'The 50 Crafting XP from spinning 20 wool is separate from the quest reward.'],
      },
      'sheep-shearer:return-to-fred': {
        section: 'Returning to Fred',
        location: "Fred the Farmer's house",
        details: ['Fred needs 20 balls of wool in total and accepts smaller deliveries. He cannot accept noted balls of wool.'],
      },
      'sheep-shearer:complete': {
        section: 'Returning to Fred',
        location: "Fred the Farmer's house",
      },
    },
  },
  {
    questId: 'The Restless Ghost',
    guideRevision: 'runeproof-public-the-restless-ghost-v2',
    startPoint: 'Father Aereck in the Lumbridge church, south-east of the castle.',
    difficulty: 'Novice',
    length: 'Short',
    requirements: ['No quest or skill prerequisites.', 'Be able to escape a level 13 skeleton; defeating it is optional.'],
    itemsRequired: ['None to bring.'],
    itemsObtained: ['Ghostspeak amulet from Father Urhney; it must be worn when speaking to the ghost.', "Ghost's skull from the Wizards' Tower basement altar."],
    recommended: ['Keep the ghostspeak amulet for later quests.'],
    enemies: ['A level 13 skeleton attacks when you take the skull. You can leave without fighting it.'],
    rewards: ['1 quest point', '1,125 Prayer XP', 'Keep the ghostspeak amulet.'],
    sourceUrl: 'https://oldschool.runescape.wiki/w/The_Restless_Ghost?oldid=15331162',
    steps: {
      'the-restless-ghost:start-with-aereck': {
        section: 'Getting the ghostspeak amulet',
        location: 'Lumbridge church',
        details: ['Ask Father Aereck about a quest. He directs you to Father Urhney for help with the ghost.'],
      },
      'the-restless-ghost:get-amulet': {
        section: 'Getting the ghostspeak amulet',
        location: "Father Urhney's hut, western Lumbridge Swamp",
        details: ["Mention Father Aereck's request to receive the ghostspeak amulet.", 'Receiving the amulet does not require an unlocked neck slot; wearing it does.'],
      },
      'the-restless-ghost:talk-to-ghost': {
        section: 'Speaking to the ghost',
        location: 'Lumbridge graveyard coffin',
        context: 'Small building in the south-east of the graveyard',
        details: ['Equip the ghostspeak amulet, open the coffin and speak to the ghost.', 'The missing skull is in the Wizards\' Tower basement. Carrying the amulet without wearing it is insufficient.'],
      },
      'the-restless-ghost:take-skull': {
        section: 'Retrieving the skull',
        location: "Wizards' Tower basement altar",
        context: 'Enter through the tower and descend the ladder beside its entrance',
        details: ['Search the basement altar to receive the skull. The skeleton that appears can be avoided.', 'Check that you have the skull, then leave. The chunk shown is the surface entrance to the basement.'],
      },
      'the-restless-ghost:return-to-ghost': {
        section: 'Laying the ghost to rest',
        location: 'Lumbridge graveyard',
        details: ['Return with the skull. The destination chunk does not describe every chunk crossed on your journey.'],
      },
      'the-restless-ghost:use-skull': {
        section: 'Laying the ghost to rest',
        location: 'Lumbridge graveyard coffin',
        details: ['Open the coffin if needed and use the skull on it.'],
      },
      'the-restless-ghost:complete': {
        section: 'Laying the ghost to rest',
        location: 'Lumbridge graveyard coffin',
      },
    },
  },
  {
    questId: 'Rune Mysteries',
    guideRevision: 'runeproof-public-rune-mysteries-v1',
    startPoint: 'Duke Horacio, one floor above ground in Lumbridge Castle.',
    difficulty: 'Novice',
    length: 'Short',
    requirements: ['No quest or skill prerequisites.'],
    itemsRequired: ['None to bring.'],
    itemsObtained: ['Air talisman from Duke Horacio.', 'Research package from Sedridor.', 'Research notes from Aubury.'],
    recommended: [],
    enemies: ['No combat required.'],
    rewards: ['1 quest point', 'An air talisman', 'Access to mine rune essence.', 'Use random-event lamps and books of knowledge on Runecraft.', '5 Kudos, claimed separately from Historian Minas in Varrock Museum.'],
    sourceUrl: 'https://oldschool.runescape.wiki/w/Rune_Mysteries?oldid=15275863',
    steps: {
      'rune-mysteries:start-with-duke': {
        section: 'A mysterious talisman',
        location: 'Lumbridge Castle',
        context: 'One floor above ground',
        details: ['Ask Duke Horacio for a quest and accept the air talisman.'],
      },
      'rune-mysteries:take-talisman-to-sedridor': {
        section: "Research at the Wizards' Tower",
        location: "Wizards' Tower basement",
        context: 'Descend the ladder inside the tower',
        details: ['Give the talisman to Archmage Sedridor and accept his research package for Aubury.'],
      },
      'rune-mysteries:take-package-to-aubury': {
        section: 'Visiting Aubury',
        location: "Aubury's rune shop in Varrock",
        context: 'South of the east bank',
        details: ["Hand over Sedridor's package and collect the research notes.", 'Aubury offers tea that restores your run energy if accepted.'],
      },
      'rune-mysteries:return-notes-to-sedridor': {
        section: 'Returning the research',
        location: "Wizards' Tower basement",
        context: 'Descend the ladder inside the tower',
        details: ['Deliver the notes to Sedridor. He returns the air talisman and explains rune essence.'],
      },
      'rune-mysteries:complete': {
        section: 'Returning the research',
        location: "Wizards' Tower basement",
        context: 'Below the tower',
      },
    },
  },
  {
    questId: 'Imp Catcher',
    guideRevision: 'runeproof-public-imp-catcher-v1',
    startPoint: "Wizard Mizgog on the top floor of the Wizards' Tower.",
    difficulty: 'Novice',
    length: 'Short',
    requirements: ['No quest or skill prerequisites.'],
    itemsRequired: ['1 black bead', '1 red bead', '1 white bead', '1 yellow bead'],
    itemsObtained: ['Collect the four colours from imp drops if you do not already have the beads.'],
    recommended: [],
    enemies: ['Level 2 imps when collecting your own beads. No kills are needed if you already have all four colours.'],
    rewards: ['1 quest point', '875 Magic XP', 'An amulet of accuracy'],
    sourceUrl: 'https://oldschool.runescape.wiki/w/Imp_Catcher?oldid=15293702',
    steps: {
      'imp-catcher:get-black-bead': {
        section: 'Collecting the beads',
        location: 'Imp spawns around Draynor Village',
        details: ['You can collect beads before starting the quest. This guide gathers them first to save a separate trip to Mizgog.', 'The colours can drop in any order; keep one of each.'],
      },
      'imp-catcher:get-red-bead': {
        section: 'Collecting the beads',
        location: 'Imp spawns around Draynor Village',
        details: ['Keep a red bead when it drops. You can collect the colours in any order.'],
      },
      'imp-catcher:get-white-bead': {
        section: 'Collecting the beads',
        location: 'Imp spawns around Draynor Village',
        details: ['Keep a white bead when it drops. You can collect the colours in any order.'],
      },
      'imp-catcher:get-yellow-bead': {
        section: 'Collecting the beads',
        location: 'Imp spawns around Draynor Village',
        details: ['Keep a yellow bead when it drops. You can collect the colours in any order.'],
      },
      'imp-catcher:give-beads-to-mizgog': {
        section: 'Returning the beads',
        location: "Wizards' Tower",
        context: 'Top floor, two floors above ground',
        details: ['Speak to Wizard Mizgog with all four colours in your inventory. He needs them together rather than in separate deliveries.'],
      },
      'imp-catcher:complete': {
        section: 'Returning the beads',
        location: "Wizards' Tower",
        context: 'Top floor, two floors above ground',
      },
    },
  },
];

export const questGuideArticleFor = (questId: string): QuestGuideArticle | undefined => (
  articles.find(article => article.questId === questId)
);
