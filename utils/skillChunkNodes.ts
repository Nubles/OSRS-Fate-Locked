/**
 * Chunk-grounded view of a skill's gatherable nodes.
 *
 * Bridges the progression tab to real map content: for a given skill, finds
 * every gathering node that actually exists in the chunk dataset (trees, ores,
 * fishing spots, stalls, altars…), tags it with the level it needs and the tier
 * that unlocks it (cap model), and counts how many chunks contain it. So the
 * Woodcutting tab can show "Yew tree — level 60, tier 6, in N chunks" sourced
 * from the same data the world map uses.
 */
import { chunkContentService } from '../services/ChunkContentService';
import { resourceReqFor } from './chunkResources';
import { tierForLevel } from './skillTiers';

export interface SkillChunkNode {
  name: string;
  level: number;
  tier: number;
  /** How many map chunks contain this node. */
  chunks: number;
}

/** Gatherable nodes for `skill` present in the chunk data, sorted by level. */
export const skillChunkNodes = (skill: string): SkillChunkNode[] => {
  if (!chunkContentService.ready) return [];
  const seen = new Set<string>();
  const out: SkillChunkNode[] = [];
  for (const hit of chunkContentService.entitiesOfKind('object')) {
    const req = resourceReqFor(hit.name);
    if (!req || req.skill !== skill) continue;
    const key = hit.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name: hit.name, level: req.level, tier: tierForLevel(req.level), chunks: hit.locations.length });
  }
  return out.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
};

/** Same nodes grouped by the tier that unlocks them (1..10). */
export const skillChunkNodesByTier = (skill: string): Record<number, SkillChunkNode[]> => {
  const grouped: Record<number, SkillChunkNode[]> = {};
  for (const node of skillChunkNodes(skill)) (grouped[node.tier] ??= []).push(node);
  return grouped;
};
