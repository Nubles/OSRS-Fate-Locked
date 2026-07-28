import { useEffect, useRef, useState } from 'react';
import { useGame } from '../context/GameContext';
import { relaySync } from '../services/relaySync';
import { buildBundlePayload } from '../utils/runeliteExport';

/**
 * Invisible, always-mounted driver: when online sync is enabled, debounced-pushes
 * the run bundle to the relay on every unlock/state change (and once on enable).
 */
export function OnlineSyncDriver() {
  const { unlocks, runId, runRevision, keys, specialKeys, chaosKeys, fatePoints, activeBuff, pinnedGoals, linkedAccount, gameModeId, customMode } = useGame() as any;
  const [, force] = useState(0);
  useEffect(() => relaySync.subscribe(() => force((n) => n + 1)), []);
  const enabled = relaySync.enabled;
  const sessionCode = relaySync.code;
  const pushRequestRevision = relaySync.pushRequestRevision;
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || !sessionCode) return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      buildBundlePayload(unlocks, { runId, runRevision, keys, specialKeys, chaosKeys, fatePoints, activeBuff, pinnedGoals, linkedAccount, gameModeId: gameModeId ?? 'vanilla', customMode })
        .then(({ compressed }) => {
          if (relaySync.code !== sessionCode) return false;
          return relaySync.push(compressed);
        })
        .catch((error) => {
          if (relaySync.code === sessionCode) {
            relaySync.reportPushFailure(error);
          }
        });
    }, 1500);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [
    enabled, sessionCode, pushRequestRevision, unlocks, runId,
    runRevision, keys, specialKeys, chaosKeys, fatePoints,
    activeBuff, pinnedGoals, linkedAccount, gameModeId, customMode,
  ]);

  return null;
}

export default OnlineSyncDriver;
