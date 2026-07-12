/**
 * Lazy-loading that survives flaky networks.
 *
 * React.lazy caches a REJECTED import promise forever: one transient fetch
 * failure (dropped Wi-Fi, mid-deploy 404, mobile radio waking up) bricks that
 * section for the whole session — remounting re-throws the cached rejection
 * and only a full page reload recovers. So every lazy() call site in the app
 * goes through lazyWithRetry, which retries the import with backoff BEFORE
 * lazy ever sees a rejection. Genuine rejections that remain are almost
 * always a stale deploy, which PanelErrorBoundary handles by reloading
 * (utils/chunkLoadError.ts).
 */
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { isChunkLoadError } from './chunkLoadError';

/** Run a dynamic import, retrying transient failures with exponential backoff. */
export async function importWithRetry<T>(
  importer: () => Promise<T>,
  attempts = 3,
  baseDelayMs = 750,
): Promise<T> {
  let lastError: unknown;
  // Chrome caches a failed module in the module map, so retries of the same
  // URL can reject with a mangled TypeError instead of the original fetch
  // failure. The error boundaries key their reload path off isChunkLoadError,
  // so the first chunk-load error must be the one we ultimately throw.
  let firstChunkError: Error | null = null;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await importer();
    } catch (error) {
      lastError = error;
      if (!firstChunkError && error instanceof Error && isChunkLoadError(error)) {
        firstChunkError = error;
      }
      if (attempt < attempts - 1) {
        await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** attempt));
      }
    }
  }
  throw firstChunkError ?? lastError;
}

/** Drop-in replacement for React.lazy with import retries. */
export function lazyWithRetry<T extends ComponentType<any>>(
  importer: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(() => importWithRetry(importer));
}
