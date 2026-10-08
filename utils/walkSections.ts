/**
 * Where you can walk between chunks, from the Chunk Picker sections in
 * data/questWalkingGraph.json: each chunk split into the pieces of land you
 * can walk between, and which pieces of the next chunks each one joins.
 *
 * Two chunks side by side aren't always a walk apart: a river, a cliff or a
 * wall can stand between them, and a corner of one chunk can be cut off from
 * the rest of it. The Ruins of Uzer's north chunk touches the Haunted Mine's
 * with no way across, and the strip of Seers' Village beside the Warriors'
 * Guild leads nowhere else in Seers'.
 *
 * Walking runs both ways along a section link: the source records a few
 * drops only one way, and a route the app can't see should err toward
 * reachable.
 *
 * The sections load with the map's chunk content (ChunkContentService.init),
 * not with the app: they would double the entry chunk's budget. Until they
 * load, no chunk has sections and routes walk the chunk grid, as they did
 * before; everything that routes waits for the chunk content anyway.
 */

interface WalkingGraph {
  readonly nodes: Readonly<Record<string, { readonly chunk: string; readonly edges: readonly { readonly to: string }[] }>>;
}

const idOfKey = (key: string): string => {
  const [cx, cy] = key.split(',').map(Number);
  return String(cx * 256 + cy);
};

/** Each section's chunk, as a numeric id (cx * 256 + cy). */
const chunkOf = new Map<string, string>();
/** Each chunk's sections, by numeric chunk id. */
const sectionsOf = new Map<string, string[]>();
/** The sections each section walks to, both ways. */
const links = new Map<string, string[]>();
/**
 * Which landmass each section is on: the sections walking joins. The source
 * leaves out the ways that need a boat, a quest or a dungeon, so most
 * islands, and some places such as Morytania, are landmasses of their own.
 */
const landmassOf = new Map<string, number>();
/** The landmass Lumbridge is on: the mainland, which walking alone joins together. */
let mainland: number | undefined;

/** Reads the sections in, once. */
export function readWalkingGraph(graph: WalkingGraph): void {
  if (chunkOf.size) return;
  const { nodes } = graph;
  for (const [section, node] of Object.entries(nodes)) {
    const chunk = idOfKey(node.chunk);
    chunkOf.set(section, chunk);
    sectionsOf.set(chunk, [...(sectionsOf.get(chunk) ?? []), section]);
  }
  const both = new Map<string, Set<string>>();
  const join = (a: string, b: string) => {
    if (!both.has(a)) both.set(a, new Set());
    both.get(a)!.add(b);
  };
  for (const [section, node] of Object.entries(nodes)) {
    for (const { to } of node.edges) {
      if (!chunkOf.has(to)) continue;
      join(section, to);
      join(to, section);
    }
  }
  for (const [section, next] of both) links.set(section, [...next]);

  let next = 0;
  for (const start of chunkOf.keys()) {
    if (landmassOf.has(start)) continue;
    const mass = next++;
    landmassOf.set(start, mass);
    const stack = [start];
    while (stack.length) {
      for (const to of links.get(stack.pop()!) ?? []) {
        if (!landmassOf.has(to)) {
          landmassOf.set(to, mass);
          stack.push(to);
        }
      }
    }
  }
  mainland = landmassOf.get((sectionsOf.get(idOfKey('50,50')) ?? [])[0] ?? '');
}

let loading: Promise<void> | null = null;

/** Loads the sections, once; a failed load can be tried again. */
export const loadWalkSections = (): Promise<void> => (loading ??= import('../data/questWalkingGraph.json')
  .then(module => readWalkingGraph((module.default ?? module) as WalkingGraph))
  .catch(error => { loading = null; throw error; }));

/** The chunk's sections, or none when the source has no land there (the sea, or an unmapped chunk). */
export const chunkSections = (chunkId: string): readonly string[] => sectionsOf.get(chunkId) ?? [];

/** The section's chunk, as a numeric id. */
export const sectionChunk = (section: string): string => chunkOf.get(section)!;

/** The sections a section walks to. */
export const sectionLinks = (section: string): readonly string[] => links.get(section) ?? [];

/**
 * Whether stepping from a section to a section of the chunk next door counts
 * as a walk although the source joins them no way. Only onto another
 * landmass, and never onto the mainland: the source leaves out the boats,
 * bridges and quest crossings that reach islands and enclaves, which the
 * chunk grid used to stand in for, while every way onto the mainland it
 * knows is already a section link.
 */
export const gridStepAllowed = (from: string, to: string): boolean => {
  const target = landmassOf.get(to);
  return target !== landmassOf.get(from) && target !== mainland;
};
