import React, { useEffect, useState } from 'react';
import { Landmark } from './OsrsIcon';
import { useGame } from '../context/GameContext';
import { useProfiles } from '../context/ProfileContext';
import { MIN_HISTORY } from '../utils/backupNag';
import {
  ONLINE_BACKUP_EVENT,
  readOnlineBackupRecord,
  writeOnlineBackupRecord,
  type OnlineBackupEventDetail,
} from '../utils/onlineBackupRecord';

/** The prompt shows once a run has this much History, as the backup reminder does. */
export const ONLINE_BACKUP_PROMPT_MIN_HISTORY = MIN_HISTORY;

/**
 * Asks once per run, when it has some progress, whether to turn on online
 * backup. "Set up" opens the Sync Code dialog on its Online backup tab; the
 * prompt goes away for good once backup is on or the player says Not now.
 */
export const OnlineBackupPrompt: React.FC = () => {
  const { history } = useGame();
  const { storageKeyForActiveProfile: storageKey } = useProfiles();
  const [record, setRecord] = useState(() => readOnlineBackupRecord(storageKey));

  useEffect(() => {
    setRecord(readOnlineBackupRecord(storageKey));
    const onChange = (event: Event) => {
      if ((event as CustomEvent<OnlineBackupEventDetail>).detail?.storageKey === storageKey) {
        setRecord(readOnlineBackupRecord(storageKey));
      }
    };
    window.addEventListener(ONLINE_BACKUP_EVENT, onChange);
    return () => window.removeEventListener(ONLINE_BACKUP_EVENT, onChange);
  }, [storageKey]);

  if (record.code || record.promptAnsweredAt || history.length < ONLINE_BACKUP_PROMPT_MIN_HISTORY) return null;

  const setUp = () => window.dispatchEvent(new CustomEvent('fate:nav', { detail: { target: 'open:online-backup' } }));
  const notNow = () => writeOnlineBackupRecord(storageKey, { ...readOnlineBackupRecord(storageKey), promptAnsweredAt: Date.now() });

  return (
    <div className="max-w-[1600px] mx-auto px-4 pt-3">
      <div role="region" aria-label="Online backup"
        className="flex flex-wrap items-center gap-3 bg-cyan-950/40 border border-cyan-500/30 rounded-lg px-3 py-2 text-[12px] text-cyan-100/90 animate-in fade-in slide-in-from-top-1">
        <Landmark size={16} aria-hidden className="shrink-0" />
        <span className="min-w-0 flex-1 basis-full sm:basis-auto">
          Keep this run safe if this browser’s data is ever cleared: back it up online, encrypted with a code only you keep.
        </span>
        <button type="button" onClick={setUp}
          className="shrink-0 px-2.5 py-1 rounded-md bg-cyan-700 hover:bg-cyan-600 text-white font-bold">
          Set up
        </button>
        <button type="button" onClick={notNow}
          className="shrink-0 px-2.5 py-1 rounded-md text-cyan-200/70 hover:text-cyan-100">
          Not now
        </button>
      </div>
    </div>
  );
};
