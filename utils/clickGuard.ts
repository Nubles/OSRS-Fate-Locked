/**
 * A spend click that lands just after the page moved is refused: the button
 * under the pointer may not be the one the player aimed at (a line loading in
 * above it, a panel opening). Browsers that report layout shifts (Chromium)
 * cover every cause; elsewhere the app notes the moves it makes itself.
 */
export const MOVED_GUARD_MS = 700;

let movedAt = -Infinity;
let watching = false;

/** Note that the layout just moved (for browsers without layout-shift reports). */
export const noteLayoutMoved = (): void => { movedAt = performance.now(); };

/** Start listening for the browser's layout-shift reports. Safe to call often. */
export const watchLayoutShifts = (): void => {
  if (watching || typeof PerformanceObserver === 'undefined') return;
  watching = true;
  try {
    new PerformanceObserver(list => {
      for (const entry of list.getEntries() as (PerformanceEntry & { value?: number; hadRecentInput?: boolean })[]) {
        // A shift right after the player's own input is the page answering it, not a surprise.
        if (!entry.hadRecentInput && (entry.value ?? 0) > 0.0005) movedAt = performance.now();
      }
    }).observe({ type: 'layout-shift', buffered: false } as PerformanceObserverInit);
  } catch { /* not supported: only noteLayoutMoved counts */ }
};

/** Whether the layout moved within the last MOVED_GUARD_MS. */
export const movedJustNow = (now = performance.now()): boolean => now - movedAt < MOVED_GUARD_MS;

/** Tests only. */
export const resetClickGuard = (): void => { movedAt = -Infinity; };
