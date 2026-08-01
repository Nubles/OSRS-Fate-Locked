import { useCallback, useState, type FC } from 'react';
import { AlertTriangle, Download, RefreshCw } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useProfiles } from '../context/ProfileContext';
import type { SaveStatus } from '../utils/pendingSaves';
import {
  downloadFateSave,
  type FateSaveDownloadResult,
} from '../utils/fateSaveFile';
import { showToast } from '../utils/toast';

interface SaveFailureBannerViewProps {
  saveStatus: SaveStatus;
  retrySave: () => boolean;
  exportBackup: () => FateSaveDownloadResult;
}

export const SaveFailureBannerView: FC<SaveFailureBannerViewProps> = ({
  saveStatus,
  retrySave,
  exportBackup,
}) => {
  const [retrying, setRetrying] = useState(false);

  if (saveStatus !== 'failed') return null;

  const handleRetry = async () => {
    setRetrying(true);
    await Promise.resolve();
    try {
      showToast(retrySave()
        ? 'Progress saved'
        : 'Still unable to save progress in this browser');
    } finally {
      setRetrying(false);
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
  const { saveStatus, retrySave, getExportData } = useGame();
  const { storageKeyForActiveProfile } = useProfiles();
  const exportBackup = useCallback(
    () => downloadFateSave(getExportData(), storageKeyForActiveProfile),
    [getExportData, storageKeyForActiveProfile],
  );

  return (
    <SaveFailureBannerView
      saveStatus={saveStatus}
      retrySave={retrySave}
      exportBackup={exportBackup}
    />
  );
};
