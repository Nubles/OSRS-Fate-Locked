import type { GameModeRules } from '../config/gameModes';
import { useState, useEffect, useRef } from 'react';
import { Achievement, ACHIEVEMENTS, earnedIds } from '../utils/achievements';

/**
 * Watches `unlocks` and surfaces achievements that JUST flipped from
 * locked → earned, so the UI can fire a celebratory reveal. Mirrors the
 * pattern of useUnlockReveal: a baseline is captured on first mount (so
 * already-earned achievements don't all fire at once on load).
 *
 * Returns [newlyEarned | null, dismiss, revealId]. Every reveal gets a new
 * id, as in useUnlockReveal, so the panel can be keyed by it.
 */
export function useAchievementReveal(unlocks: any, gameModeId?: string, customMode?: GameModeRules): [Achievement[] | null, () => void, number] {
  const prevRef = useRef<Set<string> | null>(null);
  const idRef = useRef(0);
  const [newly, setNewly] = useState<{ id: number; achievements: Achievement[] } | null>(null);

  useEffect(() => {
    const earned = earnedIds(unlocks, gameModeId, customMode);
    const prev = prevRef.current;
    prevRef.current = earned;

    // First mount — establish baseline, no reveal.
    if (!prev) return;

    const fresh = ACHIEVEMENTS.filter((a) => earned.has(a.id) && !prev.has(a.id));
    if (fresh.length > 0) setNewly({ id: ++idRef.current, achievements: fresh });
  }, [unlocks, gameModeId, customMode]);

  const revealId = newly?.id ?? 0;
  // Only dismiss the reveal this render showed (see useUnlockReveal).
  const dismiss = () => setNewly((current) => (current?.id === revealId ? null : current));
  return [newly?.achievements ?? null, dismiss, revealId];
}
