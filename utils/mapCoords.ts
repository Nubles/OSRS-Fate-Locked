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
  src: `${import.meta.env.BASE_URL}osrs_world_map.jpg`,
  width: 6145,
  height: 4353,
} as const;

// Calibrate against the image. tileMinX/tileMinY = game tile at the image's
// BOTTOM-LEFT pixel; tileMaxX/tileMaxY = game tile at the TOP-RIGHT pixel.
// Initial values preserve the 6145x4353 aspect ratio (3072x2176 tiles @ ~2
// px/tile). Nudge once you sight-check against known landmarks —
// e.g. Lumbridge castle is roughly (3222, 3218), Varrock square (3213, 3424).
export const MAP_BOUNDS = {
  tileMinX: 1024,
  tileMinY: 2496,
  tileMaxX: 4096,
  tileMaxY: 4672,
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
