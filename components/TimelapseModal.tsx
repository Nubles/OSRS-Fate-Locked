import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Play, Pause, SkipBack, SkipForward, FastForward, ShieldCheck, ShieldAlert, Download, ChevronsRight } from 'lucide-react';
import { LogEntry } from '../types';
import { verifyChain, replayInvariants, buildVerifiedBundle, computeRunId, ensureChain } from '../utils/integrity';
import { narrate, detectMilestones, toRunDay } from '../utils/timelapseNarration';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useGame } from '../context/GameContext';
import { resolveModeRules } from '../config/gameModes';

interface Props {
  history: LogEntry[];
  onClose: () => void;
}

const SPEEDS = [1, 2, 5, 20];
const TICK_MS = 350; // base event interval at 1x

const typeTheme: Record<string, { bg: string; border: string; glow: string; tint: string; label: string }> = {
  ROLL_OMNI:    { bg: 'bg-amber-950/70',    border: 'border-amber-400/70',    glow: 'shadow-[0_0_40px_rgba(251,191,36,0.5)]', tint: 'from-amber-500/20',   label: 'OMNI-KEY' },
  ROLL_SUCCESS: { bg: 'bg-emerald-950/70',  border: 'border-emerald-500/60',  glow: 'shadow-[0_0_30px_rgba(16,185,129,0.4)]',  tint: 'from-emerald-500/15', label: 'KEY FOUND' },
  PITY:         { bg: 'bg-sky-950/70',      border: 'border-sky-400/60',      glow: 'shadow-[0_0_30px_rgba(56,189,248,0.4)]',  tint: 'from-sky-500/15',     label: 'PITY KEY' },
  ROLL_FAIL:    { bg: 'bg-red-950/60',      border: 'border-red-500/40',      glow: '',                                        tint: 'from-red-500/10',     label: 'NO KEY' },
  UNLOCK:       { bg: 'bg-purple-950/70',   border: 'border-purple-400/60',   glow: 'shadow-[0_0_30px_rgba(167,139,250,0.4)]', tint: 'from-purple-500/20',  label: 'UNLOCK' },
  ALTAR:        { bg: 'bg-indigo-950/70',   border: 'border-indigo-400/60',   glow: 'shadow-[0_0_25px_rgba(129,140,248,0.3)]', tint: 'from-indigo-500/15',  label: 'RITUAL' },
  LEVEL_UP:     { bg: 'bg-teal-950/70',     border: 'border-teal-400/60',     glow: 'shadow-[0_0_25px_rgba(45,212,191,0.3)]',  tint: 'from-teal-500/15',    label: 'LEVEL UP' },
  ROLL:         { bg: 'bg-gray-900/70',     border: 'border-white/20',        glow: '',                                        tint: 'from-white/5',        label: 'ROLL' },
};

export const TimelapseModal: React.FC<Props> = ({ history, onClose }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef);
  const { gameModeId, customMode } = useGame();
  const chained = useMemo(() => ensureChain(history), [history]);
  const chainReport = useMemo(() => verifyChain(chained), [chained]);
  const replay = useMemo(() => replayInvariants(chained), [chained]);
  const milestones = useMemo(() => detectMilestones(chained), [chained]);
  const runId = useMemo(() => computeRunId(chained), [chained]);
  const firstTs = chained[0]?.timestamp ?? Date.now();

  const brokenSet = useMemo(() => new Set(chainReport.brokenAt), [chainReport]);
  const violationSet = useMemo(() => {
    const m = new Map<number, string[]>();
    for (const v of replay.violations) {
      const arr = m.get(v.index) ?? [];
      arr.push(v.message);
      m.set(v.index, arr);
    }
    return m;
  }, [replay]);

  const [idx, setIdx] = useState(chained.length > 0 ? chained.length - 1 : 0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [bundleBusy, setBundleBusy] = useState(false);

  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!playing) {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      return;
    }
    if (idx >= chained.length - 1) { setPlaying(false); return; }
    intervalRef.current = window.setInterval(() => {
      setIdx(prev => {
        if (prev >= chained.length - 1) { setPlaying(false); return prev; }
        return prev + 1;
      });
    }, Math.max(30, TICK_MS / speed));
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playing, speed, chained.length, idx]);

  const current = chained[idx];
  const trail = chained.slice(Math.max(0, idx - 4), idx);

  // Running stats up to and including `idx` — replay once per index change.
  const statsAtIdx = useMemo(() => replayInvariants(chained.slice(0, idx + 1)).final, [chained, idx]);

  const currentMilestone = milestones.find(m => m.index === idx);
  const jumpNextMilestone = () => {
    const next = milestones.find(m => m.index > idx);
    if (next) setIdx(next.index);
  };

  const exportBundle = async () => {
    setBundleBusy(true);
    try {
      const bundle = await buildVerifiedBundle(chained, {
        id: gameModeId ?? 'vanilla',
        rules: resolveModeRules(gameModeId, customMode),
      });
      const json = JSON.stringify(bundle, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${bundle.runId}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setBundleBusy(false);
    }
  };

  if (chained.length === 0) {
    return (
      <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-8">
        <div className="bg-[#0b0d10] border border-white/10 rounded-lg p-8 max-w-md w-full text-center">
          <h2 className="text-xl font-bold text-white mb-2">Timelapse</h2>
          <p className="text-gray-400 text-sm mb-4">No history yet — roll a few times and come back.</p>
          <button onClick={onClose} className="px-4 py-2 rounded bg-white/10 hover:bg-white/20 text-white text-sm">Close</button>
        </div>
      </div>
    );
  }

  const theme = typeTheme[current.type] ?? typeTheme.ROLL;
  const isBroken = brokenSet.has(idx);
  const hasViolation = violationSet.has(idx);
  const totalIssues = chainReport.brokenAt.length + replay.violations.length;
  const day = toRunDay(current.timestamp, firstTs);

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Run timelapse" tabIndex={-1} className="fixed inset-0 z-[100] bg-black/95 flex flex-col">
      {/* Top banner — integrity status */}
      <div className={`shrink-0 px-6 py-3 flex items-center justify-between border-b ${totalIssues === 0 ? 'border-emerald-500/40 bg-emerald-950/40' : 'border-red-500/50 bg-red-950/40'}`}>
        <div className="flex items-center gap-3">
          {totalIssues === 0
            ? <ShieldCheck size={22} className="text-emerald-400" />
            : <ShieldAlert size={22} className="text-red-400" />}
          <div>
            <div className={`text-sm font-bold ${totalIssues === 0 ? 'text-emerald-300' : 'text-red-300'}`}>
              {totalIssues === 0 ? 'INTEGRITY: OK' : `INTEGRITY: BROKEN — ${totalIssues} issue${totalIssues === 1 ? '' : 's'}`}
            </div>
            <div className="text-[10px] font-mono text-gray-400 tracking-wide">
              runId: <span className="text-gray-200">{runId ?? '—'}</span>
              {chainReport.brokenAt.length > 0 && <span className="ml-3 text-red-400">chain: {chainReport.brokenAt.length} broken links</span>}
              {replay.violations.length > 0 && <span className="ml-3 text-amber-400">invariants: {replay.violations.length}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportBundle}
            disabled={bundleBusy}
            className="px-3 py-1.5 rounded text-xs bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10 flex items-center gap-1.5 disabled:opacity-50"
            title="Export verified bundle (JSON) with SHA-256 commitment"
          >
            <Download size={13} />
            {bundleBusy ? 'Signing…' : 'Export Verified Bundle'}
          </button>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-white"><X size={20} /></button>
        </div>
      </div>

      {/* Live stats strip */}
      <div className="shrink-0 px-6 py-3 flex items-center gap-6 border-b border-white/10 bg-black/40 text-xs">
        <Stat label="Day" value={day} />
        <Stat label="Rolls" value={statsAtIdx.rolls} />
        <Stat label="Success" value={statsAtIdx.rolls === 0 ? '—' : `${Math.round((statsAtIdx.successes / statsAtIdx.rolls) * 100)}%`} />
        <Stat label="Omnis" value={statsAtIdx.omnis} accent="text-amber-300" />
        <Stat label="Pities" value={statsAtIdx.pities} accent="text-sky-300" />
        <Stat label="Unlocks" value={statsAtIdx.unlocks} accent="text-purple-300" />
        <Stat label="Keys" value={statsAtIdx.keys} />
        <Stat label="Omni-Keys" value={statsAtIdx.specialKeys} accent="text-amber-300" />
        <Stat label="Chaos" value={statsAtIdx.chaosKeys} accent="text-rose-300" />
        <Stat label="Fate" value={`${statsAtIdx.fatePoints}/50`} />
        <div className="ml-auto text-gray-400 font-mono text-[10px]">{idx + 1} / {chained.length}</div>
      </div>

      {/* Main stage */}
      <div className={`flex-1 relative overflow-hidden bg-gradient-to-b ${theme.tint} to-transparent`}>
        {/* trail */}
        <div className="absolute top-8 left-1/2 -translate-x-1/2 w-full max-w-2xl px-6 flex flex-col gap-1 pointer-events-none">
          {trail.map((t, ti) => {
            const th = typeTheme[t.type] ?? typeTheme.ROLL;
            const opacity = 0.15 + ti * 0.12;
            return (
              <div key={t.id} className={`text-[11px] font-mono text-gray-400 truncate ${th.bg} ${th.border} border rounded px-2 py-1`} style={{ opacity }}>
                <span className="text-gray-500">[{th.label}]</span> {t.message}
              </div>
            );
          })}
        </div>

        {/* current event card */}
        <div className="absolute inset-0 flex items-center justify-center p-8">
          <div className={`max-w-2xl w-full ${theme.bg} border-2 ${theme.border} ${theme.glow} rounded-xl p-6 transition-all duration-300 ${isBroken || hasViolation ? 'ring-2 ring-red-500' : ''}`}>
            {currentMilestone && (
              <div className="mb-3 flex items-center gap-2 text-amber-300 font-bold uppercase tracking-widest text-xs animate-pulse">
                <span className="text-2xl">{currentMilestone.emoji}</span>
                {currentMilestone.label}
              </div>
            )}
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold tracking-widest text-white/80 uppercase">{theme.label}</span>
              <span className="text-[10px] font-mono text-white/50">#{idx + 1}</span>
            </div>
            <div className="text-lg text-white mb-1">{current.message}</div>
            {current.details && <div className="text-xs text-gray-400 mb-3">{current.details}</div>}
            <div className="text-sm italic text-gray-300 border-l-2 border-white/20 pl-3">{narrate(current)}</div>

            <div className="mt-4 flex items-center gap-3 text-[10px] font-mono">
              {current.hash
                ? <span className={isBroken ? 'text-red-400' : 'text-emerald-400'} title="hash chain link">
                    {isBroken ? '⚠ broken' : '✓'} {current.hash.slice(0, 8)}
                  </span>
                : <span className="text-gray-500">legacy (unchained)</span>}
              {hasViolation && (
                <span className="text-amber-400" title={violationSet.get(idx)?.join(', ')}>
                  ⚠ {violationSet.get(idx)?.length} invariant
                </span>
              )}
              <span className="text-gray-500 ml-auto">{new Date(current.timestamp).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* density sparkline */}
        <div className="absolute bottom-24 left-6 right-6 h-12 flex items-end gap-[1px]">
          {chained.map((e, i) => {
            const bar = typeTheme[e.type] ?? typeTheme.ROLL;
            const active = i <= idx;
            const broken = brokenSet.has(i) || violationSet.has(i);
            return (
              <button
                key={e.id}
                onClick={() => setIdx(i)}
                className={`flex-1 min-w-[2px] transition-all ${active ? bar.border.replace('border-', 'bg-') : 'bg-white/5'} ${broken ? '!bg-red-500' : ''} ${i === idx ? 'h-12' : 'h-6'} hover:h-10`}
                title={`#${i + 1} ${e.type}`}
                style={{ opacity: active ? 1 : 0.4 }}
              />
            );
          })}
        </div>
      </div>

      {/* Controls */}
      <div className="shrink-0 px-6 py-4 border-t border-white/10 bg-black/60 flex items-center gap-3">
        <button
          onClick={() => setIdx(i => Math.max(0, i - 1))}
          className="p-2 rounded bg-white/5 hover:bg-white/10 text-white"
          title="Step back"
        ><SkipBack size={16} /></button>

        <button
          onClick={() => {
            if (idx >= chained.length - 1) { setIdx(0); setPlaying(true); return; }
            setPlaying(p => !p);
          }}
          className="p-3 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white"
          title={playing ? 'Pause' : 'Play'}
        >
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </button>

        <button
          onClick={() => setIdx(i => Math.min(chained.length - 1, i + 1))}
          className="p-2 rounded bg-white/5 hover:bg-white/10 text-white"
          title="Step forward"
        ><SkipForward size={16} /></button>

        <button
          onClick={jumpNextMilestone}
          className="p-2 rounded bg-white/5 hover:bg-white/10 text-amber-300 border border-amber-500/30"
          title="Jump to next milestone"
        ><ChevronsRight size={16} /></button>

        <input
          type="range"
          min={0}
          max={chained.length - 1}
          value={idx}
          onChange={e => setIdx(Number(e.target.value))}
          className="flex-1 accent-emerald-400"
        />

        <div className="flex items-center gap-1">
          <FastForward size={14} className="text-gray-400" />
          {SPEEDS.map(s => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`px-2 py-1 rounded text-[11px] font-mono ${speed === s ? 'bg-emerald-500 text-black' : 'bg-white/5 text-gray-300 hover:bg-white/10'}`}
            >{s}x</button>
          ))}
        </div>
      </div>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: React.ReactNode; accent?: string }> = ({ label, value, accent = 'text-white' }) => (
  <div className="flex flex-col leading-tight">
    <span className="text-[9px] uppercase tracking-widest text-gray-500">{label}</span>
    <span className={`font-mono font-bold ${accent}`}>{value}</span>
  </div>
);
