/**
 * Curated OSRS training method tips, keyed by skill name.
 * Each entry covers a [from, to) level band with the canonical method
 * for that range. Tips are filtered at render time to the player's
 * current → required range so the popover stays relevant.
 *
 * Aimed at Ironman play: methods rely on self-sufficiency rather than
 * the Grand Exchange. Region/unlock notes kept brief — the wiki link
 * covers everything we don't.
 */

export interface TrainingTip {
  from: number;   // minimum player level to use this method
  to: number;     // use until this level (exclusive, 99 = "to max")
  method: string;
  note?: string;  // short parenthetical caveat / unlock requirement
}

export const TRAINING_TIPS: Record<string, TrainingTip[]> = {
  Agility: [
    { from: 1,  to: 10, method: 'Gnome Stronghold course' },
    { from: 10, to: 20, method: 'Draynor Village course' },
    { from: 20, to: 30, method: 'Al Kharid course' },
    { from: 30, to: 40, method: 'Varrock course' },
    { from: 40, to: 52, method: 'Canifis course', note: 'Priest in Peril required' },
    { from: 52, to: 60, method: 'Falador course' },
    { from: 60, to: 70, method: "Seers' Village course" },
    { from: 70, to: 80, method: 'Seers\' Village course' },
    { from: 80, to: 90, method: 'Rellekka course' },
    { from: 90, to: 99, method: 'Ardougne course', note: 'Can boost from 85 with summer pies' },
  ],
  Attack: [
    { from: 1,  to: 40, method: 'Controlled style on Sand/Rock Crabs (AFK)' },
    { from: 40, to: 70, method: 'Slayer tasks with Attack style' },
    { from: 70, to: 99, method: 'Nightmare Zone — overloads + absorption', note: 'Low-effort combat; requires five supported quests and points for supplies' },
  ],
  Construction: [
    { from: 1,  to: 19, method: 'Crude wooden chairs' },
    { from: 19, to: 33, method: 'Oak chairs' },
    { from: 33, to: 74, method: 'Oak larder' },
    { from: 74, to: 99, method: 'Oak dungeon doors', note: 'Oak-plank option' },
    { from: 52, to: 77, method: 'Mahogany tables', note: 'Fast; expensive in planks' },
    { from: 77, to: 99, method: 'Gnome benches', note: 'Faster mahogany-plank method' },
  ],
  Cooking: [
    { from: 1,  to: 15, method: 'Shrimp / Sardine' },
    { from: 15, to: 25, method: 'Trout' },
    { from: 25, to: 40, method: 'Trout / Salmon' },
    { from: 40, to: 68, method: 'Lobster', note: 'Useful food while training' },
    { from: 68, to: 80, method: 'Swordfish / Monkfish' },
    { from: 80, to: 99, method: 'Karambwan', note: 'Complete the cooking lesson in Tai Bwo Wannai Trio; 1-tick cooking is intensive' },
    { from: 84, to: 99, method: 'Anglerfish' },
  ],
  Crafting: [
    { from: 1,  to: 23, method: 'Leather items (gloves, boots)' },
    { from: 23, to: 63, method: 'Silver/gold jewellery', note: 'Choose a recipe within your level' },
    { from: 63, to: 71, method: "Green d'hide bodies" },
    { from: 71, to: 77, method: "Blue d'hide bodies" },
    { from: 77, to: 84, method: "Red d'hide bodies" },
    { from: 84, to: 99, method: "Black d'hide bodies" },
  ],
  Defence: [
    { from: 1,  to: 40, method: 'Defensive style on Sand Crabs (AFK)' },
    { from: 40, to: 99, method: 'Slayer tasks on defensive', note: 'Multi-skill XP' },
  ],
  Farming: [
    { from: 1,  to: 15, method: 'Allotment patches (potato, onion, cabbage)' },
    { from: 15, to: 99, method: 'Tree runs', note: 'Growth time varies by tree' },
    { from: 27, to: 99, method: 'Fruit tree runs', note: 'Normal fruit trees take about 16 hours to grow' },
    { from: 30, to: 99, method: 'Herb patches between tree runs' },
    { from: 72, to: 99, method: 'Calquat patch' },
    { from: 83, to: 99, method: 'Spirit tree patches' },
  ],
  Firemaking: [
    { from: 1,  to: 15, method: 'Regular logs' },
    { from: 15, to: 30, method: 'Oak logs' },
    { from: 30, to: 45, method: 'Willow logs' },
    { from: 45, to: 50, method: 'Maple logs' },
    { from: 50, to: 99, method: 'Wintertodt', note: 'Requires 50 Firemaking; rewards supply crates' },
  ],
  Fishing: [
    { from: 1,  to: 20, method: 'Shrimp (net fishing)' },
    { from: 20, to: 48, method: 'Trout/Salmon (fly fishing at Barbarian Village)' },
    { from: 48, to: 99, method: 'Barbarian Fishing (3-tick)', note: 'Complete Barbarian Training; leaping trout also require 15 Strength and Agility' },
    { from: 62, to: 99, method: 'Monkfish at Piscatoris', note: 'AFK & useful food; needs Swan Song' },
  ],
  Fletching: [
    { from: 1,  to: 10, method: 'Arrow shafts' },
    { from: 10, to: 25, method: 'Shortbows (strung)' },
    { from: 25, to: 50, method: 'Oak longbows (strung)' },
    { from: 50, to: 55, method: 'Maple shortbows (strung)' },
    { from: 55, to: 70, method: 'Maple longbows (strung)' },
    { from: 70, to: 85, method: 'Yew longbows (strung)' },
    { from: 85, to: 99, method: 'Magic longbows (strung)' },
    { from: 82, to: 99, method: 'Amethyst arrows', note: 'Attach amethyst arrowtips to headless arrows; making tips requires 85 Crafting' },
    { from: 90, to: 99, method: 'Dragon arrows', note: 'Requires dragon arrowtips and headless arrows' },
  ],
  Herblore: [
    { from: 1, to: 3, method: 'Druidic Ritual', note: 'Unlocks Herblore and gives level 3' },
    { from: 3, to: 26, method: 'Attack potions (Guam + Eye of newt)', note: 'Requires Druidic Ritual' },
    { from: 26, to: 38, method: 'Strength potions (Tarromin + Limpwurt root)' },
    { from: 38, to: 55, method: 'Defence potions / Prayer potions' },
    { from: 55, to: 69, method: 'Super attack/strength potions', note: 'Limited by herb supply' },
    { from: 69, to: 99, method: 'Super restores or prayer potions' },
  ],
  Hitpoints: [
    { from: 1, to: 99, method: 'Hitpoints experience from combat', note: 'Normally 1.33 XP per damage; combat style and reward sources vary' },
  ],
  Hunter: [
    { from: 1,  to: 9,  method: 'Crimson swift (1 trap)' },
    { from: 9,  to: 19, method: 'Copper longtail / Golden warbler' },
    { from: 19, to: 43, method: 'Tropical wagtail / Ruby harvest' },
    { from: 43, to: 57, method: 'Spotted kebbit' },
    { from: 57, to: 63, method: 'Dark kebbit' },
    { from: 73, to: 99, method: 'Black chinchompa', note: 'Wilderness — risky' },
    { from: 63, to: 80, method: 'Red salamander' },
    { from: 63, to: 99, method: 'Red chinchompa', note: 'Alternative outside the Wilderness' },
  ],
  Magic: [
    { from: 1,  to: 33, method: 'Combat spells on enemies' },
    { from: 43, to: 55, method: 'Superheat Item (smelting bars)', note: 'Also Smithing XP' },
    { from: 21, to: 55, method: 'Low Level Alchemy on collected items' },
    { from: 55, to: 70, method: 'High Level Alchemy', note: 'Needs rune and item supply' },
    { from: 70, to: 94, method: 'Humidify or Astral Contact', note: 'Needs Lunar Diplomacy' },
    { from: 94, to: 99, method: 'Ice Barrage at maniacal monkeys', note: 'Desert Treasure I and Monkey Madness II chapter II access; expensive' },
  ],
  Mining: [
    { from: 1,  to: 15, method: 'Copper/Tin ore' },
    { from: 15, to: 60, method: 'Iron ore (3-tick)', note: 'Useful early training; 3-tick granite becomes available at 45' },
    { from: 60, to: 75, method: 'Granite (3-tick)', note: 'Best xp but click-intensive; Kharidian Desert' },
    { from: 70, to: 99, method: 'Motherlode Mine (AFK)', note: 'Good for Smithing supplies' },
    { from: 75, to: 99, method: 'Granite (3-tick)' },
    { from: 92, to: 99, method: 'Amethyst', note: 'Members area of the Mining Guild' },
  ],
  Prayer: [
    { from: 1,  to: 32, method: 'Bury bones while doing other content' },
    { from: 32, to: 70, method: 'Chaos Altar (Wilderness)', note: '50% chance to not consume bone' },
    { from: 70, to: 99, method: 'Dragon/Wyvern/Hydra bones at Chaos Altar' },
  ],
  Ranged: [
    { from: 1,  to: 40, method: 'Knives or shortbow on Sand/Rock Crabs (AFK)' },
    { from: 40, to: 70, method: 'Cannon on Slayer tasks', note: 'Expensive in cannonballs' },
    { from: 70, to: 99, method: 'Red chinchompas in MM2 tunnels', note: 'Monkey Madness II chapter II access; rates depend on gear and method' },
  ],
  Runecraft: [
    { from: 1,  to: 27, method: 'Air/Earth/Fire runes (nearest altar)' },
    { from: 27, to: 44, method: 'Cosmic runes via Abyss' },
    { from: 44, to: 65, method: 'Nature runes via Abyss' },
    { from: 65, to: 82, method: 'Astral runes (Lunar Isle)', note: 'Needs Lunar Diplomacy' },
    { from: 82, to: 91, method: 'Double astral runes', note: 'Requires Lunar Diplomacy' },
    { from: 91, to: 99, method: 'Double astral/nature or Lava runes', note: 'Guaranteed double nature runes from 91; rates and costs vary' },
  ],
  Runecrafting: [
    { from: 1,  to: 27, method: 'Air/Earth/Fire runes (nearest altar)' },
    { from: 27, to: 44, method: 'Cosmic runes via Abyss' },
    { from: 44, to: 65, method: 'Nature runes via Abyss' },
    { from: 65, to: 82, method: 'Astral runes (Lunar Isle)', note: 'Needs Lunar Diplomacy' },
    { from: 82, to: 91, method: 'Double astral runes', note: 'Requires Lunar Diplomacy' },
    { from: 91, to: 99, method: 'Double nature runes or lava runes' },
  ],
  Slayer: [
    { from: 1,  to: 20, method: 'Turael/Spria tasks', note: 'Award no points; for point boosting, use a higher master for milestone tasks' },
    { from: 20, to: 50, method: 'Mazchna tasks', note: 'Requires Priest in Peril and 20 combat (or 99 Slayer)' },
    { from: 50, to: 75, method: 'Chaeldar tasks', note: 'Requires Lost City and 70 combat (or 99 Slayer)' },
    { from: 75, to: 99, method: 'Konar or Duradel tasks', note: 'Check master combat, Slayer and quest requirements; Konar tasks can award brimstone keys' },
  ],
  Smithing: [
    { from: 1, to: 33, method: 'Smelt bars and smith items within your level', note: 'The Knight\'s Sword rewards Smithing XP; check its quest requirements' },
    { from: 33, to: 48, method: 'Iron bars → iron platebodies' },
    { from: 40, to: 99, method: 'Gold bars at Blast Furnace', note: 'Goldsmith gauntlets from Family Crest are optional but strongly recommended for 56.2 rather than 22.5 XP per bar' },
    { from: 48, to: 68, method: 'Steel platebodies' },
    { from: 68, to: 99, method: 'Mithril platebodies' },
  ],
  Strength: [
    { from: 1,  to: 40, method: 'Aggressive style on Sand/Rock Crabs (AFK)' },
    { from: 40, to: 70, method: 'Slayer tasks on aggressive' },
    { from: 70, to: 99, method: 'Nightmare Zone — overloads + absorption', note: 'Super strength + amulet of torture' },
  ],
  Thieving: [
    { from: 1,  to: 5,  method: 'Pickpocket men and women' },
    { from: 5, to: 20, method: 'Cake stalls' },
    { from: 20, to: 25, method: 'Cake stalls / Silk stalls' },
    { from: 25, to: 38, method: 'Fruit stalls in Hosidius' },
    { from: 38, to: 55, method: 'Master farmer (seeds)' },
    { from: 55, to: 99, method: 'Pickpocket knights of Ardougne', note: 'Ardougne diary rewards optionally improve success' },
    { from: 55, to: 91, method: 'Pyramid Plunder', note: 'Needs access to Sophanem (Desert)' },
    { from: 91, to: 99, method: 'Pyramid Plunder', note: 'All rooms unlocked at 91; requires access to Sophanem' },
  ],
  Woodcutting: [
    { from: 1,  to: 15, method: 'Normal trees' },
    { from: 15, to: 30, method: 'Oak trees' },
    { from: 30, to: 60, method: 'Willow trees' },
    { from: 35, to: 60, method: 'Teak trees', note: 'Location access varies; 3-tick methods need active input' },
    { from: 60, to: 75, method: 'Yew trees (AFK) or Teak (3-tick)' },
    { from: 75, to: 90, method: 'Magic trees (AFK) or Sulliusceps (Fossil Island)' },
    { from: 90, to: 99, method: 'Redwood trees', note: 'Woodcutting Guild, or a grown redwood in the Farming Guild' },
  ],
};

/** Map skill name → verified OSRS Wiki training page slug */
const WIKI_TRAINING_SLUGS: Record<string, string> = {
  Agility:      'Agility_training',
  Attack:       'Pay-to-play_Melee_training',
  Construction: 'Construction_training',
  Cooking:      'Pay-to-play_Cooking_training',
  Crafting:     'Pay-to-play_Crafting_training',
  Defence:      'Pay-to-play_Melee_training',
  Farming:      'Farming_training',
  Firemaking:   'Pay-to-play_Firemaking_training',
  Fishing:      'Pay-to-play_Fishing_training',
  Fletching:    'Fletching_training',
  Herblore:     'Herblore_training',
  Hitpoints:    'Hitpoints',
  Hunter:       'Hunter_training',
  Magic:        'Pay-to-play_Magic_training',
  Mining:       'Pay-to-play_Mining_training',
  Prayer:       'Pay-to-play_Prayer_training',
  Ranged:       'Pay-to-play_Ranged_training',
  Runecraft:    'Pay-to-play_Runecraft_training',
  Runecrafting: 'Pay-to-play_Runecraft_training',
  Slayer:       'Slayer_training',
  Smithing:     'Pay-to-play_Smithing_training',
  Strength:     'Pay-to-play_Melee_training',
  Thieving:     'Thieving_training',
  Woodcutting:  'Pay-to-play_Woodcutting_training',
};

export function getWikiTrainingUrl(skill: string): string {
  return `https://oldschool.runescape.wiki/w/${WIKI_TRAINING_SLUGS[skill] ?? skill.replace(/ /g, '_')}`;
}

/**
 * Approximate cumulative XP at key levels (official OSRS values).
 * Used to display "~123K XP to go" in the popover.
 */
const XP_AT_LEVEL: Record<number, number> = {
  1: 0, 5: 388, 10: 1_154, 15: 2_411, 20: 4_470,
  25: 7_842, 30: 13_363, 35: 22_406, 40: 37_224, 45: 61_512,
  50: 101_333, 55: 166_636, 60: 273_742, 65: 449_428, 70: 737_627,
  75: 1_210_421, 80: 1_986_068, 85: 3_258_594, 90: 5_346_332,
  95: 8_771_558, 99: 13_034_431,
};

/** Linear interpolation using the sparse XP table — accurate enough for UX. */
export function xpAtLevel(level: number): number {
  if (level <= 1) return 0;
  if (level >= 99) return XP_AT_LEVEL[99];
  const keys = Object.keys(XP_AT_LEVEL).map(Number).sort((a, b) => a - b);
  let lo = 1, hi = 99;
  for (const k of keys) {
    if (k <= level) lo = k;
    else { hi = k; break; }
  }
  if (lo === hi) return XP_AT_LEVEL[lo] ?? 0;
  const t = (level - lo) / (hi - lo);
  return Math.round((XP_AT_LEVEL[lo] ?? 0) + t * ((XP_AT_LEVEL[hi] ?? 0) - (XP_AT_LEVEL[lo] ?? 0)));
}

export function formatXP(xp: number): string {
  if (xp >= 1_000_000) return `${(xp / 1_000_000).toFixed(1)}M`;
  if (xp >= 1_000)     return `${Math.round(xp / 1_000)}K`;
  return String(xp);
}
