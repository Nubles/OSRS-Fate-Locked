import { chunkLabel, parseChunkKey } from './chunkAdjacency';

/**
 * A chunk's area and its coordinates, "Lumbridge (49, 50)": how a chunk
 * unlock reads in History, the Discord feed and /progress, where the bare
 * key "49,50" said nothing. chunkLabel already ends in the coordinates for a
 * chunk no area names, so those are not added twice. The reducer logs this,
 * so it stays light enough for the entry chunk; screens that load lazily use
 * chunkPlaceLabel (utils/chunkPlaceLabel.ts) for the chunk's own name.
 */
export const chunkLabelWithCoords = (key: string): string => {
  const label = chunkLabel(key);
  const { cx, cy } = parseChunkKey(key);
  const coords = `(${cx}, ${cy})`;
  return label.endsWith(coords) ? label : `${label} ${coords}`;
};
