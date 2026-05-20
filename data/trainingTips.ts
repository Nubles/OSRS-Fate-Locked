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
    { from: 70, to: 80, method: 'Rellekka course' },
    { from: 80, to: 99, method: 'Ardougne course (best xp/hr)' },
  ],
  Attack: [
    { from: 1,  to: 40, method: 'Controlled style on Sand/Rock Crabs (AFK)' },
    { from: 40, to: 70, method: 'Slayer tasks with Attack style' },
    { from: 70, to: 99, method: 'Nightmare Zone — overloads + absorption', note: 'Best melee xp/hr' },
  ],
  Construction: [
    { from: 1,  to: 19, method: 'Crude wooden chairs' },
    { from: 19, to: 33, method: 'Oak chairs' },
    { from: 33, to: 52, method: 'Oak larder' },
    { from: 52, to: 77, method: 'Oak dungeon doors', note: 'Most planks-efficient' },
    { from: 77, to: 99, method: 'Mahogany tables', note: 'Best xp; expensive in planks' },
  ],
  Cooking: [
    { from: 1,  to: 15, method: 'Shrimp / Sardine' },
    { from: 15, to: 40, method: 'Trout / Salmon' },
    { from: 40, to: 68, method: 'Lobster', note: 'Useful food while training' },
    { from: 68, to: 80, method: 'Swordfish / Monkfish' },
    { from: 80, to: 99, method: 'Anglerfish or Karambwan', note: '1-tick Karambwan = fastest' },
  ],
  Crafting: [
    { from: 1,  to: 23, method: 'Leather items (gloves, boots)' },
    { from: 23, to: 54, method: 'Silver/gold jewellery' },
    { from: 54, to: 63, method: "Green d'hide bodies" },
    { from: 63, to: 79, method: "Blue/Red d'hide bodies" },
    { from: 79, to: 99, method: "Black d'hide bodies or battlestaves" },
  ],
  Defence: [
    { from: 1,  to: 40, method: 'Defensive style on Sand Crabs (AFK)' },
    { from: 40, to: 99, method: 'Slayer tasks on defensive', note: 'Multi-skill XP' },
  ],
  Farming: [
    { from: 1,  to: 15, method: 'Allotment patches (potato, onion, cabbage)' },
    { from: 15, to: 99, method: 'Tree & fruit tree runs every 4–8 h', note: 'Passive; huge xp' },
    { from: 30, to: 99, method: 'Herb patches between tree runs' },
    { from: 65, to: 99, method: 'Calquat & spirit tree patches' },
  ],
  Firemaking: [
    { from: 1,  to: 15, method: 'Regular logs' },
    { from: 15, to: 30, method: 'Oak logs' },
    { from: 30, to: 45, method: 'Willow logs' },
    { from: 45, to: 50, method: 'Maple logs' },
    { from: 50, to: 99, method: 'Wintertodt', note: 'Best xp + supply crates reward; needs 50 HP' },
  ],
  Fishing: [
    { from: 1,  to: 20, method: 'Shrimp (net fishing)' },
    { from: 20, to: 48, method: 'Trout/Salmon (fly fishing at Barbarian Village)' },
    { from: 48, to: 99, method: 'Barbarian Fishing (3-tick)', note: 'Best xp in game; also trains Str/Agil' },
    { from: 62, to: 99, method: 'Monkfish at Piscatoris', note: 'AFK & useful food; needs Swan Song' },
  ],
  Fletching: [
    { from: 1,  to: 10, method: 'Arrow shafts' },
    { from: 10, to: 25, method: 'Shortbows (strung)' },
    { from: 25, to: 40, method: 'Maple logs → maple shortbows' },
    { from: 40, to: 55, method: 'Maple longbows (strung)' },
    { from: 55, to: 70, method: 'Yew longbows (strung)' },
    { from: 70, to: 85, method: 'Magic longbows (strung)' },
    { from: 85, to: 99, method: 'Dragon/Amethyst arrow tips', note: 'Fastest at 90+ with rune bolts' },
  ],
  Herblore: [
    { from: 1,  to: 26, method: 'Attack potions (Guam + Eye of newt)', note: 'Farm Guams at herb patches' },
    { from: 26, to: 38, method: 'Strength potions (Tarromin + Limpwurt root)' },
    { from: 38, to: 55, method: 'Defence potions / Ranarr potions' },
    { from: 55, to: 69, method: 'Super attack/strength (profit potions)', note: 'Limited by herb supply' },
    { from: 69, to: 99, method: 'Super restores or prayer potions' },
  ],
  Hitpoints: [
    { from: 1, to: 99, method: 'Passive from combat training (1/3 of combat XP earnt)', note: 'No direct training method' },
  ],
  Hunter: [
    { from: 1,  to: 9,  method: 'Crimson swift (1 trap)' },
    { from: 9,  to: 19, method: 'Copper longtail / Golden warbler' },
    { from: 19, to: 43, method: 'Tropical wagtail / Ruby harvest' },
    { from: 43, to: 60, method: 'Spotted / Dark kebbit' },
    { from: 60, to: 73, method: 'Black chinchompa', note: 'Wilderness — risky' },
    { from: 63, to: 80, method: 'Red salamander' },
    { from: 73, to: 99, method: 'Red chinchompa (best xp/hr)' },
  ],
  Magic: [
    { from: 1,  to: 33, method: 'Combat spells on enemies' },
    { from: 33, to: 55, method: 'Superheat Item (smelting bars)', note: 'Also Smithing XP' },
    { from: 43, to: 55, method: 'Low/High Alchemy on collected items' },
    { from: 55, to: 70, method: 'High Alchemy (55+)', note: 'AFK; needs rune supply' },
    { from: 70, to: 94, method: 'Humidify or NPC Contact (AFK)', note: 'Needs Lunar Diplomacy' },
    { from: 94, to: 99, method: 'Ice Burst/Barrage at Skeletal Monkeys', note: 'Fastest; expensive' },
  ],
  Mining: [
    { from: 1,  to: 15, method: 'Copper/Tin ore' },
    { from: 15, to: 60, method: 'Iron ore (3-tick)', note: 'Fastest to 60' },
    { from: 60, to: 75, method: 'Granite (3-tick)', note: 'Best xp but click-intensive; Kharidian Desert' },
    { from: 70, to: 99, method: 'Motherlode Mine (AFK)', note: 'Good for Smithing supplies' },
    { from: 75, to: 99, method: 'Granite (3-tick) or Amethyst (85+)' },
  ],
  Prayer: [
    { from: 1,  to: 32, method: 'Bury bones while doing other content' },
    { from: 32, to: 70, method: 'Chaos Altar (Wilderness)', note: '50% chance to not consume bone' },
    { from: 70, to: 99, method: 'Dragon/Wyvern/Hydra bones at Chaos Altar' },
  ],
  Ranged: [
    { from: 1,  to: 40, method: 'Knives or shortbow on Sand/Rock Crabs (AFK)' },
    { from: 40, to: 70, method: 'Cannon on Slayer tasks', note: 'Expensive in cannonballs' },
    { from: 70, to: 99, method: 'Red chinchompas in MM2 tunnels', note: 'Best xp in game at high level' },
  ],
  Runecraft: [
    { from: 1,  to: 27, method: 'Air/Earth/Fire runes (nearest altar)' },
    { from: 27, to: 44, method: 'Cosmic runes via Abyss' },
    { from: 44, to: 65, method: 'Nature runes via Abyss' },
    { from: 65, to: 82, method: 'Astral runes (Lunar Isle)', note: 'Needs Lunar Diplomacy' },
    { from: 82, to: 91, method: 'Double nature runes (82+)' },
    { from: 91, to: 99, method: 'Double astral/nature or Lava runes', note: 'Lava runes = fast xp, no profit' },
  ],
  Runecrafting: [
    { from: 1,  to: 27, method: 'Air/Earth/Fire runes (nearest altar)' },
    { from: 27, to: 44, method: 'Cosmic runes via Abyss' },
    { from: 44, to: 65, method: 'Nature runes via Abyss' },
    { from: 65, to: 82, method: 'Astral runes (Lunar Isle)', note: 'Needs Lunar Diplomacy' },
    { from: 82, to: 99, method: 'Double nature runes or Lava runes' },
  ],
  Slayer: [
    { from: 1,  to: 20, method: 'Turael/Spria tasks (fastest early points)' },
    { from: 20, to: 50, method: 'Mazchna tasks' },
    { from: 50, to: 75, method: 'Chaeldar tasks' },
    { from: 75, to: 99, method: 'Konar or Duradel for max points + drops', note: 'Konar gives Brimstone keys' },
  ],
  Smithing: [
    { from: 1,  to: 30, method: 'Quest rewards (Doric\'s Quest etc.) give ~30 free levels' },
    { from: 30, to: 40, method: 'Iron bars → iron platebodies' },
    { from: 40, to: 99, method: 'Gold bars at Blast Furnace', note: 'Goldsmith Gauntlets required (Family Crest)' },
    { from: 40, to: 60, method: 'Steel/Mithril platebodies (no Blast Furnace)' },
  ],
  Strength: [
    { from: 1,  to: 40, method: 'Aggressive style on Sand/Rock Crabs (AFK)' },
    { from: 40, to: 70, method: 'Slayer tasks on aggressive' },
    { from: 70, to: 99, method: 'Nightmare Zone — overloads + absorption', note: 'Super strength + amulet of torture' },
  ],
  Thieving: [
    { from: 1,  to: 5,  method: 'Cows / Chickens (Pickpocket)' },
    { from: 5,  to: 25, method: 'Cake stall / Silk stall' },
    { from: 25, to: 38, method: 'Fruit stall (Hosidius, 15% favour)' },
    { from: 38, to: 55, method: 'Master farmer (seeds)' },
    { from: 45, to: 99, method: 'Ardougne Knights (55+ recommended)', note: 'Best xp; AFK-friendly; needs Ardougne Diary' },
    { from: 55, to: 91, method: 'Pyramid Plunder', note: 'Needs access to Sophanem (Desert)' },
    { from: 91, to: 99, method: 'Pyramid Plunder or Gnome Restaurant', note: 'PP = fast; GR = profit' },
  ],
  Woodcutting: [
    { from: 1,  to: 15, method: 'Normal trees' },
    { from: 15, to: 30, method: 'Oak trees' },
    { from: 30, to: 60, method: 'Willow trees (AFK) or Teak (3-tick, Hardwood Grove)' },
    { from: 60, to: 75, method: 'Yew trees (AFK) or Teak (3-tick)' },
    { from: 75, to: 90, method: 'Magic trees (AFK) or Sulliusceps (Fossil Island)' },
    { from: 90, to: 99, method: 'Redwood trees (AFK, best xp)', note: 'Fossil Island — needs Bone Voyage' },
  ],
};

/** Map skill name → OSRS wiki Training: page slug */
const WIKI_TRAINING_SLUGS: Record<string, string> = {
  Agility:      'Training:Agility',
  Attack:       'Training:Attack',
  Construction: 'Training:Construction',
  Cooking:      'Training:Cooking',
  Crafting:     'Training:Crafting',
  Defence:      'Training:Defence',
  Farming:      'Training:Farming',
  Firemaking:   'Training:Firemaking',
  Fishing:      'Training:Fishing',
  Fletching:    'Training:Fletching',
  Herblore:     'Training:Herblore',
  Hitpoints:    'Training:Hitpoints',
  Hunter:       'Training:Hunter',
  Magic:        'Training:Magic',
  Mining:       'Training:Mining',
  Prayer:       'Training:Prayer',
  Ranged:       'Training:Ranged',
  Runecraft:    'Training:Runecrafting',
  Runecrafting: 'Training:Runecrafting',
  Slayer:       'Training:Slayer',
  Smithing:     'Training:Smithing',
  Strength:     'Training:Strength',
  Thieving:     'Training:Thieving',
  Woodcutting:  'Training:Woodcutting',
};

export function getWikiTrainingUrl(skill: string): string {
  return `https://oldschool.runescape.wiki/w/${WIKI_TRAINING_SLUGS[skill] ?? `Training:${skill}`}`;
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
