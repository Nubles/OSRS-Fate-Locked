import { MAP_IMAGE } from './mapCoords';

/**
 * Which size of the world map image to load (MAP_IMAGE.sizes). The full map is
 * 9216 px wide: a 6 MB download that takes about 240 MB of memory once
 * decoded, which phones can't spare. Most views draw the whole map far
 * smaller than that, so they load the smallest copy that still looks sharp
 * and switch to a bigger one only when the player zooms in.
 */

/** Screens sharper than 2x get no sharper map: the extra pixels are hard to see and cost a lot more memory. */
export const MAP_DPR_CAP = 2;
/** How far a copy may be stretched before the next bigger one is worth loading. */
export const MAP_UPSCALE_TOLERANCE = 1.25;
/**
 * Windows narrower than this (phones) never load the full map, however far
 * they zoom: its ~240 MB decoded is what gets a tab killed on iOS. They stop
 * at the next size down and accept a slightly soft map when zoomed right in.
 */
export const MAP_FULL_MIN_VIEWPORT = 720;

/**
 * Index in `sizes` (smallest first) of the smallest copy that looks sharp when
 * the whole map is drawn `drawnWidth` CSS px wide on a screen with this
 * devicePixelRatio. In a window narrower than MAP_FULL_MIN_VIEWPORT the
 * largest size (the full map) is never picked. Bad input picks the smallest copy.
 */
export const pickMapImageSize = (
  sizes: readonly { readonly width: number }[],
  drawnWidth: number,
  dpr: number,
  viewportWidth: number = Infinity,
): number => {
  const ratio = Number.isFinite(dpr) && dpr > 0 ? Math.min(dpr, MAP_DPR_CAP) : 1;
  const needed = Number.isFinite(drawnWidth) && drawnWidth > 0 ? drawnWidth * ratio : 0;
  const largest = viewportWidth < MAP_FULL_MIN_VIEWPORT ? Math.max(0, sizes.length - 2) : sizes.length - 1;
  const i = sizes.findIndex(s => s.width * MAP_UPSCALE_TOLERANCE >= needed);
  return i === -1 ? largest : Math.min(i, largest);
};

/** The viewer's devicePixelRatio (1 where there is no window). */
export const screenDpr = (): number =>
  typeof window !== 'undefined' && window.devicePixelRatio > 0 ? window.devicePixelRatio : 1;

/** The window's width in CSS px (unlimited where there is no window). */
export const viewportWidth = (): number =>
  typeof window !== 'undefined' && window.innerWidth > 0 ? window.innerWidth : Infinity;

/**
 * Index into MAP_IMAGE.sizes for a map drawn at `scale` CSS px per map pixel
 * (the scale in a `scale(...)` transform of the 9216-px-wide map surface).
 */
export const mapImageIndexForScale = (scale: number, dpr: number = screenDpr(), viewport: number = viewportWidth()): number =>
  pickMapImageSize(MAP_IMAGE.sizes, MAP_IMAGE.width * scale, dpr, viewport);

/** The map image URL for a map drawn at `scale` CSS px per map pixel. */
export const mapImageSrcForScale = (scale: number, dpr: number = screenDpr(), viewport: number = viewportWidth()): string =>
  MAP_IMAGE.sizes[mapImageIndexForScale(scale, dpr, viewport)].src;
