import { AlertTriangle, CheckCircle2, Download, ShieldAlert } from 'lucide-react';
import { useMemo, useRef, useState, type FC } from 'react';
import { visibleAreaUnlocks } from '../data/areaMapPolicy';
import { useFocusTrap } from '../hooks/useFocusTrap';
import type { SaveWriteAuthorization } from '../utils/profileWriterLease';
import type { ValidatedRecoveryCandidate, SaveRecoveryDecision } from '../utils/saveRecovery';

export type RecoveryActionResult =
  | void
  | { ok: true; persistenceRevision?: number }
  | { ok: false; message: string };

export type RecoveryAction = () => RecoveryActionResult | Promise<RecoveryActionResult>;

export interface SaveRecoveryScreenProps {
  decision: Extract<SaveRecoveryDecision, { kind: 'recovery_required' | 'unsupported' }>;
  onRecover?: (candidate: ValidatedRecoveryCandidate) => RecoveryActionResult | Promise<RecoveryActionResult>;
  onStartFresh?: RecoveryAction;
  /** Short aliases keep the action seam easy to compose in bootstrap tests. */
  startFresh?: RecoveryAction;
  onExportRecovery?: RecoveryAction;
  /** Alias retained for callers that name the action after the file itself. */
  onExport?: RecoveryAction;
  exportRecovery?: RecoveryAction;
  archiveCorruptEvidence?: RecoveryAction;
  archiveCorrupt?: RecoveryAction;
  authorizeWrite?: () => SaveWriteAuthorization;
  recoveryActionsEnabled?: boolean;
  recoveryStatusMessage?: string | null;
  /** Test/integration seam: the screen never writes this directly. */
  writePrimary?: RecoveryAction;
}

const failureResult = (message: string): { ok: false; message: string } => ({ ok: false, message });

const safeFailureMessage = (_error: unknown, fallback: string): string => fallback;

const actionResult = async (action: RecoveryAction | undefined): Promise<{ ok: true } | { ok: false; message: string }> => {
  if (!action) return { ok: true };
  try {
    const result = await action();
    if (result && 'ok' in result && result.ok === false) return result;
    return { ok: true };
  } catch (error) {
    return failureResult(safeFailureMessage(error, 'The requested recovery action could not be completed.'));
  }
};

const authorizationResult = (
  authorizeWrite: SaveRecoveryScreenProps['authorizeWrite'],
): { ok: true } | { ok: false; message: string } => {
  if (authorizeWrite === undefined) return { ok: true };
  const authorization = authorizeWrite();
  if (authorization.ok) return { ok: true };
  return failureResult(
    ('reason' in authorization && authorization.reason === 'ownership_conflict')
      ? 'The recovery action stopped because writer ownership changed.'
      : 'The recovery action stopped because save storage is unavailable.',
  );
};

const orderedCandidates = (candidates: readonly ValidatedRecoveryCandidate[]): ValidatedRecoveryCandidate[] => (
  candidates
    .map((candidate, index) => ({ candidate, index }))
    .sort((a, b) => {
      if (a.candidate.persistenceRevision !== b.candidate.persistenceRevision) {
        return b.candidate.persistenceRevision - a.candidate.persistenceRevision;
      }
      const aCaptured = a.candidate.capturedAt ?? -1;
      const bCaptured = b.candidate.capturedAt ?? -1;
      if (aCaptured !== bCaptured) return bCaptured - aCaptured;
      return a.index - b.index;
    })
    .map(({ candidate }) => candidate)
);

const formatCapturedAt = (capturedAt: number | null): string => {
  if (capturedAt === null || !Number.isFinite(capturedAt)) return 'Captured time unavailable';
  const date = new Date(capturedAt);
  return Number.isNaN(date.getTime()) ? 'Captured time unavailable' : `Captured ${date.toLocaleString()}`;
};

const candidateSummary = (candidate: ValidatedRecoveryCandidate): string => {
  const regions = visibleAreaUnlocks(candidate.state.unlocks?.regions ?? []).length;
  const events = Array.isArray(candidate.state.history) ? candidate.state.history.length : 0;
  const keys = Number.isFinite(candidate.state.keys) ? candidate.state.keys : 0;
  return `${keys} keys · ${regions} visible region${regions === 1 ? '' : 's'} · ${events} event${events === 1 ? '' : 's'}`;
};

const sourceLabel = (candidate: ValidatedRecoveryCandidate): string => {
  switch (candidate.source) {
    case 'checkpoint': return 'Checkpoint';
    case 'journal': return 'Recovery journal';
    case 'mirror': return 'Saved mirror';
    case 'pending': return 'Current-tab snapshot';
  }
};

const recoveryCauseCopy = (cause: Extract<SaveRecoveryDecision, { kind: 'recovery_required' }>['cause']): string => {
  switch (cause) {
    case 'conflicting_runs':
      return 'The browser contains saved evidence from more than one run. Choose the checkpoint that belongs to the run you want to continue.';
    case 'unsequenced_primary':
      return 'The current save cannot be ordered safely against the recovery journal. Choose a verified checkpoint before continuing.';
    case 'corrupt_primary':
    default:
      return 'The current browser save failed validation. Your verified recovery checkpoints remain untouched until you choose an action.';
  }
};

const classNames = {
  primary: 'inline-flex items-center justify-center gap-2 rounded-md bg-amber-500 px-4 py-2.5 text-sm font-bold text-black transition-colors hover:bg-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 disabled:cursor-not-allowed disabled:opacity-50',
  secondary: 'inline-flex items-center justify-center gap-2 rounded-md border border-amber-200/30 px-4 py-2.5 text-sm font-semibold text-amber-50 transition-colors hover:bg-amber-900/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 disabled:cursor-not-allowed disabled:opacity-50',
  destructive: 'inline-flex items-center justify-center gap-2 rounded-md border border-red-300/30 px-4 py-2.5 text-sm font-semibold text-red-100 transition-colors hover:bg-red-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:cursor-not-allowed disabled:opacity-50',
};

export const SaveRecoveryScreen: FC<SaveRecoveryScreenProps> = ({
  decision,
  onRecover,
  onStartFresh,
  startFresh,
  onExportRecovery,
  onExport,
  exportRecovery,
  archiveCorruptEvidence,
  archiveCorrupt,
  authorizeWrite,
  recoveryActionsEnabled = true,
  recoveryStatusMessage = null,
}) => {
  const candidates = useMemo(
    () => decision.kind === 'recovery_required' ? orderedCandidates(decision.candidates) : [],
    [decision],
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showCheckpointPicker, setShowCheckpointPicker] = useState(false);
  const [confirmingFresh, setConfirmingFresh] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const freshDialogRef = useRef<HTMLDivElement>(null);
  const freshTriggerRef = useRef<HTMLButtonElement>(null);
  const freshReturnFocusRef = useRef<HTMLElement | null>(null);
  useFocusTrap(freshDialogRef, confirmingFresh, freshReturnFocusRef.current);

  const selected = candidates[selectedIndex] ?? null;
  const freshAction = onStartFresh ?? startFresh;
  const exportAction = onExportRecovery ?? onExport ?? exportRecovery;
  const archiveAction = archiveCorruptEvidence ?? archiveCorrupt;

  const runRecovery = async () => {
    if (!recoveryActionsEnabled || busy || selected === null || !onRecover) return;
    setBusy(true);
    setError(null);
    const initialAuthorization = authorizationResult(authorizeWrite);
    if (initialAuthorization.ok === false) {
      setError(initialAuthorization.message);
      setBusy(false);
      return;
    }
    const archived = await actionResult(archiveAction);
    if (archived.ok === false) {
      setError(archived.message);
      setBusy(false);
      return;
    }
    const postArchiveAuthorization = authorizationResult(authorizeWrite);
    if (postArchiveAuthorization.ok === false) {
      setError(postArchiveAuthorization.message);
      setBusy(false);
      return;
    }
    const result = await (async () => {
      try {
        const outcome = await onRecover(selected);
        if (outcome && 'ok' in outcome && outcome.ok === false) return outcome;
        return { ok: true as const };
      } catch (cause) {
        return failureResult(safeFailureMessage(cause, 'The safe checkpoint could not be loaded.'));
      }
    })();
    if (result.ok === false) setError(result.message);
    else {
      const finalAuthorization = authorizationResult(authorizeWrite);
      if (finalAuthorization.ok === false) setError(finalAuthorization.message);
    }
    setBusy(false);
  };

  const runFresh = async () => {
    if (!recoveryActionsEnabled || busy || !freshAction) return;
    setBusy(true);
    setError(null);
    const initialAuthorization = authorizationResult(authorizeWrite);
    if (initialAuthorization.ok === false) {
      setError(initialAuthorization.message);
      setBusy(false);
      return;
    }
    const archived = await actionResult(archiveAction);
    if (archived.ok === false) {
      setError(archived.message);
      setBusy(false);
      return;
    }
    const postArchiveAuthorization = authorizationResult(authorizeWrite);
    if (postArchiveAuthorization.ok === false) {
      setError(postArchiveAuthorization.message);
      setBusy(false);
      return;
    }
    const result = await actionResult(freshAction);
    if (result.ok === false) setError(result.message);
    else {
      const finalAuthorization = authorizationResult(authorizeWrite);
      if (finalAuthorization.ok === false) setError(finalAuthorization.message);
      else setConfirmingFresh(false);
    }
    setBusy(false);
  };

  const runExport = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await actionResult(exportAction);
    if (result.ok === false) setError(result.message);
    setBusy(false);
  };

  return (
    <main
      role="main"
      aria-labelledby="save-recovery-title"
      className="flex min-h-screen items-center justify-center bg-osrs-bg px-4 py-8 text-osrs-text"
    >
      <section className="w-full max-w-2xl overflow-hidden rounded-xl border border-amber-500/30 bg-[#171717] shadow-2xl">
        <header className="flex items-start gap-3 border-b border-white/10 bg-[#1e1e1e] p-5 sm:p-6">
          <div className="rounded-lg border border-amber-500/30 bg-amber-950/40 p-2 text-amber-300" aria-hidden="true">
            {decision.kind === 'unsupported' ? <ShieldAlert size={22} /> : <AlertTriangle size={22} />}
          </div>
          <div className="min-w-0">
            <h1 id="save-recovery-title" className="text-xl font-bold text-gray-100">
              {decision.kind === 'unsupported'
                ? 'A newer save version needs review'
                : 'Saved progress needs recovery'}
            </h1>
            <p className="mt-1 text-sm leading-relaxed text-gray-400">
              {decision.kind === 'unsupported'
                ? 'This browser cannot safely open the saved progress yet. Keep this evidence and open it with a newer Fate Locked version.'
                : recoveryCauseCopy(decision.cause)}
            </p>
          </div>
        </header>

        <div className="space-y-5 p-5 sm:p-6">
          {recoveryStatusMessage !== null && (
            <p role="status" aria-live="polite" className="rounded-md border border-amber-300/30 bg-amber-950/30 px-3 py-2 text-sm text-amber-100">
              {recoveryStatusMessage}
            </p>
          )}
          {decision.kind === 'recovery_required' && (
            <>
              {selected !== null ? (
                <div className="rounded-lg border border-emerald-400/25 bg-emerald-950/20 p-4" aria-live="polite">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-300" size={18} aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-emerald-100">{sourceLabel(selected)} selected</p>
                      <p className="mt-1 text-xs text-emerald-100/70">{formatCapturedAt(selected.capturedAt)}</p>
                      <p className="mt-2 text-sm text-gray-200">{candidateSummary(selected)}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-red-400/30 bg-red-950/20 p-4 text-sm text-red-100">
                  No valid local checkpoint was found. Export the bounded evidence before deciding whether to start a new run.
                </div>
              )}

              {candidates.length > 1 && (
                <div>
                  <button
                    type="button"
                    className={classNames.secondary}
                    aria-expanded={showCheckpointPicker}
                    aria-controls="recovery-checkpoint-picker"
                    onClick={() => setShowCheckpointPicker(value => !value)}
                    disabled={busy}
                  >
                    Choose another checkpoint
                  </button>
                  {showCheckpointPicker && (
                    <div id="recovery-checkpoint-picker" className="mt-3">
                      <label htmlFor="recovery-checkpoint" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Recovery checkpoint
                      </label>
                      <select
                        id="recovery-checkpoint"
                        aria-label="Recovery checkpoint"
                        value={String(selectedIndex)}
                        onChange={event => setSelectedIndex(Number(event.target.value))}
                        disabled={busy}
                        className="w-full rounded-md border border-white/15 bg-[#111] px-3 py-2.5 text-sm text-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                      >
                        {candidates.map((candidate, index) => (
                          <option key={`${candidate.source}-${candidate.persistenceRevision}-${index}`} value={String(index)}>
                            {sourceLabel(candidate)} · revision {candidate.persistenceRevision} · {candidateSummary(candidate)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  onClick={() => { void runRecovery(); }}
                  disabled={!recoveryActionsEnabled || busy || selected === null || !onRecover}
                  className={classNames.primary}
                >
                  <CheckCircle2 size={16} aria-hidden="true" />
                  {busy ? 'Preparing recovery…' : selectedIndex === 0 ? 'Recover latest safe save' : 'Recover selected safe save'}
                </button>
                <button
                  type="button"
                  onClick={() => { void runExport(); }}
                  disabled={busy}
                  className={classNames.secondary}
                >
                  <Download size={16} aria-hidden="true" />
                  Export recovery file
                </button>
              </div>

              <div className="border-t border-white/10 pt-4">
                <button
                  type="button"
                  ref={freshTriggerRef}
                  onClick={() => {
                    freshReturnFocusRef.current = freshTriggerRef.current;
                    setConfirmingFresh(true);
                  }}
                  disabled={!recoveryActionsEnabled || busy || confirmingFresh}
                  aria-hidden={confirmingFresh}
                  className={confirmingFresh ? 'sr-only' : classNames.destructive}
                >
                  Start a new run
                </button>
                {confirmingFresh && (
                  <div
                    ref={freshDialogRef}
                    className="rounded-lg border border-red-400/30 bg-red-950/20 p-4"
                    role="alertdialog"
                    aria-modal="true"
                    aria-labelledby="fresh-run-title"
                    aria-describedby="fresh-run-description"
                    tabIndex={-1}
                  >
                    <h2 id="fresh-run-title" className="text-sm font-bold text-red-100">Start over without recovering this run?</h2>
                    <p id="fresh-run-description" className="mt-1 text-sm text-red-100/80">This preserves no recoverable checkpoint as the active run.</p>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => { void runFresh(); }}
                        disabled={!recoveryActionsEnabled || busy || !freshAction}
                        className={classNames.destructive}
                      >
                        {busy ? 'Starting…' : 'Confirm start a new run'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingFresh(false)}
                        disabled={busy}
                        className={classNames.secondary}
                      >
                        Keep recovery options
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {decision.kind === 'unsupported' && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => { void runExport(); }}
                disabled={busy}
                className={classNames.primary}
              >
                <Download size={16} aria-hidden="true" />
                Export recovery file
              </button>
            </div>
          )}

          {error !== null && (
            <p role="alert" aria-live="assertive" className="rounded-md border border-red-400/30 bg-red-950/30 px-3 py-2 text-sm text-red-100">
              {error}
            </p>
          )}
        </div>
      </section>
    </main>
  );
};

export default SaveRecoveryScreen;
