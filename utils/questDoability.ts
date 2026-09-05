import { QuestData } from '../data/questData';
/**
 * Quest *chunk-access* doability.
 *
 * The journal already gates quests on regions/skills/prereqs (see
 * utils/journalStatus.ts `getQuestStatus`). This adds the finer, chunk-aware
 * question a chunk-locked run actually cares about: can you physically *reach*
 * every chunk a quest's steps live in, over the transport graph?
 *
 * A quest can be region-"available" but still blocked because a step sits in a
 * chunk you own yet can't route to (stranded), or in a chunk you don't own.
 * Pure + tested; the component layers `getQuestStatus` on top for the final
 * "doable now" verdict.
 */

/**
 * Build a chunk-entry gate from the picker's per-chunk quest requirements
 * (questSections). A chunk is blocked when any of its required quests is a
 * *known* quest the player hasn't completed — unknown/non-quest requirements
 * are ignored so we never falsely mark a chunk unreachable. Pass the result to
 * chunkReachability(connect, unlocks, home, gate).
 */
export function entryBlockedGate(
  questSections: Record<string, string[]>,
  completedQuests: Set<string>,
  knownQuests: Set<string>,
): (chunkId: string) => boolean {
  return (chunkId: string) => {
    const reqs = questSections[chunkId];
    if (!reqs) return false;
    return reqs.some(r => !knownQuests.has(r) || !completedQuests.has(r));
  };
}

export type ChunkAccess = 'REACHABLE' | 'STRANDED' | 'LOCKED';

export interface QuestLoc { cx: number; cy: number; role?: 'first' | 'step' }

export interface QuestChunkStatus {
  /** Distinct chunks the quest's steps touch (that we have data for). */
  chunkCount: number;
  /** How many of them are reachable from home. */
  reachable: number;
  /** Worst access across the quest's chunks (LOCKED > STRANDED > REACHABLE). */
  access: ChunkAccess;
  /** Is the quest's start chunk reachable? null when the start chunk is unknown. */
  startReachable: boolean | null;
  /** The unreachable chunks (locked or stranded), worst-first — the blockers. */
  blockers: { cx: number; cy: number; access: 'STRANDED' | 'LOCKED' }[];
}

const idOf = (cx: number, cy: number) => String(cx * 256 + cy);

/**
 * Classify a quest's chunk reachability.
 * @param locs        the quest's step chunks (deduped by the caller is fine; we dedupe too)
 * @param reachable   set of reachable chunk ids (`cx*256+cy`) from chunkReachability
 * @param isUnlocked  whether a chunk is owned (sub-area-aware)
 */
export function questChunkStatus(
  locs: QuestLoc[],
  reachable: Set<string>,
  isUnlocked: (cx: number, cy: number) => boolean,
): QuestChunkStatus {
  const seen = new Set<string>();
  const blockers: { cx: number; cy: number; access: 'STRANDED' | 'LOCKED' }[] = [];
  let chunkCount = 0;
  let reachableCount = 0;
  let worst: ChunkAccess = 'REACHABLE';
  let startReachable: boolean | null = null;

  const rank: Record<ChunkAccess, number> = { REACHABLE: 0, STRANDED: 1, LOCKED: 2 };

  for (const l of locs) {
    const id = idOf(l.cx, l.cy);
    if (seen.has(id)) continue;
    seen.add(id);
    chunkCount++;

    const isReach = reachable.has(id);
    if (isReach) {
      reachableCount++;
      if (l.role === 'first') startReachable = true;
      continue;
    }
    const access: 'STRANDED' | 'LOCKED' = isUnlocked(l.cx, l.cy) ? 'STRANDED' : 'LOCKED';
    blockers.push({ cx: l.cx, cy: l.cy, access });
    if (rank[access] > rank[worst]) worst = access;
    if (l.role === 'first') startReachable = isReach;
  }

  blockers.sort((a, b) => rank[b.access] - rank[a.access]);
  return { chunkCount, reachable: reachableCount, access: worst, startReachable, blockers };
}

export type DoabilityBucket = 'DONE' | 'DOABLE' | 'REQS' | 'STRANDED' | 'LOCKED' | 'NO_DATA';
export const hasCanonicalQuestLocationEvidence = (quest: QuestData): boolean =>
  quest.regions.length > 0
  || (quest.locations?.length ?? 0) > 0
  || (quest.oneOf?.some(option =>
    (option.regions?.length ?? 0) > 0
    || (option.guilds?.length ?? 0) > 0
    || (option.locations?.length ?? 0) > 0
  ) ?? false);


/**
 * Combine chunk access with the journal's requirement status into one verdict.
 * @param completed   quest already done
 * @param reqsMet     canonical eligibility.eligible
 */
export function doabilityBucket(
  completed: boolean,
  reqsMet: boolean,
  chunk: QuestChunkStatus | null,
  hasCanonicalLocationEvidence = false,
): DoabilityBucket {
  if (completed) return 'DONE';
  if (!chunk || chunk.chunkCount === 0) {
    if (!hasCanonicalLocationEvidence) return 'NO_DATA';
    return reqsMet ? 'DOABLE' : 'REQS';
  }
  if (chunk.access === 'LOCKED') return 'LOCKED';
  if (chunk.access === 'STRANDED') return 'STRANDED';
  return reqsMet ? 'DOABLE' : 'REQS'; // all chunks reachable — only reqs can block now
}
