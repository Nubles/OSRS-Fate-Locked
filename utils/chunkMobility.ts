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
  [/obelisk of (air|water|earth|fire)|\bwilderness obelisk\b|^obelisk$/i, 'Wilderness Obelisks'],
  [/mine ?cart|minecart/i, 'Mine Carts'],
  [/charter|sailing ship/i, 'Charter Ships'],
  [/digsite pendant/i, 'Digsite Pendant'],
];

// Cart-like scenery that is NOT the Dwarven mine-cart network.
const NOT_MOBILITY = /broken cart|cart wheel|corpse cart|cart camel|travel cart|coal truck/i;

/** The MOBILITY_LIST network this object belongs to, or null if it's not transport. */
export const mobilityFor = (objectName: string): string | null => {
  if (NOT_MOBILITY.test(objectName)) return null;
  for (const [re, network] of MOBILITY_RULES) if (re.test(objectName)) return network;
  return null;
};
