import { CHUNK_NAMES } from '../../data/chunkNames';
import { placeOf } from '../chunkLocations';

/** Human names for reading; the original chunk key remains the map/permission identity. */
export const formatQuestChunk = (chunk: string, showCoordinates = false): string => {
  const [cx, cy] = chunk.split(',').map(Number);
  const place = placeOf(cx, cy);
  const name = CHUNK_NAMES[chunk] ?? place.subArea ?? place.region ?? 'Unnamed area';
  return showCoordinates ? `${name} (${chunk})` : name;
};

/** Existing blocker/source prose can also carry chunk references. */
export const nameQuestChunksInText = (text: string, showCoordinates = false): string => (
  text.replace(/\bchunks?\s+(\d+,\d+)\b/gi, (match, chunk: string) => {
    const [cx, cy] = chunk.split(',').map(Number);
    // Replace explicit chunk references only; quantities such as 1,125 stay intact.
    if (`${cx},${cy}` !== chunk || cx > 255 || cy > 255) return match;
    return formatQuestChunk(chunk, showCoordinates);
  })
);
