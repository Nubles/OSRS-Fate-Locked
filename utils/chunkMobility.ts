/**
 * Transport-node gating for the chunk activity panel.
 *
 * Many chunk objects are fast-travel nodes — spirit trees, fairy rings, gnome
 * gliders, canoe stations, mine carts, obelisks. They used to fall into the
 * inert "Objects" list; this maps each to its MOBILITY_LIST unlock so the panel
 * can show it green (network unlocked) or red (locked), the same way shops gate
 * on a merchant category.
 *
 * Facts (which node belongs to which transport network) are standard OSRS;
 * the node *names* come from our own chunk-content dataset.
 */

// Ordered specific → general; first match wins. Names target the real object
// strings seen in the dataset (see the mobility audit).
const MOBILITY_RULES: [RegExp, string][] = [
  [/spirit tree/i, 'Spirit Trees'],
  [/fairy ring/i, 'Fairy Rings'],
  [/glider/i, 'Gnome Gliders'],
  [/canoe/i, 'Canoes'],
  [/balloon/i, 'Balloon Transport'],
  [/magic mushtree|mushtree/i, 'Mycelium Transport'],
  [/carpet/i, 'Magic Carpets'],
  [/quetzal/i, 'Quetzal Network'],
  [/\beagle\b/i, 'Eagle Transport'],
  // Only the numbered Wilderness teleport obelisks. The elemental "Obelisk of
  // Air/Water/Earth/Fire" are orb-charging (Magic) spots, not transport — see
  // NOT_MOBILITY below. (oldschool.runescape.wiki/w/Obelisk_of_Water)
  [/\bwilderness obelisk\b|^obelisk$/i, 'Wilderness Obelisks'],
  [/mine ?cart|minecart/i, 'Mine Carts'],
  [/charter|sailing ship/i, 'Charter Ships'],
  [/digsite pendant/i, 'Digsite Pendant'],
];

// Things that look transport-ish but aren't: cart-shaped scenery (not the
// Dwarven mine-cart network) and the elemental obelisks (Air/Water/Earth/Fire),
// which are orb-charging Magic spots, not a teleport network.
const NOT_MOBILITY = /broken cart|cart wheel|corpse cart|cart camel|travel cart|coal truck|obelisk of (air|water|earth|fire)/i;

/** The MOBILITY_LIST network this object belongs to, or null if it's not transport. */
export const mobilityFor = (objectName: string): string | null => {
  if (NOT_MOBILITY.test(objectName)) return null;
  for (const [re, network] of MOBILITY_RULES) if (re.test(objectName)) return network;
  return null;
};
