import { TableType, type UnlockState } from '../types';
import type { GameModeRules } from '../config/gameModes';
import { unlockableAreas } from './freeAreas';
import { isAreaReachable } from './reachability';
import { isOmniDirectUnlockAvailable } from './gameEngine';
import { chunkUnlocked } from './chunkLocations';
import { SUB_AREA_CHUNKS } from '../data/subAreaChunks';
import { REGION_CHUNKS } from '../data/regionChunks';
import type { ChunkCoord } from './mapCoords';

export interface OmniAreaPreview {
  area: string;
  /** An Omni-Key can unlock this area now (the same checks the unlock itself makes). */
  eligible: boolean;
  /** Why not, when it can't. */
  reason?: string;
  /** The chunks the unlock would add to the map. */
  chunks: ChunkCoord[];
}

/**
 * The chunks a named-area unlock would add to the map (non-Chunked modes):
 * the area's own chunks plus any parent-region terrain the unlock completes.
 * Worked out by asking the map's own unlock check before and after, so it
 * can't drift from the colouring.
 */
export const chunksGainedByArea = (area: string, unlocks: UnlockState, gameModeId?: string): ChunkCoord[] => {
  if (gameModeId === 'chunked' || unlocks.regions.includes(area)) return [];
  const after: UnlockState = { ...unlocks, regions: [...unlocks.regions, area] };
  const out: ChunkCoord[] = [];
  const seen = new Set<string>();
  for (const chunks of [...Object.values(SUB_AREA_CHUNKS), ...Object.values(REGION_CHUNKS)]) {
    for (const { cx, cy } of chunks) {
      const k = `${cx},${cy}`;
      if (seen.has(k)) continue;
      seen.add(k);
      if (!chunkUnlocked(cx, cy, unlocks, gameModeId) && chunkUnlocked(cx, cy, after, gameModeId)) out.push({ cx, cy });
    }
  }
  return out;
};

/**
 * What spending an Omni-Key on a named area would do, for the world map's
 * Omni-Key preview. Chunked mode has no area unlocks, so nothing is eligible
 * there. Dashboard's handleSpecialUnlock re-checks before it spends.
 */
export const previewOmniArea = (
  area: string,
  unlocks: UnlockState,
  gameModeId: string,
  customMode?: GameModeRules,
): OmniAreaPreview => {
  const no = (reason: string): OmniAreaPreview => ({ area, eligible: false, reason, chunks: [] });
  if (gameModeId === 'chunked') return no('Chunked mode unlocks chunks, not areas');
  if (unlocks.regions.includes(area) || isAreaReachable(area, unlocks, gameModeId)) return no('Already unlocked');
  if (!unlockableAreas(gameModeId, customMode).includes(area)) return no('Not on the Areas table');
  if (!isOmniDirectUnlockAvailable(TableType.REGIONS, area, unlocks, gameModeId)) return no('Not reachable yet');
  return { area, eligible: true, chunks: chunksGainedByArea(area, unlocks, gameModeId) };
};
