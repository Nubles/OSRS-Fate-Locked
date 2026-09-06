import type { GuideLocation, GuidePack, GuideRequirement } from '../model';

const revision = '633ab56e2eb3eb363f21da3fd75f6f2bc0fa073a';
const source = (folder: string, file: string) => [{ label: 'Quest Helper · reviewed quest sequence', path: `src/main/java/com/questhelper/helpers/quests/${folder}/${file}.java`, revision }];
const item = (id: string, quantity = 1): GuideRequirement => ({ kind: 'item', id, quantity });
const location = (label: string, cx: number, cy: number, area: string): GuideLocation => ({ label, cx, cy, areas: [area] });
const mizgog = location("Wizard Mizgog · Wizards' Tower second floor", 48, 49, "Wizards' Tower");
const doric = location("Doric's house north of Falador", 46, 53, 'Falador');
const generals = location('Goblin generals · north Goblin Village', 46, 54, 'Goblin Village');
const hetty = location("Hetty's house · Rimmington", 46, 50, 'Rimmington');

/** Prepared supplies are observations, not permission to acquire them anywhere.
 * Witch's Potion keeps its quest-only rat encounter after starting the quest.
 * Portable dye actions have no invented mandatory travel destination.
 */
export const OPENING_EXPANSION_PACKS: GuidePack[] = [
  {
    id: 'Imp Catcher', version: 1, difficulty: 'Novice', coverage: 'complete',
    intro: 'Return four coloured beads to Wizard Mizgog at the top of the Wizards’ Tower.',
    coverageNote: 'Complete fresh-start quest using legally obtained beads. Imp hunting or purchases are outside this prepared-supplies route.',
    items: ['Black', 'White', 'Red', 'Yellow'].map(colour => ({ id: `${colour.toLowerCase()}-bead`, label: `${colour} bead`, quantity: 1, note: 'Bring one bead of this colour, obtained through a source your run permits.' })),
    questions: [], sources: source('impcatcher', 'ImpCatcher'),
    steps: [
      // ImpCatcher.java96-105,121-123: the same conversation handles fresh start and hand-in.
      { id: 'meet-mizgog', title: 'Ask Wizard Mizgog for a quest', text: 'Enter the Wizards’ Tower south of Draynor. Climb the spiral stairs twice to the second floor and speak to Wizard Mizgog. Ask for a quest and agree to recover his beads.', after: [], requires: [], location: mizgog },
      { id: 'return-beads', title: 'Return all four beads', text: 'Give Mizgog one black, one white, one red and one yellow bead. Continue the conversation until the quest completion screen appears.', after: ['meet-mizgog'], requires: [item('black-bead'), item('white-bead'), item('red-bead'), item('yellow-bead')], consume: { 'black-bead': 1, 'white-bead': 1, 'red-bead': 1, 'yellow-bead': 1 }, location: mizgog },
    ],
  },
  {
    id: "Doric's Quest", version: 1, difficulty: 'Novice', coverage: 'complete',
    intro: 'Bring Doric the materials he needs and earn permission to use his anvils.',
    coverageNote: 'Complete fresh-start hand-in using prepared, unnoted materials. Mining and purchases are optional acquisition routes, not quest requirements.',
    items: [
      { id: 'clay', label: 'Clay', quantity: 6, note: 'Six unnoted ordinary clay. Soft clay is not accepted.' },
      { id: 'copper-ore', label: 'Copper ore', quantity: 4, note: 'Four unnoted copper ore.' },
      { id: 'iron-ore', label: 'Iron ore', quantity: 2, note: 'Two unnoted iron ore. Owning ore does not require you to mine it again.' },
    ], questions: [], sources: source('doricsquest', 'DoricsQuest'),
    steps: [
      // DoricsQuest.java60-70,81-82: no Mining level gate on prepared materials.
      { id: 'ask-doric', title: 'Ask Doric about his anvils', text: 'Visit Doric in his house north of Falador. Say that you wanted to use his anvils and agree to bring him the materials.', after: [], requires: [], location: doric },
      { id: 'deliver-ore', title: 'Give Doric the materials', text: 'Give Doric six clay, four copper ore and two iron ore, all unnoted. If you arrived with everything, continue the same conversation. Finish the dialogue and check the quest completion screen.', after: ['ask-doric'], requires: [item('clay', 6), item('copper-ore', 4), item('iron-ore', 2)], consume: { clay: 6, 'copper-ore': 4, 'iron-ore': 2 }, location: doric },
    ],
  },
  {
    id: 'Goblin Diplomacy', version: 1, difficulty: 'Novice', coverage: 'complete',
    intro: 'Settle the generals’ argument by showing them orange, blue and finally ordinary brown goblin mail.',
    coverageNote: 'Complete fresh-start quest with prepared armour or dyes. Obtain the mail and dyes through legal sources before following this route; visiting a dye supplier is not mandatory.',
    items: [
      { id: 'goblin-mail', label: 'Goblin mail', quantity: 3, note: 'Three ordinary brown mails for the dye route; only one if the coloured mails are already prepared.' },
      { id: 'orange-goblin-mail', label: 'Orange goblin mail', quantity: 1, note: 'One for the first trial. Record this directly if already prepared.' },
      { id: 'blue-goblin-mail', label: 'Blue goblin mail', quantity: 1, note: 'One for the second trial. Record this directly if already prepared.' },
      { id: 'orange-dye', label: 'Orange dye', quantity: 1, note: 'Only for dyeing one ordinary mail orange.' },
      { id: 'blue-dye', label: 'Blue dye', quantity: 1, note: 'Only for dyeing one ordinary mail blue.' },
    ],
    questions: [{ id: 'armour-preparation', prompt: 'How will you prepare the goblin mail?', options: [
      { id: 'prepared', label: 'I have orange, blue and brown mail' },
      { id: 'dye', label: 'Dye two of my three brown mails' },
    ] }], sources: source('goblindiplomacy', 'GoblinDiplomacy'),
    steps: [
      // GoblinDiplomacy.java138-139 explicitly permits portable dye-on-mail actions.
      { id: 'dye-blue', portable: true, title: 'Dye one mail blue', text: 'Use blue dye on one ordinary goblin mail. Keep two ordinary mails for the orange preparation and final brown trial. This item action does not require Crafting training.', after: [], branch: { question: 'armour-preparation', answer: 'dye' }, requires: [item('blue-dye'), item('goblin-mail')], consume: { 'blue-dye': 1, 'goblin-mail': 1 }, produce: { 'blue-goblin-mail': 1 } },
      { id: 'dye-orange', portable: true, title: 'Dye one mail orange', text: 'Use orange dye on another ordinary goblin mail. Keep the last ordinary brown mail unchanged.', after: ['dye-blue'], branch: { question: 'armour-preparation', answer: 'dye' }, requires: [item('orange-dye'), item('goblin-mail')], consume: { 'orange-dye': 1, 'goblin-mail': 1 }, produce: { 'orange-goblin-mail': 1 } },
      // Source142-157 and loadSteps176-195 establish the ordered orange/blue/brown handovers.
      { id: 'orange-trial', title: 'Offer the generals orange mail', text: 'Speak to General Bentnoze or General Wartface in the northern hut of Goblin Village. Offer to choose another armour colour, agree to help and say you have orange armour. Give it to them and watch the trial.', after: ['dye-blue', 'dye-orange'], requires: [item('orange-goblin-mail')], consume: { 'orange-goblin-mail': 1 }, location: generals },
      { id: 'blue-trial', title: 'Offer the generals blue mail', text: 'Speak to either general again and say you have blue armour. Give them the blue goblin mail and watch the next trial.', after: ['orange-trial'], requires: [item('blue-goblin-mail')], consume: { 'blue-goblin-mail': 1 }, location: generals },
      { id: 'brown-trial', title: 'Finish with ordinary brown mail', text: 'Speak to either general once more and say you have brown armour. Give them the unchanged ordinary goblin mail. Finish the conversation and check the quest completion screen.', after: ['blue-trial'], requires: [item('goblin-mail')], consume: { 'goblin-mail': 1 }, location: generals },
    ],
  },
  {
    id: "Witch's Potion", version: 1, difficulty: 'Novice', coverage: 'complete',
    intro: 'Help Hetty make her potion, then drink from her cauldron.',
    coverageNote: 'Complete fresh-start quest with an onion, burnt meat and eye of newt already obtained legally. The quest-specific rat tail is collected after speaking to Hetty.',
    items: [
      { id: 'onion', label: 'Onion', quantity: 1, note: 'One prepared onion. Its farming patch is not a mandatory quest destination.' },
      { id: 'burnt-meat', label: 'Burnt meat', quantity: 1, note: 'One burnt meat, not raw or cooked meat. Obtain it legally before this route.' },
      { id: 'eye-of-newt', label: 'Eye of newt', quantity: 1, note: 'One prepared eye of newt. No Herblore action or shop purchase is required by the hand-in.' },
      { id: 'rat-tail', label: "Rat's tail", quantity: 1, note: 'Quest item collected from a rat after starting; the guide records it when you complete that encounter.' },
    ], questions: [], sources: source('witchspotion', 'WitchsPotion'),
    steps: [
      // WitchsPotion.java74-83,94-101: start, rat tail, ingredient handover, cauldron.
      { id: 'meet-hetty', title: 'Ask Hetty for a quest', text: 'Speak to Hetty in her house in Rimmington. Say you are in search of a quest and agree to help with her potion.', after: [], requires: [], location: hetty },
      { id: 'collect-tail', title: 'Collect a rat’s tail', text: 'After starting the quest, kill a small rat in the house west of Hetty using combat your run permits. Pick up its rat’s tail. The tail is needed for this quest; an ordinary rat bone is not a substitute.', after: ['meet-hetty'], requires: [], produce: { 'rat-tail': 1 }, location: location('Small rat in the house west of Hetty', 46, 50, 'Rimmington') },
      { id: 'give-ingredients', title: 'Bring Hetty all four ingredients', text: 'Return to Hetty and give her one onion, one burnt meat, one eye of newt and the rat’s tail. Continue speaking while she prepares the potion.', after: ['collect-tail'], requires: [item('onion'), item('burnt-meat'), item('eye-of-newt'), item('rat-tail')], consume: { onion: 1, 'burnt-meat': 1, 'eye-of-newt': 1, 'rat-tail': 1 }, location: hetty },
      { id: 'drink-potion', title: 'Drink from Hetty’s cauldron', text: 'Drink from the cauldron in Hetty’s house. Check that the quest completion screen appears before recording the quest in your Journal.', after: ['give-ingredients'], requires: [], location: hetty },
    ],
  },
];

