import React, { useEffect, useState } from 'react';
import { Landmark } from './OsrsIcon';
import { useGame } from '../context/GameContext';
import { useProfiles } from '../context/ProfileContext';
import { MIN_HISTORY } from '../utils/backupNag';
import { usePersistentStorage } from '../hooks/usePersistentStorage';
import {
  browserTraits, onlineBackupPromptMinHistory, readOffDeviceCopyAt, storageAtRisk, storageEngineFor,
  type BackupPromptTimingInput,
} from '../utils/persistentStorage';
import {
  ONLINE_BACKUP_EVENT,
  readOnlineBackupRecord,
  writeOnlineBackupRecord,
  type OnlineBackupEventDetail,
} from '../utils/onlineBackupRecord';

/** The prompt shows once a run has this much History, as the backup reminder does. */
export const ONLINE_BACKUP_PROMPT_MIN_HISTORY = MIN_HISTORY;

/** The prompt's usual wording, and its wording where the browser may clear the run after a week away. */
export const ONLINE_BACKUP_PROMPT_TEXT = 'Keep this run safe if this browser\u2019s data is ever cleared: back it up online, encrypted with a code only you keep.';
export const ONLINE_BACKUP_PROMPT_AT_RISK_TEXT = 'This browser can clear a site\u2019s data after 7 days without a visit. Keep this run safe: back it up online, encrypted with a code only you keep.';

/**
 * When the one-time question shows for this run, and what it says. On Safari
 * and iOS without persistent storage or any copy elsewhere it comes early
 * (utils/persistentStorage.ts), with wording that says why.
 */
export const useOnlineBackupPromptTiming = (storageKey: string): { minHistory: number; text: string } => {
  const { status } = usePersistentStorage();
  const traits = browserTraits();
  const input: BackupPromptTimingInput = {
    engine: storageEngineFor(traits),
    standalone: traits.standalone === true,
    persisted: status === 'granted',
    hasOffDeviceCopy: readOffDeviceCopyAt(storageKey) !== null,
  };
  return {
    minHistory: onlineBackupPromptMinHistory(input, ONLINE_BACKUP_PROMPT_MIN_HISTORY),
    text: storageAtRisk(input) ? ONLINE_BACKUP_PROMPT_AT_RISK_TEXT : ONLINE_BACKUP_PROMPT_TEXT,
  };
};

/**
 * Asks once per run, when it has some progress, whether to turn on online
 * backup. "Set up" opens the Sync Code dialog on its Online backup tab; the
 * prompt goes away for good once backup is on or the player says Not now.
 */
export const OnlineBackupPrompt: React.FC = () => {
  const { history } = useGame();
  const { storageKeyForActiveProfile: storageKey } = useProfiles();
  const [record, setRecord] = useState(() => readOnlineBackupRecord(storageKey));
  const timing = useOnlineBackupPromptTiming(storageKey);

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

  const setUp = () => window.dispatchEvent(new CustomEvent('fate:nav', { detail: { target: 'open:online-backup' } }));

  // Uploads wait for the player: the choice itself is on the Online backup tab.
  if (record.code && record.held) {
    return (
      <div className="max-w-[1600px] mx-auto px-4 pt-3">
        <div role="region" aria-label="Online backup paused"
          className="flex flex-wrap items-center gap-3 bg-amber-950/40 border border-amber-500/30 rounded-lg px-3 py-2 text-[12px] text-amber-100/90 animate-in fade-in slide-in-from-top-1">
          <Landmark size={16} aria-hidden className="shrink-0" />
          <span className="min-w-0 flex-1 basis-full sm:basis-auto">
            Online backup is paused: backing up this run would replace your online backup of {record.held === 'other-run' ? 'a different run' : 'a longer run'}.
          </span>
          <button type="button" onClick={setUp}
            className="shrink-0 px-2.5 py-1 rounded-md bg-amber-600 hover:bg-amber-500 text-white font-bold">
            Choose
          </button>
        </div>
      </div>
    );
  }

  if (record.code || record.promptAnsweredAt || history.length < timing.minHistory) return null;

  const notNow = () => writeOnlineBackupRecord(storageKey, { ...readOnlineBackupRecord(storageKey), promptAnsweredAt: Date.now() });

  return (
    <div className="max-w-[1600px] mx-auto px-4 pt-3">
      <div role="region" aria-label="Online backup"
        className="flex flex-wrap items-center gap-3 bg-cyan-950/40 border border-cyan-500/30 rounded-lg px-3 py-2 text-[12px] text-cyan-100/90 animate-in fade-in slide-in-from-top-1">
        <Landmark size={16} aria-hidden className="shrink-0" />
        <span className="min-w-0 flex-1 basis-full sm:basis-auto">
          {timing.text}
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
