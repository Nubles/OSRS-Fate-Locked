/**
 * Single source of truth for which NAMED areas are free at the start of a run.
 *
 * Normally the whole of Misthalin is free (the classic starter region). The
 * "Xtreme" game mode narrows this to Lumbridge only, so the rest of Misthalin
 * must be unlocked like any other region. The active set is driven by the run's
 * game mode (see GameContext, which calls setStartArea on the locked mode), and
 * read by every region-gating helper via isFreeArea().
 *
 * "Chunked" mode doesn't fit this named-area model at all — its free baseline
 * is a single map-region chunk (see utils/chunkAdjacency.ts CHUNKED_START),
 * not a named region/sub-area. GameContext passes startArea='none' for it, so
 * mainland named areas are not free; exact chunks own the terrain. Tutorial
 * Island remains completed onboarding outside progression in every mode.
 */

import { MISTHALIN_AREAS, REGIONS_LIST } from '../constants';
import { resolveModeRules, type GameModeRules } from '../config/gameModes';

const FULL_MISTHALIN = new Set<string>(['Misthalin', ...MISTHALIN_AREAS]);
const LUMBRIDGE_ONLY = new Set<string>(['Lumbridge']);
const NONE = new Set<string>();

const freeSetFor = (startArea?: string): Set<string> =>
  startArea === 'lumbridge' ? LUMBRIDGE_ONLY : startArea === 'none' ? NONE : FULL_MISTHALIN;

let current: Set<string> = FULL_MISTHALIN;

/** Set the free baseline from a mode's startArea ('lumbridge' | 'misthalin' | 'none'). */
export const setStartArea = (startArea?: string): void => {
  current = freeSetFor(startArea);
};

const UNLOCKABLE_AREAS_BY_START = new Map<string | undefined, string[]>();

/**
 * Every named area a run unlocks through the Areas table: the areas outside
 * Misthalin, plus each Misthalin area its mode does not free (legacy Xtreme
 * frees only Lumbridge). The roll pool, its availability check and the
 * completion total all read this list. Chunked runs unlock chunks instead,
 * so theirs stays the areas outside Misthalin.
 */
export const unlockableAreas = (gameModeId?: string, customMode?: GameModeRules): string[] => {
  if (gameModeId === 'chunked') return REGIONS_LIST;
  const startArea = resolveModeRules(gameModeId, customMode).startArea;
  let areas = UNLOCKABLE_AREAS_BY_START.get(startArea);
  if (!areas) {
    const free = freeSetFor(startArea);
    const locked = MISTHALIN_AREAS.filter(area => !free.has(area));
    areas = locked.length > 0 ? [...locked, ...REGIONS_LIST] : REGIONS_LIST;
    UNLOCKABLE_AREAS_BY_START.set(startArea, areas);
  }
  return areas;
};

/** Is this region / sub-area free from the start of the run? */
export const isFreeArea = (name: string): boolean => name === 'Tutorial Island' || current.has(name);

/** The current free baseline as a list — exported to the RuneLite bundle so
 *  the plugin doesn't have to guess the mode's start area (it used to hardcode
 *  full Misthalin, which over-unlocked Lumbridge-only starts in-game). */
export const getFreeAreas = (): string[] => ['Tutorial Island', ...current];
