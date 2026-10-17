/**
 * The Ritual of the Cartographer's offer: up to three frontier chunks, drawn
 * deterministically from the run itself, so reopening the altar or reloading
 * the page shows the same three until something is logged.
 *
 * A seeded run draws exactly what GameContext.nextFloat('cartographer', i)
 * would (its seed and versioned history context). An unseeded run has no
 * seed, and Math.random would re-roll the offer on every reload, so it draws
 * from its run id in place of a seed, over the same history context.
 */
import type { GameState } from '../types';
import type { ChunkCoord } from './mapCoords';
import { getChunkFrontier } from './chunkAdjacency';
import { drawFloat, seededContext } from './seededRng';

export const CARTOGRAPHER_OFFER_SIZE = 3;

type OfferState = Pick<GameState, 'unlocks' | 'history' | 'runId' | 'rngSeed' | 'rngVersion'>;

export function cartographerOffer(state: OfferState): ChunkCoord[] {
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
