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
 *  failure turns out not to be a stale-chunk issue (e.g. offline). Callers go
 *  through reloadIfNewBuild so a dropped connection doesn't trigger it. */
export const reloadOnceForChunkError = (): boolean => {
  if (chunkReloadRecent()) return false; // already tried recently — don't loop
  sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
  window.location.reload();
  return true;
};

/** Which build the server has live, compared with the one this tab runs.
 *  'unknown' when version.json can't be read (offline, connection reset) or
 *  in dev, where there is no version.json. */
export const checkLiveBuild = async (): Promise<'newer' | 'same' | 'unknown'> => {
  if (typeof __BUILD_ID__ === 'undefined') return 'unknown';
  try {
    const base = (import.meta as any).env?.BASE_URL ?? '/';
    const res = await fetch(`${base}version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return 'unknown';
    const { build } = await res.json();
    if (!build) return 'unknown';
    return build === __BUILD_ID__ ? 'same' : 'newer';
  } catch {
    return 'unknown';
  }
};

/** Reload for a chunk error only when a newer build is live. When the import
 *  failed because the connection dropped, a reload would most likely fail too
 *  and leave the player on the browser's "This site can't be reached" page, so
 *  the error boundary's own Reload button is left for them instead. */
export const reloadIfNewBuild = async (): Promise<boolean> => {
  if ((await checkLiveBuild()) !== 'newer') return false;
  return reloadOnceForChunkError();
};
