/**
 * Chunked's start-chunk milestone: while a run holds only its start chunk,
 * every CHUNKED_MILESTONE_INTERVAL total levels gives a guaranteed Key (the
 * engine pays it in GameContext's startMilestoneInsurance). This is what the
 * Spend Keys screen shows of it, so the player can see the next one coming.
 */
import { CHUNKED_MILESTONE_INTERVAL } from '../config/economy';
import type { UnlockState } from '../types';

export interface StartChunkMilestone {
  /** The total level that pays the next Key. */
  nextAt: number;
  /** Levels still to gain before it. */
  levelsToGo: number;
  interval: number;
}

export function startChunkMilestone(
  gameModeId: string | undefined,
  unlocks: Pick<UnlockState, 'chunks'>,
  totalLevel: number,
): StartChunkMilestone | null {
  // The same condition the engine pays on: no chunk unlocked beyond the start.
  if (gameModeId !== 'chunked' || (unlocks.chunks ?? []).length > 0) return null;
  const nextAt = (Math.floor(totalLevel / CHUNKED_MILESTONE_INTERVAL) + 1) * CHUNKED_MILESTONE_INTERVAL;
  return { nextAt, levelsToGo: nextAt - totalLevel, interval: CHUNKED_MILESTONE_INTERVAL };
}

/** The Spend Keys line for it. */
export const startChunkMilestoneText = (m: StartChunkMilestone): string =>
  `While you hold only your start chunk, every ${m.interval} total levels gives a guaranteed Key. `
  + `Next at total level ${m.nextAt}: ${m.levelsToGo} level${m.levelsToGo === 1 ? '' : 's'} to go.`;
