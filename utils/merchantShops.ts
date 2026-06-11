import { chunkContentService } from '../services/ChunkContentService';

/**
 * Classifies the real shops found in the chunk dataset ("Lumbridge General
 * Store", "Aaron's Archery Appendages", …) into the Merchants table's
 * categories ('General Stores', 'Archery Shops', …) so the Merchants section
 * can show which concrete shops a category unlock actually grants — and
 * where they are.
 *
 * Ordered keyword rules; first match wins (specific before generic, e.g.
 * pickaxe→Mining before axe→Axe, crossbow before archery).
 */
const RULES: [RegExp, string][] = [
  [/general store/i, 'General Stores'],
  [/pickaxe/i, 'Mining Shops'],
  [/crossbow/i, 'Crossbow Shops'],
  [/scimitar/i, 'Scimitar Shops'],
  [/platebody|armour/i, 'Platebody Shops'],
  [/platelegs/i, 'Platelegs Shops'],
  [/plateskirt/i, 'Plateskirt Shops'],
  [/chainbody|chainmail|chain mail/i, 'Chainbody Shops'],
  [/helmet|\bhelm\b/i, 'Helmet Shops'],
  [/shield/i, 'Shield Shops'],
  [/\bmace\b/i, 'Mace Shops'],
  [/staff|staves/i, 'Staff Shops'],
  [/sword/i, 'Sword Shops'],
  [/archery|\bbows?\b/i, 'Archery Shops'],
  [/magic|rune shop|runes/i, 'Magic Shops'],
  [/\baxes?\b/i, 'Axe Shops'],
  [/fish|angler/i, 'Fishing Shops'],
  [/vegetable|\bveg\b/i, 'Vegetable Shops'],
  [/spice/i, 'Spice Shops'],
  [/wine/i, 'Wine Traders'],
  [/kebab/i, 'Kebab Sellers'],
  [/silk/i, 'Silk Shops'],
  [/silver/i, 'Silver Shops'],
  [/jewel/i, 'Jewellery Shops'],
  [/amulet/i, 'Amulet Shops'],
  [/\bgems?\b/i, 'Gem Shops'],
  [/herb|apothecary/i, 'Herblore Shops'],
  [/\bdyes?\b/i, 'Dye Shops'],
  [/candle/i, 'Candle Shops'],
  [/\bfurs?\b|fur trader/i, 'Fur Traders'],
  [/hunter/i, 'Hunter Shops'],
  [/farm|seed/i, 'Farming Shops'],
  [/craft/i, 'Crafting Shops'],
  [/mining|\bores?\b/i, 'Mining Shops'],
  [/clothes|clothing|fashion|tailor/i, 'Clothes Shops'],
  [/cook/i, 'Cooking Shops'],
  [/food|grocer|bakery|baker/i, 'Food Shops'],
  [/\b(inn|pub|tavern|bar)\b|brewery|alehouse/i, 'Bars & Inns'],
];

export const classifyShop = (shopName: string): string | null => {
  for (const [re, category] of RULES) {
    if (re.test(shopName)) return category;
  }
  return null;
};

export interface CategoryShop {
  name: string;
  locations: { cx: number; cy: number }[];
}

/**
 * Every classified shop in Gielinor, grouped by merchant category.
 * Requires chunkContentService to be ready; returns null until it is.
 */
export function shopsByCategory(): Map<string, CategoryShop[]> | null {
  if (!chunkContentService.ready) return null;
  const out = new Map<string, CategoryShop[]>();
  for (const hit of chunkContentService.entitiesOfKind('shop')) {
    const category = classifyShop(hit.name);
    if (!category) continue;
    if (!out.has(category)) out.set(category, []);
    out.get(category)!.push({ name: hit.name, locations: hit.locations });
  }
  for (const list of out.values()) list.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}
