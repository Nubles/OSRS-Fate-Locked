/**
 * Walking endpoints reviewed for the five public guide revisions below.
 *
 * Section IDs and entity membership come from the pinned Chunk Picker export
 * (fa71ed3b207e6a501444987dee23b875ec27cacd), not from a chunk-to-section guess.
 * For example, the mill is the unsplit node 12595; 12850-2 is a cow-field
 * section and cannot stand in for the castle's 12850-1 section.
 *
 * Locations follow the independently reviewed steps in questGuideArticles.ts.
 * Underground actions use the reviewed surface entrance: cellar 12950 connects
 * to castle section 12850-1, and tower basement 12437 to section 12337-1.
 * Upstairs rooms are already included in those surface sections by the source.
 * These endpoints do not turn the walking graph into indoor tile navigation.
 */

export interface QuestGuideTravelStep {
  readonly section: string;
  readonly note?: string;
}

export interface QuestGuideTravel {
  readonly steps: Readonly<Record<string, QuestGuideTravelStep>>;
}

interface ReviewedGuideTravel extends QuestGuideTravel {
  readonly questId: string;
  readonly guideRevision: string;
}

// The named entities below occur in exactly one section of the selected chunk.
const castle = { section: '12850-1' } as const; // Cook, Pot, Duke Horacio, Spinning wheel, Father Aereck.
const cowField = { section: '12851-1' } as const; // Dairy cow and Egg spawn.
const mill = { section: '12595' } as const; // Wheat, Hopper, Fred the Farmer and Sheep; unsplit chunk.
const graveyard = { section: '12849-1' } as const; // Restless ghost and Coffin.
const draynorImps = { section: '12338-1' } as const; // Imp; section 2 has no imps.
const towerBasement = {
  section: '12337-1',
  note: "Route reaches the Wizards' Tower entrance; descend the indoor ladder to the basement.",
} as const;
const mizgog = {
  section: '12337-1', // Wizard Mizgog belongs to this section, not the W1 water section.
  note: "Route reaches the Wizards' Tower; climb the indoor stairs to the top floor.",
} as const;

const guides: readonly ReviewedGuideTravel[] = [
  {
    questId: "Cook's Assistant",
    guideRevision: 'runeproof-public-cooks-assistant-v1',
    steps: {
      'cooks-assistant:start-quest': castle,
      'cooks-assistant:take-pot': castle,
      'cooks-assistant:take-bucket': {
        section: '12850-1',
        note: 'Route reaches Lumbridge Castle; enter the cellar through the kitchen.',
      },
      'cooks-assistant:milk-cow': cowField,
      'cooks-assistant:take-egg': cowField,
      'cooks-assistant:pick-grain': mill,
      'cooks-assistant:make-flour': {
        section: '12595',
        note: 'Route reaches Mill Lane Mill; use the hopper upstairs and the flour bin downstairs.',
      },
      'cooks-assistant:return-to-cook': castle,
      'cooks-assistant:complete': castle,
    },
  },
  {
    questId: 'Sheep Shearer',
    guideRevision: 'runeproof-public-sheep-shearer-v2',
    steps: {
      'sheep-shearer:start-with-fred': mill,
      'sheep-shearer:shear-wool': mill,
      'sheep-shearer:spin-wool': {
        section: '12850-1',
        note: 'Route reaches Lumbridge Castle; the spinning wheel is one floor above ground.',
      },
      'sheep-shearer:return-to-fred': mill,
      'sheep-shearer:complete': mill,
    },
  },
  {
    questId: 'The Restless Ghost',
    guideRevision: 'runeproof-public-the-restless-ghost-v2',
    steps: {
      'the-restless-ghost:start-with-aereck': castle,
      'the-restless-ghost:get-amulet': { section: '12593-1' }, // Father Urhney.
      'the-restless-ghost:talk-to-ghost': graveyard,
      'the-restless-ghost:take-skull': towerBasement,
      'the-restless-ghost:return-to-ghost': graveyard,
      'the-restless-ghost:use-skull': graveyard,
      'the-restless-ghost:complete': graveyard,
    },
  },
  {
    questId: 'Rune Mysteries',
    guideRevision: 'runeproof-public-rune-mysteries-v1',
    steps: {
      'rune-mysteries:start-with-duke': {
        section: '12850-1',
        note: 'Route reaches Lumbridge Castle; Duke Horacio is one floor above ground.',
      },
      'rune-mysteries:take-talisman-to-sedridor': towerBasement,
      'rune-mysteries:take-package-to-aubury': { section: '12853-1' }, // Aubury.
      'rune-mysteries:return-notes-to-sedridor': towerBasement,
      'rune-mysteries:complete': towerBasement,
    },
  },
  {
    questId: 'Imp Catcher',
    guideRevision: 'runeproof-public-imp-catcher-v1',
    steps: {
      'imp-catcher:get-black-bead': draynorImps,
      'imp-catcher:get-red-bead': draynorImps,
      'imp-catcher:get-white-bead': draynorImps,
      'imp-catcher:get-yellow-bead': draynorImps,
      'imp-catcher:give-beads-to-mizgog': mizgog,
      'imp-catcher:complete': mizgog,
    },
  },
];

/** A changed guide must have its walking endpoints reviewed again. */
export const questGuideTravelFor = (
  questId: string,
  guideRevision: string,
): QuestGuideTravel | undefined => guides.find(
  guide => guide.questId === questId && guide.guideRevision === guideRevision,
);
