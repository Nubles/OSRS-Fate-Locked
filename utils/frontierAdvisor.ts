/**
 * Frontier Advisor — Chunked mode's answer to the Region Advisor.
 *
 * Chunked rolls are random-adjacent, so the player never *chooses* a chunk —
 * but knowing what the frontier is worth still matters: which rollable chunks
 * would make a quest or diary tier doable (computeUnlockImpact, through the
 * Journal's exact-chunk checks) or a skill trainable (chunkedTrainingTiers,
 * as Skills Keys roll), and which are just empty tiles. A first chunk of a
 * named area earns nothing by itself: in Chunked, content counts only in the
 * chunk it is in. Chunk-local content (bank/shops/monsters) is layered on as
 * a tie-breaker so a bank chunk ranks above bare wilderness.
 *
 * Pure function — content comes in through the optional lookup callbacks so
 * the lazily-fetched ChunkContentService stays out of this module.
 */

import { getChunkFrontier, chunkKey, chunkLabel, chunkSubArea, chunkRegion } from './chunkAdjacency';
import { isNamedAreaReachableViaChunks } from './reachability';
import { computeUnlockImpact, prepareUnlockImpactContext, type PreparedUnlockImpactContext } from './unlockImpact';
import { chunkedFrontier } from './journalStatus';
import { QUEST_DATA } from '../data/questData';
import { ALL_DIARY_TASKS } from '../data/diaryTasks';

/**
 * Chunks a quest or diary location names. In Chunked mode those locations are
 * exact-chunk requirements, so such a chunk can open content without giving a
 * foothold in any new named area.
 */
const LOCATION_CHUNK_KEYS: ReadonlySet<string> = new Set(
  [...Object.values(QUEST_DATA), ...ALL_DIARY_TASKS]
    .flatMap(entry => [...(entry.locations ?? []), ...(entry.oneOf ?? []).flatMap(option => option.locations ?? [])])
    .flatMap(location => location.chunkOptions.map(chunkKey)),
);

/** Sort bonus per skill a chunk makes trainable: as much as a diary tier and a half. */
const SKILL_BONUS = 3;

export interface FrontierContent {
  monsters: number;
  shops: number;
  /** Quests with a step or start physically in the chunk. */
  quests: number;
  hasBank: boolean;
}

export interface RankedFrontierChunk {
  key: string;
  label: string;
  /** Named areas this chunk would give a FIRST foothold in (sub-area and/or continent). */
  newAreas: string[];
  /** Skills this chunk would make trainable at the run's tiers, so a Skills Key can roll them. */
  newSkills: string[];
  newQuestNames: string[];
  newDiaryIds: string[];
  cascadeQuestNames: string[];
  cascadeDiaryIds: string[];
  /** Impact-engine scores (same semantics as the Region Advisor). */
  score: number;
  cascadeScore: number;
  content?: FrontierContent;
  /** Small chunk-local bonus for ranking ties: at most 2.5, below one new skill's bonus. */
  contentScore: number;
  /** What the row sorts by: cascade impact + content + a flat bonus per new trainable skill. */
  sortScore: number;
}

/** Lookup shims so callers can hand in ChunkContentService without this module importing it. */
export type ContentLookup = (cx: number, cy: number) => {
  monsters: { name: string }[];
  shops: string[];
  quests: Record<string, unknown>;
} | null;
export type BankLookup = (cx: number, cy: number) => boolean;

export function rankFrontierChunks(
  unlocks: any,
  gameModeId?: string,
  contentFor?: ContentLookup,
  hasBank?: BankLookup,
): RankedFrontierChunk[] {
  if (gameModeId !== 'chunked') return [];
  const chunks: string[] = unlocks.chunks ?? [];
  // Every simulation starts from the same snapshot, so its statuses are shared.
  let context: PreparedUnlockImpactContext | undefined;
  // Once the chunk content is in (utils/chunkedContentChecks.ts), only the
  // chunks the Journal's checks read can open anything, only diary tiers held
  // back by places and quests alone are simulated, and new skills are known.
  const frontier = chunkedFrontier(unlocks);

  return getChunkFrontier(chunks, unlocks)
    .map((c): RankedFrontierChunk => {
      const key = chunkKey(c);

      // First-foothold and location checks are cheap (set lookups), so they
      // gate the expensive impact simulation: a chunk that opens no new named
      // area and that no quest/diary location names cannot change any
      // quest/diary status.
      const newAreas = [chunkSubArea(key), chunkRegion(key)]
        .filter((n): n is string => !!n && !isNamedAreaReachableViaChunks(n, chunks));

      const impact = newAreas.length > 0 || LOCATION_CHUNK_KEYS.has(key) || frontier?.contentChunks.has(key)
        ? computeUnlockImpact(unlocks, { ...unlocks, chunks: [...chunks, key] }, gameModeId, {
            context: context ??= prepareUnlockImpactContext(unlocks, gameModeId),
            diaryIds: frontier?.diaryIds,
          })
        : null;

      const raw = contentFor?.(c.cx, c.cy) ?? null;
      const bank = hasBank?.(c.cx, c.cy) ?? false;
      const content: FrontierContent | undefined = (raw || bank)
        ? {
            monsters: raw?.monsters.length ?? 0,
            shops: raw?.shops.length ?? 0,
            quests: raw ? Object.keys(raw.quests).length : 0,
            hasBank: bank,
          }
        : undefined;
      const newSkills = frontier?.newSkills(key) ?? [];
      // Banks and shops are worth more than yet-another-monster. At most 10,
      // quartered to 2.5 so content alone never outranks a new trainable
      // skill (SKILL_BONUS).
      const contentScore = content
        ? ((content.hasBank ? 3 : 0)
          + Math.min(content.shops, 3)
          + Math.min(content.quests, 3)
          + Math.min(content.monsters, 5) * 0.2) / 4
        : 0;

      const cascadeScore = impact?.cascadeScore ?? 0;
      return {
        key,
        label: chunkLabel(key),
        newAreas,
        newSkills,
        newQuestNames: impact?.directQuestNames ?? [],
        newDiaryIds: impact?.directDiaryIds ?? [],
        cascadeQuestNames: impact?.cascadeQuestNames ?? [],
        cascadeDiaryIds: impact?.cascadeDiaryIds ?? [],
        score: impact?.directScore ?? 0,
        cascadeScore,
        content,
        contentScore,
        sortScore: cascadeScore + contentScore + newSkills.length * SKILL_BONUS,
      };
    })
    .sort(
      (a, b) =>
        b.sortScore - a.sortScore ||
        b.score - a.score ||
        a.label.localeCompare(b.label),
    );
}
