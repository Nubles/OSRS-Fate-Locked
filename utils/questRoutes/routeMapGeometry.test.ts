import { describe, expect, it } from 'vitest';
import {
  CHUNK_TILES,
  MAP_BOUNDS,
  MAP_IMAGE,
  tileToPixel,
} from '../mapCoords';
import type { ChunkKey } from './model';
import {
  chunkRectOnMap,
  createRouteMapGeometry,
  panRouteMap,
  zoomRouteMapAt,
  type RouteMapRect,
  type RouteMapSize,
  type RouteMapTransform,
} from './routeMapGeometry';

const expectTransformedRectInsideViewport = (
  rect: RouteMapRect,
  transform: RouteMapTransform,
  viewport: RouteMapSize,
  padding: number,
) => {
  expect(rect.x * transform.scale + transform.x).toBeGreaterThanOrEqual(padding - 0.000001);
  expect(rect.y * transform.scale + transform.y).toBeGreaterThanOrEqual(padding - 0.000001);
  expect((rect.x + rect.width) * transform.scale + transform.x).toBeLessThanOrEqual(viewport.width - padding + 0.000001);
  expect((rect.y + rect.height) * transform.scale + transform.y).toBeLessThanOrEqual(viewport.height - padding + 0.000001);
};

describe('chunkRectOnMap', () => {
  it('maps a canonical chunk to the exact world-map rectangle', () => {
    const rect = chunkRectOnMap('19,57');
    const topLeft = tileToPixel({ tx: 19 * CHUNK_TILES, ty: (57 + 1) * CHUNK_TILES });
    const bottomRight = tileToPixel({ tx: (19 + 1) * CHUNK_TILES, ty: 57 * CHUNK_TILES });

    expect(rect).toEqual({
      x: topLeft.px,
      y: topLeft.py,
      width: bottomRight.px - topLeft.px,
      height: bottomRight.py - topLeft.py,
    });
  });

  it('maps chunks at both map corners without crossing the image bounds', () => {
    const bottomLeftTop = tileToPixel({
      tx: MAP_BOUNDS.tileMinX,
      ty: MAP_BOUNDS.tileMinY + CHUNK_TILES,
    });
    const bottomLeftBottom = tileToPixel({
      tx: MAP_BOUNDS.tileMinX + CHUNK_TILES,
      ty: MAP_BOUNDS.tileMinY,
    });
    const topRightTop = tileToPixel({
      tx: MAP_BOUNDS.tileMaxX - CHUNK_TILES,
      ty: MAP_BOUNDS.tileMaxY,
    });
    const topRightBottom = tileToPixel({
      tx: MAP_BOUNDS.tileMaxX,
      ty: MAP_BOUNDS.tileMaxY - CHUNK_TILES,
    });

    expect(chunkRectOnMap('15,32')).toEqual({
      x: bottomLeftTop.px,
      y: bottomLeftTop.py,
      width: bottomLeftBottom.px - bottomLeftTop.px,
      height: bottomLeftBottom.py - bottomLeftTop.py,
    });
    expect(chunkRectOnMap('62,65')).toEqual({
      x: topRightTop.px,
      y: topRightTop.py,
      width: topRightBottom.px - topRightTop.px,
      height: topRightBottom.py - topRightTop.py,
    });
  });

  it.each([
    '-1,57',
    '19,-1',
    '19,57.5',
    '19.5,57',
    'NaN,57',
    'Infinity,57',
    '19,57.0',
    '19, 57',
    '19,57,1',
  ])('rejects malformed, fractional, non-finite, and negative chunk text: %s', (chunk) => {
    expect(chunkRectOnMap(chunk as ChunkKey)).toBeNull();
  });

  it('rejects canonical chunks outside the cropped world map', () => {
    expect(chunkRectOnMap('14,32')).toBeNull();
    expect(chunkRectOnMap('63,65')).toBeNull();
    expect(chunkRectOnMap('15,31')).toBeNull();
    expect(chunkRectOnMap('62,66')).toBeNull();
  });
});

describe('createRouteMapGeometry', () => {
  it('fits one route chunk inside the requested padding', () => {
    const viewport = { width: 640, height: 240 };
    const single = createRouteMapGeometry(['19,57'], viewport, 24);

    expect(single).toMatchObject({ outOfBoundsChunks: [] });
    expectTransformedRectInsideViewport(single.validChunks.get('19,57')!, single.fitted, viewport, 24);
  });

  it('fits distant route chunks together inside the requested padding', () => {
    const viewport = { width: 800, height: 400 };
    const geometry = createRouteMapGeometry(['19,57', '58,57'], viewport, 32);

    for (const rect of geometry.validChunks.values()) {
      expectTransformedRectInsideViewport(rect, geometry.fitted, viewport, 32);
    }
  });

  it('preserves input order for rejected chunks and ignores duplicates when fitting', () => {
    const unique = createRouteMapGeometry(['19,57', '62,65'], { width: 640, height: 480 }, 24);
    const repeated = createRouteMapGeometry(
      ['19,57', '62,65', '19,57', '14,32', 'not-a-key' as ChunkKey, '14,32'],
      { width: 640, height: 480 },
      24,
    );

    expect(repeated.fitted).toEqual(unique.fitted);
    expect([...repeated.validChunks.keys()]).toEqual(['19,57', '62,65']);
    expect(repeated.outOfBoundsChunks).toEqual(['14,32', 'not-a-key', '14,32']);
  });

  it('keeps the route scale within the advertised map limits', () => {
    const geometry = createRouteMapGeometry(['19,57'], { width: 640, height: 240 }, 24);

    expect(geometry.fitted.scale).toBeGreaterThanOrEqual(geometry.minScale);
    expect(geometry.fitted.scale).toBeLessThanOrEqual(geometry.maxScale);
  });

  it('returns an identity-safe transform for a zero-size viewport', () => {
    const geometry = createRouteMapGeometry(['19,57'], { width: 0, height: 0 }, 24);

    expect(geometry).toMatchObject({
      minScale: 1,
      maxScale: 6,
      fitted: { scale: 1, x: 0, y: 0 },
    });
    expect(Object.values(geometry.fitted).every(Number.isFinite)).toBe(true);
  });
});

describe('route-map transforms', () => {
  it('clamps panning to the scaled world image edges', () => {
    const viewport = { width: 640, height: 480 };
    const transform = { scale: 1, x: -100, y: -200 };

    expect(panRouteMap(transform, { x: 100_000, y: 100_000 }, viewport)).toEqual({ scale: 1, x: 0, y: 0 });
    expect(panRouteMap(transform, { x: -100_000, y: -100_000 }, viewport)).toEqual({
      scale: 1,
      x: viewport.width - MAP_IMAGE.width,
      y: viewport.height - MAP_IMAGE.height,
    });
  });

  it('keeps the map coordinate under the pointer fixed while zooming', () => {
    const viewport = { width: 640, height: 240 };
    const transform = createRouteMapGeometry(['19,57'], viewport, 24).fitted;
    const anchor = { x: 320, y: 120 };
    const mapPoint = {
      x: (anchor.x - transform.x) / transform.scale,
      y: (anchor.y - transform.y) / transform.scale,
    };
    const zoomed = zoomRouteMapAt(transform, 1.5, anchor, viewport);

    expect(mapPoint.x * zoomed.scale + zoomed.x).toBeCloseTo(anchor.x);
    expect(mapPoint.y * zoomed.scale + zoomed.y).toBeCloseTo(anchor.y);
  });

  it('clamps zoom at the minimum and maximum map scales', () => {
    const viewport = { width: 640, height: 240 };
    const geometry = createRouteMapGeometry(['19,57'], viewport, 24);
    const anchor = { x: 320, y: 120 };

    expect(zoomRouteMapAt(geometry.fitted, 0.000001, anchor, viewport).scale).toBe(geometry.minScale);
    expect(zoomRouteMapAt(geometry.fitted, 1_000_000, anchor, viewport).scale).toBe(geometry.maxScale);
  });
});
