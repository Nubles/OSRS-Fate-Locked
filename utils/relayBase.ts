/**
 * Relay addresses for the stream overlay. The app publishes to
 * `relaySync.base()`: VITE_FATE_RELAY, the `fate_relay_base` override, or the
 * public relay. The overlay must poll the same relay, so a copied overlay URL
 * names any relay other than the public one.
 */

/** The public relay. Matches the default in services/relaySync.ts. */
export const DEFAULT_RELAY_BASE = 'https://fate-relay.fatelocked.workers.dev';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * A relay address taken from an overlay URL, without a trailing slash, or
 * null when the overlay must not poll it. Anyone can hand a streamer an
 * overlay link, so only https is accepted, plus http on this machine for a
 * local `wrangler dev`; credentials, queries and fragments are refused.
 */
export function parseRelayBase(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const secure = url.protocol === 'https:'
    || (url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname));
  if (!secure || url.username || url.password || url.search || url.hash) return null;
  return `${url.origin}${url.pathname}`.replace(/\/+$/, '');
}

/** The OBS overlay URL for a pairing code, naming the relay unless it is the public one. */
export function streamOverlayUrl(appUrl: string, code: string, relayBase: string): string {
  const base = relayBase.replace(/\/+$/, '');
  const relay = base === DEFAULT_RELAY_BASE ? '' : `&relay=${encodeURIComponent(base)}`;
  return `${appUrl}#/overlay?code=${code}${relay}`;
}
