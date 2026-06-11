// Game-tile / pixel / chunk coordinate utilities for the OSRS world map.
//
// Axes:
//   Game tile X increases east (right).  Image pixel X increases right. Same direction.
//   Game tile Y increases north (up).    Image pixel Y increases down.  Flipped.
//
// A "chunk" here is the 64x64 tile region that the OSRS wiki draws grid
// lines on — the same boundaries as in-game region IDs
// (regionId = (x >> 6) << 8 | (y >> 6)).

export const CHUNK_TILES = 64;

export const MAP_IMAGE = {
  // Official OSRS Wiki world map (Old_School_RuneScape_world_map.png), re-encoded
  // to WebP. Cropped to a whole number of OSRS chunks (see MAP_BOUNDS below),
  // so the chunk grid lines up exactly with the canonical region grid.
  src: `${import.meta.env.BASE_URL}osrs_world_map.webp`,
  width: 9216,
  height: 6528,
} as const;

// tileMinX/tileMinY = game tile at the image's BOTTOM-LEFT pixel;
// tileMaxX/tileMaxY = game tile at the TOP-RIGHT pixel.
//
// Calibrated to the canonical OSRS region grid. The image is the wiki world map
// cropped to a whole number of 64x64-tile chunks — 48 columns x 34 rows =
// 3072x2176 tiles, at 192 px/chunk = a clean 3.0 px/tile on the 9216x6528 image.
// So every bound lands on a chunk boundary (a multiple of 64):
//   X: tiles 960..4032  (chunks 15..62)    Y: tiles 2048..4224  (chunks 32..65)
// These match the Chunk Picker (source-chunk.github.io/chunk-picker-v2), whose
// own code clamps the identical 9216x6528 crop to x in [960,4031], y in
// [2048,4223]. Result: our chunk coords equal canonical OSRS region coords
// (regionX = x >> 6, regionY = y >> 6) and align 1:1 with the picker.
export const MAP_BOUNDS = {
  tileMinX: 960,
  tileMinY: 2048,
  tileMaxX: 4032,
  tileMaxY: 4224,
} as const;

const TILE_WIDTH = MAP_BOUNDS.tileMaxX - MAP_BOUNDS.tileMinX;
const TILE_HEIGHT = MAP_BOUNDS.tileMaxY - MAP_BOUNDS.tileMinY;

export interface TileCoord { tx: number; ty: number }
export interface PixelCoord { px: number; py: number }
export interface ChunkCoord { cx: number; cy: number }

export const tileToPixel = ({ tx, ty }: TileCoord): PixelCoord => ({
  px: ((tx - MAP_BOUNDS.tileMinX) / TILE_WIDTH) * MAP_IMAGE.width,
  py: ((MAP_BOUNDS.tileMaxY - ty) / TILE_HEIGHT) * MAP_IMAGE.height,
});

export const pixelToTile = ({ px, py }: PixelCoord): TileCoord => ({
  tx: MAP_BOUNDS.tileMinX + (px / MAP_IMAGE.width) * TILE_WIDTH,
  ty: MAP_BOUNDS.tileMaxY - (py / MAP_IMAGE.height) * TILE_HEIGHT,
});

export const tileToChunk = ({ tx, ty }: TileCoord): ChunkCoord => ({
  cx: Math.floor(tx / CHUNK_TILES),
  cy: Math.floor(ty / CHUNK_TILES),
});

export const chunkOriginTile = ({ cx, cy }: ChunkCoord): TileCoord => ({
  tx: cx * CHUNK_TILES,
  ty: cy * CHUNK_TILES,
});

// Percent-of-image (0-100), for overlays using viewBox="0 0 100 100".
export const tileToPercent = (t: TileCoord) => {
  const { px, py } = tileToPixel(t);
  return { x: (px / MAP_IMAGE.width) * 100, y: (py / MAP_IMAGE.height) * 100 };
};
