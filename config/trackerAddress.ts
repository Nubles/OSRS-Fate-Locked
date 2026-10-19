/**
 * Where the tracker is served. Saves live in the browser's storage for one
 * address (origin), and the current one, nubles.github.io, is shared with
 * other sites, which can read and rewrite them (critique SAVE-1 and SEC-1).
 * The tracker is moving to an address of its own, and the move tool
 * (utils/originMove.ts) carries players' runs across.
 *
 * NEW_TRACKER_URL is the one setting for the move. While it is empty the move
 * tool stays hidden on both addresses. Set it, with the trailing slash, once
 * the new address serves this build: for example 'https://fatelocked.github.io/'.
 * The VITE_ variables only exist for local testing with two preview ports.
 */
export const OLD_TRACKER_URL: string =
  import.meta.env.VITE_OLD_TRACKER_URL || 'https://nubles.github.io/OSRS-Fate-Locked/';

export const NEW_TRACKER_URL: string = import.meta.env.VITE_NEW_TRACKER_URL || '';
