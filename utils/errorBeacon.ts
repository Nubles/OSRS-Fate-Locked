/**
 * Crash reports for the owner, so a broken deploy shows up without a player
 * having to say so. Both error boundaries call reportError, and uncaught
 * errors and unhandled rejections are caught here. The report itself (what is
 * sent, limits, dedupe) is utils/errorReport.ts, loaded on the first error to
 * keep this startup-bundle part small.
 *
 * Off in dev and tests. A stale-deploy chunk error is left to the boundaries'
 * reload, and reported only when that reload has just happened and didn't
 * fix it; boundaries therefore call reportError before reloading.
 */
import { relaySync } from '../services/relaySync';
import { chunkReloadRecent, isChunkLoadError } from './chunkLoadError';
import type { ErrorKind } from './errorReport';

const enabled = () => import.meta.env.PROD && import.meta.env.MODE !== 'test';

export function reportError(kind: ErrorKind, error: unknown): void {
  try {
    if (!enabled() || (isChunkLoadError(error as Error) && !chunkReloadRecent())) return;
    const base = relaySync.base();
    import('./errorReport').then((m) => m.sendErrorReport(base, kind, error), () => {});
  } catch {
    // Reporting must never become a second crash.
  }
}

const onError = (event: ErrorEvent) => reportError('error', event.error ?? event.message);
const onRejection = (event: PromiseRejectionEvent) => reportError('rejection', event.reason);

/** Report uncaught errors and unhandled rejections; returns the uninstaller. */
export function installErrorBeacon(): () => void {
  if (enabled()) {
    addEventListener('error', onError);
    addEventListener('unhandledrejection', onRejection);
  }
  return () => {
    removeEventListener('error', onError);
    removeEventListener('unhandledrejection', onRejection);
  };
}

// On import, so index.tsx's first import catches errors thrown while the rest
// of the app's modules load (a blank page), not just after it has rendered.
installErrorBeacon();
