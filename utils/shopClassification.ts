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
  // ── Reward / minigame shops (check first; "… Cape Shop"/"… Store" would
  //    otherwise fall through to generic rules) ─────────────────────────────
  [/reward|ticket exchange|cape (shop|store)|arena (store|rewards)|last shopper|research exchange|\bleagues\b|pvp arena|\bsanctum\b|sir tiffy|dom onion|soul wars|party room/i, 'Reward Shops'],
  // ── Specific weapon / armour / tool types ──────────────────────────────
  [/^(?:Durrik's Goods|Gunslik's Assorted Items)$/i, 'General Stores'],
  [/general store/i, 'General Stores'],
  [/pickaxe/i, 'Mining Shops'],
  [/crossbow/i, 'Crossbow Shops'],
  [/scimitar/i, 'Scimitar Shops'],
  [/halberd/i, 'Halberd Shops'],
  [/warhammer|war hammer/i, 'Warhammer Shops'],
  [/\bclaws?\b/i, 'Claw Shops'],
  [/plateskirt|super skirt|\bskirt\b/i, 'Plateskirt Shops'],
  [/platelegs|armoured legs/i, 'Platelegs Shops'],
  [/platebody|plate ?mail|\barmoury?\b|armoured|oziach/i, 'Platebody Shops'],
  [/chainbody|chainmail|chain mail/i, 'Chainbody Shops'],
  [/helmet|\bhelm\b|brain bucket/i, 'Helmet Shops'],
  [/shield/i, 'Shield Shops'],
  [/\bmace\b/i, 'Mace Shops'],
  [/staff|staves/i, 'Staff Shops'],
  [/sword|\bblades?\b/i, 'Sword Shops'],
  [/archery|\bbows?\b|javelin|\bspears?\b|throwing|ranging|\barrow\b/i, 'Archery Shops'],
  [/magic|rune (shop|store)|runes/i, 'Magic Shops'],
  [/\baxes?\b/i, 'Axe Shops'],
  // ── Generic weapons (after the specific weapon types above) ─────────────
  [/weapon|battle (gear|bazaar|axe)|two.?handed|weaponry|battleaxe|chop-chop|accoutrements|shop of champions|\bspikes?\b|cannonball|multicannon|cannon parts|dynamite|blacksmith|smith'?s shop/i, 'Weapon Shops'],
  // ── Provisions & trades ─────────────────────────────────────────────────
  [/fish|angler/i, 'Fishing Shops'],
  [/vegetable|\bveg\b/i, 'Vegetable Shops'],
  [/spice/i, 'Spice Shops'],
  [/wine/i, 'Wine Traders'],
  [/kebab/i, 'Kebab Sellers'],
  [/silk/i, 'Silk Shops'],
  [/silver/i, 'Silver Shops'],
  [/gold exchange|jewel/i, 'Jewellery Shops'],
  [/amulet/i, 'Amulet Shops'],
  [/\bgems?\b/i, 'Gem Shops'],
  [/herb|apothecary|potion/i, 'Herblore Shops'],
  [/\bdyes?\b/i, 'Dye Shops'],
  [/candle|lantern/i, 'Candle Shops'],
  [/\bfurs?\b|fur trader/i, 'Fur Traders'],
  [/hunter|hunting/i, 'Hunter Shops'],
  [/garden cent(re|er)|farm|seed/i, 'Farming Shops'],
  [/slayer/i, 'Slayer Equipment'],
  [/stonemason|stonecutter|stone (mason|cutter)/i, 'Stonemasons'],
  [/sawmill|lumber/i, 'Sawmill Operators'],
  [/builders merchant|estate agent|razmire/i, 'Real Estate Agents'],
  [/tanner|tannery|leather/i, 'Tanners'],
  [/taxiderm|stuffed (head|animal)/i, 'Taxidermists'],
  [/decant/i, 'Decanters'],
  [/lost property|lost and found/i, 'Lost Property'],
  [/pet shop|\bpets\b/i, 'Pet Shops'],
  [/mining|\bores?\b|\blode\b/i, 'Mining Shops'],
  [/\brope\b|craft/i, 'Crafting Shops'],
  [/clothes|clothing|fashion|tailor|seamstress|haberdash|cloth store|\bstyles\b/i, 'Clothes Shops'],
  [/cook/i, 'Cooking Shops'],
  [/meat|\bpie\b|pizza|bake stall|\bchocs?\b|catch of the day|restaurant|food|grocer|bakery|baker|emporium|karambwan|tea sho/i, 'Food Shops'],
  // ── Pubs / taverns (themed names that lack a bar keyword) ───────────────
  [/\b(inn|pub|tavern|bar)\b|brewery|alehouse|\brum\b|drinky|sheared ram|rolling tide|shrimp and parrot|toad and chicken|cloak and stagger|hair of the dog|rat ?& ?bat|old nite|windbreaker|forester'?s arms|big heist lodge|dead man'?s chest|golden field|atlazora|legless faun|harpoon joe|distaste|flaming arrow/i, 'Bars & Inns'],
  // ── General stores (broad catch-all; runs last so specifics win) ────────
  [/general|supplies|wares\b|adventur|eclectic|sundries|odds and ends|\bstuff\b|trading post|\btrader\b|discount|black.?market|bargains|duty free|exotic|wandering merchant|the merchant|village shop|quartermaster|bartering|produce|\bstores?\b|stuffsies|construction|forestry|shipyard|jungle store|handmade|of useful items|lighthouse|shantay|cooperative|gabooty|little shop|and sons|\bmunty\b|horace/i, 'General Stores'],
];

export const classifyShop = (shopName: string): string | null => {
  for (const [re, category] of RULES) {
    if (re.test(shopName)) return category;
  }
  return null;
};
