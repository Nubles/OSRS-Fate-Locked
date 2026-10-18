/**
 * The walk behind reachability, and Chunked mode's frontier with it.
 *
 * From the home chunk, a route walks the parts of owned chunks the walking
 * data joins (utils/walkSections.ts), steps next door where that data knows
 * no land at all to stop it (an island or enclave of its own), and follows
 * the transport graph out of the chunks it reaches. utils/chunkReach.ts asks
 * it with the app's transport graph; Chunked mode's frontier
 * (utils/chunkAdjacency.ts) asks it with none, because transport opens no
 * new land there.
 *
 * Chunked mode adds three rules, and every other mode walks as before:
 * - Islands need Sailing. Before it, no step the walking data has no path
 *   for leads onto land only a boat reaches (data/seaAccess.ts).
 * - The sea is one sea. With Sailing and Pandemonium, a run that reaches any
 *   port or chunk next to the sea sails all of it, and lands on every port
 *   and chunk next to it. data/oceanChunks.json splits the water into six
 *   bodies, and most ports touch none of them.
 * - Routes pass only through owned chunks. A dungeon, cave or other place
 *   with no chunk to own joins two owned chunks it opens onto directly, but
 *   a route never goes on from it into another such place: the Lumbridge
 *   castle cellar no longer reaches the Kalphite Lair through the caves
 *   beneath land the run doesn't own.
 *
 * The frontier is the unowned land a reached part of an owned chunk walks
 * into from the chunk next door (or, with Sailing, sails to): never land
 * behind a wall, a river or a cliff, and never land next to owned chunks
 * nothing reaches.
 */
import { CHUNK_BOAT_LANDINGS } from '../data/chunkTransportLinks';
import { REGION_CHUNKS } from '../data/regionChunks';
import { ISLAND_AREAS, ISLAND_REGIONS, SAILING_PORT_CHUNKS } from '../data/seaAccess';
import { SUB_AREA_CHUNKS } from '../data/subAreaChunks';
import { OCEAN_CHUNK_KEYS } from './oceanAccess';
import { chunkSections, gridStepAllowed, sectionChunk, sectionLinks } from './walkSections';

type Coord = { cx: number; cy: number };

/** A chunk as the routes key it: cx * 256 + cy. */
export const chunkIdOf = (cx: number, cy: number): string => String(cx * 256 + cy);
const idOfKey = (key: string): string => {
  const [cx, cy] = key.split(',').map(Number);
  return chunkIdOf(cx, cy);
};
const decode = (id: string): [number, number] => { const n = +id; return [Math.floor(n / 256), n % 256]; };

const idsOf = (groups: Readonly<Record<string, readonly Coord[]>>, names?: readonly string[]): string[] =>
  (names ?? Object.keys(groups)).flatMap(name => (groups[name] ?? []).map(c => chunkIdOf(c.cx, c.cy)));

/** Every land chunk: the paid chunk pool. */
export const LAND_CHUNK_IDS: ReadonlySet<string> = new Set(idsOf(REGION_CHUNKS));
/** Every chunk a run can own, land or sea; anything else in the transport graph is a place with no chunk of its own. */
const OWNABLE_IDS: ReadonlySet<string> = new Set([
  ...LAND_CHUNK_IDS, ...idsOf(SUB_AREA_CHUNKS), ...[...OCEAN_CHUNK_KEYS].map(idOfKey),
]);
const OCEAN_IDS: readonly string[] = [...OCEAN_CHUNK_KEYS].map(idOfKey);
const OCEAN_ID_SET: ReadonlySet<string> = new Set(OCEAN_IDS);
/** Land only a boat or Sailing reaches. */
export const ISLAND_CHUNK_IDS: ReadonlySet<string> = new Set([
  ...idsOf(REGION_CHUNKS, ISLAND_REGIONS), ...idsOf(SUB_AREA_CHUNKS, ISLAND_AREAS),
].filter(id => LAND_CHUNK_IDS.has(id)));

const NEXT_DOOR = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
const nextDoor = (id: string): string[] => {
  const [cx, cy] = decode(id);
  return NEXT_DOOR.map(([dx, dy]) => chunkIdOf(cx + dx, cy + dy));
};
const besides = (a: string, b: string): boolean => {
  const [ax, ay] = decode(a); const [bx, by] = decode(b);
  return Math.abs(ax - bx) + Math.abs(ay - by) === 1;
};

/** Land you sail from and land on: every port, and every land chunk next to a chunk of open sea. */
export const SEA_LANDING_IDS: ReadonlySet<string> = new Set([
  ...SAILING_PORT_CHUNKS.map(idOfKey),
  ...[...LAND_CHUNK_IDS].filter(id => nextDoor(id).some(nb => OCEAN_ID_SET.has(nb))),
].filter(id => LAND_CHUNK_IDS.has(id)));

/** The reviewed boat landings beyond the sea chart, both ways. */
const BOAT_LANDINGS: readonly (readonly [string, string])[] = CHUNK_BOAT_LANDINGS
  .flatMap(({ from, to }) => [[idOfKey(from), idOfKey(to)] as const, [idOfKey(to), idOfKey(from)] as const]);

export interface WalkRules {
  /** Chunked mode's rules: islands need Sailing, one sea, routes only through owned chunks. */
  chunked: boolean;
  /** The run can sail: Sailing and Pandemonium. */
  sailing: boolean;
}

export interface WalkResult {
  /** Owned chunks a route reaches, as chunk ids. */
  reachable: Set<string>;
  /** Chunked mode: unowned land a reached chunk walks or sails into, as chunk ids. */
  frontier: Set<string>;
  /** Chunked mode with Sailing: a route reached the sea. */
  sea: boolean;
}

/**
 * Walks from `homeId` (which must be owned) through `owned`. `blocked` marks
 * chunks or places a route can't enter yet (a quest gate, a travel network
 * the run hasn't opened); the home chunk is never blocked.
 */
export function walkOwnedChunks(
  connect: Readonly<Record<string, readonly string[]>>,
  owned: ReadonlySet<string>,
  homeId: string,
  rules: WalkRules,
  blocked?: (id: string) => boolean,
): WalkResult {
  const { chunked } = rules;
  const sailing = chunked && rules.sailing;
  const reachable = new Set<string>();
  const frontier = new Set<string>();
  // Chunks (and the transport graph's named places) by id, and the parts of
  // chunks you can walk between by section id, each visited once.
  const visited = new Set<string>([homeId]);
  const queue: string[] = [homeId];
  const seenSection = new Set<string>();
  const sectionQueue: string[] = [];
  const visit = (id: string) => { if (!visited.has(id)) { visited.add(id); queue.push(id); } };
  const visitSection = (section: string) => {
    if (!seenSection.has(section)) { seenSection.add(section); sectionQueue.push(section); }
  };
  /** Arriving in a chunk by sea or boat reaches every part of it. */
  const enter = (id: string) => {
    const sections = chunkSections(id);
    if (sections.length) for (const section of sections) visitSection(section);
    else visit(id);
  };
  /** Before Sailing, Chunked mode keeps the walk off islands where no walking path leads. */
  const shut = (id: string) => chunked && !sailing && ISLAND_CHUNK_IDS.has(id);
  /** Unowned land next door joins the frontier. */
  const offer = (id: string) => { if (chunked && LAND_CHUNK_IDS.has(id) && !owned.has(id)) frontier.add(id); };
  // A chunk the source has no land for (the sea) is walked by the grid, as before.
  const ownedNextDoor = (id: string): string[] => nextDoor(id).filter(nb => owned.has(nb) && !shut(nb));

  let sea = false;
  const sail = () => {
    if (sea) return;
    sea = true;
    for (const id of OCEAN_IDS) if (owned.has(id)) visit(id);
    for (const id of SEA_LANDING_IDS) {
      if (owned.has(id)) enter(id);
      else offer(id);
    }
  };
  /** A land or sea chunk a route has reached: with Sailing, its coast puts to sea and its boats sail. */
  const reached = (id: string) => {
    if (reachable.has(id)) return;
    reachable.add(id);
    if (!sailing) return;
    if (SEA_LANDING_IDS.has(id) || OCEAN_ID_SET.has(id)) sail();
    for (const [from, to] of BOAT_LANDINGS) {
      if (from !== id) continue;
      if (owned.has(to)) enter(to);
      else offer(to);
    }
  };

  // Transport leaves from a reached chunk once.
  const departed = new Set<string>();
  const depart = (id: string) => {
    if (departed.has(id)) return;
    departed.add(id);
    for (const next of connect[id] ?? []) {
      if (!chunked || OWNABLE_IDS.has(next)) visit(next);
      // A place with no chunk of its own joins only the owned chunks it opens onto.
      else if (!blocked?.(next)) for (const far of connect[next] ?? []) if (OWNABLE_IDS.has(far)) visit(far);
    }
  };

  while (queue.length || sectionQueue.length) {
    if (queue.length) {
      const cur = queue.shift()!;
      // A quest-gated chunk you can't enter yet: not reachable, no routing through.
      if (cur !== homeId && blocked?.(cur)) continue;
      const isOwned = owned.has(cur);
      if (isOwned) {
        // Arriving in a chunk reaches every part of it.
        const sections = chunkSections(cur);
        if (sections.length) {
          for (const section of sections) visitSection(section);
          continue;
        }
        reached(cur);
        for (const nb of ownedNextDoor(cur)) enter(nb);
        if (!OCEAN_ID_SET.has(cur)) for (const nb of nextDoor(cur)) if (!shut(nb)) offer(nb);
      }
      // Transport: follow Connect from an owned chunk, or pass through a
      // non-ownable connector node (ocean/dungeon) to reach the far side.
      const isConnector = !OWNABLE_IDS.has(cur);
      if (isOwned || isConnector) depart(cur);
      continue;
    }

    const section = sectionQueue.shift()!;
    const chunk = sectionChunk(section);
    if (chunk !== homeId && blocked?.(chunk)) continue;
    reached(chunk);
    // Walk: to the parts of owned chunks this part joins, and into the land next door.
    for (const next of sectionLinks(section)) {
      const nextChunk = sectionChunk(next);
      if (owned.has(nextChunk)) visitSection(next);
      else if (besides(chunk, nextChunk)) offer(nextChunk);
    }
    // Next door with no link: only onto land the source can't walk to at all
    // (an island or an enclave), or the sea.
    for (const nb of nextDoor(chunk)) {
      if (shut(nb)) continue;
      const sections = chunkSections(nb);
      if (owned.has(nb)) {
        if (!sections.length) visit(nb);
        else for (const next of sections) if (gridStepAllowed(section, next)) visitSection(next);
      } else if (!sections.length || sections.some(next => gridStepAllowed(section, next))) offer(nb);
    }
    depart(chunk);
  }

  return { reachable, frontier, sea };
}
