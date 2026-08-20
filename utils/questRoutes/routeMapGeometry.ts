import {
  CHUNK_TILES,
  MAP_BOUNDS,
  MAP_IMAGE,
  tileToPixel,
} from '../mapCoords';
import type { ChunkKey } from './model';

export interface RouteMapSize {
  readonly width: number;
  readonly height: number;
}

export interface RouteMapPoint {
  readonly x: number;
  readonly y: number;
}

export interface RouteMapRect extends RouteMapPoint {
  readonly width: number;
  readonly height: number;
}

export interface RouteMapTransform {
  readonly scale: number;
  readonly x: number;
  readonly y: number;
}

export interface RouteMapGeometry {
  readonly validChunks: ReadonlyMap<ChunkKey, RouteMapRect>;
  readonly outOfBoundsChunks: readonly ChunkKey[];
  readonly fitted: RouteMapTransform;
  readonly minScale: number;
  readonly maxScale: number;
}

const DEFAULT_PADDING = 24;

const parseChunk = (chunk: ChunkKey): { cx: number; cy: number } | null => {
  const match = /^(-?\d+),(-?\d+)$/.exec(chunk);
  if (!match) return null;
  const cx = Number(match[1]);
  const cy = Number(match[2]);
  if (!Number.isSafeInteger(cx) || !Number.isSafeInteger(cy)) return null;
  return { cx, cy };
};

const mapBoundsInPixels: RouteMapRect = {
  x: 0,
  y: 0,
  width: MAP_IMAGE.width,
  height: MAP_IMAGE.height,
};

const finitePositive = (value: number): boolean => Number.isFinite(value) && value > 0;

const viewportDimension = (value: number): number => finitePositive(value) ? value : 0;

const safePadding = (padding: number | undefined): number =>
  Number.isFinite(padding) ? Math.max(0, padding) : DEFAULT_PADDING;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const clampRouteMapTransform = (
  transform: RouteMapTransform,
  viewport: RouteMapSize,
): RouteMapTransform => {
  const width = viewportDimension(viewport.width);
  const height = viewportDimension(viewport.height);
  const scale = finitePositive(transform.scale) ? transform.scale : 1;
  const scaledWidth = MAP_IMAGE.width * scale;
  const scaledHeight = MAP_IMAGE.height * scale;

  const x = scaledWidth <= width
    ? (width - scaledWidth) / 2
    : clamp(transform.x, width - scaledWidth, 0);
  const y = scaledHeight <= height
    ? (height - scaledHeight) / 2
    : clamp(transform.y, height - scaledHeight, 0);

  return { scale, x, y };
};

const unionRect = (rectangles: Iterable<RouteMapRect>): RouteMapRect | null => {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;

  for (const rect of rectangles) {
    left = Math.min(left, rect.x);
    top = Math.min(top, rect.y);
    right = Math.max(right, rect.x + rect.width);
    bottom = Math.max(bottom, rect.y + rect.height);
  }

  return Number.isFinite(left)
    ? { x: left, y: top, width: right - left, height: bottom - top }
    : null;
};

export const chunkRectOnMap = (chunk: ChunkKey): RouteMapRect | null => {
  const parsed = parseChunk(chunk);
  if (!parsed) return null;

  const minCx = MAP_BOUNDS.tileMinX / CHUNK_TILES;
  const maxCxExclusive = MAP_BOUNDS.tileMaxX / CHUNK_TILES;
  const minCy = MAP_BOUNDS.tileMinY / CHUNK_TILES;
  const maxCyExclusive = MAP_BOUNDS.tileMaxY / CHUNK_TILES;
  const { cx, cy } = parsed;

  if (cx < minCx || cx >= maxCxExclusive || cy < minCy || cy >= maxCyExclusive) return null;

  const topLeft = tileToPixel({ tx: cx * CHUNK_TILES, ty: (cy + 1) * CHUNK_TILES });
  const bottomRight = tileToPixel({ tx: (cx + 1) * CHUNK_TILES, ty: cy * CHUNK_TILES });

  return {
    x: topLeft.px,
    y: topLeft.py,
    width: bottomRight.px - topLeft.px,
    height: bottomRight.py - topLeft.py,
  };
};

export const createRouteMapGeometry = (
  chunks: readonly ChunkKey[],
  viewport: RouteMapSize,
  padding = DEFAULT_PADDING,
): RouteMapGeometry => {
  const width = viewportDimension(viewport.width);
  const height = viewportDimension(viewport.height);
  const validChunks = new Map<ChunkKey, RouteMapRect>();
  const outOfBoundsChunks: ChunkKey[] = [];

  for (const chunk of chunks) {
    const rect = chunkRectOnMap(chunk);
    if (!rect) {
      outOfBoundsChunks.push(chunk);
    } else if (!validChunks.has(chunk)) {
      validChunks.set(chunk, rect);
    }
  }

  if (width === 0 || height === 0) {
    return {
      validChunks,
      outOfBoundsChunks,
      fitted: { scale: 1, x: 0, y: 0 },
      minScale: 1,
      maxScale: 6,
    };
  }

  const minScale = Math.min(width / MAP_IMAGE.width, height / MAP_IMAGE.height);
  const maxScale = Math.max(minScale, 6);
  const bounds = unionRect(validChunks.values()) ?? mapBoundsInPixels;
  const inset = safePadding(padding);
  const horizontalFit = Math.max(0, width - inset * 2) / bounds.width;
  const verticalFit = Math.max(0, height - inset * 2) / bounds.height;
  const fitScale = Math.min(horizontalFit, verticalFit);
  const scale = finitePositive(fitScale) ? clamp(fitScale, minScale, maxScale) : minScale;
  const fitted = clampRouteMapTransform({
    scale,
    x: width / 2 - (bounds.x + bounds.width / 2) * scale,
    y: height / 2 - (bounds.y + bounds.height / 2) * scale,
  }, viewport);

  return { validChunks, outOfBoundsChunks, fitted, minScale, maxScale };
};

export const panRouteMap = (
  transform: RouteMapTransform,
  delta: RouteMapPoint,
  viewport: RouteMapSize,
): RouteMapTransform => clampRouteMapTransform({
  scale: transform.scale,
  x: transform.x + (Number.isFinite(delta.x) ? delta.x : 0),
  y: transform.y + (Number.isFinite(delta.y) ? delta.y : 0),
}, viewport);

export const zoomRouteMapAt = (
  transform: RouteMapTransform,
  factor: number,
  anchor: RouteMapPoint,
  viewport: RouteMapSize,
): RouteMapTransform => {
  const width = viewportDimension(viewport.width);
  const height = viewportDimension(viewport.height);
  if (width === 0 || height === 0) return { scale: 1, x: 0, y: 0 };

  const current = clampRouteMapTransform(transform, viewport);
  const minScale = Math.min(width / MAP_IMAGE.width, height / MAP_IMAGE.height);
  const maxScale = Math.max(minScale, 6);
  const nextScale = clamp(
    current.scale * (finitePositive(factor) ? factor : 1),
    minScale,
    maxScale,
  );
  const anchorX = Number.isFinite(anchor.x) ? anchor.x : width / 2;
  const anchorY = Number.isFinite(anchor.y) ? anchor.y : height / 2;
  const mapX = (anchorX - current.x) / current.scale;
  const mapY = (anchorY - current.y) / current.scale;

  return clampRouteMapTransform({
    scale: nextScale,
    x: anchorX - mapX * nextScale,
    y: anchorY - mapY * nextScale,
  }, viewport);
};
