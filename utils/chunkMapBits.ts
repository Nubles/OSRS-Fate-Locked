/**
 * The chunk map a shared progress snapshot carries (`map`, see
 * utils/progressSnapshot.ts): one bit per cell of the tracker's world map
 * grid, row by row from the north-west corner, low bit first, in base64.
 * Kept apart from the snapshot builder so the Adventurer's Log page can read
 * a map without loading the quest and diary tables.
 */

/**
 * The world map grid the snapshot's `map` covers: the tracker's map image,
 * chunks 15..62 west to east and 65..32 north to south (utils/mapCoords.ts).
 */
export const MAP_GRID = { minCx: 15, maxCy: 65, cols: 48, rows: 34 } as const;

/** The map's length in base64: 48 x 34 bits is 204 bytes. */
export const CHUNK_MAP_LENGTH = 272;

/** The bit for chunk cx,cy, or -1 when it is off the grid. */
export const chunkMapBit = (cx: number, cy: number): number => {
  const col = cx - MAP_GRID.minCx;
  const row = MAP_GRID.maxCy - cy;
  if (col < 0 || col >= MAP_GRID.cols || row < 0 || row >= MAP_GRID.rows) return -1;
  return row * MAP_GRID.cols + col;
};

/** The owned chunks a map holds, as "cx,cy" keys, or null when it isn't a map. */
export function decodeChunkMap(map: string): Set<string> | null {
  if (typeof map !== 'string' || !/^[A-Za-z0-9+/]+$/.test(map) || map.length !== CHUNK_MAP_LENGTH) return null;
  let raw: string;
  try {
    raw = atob(map);
  } catch {
    return null;
  }
  const owned = new Set<string>();
  for (let row = 0; row < MAP_GRID.rows; row++) {
    for (let col = 0; col < MAP_GRID.cols; col++) {
      const bit = row * MAP_GRID.cols + col;
      if (raw.charCodeAt(bit >> 3) & (1 << (bit & 7))) owned.add(`${MAP_GRID.minCx + col},${MAP_GRID.maxCy - row}`);
    }
  }
  return owned;
}
