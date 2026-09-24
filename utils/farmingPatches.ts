/** Chunk object names mapped to the saved farming unlock IDs. */
const PATCH_RULES: [RegExp, string][] = [
  [/fruit tree patch/i, 'Fruit Tree'],
  [/hardwood (tree )?patch/i, 'Hardwood Tree'],
  [/spirit tree patch/i, 'Spirit Tree'],
  [/crystal tree patch/i, 'Crystal Tree'],
  [/celastrus/i, 'Celastrus'],
  [/redwood (tree )?patch/i, 'Redwood'],
  [/calquat/i, 'Calquat'],
  [/tree patch/i, 'Wood Tree'],
  [/herb patch/i, 'Herb'],
  [/flower patch/i, 'Flower'],
  [/hops patch/i, 'Hops'],
  [/bush patch/i, 'Bush'],
  [/cactus patch/i, 'Cactus'],
  [/mushroom patch/i, 'Mushroom'],
  [/belladonna/i, 'Belladonna'],
  [/seaweed patch/i, 'Seaweed'],
  [/hespori/i, 'Hespori Patch'],
  [/anima patch/i, 'Anima'],
  [/grape ?vine|vine patch/i, 'Vinery'],
  [/coral nursery|coral patch/i, 'Coral Nursery'],
  [/allotment/i, 'Allotment'],
];

export const farmingPatchFor = (objectName: string): string | null => {
  for (const [re, patch] of PATCH_RULES) if (re.test(objectName)) return patch;
  return null;
};
