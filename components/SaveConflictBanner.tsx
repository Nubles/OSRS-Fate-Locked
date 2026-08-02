import { useCallback, useState, type FC } from 'react';
import { AlertTriangle, Download, RefreshCw, ShieldCheck } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useProfiles } from '../context/ProfileContext';
import {
  downloadFateSave,
  type FateSaveDownloadResult,
} from '../utils/fateSaveFile';
import type { ImportResult } from '../utils/gamePersistence';
import type { SaveOwnershipStatus } from '../utils/profileWriterLease';
import { showToast } from '../utils/toast';

interface SaveConflictBannerViewProps {
  status: SaveOwnershipStatus;
  hasPendingChanges: boolean;
  takeOver: () => Promise<boolean>;
  reloadLatest: () => ImportResult;
  exportBackup: () => FateSaveDownloadResult;
  confirmAction?: (message: string) => boolean;
}

const TAKEOVER_CONFIRMATION =
  'Another tab may have newer saved progress. Take over and save this tab instead?';
const RELOAD_CONFIRMATION =
  "Discard this tab's unsaved changes and reload the latest saved progress?";

export const SaveConflictBannerView: FC<SaveConflictBannerViewProps> = ({
  status,
  hasPendingChanges,
  takeOver,
  reloadLatest,
  exportBackup,
  confirmAction = message => window.confirm(message),
}) => {
  const [takingOver, setTakingOver] = useState(false);
  const [reloading, setReloading] = useState(false);

  if (status !== 'blocked') return null;

  const destructiveActionActive = takingOver || reloading;

  const handleTakeOver = async () => {
    if (destructiveActionActive || !confirmAction(TAKEOVER_CONFIRMATION)) return;

    setTakingOver(true);
    try {
      const owned = await takeOver();
      showToast(owned
        ? 'This tab is now saving progress'
        : 'Unable to take over saving. Your changes remain in this tab');
    } catch {
      showToast('Unable to take over saving. Your changes remain in this tab');
    } finally {
      setTakingOver(false);
    }
  };

  const handleReload = async () => {
    if (destructiveActionActive) return;
    if (hasPendingChanges && !confirmAction(RELOAD_CONFIRMATION)) return;

    setReloading(true);
    await Promise.resolve();
    try {
      const result = reloadLatest();
      showToast(result.ok === true ? 'Latest saved progress loaded' : result.message);
    } catch {
      showToast('The latest saved run could not be read. Your current run is unchanged.');
    } finally {
      setReloading(false);
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
      className="border-b border-amber-400/40 bg-amber-950/95 text-amber-50 shadow-lg"
    >
      <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-4 py-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 hidden shrink-0 text-amber-300 sm:block" size={20} />
          <div className="min-w-0 flex-1">
            <p className="font-bold">This profile is open in another tab</p>
            <p className="text-sm text-amber-100/80">
              Changes in this tab are not being saved. Choose which tab should keep the profile before continuing.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:pl-8">
          <button
            type="button"
            onClick={handleTakeOver}
            disabled={destructiveActionActive}
            className="inline-flex items-center gap-2 rounded-md bg-amber-100 px-3 py-2 text-sm font-bold text-amber-950 transition-colors hover:bg-white disabled:cursor-wait disabled:opacity-60"
          >
            <ShieldCheck size={15} />
            {takingOver ? 'Taking over…' : 'Take over and save this tab'}
          </button>
          <button
            type="button"
            onClick={handleReload}
            disabled={destructiveActionActive}
            className="inline-flex items-center gap-2 rounded-md border border-amber-200/40 px-3 py-2 text-sm font-bold text-amber-50 transition-colors hover:bg-amber-900 disabled:cursor-wait disabled:opacity-60"
          >
            <RefreshCw size={15} className={reloading ? 'animate-spin' : ''} />
            {reloading ? 'Reloading…' : 'Discard this tab and reload latest'}
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-md border border-amber-200/40 px-3 py-2 text-sm font-bold text-amber-50 transition-colors hover:bg-amber-900"
          >
            <Download size={15} />
            Export backup
          </button>
        </div>
      </div>
    </div>
  );
};

export const SaveConflictBanner: FC = () => {
  const [takeoverPending, setTakeoverPending] = useState(false);
  const {
    saveOwnershipStatus,
    saveOwnershipBlockReason,
    hasPendingChanges,
    takeOverSaveOwnership,
    reloadLatestSave,
    getExportData,
  } = useGame();
  const { storageKeyForActiveProfile } = useProfiles();
  const exportBackup = useCallback(
    () => downloadFateSave(getExportData(), storageKeyForActiveProfile),
    [getExportData, storageKeyForActiveProfile],
  );

  const takeOverWhileVisible = useCallback(async (): Promise<boolean> => {
    setTakeoverPending(true);
    try {
      return await takeOverSaveOwnership();
    } finally {
      setTakeoverPending(false);
    }
  }, [takeOverSaveOwnership]);
  const foreignConflictActive = saveOwnershipStatus === 'blocked'
    && saveOwnershipBlockReason === 'foreign_owner';

  if (!foreignConflictActive && !takeoverPending) {
    return null;
  }

  return (
    <SaveConflictBannerView
      status={takeoverPending ? 'blocked' : saveOwnershipStatus}
      hasPendingChanges={hasPendingChanges}
      takeOver={takeOverWhileVisible}
      reloadLatest={reloadLatestSave}
      exportBackup={exportBackup}
      confirmAction={message => window.confirm(message)}
    />
  );
};
