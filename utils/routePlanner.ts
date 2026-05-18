/**
 * Route Planner Prototype — "What Should I Do Next?"
 *
 * Builds a dependency graph from all incomplete content (quests, diaries, strategy
 * entries) and runs a priority-weighted topological sort to produce a recommended
 * unlock path based on the player's current state.
 *
 * The output is an ordered list of "steps" where each step either:
 *   - Unlocks a region (costs Keys in the gacha system)
 *   - Unlocks a skill (costs Keys)
 *   - Levels a skill to a target level
 *   - Completes a quest (requires its own prereqs to already be done)
 *   - Completes a diary tier
 *   - Unlocks a boss / minigame / other content
 *
 * The algorithm favours steps that unblock the most downstream content ("value"),
 * weighted against their estimated effort ("cost"), producing an efficient path
 * through the dependency DAG.
 */

import { QUEST_DATA, QuestData } from '../data/questData';
import { DIARY_DATA, DiaryTier } from '../data/diaryData';
import { STRATEGY_DATABASE, ContentRequirement } from '../data/requirements';
import { TableType, UnlockState } from '../types';
import { MISTHALIN_AREAS, REGION_GROUPS } from '../constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StepKind =
  | 'UNLOCK_REGION'
  | 'UNLOCK_SKILL'
  | 'LEVEL_SKILL'
  | 'COMPLETE_QUEST'
  | 'COMPLETE_DIARY'
  | 'UNLOCK_CONTENT';  // boss, minigame, guild, etc.

export interface PlanStep {
  kind: StepKind;
  id: string;             // Unique identifier (region name, skill name, quest name, etc.)
  label: string;          // Human-readable description
  reason: string;         // Why this step matters ("Unlocks 4 quests, 2 diaries")
  effort: number;         // Abstract cost units (higher = harder)
  value: number;          // How much downstream content this unblocks
  unblocks: string[];     // IDs of content directly unblocked by this step
}

export interface RoutePlan {
  steps: PlanStep[];
  totalEffort: number;
  contentUnlocked: number; // Total pieces of content the full plan reaches
}

// ---------------------------------------------------------------------------
// Internal graph node
// ---------------------------------------------------------------------------

interface GraphNode {
  id: string;
  kind: StepKind;
  label: string;
  effort: number;
  /** IDs of nodes that must be completed before this one */
  dependencies: Set<string>;
  /** IDs of content entries this node helps unblock */
  enables: Set<string>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const hasRegion = (unlocks: UnlockState, region: string): boolean => {
  if (region === 'Misthalin' || MISTHALIN_AREAS.includes(region)) return true;
  if (unlocks.regions.includes(region)) return true;
  if (REGION_GROUPS[region]) {
    return REGION_GROUPS[region].some((child: string) => unlocks.regions.includes(child));
  }
  return false;
};

const hasSkillUnlocked = (unlocks: UnlockState, skill: string): boolean => {
  return (unlocks.skills[skill] || 0) > 0;
};

const getLevel = (unlocks: UnlockState, skill: string): number => {
  return unlocks.levels[skill] || 1;
};

const hasQuest = (unlocks: UnlockState, quest: string): boolean => {
  return unlocks.quests.includes(quest);
};

/** Stable node ID generators */
const regionNodeId = (r: string) => `region:${r}`;
const skillUnlockNodeId = (s: string) => `skill-unlock:${s}`;
const skillLevelNodeId = (s: string, lv: number) => `skill-level:${s}:${lv}`;
const questNodeId = (q: string) => `quest:${q}`;
const diaryNodeId = (d: string) => `diary:${d}`;
const contentNodeId = (c: string) => `content:${c}`;

// ---------------------------------------------------------------------------
// Graph construction
// ---------------------------------------------------------------------------

/**
 * Build the full dependency graph from all incomplete content relative to
 * the player's current unlock state.
 */
const buildGraph = (unlocks: UnlockState): Map<string, GraphNode> => {
  const nodes = new Map<string, GraphNode>();

  const getOrCreate = (id: string, kind: StepKind, label: string, effort: number): GraphNode => {
    if (!nodes.has(id)) {
      nodes.set(id, { id, kind, label, effort, dependencies: new Set(), enables: new Set() });
    }
    return nodes.get(id)!;
  };

  // Helper: ensure region node exists if player doesn't have it
  const ensureRegion = (region: string): string | null => {
    if (hasRegion(unlocks, region)) return null; // already have it
    const nid = regionNodeId(region);
    getOrCreate(nid, 'UNLOCK_REGION', `Unlock region: ${region}`, 80);
    return nid;
  };

  // Helper: ensure skill unlock + level nodes exist
  const ensureSkill = (skill: string, requiredLevel: number): string[] => {
    const depIds: string[] = [];

    // Skill unlock node (if not unlocked)
    if (!hasSkillUnlocked(unlocks, skill)) {
      const uid = skillUnlockNodeId(skill);
      getOrCreate(uid, 'UNLOCK_SKILL', `Unlock skill: ${skill}`, 30);
      depIds.push(uid);
    }

    // Level node (if current level < required)
    const current = getLevel(unlocks, skill);
    if (current < requiredLevel) {
      const lid = skillLevelNodeId(skill, requiredLevel);
      const levelsNeeded = requiredLevel - current;
      getOrCreate(lid, 'LEVEL_SKILL', `Train ${skill} to ${requiredLevel}`, levelsNeeded * 2);
      // Leveling depends on having the skill unlocked
      if (!hasSkillUnlocked(unlocks, skill)) {
        nodes.get(lid)!.dependencies.add(skillUnlockNodeId(skill));
      }
      depIds.push(lid);
    }

    return depIds;
  };

  // Helper: add all dependencies for a ContentRequirement and return their node IDs
  const addContentDeps = (req: { regions: string[]; skills: Record<string, number>; quests?: string[] }): string[] => {
    const depIds: string[] = [];

    // Regions
    for (const r of req.regions) {
      const rid = ensureRegion(r);
      if (rid) depIds.push(rid);
    }

    // Skills
    for (const [skill, level] of Object.entries(req.skills)) {
      depIds.push(...ensureSkill(skill, level));
    }

    // Quests (recursive — the quest itself will have its own deps added when we process quests)
    for (const q of req.quests || []) {
      if (!hasQuest(unlocks, q)) {
        const qid = questNodeId(q);
        depIds.push(qid);
        // Ensure the quest node exists (its deps will be filled when we iterate QUEST_DATA)
        getOrCreate(qid, 'COMPLETE_QUEST', `Complete quest: ${q}`, 15);
      }
    }

    return depIds;
  };

  // ------ 1. Process all incomplete quests ------
  for (const quest of Object.values(QUEST_DATA)) {
    if (hasQuest(unlocks, quest.name)) continue;

    const nid = questNodeId(quest.name);
    const node = getOrCreate(nid, 'COMPLETE_QUEST', `Complete quest: ${quest.name}`, questEffort(quest));

    const depIds = addContentDeps({
      regions: quest.regions,
      skills: quest.skills,
      quests: quest.prereqs,
    });
    for (const d of depIds) node.dependencies.add(d);
  }

  // ------ 2. Process all incomplete diaries ------
  for (const diary of Object.values(DIARY_DATA)) {
    if (unlocks.diaries.includes(diary.id)) continue;

    const nid = diaryNodeId(diary.id);
    const node = getOrCreate(nid, 'COMPLETE_DIARY', `Complete diary: ${diary.id}`, diaryEffort(diary));

    const depIds = addContentDeps({
      regions: diary.requiredRegions,
      skills: diary.skills,
      quests: diary.quests,
    });
    for (const d of depIds) node.dependencies.add(d);
  }

  // ------ 3. Process STRATEGY_DATABASE entries ------
  for (const [key, entry] of Object.entries(STRATEGY_DATABASE)) {
    // Skip already-completed quests that appear here
    if (entry.category === TableType.QUESTS && hasQuest(unlocks, entry.id)) continue;

    const nid = contentNodeId(key);
    const node = getOrCreate(nid, 'UNLOCK_CONTENT', entry.description || key, 20);

    const depIds = addContentDeps({
      regions: entry.regions,
      skills: entry.skills,
      quests: entry.quests,
    });
    for (const d of depIds) node.dependencies.add(d);
  }

  // ------ 4. Compute reverse "enables" edges ------
  for (const node of nodes.values()) {
    for (const depId of node.dependencies) {
      const depNode = nodes.get(depId);
      if (depNode) {
        depNode.enables.add(node.id);
      }
    }
  }

  return nodes;
};

// Effort heuristics
const questEffort = (q: QuestData): number => {
  const skillTotal = Object.values(q.skills).reduce((a, b) => a + b, 0);
  const prereqWeight = q.prereqs.length * 5;
  const base = q.points * 3;
  return base + Math.floor(skillTotal / 10) + prereqWeight;
};

const diaryEffort = (d: DiaryTier): number => {
  const tierWeight = { Easy: 10, Medium: 25, Hard: 50, Elite: 80 };
  return tierWeight[d.tier] + Object.values(d.skills).reduce((a, b) => a + b, 0) / 5;
};

// ---------------------------------------------------------------------------
// Topological sort with priority scoring
// ---------------------------------------------------------------------------

/**
 * Produces a recommended unlock path.
 *
 * Strategy: modified Kahn's algorithm where, at each step, we pick the
 * ready node (in-degree 0) with the best value/effort ratio. "Value" is
 * the transitive count of content this node eventually unblocks.
 */
export const computeRoutePlan = (unlocks: UnlockState, targetIds?: string[]): RoutePlan => {
  const graph = buildGraph(unlocks);

  // Pre-compute transitive "reach" for each node (memoized DFS)
  const reachCache = new Map<string, number>();

  const computeReach = (nodeId: string, visited: Set<string>): number => {
    if (reachCache.has(nodeId)) return reachCache.get(nodeId)!;
    if (visited.has(nodeId)) return 0; // cycle guard (shouldn't happen in a DAG)
    visited.add(nodeId);

    const node = graph.get(nodeId);
    if (!node) return 0;

    let reach = node.enables.size;
    for (const childId of node.enables) {
      reach += computeReach(childId, visited);
    }
    reachCache.set(nodeId, reach);
    return reach;
  };

  for (const nodeId of graph.keys()) {
    computeReach(nodeId, new Set());
  }

  // If targets specified, prune graph to only ancestors of those targets
  let relevantNodes: Set<string>;
  if (targetIds && targetIds.length > 0) {
    relevantNodes = new Set<string>();
    const collectAncestors = (id: string) => {
      if (relevantNodes.has(id)) return;
      relevantNodes.add(id);
      const node = graph.get(id);
      if (node) {
        for (const dep of node.dependencies) {
          collectAncestors(dep);
        }
      }
    };
    for (const tid of targetIds) {
      // Try various ID formats
      for (const candidate of [tid, questNodeId(tid), diaryNodeId(tid), contentNodeId(tid)]) {
        if (graph.has(candidate)) collectAncestors(candidate);
      }
    }
  } else {
    relevantNodes = new Set(graph.keys());
  }

  // Kahn's algorithm with priority
  const inDegree = new Map<string, number>();
  for (const nodeId of relevantNodes) {
    const node = graph.get(nodeId)!;
    const relevantDeps = [...node.dependencies].filter(d => relevantNodes.has(d));
    inDegree.set(nodeId, relevantDeps.length);
  }

  const steps: PlanStep[] = [];
  const completed = new Set<string>();

  while (completed.size < relevantNodes.size) {
    // Find all nodes with in-degree 0 that haven't been completed
    const ready: string[] = [];
    for (const [nodeId, deg] of inDegree) {
      if (deg === 0 && !completed.has(nodeId)) {
        ready.push(nodeId);
      }
    }

    if (ready.length === 0) break; // Remaining nodes form a cycle (shouldn't happen)

    // Score each ready node: value / effort (higher = better to do first)
    const scored = ready.map(nodeId => {
      const node = graph.get(nodeId)!;
      const reach = reachCache.get(nodeId) || 0;
      const score = (reach + 1) / Math.max(node.effort, 1);
      return { nodeId, node, reach, score };
    });

    // Sort by score descending, then by effort ascending as tiebreaker
    scored.sort((a, b) => b.score - a.score || a.node.effort - b.node.effort);

    const best = scored[0];
    const { node } = best;

    // Build the "reason" string
    const directUnblocks = [...node.enables].filter(e => relevantNodes.has(e));
    const reason = directUnblocks.length > 0
      ? `Unblocks ${directUnblocks.length} item${directUnblocks.length > 1 ? 's' : ''} (${best.reach} total downstream)`
      : 'End goal';

    steps.push({
      kind: node.kind,
      id: node.id,
      label: node.label,
      reason,
      effort: node.effort,
      value: best.reach,
      unblocks: directUnblocks.map(id => {
        const n = graph.get(id);
        return n ? n.label : id;
      }),
    });

    // "Complete" this node: reduce in-degree of its dependents
    completed.add(best.nodeId);
    for (const childId of node.enables) {
      if (relevantNodes.has(childId) && inDegree.has(childId)) {
        inDegree.set(childId, (inDegree.get(childId) || 1) - 1);
      }
    }
  }

  return {
    steps,
    totalEffort: steps.reduce((sum, s) => sum + s.effort, 0),
    contentUnlocked: steps.filter(s =>
      s.kind === 'COMPLETE_QUEST' || s.kind === 'COMPLETE_DIARY' || s.kind === 'UNLOCK_CONTENT'
    ).length,
  };
};

// ---------------------------------------------------------------------------
// Convenience: "Next N steps" shortcut
// ---------------------------------------------------------------------------

/**
 * Returns the top N recommended next actions.
 * Useful for a dashboard widget: "Here's what you should do next."
 */
export const getNextSteps = (unlocks: UnlockState, count: number = 5): PlanStep[] => {
  const plan = computeRoutePlan(unlocks);
  return plan.steps.slice(0, count);
};

/**
 * Returns a focused plan to reach a specific goal.
 * E.g., "What do I need to unlock Dragon Slayer II?"
 */
export const getPlanForGoal = (unlocks: UnlockState, goalId: string): RoutePlan => {
  return computeRoutePlan(unlocks, [goalId]);
};
