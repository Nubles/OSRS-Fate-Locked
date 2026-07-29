import React from 'react';
import { AlertTriangle, CheckCircle2, Link2, Loader2, XCircle } from 'lucide-react';
import { RUNELITE_PAIRING_SUCCESS_COPY } from '../utils/runelitePairing';

export interface RunelitePairingDialogProps {
  code: string;
  replacing: boolean;
  profileName: string;
  linkedAccount: string | null;
  proofCount: number;
  proofSourceVersion: string;
  phase: 'confirm' | 'uploading' | 'success' | 'error';
  error?: string;
  onConfirm(): void;
  onRetry(): void;
  onClose(): void;
}

export const RunelitePairingDialog: React.FC<
  RunelitePairingDialogProps
> = ({
  code,
  replacing,
  profileName,
  linkedAccount,
  proofCount,
  proofSourceVersion,
  phase,
  error,
  onConfirm,
  onRetry,
  onClose,
}) => {
  const canDismiss = phase === 'confirm' || phase === 'success';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={() => {
        if (canDismiss) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Connect RuneLite tracker"
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-xl border border-white/10 bg-[#161616] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-white/10 bg-[#1b1b1b] p-4">
          <div className="rounded-lg border border-cyan-500/30 bg-cyan-900/20 p-2 text-cyan-400">
            <Link2 size={18} />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">
              Connect RuneLite tracker
            </h2>
            <p className="mt-1 text-[11px] text-gray-500">
              RuneLite requested this connection.
            </p>
          </div>
        </div>

        <div className="space-y-4 p-4">
          <p className="text-[12px] leading-relaxed text-gray-300">
            Connect this tracker profile so RuneLite can retrieve its
            Fate Locked rules. RuneLite does not upload gameplay data.
          </p>

          <dl className="space-y-2 rounded-lg border border-white/5 bg-black/20 p-3 text-[11px]">
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Profile</dt>
              <dd className="font-bold text-gray-100">{profileName}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Linked account</dt>
              <dd className="font-bold text-gray-100">
                {linkedAccount || 'No bound account'}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">RuneProof</dt>
              <dd className="font-bold text-gray-100">
                {proofCount} current {proofCount === 1 ? 'proof' : 'proofs'}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Proof source</dt>
              <dd className="max-w-[15rem] truncate font-mono text-[10px] text-cyan-200" title={proofSourceVersion}>
                {proofSourceVersion}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Request</dt>
              <dd className="font-mono text-[10px] text-cyan-200">
                {code}
              </dd>
            </div>
          </dl>

          {replacing && phase === 'confirm' && (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-950/40 p-3 text-amber-200">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <p className="text-[11px] leading-relaxed">
                This will replace the current RuneLite connection for
                this profile.
              </p>
            </div>
          )}
          {phase === 'confirm' && error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-950/30 p-3 text-red-100">
              <XCircle size={16} className="mt-0.5 shrink-0" />
              <p className="text-[11px] leading-relaxed">
                {error}
              </p>
            </div>
          )}

          {phase === 'uploading' && (
            <div className="flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-950/30 p-3 text-cyan-100">
              <Loader2 size={16} className="animate-spin" />
              <p className="text-[11px]">Sending profile to RuneLite…</p>
            </div>
          )}
          {phase === 'success' && (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-950/30 p-3 text-emerald-100">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
              <p className="text-[11px] leading-relaxed">
                {RUNELITE_PAIRING_SUCCESS_COPY}
              </p>
            </div>
          )}
          {phase === 'error' && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-950/30 p-3 text-red-100">
              <XCircle size={16} className="mt-0.5 shrink-0" />
              <p className="text-[11px] leading-relaxed">
                {error || 'Profile could not be sent.'}
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-white/10 bg-[#1b1b1b] p-4">
          {phase === 'confirm' && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-white/10 bg-[#252525] px-4 py-2 text-[12px] font-bold text-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="rounded-lg bg-cyan-600 px-4 py-2 text-[12px] font-bold text-white"
              >
                Connect tracker
              </button>
            </>
          )}
          {phase === 'uploading' && (
            <button
              type="button"
              disabled
              className="rounded-lg bg-cyan-800 px-4 py-2 text-[12px] font-bold text-cyan-100"
            >
              Sending…
            </button>
          )}
          {phase === 'error' && (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-lg bg-cyan-600 px-4 py-2 text-[12px] font-bold text-white"
            >
              Retry
            </button>
          )}
          {phase === 'success' && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-cyan-600 px-4 py-2 text-[12px] font-bold text-white"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
