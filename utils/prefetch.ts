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
  () => import('../components/RegionMap'),
  () => import('../components/StatsModal'),
  () => import('../components/StatsChartsView'), // pulls recharts in advance
  () => import('../components/SupplyChainCalculator'),
  () => import('../components/ReferenceModal'),
  () => import('../components/SkillDetailModal'),
];

let started = false;

export function prefetchHeavyChunks(): void {
  if (started || typeof window === 'undefined') return;
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
