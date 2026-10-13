/** True for Vite/browser dynamic-import failures caused by a stale deploy —
 *  the chunk file this tab references no longer exists on the server because
 *  a newer build has since overwritten it (hashed filenames change per build). */
export const isChunkLoadError = (error: Error | null | undefined): boolean => {
  const msg = error?.message ?? '';
  return (
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /Loading chunk [\w.-]+ failed/i.test(msg)
  );
};

const RELOAD_FLAG = 'fate_chunk_reload_at';

/** True when this tab reloaded for a chunk error in the last 15s, so the
 *  reload didn't fix it. The error beacon reports chunk errors only then. */
export const chunkReloadRecent = (): boolean => {
  try {
    return Date.now() - Number(sessionStorage.getItem(RELOAD_FLAG) || 0) < 15000;
  } catch {
    return false;
  }
};

/** Reload once to pick up the new build; guards against a reload loop if the
 *  failure turns out not to be a stale-chunk issue (e.g. offline). */
export const reloadOnceForChunkError = (): boolean => {
  if (chunkReloadRecent()) return false; // already tried recently — don't loop
  sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
  window.location.reload();
  return true;
};
