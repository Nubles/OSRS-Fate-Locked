/**
 * World-screen wording that differs in Chunked, where the player owns map
 * chunks rather than named areas. Other modes keep their area wording.
 */
const chunked = (gameModeId: string | undefined) => gameModeId === 'chunked';

/** The line under the World heading about Tutorial Island. */
export const tutorialIslandNote = (gameModeId: string | undefined): string => chunked(gameModeId)
  ? 'Tutorial Island is completed onboarding: always free, with no chunk needed.'
  : 'Tutorial Island is completed onboarding: always free, with no area roll required.';

/**
 * Misthalin's name in the World lists, from the run's start area as its mode
 * rules give it (resolveModeRules(...).startArea). Only a whole-Misthalin
 * start ('misthalin', the default when unset) frees Misthalin, so only that
 * start calls it the starter area; a Lumbridge-only start (legacy Xtreme) or
 * Chunked's 'none' shows plain 'Misthalin'.
 */
export const misthalinListName = (startArea: string | undefined): string =>
  !startArea || startArea === 'misthalin' ? 'Misthalin (Starter Area)' : 'Misthalin';

