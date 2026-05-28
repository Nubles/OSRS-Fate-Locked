import { useState, useEffect, useRef } from 'react';
import { Achievement, ACHIEVEMENTS, earnedIds } from '../utils/achievements';

/**
 * Watches `unlocks` and surfaces achievements that JUST flipped from
 * locked → earned, so the UI can fire a celebratory reveal. Mirrors the
 * pattern of useUnlockReveal: a baseline is captured on first mount (so
 * already-earned achievements don't all fire at once on load).
 *
 * Returns [newlyEarned | null, dismiss].
 */
export function useAchievementReveal(unlocks: any): [Achievement[] | null, () => void] {
  const prevRef = useRef<Set<string> | null>(null);
  const [newly, setNewly] = useState<Achievement[] | null>(null);

  useEffect(() => {
    const earned = earnedIds(unlocks);
    const prev = prevRef.current;
    prevRef.current = earned;

    // First mount — establish baseline, no reveal.
    if (!prev) return;

    const fresh = ACHIEVEMENTS.filter((a) => earned.has(a.id) && !prev.has(a.id));
    if (fresh.length > 0) setNewly(fresh);
  }, [unlocks]);

  const dismiss = () => setNewly(null);
  return [newly, dismiss];
}
