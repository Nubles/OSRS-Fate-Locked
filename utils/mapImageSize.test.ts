import { describe, expect, it } from 'vitest';
// @ts-expect-error Node types are intentionally excluded from the browser app.
import { readFileSync } from 'node:fs';
import { MAP_IMAGE } from './mapCoords';
import { MAP_DPR_CAP, MAP_UPSCALE_TOLERANCE, mapImageIndexForScale, mapImageSrcForScale, pickMapImageSize } from './mapImageSize';

const SIZES = [{ width: 2304 }, { width: 4608 }, { width: 9216 }];
const file = (src: string) => src.split('/').pop()!;

/** Width and height from a WebP file's header (lossy, lossless or extended). */
const webpSize = (path: string): { width: number; height: number } => {
  const b = readFileSync(path);
  expect(b.toString('ascii', 0, 4)).toBe('RIFF');
  expect(b.toString('ascii', 8, 12)).toBe('WEBP');
  const chunk = b.toString('ascii', 12, 16);
  if (chunk === 'VP8 ') return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
  if (chunk === 'VP8L') {
    const bits = b.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (chunk === 'VP8X') return { width: b.readUIntLE(24, 3) + 1, height: b.readUIntLE(27, 3) + 1 };
  throw new Error(`${path}: unknown WebP chunk ${chunk}`);
};

describe('pickMapImageSize', () => {
  it('gives a normal laptop screen the smallest copy at the default zoom', () => {
    // Classic layout opens at scale 0.2: the map is drawn 1843 px wide.
    expect(pickMapImageSize(SIZES, 9216 * 0.2, 1)).toBe(0);
  });

  it('gives a 2x screen the middle copy at the default zoom', () => {
    expect(pickMapImageSize(SIZES, 9216 * 0.2, 2)).toBe(1);
  });

  it('treats a 3x phone like a 2x screen, so phones never get the full map unzoomed', () => {
    expect(MAP_DPR_CAP).toBe(2);
    expect(pickMapImageSize(SIZES, 9216 * 0.2, 3)).toBe(1);
    expect(pickMapImageSize(SIZES, 9216 * 0.2, 3)).toBe(pickMapImageSize(SIZES, 9216 * 0.2, 2));
  });

  it('moves up a size once a copy would be stretched more than the tolerance', () => {
    expect(MAP_UPSCALE_TOLERANCE).toBe(1.25);
    expect(pickMapImageSize(SIZES, 2304 * 1.25, 1)).toBe(0);
    expect(pickMapImageSize(SIZES, 2304 * 1.25 + 1, 1)).toBe(1);
    expect(pickMapImageSize(SIZES, 4608 * 1.25, 1)).toBe(1);
    expect(pickMapImageSize(SIZES, 4608 * 1.25 + 1, 1)).toBe(2);
  });

  it('loads the full map only when zoomed in past the middle copy', () => {
    // 1x screen: the middle copy holds up to scale 0.625; 2x screen: to 0.3125.
    expect(pickMapImageSize(SIZES, 9216 * 0.6, 1)).toBe(1);
    expect(pickMapImageSize(SIZES, 9216 * 0.7, 1)).toBe(2);
    expect(pickMapImageSize(SIZES, 9216 * 0.3, 2)).toBe(1);
    expect(pickMapImageSize(SIZES, 9216 * 0.35, 2)).toBe(2);
    expect(pickMapImageSize(SIZES, 9216 * 5, 2)).toBe(2);
  });

  it('falls back to the smallest copy for bad input, and to a 1x screen for a bad dpr', () => {
    expect(pickMapImageSize(SIZES, Number.NaN, 1)).toBe(0);
    expect(pickMapImageSize(SIZES, -50, 1)).toBe(0);
    expect(pickMapImageSize(SIZES, 0, 1)).toBe(0);
    expect(pickMapImageSize(SIZES, 9216 * 0.2, 0)).toBe(0);
    expect(pickMapImageSize(SIZES, 9216 * 0.2, Number.NaN)).toBe(0);
  });
});

describe('MAP_IMAGE.sizes', () => {
  it('runs smallest to largest and ends with the full map', () => {
    const widths = MAP_IMAGE.sizes.map(s => s.width);
    expect(widths).toEqual([...widths].sort((a, b) => a - b));
    expect(MAP_IMAGE.sizes[MAP_IMAGE.sizes.length - 1]).toEqual({ width: MAP_IMAGE.width, src: MAP_IMAGE.src });
  });

  it('every copy is on disk with the full map\'s aspect ratio, so overlays line up on any of them', () => {
    // scripts/gen-map-sizes.py makes them; this fails if one is missing or resized.
    for (const { width, src } of MAP_IMAGE.sizes) {
      const size = webpSize(`public/${file(src)}`);
      expect(size.width, file(src)).toBe(width);
      expect(size.height, file(src)).toBe(Math.round(width * MAP_IMAGE.height / MAP_IMAGE.width));
    }
    const lo = webpSize(`public/${file(MAP_IMAGE.srcLo)}`);
    expect(Math.abs(lo.height - lo.width * MAP_IMAGE.height / MAP_IMAGE.width)).toBeLessThan(1);
  });

  it('the copies smaller than the full map are exact halvings, so each chunk is a whole number of pixels', () => {
    for (const { width } of MAP_IMAGE.sizes) {
      const chunkPx = (width / MAP_IMAGE.width) * 192;
      expect(Number.isInteger(chunkPx), `${width}`).toBe(true);
    }
  });

  it('picks by drawn scale through the real size list', () => {
    expect(file(mapImageSrcForScale(0.2, 1))).toBe('osrs_world_map_2304.webp');
    expect(file(mapImageSrcForScale(0.2, 2))).toBe('osrs_world_map_4608.webp');
    expect(file(mapImageSrcForScale(1, 1))).toBe('osrs_world_map.webp');
    expect(mapImageIndexForScale(0.2, 1)).toBe(0);
  });
});
