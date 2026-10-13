/**
 * The crash report itself, loaded on the first error so the startup bundle
 * only carries utils/errorBeacon.ts. POSTs {build, kind, message, stack, path}
 * (at most 8 KB) to the relay's `/e` endpoint.
 *
 * What it sends is deliberately thin: the build id, the error's message and
 * stack, and `location.pathname`. Never the query or hash (the hash can carry
 * a RuneLite pairing code), never save data, profile names, RSNs or tokens.
 * Query strings and fragments are cut from any URL inside the message or
 * stack, and double-quoted text (where JSON.parse quotes its input) is blanked.
 *
 * At most 5 reports per page load, identical ones once. It never throws and
 * never waits: sendBeacon, falling back to a keepalive fetch.
 *
 * It imports nothing from the app, so it still loads and reports when one of
 * the app's own modules threw while loading (a blank page).
 */
export type ErrorKind = 'boundary' | 'panel' | 'error' | 'rejection';

export const MAX_REPORTS = 5;
export const MAX_BYTES = 8000;
const seen = new Set<string>();

const scrub = (text: string, max: number) =>
  text
    .replace(/(\w+:\/\/[^\s?#'"()]*)[?#][^\s'"()]*/g, '$1')
    .replace(/"[^"\n]*"/g, '"…"')
    .slice(0, max);

/** `relayBase` is relaySync.base(), resolved by the caller. */
export function sendErrorReport(relayBase: string, kind: ErrorKind, error: unknown): void {
  try {
    if (seen.size >= MAX_REPORTS) return;
    const err = error instanceof Error ? error : null;
    const message = scrub(err ? `${err.name}: ${err.message}` : String(error), 1000);
    let stack = scrub(err?.stack ?? '', 4000);
    // "Script error." (cross-origin, no detail) and browser extensions aren't ours.
    if (/^Script error\.?$/.test(message) || /-extension:\/\//.test(stack)) return;
    const key = message + stack;
    if (seen.has(key)) return;
    seen.add(key);
    let body: string;
    do {
      body = JSON.stringify({ build: __BUILD_ID__, kind, message, stack, path: location.pathname.slice(0, 200) });
      stack = stack.slice(0, stack.length >> 1);
    } while (new Blob([body]).size > MAX_BYTES);
    const url = `${relayBase}/e`;
    // A plain string goes as text/plain, which needs no CORS preflight.
    if (!navigator.sendBeacon?.(url, body)) {
      fetch(url, { method: 'POST', body, keepalive: true }).catch(() => {});
    }
  } catch {
    // Reporting must never become a second crash.
  }
}
