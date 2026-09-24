import { useEffect, useRef, useState } from 'react';
import { useGame } from '../context/GameContext';
import { relaySync } from '../services/relaySync';
import { buildBundlePayload } from '../utils/runeliteExport';

/** A publish waits until run changes have paused this long… */
const PUBLISH_QUIET_MS = 5_000;
/** …but no longer than this while they never pause (RuneLite checks once a minute). */
const PUBLISH_MAX_WAIT_MS = 60_000;

/**
 * Invisible, always-mounted driver: while paired, publishes the run bundle to
 * the relay. Every reducer action bumps runRevision and every publish is a
 * full KV write, so changes are coalesced: one publish of the newest state
 * once they pause, with at most one publish in flight. Pairing and Retry
 * publish at once.
 */
export function OnlineSyncDriver() {
  const { unlocks, runId, runRevision, keys, specialKeys, chaosKeys, fatePoints, activeBuff, pinnedGoals, linkedAccount, gameModeId, customMode } = useGame() as any;
  const [, force] = useState(0);
  useEffect(() => relaySync.subscribe(() => force((n) => n + 1)), []);
  const enabled = relaySync.enabled;
  const sessionCode = relaySync.code;
  const pushRequestRevision = relaySync.pushRequestRevision;

  // A publish builds from the state current when it starts, not when scheduled.
  const latestRun = useRef<Parameters<typeof buildBundlePayload>>(null!);
  latestRun.current = [unlocks, { runId, runRevision, keys, specialKeys, chaosKeys, fatePoints, activeBuff, pinnedGoals, linkedAccount, gameModeId: gameModeId ?? 'vanilla', customMode }];
  const schedule = useRef<((immediate: boolean) => void) | null>(null);
  const seenPushRequest = useRef(pushRequestRevision);

  // One publisher per pairing session; a new code or unmount cancels it.
  useEffect(() => {
    if (!enabled || !sessionCode) return;
    let cancelled = false;
    let timer: number | null = null;
    let pendingSince: number | null = null;
    let inFlight = false;
    let again = false;
    const isCurrent = () => !cancelled && relaySync.code === sessionCode;

    const publish = async (): Promise<void> => {
      if (timer != null) window.clearTimeout(timer);
      timer = null;
      pendingSince = null;
      if (inFlight) {
        again = true;
        return;
      }
      inFlight = true;
      try {
        const { compressed } = await buildBundlePayload(...latestRun.current);
        if (isCurrent()) await relaySync.push(compressed, isCurrent);
      } catch (error) {
        if (isCurrent()) relaySync.reportPushFailure(error);
      } finally {
        inFlight = false;
        if (again && !cancelled) {
          again = false;
          void publish();
        }
      }
    };

    schedule.current = (immediate) => {
      if (timer != null) window.clearTimeout(timer);
      const now = Date.now();
      pendingSince ??= now;
      const delay = immediate
        ? 0
        : Math.min(PUBLISH_QUIET_MS, pendingSince + PUBLISH_MAX_WAIT_MS - now);
      timer = window.setTimeout(() => { void publish(); }, Math.max(0, delay));
    };
    schedule.current(false);
    return () => {
      cancelled = true;
      schedule.current = null;
      if (timer != null) window.clearTimeout(timer);
    };
  }, [enabled, sessionCode]);

  // Pairing and Retry: publish now so the pairing dialog isn't kept waiting.
  // Declared after the publisher effect, which a new pairing recreates first.
  useEffect(() => {
    if (seenPushRequest.current === pushRequestRevision) return;
    seenPushRequest.current = pushRequestRevision;
    schedule.current?.(true);
  }, [pushRequestRevision]);

  // Run changes: publish once they pause.
  useEffect(() => {
    schedule.current?.(false);
  }, [
    unlocks, runId, runRevision, keys, specialKeys, chaosKeys, fatePoints,
    activeBuff, pinnedGoals, linkedAccount, gameModeId, customMode,
  ]);

  return null;
}

export default OnlineSyncDriver;
