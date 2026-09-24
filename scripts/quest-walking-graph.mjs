import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { readPinnedChunkSource } from './chunk-source.mjs';
import { generatedTextMatches } from './generated-text.mjs';

export const QUEST_WALKING_GRAPH_URL = new URL('../data/questWalkingGraph.json', import.meta.url);
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const entries = value => Object.entries(value ?? {}).sort(([a], [b]) => compare(a, b));
const unique = values => [...new Set(values)].sort(compare);
const canonical = value => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === 'object'
    ? Object.fromEntries(entries(value).map(([key, child]) => [key, canonical(child)])) : value;
const unsupported = value => `UNSUPPORTED_SOURCE_REQUIREMENT:${JSON.stringify(canonical(value))}`;

// Chunk Picker records the border but omits its toll in sectionsLimits.
// The Wiki confirms the same 10-coin charge in either direction until rescue.
const reviewedEdgeRequirements = [{
  edges: ['12850-1 to 13106-1', '13106-1 to 12850-1'],
  requirement: 'Al Kharid gate: 10 coins unless Prince Ali Rescue is complete',
  url: 'https://oldschool.runescape.wiki/w/Lumbridge',
}];

const nodeRequirements = value => {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return [unsupported(value)];
  return unique(value.map(requirement => typeof requirement === 'string' && requirement.trim()
    ? requirement : unsupported(requirement)));
};

/** Retain unfamiliar requirements as opaque blockers; never silently open an edge. */
const edgeRequirements = value => {
  if (value === undefined) return [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [unsupported(value)];
  const requirements = [];
  for (const [field, content] of entries(value)) {
    if (field !== 'Tasks' || !content || typeof content !== 'object' || Array.isArray(content)) {
      requirements.push(unsupported({ [field]: content }));
      continue;
    }
    for (const [task, category] of entries(content)) {
      requirements.push(category === 'Quest' && task.trim() ? task : unsupported({ Tasks: { [task]: category } }));
    }
  }
  return unique(requirements);
};

/**
 * Source sections are connected pieces of a region, not floors. Section zero
 * uses the bare region ID. Ordinary walking excludes W sections, ocean chunks,
 * unresolved references and transport Connect records. Direction is preserved.
 */
export function buildQuestWalkingGraph(data, manifest) {
  if (!data.sections || !data.chunks || !Array.isArray(data.walkableChunks)) {
    throw new Error('Walking graph source is missing sections, chunks or walkableChunks');
  }
  const walkable = new Set(data.walkableChunks.map(String));
  const nodes = {};
  const outgoing = new Map();
  for (const [regionId, sections] of entries(data.sections)) {
    const region = Number(regionId);
    const name = data.chunks[regionId]?.Nickname ?? data.chunks[regionId]?.Name;
    if (!/^\d+$/.test(regionId) || !Number.isSafeInteger(region) || region < 0 || region > 65535
      || !walkable.has(regionId) || !name || name === 'Ocean Chunk') continue;
    for (const [section, destinations] of entries(sections)) {
      if (!/^\d+$/.test(section)) continue;
      if (!Array.isArray(destinations) || destinations.some(to => typeof to !== 'string')) {
        throw new Error(`Invalid walking destinations for ${regionId}-${section}`);
      }
      const id = section === '0' ? regionId : `${regionId}-${section}`;
      nodes[id] = {
        chunk: `${Math.floor(region / 256)},${region % 256}`,
        requirements: unique([
          ...nodeRequirements(data.questSections?.[regionId]),
          ...(id === regionId ? [] : nodeRequirements(data.questSections?.[id])),
        ]),
        edges: [],
      };
      outgoing.set(id, destinations);
    }
  }
  for (const [from, destinations] of outgoing) {
    nodes[from].edges = unique(destinations).filter(to => Object.hasOwn(nodes, to)).map(to => ({
      to,
      requirements: unique([
        ...edgeRequirements(data.sectionsLimits?.[`${from} to ${to}`]),
        ...reviewedEdgeRequirements.filter(review => review.edges.includes(`${from} to ${to}`))
          .map(review => review.requirement),
      ]),
    }));
  }
  return {
    source: {
      repository: manifest.repository,
      commit: manifest.commit,
      rawSha256: manifest.rawSha256,
      url: manifest.sourceUrl,
      method: 'Directed land sections; exact section and edge requirements; no inferred adjacency or transport links',
      reviewedEdgeRequirements,
    },
    nodes: Object.fromEntries(entries(nodes)),
  };
}

/** Compact, one row per section, with stable key and edge ordering. */
export function serializeQuestWalkingGraph(graph) {
  return `{"source":${JSON.stringify(graph.source)},"nodes":{\n${entries(graph.nodes)
    .map(([id, node]) => `${JSON.stringify(id)}:${JSON.stringify(node)}`).join(',\n')}\n}}\n`;
}

export async function syncQuestWalkingGraph({ check = false, outputUrl = QUEST_WALKING_GRAPH_URL } = {}) {
  const { data, manifest } = await readPinnedChunkSource();
  const graph = buildQuestWalkingGraph(data, manifest);
  const generated = serializeQuestWalkingGraph(graph);
  if (check) {
    if (!generatedTextMatches(await readFile(outputUrl, 'utf8'), generated)) {
      throw new Error('Quest walking graph is stale; regenerate and review the source changes');
    }
  } else await writeFile(outputUrl, generated);
  return graph;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const graph = await syncQuestWalkingGraph({ check: process.argv.includes('--check') });
  console.log(`Quest walking graph ${process.argv.includes('--check') ? 'verified' : 'generated'}: ${Object.keys(graph.nodes).length} land sections; ${Object.values(graph.nodes).reduce((sum, node) => sum + node.edges.length, 0)} directed edges.`);
}
