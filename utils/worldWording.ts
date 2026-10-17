/**
 * World-screen wording that differs in Chunked, where the player owns map
 * chunks rather than named areas. Other modes keep their area wording.
 */
const chunked = (gameModeId: string | undefined) => gameModeId === 'chunked';

/** The line under the World heading about Tutorial Island. */
export const tutorialIslandNote = (gameModeId: string | undefined): string => chunked(gameModeId)
  ? 'Tutorial Island is completed onboarding: always free, with no chunk needed.'
  : 'Tutorial Island is completed onboarding: always free, with no area roll required.';

/** Misthalin's name in the World lists: free to start with only outside Chunked. */
export const misthalinListName = (gameModeId: string | undefined): string => chunked(gameModeId)
  ? 'Misthalin'
  : 'Misthalin (Starter Area)';

/** The note above a skill's Map Gathering list. Its counts are world-wide, not limited to owned chunks. */
export const skillGatherNote = (gameModeId: string | undefined): string => chunked(gameModeId)
  ? 'Everything this skill can gather anywhere on the world map, not only in your chunks, grouped by the tier that unlocks it. Click a resource to see its places and jump to its chunk.'
  : 'Everything this skill can gather on the world map, grouped by the tier that unlocks it. Click a resource to pick a region and jump straight there.';
