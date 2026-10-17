import { CHUNK_NAMES } from '../data/chunkNames';
import { parseChunkKey } from './chunkAdjacency';
import { chunkLabelWithCoords } from './chunkLabelWithCoords';

/**
 * A chunk's own place name and its coordinates, "Lumbridge Castle Backyard
 * (49, 50)", so the many chunks of one area read apart. The names table is
 * about 6 kB gzip, so only lazily loaded screens import this (the eager
 * reducer logs chunkLabelWithCoords instead); see scripts/check-entry-budget.mjs.
 */
export const chunkPlaceLabel = (key: string): string => {
  const name = CHUNK_NAMES[key];
  if (!name) return chunkLabelWithCoords(key);
  const { cx, cy } = parseChunkKey(key);
  return `${name} (${cx}, ${cy})`;
};
