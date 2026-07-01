/**
 * "Can I obtain this item given my chunk unlocks?" — derived from the
 * chunk-content dataset's shop + drop sources. Three-state so an item we have no
 * source data for is shown neutral ("unknown"), never falsely "locked".
 *
 * obtainable — at least one source (shop/monster) sits in an unlocked chunk.
 * locked     — the item has known sources, but every one is in a locked chunk.
 * unknown    — no source data (data not loaded, or item not in shops/drops).
 */
import { chunkContentService } from '../services/ChunkContentService';
import { chunkUnlocked } from './chunkLocations';
import { UnlockState } from '../types';

export type Obtainability = 'obtainable' | 'locked' | 'unknown';

export function itemObtainability(itemName: string, unlocks: UnlockState, gameModeId?: string): Obtainability {
  if (!chunkContentService.ready || !itemName) return 'unknown';
  const sources = chunkContentService.itemSourceChunks(itemName);
  if (sources.length === 0) return 'unknown';
  for (const s of sources) {
    if (chunkUnlocked(s.cx, s.cy, unlocks, gameModeId)) return 'obtainable';
  }
  return 'locked';
}
