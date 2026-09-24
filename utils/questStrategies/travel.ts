import walkingData from '../../data/questWalkingGraph.json';
import { questGuideTravelFor } from '../../data/questGuideTravel';
import type { QuestRouteAnalysisSnapshot } from '../questRoutes/analyzeQuest';
import { compileRawRequirements, evaluateRouteGates } from '../questRoutes/accountRequirements';
import type { ChunkKey } from '../questRoutes/model';

export interface QuestWalkingGraph {
  readonly nodes: Readonly<Record<string, {
    readonly chunk: string;
    readonly requirements: readonly string[];
    readonly edges: readonly { readonly to: string; readonly requirements: readonly string[] }[];
  }>>;
}

export type GuideTravelAccount = Pick<QuestRouteAnalysisSnapshot, 'unlockedChunks' | 'unlocks'>;
export interface GuideTravelLeg {
  readonly status: 'START' | 'AVAILABLE' | 'NEEDS_CHUNKS' | 'NEEDS_REQUIREMENTS' | 'UNRESOLVED';
  readonly chunks: readonly ChunkKey[];
  readonly missingChunks: readonly ChunkKey[];
  readonly requirements: readonly string[];
  readonly explanation?: string;
  readonly fromStep?: number;
  readonly entranceNote?: string;
}

type TravelAction = {
  readonly id: string;
  readonly mapChunks: readonly ChunkKey[];
  readonly usesAlternative?: boolean;
};

/** Directed walking paths only: never infer a crossing from adjacent chunk coordinates. */
export function walkingRoute(
  from: string,
  to: string,
  account: GuideTravelAccount,
  graph: QuestWalkingGraph = walkingData,
): GuideTravelLeg {
  const owned = new Set<string>(account.unlockedChunks);
  const nodes = graph.nodes;
  const gates = new Map<string, ReturnType<typeof evaluateRouteGates>>();
  const evaluate = (requirements: readonly string[]) => {
    const key = JSON.stringify(requirements);
    let result = gates.get(key);
    if (!result) {
      // The reviewed toll override is waived by quest completion. Coin possession
      // and per-crossing consumption are not inferred from chunk ownership.
      const active = requirements.filter(raw => raw !== 'Al Kharid gate: 10 coins unless Prince Ali Rescue is complete'
        || !account.unlocks.quests.includes('Prince Ali Rescue'));
      result = evaluateRouteGates(compileRawRequirements(active.map(raw => ({ raw, origin: 'CHUNK_ENTRY' }))), account.unlocks);
      gates.set(key, result);
    }
    return result;
  };
  const unresolved = (explanation: string): GuideTravelLeg => ({
    status: 'UNRESOLVED', chunks: [], missingChunks: [], requirements: [], explanation,
  });
  if (!nodes[from] || !nodes[to]) return unresolved('A walking connection for this step location is missing from the source.');

  const search = (requireOwned: boolean, requireGates: boolean): string[] | undefined => {
    const nodeAllowed = (id: string) => Boolean(nodes[id])
      && (!requireOwned || owned.has(nodes[id].chunk))
      && (!requireGates || evaluate(nodes[id].requirements).blockers.length === 0);
    if (!nodeAllowed(from) || !nodeAllowed(to)) return undefined;
    const parent = new Map<string, string | null>([[from, null]]);
    const queue = [from];
    for (let index = 0; index < queue.length; index++) {
      const current = queue[index];
      if (current === to) {
        const path: string[] = [];
        for (let id: string | null = to; id !== null; id = parent.get(id)!) path.push(id);
        return path.reverse();
      }
      for (const edge of nodes[current].edges) {
        if (parent.has(edge.to) || !nodeAllowed(edge.to)) continue;
        if (requireGates && evaluate(edge.requirements).blockers.length) continue;
        parent.set(edge.to, current);
        queue.push(edge.to);
      }
    }
    return undefined;
  };

  // Prefer any currently usable detour over a shorter route through locked chunks.
  const available = search(true, true);
  const path = available ?? search(true, false) ?? search(false, true) ?? search(false, false);
  if (!path) return unresolved('No walking connection is recorded between these two step locations.');
  const chunks = path.map(id => nodes[id].chunk as ChunkKey)
    .filter((chunk, index, all) => index === 0 || all[index - 1] !== chunk);
  const missingChunks = [...new Set(chunks.filter(chunk => !owned.has(chunk)))];
  const evaluations = path.flatMap((id, index) => [
    evaluate(nodes[id].requirements),
    ...(index > 0 ? [evaluate(nodes[path[index - 1]].edges.find(edge => edge.to === id)!.requirements)] : []),
  ]);
  const requirements = [...new Set(evaluations.flatMap(result => result.blockers.map(gate => gate.label)))];
  return {
    status: available ? 'AVAILABLE'
      : evaluations.some(result => result.hasDataGap) ? 'UNRESOLVED'
        : requirements.length ? 'NEEDS_REQUIREMENTS' : 'NEEDS_CHUNKS',
    chunks, missingChunks, requirements,
    ...(evaluations.some(result => result.hasDataGap) ? { explanation: 'This walking route needs confirmation of the conditions below.' } : {}),
  };
}

/** Account routes between authored guide steps, not a claim about the player's live position. */
export function guideTravelFor(
  questId: string,
  revision: string,
  actions: readonly TravelAction[],
  account: GuideTravelAccount,
): readonly GuideTravelLeg[] {
  const guide = questGuideTravelFor(questId, revision);
  const endpoint = (action: TravelAction | undefined) => {
    if (!action || action.usesAlternative) return undefined;
    const reviewed = guide?.steps[action.id];
    if (!reviewed || !action.mapChunks.includes(walkingData.nodes[reviewed.section]?.chunk as ChunkKey)) return undefined;
    return reviewed;
  };
  return actions.map((action, index) => {
    const current = endpoint(action);
    const previous = endpoint(actions[index - 1]);
    const scope = { ...(index > 0 ? { fromStep: index } : {}), entranceNote: current?.note };
    if (!current || (index > 0 && !previous)) return {
      ...scope, status: 'UNRESOLVED', chunks: [], missingChunks: [], requirements: [],
      explanation: action.usesAlternative || actions[index - 1]?.usesAlternative
        ? 'The alternative item source has no reviewed walking connection to this guide yet.'
        : 'The walking section for this step has not been reviewed.',
    };
    const leg = walkingRoute(previous?.section ?? current.section, current.section, account);
    return { ...leg, ...scope, status: index === 0 && leg.status === 'AVAILABLE' ? 'START' : leg.status };
  });
}
