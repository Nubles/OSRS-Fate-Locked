/**
 * Gatherable-resource gating for the chunk activity panel.
 *
 * A chunk's `objects` list mixes inert scenery (banks, anvils, altars) with
 * real gathering nodes — trees, ore rocks, fishing spots. This module pulls the
 * gatherables out and tags each with the Skill + level needed to harvest it, so
 * the panel can show them green (can gather now) or red/struck-through (locked),
 * exactly the way shops gate on a merchant category and monsters on Slayer.
 *
 * A node is usable when the run's unlocked skill TIER actually reaches the
 * node's required level (cap model — tier N unlocks levels 1…N×10) AND the
 * player's current level meets it. So 99 Woodcutting at tier 3 still can't cut
 * yews (level 60 needs tier 6), exactly as the tier system intends.
 *
 * Facts (which node needs which level) are standard OSRS skilling requirements,
 * re-expressed here; the node *names* come from our own chunk-content dataset.
 */
import type { UnlockState } from '../types';
import { tierForLevel } from './skillTiers';

export interface ResourceReq {
  skill: string;
  level: number;
}

// Ordered most-specific → least: the first matching rule wins, so "Magic tree"
// is tested before the bare "tree" fallback, "Coal rocks" before "rocks".
const RESOURCE_RULES: [RegExp, ResourceReq][] = [
  // ── Woodcutting ─────────────────────────────────────────────────────────
  [/rosewood tree/i, { skill: 'Woodcutting', level: 92 }],
  [/redwood tree(?! patch)/i, { skill: 'Woodcutting', level: 90 }],
  [/ironwood tree/i, { skill: 'Woodcutting', level: 80 }],
  [/magic tree/i, { skill: 'Woodcutting', level: 75 }],
  [/camphor tree/i, { skill: 'Woodcutting', level: 66 }],
  [/blisterwood tree/i, { skill: 'Woodcutting', level: 62 }],
  [/yew tree/i, { skill: 'Woodcutting', level: 60 }],
  [/arctic pine/i, { skill: 'Woodcutting', level: 54 }],
  [/mahogany tree/i, { skill: 'Woodcutting', level: 50 }],
  [/maple tree|hollow tree/i, { skill: 'Woodcutting', level: 45 }],
  [/mature juniper/i, { skill: 'Woodcutting', level: 42 }],
  [/jatoba tree/i, { skill: 'Woodcutting', level: 40 }],
  [/teak tree/i, { skill: 'Woodcutting', level: 35 }],
  [/willow tree/i, { skill: 'Woodcutting', level: 30 }],
  [/oak tree/i, { skill: 'Woodcutting', level: 15 }],
  [/achey tree/i, { skill: 'Woodcutting', level: 1 }],
  // Generic trees (incl. evergreen, jungle, banana, palm, tropical, dead) — lvl 1.
  // Farming "… tree patch" nodes are pulled out upstream before this runs, so a
  // bare \btree\b here only ever sees real Woodcutting trees.
  [/\btree\b/i, { skill: 'Woodcutting', level: 1 }],

  // ── Mining (only explicitly-named mineable rocks — bare "rocks"/"rock"/
  //    handholds are ambiguous Agility/scenery and stay ungated) ───────────
  [/sunstone (rocks|monolith)/i, { skill: 'Mining', level: 53 }],
  [/amethyst/i, { skill: 'Mining', level: 92 }],
  [/runite rocks/i, { skill: 'Mining', level: 85 }],
  [/nickel rocks/i, { skill: 'Mining', level: 74 }],
  [/basalt rock/i, { skill: 'Mining', level: 72 }],
  [/adamantite rocks/i, { skill: 'Mining', level: 70 }],
  [/lovakite rocks/i, { skill: 'Mining', level: 65 }],
  [/daeyalt/i, { skill: 'Mining', level: 60 }],
  [/mithril rocks/i, { skill: 'Mining', level: 55 }],
  [/granite rocks/i, { skill: 'Mining', level: 45 }],
  [/volcanic sulphur/i, { skill: 'Mining', level: 42 }],
  [/gold rocks/i, { skill: 'Mining', level: 40 }],
  [/gem rocks?\b/i, { skill: 'Mining', level: 40 }],
  [/boulder \(dense essence/i, { skill: 'Mining', level: 38 }],
  [/sandstone rocks/i, { skill: 'Mining', level: 35 }],
  [/coal rocks/i, { skill: 'Mining', level: 30 }],
  [/lead rocks/i, { skill: 'Mining', level: 25 }],
  [/silver rocks/i, { skill: 'Mining', level: 20 }],
  [/iron rocks/i, { skill: 'Mining', level: 15 }],
  [/(copper|tin|clay) rocks|dig site specimen/i, { skill: 'Mining', level: 1 }],

  // ── Fishing (by the spot's method / catch; a spot with several catches
  //    opens at its lowest) ────────────────────────────────────────────────
  [/fishing spot \(sacred eel\)/i, { skill: 'Fishing', level: 87 }],
  [/fishing spot \(dark crab\)/i, { skill: 'Fishing', level: 85 }],
  [/fishing spot \(lantern\)/i, { skill: 'Fishing', level: 87 }],
  [/fishing spot \(anglerfish\)/i, { skill: 'Fishing', level: 82 }],
  [/fishing spot \(minnow\)/i, { skill: 'Fishing', level: 82 }],
  [/fishing spot \(infernal eel\)/i, { skill: 'Fishing', level: 80 }],
  // The closing bracket keeps the karambwanji spots (5) out; a "\b" after it never matched.
  [/fishing spot \(karambwan\)/i, { skill: 'Fishing', level: 65 }],
  [/fishing spot \(lava eel\)/i, { skill: 'Fishing', level: 53 }],
  [/fishing spot \(barbarian\)/i, { skill: 'Fishing', level: 48 }],
  // Bluegills need 43 Fishing (and 35 Hunter).
  [/fishing spot \(aerial fishing\)/i, { skill: 'Fishing', level: 43 }],
  [/fishing spot \(cage, harpoon\)/i, { skill: 'Fishing', level: 40 }],
  [/fishing spot \(harpoon\)/i, { skill: 'Fishing', level: 35 }],
  // Piscatoris's spots give monkfish (62) to a net and tuna (35) to a harpoon
  // (Piscatoris Fishing Colony, oldid 15319704).
  [/fishing spot \(piscatoris fishing colony\)/i, { skill: 'Fishing', level: 35 }],
  [/fishing spot \(tempoross cove\)/i, { skill: 'Fishing', level: 35 }],
  [/fishing spot \(frogspawn\)/i, { skill: 'Fishing', level: 33 }],
  [/fishing spot \(lure, bait\)/i, { skill: 'Fishing', level: 20 }],
  [/fishing spot \(big net, harpoon\)/i, { skill: 'Fishing', level: 16 }],
  [/fishing spot \(karambwanji\)/i, { skill: 'Fishing', level: 5 }],
  [/fishing spot/i, { skill: 'Fishing', level: 1 }], // small net / bait / swamp / location spots

  // ── Thieving (named market stalls + thievable chests; levels are the OSRS
  //    stall requirements. Bank/quest chests are excluded below) ────────────
  [/\bore stall/i, { skill: 'Thieving', level: 82 }],
  [/gem stall/i, { skill: 'Thieving', level: 75 }],
  [/scimitar stall/i, { skill: 'Thieving', level: 65 }],
  [/spice stall/i, { skill: 'Thieving', level: 65 }],
  [/magic stall/i, { skill: 'Thieving', level: 65 }],
  [/silver stall/i, { skill: 'Thieving', level: 50 }],
  [/crossbow stall/i, { skill: 'Thieving', level: 49 }],
  [/\bfish stall/i, { skill: 'Thieving', level: 42 }],
  [/fur stall/i, { skill: 'Thieving', level: 35 }],
  [/seed stall/i, { skill: 'Thieving', level: 27 }],
  [/fruit stall/i, { skill: 'Thieving', level: 25 }],
  [/wine stall|market stall \(wine\)/i, { skill: 'Thieving', level: 22 }],
  [/silk stall/i, { skill: 'Thieving', level: 20 }],
  [/(veg|vegetable) stall/i, { skill: 'Thieving', level: 2 }],
  [/(baker'?s|cake|bread) stall/i, { skill: 'Thieving', level: 5 }],
  [/tea stall/i, { skill: 'Thieving', level: 5 }],
  [/crafting stall/i, { skill: 'Thieving', level: 5 }],
  [/general stall|food stall/i, { skill: 'Thieving', level: 5 }],
  [/\bstall\b/i, { skill: 'Thieving', level: 5 }], // generic market stall fallback

  // ── Runecrafting altars (Prayer altars and travel portals are excluded
  //    below; the basic rune altars are reached via "Mysterious ruins") ─────
  [/soul altar/i, { skill: 'Runecraft', level: 90 }],
  [/blood altar/i, { skill: 'Runecraft', level: 77 }],
  [/astral altar/i, { skill: 'Runecraft', level: 40 }],
  [/dark altar|mysterious ruins|\brift\b|temple of the eye/i, { skill: 'Runecraft', level: 1 }],
  // Agility rooftop courses are classified in utils/skillChunkNodes (their
  // obstacle objects are named "… Rooftop Course", excluded from trees above).
];

// Keyword-bearing nodes that are NOT the gatherable they look like: spirit
// trees / mushtrees are travel nodes; "(Prayer)" altars and travel portals
// are not Runecrafting.
const NOT_A_RESOURCE = /spirit tree|mushtree|rooftop course|\(prayer\)|altar of (guthix|zamorak|saradomin)|exposed altar|chaos altar|\bportal\b/i;

/** The Skill + level needed to gather this object, or null if it's inert. */
export const resourceReqFor = (objectName: string): ResourceReq | null => {
  if (NOT_A_RESOURCE.test(objectName)) return null;
  for (const [re, req] of RESOURCE_RULES) if (re.test(objectName)) return req;
  return null;
};

/**
 * Usable when the unlocked tier reaches the node's level (cap model) AND the
 * current level meets it. e.g. yews (60) need tier ≥ 6 and level ≥ 60.
 */
export const resourceUsable = (req: ResourceReq, unlocks: UnlockState): boolean => {
  const tier = unlocks.skills?.[req.skill] ?? 0;
  const level = unlocks.levels?.[req.skill] ?? 1;
  return tier >= tierForLevel(req.level) && level >= req.level;
};
