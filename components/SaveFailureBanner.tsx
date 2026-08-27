import { useCallback, useEffect, useRef, useState, type FC } from 'react';
import { AlertTriangle, Download, RefreshCw } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useProfiles } from '../context/ProfileContext';
import type { SaveStatus } from '../utils/pendingSaves';
import type { SaveDurabilitySnapshot, SaveRetryResult } from '../utils/recoveryTypes';
import { effectiveSaveDurability, saveRetryMessage } from './SaveDurabilityStatus';
import {
  downloadFateSave,
  type FateSaveDownloadResult,
} from '../utils/fateSaveFile';
import type { SaveOwnershipBlockReason } from '../utils/profileWriterLease';
import { showToast } from '../utils/toast';

interface SaveFailureBannerViewProps {
  /** New coordinator snapshot. The legacy status remains accepted for old embedders. */
  saveDurability?: SaveDurabilitySnapshot;
  saveStatus?: SaveStatus;
  ownershipBlockReason: SaveOwnershipBlockReason;
  retrySave: () => SaveRetryResult | Promise<SaveRetryResult>;
  exportBackup: () => FateSaveDownloadResult;
}

export const SaveFailureBannerView: FC<SaveFailureBannerViewProps> = ({
  saveDurability,
  saveStatus,
  ownershipBlockReason,
  retrySave,
  exportBackup,
}) => {
  const [retrying, setRetrying] = useState(false);
  const mountedRef = useRef(true);
  const retryAttemptRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      retryAttemptRef.current += 1;
    };
  }, []);

  const failureReason = saveDurability?.failureReason
    ?? (ownershipBlockReason === 'foreign_owner'
      ? 'ownership_conflict'
      : ownershipBlockReason === 'storage_unavailable'
        ? 'storage_unavailable'
        : undefined);
  const durability = effectiveSaveDurability(saveDurability, saveStatus, failureReason);

  // A red banner is reserved for the dual-failure state. A saved primary with
  // degraded recovery is surfaced by SaveDurabilityStatus in amber instead.
  if (
    durability.primary !== 'failed'
    || durability.recovery !== 'degraded'
    || durability.failureReason === 'ownership_conflict'
  ) return null;

  const handleRetry = async () => {
    const attempt = ++retryAttemptRef.current;
    setRetrying(true);
    await Promise.resolve();
    try {
      const result = await retrySave();
      if (mountedRef.current && retryAttemptRef.current === attempt) {
        showToast(saveRetryMessage(result));
      }
    } catch {
      if (mountedRef.current && retryAttemptRef.current === attempt) {
        showToast('Unable to save progress in this browser');
      }
    } finally {
      if (mountedRef.current && retryAttemptRef.current === attempt) setRetrying(false);
    }
  };

  const handleExport = () => {
    const result = exportBackup();
    if (result.ok === false) {
      showToast(result.message);
      return;
    }
    showToast('Backup exported — keep the .fate file somewhere safe');
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="border-b border-red-400/40 bg-red-950/95 text-red-50 shadow-lg"
    >
      <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
        <AlertTriangle className="hidden shrink-0 text-red-300 sm:block" size={20} />
        <div className="min-w-0 flex-1">
          <p className="font-bold">Progress isn't being saved</p>
          <p className="text-sm text-red-100/80">
            Your latest changes are safe in this tab, but they may be lost if the browser closes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleRetry}
            disabled={retrying}
            className="inline-flex items-center gap-2 rounded-md bg-red-100 px-3 py-2 text-sm font-bold text-red-950 transition-colors hover:bg-white disabled:cursor-wait disabled:opacity-60"
          >
            <RefreshCw size={15} className={retrying ? 'animate-spin' : ''} />
            {retrying ? 'Retrying…' : 'Retry save'}
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-md border border-red-200/40 px-3 py-2 text-sm font-bold text-red-50 transition-colors hover:bg-red-900"
          >
            <Download size={15} />
            Export backup
          </button>
        </div>
      </div>
    </div>
  );
};

export const SaveFailureBanner: FC = () => {
  const {
    saveStatus,
    saveDurability,
    saveOwnershipBlockReason,
    retrySave,
    getExportData,
  } = useGame();
  const { storageKeyForActiveProfile } = useProfiles();
  const exportBackup = useCallback(
    () => downloadFateSave(getExportData(), storageKeyForActiveProfile),
    [getExportData, storageKeyForActiveProfile],
  );

  return (
    <SaveFailureBannerView
      saveDurability={saveDurability}
      saveStatus={saveStatus}
      ownershipBlockReason={saveOwnershipBlockReason}
      retrySave={retrySave}
      exportBackup={exportBackup}
    />
  );
};
