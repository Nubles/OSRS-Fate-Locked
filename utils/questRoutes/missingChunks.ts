import type { ChunkKey, ItemRoute, RouteGate } from './model';

export interface MissingChunkOption {
  chunks: ChunkKey[];
  routeIds: string[];
  remainingGates: RouteGate[];
}

interface MissingChunkCandidate extends MissingChunkOption {
  gateKeys: string[];
  hasDataGap: boolean;
}

const compareChunkKeys = (left: ChunkKey, right: ChunkKey): number => {
  const [leftX, leftY] = left.split(',').map(Number);
  const [rightX, rightY] = right.split(',').map(Number);
  return leftX - rightX || leftY - rightY;
};

const gateKey = (gate: RouteGate): string => {
  switch (gate.type) {
    case 'QUEST': return `QUEST:${gate.questId}`;
    case 'SKILL': return `SKILL:${gate.semantics ?? 'method'}:${gate.skill}:${gate.level}`;
    case 'UNLOCK': return `UNLOCK:${gate.category}:${gate.id}`;
    case 'UNRESOLVED': return `UNRESOLVED:${gate.raw}`;
  }
};

const gateSortKey = (gate: RouteGate): string => `${gateKey(gate)}\0${gate.label}`;
const compareCodeUnitStrings = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const canonicalGates = (gates: readonly RouteGate[]): RouteGate[] => gates
  .map(gate => ({ ...gate }))
  .sort((left, right) => compareCodeUnitStrings(gateSortKey(left), gateSortKey(right)))
  .filter((gate, index, sorted) => index === 0 || gateKey(sorted[index - 1]) !== gateKey(gate));
const isSubset = (left: readonly string[], right: readonly string[]): boolean =>
  left.every(value => right.includes(value));
const dominates = (left: MissingChunkCandidate, right: MissingChunkCandidate): boolean => (
  isSubset(left.chunks, right.chunks)
  && isSubset(left.gateKeys, right.gateKeys)
  && (!left.hasDataGap || right.hasDataGap)
  && (left.chunks.length < right.chunks.length
    || left.gateKeys.length < right.gateKeys.length
    || (!left.hasDataGap && right.hasDataGap))
);

/** Converts inaccessible route evidence into minimal, immutable advisory sets. */
export const minimalMissingChunkOptions = (
  routes: readonly ItemRoute[],
  unlocked: ReadonlySet<ChunkKey>,
): MissingChunkOption[] => {
  const byProof = new Map<string, MissingChunkCandidate>();

  for (const route of routes) {
    const chunks = [...new Set(route.chunks.filter(chunk => !unlocked.has(chunk)))].sort(compareChunkKeys);
    if (chunks.length === 0) continue;

    const gateKeys = canonicalGates(route.blockers).map(gateKey);
    const key = JSON.stringify([chunks, route.hasDataGap, gateKeys]);
    const option = byProof.get(key) ?? {
      chunks,
      routeIds: [],
      remainingGates: [],
      gateKeys,
      hasDataGap: route.hasDataGap,
    };
    if (!byProof.has(key)) byProof.set(key, option);
    option.routeIds.push(route.id);
    option.remainingGates.push(...route.blockers.map(gate => ({ ...gate })));
  }

  const candidates = [...byProof.values()];
  const options = candidates
    .filter(option => !candidates.some(candidate => candidate !== option && dominates(candidate, option)))
    .map(option => ({
      chunks: [...option.chunks],
      routeIds: [...option.routeIds].sort((left, right) => left.localeCompare(right)),
      remainingGates: canonicalGates(option.remainingGates),
    }));

  return options.sort((left, right) =>
    left.chunks.length - right.chunks.length
    || left.chunks.reduce((order, chunk, index) => order || compareChunkKeys(chunk, right.chunks[index]), 0)
    || left.routeIds.join('|').localeCompare(right.routeIds.join('|')));
};
