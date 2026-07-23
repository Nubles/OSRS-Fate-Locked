import React, { useCallback, useEffect, useState } from 'react';
import { useGame } from '../context/GameContext';
import { useProfiles } from '../context/ProfileContext';
import { shouldNag, snoozeNag, markExported, lastExportLabel } from '../utils/backupNag';
import { obfuscateFateSave } from '../utils/encryption';
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
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(shouldNag(storageKey, history.length));
  }, [storageKey, history.length]);

  const handleExport = useCallback(() => {
    const rawData = getExportData();
    try {
      const blob = new Blob([obfuscateFateSave(JSON.parse(rawData))], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fate_locked_${Date.now()}.fate`;
      a.click();
      URL.revokeObjectURL(url);
      markExported(storageKey);
      setVisible(false);
      showToast('Save exported — keep the .fate file somewhere safe');
    } catch (e) {
      console.error('Export failed', e);
      showToast('Export failed');
    }
  }, [getExportData, storageKey]);

  const handleLater = useCallback(() => {
    snoozeNag(storageKey);
    setVisible(false);
  }, [storageKey]);

  if (!visible) return null;

  return (
    <div className="max-w-[1600px] mx-auto px-4 pt-3">
      <div className="flex items-center gap-3 bg-amber-950/40 border border-amber-500/30 rounded-lg px-3 py-2 text-[12px] text-amber-200/90 animate-in fade-in slide-in-from-top-1">
        <HardDriveDownload size={14} className="text-amber-400 shrink-0" />
        <span className="flex-1">
          Your run only lives in this browser — clearing site data would erase it.
          Last backup file: <b>{lastExportLabel(storageKey)}</b>.
        </span>
        <button
          onClick={handleExport}
          className="shrink-0 px-2.5 py-1 rounded-md bg-amber-600 hover:bg-amber-500 text-white font-bold transition-colors"
        >
          Export backup
        </button>
        <button
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
