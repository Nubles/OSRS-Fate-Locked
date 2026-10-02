import React, { useCallback, useEffect, useRef } from 'react';
import { useGame } from '../context/GameContext';
import { useProfiles } from '../context/ProfileContext';
import { relaySync } from '../services/relaySync';
import { backupRun } from '../utils/onlineBackup';
import {
  ONLINE_BACKUP_EVENT,
  readOnlineBackupRecord,
  type OnlineBackupEventDetail,
} from '../utils/onlineBackupRecord';

/** At most one upload every 15 minutes while the run changes. */
export const ONLINE_BACKUP_INTERVAL_MS = 15 * 60 * 1000;
/** Let a burst of changes settle before uploading. */
export const ONLINE_BACKUP_SETTLE_MS = 30 * 1000;
/**
 * Leaving the page sends a waiting change early, but at most every 5 minutes:
 * players switch between the game and the tracker all the time, and the relay's
 * free plan allows 1,000 uploads a day for everyone.
 */
export const ONLINE_BACKUP_HIDDEN_MIN_MS = 5 * 60 * 1000;

/** How long until the next scheduled upload of a changed run. */
export const nextUploadDelay = (lastUploadAt: number | undefined, now: number): number =>
  Math.max(ONLINE_BACKUP_SETTLE_MS, (lastUploadAt ?? 0) + ONLINE_BACKUP_INTERVAL_MS - now);

/**
 * Keeps the active run's online backup current (utils/onlineBackup.ts): when the
 * run changes, it uploads once things settle, at most every 15 minutes, and
 * earlier when the page is hidden with a change waiting, at most every 5
 * minutes. "Back up now" and turning backup on upload at once. Only the tab
 * that owns the save uploads. Renders nothing.
 */
export const OnlineBackupDriver: React.FC = () => {
  const {
    history, unlocks, keys, specialKeys, chaosKeys, fatePoints, runRevision, stateReplacements,
    saveOwnershipStatus, getExportData,
  } = useGame();
  const { storageKeyForActiveProfile: storageKey } = useProfiles();
  const timer = useRef<number | null>(null);
  const running = useRef(false);
  const exportRef = useRef(getExportData);
  exportRef.current = getExportData;
  const ownerRef = useRef(saveOwnershipStatus);
  ownerRef.current = saveOwnershipStatus;

  const clearTimer = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const runRef = useRef<(force: boolean) => Promise<void>>(async () => {});
  const schedule = useCallback((delayMs: number) => {
    if (timer.current !== null) return;
    timer.current = window.setTimeout(() => {
      timer.current = null;
      void runRef.current(false);
    }, delayMs);
  }, []);

  runRef.current = async (force: boolean) => {
    if (running.current || ownerRef.current !== 'owner') return;
    running.current = true;
    try {
      const outcome = await backupRun(storageKey, exportRef.current(), relaySync.base(), { force });
      if (outcome.kind === 'retry') schedule(outcome.afterMs);
    } finally {
      running.current = false;
    }
  };

  // A change in the run: back it up once things settle, at most every 15 minutes.
  useEffect(() => {
    const record = readOnlineBackupRecord(storageKey);
    if (!record.code || saveOwnershipStatus !== 'owner') return;
    schedule(nextUploadDelay(record.lastUploadAt, Date.now()));
  }, [storageKey, saveOwnershipStatus, history, unlocks, keys, specialKeys, chaosKeys, fatePoints, runRevision, stateReplacements, schedule]);

  // "Back up now", and turning online backup on.
  useEffect(() => {
    const onRequest = (event: Event) => {
      const detail = (event as CustomEvent<OnlineBackupEventDetail>).detail;
      if (detail?.storageKey !== storageKey || detail.action !== 'now') return;
      clearTimer();
      void runRef.current(true);
    };
    window.addEventListener(ONLINE_BACKUP_EVENT, onRequest);
    return () => window.removeEventListener(ONLINE_BACKUP_EVENT, onRequest);
  }, [storageKey, clearTimer]);

  // Leaving the page with a change waiting: send it now, unless one went lately.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState !== 'hidden' || timer.current === null) return;
      const record = readOnlineBackupRecord(storageKey);
      if (Date.now() - (record.lastUploadAt ?? 0) < ONLINE_BACKUP_HIDDEN_MIN_MS) return;
      clearTimer();
      void runRef.current(false);
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [storageKey, clearTimer]);

  // Another profile: its run has its own backup, so drop this one's timer.
  useEffect(() => clearTimer, [storageKey, clearTimer]);

  return null;
};
