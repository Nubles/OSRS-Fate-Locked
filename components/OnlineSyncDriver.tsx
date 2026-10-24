import { useEffect, useRef, useState } from 'react';
import { useGame } from '../context/GameContext';
import { relaySync, relayRetryDelayMs } from '../services/relaySync';
import type { UnlockState } from '../types';
import { importWithRetry } from '../utils/lazyRetry';
import type { RuneliteRunInput } from '../utils/runeliteExport';

// The bundle builder loads with the first publish, so a tracker that is not
// paired with RuneLite never downloads it. A failed load is a failed publish:
// shown as the relay error and tried again on the usual backoff.
const loadRuneliteExport = () => importWithRetry(() => import('../utils/runeliteExport'));

/**
 * A publish waits until run changes have paused this long… Rolls come a few
 * seconds apart, and each publish is one of the relay's 1,000 KV writes a
 * day for every player, so a burst of rolls goes out once.
 */
export const PUBLISH_QUIET_MS = 15_000;
/**
 * …but no longer than this while they never pause. Leaving the tab (for the
 * game client) sends a waiting publish at once, so this bounds only the wait
 * of a player who keeps the tracker in front.
 */
export const PUBLISH_MAX_WAIT_MS = 120_000;
/** Shown by a tab that is not saving this profile (the save banners say why). */
export const NOT_SAVING_PUBLISH_MESSAGE =
  "This tab isn't saving this profile, so it can't publish to RuneLite.";

/**
 * Invisible, always-mounted driver: while paired, publishes the run bundle to
 * the relay. Every reducer action bumps runRevision and every publish is a
 * full KV write, so changes are coalesced: one publish of the newest state
 * once they pause, with at most one publish in flight, and a profile the
 * relay already holds (the same fingerprint, sent under six hours ago) is not
 * sent again (relaySync.alreadyPublished). Pairing and Retry publish at once,
 * whatever the relay holds. A bundle built from failed rules data is never sent: the
 * failure is shown as the relay error and the last good publish stays. Only
 * the tab that holds this profile's save lease publishes: another tab of the
 * same profile may hold older progress, and RuneLite would enforce it.
 *
 * A failed publish is tried again by itself after 15 s, 1 min, then every
 * 5 min (relayRetryDelayMs) until one works, unless retrying can't help (the
 * relay refused the pairing or the profile). RelayPublishBanner says so.
 */
export function OnlineSyncDriver() {
  const { unlocks, runId, runRevision, keys, specialKeys, chaosKeys, fatePoints, activeBuff, pinnedGoals, linkedAccount, gameModeId, customMode, bossStandardKeysAwarded, saveOwnershipStatus } = useGame() as any;
  const [, force] = useState(0);
  useEffect(() => relaySync.subscribe(() => force((n) => n + 1)), []);
  const enabled = relaySync.enabled;
  const sessionCode = relaySync.code;
  const pushRequestRevision = relaySync.pushRequestRevision;

  // A publish builds from the state current when it starts, not when scheduled.
  const latestRun = useRef<[UnlockState, RuneliteRunInput]>(null!);
  latestRun.current = [unlocks, { runId, runRevision, keys, specialKeys, chaosKeys, fatePoints, activeBuff, pinnedGoals, linkedAccount, gameModeId: gameModeId ?? 'vanilla', customMode, bossStandardKeysAwarded }];
  const schedule = useRef<((immediate: boolean) => void) | null>(null);
  const seenPushRequest = useRef(pushRequestRevision);
  const ownership = useRef(saveOwnershipStatus);
  ownership.current = saveOwnershipStatus;

  // One publisher per pairing session; a new code or unmount cancels it.
  useEffect(() => {
    if (!enabled || !sessionCode) return;
    let cancelled = false;
    let timer: number | null = null;
    let retryTimer: number | null = null;
    let pendingSince: number | null = null;
    let inFlight = false;
    let again = false;
    let explicit = false;
    const isCurrent = () => !cancelled && relaySync.code === sessionCode;

    const clearRetry = () => {
      if (retryTimer != null) window.clearTimeout(retryTimer);
      retryTimer = null;
    };
    // After a failure, try again by itself once the backoff has passed. Any
    // publish before then (a run change, Retry) replaces the scheduled one.
    const scheduleRetry = () => {
      clearRetry();
      if (!isCurrent() || relaySync.status !== 'error' || !relaySync.retryable) {
        if (isCurrent()) relaySync.setRetryAt(null);
        return;
      }
      const delay = relayRetryDelayMs(relaySync.failures);
      relaySync.setRetryAt(Date.now() + delay);
      retryTimer = window.setTimeout(() => {
        retryTimer = null;
        schedule.current?.(true);
      }, delay);
    };

    const publish = async (): Promise<void> => {
      if (timer != null) window.clearTimeout(timer);
      timer = null;
      pendingSince = null;
      clearRetry();
      // Only the saving tab publishes. While the lease is still being checked,
      // wait: a publish follows once this tab holds it. A blocked tab says why
      // instead of showing "syncing" forever; retrying can't help it.
      if (ownership.current !== 'owner') {
        relaySync.setRetryAt(null);
        if (ownership.current === 'blocked' && relaySync.lastError !== NOT_SAVING_PUBLISH_MESSAGE) {
          relaySync.reportPushFailure(new Error(NOT_SAVING_PUBLISH_MESSAGE), false);
        }
        return;
      }
      if (inFlight) {
        again = true;
        return;
      }
      inFlight = true;
      const retryFailedLoads = explicit;
      explicit = false;
      let runeliteExport: Awaited<ReturnType<typeof loadRuneliteExport>> | null = null;
      try {
        runeliteExport = await loadRuneliteExport();
        const [unlocks, run] = latestRun.current;
        const { compressed, fingerprint } = await runeliteExport.buildBundlePayload(unlocks, run, {
          requireRulesData: true, retryFailedLoads,
        });
        // An unchanged profile: nothing RuneLite uses differs from what the relay holds.
        if (isCurrent() && !(!retryFailedLoads && relaySync.alreadyPublished(fingerprint, run.runRevision))) {
          await relaySync.push(compressed, isCurrent, { fingerprint, runRevision: run.runRevision });
        }
      } catch (error) {
        if (isCurrent()) relaySync.reportPushFailure(error);
        // A profile switch overlapped the build: send the new run once it settles.
        if (runeliteExport && error instanceof runeliteExport.RunChangedError) schedule.current?.(false);
      } finally {
        inFlight = false;
        if (again && !cancelled) {
          again = false;
          void publish();
        } else if (!cancelled && timer == null) {
          scheduleRetry();
        }
      }
    };

    schedule.current = (immediate) => {
      if (timer != null) window.clearTimeout(timer);
      if (immediate) explicit = true;
      const now = Date.now();
      pendingSince ??= now;
      const delay = immediate
        ? 0
        : Math.min(PUBLISH_QUIET_MS, pendingSince + PUBLISH_MAX_WAIT_MS - now);
      timer = window.setTimeout(() => { void publish(); }, Math.max(0, delay));
    };
    schedule.current(false);
    // Switching to the game client hides this tab. Send a waiting publish now
    // so RuneLite doesn't wait out the quiet period for the latest rules.
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && timer != null) void publish();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      cancelled = true;
      schedule.current = null;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (timer != null) window.clearTimeout(timer);
      clearRetry();
      relaySync.setRetryAt(null, true);
    };
  }, [enabled, sessionCode]);

  // Pairing and Retry: publish now so the pairing dialog isn't kept waiting.
  // Declared after the publisher effect, which a new pairing recreates first.
  useEffect(() => {
    if (seenPushRequest.current === pushRequestRevision) return;
    seenPushRequest.current = pushRequestRevision;
    schedule.current?.(true);
  }, [pushRequestRevision]);

  // Run changes, and this tab taking over saving: publish once they pause.
  useEffect(() => {
    schedule.current?.(false);
  }, [
    unlocks, runId, runRevision, keys, specialKeys, chaosKeys, fatePoints,
    activeBuff, pinnedGoals, linkedAccount, gameModeId, customMode, saveOwnershipStatus,
  ]);

  return null;
}

export default OnlineSyncDriver;
