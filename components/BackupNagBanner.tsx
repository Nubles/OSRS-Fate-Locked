import React, { useCallback, useEffect, useState } from 'react';
import { useGame } from '../context/GameContext';
import { useProfiles } from '../context/ProfileContext';
import { usePersistentStorage, type PersistentStorageStatus } from '../hooks/usePersistentStorage';
import { shouldNag, snoozeNag, lastExportLabel } from '../utils/backupNag';
import { downloadFateSave } from '../utils/fateSaveFile';
import { showToast } from '../utils/toast';
import { HardDriveDownload, X } from 'lucide-react';

/**
 * "Your run only lives in this browser" — a gentle, dismissible reminder to
 * export a .fate file once a run has real progress and hasn't been backed up
 * in a while (utils/backupNag.ts owns the timing rules). Sits under the
 * header like CoachStrip; Export downloads right here, Later snoozes 7 days.
 */
export const BackupNagBanner: React.FC = () => {
  const { history, getExportData } = useGame();
  const { storageKeyForActiveProfile: storageKey } = useProfiles();
  const {
    status: persistentStorageStatus,
    requestPersistence,
  } = usePersistentStorage();
  const [visible, setVisible] = useState(false);
  const [requestingPersistence, setRequestingPersistence] = useState(false);

  useEffect(() => {
    setVisible(shouldNag(storageKey, history.length));
  }, [storageKey, history.length]);

  const handleExport = useCallback(() => {
    const result = downloadFateSave(getExportData(), storageKey);
    if (result.ok === false) {
      showToast(result.message);
      return;
    }
      setVisible(false);
      showToast('Save exported — keep the .fate file somewhere safe');
  }, [getExportData, storageKey]);

  const handleLater = useCallback(() => {
    snoozeNag(storageKey);
    setVisible(false);
  }, [storageKey]);

  const handleRequestPersistence = useCallback(async () => {
    if (requestingPersistence || persistentStorageStatus !== 'unknown') return;
    setRequestingPersistence(true);
    try {
      const result = await requestPersistence();
      if (result === 'granted') {
        showToast('Persistent site storage enabled');
      } else if (result === 'unsupported') {
        showToast('Persistent site storage is not available in this browser');
      } else {
        showToast('Persistent site storage was not enabled');
      }
    } finally {
      setRequestingPersistence(false);
    }
  }, [persistentStorageStatus, requestPersistence, requestingPersistence]);

  const persistenceCopy: Record<PersistentStorageStatus, string> = {
    unknown: 'Persistent site storage reduces automatic eviction but does not survive cleared data or device loss.',
    granted: 'Persistent site storage is enabled. It reduces automatic eviction but does not survive cleared data or device loss.',
    denied: 'Persistent site storage was not enabled. It reduces automatic eviction but does not survive cleared data or device loss.',
    unsupported: 'Persistent site storage is unavailable in this browser. A .fate file is still the safest backup.',
  };

  if (!visible) return null;

  return (
    <div className="max-w-[1600px] mx-auto px-4 pt-3">
      <div className="flex items-center gap-3 bg-amber-950/40 border border-amber-500/30 rounded-lg px-3 py-2 text-[12px] text-amber-200/90 animate-in fade-in slide-in-from-top-1">
        <HardDriveDownload size={14} className="text-amber-400 shrink-0" />
        <span className="flex-1">
          Your run only lives in this browser — clearing site data would erase it.
          Last backup file: <b>{lastExportLabel(storageKey)}</b>.
          <span className="mt-1 block text-amber-100/75" aria-live="polite">
            {persistenceCopy[persistentStorageStatus]}
          </span>
        </span>
        <button
          type="button"
          onClick={handleExport}
          className="shrink-0 px-2.5 py-1 rounded-md bg-amber-600 hover:bg-amber-500 text-white font-bold transition-colors"
        >
          Export backup
        </button>
        {persistentStorageStatus === 'unknown' && (
          <button
            type="button"
            onClick={handleRequestPersistence}
            disabled={requestingPersistence}
            className="shrink-0 px-2.5 py-1 rounded-md border border-amber-200/40 text-amber-100 hover:bg-amber-900 disabled:cursor-wait disabled:opacity-60 font-bold transition-colors"
          >
            {requestingPersistence ? 'Requesting…' : 'Enable persistent storage'}
          </button>
        )}
        <button
          type="button"
          onClick={handleLater}
          className="shrink-0 px-2 py-1 rounded-md text-amber-300/70 hover:text-amber-200 hover:bg-white/5 transition-colors"
          title="Remind me in a week"
          aria-label="Dismiss for a week"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
};
