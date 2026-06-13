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
  [/redwood tree(?! patch)/i, { skill: 'Woodcutting', level: 90 }],
  [/magic tree/i, { skill: 'Woodcutting', level: 75 }],
  [/yew tree/i, { skill: 'Woodcutting', level: 60 }],
  [/arctic pine|mature juniper/i, { skill: 'Woodcutting', level: 54 }],
  [/mahogany tree/i, { skill: 'Woodcutting', level: 50 }],
  [/maple tree|hollow tree/i, { skill: 'Woodcutting', level: 45 }],
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
  [/amethyst/i, { skill: 'Mining', level: 92 }],
  [/runite rocks/i, { skill: 'Mining', level: 85 }],
  [/adamantite rocks/i, { skill: 'Mining', level: 70 }],
  [/lovakite rocks/i, { skill: 'Mining', level: 65 }],
  [/mithril rocks/i, { skill: 'Mining', level: 55 }],
  [/granite rocks/i, { skill: 'Mining', level: 45 }],
  [/gold rocks/i, { skill: 'Mining', level: 40 }],
  [/gem rocks?\b/i, { skill: 'Mining', level: 40 }],
  [/sandstone rocks/i, { skill: 'Mining', level: 35 }],
  [/coal rocks/i, { skill: 'Mining', level: 30 }],
  [/silver rocks/i, { skill: 'Mining', level: 20 }],
  [/iron rocks/i, { skill: 'Mining', level: 15 }],
  [/(copper|tin|clay) rocks/i, { skill: 'Mining', level: 1 }],

  // ── Fishing (by the spot's method) ──────────────────────────────────────
  [/fishing spot \(dark crab\)/i, { skill: 'Fishing', level: 85 }],
  [/fishing spot \(anglerfish\)/i, { skill: 'Fishing', level: 82 }],
  [/fishing spot \(lantern\)/i, { skill: 'Fishing', level: 87 }],
  [/fishing spot \(karambwan\)/i, { skill: 'Fishing', level: 65 }],
  [/fishing spot \(barbarian\)/i, { skill: 'Fishing', level: 48 }],
  [/fishing spot \(cage, harpoon\)/i, { skill: 'Fishing', level: 40 }],
  [/fishing spot \(harpoon\)/i, { skill: 'Fishing', level: 35 }],
  [/fishing spot \(big net, harpoon\)/i, { skill: 'Fishing', level: 16 }],
  [/fishing spot \(lure, bait\)/i, { skill: 'Fishing', level: 20 }],
  [/fishing spot/i, { skill: 'Fishing', level: 1 }], // small net / bait / swamp

  // ── Thieving (named market stalls + thievable chests; levels are the OSRS
  //    stall requirements. Bank/quest chests are excluded below) ────────────
  [/gem stall/i, { skill: 'Thieving', level: 75 }],
  [/scimitar stall/i, { skill: 'Thieving', level: 65 }],
  [/spice stall/i, { skill: 'Thieving', level: 65 }],
  [/magic stall/i, { skill: 'Thieving', level: 65 }],
  [/silver stall/i, { skill: 'Thieving', level: 50 }],
  [/fur stall/i, { skill: 'Thieving', level: 35 }],
  [/silk stall/i, { skill: 'Thieving', level: 20 }],
  [/(fruit|veg|vegetable) stall/i, { skill: 'Thieving', level: 2 }],
  [/(baker'?s|cake|bread) stall/i, { skill: 'Thieving', level: 5 }],
  [/tea stall/i, { skill: 'Thieving', level: 5 }],
  [/wine stall/i, { skill: 'Thieving', level: 22 }],
  [/(crafting|crossbow) stall/i, { skill: 'Thieving', level: 5 }],
  [/general stall|food stall|seed stall/i, { skill: 'Thieving', level: 5 }],
  [/\bstall\b/i, { skill: 'Thieving', level: 5 }], // generic market stall fallback

  // ── Runecrafting (altars / the Abyss rift) ──────────────────────────────
  [/blood altar/i, { skill: 'Runecraft', level: 77 }],
  [/soul altar/i, { skill: 'Runecraft', level: 90 }],
  [/(nature|law|death|astral|wrath|cosmic|chaos) altar/i, { skill: 'Runecraft', level: 1 }],
  [/mysterious ruins|rune(craft)? altar|\bthe rift\b/i, { skill: 'Runecraft', level: 1 }],

  // ── Hunter (named trap / tracking nodes) ────────────────────────────────
  [/bird snare|box trap|net trap|deadfall|magic box|impling/i, { skill: 'Hunter', level: 1 }],

  // ── Agility (rooftop courses & shortcuts; level is the course requirement) ─
  [/ardougne rooftop|ardougne agility/i, { skill: 'Agility', level: 90 }],
  [/rellekka rooftop/i, { skill: 'Agility', level: 80 }],
  [/seers'? rooftop|seers'? agility/i, { skill: 'Agility', level: 60 }],
  [/pollnivneach rooftop/i, { skill: 'Agility', level: 70 }],
  [/falador rooftop/i, { skill: 'Agility', level: 50 }],
  [/canifis rooftop/i, { skill: 'Agility', level: 40 }],
  [/varrock rooftop/i, { skill: 'Agility', level: 30 }],
  [/al kharid rooftop/i, { skill: 'Agility', level: 20 }],
  [/draynor rooftop/i, { skill: 'Agility', level: 10 }],
  [/gnome (stronghold )?agility|agility training area/i, { skill: 'Agility', level: 1 }],
];

// Transport / scenery nodes that contain a gatherable keyword but aren't one:
// spirit trees & magic mushtrees are travel nodes, not Woodcutting.
const NOT_A_RESOURCE = /spirit tree|mushtree/i;

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
