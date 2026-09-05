/**
 * Frontier Advisor — Chunked mode's answer to the Region Advisor.
 *
 * Chunked rolls are random-adjacent, so the player never *chooses* a chunk —
 * but knowing what the frontier is worth still matters: which rollable chunks
 * would give a first foothold in a new named area (opening its quests/diaries
 * via isNamedAreaReachableViaChunks), and which are just empty tiles. Named-
 * area footholds reuse the exact impact engine the Region Advisor runs on
 * (computeUnlockImpact is chunk-aware via gameModeId); chunk-local content
 * (bank/shops/monsters) is layered on as a tie-breaker so a bank chunk ranks
 * above bare wilderness even when neither opens a new area.
 *
 * Pure function — content comes in through the optional lookup callbacks so
 * the lazily-fetched ChunkContentService stays out of this module.
 */

import { getChunkFrontier, chunkKey, chunkLabel, chunkSubArea, chunkRegion } from './chunkAdjacency';
import { isNamedAreaReachableViaChunks } from './reachability';
import { computeUnlockImpact } from './unlockImpact';

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
  newQuestNames: string[];
  newDiaryIds: string[];
  cascadeQuestNames: string[];
  cascadeDiaryIds: string[];
  /** Impact-engine scores (same semantics as the Region Advisor). */
  score: number;
  cascadeScore: number;
  content?: FrontierContent;
  /** Small chunk-local bonus used only for ranking ties. */
  contentScore: number;
  /**
   * What the row actually sorts by: cascade impact + content + a flat bonus
   * per new-area foothold. The bonus exists because the impact engine only
   * counts quests/diaries, but a first foothold also opens area-gated content
   * it can't see (merchants, resources, slayer reach) — without it, "opens
   * Al Kharid" ranks below any bank tile.
   */
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

  return getChunkFrontier(chunks)
    .map((c): RankedFrontierChunk => {
      const key = chunkKey(c);

      // First-foothold check is cheap (set lookups), so it gates the expensive
      // impact simulation: a chunk that opens no new named area cannot change
      // any quest/diary status (those are keyed by named areas).
      const newAreas = [chunkSubArea(key), chunkRegion(key)]
        .filter((n): n is string => !!n && !isNamedAreaReachableViaChunks(n, chunks));

      const impact = newAreas.length > 0
        ? computeUnlockImpact(unlocks, { ...unlocks, chunks: [...chunks, key] }, gameModeId, { includeConditional: true })
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
      // Banks and shops are worth more than yet-another-monster; capped so
      // content alone never outranks a genuine new-area foothold.
      const contentScore = content
        ? (content.hasBank ? 3 : 0)
          + Math.min(content.shops, 3)
          + Math.min(content.quests, 3)
          + Math.min(content.monsters, 5) * 0.2
        : 0;

      const cascadeScore = impact?.cascadeScore ?? 0;
      return {
        key,
        label: chunkLabel(key),
        newAreas,
        newQuestNames: impact?.directQuestNames ?? [],
        newDiaryIds: impact?.directDiaryIds ?? [],
        cascadeQuestNames: impact?.cascadeQuestNames ?? [],
        cascadeDiaryIds: impact?.cascadeDiaryIds ?? [],
        score: impact?.directScore ?? 0,
        cascadeScore,
        content,
        contentScore,
        sortScore: cascadeScore + contentScore + newAreas.length * 3,
      };
    })
    .sort(
      (a, b) =>
        b.sortScore - a.sortScore ||
        b.score - a.score ||
        a.label.localeCompare(b.label),
    );
}
