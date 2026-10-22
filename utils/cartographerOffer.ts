/**
 * The Ritual of the Cartographer's offer: up to three frontier chunks, drawn
 * by fate once and then kept in GameState.cartographerOffer until the ritual
 * charts one of them, or until none of them is still on the frontier. The
 * reducer draws it (CARTOGRAPHER_DRAW_OFFER, when the Altar's chooser opens)
 * and RITUAL_CARTOGRAPHER only charts a chunk from it, so logging more never
 * reshuffles it and no other chunk can be named (audit V4, October 2026).
 *
 * A seeded run draws exactly what GameContext.nextFloat('cartographer', i)
 * would (its seed and versioned history context). An unseeded run has no
 * seed, and Math.random would re-roll the offer on every reload, so it draws
 * from its run id in place of a seed, over the same history context.
 */
import type { GameState } from '../types';
import type { ChunkCoord } from './mapCoords';
import { CHUNKED_START_KEY, getChunkFrontier, isFrontierChunk } from './chunkAdjacency';
import { drawFloat, seededContext } from './seededRng';

export const CARTOGRAPHER_OFFER_SIZE = 3;

type OfferState = Pick<GameState, 'unlocks' | 'history' | 'runId' | 'rngSeed' | 'rngVersion'>;

/**
 * The kept offer's chunks that can still be charted: on the frontier, not
 * held. Empty when nothing is kept, or every kept chunk has left the frontier
 * (another unlock took it); only then does the next draw make a new offer.
 */
export function liveCartographerOffer(state: Pick<GameState, 'unlocks' | 'cartographerOffer'>): string[] {
  const held = state.unlocks.chunks ?? [];
  return (state.cartographerOffer ?? []).filter(key =>
    key !== CHUNKED_START_KEY && !held.includes(key) && isFrontierChunk(key, held, state.unlocks));
}

/** A fresh draw of the offer from the run as it is now. Only the reducer calls it to keep. */
export function drawCartographerOffer(state: OfferState): ChunkCoord[] {
  // Partial Fisher–Yates over the live frontier. The count is fixed before
  // the loop because splice shrinks the pool.
  const pool = getChunkFrontier(state.unlocks.chunks ?? [], state.unlocks);
  const seed = state.rngSeed || `cartographer:${state.runId}`;
  const context = seededContext(state);
  const offer: ChunkCoord[] = [];
  const count = Math.min(CARTOGRAPHER_OFFER_SIZE, pool.length);
  for (let i = 0; i < count; i++) {
    offer.push(pool.splice(Math.floor(drawFloat(seed, context, 'cartographer', i) * pool.length), 1)[0]);
  }
  return offer;
}

/** The hint under an offered chunk, e.g. "bank · 1 shop · 4 monsters". */
export function cartographerHint(content: { bank: boolean; shops: number; monsters: number }): string {
  const bits: string[] = [];
  if (content.bank) bits.push('bank');
  if (content.shops > 0) bits.push(`${content.shops} shop${content.shops === 1 ? '' : 's'}`);
  if (content.monsters > 0) bits.push(`${content.monsters} monster${content.monsters === 1 ? '' : 's'}`);
  return bits.length > 0 ? bits.join(' · ') : 'quiet terrain';
}
