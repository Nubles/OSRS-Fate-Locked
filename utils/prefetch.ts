/**
 * Warm the heaviest lazy chunks during browser idle time, so opening a modal
 * or the map pays no fetch+parse cost on the click. Each dynamic import is
 * deduped by the bundler/browser, so calling it here just moves the work off
 * the critical interaction path into idle time. Runs once, one chunk at a
 * time, and never blocks — if the browser is busy, idle callbacks simply wait.
 */

// Same module specifiers the lazy() call sites use, so they resolve to the
// exact same chunks (no duplicate fetch).
const IMPORTERS: Array<() => Promise<unknown>> = [
  () => import('../components/HeaderSettingsMenu'), // the classic gear menu, small and opened by click
  () => import('../components/RegionMap'),
  () => import('../components/StatsModal'),
  () => import('../components/StatsChartsView'), // pulls recharts in advance
  () => import('../components/SupplyChainCalculator'),
  () => import('../components/ReferenceModal'),
  () => import('../components/SkillDetailModal'),
  () => import('../components/VoidAltar'),
  () => import('../components/RitualAnimation'),
];

interface ConnectionHints { saveData?: boolean; effectiveType?: string }

/**
 * Whether idle prefetching is worth it on this connection: not when the
 * player asked the browser to save data, and not on a 2G-class link, where
 * these chunks would compete with what the player actually opens.
 */
export function prefetchAllowed(connection: ConnectionHints | undefined): boolean {
  if (!connection) return true;
  if (connection.saveData) return false;
  return connection.effectiveType !== '2g' && connection.effectiveType !== 'slow-2g';
}

let started = false;

/** Call once onboarding is done: a first visit downloads only what it shows. */
export function prefetchHeavyChunks(): void {
  if (started || typeof window === 'undefined') return;
  if (!prefetchAllowed((navigator as Navigator & { connection?: ConnectionHints }).connection)) return;
  started = true;

  const schedule: (cb: () => void) => void =
    typeof (window as any).requestIdleCallback === 'function'
      ? (cb) => (window as any).requestIdleCallback(cb, { timeout: 3000 })
      : (cb) => window.setTimeout(cb, 1500);

  let i = 0;
  const next = () => {
    if (i >= IMPORTERS.length) return;
    const load = IMPORTERS[i++];
    load().catch(() => { /* offline / chunk gone — a real open will retry */ })
      .finally(() => schedule(next));
  };
  // First tick a beat after mount so it never competes with the initial render.
  schedule(next);
}
