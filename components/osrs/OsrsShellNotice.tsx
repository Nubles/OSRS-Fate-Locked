import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { useProfiles } from '../../context/ProfileContext';
import { usePersistentStorage, type PersistentStorageStatus } from '../../hooks/usePersistentStorage';
import { relaySync } from '../../services/relaySync';
import { shouldNag, snoozeNag } from '../../utils/backupNag';
import { OFF_DEVICE_COPY_LABEL, offDeviceCopyLabel, readOffDeviceCopyAt } from '../../utils/persistentStorage';
import {
  ONLINE_BACKUP_EVENT, onlineBackupHoldsReminder, readOnlineBackupRecord, writeOnlineBackupRecord, type OnlineBackupEventDetail,
} from '../../utils/onlineBackupRecord';
import { useOnlineBackupPromptTiming } from '../OnlineBackupPrompt';
import { downloadFateSave, FATE_EXPORT_DONE_MESSAGE, type FateSaveDownloadResult } from '../../utils/fateSaveFile';
import type { SaveDurabilitySnapshot, SaveRetryResult } from '../../utils/recoveryTypes';
import { showToast } from '../../utils/toast';
import { saveDurabilityLabel, saveRetryMessage } from '../SaveDurabilityStatus';
import { relayFailureReason } from '../RelayPublishBanner';
import { NOT_SAVING_PUBLISH_MESSAGE } from '../OnlineSyncDriver';
import './osrs-shell.css';

/**
 * The OSRS layout's parchment game-message line under the header (Main
 * board). It replaces the classic layout's stack of strips so they never push
 * the screen down: it shows ONE message at a time, most urgent first, with the
 * same actions as the classic strip it stands in for:
 *   1. save problems   (SaveDurabilityStatus: Retry protection, Export backup)
 *   2. RuneLite relay  (RelayPublishBanner: Retry now, hide)
 *   3. online backup paused (OnlineBackupPrompt's paused state: Choose)
 *   4. online backup question (OnlineBackupPrompt: Set up, Not now)
 *   5. backup reminder (BackupNagBanner: Export backup, persistent storage, snooze)
 *      It says when the run last left the device (a .fate file or an online upload).
 * (4 and 5 never show together: the reminder waits for the question.)
 * The everyday "Saved just now" status is announced to screen readers only.
 */

const clock = (at: number): string => new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const relativeTime = (at: number, now: number): string => {
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
};

const PERSISTENCE_COPY: Record<PersistentStorageStatus, string> = {
  unknown: 'Persistent site storage can reduce automatic eviction, but it does not survive cleared data or device loss.',
  granted: 'Persistent site storage is enabled and reduces automatic eviction, but it does not survive cleared data or device loss.',
  denied: 'Persistent site storage was not enabled; automatic eviction may still occur. It does not survive cleared data or device loss.',
  unsupported: 'Persistent site storage is unavailable in this browser; automatic eviction may occur. It does not survive cleared data or device loss. A .fate file is still the safest backup.',
};

const announcementFor = (snapshot: SaveDurabilitySnapshot): string => {
  if (snapshot.primary === 'saving') return 'Saving progress.';
  if (snapshot.primary === 'failed' && snapshot.failureReason === 'ownership_conflict') return 'Saving is paused because another tab owns this profile.';
  if (snapshot.primary === 'failed') return "Progress isn't being saved.";
  if (snapshot.recovery === 'degraded') return 'Progress saved, but backup protection is unavailable.';
  if (snapshot.recovery === 'checking') return 'Progress saved; checking backup protection.';
  return 'Progress saved.';
};

/** A link inside the parchment line (blue, like a game-message link). */
const Link: React.FC<{ onClick: () => void; disabled?: boolean; title?: string; children: React.ReactNode }> = ({ onClick, disabled, title, children }) => (
  <button type="button" className="osrs-parch-link" onClick={onClick} disabled={disabled} title={title}>{children}</button>
);

export interface OsrsShellNoticeProps {
  durability: SaveDurabilitySnapshot;
  /** False while SaveFailureBanner covers a dual storage failure (as in classic). */
  showDurability: boolean;
  retrySave?: () => SaveRetryResult | Promise<SaveRetryResult>;
  exportBackup: () => FateSaveDownloadResult | void;
}

export const OsrsShellNotice: React.FC<OsrsShellNoticeProps> = ({ durability, showDurability, retrySave, exportBackup }) => {
  const { history, getExportData } = useGame();
  const { storageKeyForActiveProfile: storageKey } = useProfiles();
  const { status: persistence, requestPersistence } = usePersistentStorage();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  // ── 1. Save durability (SaveDurabilityStatus) ──
  const [retrying, setRetrying] = useState(false);
  const mounted = useRef(true);
  const retryAttempt = useRef(0);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; retryAttempt.current += 1; }; }, []);
  const handleRetry = async () => {
    if (!retrySave || retrying) return;
    const attempt = ++retryAttempt.current;
    setRetrying(true);
    try {
      const result = await retrySave();
      if (mounted.current && retryAttempt.current === attempt) showToast(saveRetryMessage(result));
    } catch {
      if (mounted.current && retryAttempt.current === attempt) showToast('Backup protection is still unavailable');
    } finally {
      if (mounted.current && retryAttempt.current === attempt) setRetrying(false);
    }
  };
  const handleDurabilityExport = () => {
    const result = exportBackup();
    if (result && result.ok === false) { showToast(result.message); return; }
    showToast(FATE_EXPORT_DONE_MESSAGE);
  };
  const degraded = durability.primary === 'saved' && durability.recovery === 'degraded';
  const saveProblem = showDurability && (durability.primary === 'failed' || degraded);

  // ── 2. RuneLite relay (RelayPublishBanner) ──
  const [, forceRelay] = useState(0);
  useEffect(() => relaySync.subscribe(() => forceRelay(value => value + 1)), []);
  const [relayHidden, setRelayHidden] = useState(false);
  const relayRecovered = relaySync.failures === 0;
  useEffect(() => { if (relayRecovered) setRelayHidden(false); }, [relayRecovered]);
  const relayFailing = relaySync.enabled
    && relaySync.failures > 0
    && relaySync.status !== 'synced'
    && relaySync.lastFailure !== NOT_SAVING_PUBLISH_MESSAGE
    && (relaySync.failures >= 2 || !relaySync.retryable);

  // ── 3/4. Online backup paused (OnlineBackupPrompt) and the backup reminder (BackupNagBanner) ──
  const [backupRecord, setBackupRecord] = useState(() => readOnlineBackupRecord(storageKey));
  useEffect(() => {
    setBackupRecord(readOnlineBackupRecord(storageKey));
    const onChange = (event: Event) => {
      if ((event as CustomEvent<OnlineBackupEventDetail>).detail?.storageKey === storageKey) setBackupRecord(readOnlineBackupRecord(storageKey));
    };
    window.addEventListener(ONLINE_BACKUP_EVENT, onChange);
    return () => window.removeEventListener(ONLINE_BACKUP_EVENT, onChange);
  }, [storageKey]);
  const backupPaused = !!(backupRecord.code && backupRecord.held);
  const backupPromptTiming = useOnlineBackupPromptTiming(storageKey);
  const askBackup = !backupRecord.code && !backupRecord.promptAnsweredAt && history.length >= backupPromptTiming.minHistory;
  const openOnlineBackup = () => window.dispatchEvent(new CustomEvent('fate:nav', { detail: { target: 'open:online-backup' } }));
  const answerBackupNotNow = () => writeOnlineBackupRecord(storageKey, { ...readOnlineBackupRecord(storageKey), promptAnsweredAt: Date.now() });

  const [nagVisible, setNagVisible] = useState(false);
  useEffect(() => {
    setNagVisible(shouldNag(storageKey, history.length) && !onlineBackupHoldsReminder(readOnlineBackupRecord(storageKey)));
    // Also re-checked when the online backup record changes (the reminder waits for its question).
  }, [storageKey, history.length, backupRecord]);
  const handleNagExport = useCallback(() => {
    const result = downloadFateSave(getExportData(), storageKey);
    if (result.ok === false) { showToast(result.message); return; }
    setNagVisible(false);
    showToast(FATE_EXPORT_DONE_MESSAGE);
  }, [getExportData, storageKey]);
  const handleNagLater = useCallback(() => { snoozeNag(storageKey); setNagVisible(false); }, [storageKey]);
  const [requesting, setRequesting] = useState(false);
  const handlePersistence = useCallback(async () => {
    if (requesting || persistence !== 'unknown') return;
    setRequesting(true);
    try {
      const result = await requestPersistence();
      showToast(result === 'granted' ? 'Persistent site storage enabled'
        : result === 'unsupported' ? 'Persistent site storage is not available in this browser'
          : 'Persistent site storage was not enabled');
    } finally {
      setRequesting(false);
    }
  }, [persistence, requestPersistence, requesting]);

  // Screen-reader save status, as SaveDurabilityStatus announces it.
  const status = showDurability
    ? <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">{announcementFor(durability)}</span>
    : null;

  let line: React.ReactNode = null;
  let title = '';
  if (saveProblem) {
    const label = saveDurabilityLabel(durability, now);
    title = durability.savedAt !== null ? `${label}. Last saved ${relativeTime(durability.savedAt, now)}.` : label;
    line = (
      <>
        <span className="osrs-parch-text"><span style={{ color: '#ff0000' }}>{label}.</span>
          {durability.savedAt !== null && <> Last saved {relativeTime(durability.savedAt, now)}.</>}</span>
        {degraded && retrySave && <Link onClick={handleRetry} disabled={retrying}>{retrying ? 'Retrying...' : 'Retry protection'}</Link>}
        {degraded && <Link onClick={handleDurabilityExport}>Export backup</Link>}
      </>
    );
  } else if (relayFailing && !relayHidden) {
    const retryingRelay = relaySync.status === 'syncing';
    const retryAt = relaySync.retryable ? relaySync.retryAt : null;
    const lastSyncAt = relaySync.lastSyncAt;
    title = `RuneLite isn't getting your latest rules. ${relayFailureReason(relaySync.lastFailure)} RuneLite is still using the rules it last received${lastSyncAt ? ` (sent at ${clock(lastSyncAt)})` : ''}, so recent unlocks won't show there yet.${retryingRelay ? ' Sending again now...' : retryAt ? ` The tracker will try again by itself at ${clock(retryAt)}.` : ''}`;
    line = (
      <>
        <span className="osrs-parch-text"><span style={{ color: '#ff0000' }}>RuneLite isn't getting your latest rules.</span> {relayFailureReason(relaySync.lastFailure)}
          {retryingRelay ? ' Sending again now...' : retryAt ? ` Trying again at ${clock(retryAt)}.` : ''}</span>
        <Link onClick={() => { relaySync.requestPush(); }} disabled={retryingRelay}>{retryingRelay ? 'Sending...' : 'Retry now'}</Link>
        <button type="button" className="osrs-parch-x" onClick={() => setRelayHidden(true)} aria-label="Hide until sending works again" title="Hide until sending works again">x</button>
      </>
    );
  } else if (backupPaused) {
    title = `Online backup is paused: backing up this run would replace your online backup of ${backupRecord.held === 'other-run' ? 'a different run' : 'a longer run'}.`;
    line = (
      <>
        <span className="osrs-parch-text">{title}</span>
        <Link onClick={openOnlineBackup}>Choose</Link>
      </>
    );
  } else if (askBackup) {
    title = backupPromptTiming.text;
    line = (
      <>
        <span className="osrs-parch-text">{title}</span>
        <Link onClick={openOnlineBackup}>Set up</Link>
        <Link onClick={answerBackupNotNow}>Not now</Link>
      </>
    );
  } else if (nagVisible) {
    const last = offDeviceCopyLabel(readOffDeviceCopyAt(storageKey), now);
    title = `Your run only lives in this browser: clearing site data would erase it. ${PERSISTENCE_COPY[persistence]}`;
    line = (
      <>
        <span className="osrs-parch-text">Your run only lives in this browser. {OFF_DEVICE_COPY_LABEL}:</span>
        <span style={{ color: last === 'never' ? '#ff0000' : '#000000', whiteSpace: 'nowrap' }}>{last}.</span>
        <Link onClick={handleNagExport}>Export backup</Link>
        {persistence === 'unknown' && (
          <Link onClick={handlePersistence} disabled={requesting} title={PERSISTENCE_COPY.unknown}>{requesting ? 'Requesting...' : 'Keep site storage'}</Link>
        )}
        <button type="button" className="osrs-parch-x" onClick={handleNagLater} aria-label="Remind me in a week" title="Remind me in a week">x</button>
      </>
    );
  }

  if (!line) return status;
  return (
    <>
      {status}
      <div className="osrs-parch" role="region" aria-label="Game message" title={title}>{line}</div>
    </>
  );
};

export default OsrsShellNotice;
