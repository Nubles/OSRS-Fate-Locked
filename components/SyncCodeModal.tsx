import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  X, Link2, Copy, Check, ClipboardPaste, ShieldCheck, ShieldAlert,
  AlertTriangle, Loader2, ArrowDownToLine, Upload, QrCode, History, RotateCcw,
} from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { SectionGuide } from './SectionGuide';
import { encodeSyncCode, decodeSyncCode } from '../utils/syncCode';
import { makeQrSvg } from '../utils/qr';
import { auditHistory, RunVerdict } from '../utils/integrity';
import { BackupMeta } from '../utils/backups';
import { GameState, LogEntry } from '../types';

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

const previewOf = (state: Record<string, unknown>): RunPreview => {
  const s = state as Partial<GameState>;
  const u = (s.unlocks ?? {}) as Record<string, any>;
  const skillTiers = Object.values((u.skills ?? {}) as Record<string, number>)
    .reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
  return {
    keys: typeof s.keys === 'number' ? s.keys : 0,
    specialKeys: typeof s.specialKeys === 'number' ? s.specialKeys : 0,
    chaosKeys: typeof s.chaosKeys === 'number' ? s.chaosKeys : 0,
    regions: Array.isArray(u.regions) ? u.regions.length : 0,
    quests: Array.isArray(u.quests) ? u.quests.length : 0,
    skillTiers,
    events: Array.isArray(s.history) ? s.history.length : 0,
    mode: typeof s.gameModeId === 'string' ? s.gameModeId : undefined,
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
  const { getExportData, importSave, createBackup, listBackups, restoreBackup } = useGame();
  useEscapeKey(onClose, true);

  const [tab, setTab] = useState<Tab>(initialImportCode ? 'IMPORT' : 'EXPORT');

  // ── Export ──────────────────────────────────────────────────────────────
  const [code, setCode] = useState<string>('');
  const [encoding, setEncoding] = useState(true);
  const [copied, setCopied] = useState<'none' | 'code' | 'link'>('none');

  const qr = useMemo(() => (code ? makeQrSvg(shareUrlFor(code)) : null), [code]);

  useEffect(() => {
    let cancelled = false;
    setEncoding(true);
    (async () => {
      try {
        const raw = getExportData();
        const state = raw ? JSON.parse(raw) : {};
        const generated = await encodeSyncCode(state);
        if (!cancelled) setCode(generated);
      } catch {
        if (!cancelled) setCode('');
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
  const [decoding, setDecoding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decoded, setDecoded] = useState<Record<string, unknown> | null>(null);

  const preview = useMemo(() => (decoded ? previewOf(decoded) : null), [decoded]);
  const audit = useMemo(() => {
    if (!decoded) return null;
    const history = (decoded as Partial<GameState>).history;
    return auditHistory(Array.isArray(history) ? (history as LogEntry[]) : []);
  }, [decoded]);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setInput(text);
    } catch {
      /* clipboard read blocked — user pastes manually */
    }
  }, []);

  const handleVerify = useCallback(async (codeToVerify?: string) => {
    setDecoding(true);
    setError(null);
    setDecoded(null);
    const result = await decodeSyncCode(codeToVerify ?? input);
    setDecoding(false);
    if (!result.ok) {
      setError(result.error ?? 'Could not read that code.');
      return;
    }
    setDecoded(result.state ?? null);
  }, [input]);

  // Opened from a #sync= link → verify the pre-filled code immediately.
  useEffect(() => {
    if (initialImportCode) handleVerify(initialImportCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialImportCode]);

  const handleImport = useCallback(() => {
    if (!decoded) return;
    const warn = audit && audit.verdict === 'tampered'
      ? 'This run failed verification (the hash chain is broken). '
      : '';
    if (!window.confirm(`${warn}Import this run? It will OVERWRITE the current profile's save. This cannot be undone.`)) {
      return;
    }
    // Snapshot the run we're about to replace so the import is recoverable.
    createBackup('Before sync import');
    importSave(decoded as Partial<GameState>);
    onClose();
  }, [decoded, audit, importSave, createBackup, onClose]);

  // ── Backups ───────────────────────────────────────────────────────────────
  const [backups, setBackups] = useState<BackupMeta[]>([]);
  useEffect(() => {
    if (tab === 'BACKUPS') setBackups(listBackups());
  }, [tab, listBackups]);

  const handleRestore = useCallback((b: BackupMeta) => {
    if (!window.confirm(`Restore this backup (${b.summary})? It will OVERWRITE the current profile's save.`)) {
      return;
    }
    restoreBackup(b.ts);
    onClose();
  }, [restoreBackup, onClose]);

  const TabBtn: React.FC<{ id: Tab; label: string; Icon: typeof Link2 }> = ({ id, label, Icon }) => (
    <button
      onClick={() => setTab(id)}
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
      onClick={onClose}
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
            onClick={onClose}
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
                  value={encoding ? 'Generating sync code…' : (code || 'Nothing to export yet.')}
                  onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                  className="w-full h-32 resize-none rounded-lg bg-black/40 border border-white/10 p-3 font-mono text-[11px] text-cyan-200/90 leading-relaxed break-all focus:outline-none focus:border-cyan-500/40"
                />
                {encoding && (
                  <Loader2 size={16} className="absolute top-3 right-3 text-cyan-400 animate-spin" />
                )}
              </div>
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
                  onChange={(e) => { setInput(e.target.value); setDecoded(null); setError(null); }}
                  placeholder="FLSYNC.g1.…"
                  className="w-full h-28 resize-none rounded-lg bg-black/40 border border-white/10 p-3 font-mono text-[11px] text-gray-200 leading-relaxed break-all focus:outline-none focus:border-cyan-500/40 placeholder:text-gray-700"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePaste}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#252525] border border-white/10 hover:bg-[#2d2d2d] text-gray-300 text-[11px] font-medium transition-colors"
                >
                  <ClipboardPaste size={13} /> Paste
                </button>
                <button
                  onClick={() => handleVerify()}
                  disabled={!input.trim() || decoding}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-bold transition-colors"
                >
                  {decoding ? <><Loader2 size={13} className="animate-spin" /> Verifying…</> : <><ShieldCheck size={13} /> Verify code</>}
                </button>
              </div>

              {error && (
                <div className="flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-950/40 p-3 text-red-300">
                  <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed">{error}</p>
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
