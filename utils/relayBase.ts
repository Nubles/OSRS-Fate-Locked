/**
 * Relay addresses for the stream overlay. The app publishes to
 * `relaySync.base()` (resolveRelayBase): VITE_FATE_RELAY, in development the
 * `fate_relay_base` override, or the public relay. The overlay must poll the same relay, so a copied overlay URL
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

/**
 * The relay this app publishes to: backup uploads and deletes, progress and
 * RuneLite publishes, each with its write token. A build-time VITE_FATE_RELAY
 * wins. The `fate_relay_base` localStorage override is honoured only in
 * development and tests: other pages on nubles.github.io share this
 * storage, so in production an override could send every token to them
 * (SEC-1). Even in development it must pass parseRelayBase.
 */
export function resolveRelayBase(options: {
  env?: string | null;
  override?: string | null;
  dev: boolean;
}): string {
  if (options.env) return options.env.replace(/\/+$/, '');
  if (options.dev && options.override) {
    const parsed = parseRelayBase(options.override);
    if (parsed !== null) return parsed;
  }
  return DEFAULT_RELAY_BASE;
}

/** The OBS overlay URL for a pairing code, naming the relay unless it is the public one. */
export function streamOverlayUrl(appUrl: string, code: string, relayBase: string): string {
  const base = relayBase.replace(/\/+$/, '');
  const relay = base === DEFAULT_RELAY_BASE ? '' : `&relay=${encodeURIComponent(base)}`;
  return `${appUrl}#/overlay?code=${code}${relay}`;
}
