import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, Copy, Download, Loader2 } from 'lucide-react';
import { Landmark } from './OsrsIcon';
import { createFreshState, useGame } from '../context/GameContext';
import { useProfiles } from '../context/ProfileContext';
import { relaySync } from '../services/relaySync';
import { decodeAndValidateSyncCode } from '../utils/syncCode';
import { importUiDecision } from '../utils/gamePersistence';
import { showToast } from '../utils/toast';
import {
  decryptBackup,
  deleteBackup,
  deriveBackupKeys,
  fetchBackup,
  generateBackupCode,
  generateBackupWriter,
  type BackupCopy,
  type BackupKeys,
} from '../utils/onlineBackup';
import {
  ONLINE_BACKUP_EVENT,
  formatBackupCode,
  normalizeBackupCode,
  readOnlineBackupRecord,
  requestOnlineBackupNow,
  writeOnlineBackupRecord,
  type OnlineBackupError,
  type OnlineBackupEventDetail,
  type OnlineBackupRecord,
} from '../utils/onlineBackupRecord';
import type { GameState } from '../types';

export const ONLINE_BACKUP_ERRORS: Record<OnlineBackupError, string> = {
  network: 'The last backup couldn’t reach the relay. It tries again every few minutes.',
  unavailable: 'The relay didn’t take the last backup. It tries again every few minutes.',
  forbidden: 'The relay refused this backup code. Turn online backup off and on again to get a new code.',
  'too-large': 'This run is too large for online backup. Keep a .fate file from the Export tab instead.',
  'too-large-to-share': 'This run is too large to back up. Keep a .fate file from the Export tab instead.',
};

const NOT_FOUND = 'No backup was found for that code. Check the code; a backup is also deleted 90 days after its last upload.';
const UNREACHABLE = 'The relay couldn’t be reached. Try again in a moment.';

interface FoundCopy {
  copy: BackupCopy;
  state: GameState;
  updatedAt: number;
  warning?: string;
}

/** Fetches, opens and checks one copy of a backup. */
const openCopy = async (keys: BackupKeys, copy: BackupCopy): Promise<FoundCopy | { error: string }> => {
  const fetched = await fetchBackup(relaySync.base(), keys, copy);
  if (fetched.ok === false) return { error: fetched.reason === 'not-found' ? NOT_FOUND : UNREACHABLE };
  const syncCode = await decryptBackup(fetched.envelope, keys.key);
  if (!syncCode) return { error: 'That backup couldn’t be opened with this code.' };
  const decoded = await decodeAndValidateSyncCode(syncCode, createFreshState());
  if (decoded.ok === false) return { error: decoded.error };
  return {
    copy,
    state: decoded.state,
    updatedAt: fetched.updatedAt,
    ...(decoded.warnings.length ? { warning: decoded.warnings.map(item => item.message).join(' ') } : {}),
  };
};

const ago = (timestamp: number, now = Date.now()): string => {
  const minutes = Math.round(Math.max(0, now - timestamp) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
};

/** A plain text file with the code, for the player to keep. */
const saveCodeFile = (code: string, profileName: string): void => {
  const text = [
    'Fate Locked online backup code',
    '',
    code,
    '',
    `Run: ${profileName}`,
    `Made: ${new Date().toISOString().slice(0, 10)}`,
    '',
    'To get the run back, open the tracker, choose Sync Code, then Online backup,',
    'and enter this code under "Restore a run". Nobody can reset this code.',
    '',
  ].join('\n');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'fate-locked-backup-code.txt';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const copyCode = async (code: string): Promise<void> => {
  try {
    await navigator.clipboard.writeText(code);
    showToast('Backup code copied');
  } catch {
    showToast('Copy didn’t work here: select the code and copy it by hand');
  }
};

const CodeBox: React.FC<{ code: string; profileName: string }> = ({ code, profileName }) => (
  <div className="rounded-lg border border-cyan-500/30 bg-cyan-950/20 p-3 space-y-2">
    <p className="font-mono text-lg tracking-wider text-cyan-200 text-center select-all break-all" data-testid="backup-code">{code}</p>
    <div className="flex gap-2">
      <button type="button" onClick={() => void copyCode(code)}
        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#252525] border border-white/10 hover:border-cyan-500/40 hover:text-cyan-300 text-gray-300 text-[11px] font-bold">
        <Copy size={12} /> Copy code
      </button>
      <button type="button" onClick={() => saveCodeFile(code, profileName)}
        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#252525] border border-white/10 hover:border-cyan-500/40 hover:text-cyan-300 text-gray-300 text-[11px] font-bold">
        <Download size={12} /> Save as a file
      </button>
    </div>
  </div>
);

/**
 * The Sync Code dialog's Online backup tab: turn backup on with a new backup
 * code, see when the run was last backed up, back up now, show the code, turn
 * it off, and restore a run from a code. The uploads themselves are
 * OnlineBackupDriver's.
 */
export const OnlineBackupPanel: React.FC = () => {
  const { importSave } = useGame();
  const { storageKeyForActiveProfile: storageKey, activeProfileName } = useProfiles();
  const profileName = activeProfileName || 'This run';
  const [record, setRecord] = useState<OnlineBackupRecord>(() => readOnlineBackupRecord(storageKey));
  const [newCode, setNewCode] = useState<string | null>(null);
  const [kept, setKept] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [turningOff, setTurningOff] = useState(false);
  const [, tick] = useState(0);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  useEffect(() => {
    setRecord(readOnlineBackupRecord(storageKey));
    const onChange = (event: Event) => {
      if ((event as CustomEvent<OnlineBackupEventDetail>).detail?.storageKey === storageKey) {
        setRecord(readOnlineBackupRecord(storageKey));
      }
    };
    window.addEventListener(ONLINE_BACKUP_EVENT, onChange);
    const clock = window.setInterval(() => tick(value => value + 1), 30_000);
    return () => {
      window.removeEventListener(ONLINE_BACKUP_EVENT, onChange);
      window.clearInterval(clock);
    };
  }, [storageKey]);

  const startSetup = () => {
    setNewCode(generateBackupCode());
    setKept(false);
  };

  const turnOn = () => {
    const code = newCode ? normalizeBackupCode(newCode) : null;
    if (!code || !kept) return;
    const current = readOnlineBackupRecord(storageKey);
    if (!writeOnlineBackupRecord(storageKey, {
      code,
      writer: generateBackupWriter(),
      enabledAt: Date.now(),
      promptAnsweredAt: current.promptAnsweredAt ?? Date.now(),
    })) {
      showToast('This browser wouldn’t store the backup settings');
      return;
    }
    setNewCode(null);
    requestOnlineBackupNow(storageKey);
  };

  const turnOff = async () => {
    if (!record.code || turningOff) return;
    if (!window.confirm('Turn off online backup? The relay’s copy of this run is deleted, and this browser forgets the code.')) return;
    setTurningOff(true);
    let deleted = false;
    try {
      deleted = await deleteBackup(relaySync.base(), await deriveBackupKeys(record.code));
    } catch {
      /* the copy stays until it expires */
    }
    const current = readOnlineBackupRecord(storageKey);
    writeOnlineBackupRecord(storageKey, { promptAnsweredAt: current.promptAnsweredAt ?? Date.now() });
    if (mounted.current) {
      setTurningOff(false);
      setShowCode(false);
    }
    showToast(deleted
      ? 'Online backup is off, and the relay’s copy is deleted'
      : 'Online backup is off. The relay couldn’t be reached, so its copy stays until it expires 90 days after the last backup.');
  };

  // ── Restore ────────────────────────────────────────────────────────────────
  const [restoreInput, setRestoreInput] = useState('');
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [found, setFound] = useState<{ code: string; copies: FoundCopy[] } | null>(null);

  const findBackup = useCallback(async () => {
    const code = normalizeBackupCode(restoreInput);
    setFound(null);
    if (!code) {
      setRestoreError('A backup code has 20 letters and digits, like ABCDE-FGHJK-MNPQR-STVWX.');
      return;
    }
    setRestoreBusy(true);
    setRestoreError(null);
    try {
      const keys = await deriveBackupKeys(code);
      // The previous copy exists only when a second browser backed this run up.
      const results = await Promise.all([openCopy(keys, 'latest'), openCopy(keys, 'previous')]);
      const copies = results.filter((result): result is FoundCopy => 'state' in result);
      if (!mounted.current) return;
      if (copies.length === 0) {
        setRestoreError('error' in results[0] ? results[0].error : NOT_FOUND);
        return;
      }
      setFound({ code, copies });
    } catch {
      if (mounted.current) setRestoreError('That backup couldn’t be opened in this browser.');
    } finally {
      if (mounted.current) setRestoreBusy(false);
    }
  }, [restoreInput]);

  const restore = useCallback(async (chosen: FoundCopy) => {
    if (!found || restoreBusy) return;
    if (!window.confirm('Restore this run? It replaces this profile’s save. A backup of the current save is kept on the Backups tab.')) return;
    setRestoreBusy(true);
    try {
      const decision = importUiDecision(await importSave(chosen.state));
      if (!mounted.current) return;
      if (!decision.success) {
        setRestoreError(decision.error ?? 'The run couldn’t be restored.');
        return;
      }
      // Keep backing the run up with the same code, as this browser's own copy.
      const current = readOnlineBackupRecord(storageKey);
      writeOnlineBackupRecord(storageKey, {
        code: found.code,
        writer: generateBackupWriter(),
        enabledAt: Date.now(),
        lastUploadAt: chosen.updatedAt || undefined,
        promptAnsweredAt: current.promptAnsweredAt ?? Date.now(),
      });
      setFound(null);
      setRestoreInput('');
      showToast(decision.warning ? `${decision.success}. ${decision.warning}` : decision.success);
    } finally {
      if (mounted.current) setRestoreBusy(false);
    }
  }, [found, importSave, restoreBusy, storageKey]);

  const formatted = record.code ? formatBackupCode(record.code) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2.5">
        <Landmark size={20} aria-hidden className="shrink-0 mt-0.5" />
        <p className="text-[12px] text-gray-400 leading-relaxed">
          Online backup keeps an encrypted copy of this run on the Fate Locked relay. If this browser’s data is cleared,
          or on another device, your backup code brings the run back. Only your code can open the copy: keep it somewhere
          safe, because nobody can reset it.
        </p>
      </div>

      {formatted ? (
        <div className="space-y-2" data-testid="online-backup-on">
          <p role="status" className="text-[12px] text-gray-300">
            {record.lastUploadAt
              ? <>Online backup is on. Last backed up <b>{ago(record.lastUploadAt)}</b>.</>
              : <>Online backup is on. Waiting for the first backup…</>}
          </p>
          {record.lastError && (
            <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-950/40 p-3 text-amber-300">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed">{ONLINE_BACKUP_ERRORS[record.lastError]}</p>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => requestOnlineBackupNow(storageKey)}
              className="px-3 py-1.5 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white text-[11px] font-bold">
              Back up now
            </button>
            <button type="button" onClick={() => setShowCode(value => !value)}
              className="px-3 py-1.5 rounded-lg bg-[#252525] border border-white/10 hover:border-cyan-500/40 text-gray-300 text-[11px] font-bold">
              {showCode ? 'Hide backup code' : 'Show backup code'}
            </button>
            <button type="button" onClick={() => void turnOff()} disabled={turningOff}
              className="px-3 py-1.5 rounded-lg bg-[#252525] border border-white/10 hover:border-red-500/40 hover:text-red-300 text-gray-400 text-[11px] font-bold">
              {turningOff ? 'Turning off…' : 'Turn off'}
            </button>
          </div>
          {showCode && <CodeBox code={formatted} profileName={profileName} />}
        </div>
      ) : newCode ? (
        <div className="space-y-2" data-testid="online-backup-setup">
          <p className="text-[12px] text-gray-300">This is your backup code for <b>{profileName}</b>. Keep it before you go on.</p>
          <CodeBox code={newCode} profileName={profileName} />
          <label className="flex items-center gap-2 text-[12px] text-gray-300">
            <input type="checkbox" checked={kept} onChange={event => setKept(event.target.checked)} />
            I’ve kept my backup code somewhere safe
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={turnOn} disabled={!kept}
              className="px-3 py-1.5 rounded-lg bg-cyan-700 hover:bg-cyan-600 disabled:opacity-40 text-white text-[11px] font-bold">
              Start backing up
            </button>
            <button type="button" onClick={() => setNewCode(null)}
              className="px-3 py-1.5 rounded-lg bg-[#252525] border border-white/10 text-gray-400 text-[11px] font-bold">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={startSetup}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white text-[12px] font-bold">
          Turn on online backup
        </button>
      )}

      <div className="border-t border-white/10 pt-3 space-y-2">
        <h3 className="text-[12px] font-bold text-gray-200">Restore a run from its backup code</h3>
        <div className="flex gap-2">
          <input
            value={restoreInput}
            onChange={event => { setRestoreInput(event.target.value); setFound(null); setRestoreError(null); }}
            placeholder="ABCDE-FGHJK-MNPQR-STVWX"
            aria-label="Backup code"
            className="flex-1 min-w-0 rounded-lg bg-[#101010] border border-white/10 px-3 py-2 font-mono text-[12px] text-gray-200"
          />
          <button type="button" onClick={() => void findBackup()} disabled={restoreBusy || !restoreInput.trim()}
            className="px-3 py-2 rounded-lg bg-[#252525] border border-white/10 hover:border-cyan-500/40 text-gray-300 text-[11px] font-bold disabled:opacity-40">
            {restoreBusy && !found ? <Loader2 size={12} className="animate-spin" /> : 'Find backup'}
          </button>
        </div>
        {restoreError && (
          <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-950/40 p-3 text-red-300">
            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">{restoreError}</p>
          </div>
        )}
        {found?.copies.map(copy => (
          <div key={copy.copy} className="rounded-lg border border-white/10 bg-[#1a1a1a] p-3 space-y-2" data-testid={`online-backup-found-${copy.copy}`}>
            {found.copies.length > 1 && (
              <p className="text-[11px] font-bold text-gray-200">
                {copy.copy === 'latest' ? 'Newest copy' : 'Older copy, kept when another browser backed this run up'}
              </p>
            )}
            <p className="text-[12px] text-gray-300">
              Backed up {copy.updatedAt ? ago(copy.updatedAt) : 'at an unknown time'}: {copy.state.history.length} History
              entries, {copy.state.keys} Keys.
            </p>
            {copy.warning && <p className="text-[11px] text-amber-300">{copy.warning}</p>}
            <button type="button" onClick={() => void restore(copy)} disabled={restoreBusy}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[12px] font-bold">
              <Check size={14} /> {found.copies.length > 1 ? 'Restore this copy' : 'Restore this run'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
