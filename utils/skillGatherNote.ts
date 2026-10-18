/**
 * The note above a skill's Map Gathering list. Its counts are world-wide,
 * not limited to a Chunked run's chunks. Kept apart from worldWording so it
 * loads with the lazy skill windows, not the entry chunk.
 */
const chunked = (gameModeId: string | undefined) => gameModeId === 'chunked';
export const skillGatherNote = (gameModeId: string | undefined): string => chunked(gameModeId)
  ? 'Everything this skill can gather anywhere on the world map, not only in your chunks, grouped by the tier that unlocks it. Click a resource to see its places and jump to its chunk.'
  : 'Everything this skill can gather on the world map, grouped by the tier that unlocks it. Click a resource to pick a region and jump straight there.';
