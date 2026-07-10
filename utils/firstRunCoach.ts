/**
 * First-run coach — which guided step (if any) a run should see.
 *
 * Pure derivation from game state, same philosophy as featureGates.ts:
 * mature runs and imports auto-graduate to null with no migration. The
 * driver (components/FirstRunCoachDriver.tsx) owns persistence of the
 * per-profile done flag and passes it in.
 */
import type { GameState } from '../types';

export type CoachStepId = 'roll' | 'spend' | 'done';

/** The slice of GameState the coach reads — keeps tests tiny. */
export type CoachInput = Pick<GameState, 'history' | 'revealAllFeatures'>;

/** History window beyond which a run with unlocks is "mature" — never coach it. */
const DONE_WINDOW = 4;

export function coachStep(s: CoachInput, done: boolean): CoachStepId | null {
  if (done || s.revealAllFeatures) return null;
  const hasUnlock = s.history.some((h) => h.type === 'UNLOCK');
  if (hasUnlock) return s.history.length <= DONE_WINDOW ? 'done' : null;
  if (s.history.length === 0) return 'roll';
  if (s.history.length < 3) return 'spend';
  return null; // rolled ≥3 times without spending — stop nagging
}
