/**
 * Classifies the real shops found in the chunk dataset ("Lumbridge General
 * Store", "Aaron's Archery Appendages", …) into the Merchants table's
 * categories ('General Stores', 'Archery Shops', …) so the Merchants section
 * can show which concrete shops a category unlock actually grants — and
 * where they are.
 *
 * Exact overrides cover shops whose names are misleading or too vague to
 * classify safely. Ordered keyword rules then handle the ordinary cases
 * (specific before generic, e.g. pickaxe→Mining before axe→Axe).
 */
const SHOP_CATEGORY_OVERRIDES: Record<string, string> = {
  // Armour shops whose names do not reveal their actual speciality.
  'armour shop (jatizso)': 'Chainbody Shops',
  "scavvo's rune store": 'Chainbody Shops',
  "sir tiffy cashien (recruitment drive)": 'Platebody Shops',
  "sir tiffy cashien (the slug menace)": 'Platebody Shops',
  "valaine's shop of champions": 'Platebody Shops',

  // Specific equipment shops hidden behind generic or misleading names.
  'armoury': 'Archery Shops',
  "ava's odds and ends": 'Archery Shops',
  "brian's battleaxe bazaar": 'Axe Shops',
  "fairy fixit's fairy enchantment": 'Magic Shops',
  "filamina's wares": 'Staff Shops',
  "gaius' two handed shop": 'Sword Shops',
  'gulluck and sons': 'Weapon Shops',
  "happy heroes' h'emporium": 'Weapon Shops',
  "imia's supplies": 'Hunter Shops',
  "iorwerth's arms": 'Weapon Shops',
  'irksol (shop)': 'Gem Shops',
  "iwan's maces": 'Mace Shops',
  'jukat (shop)': 'Sword Shops',
  'magic guild store (runes and staves)': 'Magic Shops',
  "miltog's lamps": 'Candle Shops',
  "neitiznot supplies": 'Crafting Shops',
  "perry's chop-chop shop": 'Axe Shops',
  "skulgrimen's battle gear": 'Helmet Shops',
  "spike's spikes": 'Mace Shops',
  "thirus urkar's fine dynamite store": 'Mining Shops',
  "thyria's wares": 'Magic Shops',
  'warrior guild armoury': 'Weapon Shops',
  "~ uglug's stuffsies ~": 'Archery Shops',

  // Ore-only sellers use the dedicated Ore Merchants unlock; tool and
  // dynamite sellers remain Mining Shops.
  'deepfin point ore exchange': 'Ore Merchants',
  'ore store': 'Ore Merchants',
  "petrified pete's ore shop": 'Ore Merchants',
  'port roberts ore stall': 'Ore Merchants',

  // Food, fishing, and service shops with non-descriptive proper names.
  "construction supplies": 'Sawmill Operators',
  "henderson's catch of the day": 'Fishing Shops',
  "keepa kettilon's store": 'Food Shops',
  "keldagrim's best bread": 'Food Shops',
  "kenelme's wares": 'Food Shops',
  "lovecraft's tackle": 'Fishing Shops',
  "mairin's market": 'Fishing Shops',
  "seddu's adventurer's store": 'Platelegs Shops',
  'shop of distaste': 'Vegetable Shops',
  'the shrimp and parrot': 'Food Shops',
  "yarnio's baked goods": 'Food Shops',

  // These are pubs despite words such as Ore, Arrow, Sanctum, or Arms.
  'beach cocktails': 'Bars & Inns',
  'falador party room': 'Bars & Inns',
  'garlic cocktail supply': 'Bars & Inns',
  "myreque's rest": 'Bars & Inns',
  'stick your ore inn': 'Bars & Inns',
  "sunlight's sanctum": 'Bars & Inns',
  'the crypt': 'Bars & Inns',
  'the deeper lode': 'Bars & Inns',
  "the esoterican arms": 'Bars & Inns',
  'the flaming arrow': 'Bars & Inns',
  "the haymaker's arms": 'Bars & Inns',

  // Currency/reward exchanges and ordinary clothing shops must not be
  // inferred from words such as Hunter, Stuff, Wares, or Cape.
  'bounty hunter store': 'Reward Shops',
  'forestry shop': 'Reward Shops',
  "honest jimmy's house of stuff": 'Reward Shops',
  'mysterious hallowed goods': 'Reward Shops',
  "prospector percy's nugget shop": 'Reward Shops',
  "worm tounge's wares": 'Reward Shops',
  'beach kit': 'Clothes Shops',
  "darren's wilderness cape shop": 'Clothes Shops',
  "edmond's wilderness cape shop": 'Clothes Shops',
  "edward's wilderness cape shop": 'Clothes Shops',
  "ian's wilderness cape shop": 'Clothes Shops',
  "larry's wilderness cape shop": 'Clothes Shops',
  'mythical cape store': 'Clothes Shops',
  "neil's wilderness cape shop": 'Clothes Shops',
  "richard's wilderness cape shop": 'Clothes Shops',
  "sam's wilderness cape shop": 'Clothes Shops',
  "simon's wilderness cape shop": 'Clothes Shops',
  "trader sven's black-market goods": 'Clothes Shops',
  "where wyrmscraig's wear wares were": 'Clothes Shops',
  "william's wilderness cape shop": 'Clothes Shops',
  "yrsa's accoutrements": 'Clothes Shops',

  // The Culinaromancer's Chest has stock snapshots for each RFD stage.
  "culinaromancer's chest": 'Cooking Shops',
  "culinaromancer's chest#food": 'Food Shops',
};

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
  const normalizedName = shopName.trim().toLowerCase();
  const normalizedVariant = normalizedName.replace(/\.$/, '');
  const normalizedBase = normalizedName.replace(/#.*$/, '').replace(/\.$/, '');
  const override = SHOP_CATEGORY_OVERRIDES[normalizedVariant]
    ?? SHOP_CATEGORY_OVERRIDES[normalizedBase];
  if (override) return override;
  for (const [re, category] of RULES) {
    if (re.test(shopName)) return category;
  }
  return null;
};
