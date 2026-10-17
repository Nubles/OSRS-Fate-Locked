import { placeOf } from './chunkLocations';

/** "Draynor Village (48, 52)": a chunk's place with its coordinates, as Chunked blockers name it. */
export const chunkPlaceLabel = (cx: number, cy: number): string => {
  const { label } = placeOf(cx, cy);
  if (label.endsWith(')')) return label.charAt(0).toUpperCase() + label.slice(1);
  return `${label.split(' · ')[0]} (${cx}, ${cy})`;
};
