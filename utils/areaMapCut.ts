import { SUB_AREA_CHUNKS } from '../data/subAreaChunks';
import { MAP_BOUNDS, MAP_IMAGE, CHUNK_TILES, type ChunkCoord } from './mapCoords';

/**
 * The piece of the tracker's world map that shows one area: the area's chunks
 * plus a chunk of land around them, in map-image pixels, and the outline of
 * the area's own chunks (edges not shared with another of its chunks).
 * Used as an area unlock's picture in the OSRS layout, where an area has no
 * single 3D model.
 */
export interface AreaMapCut {
  /** Crop of the full map image, in its pixels. */
  x: number; y: number; width: number; height: number;
  /** Outline segments in the same pixels, relative to the crop's top-left. */
  edges: Array<[number, number, number, number]>;
}

const PX_PER_CHUNK = (MAP_IMAGE.width / (MAP_BOUNDS.tileMaxX - MAP_BOUNDS.tileMinX)) * CHUNK_TILES;
const MIN_CX = MAP_BOUNDS.tileMinX / CHUNK_TILES;
const TOP_CY = MAP_BOUNDS.tileMaxY / CHUNK_TILES - 1;

const left = (cx: number) => (cx - MIN_CX) * PX_PER_CHUNK;
const top = (cy: number) => (TOP_CY - cy) * PX_PER_CHUNK;

/** Chunks for an area unlock: a named area's chunks, or a Chunked-mode "cx,cy" key. */
export const chunksForArea = (name: string): ChunkCoord[] => {
  const named = SUB_AREA_CHUNKS[name];
  if (named?.length) return named;
  const m = /^(\d+),(\d+)$/.exec(name.trim());
  return m ? [{ cx: Number(m[1]), cy: Number(m[2]) }] : [];
};

export const areaMapCut = (chunks: ChunkCoord[], pad = 1): AreaMapCut | null => {
  if (!chunks.length) return null;
  const xs = chunks.map(c => c.cx);
  const ys = chunks.map(c => c.cy);
  const x = Math.max(0, left(Math.min(...xs) - pad));
  const y = Math.max(0, top(Math.max(...ys) + pad));
  const right = Math.min(MAP_IMAGE.width, left(Math.max(...xs) + 1 + pad));
  const bottom = Math.min(MAP_IMAGE.height, top(Math.min(...ys) - 1 - pad));
  const own = new Set(chunks.map(c => `${c.cx},${c.cy}`));
  const has = (cx: number, cy: number) => own.has(`${cx},${cy}`);
  const edges: AreaMapCut['edges'] = [];
  for (const { cx, cy } of chunks) {
    const l = left(cx) - x, t = top(cy) - y, r = l + PX_PER_CHUNK, b = t + PX_PER_CHUNK;
    if (!has(cx, cy + 1)) edges.push([l, t, r, t]);
    if (!has(cx, cy - 1)) edges.push([l, b, r, b]);
    if (!has(cx - 1, cy)) edges.push([l, t, l, b]);
    if (!has(cx + 1, cy)) edges.push([r, t, r, b]);
  }
  return { x, y, width: right - x, height: bottom - y, edges };
};
