import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  X, Link2, Copy, Check, ClipboardPaste, ShieldCheck, ShieldAlert,
  AlertTriangle, Loader2, ArrowDownToLine, Upload, QrCode, History, RotateCcw,
} from 'lucide-react';
import { initialState, useGame } from '../context/GameContext';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { SectionGuide } from './SectionGuide';
import { encodeSyncCode, decodeAndValidateSyncCode } from '../utils/syncCode';
import { makeQrSvg } from '../utils/qr';
import { auditHistory, RunVerdict } from '../utils/integrity';
import { BackupMeta } from '../utils/backups';
import type { GameState } from '../types';
import {
  candidateMatchesSource,
  importUiDecision,
  isCurrentImportRequest,
  type SourceBoundCandidate,
} from '../utils/gamePersistence';
import { showToast } from '../utils/toast';

interface Props {
  onClose: () => void;
  /** When set (e.g. opened from a #sync= link) start on Import, pre-filled. */
  initialImportCode?: string;
}

type Tab = 'EXPORT' | 'IMPORT' | 'BACKUPS';

const SYNC_HASH_PREFIX = '#sync=';
const shareUrlFor = (code: string): string =>
  `${window.location.origin}${window.location.pathname}${SYNC_HASH_PREFIX}${code}`;

const relativeTime = (ts: number): string => {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
};

/** Defensive summary of a decoded run for the import preview. */
interface RunPreview {
  keys: number;
  specialKeys: number;
  chaosKeys: number;
  regions: number;
  quests: number;
  skillTiers: number;
  events: number;
  mode?: string;
}

const previewOf = (state: GameState): RunPreview => {
  const skillTiers = Object.values(state.unlocks.skills)
    .reduce((total, tier) => total + tier, 0);
  return {
    keys: state.keys,
    specialKeys: state.specialKeys,
    chaosKeys: state.chaosKeys,
    regions: state.unlocks.regions.length,
    quests: state.unlocks.quests.length,
    skillTiers,
    events: state.history.length,
    mode: state.gameModeId,
  };
};

const VERDICT_UI: Record<RunVerdict, { label: string; sub: string; cls: string; Icon: typeof ShieldCheck }> = {
  verified: {
    label: 'Verified run',
    sub: 'Hash chain intact — no signs of tampering.',
    cls: 'text-emerald-300 bg-emerald-950/40 border-emerald-500/30',
    Icon: ShieldCheck,
  },
  warning: {
    label: 'Loadable, with warnings',
    sub: 'Chain is intact but the replay hit an unusual state. Likely a legacy save.',
    cls: 'text-amber-300 bg-amber-950/40 border-amber-500/30',
    Icon: ShieldAlert,
  },
  tampered: {
    label: 'Tampered run',
    sub: 'The hash chain is broken — entries were added, edited, or removed.',
    cls: 'text-red-300 bg-red-950/40 border-red-500/30',
    Icon: AlertTriangle,
  },
};

export const SyncCodeModal: React.FC<Props> = ({ onClose, initialImportCode }) => {
  const { getExportData, importSave, listBackups, restoreBackup } = useGame();
  const closeTimerRef = useRef<number | null>(null);
  const closeModal = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    onClose();
  }, [onClose]);
  useEffect(() => () => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
  }, []);
  useEscapeKey(closeModal, true);

  const [tab, setTab] = useState<Tab>(initialImportCode ? 'IMPORT' : 'EXPORT');

  // ── Export ──────────────────────────────────────────────────────────────
  const [code, setCode] = useState<string>('');
  const [encoding, setEncoding] = useState(true);
  const [exportError, setExportError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'none' | 'code' | 'link'>('none');

  const qr = useMemo(() => (code ? makeQrSvg(shareUrlFor(code)) : null), [code]);

  useEffect(() => {
    let cancelled = false;
    setEncoding(true);
    setExportError(null);
    (async () => {
      try {
        const raw = getExportData();
        const state = JSON.parse(raw) as Record<string, unknown>;
        const generated = await encodeSyncCode(state);
        if (!cancelled) setCode(generated);
      } catch (cause) {
        if (!cancelled) {
          setCode('');
          setExportError(cause instanceof Error
            ? cause.message
            : 'The sync code could not be generated.');
        }
      } finally {
        if (!cancelled) setEncoding(false);
      }
    })();
    return () => { cancelled = true; };
  }, [getExportData]);

  const copyText = useCallback(async (text: string, which: 'code' | 'link') => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied('none'), 2000);
    } catch {
      /* clipboard blocked — the user can still select the text manually */
    }
  }, []);

  // ── Import ──────────────────────────────────────────────────────────────
  const [input, setInput] = useState(initialImportCode ?? '');
  const inputRef = useRef(initialImportCode ?? '');
  const verifyRequestRef = useRef(0);
  const [decoding, setDecoding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const acceptedRef = useRef(false);
  const [decoded, setDecoded] = useState<SourceBoundCandidate<GameState> | null>(null);

  useEffect(() => () => {
    verifyRequestRef.current += 1;
  }, []);

  const decodedState = decoded?.value ?? null;
  const preview = useMemo(() => (decodedState ? previewOf(decodedState) : null), [decodedState]);
  const audit = useMemo(() => decodedState
    ? auditHistory(decodedState.history)
    : null, [decodedState]);

  const invalidateSource = useCallback((next: string) => {
    inputRef.current = next;
    verifyRequestRef.current += 1;
    setInput(next);
    setDecoding(false);
    setDecoded(null);
    setError(null);
    setStatus(null);
  }, []);

  const scheduleAcceptedClose = useCallback((delayMs: number) => {
    if (delayMs <= 0) {
      closeModal();
      return;
    }
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      onClose();
    }, delayMs);
  }, [closeModal, onClose]);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) invalidateSource(text);
    } catch {
      /* clipboard read blocked — user pastes manually */
    }
  }, [invalidateSource]);

  const handleVerify = useCallback(async (codeToVerify?: string) => {
    const source = codeToVerify ?? inputRef.current;
    if (codeToVerify !== undefined && source !== inputRef.current) {
      inputRef.current = source;
      setInput(source);
    }
    const request = { id: verifyRequestRef.current + 1, source };
    verifyRequestRef.current = request.id;
    setDecoding(true);
    setError(null);
    setStatus(null);
    setDecoded(null);

    const result = await decodeAndValidateSyncCode(source, initialState);
    if (!isCurrentImportRequest(verifyRequestRef.current, inputRef.current, request)) return;

    setDecoding(false);
    if (result.ok === false) {
      setError(result.error);
      return;
    }
    setDecoded({ source, value: result.state });
    if (result.warnings.length > 0) {
      setStatus(result.warnings.map(item => item.message).join(' '));
    }
  }, []);

  // Opened from a #sync= link → verify the pre-filled code immediately.
  useEffect(() => {
    if (initialImportCode) handleVerify(initialImportCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialImportCode]);

  const handleImport = useCallback(() => {
    if (acceptedRef.current) return;
    if (!candidateMatchesSource(decoded, inputRef.current)) {
      verifyRequestRef.current += 1;
      setDecoded(null);
      setError('The sync code changed. Verify the current code again.');
      return;
    }
    const warn = audit && audit.verdict === 'tampered'
      ? 'This run failed verification (the hash chain is broken). '
      : '';
    if (!window.confirm(`${warn}Import this run? It will OVERWRITE the current profile's save. This cannot be undone.`)) {
      return;
    }
    if (!candidateMatchesSource(decoded, inputRef.current)) {
      verifyRequestRef.current += 1;
      setDecoded(null);
      setError('The sync code changed. Verify the current code again.');
      return;
    }

    const decision = importUiDecision(importSave(decoded.value));
    setError(decision.error);
    if (decision.success) {
      const acceptedMessage = decision.warning
        ? `${decision.success}. ${decision.warning}`
        : decision.success;
      acceptedRef.current = true;
      setAccepted(true);
      setStatus(acceptedMessage);
      showToast(acceptedMessage);
    } else {
      setStatus(null);
    }
    if (decision.close) {
      inputRef.current = '';
      verifyRequestRef.current += 1;
      setInput('');
      setDecoding(false);
      setDecoded(null);
      scheduleAcceptedClose(decision.closeDelayMs ?? 0);
    }
  }, [decoded, audit, importSave, scheduleAcceptedClose]);

  // ── Backups ───────────────────────────────────────────────────────────────
  const [backups, setBackups] = useState<BackupMeta[]>([]);
  const [backupError, setBackupError] = useState<string | null>(null);
  useEffect(() => {
    if (tab === 'BACKUPS') setBackups(listBackups());
  }, [tab, listBackups]);

  const handleRestore = useCallback((b: BackupMeta) => {
    if (acceptedRef.current) return;
    if (!window.confirm(`Restore this backup (${b.summary})? It will OVERWRITE the current profile's save.`)) {
      return;
    }

    const decision = importUiDecision(restoreBackup(b.ts));
    setBackupError(decision.error);
    if (decision.success) {
      const acceptedMessage = decision.warning
        ? `${decision.success}. ${decision.warning}`
        : decision.success;
      acceptedRef.current = true;
      setAccepted(true);
      setStatus(acceptedMessage);
      showToast(acceptedMessage);
    } else {
      setStatus(null);
    }
    if (decision.close) scheduleAcceptedClose(decision.closeDelayMs ?? 0);
  }, [restoreBackup, scheduleAcceptedClose]);

  const TabBtn: React.FC<{ id: Tab; label: string; Icon: typeof Link2 }> = ({ id, label, Icon }) => (
    <button
      disabled={accepted}
      onClick={() => {
        setTab(id);
        setStatus(null);
        if (id !== 'BACKUPS') setBackupError(null);
      }}
      className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors ${
        tab === id
          ? 'text-cyan-300 border-b-2 border-cyan-400 bg-white/[0.03]'
          : 'text-gray-500 hover:text-gray-300 border-b-2 border-transparent'
      }`}
    >
      <Icon size={14} /> {label}
    </button>
  );

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={closeModal}
      role="dialog"
      aria-modal="true"
      aria-label="Sync code"
    >
      <div
        className="bg-[#161616] border border-white/10 rounded-xl shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-white/10 bg-[#1b1b1b] shrink-0">
          <div className="p-2 bg-cyan-900/20 rounded-lg border border-cyan-500/30 text-cyan-400">
            <Link2 size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-white leading-none flex items-center gap-1.5">Sync Code <SectionGuide id="SYNC" /></h2>
            <p className="text-[11px] text-gray-500 mt-1">
              Move a run between devices — copy a code, paste it elsewhere. No account needed.
            </p>
          </div>
          <button
            onClick={closeModal}
            className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 bg-[#141414] shrink-0">
          <TabBtn id="EXPORT" label="Export" Icon={Upload} />
          <TabBtn id="IMPORT" label="Import" Icon={ArrowDownToLine} />
          <TabBtn id="BACKUPS" label="Backups" Icon={History} />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
          {tab === 'EXPORT' && (
            <div className="space-y-3">
              <p className="text-[12px] text-gray-400 leading-relaxed">
                This code contains your entire current run, including verification data.
                Anyone with it can load your run, so share it like a password.
              </p>
              <div className="relative">
                <textarea
                  readOnly
                  value={encoding ? 'Generating sync code…' : code}
                  onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                  className="w-full h-32 resize-none rounded-lg bg-black/40 border border-white/10 p-3 font-mono text-[11px] text-cyan-200/90 leading-relaxed break-all focus:outline-none focus:border-cyan-500/40"
                />
                {encoding && (
                  <Loader2 size={16} className="absolute top-3 right-3 text-cyan-400 animate-spin" />
                )}
              </div>
              {exportError && (
                <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-950/40 p-3 text-red-300">
                  <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed">{exportError}</p>
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-gray-600 font-mono">
                  {code ? `${code.length.toLocaleString()} chars` : '—'}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyText(shareUrlFor(code), 'link')}
                    disabled={!code || encoding}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#252525] border border-white/10 hover:bg-[#2d2d2d] disabled:opacity-40 disabled:cursor-not-allowed text-gray-200 text-[12px] font-bold transition-colors"
                  >
                    {copied === 'link' ? <><Check size={14} /> Link!</> : <><Link2 size={14} /> Copy link</>}
                  </button>
                  <button
                    onClick={() => copyText(code, 'code')}
                    disabled={!code || encoding}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[12px] font-bold transition-colors"
                  >
                    {copied === 'code' ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy code</>}
                  </button>
                </div>
              </div>

              {/* QR of the share link */}
              {code && !encoding && (
                <div className="rounded-lg bg-[#1a1a1a] border border-white/5 p-4 flex flex-col items-center gap-2">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-gray-500">
                    <QrCode size={12} /> Scan to load on another device
                  </div>
                  {qr?.ok ? (
                    <div
                      className="w-44 h-44 rounded-md bg-white p-2"
                      // eslint-disable-next-line react/no-danger
                      dangerouslySetInnerHTML={{ __html: qr.svg! }}
                    />
                  ) : (
                    <p className="text-[11px] text-gray-500 text-center max-w-[16rem] leading-relaxed py-3">
                      {qr?.error ?? 'QR unavailable.'} Use <span className="text-cyan-300">Copy link</span> instead.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {tab === 'IMPORT' && (
            <div className="space-y-3">
              <p className="text-[12px] text-gray-400 leading-relaxed">
                Paste a sync code below and verify it before importing. Importing
                <span className="text-amber-300 font-semibold"> overwrites</span> this profile's current save.
              </p>
              <div className="relative">
                <textarea
                  value={input}
                  disabled={accepted}
                  onChange={(e) => invalidateSource(e.target.value)}
                  placeholder="FLSYNC.g1.…"
                  className="w-full h-28 resize-none rounded-lg bg-black/40 border border-white/10 p-3 font-mono text-[11px] text-gray-200 leading-relaxed break-all focus:outline-none focus:border-cyan-500/40 placeholder:text-gray-700"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePaste}
                  disabled={accepted}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#252525] border border-white/10 hover:bg-[#2d2d2d] text-gray-300 text-[11px] font-medium transition-colors"
                >
                  <ClipboardPaste size={13} /> Paste
                </button>
                <button
                  onClick={() => handleVerify()}
                  disabled={!input.trim() || decoding || accepted}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-bold transition-colors"
                >
                  {decoding ? <><Loader2 size={13} className="animate-spin" /> Verifying…</> : <><ShieldCheck size={13} /> Verify code</>}
                </button>
              </div>

              {error && (
                <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-950/40 p-3 text-red-300">
                  <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed">{error}</p>
                </div>
              )}

              {status && (
                <div role="status" aria-live="polite" className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-950/40 p-3 text-amber-300">
                  <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed">{status}</p>
                </div>
              )}

              {decoded && audit && preview && (() => {
                const v = VERDICT_UI[audit.verdict];
                return (
                  <div className="space-y-3 animate-in fade-in slide-in-from-bottom-1 duration-200">
                    <div className={`flex items-start gap-2.5 rounded-lg border p-3 ${v.cls}`}>
                      <v.Icon size={16} className="shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-[12px] font-bold leading-snug">{v.label}</p>
                        <p className="text-[10px] opacity-80 mt-0.5 leading-relaxed">{v.sub}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: 'Keys', value: preview.keys },
                        { label: 'Omni', value: preview.specialKeys },
                        { label: 'Chaos', value: preview.chaosKeys },
                        { label: 'Regions', value: preview.regions },
                        { label: 'Quests', value: preview.quests },
                        { label: 'Skill tiers', value: preview.skillTiers },
                      ].map((stat) => (
                        <div key={stat.label} className="rounded-lg bg-[#1a1a1a] border border-white/5 px-2.5 py-2 text-center">
                          <div className="text-[9px] uppercase tracking-wide text-gray-500">{stat.label}</div>
                          <div className="text-base font-bold text-white leading-tight">{stat.value}</div>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-gray-600 text-center font-mono">
                      {preview.events.toLocaleString()} logged events{preview.mode ? ` · ${preview.mode} mode` : ''}
                    </p>

                    <button
                      onClick={handleImport}
                      disabled={accepted}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[12px] font-bold transition-colors"
                    >
                      <ArrowDownToLine size={14} /> Import &amp; overwrite this profile
                    </button>
                  </div>
                );
              })()}
            </div>
          )}

          {tab === 'BACKUPS' && (
            <div className="space-y-3">
              <p className="text-[12px] text-gray-400 leading-relaxed">
                A snapshot is saved automatically before any import or reset. Restore one
                to roll back. Only the most recent few are kept, per profile.
              </p>
              {backupError && (
                <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-950/40 p-3 text-red-300">
                  <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed">{backupError}</p>
                </div>
              )}
              {status && (
                <div role="status" aria-live="polite" className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-950/40 p-3 text-amber-300">
                  <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed">{status}</p>
                </div>
              )}
              {backups.length === 0 ? (
                <div className="rounded-lg border border-white/5 bg-[#1a1a1a] p-6 text-center">
                  <History size={20} className="mx-auto text-gray-600 mb-2" />
                  <p className="text-[11px] text-gray-500">No backups yet.</p>
                  <p className="text-[10px] text-gray-600 mt-1">
                    One will appear here the next time you import a run or reset.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {backups.map((b) => (
                    <div
                      key={b.ts}
                      className="flex items-center gap-3 rounded-lg border border-white/5 bg-[#1a1a1a] px-3 py-2.5"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] font-bold text-gray-200 truncate">{b.reason}</span>
                          <span className="text-[10px] text-gray-600 font-mono shrink-0">{relativeTime(b.ts)}</span>
                        </div>
                        <p className="text-[10px] text-gray-500 font-mono truncate">{b.summary}</p>
                      </div>
                      <button
                        onClick={() => handleRestore(b)}
                        disabled={accepted}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#252525] border border-white/10 hover:border-cyan-500/40 hover:text-cyan-300 text-gray-300 text-[11px] font-bold transition-colors shrink-0"
                      >
                        <RotateCcw size={12} /> Restore
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
