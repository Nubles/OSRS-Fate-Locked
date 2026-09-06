import { UnlockState } from '../types';
import { isFreeArea } from './freeAreas';
import { REGION_CHUNKS } from '../data/regionChunks';
import { SUB_AREA_CHUNKS } from '../data/subAreaChunks';
import { AREA_CATALOG, AREA_INDEX, areaId, areaName, areaUnlockIds, type AreaId } from '../data/areaCatalog';
import { chunkKey, isChunkUnlocked } from './chunkAdjacency';
import { resolveModeRules } from '../config/gameModes';
import type { GameModeRules } from '../config/gameModes';
import { bankId } from '../data/banks';
import { AREA_ALIAS_POLICIES } from '../data/areaMapPolicy';

/**
 * Is a named region/sub-area reachable in Chunked mode: true if ANY chunk
 * belonging to it (sub-area first, falling back to the parent continent) is
 * currently unlocked (including the always-free start chunk). Quest/diary/
 * resource data is authored in named areas, not raw chunk coords, so this is
 * the Chunked-mode equivalent of "the whole named area is free/unlocked" —
 * a foothold anywhere in the area counts, since that's the granularity the
 * source data actually has.
 */
export const isNamedAreaReachableViaChunks = (name: string, unlockedChunkKeys: readonly string[]): boolean => {
  const policy = AREA_ALIAS_POLICIES[name as keyof typeof AREA_ALIAS_POLICIES];
  const canonical = areaName(name);
  if (!canonical) return false;
  const chunks = policy?.kind === 'surface-overlap'
    ? policy.chunks
    : (SUB_AREA_CHUNKS[canonical] || REGION_CHUNKS[canonical]);
  if (!chunks || chunks.length === 0) return false;
  return chunks.some((chunk) => isChunkUnlocked(chunkKey(chunk), unlockedChunkKeys));
};

/**
 * The single canonical "is this named area reachable" check — branches on
 * game mode so callers don't each need their own Chunked special-case.
 * Replaces the isFreeArea(name) || unlocks.regions.includes(name) pattern
 * used all over the app before Chunked mode existed.
 */
export const isAreaReachable = (name: string, unlocks: UnlockState, gameModeId?: string): boolean => {
  if (gameModeId === 'chunked') {
    return isNamedAreaReachableViaChunks(name, unlocks.chunks ?? []);
  }
  const id = areaId(name);
  if (!id) return false;
  const area = AREA_INDEX.byId.get(id)!;
  if (!area.parentId) return isRegionUnlocked(id, unlocks.regions);
  return isFreeArea(area.name) || areaUnlockIds(unlocks.regions).has(id);
};

const CHILDREN = new Map<AreaId, readonly AreaId[]>(AREA_CATALOG.filter(area => !area.parentId).map(parent => [
  parent.id, AREA_CATALOG.filter(area => area.parentId === parent.id).map(area => area.id),
]));

/**
 * Non-chunked map-tint semantics for a named region — richer than
 * isAreaReachable because chunks can be tagged at continent level.
 * A region is unlocked if:
 *  1. it's free at run start (mode-aware), or
 *  2. it appears directly in unlocks.regions, or
 *  3. its parent continent is free or directly unlocked, or
 *  4. its parent continent is "complete" (every sibling unlocked/free), or
 *  5. — if the region IS a continent — every one of its children is unlocked/free.
 * The RuneLite plugin mirrors these exact rules (FateLockedBundle.isUnlocked);
 * utils/runelitePluginParity.test.ts pins the two together.
 */
export const isRegionUnlocked = (region: string, unlocks: string[]): boolean => {
  const id = areaId(region);
  if (!id) return false;
  const owned = areaUnlockIds(unlocks);
  const isOwnedOrFree = (key: AreaId): boolean => owned.has(key) || isFreeArea(AREA_INDEX.byId.get(key)!.name);
  if (isOwnedOrFree(id)) return true;
  const parent = AREA_INDEX.byId.get(id)!.parentId;
  if (parent && isOwnedOrFree(parent)) return true;
  const children = CHILDREN.get(parent ?? id);
  return !!children?.length && children.every(isOwnedOrFree);
};

/**
 * True when a parent-area aggregate crosses both unlocked and locked ownership
 * units. Chunks belong to their named sub-area when one is assigned; otherwise
 * the parent region is the unit that owns them.
 */
export const hasMixedAreaOwnership = (
  chunks: readonly { cx: number; cy: number }[],
  parentRegion: string,
  subAreasByChunk: Readonly<Record<string, string>>,
  unlocks: string[],
): boolean => {
  let hasUnlocked = false;
  let hasLocked = false;
  for (const { cx, cy } of chunks) {
    if (isRegionUnlocked(subAreasByChunk[`${cx},${cy}`] ?? parentRegion, unlocks)) hasUnlocked = true;
    else hasLocked = true;
    if (hasUnlocked && hasLocked) return true;
  }
  return false;
};

/**
 * Does the run's mode lock banks individually? Off unless the mode's
 * `bankLocks` rule is set (Custom mode opt-in). Kept here so every caller —
 * app map, chunk panel, plugin bundle export — reads the same source.
 */
export const bankLocksActive = (gameModeId?: string, customMode?: GameModeRules): boolean =>
  !!resolveModeRules(gameModeId, customMode).bankLocks;

/**
 * Is the bank at this chunk usable? Always true unless the mode locks banks,
 * in which case the specific bankable chunk must have been unlocked
 * (TableType.BANKS). `cx,cy` is a canonical chunk coord; the unlock key is
 * data/banks.ts's `bankId` = cx*256+cy (matches the dataset + plugin bundle).
 */
export const isBankReachable = (
  cx: number,
  cy: number,
  unlocks: UnlockState,
  gameModeId?: string,
  customMode?: GameModeRules,
): boolean => {
  if (!bankLocksActive(gameModeId, customMode)) return true;
  return (unlocks.banks ?? []).includes(bankId(cx, cy));
};
