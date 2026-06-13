/**
 * Gatherable-resource gating for the chunk activity panel.
 *
 * A chunk's `objects` list mixes inert scenery (banks, anvils, altars) with
 * real gathering nodes — trees, ore rocks, fishing spots. This module pulls the
 * gatherables out and tags each with the Skill + level needed to harvest it, so
 * the panel can show them green (can gather now) or red/struck-through (locked),
 * exactly the way shops gate on a merchant category and monsters on Slayer.
 *
 * A node is usable when the run has BOTH purchased the skill's tier upgrade
 * (`skills[skill] > 0`) AND reached the required level (`levels[skill] >= req`)
 * — the same two-part test journalStatus/goalLogic use for quests and tasks.
 *
 * Facts (which node needs which level) are standard OSRS skilling requirements,
 * re-expressed here; the node *names* come from our own chunk-content dataset.
 */
import type { UnlockState } from '../types';

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

/** Has the run bought the skill's tier AND reached the required level? */
export const resourceUsable = (req: ResourceReq, unlocks: UnlockState): boolean => {
  const tierBought = (unlocks.skills?.[req.skill] ?? 0) > 0;
  const level = unlocks.levels?.[req.skill] ?? 1;
  return tierBought && level >= req.level;
};
