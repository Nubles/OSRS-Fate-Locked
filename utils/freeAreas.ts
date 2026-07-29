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
 * no named area is free — every named-area check falls through to false, and
 * the chunk-level state is the actual source of truth for that mode.
 */

import { MISTHALIN_AREAS } from '../constants';

const FULL_MISTHALIN = new Set<string>(['Misthalin', ...MISTHALIN_AREAS]);
const LUMBRIDGE_ONLY = new Set<string>(['Lumbridge']);
const NONE = new Set<string>();

let current: Set<string> = FULL_MISTHALIN;

/** Set the free baseline from a mode's startArea ('lumbridge' | 'misthalin' | 'none'). */
export const setStartArea = (startArea?: string): void => {
  current = startArea === 'lumbridge' ? LUMBRIDGE_ONLY : startArea === 'none' ? NONE : FULL_MISTHALIN;
};

/** Is this region / sub-area free from the start of the run? */
export const isFreeArea = (name: string): boolean => current.has(name);

/** The current free baseline as a list — exported to the RuneLite bundle so
 *  the plugin doesn't have to guess the mode's start area (it used to hardcode
 *  full Misthalin, which over-unlocked Lumbridge-only starts in-game). */
export const getFreeAreas = (): string[] => [...current];
