/**
 * Chunk-grounded view of a skill's trainable content for the Map Gathering tab.
 *
 * Scans the whole chunk dataset — objects, NPCs and monsters — and classifies
 * each entity to a skill + level, so the tab can show *everywhere* you can
 * train a skill on the map:
 *   • objects  → resourceReqFor (trees, ores, fishing spots, RC altars, stalls,
 *     rooftop courses) + farming patches
 *   • NPCs/monsters → curated Hunter-creature and Thieving-pickpocket tables
 *     with wiki-verified levels (these never appear as objects)
 *
 * Levels are grouped by the tier that unlocks them (cap model), matching the
 * resource gate. Names come from our own chunk-content dataset.
 */
import { chunkContentService, EntityKind } from '../services/ChunkContentService';
import { resourceReqFor } from './chunkResources';
import { tierForLevel } from './skillTiers';

export interface SkillChunkNode {
  name: string;
  level: number;
  tier: number;
  chunks: number;
  kind: EntityKind;
}

interface Req { skill: string; level: number }

// Farming patches — usable from low levels (the crop sets the real level), so
// they're surfaced at level 1. Excludes look-alikes like "Patched Wall".
const FARMING_PATCH = /\b(allotment|herb|flower|hops|bush|tree|fruit tree|hardwood|cactus|mushroom|belladonna|seaweed|calquat|spirit tree|celastrus|redwood|hespori|anima|vine|grapevine|vinery)\b.*patch|^bush$|grapevine|giant seaweed/i;
const NOT_PATCH = /wall|barren|dry patch|mud patch|muddy|soil patch|firm snow|weedy|new farming/i;

// Entities that trip the keyword rules but aren't real gathering targets:
// combat/utility look-alikes (a "Butterfly ray" is a fish; a "Guard dog" is a
// dog; combat gnomes/elves aren't pickpocketable; named combat warriors aren't
// the Al Kharid thieving warrior).
const NOT_NODE = /butterfly ray|guard dog|guard captain|\bgnome (archer|mage|troop|driver|guard|banker|coach|trainer|child)|mounted|terrorbird|elder gnome|woman-at-arms|corrupted warrior|tutor|salesman|saleswoman|shopkeeper|barman|bartender|referee|wise old man|odd old man|strange old man|weird old man|mysterious old man|doorman|tracker gnome/i;

// Ordered curated NPC/monster rules (Hunter first so e.g. "Snowy knight" — a
// butterfly — isn't mistaken for a Thieving "knight"). First match wins.
const NPC_RULES: [RegExp, Req][] = [
  // ── Hunter: birds ──
  [/crimson swift/i, { skill: 'Hunter', level: 1 }],
  [/golden warbler/i, { skill: 'Hunter', level: 5 }],
  [/copper longtail/i, { skill: 'Hunter', level: 9 }],
  [/cerulean twitch/i, { skill: 'Hunter', level: 11 }],
  [/tropical wagtail/i, { skill: 'Hunter', level: 19 }],
  // ── Hunter: butterflies / moths ──
  [/ruby harvest/i, { skill: 'Hunter', level: 15 }],
  [/sapphire glacialis/i, { skill: 'Hunter', level: 25 }],
  [/snowy knight/i, { skill: 'Hunter', level: 35 }],
  [/black warlock/i, { skill: 'Hunter', level: 45 }],
  [/sunlight moth/i, { skill: 'Hunter', level: 65 }],
  [/moonlight moth/i, { skill: 'Hunter', level: 75 }],
  [/\bbutterfly\b/i, { skill: 'Hunter', level: 15 }],
  // ── Hunter: kebbits ──
  [/common kebbit/i, { skill: 'Hunter', level: 3 }],
  [/feldip weasel/i, { skill: 'Hunter', level: 7 }],
  [/wild kebbit/i, { skill: 'Hunter', level: 23 }],
  [/barb-tailed kebbit/i, { skill: 'Hunter', level: 33 }],
  [/prickly kebbit/i, { skill: 'Hunter', level: 37 }],
  [/spotted kebbit/i, { skill: 'Hunter', level: 43 }],
  [/razor-backed kebbit/i, { skill: 'Hunter', level: 49 }],
  [/sabre-toothed kebbit/i, { skill: 'Hunter', level: 51 }],
  [/dark kebbit/i, { skill: 'Hunter', level: 57 }],
  [/dashing kebbit/i, { skill: 'Hunter', level: 69 }],
  // ── Hunter: salamanders / lizards ──
  [/swamp lizard/i, { skill: 'Hunter', level: 29 }],
  [/orange salamander/i, { skill: 'Hunter', level: 47 }],
  [/red salamander/i, { skill: 'Hunter', level: 59 }],
  [/black salamander/i, { skill: 'Hunter', level: 67 }],
  [/tecu salamander/i, { skill: 'Hunter', level: 79 }],
  // ── Hunter: beasts ──
  [/spined larupia/i, { skill: 'Hunter', level: 31 }],
  [/embertailed jerboa/i, { skill: 'Hunter', level: 39 }],
  [/horned graahk/i, { skill: 'Hunter', level: 41 }],
  [/sabre-toothed kyatt/i, { skill: 'Hunter', level: 55 }],
  [/sunlight antelope/i, { skill: 'Hunter', level: 72 }],
  [/moonlight antelope/i, { skill: 'Hunter', level: 91 }],
  // ── Hunter: chinchompas ──
  [/black chinchompa/i, { skill: 'Hunter', level: 73 }],
  [/carnivorous chinchompa|red chinchompa/i, { skill: 'Hunter', level: 63 }],
  [/chinchompa/i, { skill: 'Hunter', level: 53 }],
  // ── Hunter: crabs / other ──
  [/red crab \(hunter\)/i, { skill: 'Hunter', level: 21 }],
  [/blue crab \(hunter\)/i, { skill: 'Hunter', level: 48 }],
  [/rainbow crab \(hunter\)/i, { skill: 'Hunter', level: 77 }],
  [/herbiboar/i, { skill: 'Hunter', level: 80 }],
  [/\bferret\b/i, { skill: 'Hunter', level: 27 }],
  [/\bimpling\b/i, { skill: 'Hunter', level: 17 }],

  // ── Thieving: pickpocket targets (wiki levels) ──
  [/master farmer|chief farmer|martin the master/i, { skill: 'Thieving', level: 38 }],
  [/^farmer\b|farmer \(|fred the farmer|farmer (brumty|fromund|gricoller|hayfield)/i, { skill: 'Thieving', level: 10 }],
  [/h\.?a\.?m\.? member/i, { skill: 'Thieving', level: 15 }],
  [/^rogue\b/i, { skill: 'Thieving', level: 32 }],
  [/cave goblin/i, { skill: 'Thieving', level: 36 }],
  [/wealthy citizen|fremennik citizen/i, { skill: 'Thieving', level: 45 }],
  [/desert bandit|^bandit$|^bandit \(/i, { skill: 'Thieving', level: 53 }],
  [/menaphite (thug|guard)/i, { skill: 'Thieving', level: 65 }],
  // Only the canonical pickpocket knights (generic "Knight" = Black/White
  // Knights, not pickpocketable).
  [/knight of ardougne|knight of varlamore/i, { skill: 'Thieving', level: 55 }],
  [/^paladin/i, { skill: 'Thieving', level: 70 }],
  [/tzhaar-hur/i, { skill: 'Thieving', level: 90 }],
  [/vyre(lord|lady|watch)|vyrewatch/i, { skill: 'Thieving', level: 82 }],
  [/^hero\b/i, { skill: 'Thieving', level: 80 }],
  [/\bgnome\b/i, { skill: 'Thieving', level: 75 }],
  // Only the explicitly thieving-tagged Al Kharid warrior (other "Warrior (…)"
  // are combat NPCs).
  [/warrior \(thieving\)|^warrior \(al kharid\)/i, { skill: 'Thieving', level: 25 }],
  [/^guard\b|guard \(|town guard|bank guard|jail guard|menaphite guard/i, { skill: 'Thieving', level: 40 }],
  [/^(wo)?man\b|^man \(|poor looking (man|woman)|well-dressed man/i, { skill: 'Thieving', level: 1 }],
];

const npcReq = (name: string): Req | null => {
  if (NOT_NODE.test(name)) return null;
  for (const [re, req] of NPC_RULES) if (re.test(name)) return req;
  return null;
};

// Agility rooftop-course obstacles (named by their course location, so the
// level is the course requirement). Generic shortcuts aren't included — their
// requirements vary widely and aren't derivable from the chunk name.
const AGILITY_OBJ: [RegExp, number][] = [
  [/ardougne rooftop/i, 90], [/rellekka rooftop/i, 80], [/pollnivneach rooftop/i, 70],
  [/seers.{0,3}rooftop/i, 60], [/falador rooftop/i, 50], [/canifis rooftop/i, 40],
  [/varrock rooftop/i, 30], [/al kharid rooftop/i, 20], [/draynor.{0,12}rooftop/i, 1],
];

const reqFor = (name: string, kind: EntityKind): Req | null => {
  if (kind === 'object') {
    const r = resourceReqFor(name);
    if (r) return r;
    if (FARMING_PATCH.test(name) && !NOT_PATCH.test(name)) return { skill: 'Farming', level: 1 };
    for (const [re, level] of AGILITY_OBJ) if (re.test(name)) return { skill: 'Agility', level };
    return null;
  }
  return npcReq(name); // npc | monster
};

/** Gatherable/trainable nodes for `skill` present in the chunk data, by level. */
export const skillChunkNodes = (skill: string): SkillChunkNode[] => {
  if (!chunkContentService.ready) return [];
  const seen = new Set<string>();
  const out: SkillChunkNode[] = [];
  for (const kind of ['object', 'npc', 'monster'] as EntityKind[]) {
    for (const hit of chunkContentService.entitiesOfKind(kind)) {
      const req = reqFor(hit.name, kind);
      if (!req || req.skill !== skill) continue;
      const key = hit.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ name: hit.name, level: req.level, tier: tierForLevel(req.level), chunks: hit.locations.length, kind });
    }
  }
  return out.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
};

/** Same nodes grouped by the tier that unlocks them (1..10). */
export const skillChunkNodesByTier = (skill: string): Record<number, SkillChunkNode[]> => {
  const grouped: Record<number, SkillChunkNode[]> = {};
  for (const node of skillChunkNodes(skill)) (grouped[node.tier] ??= []).push(node);
  return grouped;
};
