import type { GuideLocation, GuidePack, GuideStep } from '../model';
import type { RequirementPredicate } from '../../../utils/requirementPredicates';

const revision = '633ab56e2eb3eb363f21da3fd75f6f2bc0fa073a';
const source = (folder: string, ...files: string[]) => files.map(file => ({ label: 'Quest Helper · reviewed quest sequence', path: `src/main/java/com/questhelper/helpers/quests/${folder}/${file}.java`, revision }));
const place = (label: string, x: number, y: number, area: string): GuideLocation => ({ label, cx: Math.floor(x / 64), cy: Math.floor(y / 64), areas: [area] });
const supply = (id: string, label: string, quantity = 1, note = 'Collected during this guide; record prepared supplies only when you actually have them.') => ({ id, label, quantity, note });
type Action = Omit<GuideStep, 'after' | 'requires'> & { needs?: Record<string, number>; permissions?: RequirementPredicate[] };
const sequence = (actions: Action[]): GuideStep[] => actions.map(({ needs = {}, permissions = [], ...action }, index) => ({ ...action, after: index ? [actions[index - 1].id] : [], requires: [...Object.entries(needs).map(([id, quantity]) => ({ kind: 'item' as const, id, quantity })), ...permissions.map(predicate => ({ kind: 'permission' as const, predicate }))] }));
const grave = place('Lumbridge graveyard', 3250, 3193, 'Lumbridge');
const manor = place('Draynor Manor', 3108, 3353, 'Draynor Village');
// Source explicitly enters through these ladders. These are entrance map pins,
// not underground coordinates converted to surface tiles or a new instance rule.
const towerBasement = place('Wizards’ Tower basement · surface ladder entrance', 3104, 3162, "Wizards' Tower");
const manorBasement = place('Manor basement · secret-room ladder entrance', 3092, 3362, 'Draynor Village');
const frank = place('Redbeard Frank · Port Sarim', 3053, 3251, 'Port Sarim');
const luthas = place('Luthas and shipping crate · Musa Point', 2939, 3149, 'Musa Point');
// Key retention verified against official OSRS Wiki API on 2026-09-05:
// Key_(Ernest_the_Chicken), revision15186908; Chest_key_(Pirate%27s_Treasure),
// revision15186909. Both pages explicitly say the key is kept on completion.

export const OPENING_EXPANSION_TWO_PACKS: GuidePack[] = [
  {
    id: 'X Marks the Spot', version: 1, difficulty: 'Novice', coverage: 'complete',
    intro: 'Follow Veos’s four clues from Lumbridge to Draynor, then deliver the casket at Port Sarim.',
    items: [supply('spade', 'Spade', 1, 'Bring a legally obtained spade. It is retained after every dig.'), supply('ancient-casket', 'Ancient casket')],
    questions: [], sources: source('xmarksthespot', 'XMarksTheSpot'),
    // Source81-107 and131-141: four ordered digs, then casket hand-in and dialogue.
    steps: sequence([
      { id: 'meet-veos', title: 'Ask Veos for a quest', text: 'Talk to Veos in the Sheared Ram pub in Lumbridge. Ask for a quest and agree to help with his clue scroll.', location: place('Veos · Sheared Ram', 3228, 3242, 'Lumbridge') },
      { id: 'dig-bob', title: 'Dig beside Bob’s shop', text: 'Dig at tile 3230,3209, north of Bob’s Brilliant Axes, beside the plant against the wall. Read the next clue.', needs: { spade: 1 }, location: place('First dig · Bob’s shop', 3230, 3209, 'Lumbridge') },
      { id: 'dig-castle', title: 'Dig behind Lumbridge Castle', text: 'Dig at tile 3203,3212, just outside the kitchen door behind the castle. Read the next clue.', needs: { spade: 1 }, location: place('Second dig · castle kitchen', 3203, 3212, 'Lumbridge') },
      { id: 'dig-jail', title: 'Dig northwest of Draynor jail', text: 'Dig at tile 3109,3264, beside the wheat farm northwest of Draynor jail. Read the next clue.', needs: { spade: 1 }, location: place('Third dig · Draynor wheat farm', 3109, 3264, 'Draynor Village') },
      { id: 'dig-pigpen', title: 'Dig inside the pig pen', text: 'Dig at tile 3078,3259 inside the pig pen by Draynor Market. Keep the ancient casket.', needs: { spade: 1 }, produce: { 'ancient-casket': 1 }, location: place('Fourth dig · Draynor pig pen', 3078, 3259, 'Draynor Village') },
      { id: 'return-casket', title: 'Give the casket to Veos', text: 'Find Veos directly south of the Rusty Anchor Inn in Port Sarim. Give him the ancient casket and continue the conversation through the quest completion screen.', needs: { 'ancient-casket': 1 }, consume: { 'ancient-casket': 1 }, location: place('Veos · Port Sarim', 3054, 3245, 'Port Sarim') },
    ]),
  },
  {
    id: 'The Restless Ghost', version: 1, difficulty: 'Novice', coverage: 'complete',
    intro: 'Find out why the Lumbridge ghost cannot rest, then return its missing skull.',
    coverageNote: 'The basement map pin is the actual Wizards’ Tower ladder entrance. The skeleton can be escaped; killing it is unnecessary.',
    items: [supply('ghostspeak-amulet', 'Ghostspeak amulet'), supply('ghost-skull', 'Ghost’s skull')], questions: [], sources: source('therestlessghost', 'TheRestlessGhost'),
    // Source111-133 and144-161 explicitly connects the surface ladder to the altar.
    steps: sequence([
      { id: 'meet-aereck', title: 'Offer to help Father Aereck', text: 'Talk to Father Aereck inside Lumbridge church. Ask for a quest and agree to deal with the ghost.', location: place('Father Aereck · Lumbridge church', 3243, 3206, 'Lumbridge') },
      { id: 'meet-urhney', title: 'Get the ghostspeak amulet', text: 'Talk to Father Urhney in his hut on the western side of Lumbridge Swamp. Explain that Father Aereck sent you because a ghost is haunting the graveyard. Keep the ghostspeak amulet he gives you.', produce: { 'ghostspeak-amulet': 1 }, location: place('Father Urhney’s hut', 3147, 3175, 'Lumbridge') },
      { id: 'speak-ghost', permissions: [{ kind: 'equipment', slot: 'Neck', tier: 1 }], title: 'Ask the ghost what is wrong', text: 'Wear the ghostspeak amulet. Open and search the coffin in Lumbridge graveyard, then speak to the ghost that appears. Explain that you can understand it and ask why it is a ghost.', needs: { 'ghostspeak-amulet': 1 }, location: grave },
      { id: 'recover-skull', title: 'Recover the skull from the tower basement', text: 'Enter the Wizards’ Tower south of Draynor and descend its basement ladder. Search the altar in the eastern room to take the ghost’s skull. A level 13 skeleton attacks; run back to the ladder and climb out with the skull. The map marks the surface entrance, not the altar below.', produce: { 'ghost-skull': 1 }, location: towerBasement },
      { id: 'return-skull', title: 'Return the skull to the coffin', text: 'Return to Lumbridge graveyard. Open the ghost’s coffin and search it to put the skull back. Watch the ending and check the quest completion screen.', needs: { 'ghost-skull': 1 }, consume: { 'ghost-skull': 1 }, location: grave },
    ]),
  },
  {
    id: 'Ernest the Chicken', version: 1, difficulty: 'Novice', coverage: 'complete',
    intro: 'Recover three machine parts around Draynor Manor to restore Ernest.',
    coverageNote: 'Fresh-start route, including the untouched basement lever puzzle. The basement map pin is its secret-room ladder. Bring a prepared spade; other materials are collected along the route.',
    items: [supply('spade', 'Spade', 1, 'Bring one legally obtained spade; it is not consumed.'), supply('fish-food', 'Fish food'), supply('poison', 'Poison'), supply('poisoned-fish-food', 'Poisoned fish food'), supply('closet-key', 'Key'), supply('pressure-gauge', 'Pressure gauge'), supply('rubber-tube', 'Rubber tube'), supply('oil-can', 'Oil can')], questions: [], sources: source('ernestthechicken', 'ErnestTheChicken'),
    // Source195-236 and panels274-285. Lever order is the fresh puzzle route in281.
    steps: sequence([
      { id: 'meet-veronica', title: 'Help Veronica find Ernest', text: 'Speak to Veronica at the entrance to Draynor Manor and offer to help find Ernest.', location: place('Veronica · manor entrance', 3109, 3329, 'Draynor Village') },
      { id: 'get-fish-food', title: 'Collect the fish food', text: 'Enter the manor and climb the main stairs. Take the fish food from the south room on the first floor.', produce: { 'fish-food': 1 }, location: manor },
      { id: 'get-poison', title: 'Collect the poison', text: 'Go downstairs to the ground floor. Pick up the poison in the northwest room.', produce: { poison: 1 }, location: manor },
      { id: 'poison-food', portable: true, title: 'Poison the fish food', text: 'Use the poison on the fish food.', needs: { poison: 1, 'fish-food': 1 }, consume: { poison: 1, 'fish-food': 1 }, produce: { 'poisoned-fish-food': 1 } },
      { id: 'find-key', title: 'Search the compost heap', text: 'Leave through the east-room door. With your spade, search the compost heap west of the manor to find the key.', needs: { spade: 1 }, produce: { 'closet-key': 1 }, location: place('Manor compost heap', 3085, 3361, 'Draynor Village') },
      { id: 'get-gauge', title: 'Recover the pressure gauge', text: 'Use the poisoned fish food on the fountain southwest of the manor. Wait for the fish to die, then search the fountain for the pressure gauge.', needs: { 'poisoned-fish-food': 1 }, consume: { 'poisoned-fish-food': 1 }, produce: { 'pressure-gauge': 1 }, location: place('Manor fountain', 3088, 3335, 'Draynor Village') },
      { id: 'get-tube', title: 'Collect the rubber tube', text: 'Re-enter the manor. Use the key to enter the small room north of the main stairs and pick up the rubber tube. Avoid the attacking level 22 skeleton; killing it is unnecessary.', needs: { 'closet-key': 1 }, produce: { 'rubber-tube': 1 }, location: manor },
      { id: 'enter-basement', title: 'Enter the lever basement', text: 'Search the bookcase in the west room to enter the secret room, then climb down its ladder. The map pin marks this surface entrance. The following sequence assumes a fresh puzzle with all levers up.', location: manorBasement },
      { id: 'levers-ab', title: 'Pull levers A and B down', text: 'In the starting area, pull lever A down, then lever B down. Go through the northeast door into the room containing C and D.', location: manorBasement },
      { id: 'lever-d', title: 'Pull D down, then raise A and B', text: 'Pull lever D down. Return through the door to the starting area and pull B up, then A up.', location: manorBasement },
      { id: 'levers-ef', title: 'Pull E and F down', text: 'From the starting area, go through the northwest door, then west and north to the room containing E and F. Pull F down and E down.', location: manorBasement },
      { id: 'lever-c', title: 'Pull C down', text: 'Go through the east door, then east again to the room containing C and D. Pull C down.', location: manorBasement },
      { id: 'raise-e', title: 'Raise E and collect the oil can', text: 'Return west, then west to E and F. Pull E up. Go east, south, south, then west into the oil-can room and pick up the oil can.', produce: { 'oil-can': 1 }, location: manorBasement },
      { id: 'restore-ernest', title: 'Bring the three parts to Oddenstein', text: 'Return to the basement ladder and climb out. Pull the wall lever to leave the secret room. Climb the main stairs, then the spiral stairs to Professor Oddenstein on the top floor. Ask about Ernest and tell him to change Ernest back. Speak again to give him the oil can, pressure gauge and rubber tube. Watch the restoration and completion screen.', needs: { 'oil-can': 1, 'pressure-gauge': 1, 'rubber-tube': 1 }, consume: { 'oil-can': 1, 'pressure-gauge': 1, 'rubber-tube': 1 }, location: manor },
    ]),
  },
  {
    id: "Pirate's Treasure", version: 1, difficulty: 'Novice', coverage: 'complete',
    intro: 'Smuggle rum for Redbeard Frank, unlock his clue and dig up the treasure.',
    coverageNote: 'Complete shipping route with prepared bananas, apron and spade. Start with 60 coins; Luthas pays the 30-coin return fare. The Musa Point dock pin marks the customs officer’s actual surface chunk.',
    items: [supply('coins', 'Coins', 60, '30 for the outward ship and 30 for rum. Luthas pays another 30 for the return ship.'), supply('banana', 'Banana', 10, 'Bring ten legally obtained bananas.'), supply('white-apron', 'White apron', 1, 'Bring and wear a legally obtained white apron for Wydin’s back room.'), supply('spade', 'Spade', 1, 'Bring a legally obtained spade; it is retained.'), supply('karamjan-rum', 'Karamjan rum'), supply('chest-key', 'Chest key'), supply('pirate-message', 'Pirate message')], questions: [], sources: source('piratestreasure', 'PiratesTreasure', 'RumSmugglingStep'),
    steps: sequence([
      { id: 'meet-frank', title: 'Ask Frank about treasure', text: 'Talk to Redbeard Frank outside the Rusty Anchor Inn in Port Sarim. Ask about treasure and agree to bring him Karamjan rum.', location: frank },
      { id: 'sail-karamja', title: 'Sail to Musa Point', text: 'Talk to a seaman on the Port Sarim dock and pay 30 coins to sail to Musa Point. Keep 30 coins for the rum.', needs: { coins: 60 }, consume: { coins: 30 }, location: place('Seamen · Port Sarim dock', 3027, 3222, 'Port Sarim') },
      { id: 'buy-rum', permissions: [{ kind: 'unlock', field: 'merchants', id: 'Wine Traders' }], title: 'Buy Karamjan rum', text: 'Talk to Zambo in the Musa Point bar and buy one Karamjan rum for 30 coins. Keep it for the shipping crate; do not drink it.', needs: { coins: 30 }, consume: { coins: 30 }, produce: { 'karamjan-rum': 1 }, location: place('Zambo · Musa Point bar', 2929, 3145, 'Musa Point') },
      { id: 'work-luthas', title: 'Take work from Luthas', text: 'Talk to Luthas in the house beside the banana plantation. Ask for employment filling his banana crate.', location: luthas },
      { id: 'pack-crate', title: 'Hide the rum and fill the crate', text: 'Use the rum on the crate outside Luthas’s house first. Then right-click Fill the crate with all ten bananas to cover the rum.', needs: { 'karamjan-rum': 1, banana: 10 }, consume: { 'karamjan-rum': 1, banana: 10 }, location: luthas },
      { id: 'ship-crate', title: 'Tell Luthas the crate is ready', text: 'Tell Luthas you have finished filling the crate. He sends the shipment and pays you 30 coins.', produce: { coins: 30 }, location: luthas },
      { id: 'return-sarim', title: 'Pay the customs officer to return', text: 'At the Musa Point dock, ask the customs officer to travel on the ship. Allow the search and pay 30 coins to return to Port Sarim. Your rum travels in the shipped crate.', needs: { coins: 30 }, consume: { coins: 30 }, location: place('Musa Point customs officer · dock', 2955, 3146, 'Musa Point') },
      { id: 'recover-rum', permissions: [{ kind: 'equipment', slot: 'Body', tier: 1 }], title: 'Retrieve the shipped rum', text: 'Wear your white apron and speak to Wydin in the Port Sarim food shop. Ask for a job to enter the back room. Search the crate there to recover your Karamjan rum.', needs: { 'white-apron': 1 }, produce: { 'karamjan-rum': 1 }, location: place('Wydin’s back-room crate', 3009, 3207, 'Port Sarim') },
      { id: 'give-rum', title: 'Give Frank the rum', text: 'Bring the rum to Redbeard Frank and finish the conversation to receive his chest key.', needs: { 'karamjan-rum': 1 }, consume: { 'karamjan-rum': 1 }, produce: { 'chest-key': 1 }, location: frank },
      { id: 'open-chest', title: 'Open the Blue Moon Inn chest', text: 'Go upstairs in the Blue Moon Inn in Varrock. Use Frank’s chest key on the chest in the southwest room and take the pirate message.', needs: { 'chest-key': 1 }, produce: { 'pirate-message': 1 }, location: place('Blue Moon Inn · upstairs chest', 3219, 3396, 'Varrock') },
      { id: 'read-message', portable: true, title: 'Read the pirate message', text: 'Read the pirate message to learn where the treasure is buried.', needs: { 'pirate-message': 1 } },
      { id: 'dig-treasure', title: 'Dig twice in Falador Park', text: 'Dig at tile 2999,3383 in the centre of the cross in Falador Park. Defeat the level 4 gardener using combat your run permits, then dig again with your spade. Check the quest completion screen.', needs: { spade: 1 }, location: place('Treasure cross · Falador Park', 2999, 3383, 'Falador') },
    ]),
  },
];


