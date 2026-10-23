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

