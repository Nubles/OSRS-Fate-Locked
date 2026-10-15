import { useState, useEffect, useMemo, useRef } from 'react';
import type { Achievement, AchievementRun } from '../utils/achievements';
import type { AchievementPayout } from '../utils/achievementRewards';

type Catalog = typeof import('../utils/achievements');

let catalogLoad: Promise<Catalog> | null = null;
let loadedCatalog: Catalog | null = null;

/** Load the achievement list (once); later mounts get it at once. */
export function loadAchievementCatalog(): Promise<Catalog> {
  catalogLoad ??= import('../utils/achievements').then(
    (m) => (loadedCatalog = m),
    (error) => {
      catalogLoad = null; // try again on the next mount
      throw error;
    },
  );
  return catalogLoad;
}

/**
 * The achievement list, loaded after startup: every achievement's check is
 * too heavy for the first download. Null until it arrives.
 */
export function useAchievementCatalog(): Catalog | null {
  const [catalog, setCatalog] = useState<Catalog | null>(loadedCatalog);
  useEffect(() => {
    if (catalog) return;
    let live = true;
    loadAchievementCatalog().then((m) => live && setCatalog(m), () => {});
    return () => {
      live = false;
    };
  }, [catalog]);
  return catalog;
}

interface Options {
  /** Settled achievement ids (GameState.achievementsClaimed). */
  claimed: readonly string[] | undefined;
  /** Pays what is earned and not yet settled. */
  settle: (earned: AchievementPayout[]) => void;
  /** Bumps when the whole run is replaced (import, restore, reset). */
  replacements: number;
}

/**
 * Watches the run and surfaces achievements that JUST flipped from locked →
 * earned, so the UI can fire a celebratory reveal. Mirrors the pattern of
 * useUnlockReveal: a baseline is captured once the achievement list has
 * loaded and whenever the run is replaced (so already-earned achievements
 * don't all fire at once).
 *
 * It also asks the game to settle rewards whenever an earned achievement
 * isn't settled yet; the reducer decides what is actually paid.
 *
 * Returns [newlyEarned | null, dismiss, revealId]. Every reveal gets a new
 * id, as in useUnlockReveal, so the panel can be keyed by it.
 */
export function useAchievementReveal(run: AchievementRun, { claimed, settle, replacements }: Options): [Achievement[] | null, () => void, number] {
  const catalog = useAchievementCatalog();
  const prevRef = useRef<{ earned: Set<string>; replacements: number } | null>(null);
  const idRef = useRef(0);
  const [newly, setNewly] = useState<{ id: number; achievements: Achievement[] } | null>(null);
  const { unlocks, history, gameModeId, customMode, petsClaimed } = run;
  const payouts = useMemo(
    () => catalog?.achievementPayouts({ unlocks, history, gameModeId, customMode, petsClaimed }) ?? null,
    [catalog, unlocks, history, gameModeId, customMode, petsClaimed],
  );

  useEffect(() => {
    if (!catalog || !payouts) return;
    const earned = new Set(payouts.map((a) => a.id));
    const prev = prevRef.current;
    prevRef.current = { earned, replacements };

    // List just loaded or the run was replaced — establish baseline, no reveal.
    if (!prev || prev.replacements !== replacements) return;

    const fresh = catalog.ACHIEVEMENTS.filter((a) => earned.has(a.id) && !prev.earned.has(a.id));
    if (fresh.length > 0) setNewly({ id: ++idRef.current, achievements: fresh });
  }, [catalog, payouts, replacements]);

  useEffect(() => {
    if (!payouts) return;
    const settled = new Set(claimed ?? []);
    if (claimed === undefined || payouts.some((a) => !settled.has(a.id))) settle(payouts);
  }, [payouts, claimed, settle]);

  const revealId = newly?.id ?? 0;
  // Only dismiss the reveal this render showed (see useUnlockReveal).
  const dismiss = () => setNewly((current) => (current?.id === revealId ? null : current));
  return [newly?.achievements ?? null, dismiss, revealId];
}
