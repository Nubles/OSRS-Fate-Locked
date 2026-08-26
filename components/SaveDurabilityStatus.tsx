import { AlertTriangle, CheckCircle2, Download, Loader2, RefreshCw, ShieldAlert } from 'lucide-react';
import { useEffect, useRef, useState, type FC } from 'react';
import type { SaveDurabilitySnapshot, SaveRetryResult } from '../utils/recoveryTypes';
import type { FateSaveDownloadResult } from '../utils/fateSaveFile';
import type { SaveStatus } from '../utils/pendingSaves';
import { showToast } from '../utils/toast';

const CLOCK_UPDATE_INTERVAL_MS = 30_000;

export interface SaveDurabilityStatusProps {
  snapshot: SaveDurabilitySnapshot;
  /** Injectable clock for deterministic tests; defaults to the browser clock. */
  now?: number;
  retrySave?: () => SaveRetryResult | Promise<SaveRetryResult>;
  exportBackup?: () => FateSaveDownloadResult | void;
}

/**
 * Reconcile the legacy save status with the coordinator snapshot. The
 * coordinator starts at saved/checking before ownership has been verified;
 * that placeholder must not hide an already-known failed save status.
 */
export const effectiveSaveDurability = (
  snapshot: SaveDurabilitySnapshot | undefined,
  saveStatus: SaveStatus | undefined,
  failureReason?: SaveDurabilitySnapshot['failureReason'],
): SaveDurabilitySnapshot => {
  const fallback: SaveDurabilitySnapshot = {
    primary: saveStatus === 'failed' ? 'failed' : saveStatus === 'saving' ? 'saving' : 'saved',
    recovery: saveStatus === 'failed' ? 'degraded' : 'checking',
    savedAt: null,
    ...(saveStatus === 'failed'
      ? { failureReason: failureReason ?? 'storage_unavailable' }
      : {}),
  };
  if (snapshot === undefined) return fallback;
  if (snapshot.primary === 'failed' && snapshot.failureReason === undefined && failureReason !== undefined) {
    return { ...snapshot, failureReason };
  }
  if (saveStatus !== 'failed' || snapshot.primary === 'failed') return snapshot;
  return {
    ...snapshot,
    primary: 'failed',
    recovery: snapshot.recovery === 'checking' ? 'degraded' : snapshot.recovery,
    failureReason: snapshot.failureReason ?? failureReason ?? 'storage_unavailable',
  };
};

export const saveRetryMessage = (result: SaveRetryResult): string => {
  if (typeof result === 'boolean') {
    return result ? 'Progress saved' : 'Still unable to save progress in this browser';
  }
  if (result.primary !== 'saved') {
    return result.failureReason === 'ownership_conflict'
      ? 'Saving is paused because another tab owns this profile'
      : 'Still unable to save progress in this browser';
  }
  if (result.recovery === 'protected') return 'Progress saved; backup protection restored';
  if (result.recovery === 'degraded') return 'Progress saved, but backup protection remains unavailable';
  return 'Progress saved; backup protection is still being checked';
};

const relativeSavedTime = (savedAt: number, now: number): string => {
  const seconds = Math.max(0, Math.round((now - savedAt) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
};

export const saveDurabilityLabel = (
  snapshot: SaveDurabilitySnapshot,
  now = Date.now(),
): string => {
  if (snapshot.primary === 'saving') return 'Saving…';
  if (snapshot.primary === 'failed' && snapshot.failureReason === 'ownership_conflict') {
    return 'Saving is paused in another tab';
  }
  if (snapshot.primary === 'failed') return "Progress isn't being saved";
  if (snapshot.recovery === 'degraded') return 'Saved, backup protection unavailable';
  if (snapshot.savedAt === null) return 'Saved';
  return `Saved ${relativeSavedTime(snapshot.savedAt, now)}`;
};

const announcementFor = (snapshot: SaveDurabilitySnapshot): string => {
  if (snapshot.primary === 'saving') return 'Saving progress.';
  if (snapshot.primary === 'failed' && snapshot.failureReason === 'ownership_conflict') {
    return 'Saving is paused because another tab owns this profile.';
  }
  if (snapshot.primary === 'failed') return "Progress isn't being saved.";
  if (snapshot.recovery === 'degraded') return 'Progress saved, but backup protection is unavailable.';
  if (snapshot.recovery === 'checking') return 'Progress saved; checking backup protection.';
  return 'Progress saved.';
};

const toneFor = (snapshot: SaveDurabilitySnapshot): {
  border: string;
  background: string;
  text: string;
  subtext: string;
} => {
  if (snapshot.primary === 'failed' && snapshot.failureReason !== 'ownership_conflict') {
    return {
      border: 'border-red-400/40',
      background: 'bg-red-950/70',
      text: 'text-red-50',
      subtext: 'text-red-100/80',
    };
  }
  if (snapshot.primary === 'failed') {
    return {
      border: 'border-amber-400/40',
      background: 'bg-amber-950/60',
      text: 'text-amber-50',
      subtext: 'text-amber-100/80',
    };
  }
  if (snapshot.recovery === 'degraded' || snapshot.primary === 'saving') {
    return {
      border: 'border-amber-400/40',
      background: 'bg-amber-950/60',
      text: 'text-amber-50',
      subtext: 'text-amber-100/80',
    };
  }
  return {
    border: 'border-emerald-400/30',
    background: 'bg-emerald-950/40',
    text: 'text-emerald-50',
    subtext: 'text-emerald-100/80',
  };
};

export const SaveDurabilityStatus: FC<SaveDurabilityStatusProps> = ({
  snapshot,
  now,
  retrySave,
  exportBackup,
}) => {
  const [retrying, setRetrying] = useState(false);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const mountedRef = useRef(true);
  const retryAttemptRef = useRef(0);
  const stateKey = `${snapshot.primary}:${snapshot.recovery}`;
  const previousStateKeyRef = useRef(stateKey);
  const [announcement, setAnnouncement] = useState(() => announcementFor(snapshot));

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      retryAttemptRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (now !== undefined || typeof window === 'undefined') return;
    const timer = window.setInterval(() => {
      setClockNow(Date.now());
    }, CLOCK_UPDATE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [now]);

  // Keep the live region stable while the visible relative timestamp ages.
  // Screen readers should hear meaningful durability transitions, not a timer.
  useEffect(() => {
    if (previousStateKeyRef.current === stateKey) return;
    previousStateKeyRef.current = stateKey;
    setAnnouncement(announcementFor(snapshot));
  }, [snapshot, stateKey]);

  const label = saveDurabilityLabel(snapshot, now ?? clockNow);
  const savedTime = snapshot.savedAt === null
    ? null
    : relativeSavedTime(snapshot.savedAt, now ?? clockNow);
  const tone = toneFor(snapshot);
  const degraded = snapshot.primary === 'saved' && snapshot.recovery === 'degraded';

  const handleRetry = async (): Promise<void> => {
    if (!retrySave || retrying) return;
    const attempt = ++retryAttemptRef.current;
    setRetrying(true);
    try {
      const result = await retrySave();
      if (mountedRef.current && retryAttemptRef.current === attempt) {
        showToast(saveRetryMessage(result));
      }
    } catch {
      if (mountedRef.current && retryAttemptRef.current === attempt) {
        showToast('Backup protection is still unavailable');
      }
    } finally {
      if (mountedRef.current && retryAttemptRef.current === attempt) setRetrying(false);
    }
  };

  const handleExport = (): void => {
    if (!exportBackup) return;
    const result = exportBackup();
    if (result && result.ok === false) {
      showToast(result.message);
      return;
    }
    showToast('Backup exported — keep the .fate file somewhere safe');
  };

  return (
    <div
      data-save-durability={`${snapshot.primary}-${snapshot.recovery}`}
      className={`border ${tone.border} ${tone.background} text-sm shadow-sm`}
    >
      <div className="mx-auto flex max-w-[1600px] flex-col gap-2 px-4 py-2 sm:flex-row sm:items-center">
        {snapshot.primary === 'failed'
          ? <ShieldAlert className="hidden shrink-0 text-red-300 sm:block" size={18} aria-hidden="true" />
          : snapshot.primary === 'saving'
            ? <Loader2 className="hidden shrink-0 animate-spin text-amber-300 sm:block" size={18} aria-hidden="true" />
            : snapshot.recovery === 'degraded'
              ? <AlertTriangle className="hidden shrink-0 text-amber-300 sm:block" size={18} aria-hidden="true" />
              : <CheckCircle2 className="hidden shrink-0 text-emerald-300 sm:block" size={18} aria-hidden="true" />}
        <div className="min-w-0 flex-1">
          <p className={`font-bold ${tone.text}`}>{label}</p>
          {savedTime !== null && (degraded || snapshot.primary !== 'saved' || snapshot.recovery === 'checking') && (
            <p className={tone.subtext}>Last saved {savedTime}.</p>
          )}
        </div>
        {degraded && (retrySave || exportBackup) && (
          <div className="flex flex-wrap gap-2">
            {retrySave && (
              <button
                type="button"
                onClick={handleRetry}
                disabled={retrying}
                className="inline-flex items-center gap-1.5 rounded-md bg-amber-100 px-2.5 py-1.5 text-xs font-bold text-amber-950 transition-colors hover:bg-white disabled:cursor-wait disabled:opacity-60"
              >
                <RefreshCw size={14} className={retrying ? 'animate-spin' : ''} aria-hidden="true" />
                {retrying ? 'Retrying…' : 'Retry protection'}
              </button>
            )}
            {exportBackup && (
              <button
                type="button"
                onClick={handleExport}
                className="inline-flex items-center gap-1.5 rounded-md border border-amber-200/40 px-2.5 py-1.5 text-xs font-bold text-amber-50 transition-colors hover:bg-amber-900"
              >
                <Download size={14} aria-hidden="true" />
                Export backup
              </button>
            )}
          </div>
        )}
        <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
          {announcement}
        </span>
      </div>
    </div>
  );
};
