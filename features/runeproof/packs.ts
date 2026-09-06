import type { GuideLocation, GuidePack, GuideRequirement } from './model';
import { OPENING_EXPANSION_PACKS } from './packs/opening-expansion';
import { OPENING_EXPANSION_TWO_PACKS } from './packs/opening-expansion-two';

const REVISION = '633ab56e2eb3eb363f21da3fd75f6f2bc0fa073a';
const source = (folder: string, file: string) => [{
  label: 'Quest Helper · independently reviewed quest steps',
  path: `src/main/java/com/questhelper/helpers/quests/${folder}/${file}.java`, revision: REVISION,
}];
const place = (label: string, cx: number, cy: number, area: string): GuideLocation => ({ label, cx, cy, areas: [area] });
const item = (id: string, quantity = 1): GuideRequirement => ({ kind: 'item', id, quantity });
const cook = place('Lumbridge Castle kitchen', 50, 50, 'Lumbridge');
const fred = place("Fred the Farmer's house", 49, 51, 'Lumbridge');
const wheel = place('Lumbridge Castle spinning wheel · first floor', 50, 50, 'Lumbridge');
const duke = place('Duke Horacio · Lumbridge Castle first floor', 50, 50, 'Lumbridge');
const tower = place("Wizards' Tower basement · enter through the ground-floor ladder", 48, 49, "Wizards' Tower");
const aubury = place("Aubury's rune shop", 50, 53, 'Varrock');
const romeo = place('Varrock Square', 50, 53, 'Varrock');
const juliet = place("Juliet's house · upstairs", 49, 53, 'Varrock');
const spinPermission: GuideRequirement = { kind: 'permission', predicate: { kind: 'method', skill: 'Crafting', tier: 1 } };

/** Freshly authored walkthroughs; no dependency on the retired guide pipeline.
 * Locations represent action destinations/entrances, not a proof of travel.
 * Supplies may come from any legal source; owning them never unlocks a method.
 */
const FOUNDATION_PACKS: GuidePack[] = [
  {
    id: "Cook's Assistant", version: 1, difficulty: 'Novice', coverage: 'complete',
    intro: 'Help the Lumbridge cook prepare a cake. Bring the three ingredients, then speak to him in the castle kitchen.',
    coverageNote: 'Complete fresh-start quest with prepared ingredients. Supply acquisition is outside this walkthrough; use sources your run permits.',
    items: [
      { id: 'egg', label: 'Egg', quantity: 1, note: 'One ordinary egg. Use one you own or collect one from a legally accessible chicken farm.' },
      { id: 'bucket-of-milk', label: 'Bucket of milk', quantity: 1, note: 'Use prepared milk or milk an accessible dairy cow with a bucket. No Cooking level is required.' },
      { id: 'pot-of-flour', label: 'Pot of flour', quantity: 1, note: 'Use prepared flour or process grain at an accessible mill and collect it with an empty pot.' },
    ], questions: [], sources: source('cooksassistant', 'CooksAssistant'),
    steps: [
      { id: 'help-cook', title: 'Speak to the cook', text: 'Find the cook on the ground floor of Lumbridge Castle. Ask what is wrong and offer to help. If you brought everything, continue the same conversation to hand it over.', after: [], requires: [], location: cook },
      { id: 'deliver-ingredients', title: 'Hand over all three ingredients', text: 'Give the cook one egg, one bucket of milk and one pot of flour. Finish the conversation and check that the quest completion screen appears.', after: ['help-cook'], requires: [item('egg'), item('bucket-of-milk'), item('pot-of-flour')], consume: { egg: 1, 'bucket-of-milk': 1, 'pot-of-flour': 1 }, location: cook },
    ],
  },
  {
    id: 'Sheep Shearer', version: 1, difficulty: 'Novice', coverage: 'complete',
    intro: 'Fred needs twenty balls of wool. Prepared balls work immediately; spinning raw wool is an optional preparation route.',
    coverageNote: 'Complete fresh-start quest. This guide hands in all twenty together; the game also permits smaller deliveries. Choose prepared balls if you already have them.',
    items: [
      { id: 'ball-of-wool', label: 'Ball of wool', quantity: 20, note: 'Unnoted. Needed for the handover; do not acquire these again if you already have twenty.' },
      { id: 'wool', label: 'Wool', quantity: 20, note: 'Only for a spinning route. Raw wool is not a ball of wool.' },
      { id: 'shears', label: 'Shears', quantity: 1, note: "Only for shearing. A pair can be picked up inside Fred's house if that location is accessible." },
      { id: 'coins', label: 'Coins', quantity: 60, note: 'Quest reward, not a starting requirement.' },
    ],
    questions: [{ id: 'wool-route', prompt: 'How will you prepare the twenty balls of wool?', options: [
      { id: 'prepared', label: 'I have twenty balls of wool' },
      { id: 'raw', label: 'I have twenty raw wool to spin' },
      { id: 'shear', label: 'Shear sheep and spin the wool' },
    ] }], sources: source('sheepshearer', 'SheepShearer'),
    steps: [
      { id: 'shear', title: 'Shear twenty wool', text: 'Use shears on woolly sheep in the field beside Fred. Gather twenty wool; leave room in your inventory. The shears are retained.', after: [], requires: [item('shears')], branch: { question: 'wool-route', answer: 'shear' }, produce: { wool: 20 }, location: place("Fred's sheep field", 50, 51, 'Lumbridge') },
      { id: 'spin-new', title: 'Spin the wool', text: 'Go to the first floor of Lumbridge Castle and use the spinning wheel. Turn all twenty wool into balls of wool, then go back downstairs.', after: ['shear'], requires: [item('wool', 20), spinPermission], branch: { question: 'wool-route', answer: 'shear' }, consume: { wool: 20 }, produce: { 'ball-of-wool': 20 }, location: wheel },
      { id: 'spin-owned', title: 'Spin your prepared wool', text: 'Use the spinning wheel on the first floor of Lumbridge Castle to turn your twenty wool into twenty balls of wool. Return downstairs afterwards.', after: [], requires: [item('wool', 20), spinPermission], branch: { question: 'wool-route', answer: 'raw' }, consume: { wool: 20 }, produce: { 'ball-of-wool': 20 }, location: wheel },
      { id: 'hand-over-wool', title: 'Bring Fred twenty balls of wool', text: 'Talk to Fred in his house. Ask for a quest and agree to help, then give him twenty unnoted balls of wool. Continue until the completion screen. If you have already started, ask about shearing his sheep.', after: ['spin-new', 'spin-owned'], requires: [item('ball-of-wool', 20)], consume: { 'ball-of-wool': 20 }, produce: { coins: 60 }, location: fred },
    ],
  },
  {
    id: 'Rune Mysteries', version: 1, difficulty: 'Novice', coverage: 'complete',
    intro: "Carry the Duke's discovery between Sedridor and Aubury. This is a delivery quest: it does not require mining essence or buying anything from a rune shop.",
    coverageNote: 'Complete fresh-start route. Quest-issued objects are tracked as you complete the steps. Resume an existing guide through its saved progress; do not infer quest stage from a spare talisman.',
    items: [
      { id: 'air-talisman', label: 'Air talisman', quantity: 1, note: 'Issued by Duke Horacio, handed to Sedridor, and awarded again at completion. Not a starting supply.' },
      { id: 'research-package', label: 'Research package', quantity: 1, note: 'Issued by Sedridor during the guide. Not a starting supply.' },
      { id: 'research-notes', label: 'Research notes', quantity: 1, note: 'Issued by Aubury during the guide. Not a starting supply.' },
    ], questions: [], sources: source('runemysteries', 'RuneMysteries'),
    steps: [
      { id: 'duke', title: 'Ask Duke Horacio for a quest', text: 'Climb to the first floor of Lumbridge Castle and speak to Duke Horacio. Offer to investigate his discovery and receive the air talisman.', after: [], requires: [], produce: { 'air-talisman': 1 }, location: duke },
      { id: 'talisman', title: 'Give the talisman to Sedridor', text: "Enter the Wizards' Tower south of Draynor and descend the ground-floor ladder. Find Sedridor in the basement and hand over the talisman.", after: ['duke'], requires: [item('air-talisman')], consume: { 'air-talisman': 1 }, location: tower },
      { id: 'package', title: 'Accept Sedridor’s package', text: 'Continue speaking to Sedridor and agree to carry his research package to Aubury.', after: ['talisman'], requires: [], produce: { 'research-package': 1 }, location: tower },
      { id: 'deliver-package', title: 'Deliver the package to Aubury', text: 'Find Aubury in the rune shop south of Varrock east bank. Tell him you have been sent with a package and hand it over. Talking to him does not require a shop purchase.', after: ['package'], requires: [item('research-package')], consume: { 'research-package': 1 }, location: aubury },
      { id: 'notes', title: 'Speak to Aubury again', text: 'After he has examined the package, speak to Aubury again to receive his research notes.', after: ['deliver-package'], requires: [], produce: { 'research-notes': 1 }, location: aubury },
      { id: 'return-notes', title: 'Return the research notes', text: "Return to Sedridor in the Wizards' Tower basement and give him Aubury's notes.", after: ['notes'], requires: [item('research-notes')], consume: { 'research-notes': 1 }, location: tower },
      { id: 'finish', title: 'Hear Sedridor’s explanation', text: 'Finish speaking to Sedridor to complete the quest and receive an air talisman. No essence mining is required to finish.', after: ['return-notes'], requires: [], produce: { 'air-talisman': 1 }, location: tower },
    ],
  },
  {
    id: 'Romeo & Juliet', version: 1, difficulty: 'Novice', coverage: 'complete',
    intro: 'Carry messages across Varrock and ask the Apothecary to prepare a cadava potion. Bring one cadava berry; no Herblore training is involved.',
    coverageNote: 'Complete fresh-start route with a prepared berry. Berry acquisition is outside this walkthrough; an accessible cadava bush is one possible source.',
    items: [
      { id: 'cadava-berries', label: 'Cadava berries', quantity: 1, note: 'One item, not redberries. Use a legally obtained berry you own or a cadava bush southeast of Varrock.' },
      { id: 'juliet-message', label: 'Juliet’s message', quantity: 1, note: 'Issued by Juliet during the guide. Not a starting supply.' },
      { id: 'cadava-potion', label: 'Cadava potion', quantity: 1, note: 'Made by the Apothecary during the guide. Not a starting supply.' },
    ],
    questions: [], sources: source('romeoandjuliet', 'RomeoAndJuliet'),
    steps: [
      { id: 'romeo', title: 'Speak to Romeo', text: 'Find Romeo in Varrock Square. Agree to help him contact Juliet.', after: [], requires: [], location: romeo },
      { id: 'juliet', title: 'Take Juliet’s message', text: 'Go upstairs in the house west of Varrock, speak to Juliet and accept her message for Romeo.', after: ['romeo'], requires: [], produce: { 'juliet-message': 1 }, location: juliet },
      { id: 'message', title: 'Deliver the message', text: 'Return to Romeo in the square and give him Juliet’s message. He directs you to Father Lawrence.', after: ['juliet'], requires: [item('juliet-message')], consume: { 'juliet-message': 1 }, location: romeo },
      { id: 'lawrence', title: 'Consult Father Lawrence', text: 'Speak to Father Lawrence in the church in northeast Varrock about Romeo and Juliet.', after: ['message'], requires: [], location: place('Father Lawrence’s church', 50, 54, 'Varrock') },
      { id: 'potion', title: 'Ask the Apothecary for a potion', text: 'Visit the Apothecary in southwest Varrock. Choose to talk about something else, then Romeo and Juliet. Give him one cadava berry and receive the potion.', after: ['lawrence'], requires: [item('cadava-berries')], consume: { 'cadava-berries': 1 }, produce: { 'cadava-potion': 1 }, location: place('Varrock Apothecary', 49, 53, 'Varrock') },
      { id: 'give-potion', title: 'Bring the potion to Juliet', text: 'Return upstairs to Juliet, give her the potion and watch the scene.', after: ['potion'], requires: [item('cadava-potion')], consume: { 'cadava-potion': 1 }, location: juliet },
      { id: 'finish', title: 'Return to Romeo', text: 'Speak to Romeo in Varrock Square and explain what happened. Continue through the final scene and quest completion.', after: ['give-potion'], requires: [], location: romeo },
    ],
  },
];
export const GUIDE_PACKS: GuidePack[] = [...FOUNDATION_PACKS, ...OPENING_EXPANSION_PACKS, ...OPENING_EXPANSION_TWO_PACKS];
