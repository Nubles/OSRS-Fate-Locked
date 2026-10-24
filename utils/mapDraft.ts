import type { ChunkCoord } from './mapCoords';
import { REGION_CHUNKS } from '../data/regionChunks';
import { SUB_AREA_CHUNKS } from '../data/subAreaChunks';
import { mapAuthoringAvailable } from './mapAuthoring';

/**
 * The world map's chunk authoring tool keeps its painting in this browser's
 * storage. Those drafts are maintainer scratch work: they only load (and only
 * save) where authoring is enabled — see `mapAuthoringAvailable`. Everywhere
 * else the map, the chunk panel and the run card draw the shipped
 * REGION_CHUNKS / SUB_AREA_CHUNKS, the same data the unlock rules and the
 * RuneLite bundle use. A player's old draft is left in storage untouched,
 * just ignored.
 */
export const REGION_DRAFT_KEY = 'fate-region-chunks-draft-v1';
// Rolling backup that only advances when the draft is MORE substantial than
// what it currently holds. Recovery-only — never auto-loaded by the map.
export const REGION_DRAFT_BACKUP_KEY = 'fate-region-chunks-backup-v1';
export const SUBAREA_DRAFT_KEY = 'fate-subarea-chunks-draft-v1';
// Pre-versioning drafts are stashed here once, in case an author needs them.
export const LEGACY_DRAFT_RESCUE_KEY = 'fate-chunks-legacy-rescue-v1';

const hashStr = (s: string): string => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};
/** Hash of the shipped map data; a stored draft remembers the seed it came from. */
export const MAP_SEED_HASH = hashStr(JSON.stringify(REGION_CHUNKS) + '|' + JSON.stringify(SUB_AREA_CHUNKS));

export interface StoredDraft {
  v: 2;
  seed: string;
  dirty: boolean;
  data: Record<string, ChunkCoord[]>;
}
export interface LoadedDraft {
  data: Record<string, ChunkCoord[]>;
  dirty: boolean;
  /** True when stale user edits were preserved over a newer shipped seed. */
  keptStaleEdits: boolean;
}

type DraftStorage = Pick<Storage, 'getItem' | 'setItem'>;
const browserStorage = (): DraftStorage | undefined =>
  typeof localStorage === 'undefined' ? undefined : localStorage;

/**
 * The map layer to draw. Without authoring it is always the shipped data, and
 * storage is not read or written. With authoring, untouched drafts re-seed on
 * a new deploy and hand-edited ones are kept (Wipe resets to shipped).
 */
export function loadMapDraft(
  key: string,
  shipped: Record<string, ChunkCoord[]>,
  authoring: boolean = mapAuthoringAvailable(),
  storage: DraftStorage | undefined = browserStorage(),
): LoadedDraft {
  const fallback: LoadedDraft = { data: shipped, dirty: false, keptStaleEdits: false };
  if (!authoring || !storage) return fallback;
  try {
    const raw = storage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.v === 2 && parsed.data) {
        const stored = parsed as StoredDraft;
        if (stored.seed === MAP_SEED_HASH) return { data: stored.data, dirty: stored.dirty, keptStaleEdits: false };
        if (!stored.dirty) return fallback;                                     // stale seed, no edits → resync
        return { data: stored.data, dirty: true, keptStaleEdits: true };        // keep real edits
      }
      // Legacy (pre-versioning) draft: can't tell edits from stale seed.
      // Resync to shipped, but stash the old draft once so an author can
      // recover it.
      if (parsed && typeof parsed === 'object') {
        try {
          if (!storage.getItem(LEGACY_DRAFT_RESCUE_KEY)) storage.setItem(LEGACY_DRAFT_RESCUE_KEY, raw);
        } catch { /* ignore */ }
      }
    }
  } catch { /* fall through */ }
  return fallback;
}
