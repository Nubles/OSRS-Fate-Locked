import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Play, Pause, SkipBack, SkipForward, FastForward, ShieldCheck, ShieldAlert, Download, ChevronsRight } from 'lucide-react';
import { LogEntry } from '../types';
import { computeRunId, ensureChain } from '../utils/integrity';
import { auditHistory, replayInvariants, buildVerifiedBundle } from '../utils/runAudit';
import { narrate, detectMilestones, toRunDay } from '../utils/timelapseNarration';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useGame } from '../context/GameContext';
import { WikiIcon } from './WikiIcon';
import { resolveModeRules } from '../config/gameModes';
import { useIsOsrsUi } from '../utils/uiStyle';
import { OsrsTitleBar } from './osrs/OsrsWindowChrome';

interface Props {
  history: LogEntry[];
  onClose: () => void;
}

const SPEEDS = [1, 2, 5, 20];
const TICK_MS = 350; // base event interval at 1x

/** OSRS layout: the outcome word's colour on the parchment event box (chat colours). */
const outcomeTone = (type: string): 'good' | 'bad' | undefined => {
  switch (type) {
    case 'ROLL_OMNI': case 'PET': case 'ROLL_SUCCESS': case 'PITY': case 'UNLOCK': case 'LEVEL_UP':
    case 'ACHIEVEMENT': case 'XTREME_MILESTONE': return 'good';
    case 'ROLL_FAIL': return 'bad';
    default: return undefined;
  }
};

const typeTheme: Record<string, { bg: string; border: string; glow: string; tint: string; label: string }> = {
  ROLL_OMNI:    { bg: 'bg-amber-950/70',    border: 'border-amber-400/70',    glow: 'shadow-[0_0_40px_rgba(251,191,36,0.5)]', tint: 'from-amber-500/20',   label: 'OMNI-KEY' },
  PET:          { bg: 'bg-amber-950/70',    border: 'border-amber-400/70',    glow: 'shadow-[0_0_40px_rgba(251,191,36,0.5)]', tint: 'from-amber-500/20',   label: 'NEW PET' },
  ROLL_SUCCESS: { bg: 'bg-emerald-950/70',  border: 'border-emerald-500/60',  glow: 'shadow-[0_0_30px_rgba(16,185,129,0.4)]',  tint: 'from-emerald-500/15', label: 'KEY FOUND' },
  PITY:         { bg: 'bg-sky-950/70',      border: 'border-sky-400/60',      glow: 'shadow-[0_0_30px_rgba(56,189,248,0.4)]',  tint: 'from-sky-500/15',     label: 'PITY KEY' },
  ROLL_FAIL:    { bg: 'bg-red-950/60',      border: 'border-red-500/40',      glow: '',                                        tint: 'from-red-500/10',     label: 'NO KEY' },
  UNLOCK:       { bg: 'bg-purple-950/70',   border: 'border-purple-400/60',   glow: 'shadow-[0_0_30px_rgba(167,139,250,0.4)]', tint: 'from-purple-500/20',  label: 'UNLOCK' },
  ALTAR:        { bg: 'bg-indigo-950/70',   border: 'border-indigo-400/60',   glow: 'shadow-[0_0_25px_rgba(129,140,248,0.3)]', tint: 'from-indigo-500/15',  label: 'RITUAL' },
  LEVEL_UP:     { bg: 'bg-teal-950/70',     border: 'border-teal-400/60',     glow: 'shadow-[0_0_25px_rgba(45,212,191,0.3)]',  tint: 'from-teal-500/15',    label: 'LEVEL UP' },
  ACHIEVEMENT:  { bg: 'bg-yellow-950/70',   border: 'border-yellow-400/60',   glow: 'shadow-[0_0_25px_rgba(250,204,21,0.3)]',  tint: 'from-yellow-500/15',  label: 'ACHIEVEMENT' },
  XTREME_MILESTONE: { bg: 'bg-amber-950/70', border: 'border-amber-400/60',   glow: 'shadow-[0_0_25px_rgba(251,191,36,0.3)]',  tint: 'from-amber-500/15',   label: 'MILESTONE' },
  FATE:         { bg: 'bg-violet-950/70',   border: 'border-violet-400/50',   glow: '',                                        tint: 'from-violet-500/10',  label: 'FATE' },
  COMPENSATION: { bg: 'bg-cyan-950/70',     border: 'border-cyan-400/50',     glow: '',                                        tint: 'from-cyan-500/10',    label: 'COMPENSATION' },
  ROLL:         { bg: 'bg-gray-900/70',     border: 'border-white/20',        glow: '',                                        tint: 'from-white/5',        label: 'ROLL' },
};

export const TimelapseModal: React.FC<Props> = ({ history, onClose }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef);
  // OSRS layout: stone window, stone panels and buttons, parchment event box.
  const osrs = useIsOsrsUi();
  const { gameModeId, customMode, keys, specialKeys, chaosKeys, fatePoints, unlocks } = useGame();
  const pityRules = resolveModeRules(gameModeId, customMode);
  const saved = useMemo(() => ({ keys, specialKeys, chaosKeys, fatePoints, unlocks }), [keys, specialKeys, chaosKeys, fatePoints, unlocks]);
  // The history as stored is what's checked; the chained copy only fills in
  // links for display and export.
  const audit = useMemo(() => auditHistory(history, pityRules, saved), [history, pityRules, saved]);
  const chained = useMemo(() => ensureChain(history), [history]);
  const chainReport = audit.chain;
  const milestones = useMemo(() => detectMilestones(chained), [chained]);
  const runId = useMemo(() => computeRunId(chained), [chained]);
  const firstTs = chained[0]?.timestamp ?? Date.now();

  const brokenSet = useMemo(() => new Set(chainReport.brokenAt), [chainReport]);
  const violationSet = useMemo(() => {
    const m = new Map<number, string[]>();
    for (const v of audit.violations) {
      const arr = m.get(v.index) ?? [];
      arr.push(v.message);
      m.set(v.index, arr);
    }
    return m;
  }, [audit]);

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
  const statsAtIdx = useMemo(() => replayInvariants(chained.slice(0, idx + 1), undefined, pityRules).final, [chained, idx, pityRules]);

  const currentMilestone = milestones.find(m => m.index === idx);
  const jumpNextMilestone = () => {
    const next = milestones.find(m => m.index > idx);
    if (next) setIdx(next.index);
  };

  const exportBundle = async () => {
    setBundleBusy(true);
    try {
      const bundle = await buildVerifiedBundle(history, {
        id: gameModeId ?? 'vanilla',
        rules: pityRules,
      }, saved);
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
    if (osrs) {
      return (
        <div className="fixed inset-0 z-[100] owb-tl-backdrop flex items-center justify-center p-8">
          <div className="osrs-win owb-win owb-tl-empty">
            <OsrsTitleBar title="Timelapse" onClose={onClose} />
            <p className="owb-tl-empty-text">No history yet — roll a few times and come back.</p>
          </div>
        </div>
      );
    }
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
  // Same verdict as the share card and the import check (auditHistory).
  const integrity: 'ok' | 'warning' | 'broken' = audit.verdict === 'tampered'
    ? 'broken'
    : audit.verdict === 'warning' ? 'warning' : 'ok';
  const problems = audit.reasons.length;
  const day = toRunDay(current.timestamp, firstTs);

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Run timelapse" tabIndex={-1} className={osrs ? 'fixed inset-0 z-[100] owb-tl-backdrop flex' : 'fixed inset-0 z-[100] bg-black/95 flex flex-col'}>
     <OsrsFrame osrs={osrs}>
      {osrs && <OsrsTitleBar title="Timelapse" onClose={onClose} closeLabel="Close timelapse" />}
      {/* Top banner — integrity status */}
      <div data-integrity={osrs ? integrity : undefined} className={osrs ? 'owb-tl-banner' : `shrink-0 px-6 py-3 flex items-center justify-between border-b ${integrity === 'ok' ? 'border-emerald-500/40 bg-emerald-950/40' : integrity === 'warning' ? 'border-amber-500/40 bg-amber-950/30' : 'border-red-500/50 bg-red-950/40'}`}>
        <div className="flex items-center gap-3">
          {integrity === 'ok'
            ? <ShieldCheck size={22} className="text-emerald-400" />
            : <ShieldAlert size={22} className={integrity === 'warning' ? 'text-amber-400' : 'text-red-400'} />}
          <div>
            <div className={`text-sm font-bold ${integrity === 'ok' ? 'text-emerald-300' : integrity === 'warning' ? 'text-amber-300' : 'text-red-300'}`}>
              {integrity === 'ok'
                ? 'HISTORY INTACT (SELF-REPORTED)'
                : integrity === 'warning'
                  ? `HISTORY DOESN'T ADD UP: ${problems} problem${problems === 1 ? '' : 's'}`
                  : `HISTORY EDITED: ${problems} problem${problems === 1 ? '' : 's'}`}
            </div>
            <div className="text-[10px] font-mono text-gray-400 tracking-wide">
              runId: <span className="text-gray-200">{runId ?? '—'}</span>
              <span className={`ml-3 ${integrity === 'broken' ? 'text-red-400' : integrity === 'warning' ? 'text-amber-400' : 'text-gray-400'}`}>
                {integrity !== 'ok'
                  ? audit.reasons[0]
                  : audit.totals.status === 'match' ? 'Keys, Fate and unlocks match the history.' : audit.totals.reasons[0]}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportBundle}
            disabled={bundleBusy}
            className={osrs ? 'osrs-btn owb-tl-export' : 'px-3 py-1.5 rounded text-xs bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10 flex items-center gap-1.5 disabled:opacity-50'}
            title="Download this run's history and replay totals as JSON, with a SHA-256 checksum. Nothing is signed."
          >
            {!osrs && <Download size={13} />}
            {bundleBusy ? 'Exporting…' : 'Export run bundle'}
          </button>
          {!osrs && <button onClick={onClose} aria-label="Close timelapse" className="p-1.5 text-gray-400 hover:text-white"><X size={20} /></button>}
        </div>
      </div>

      {/* Live stats strip */}
      <div className={osrs ? 'owb-tl-stats' : 'shrink-0 px-6 py-3 flex items-center gap-6 border-b border-white/10 bg-black/40 text-xs'}>
        <Stat label="Day" value={day} />
        <Stat label="Rolls" value={statsAtIdx.rolls} />
        <Stat label="Success" value={statsAtIdx.rolls === 0 ? '—' : `${Math.round((statsAtIdx.successes / statsAtIdx.rolls) * 100)}%`} />
        <Stat label="Omni-Keys found" value={statsAtIdx.omnis} accent="text-amber-300" />
        <Stat label="Pity Keys" value={statsAtIdx.pities} accent="text-sky-300" />
        <Stat label="Unlocks" value={statsAtIdx.unlocks} accent="text-purple-300" />
        <Stat label="Keys" value={statsAtIdx.keys} />
        <Stat label="Omni-Keys held" value={statsAtIdx.specialKeys} accent="text-amber-300" />
        <Stat label="Chaos" value={statsAtIdx.chaosKeys} accent="text-rose-300" />
        <Stat label="Fate" value={pityRules.pityEnabled ? `${statsAtIdx.fatePoints}/${pityRules.pityThreshold}` : statsAtIdx.fatePoints} />
        <div className="ml-auto text-gray-400 font-mono text-[10px]">{idx + 1} / {chained.length}</div>
      </div>

      {/* Main stage */}
      <div className={osrs ? 'owb-tl-stage flex-1 relative overflow-hidden' : `flex-1 relative overflow-hidden bg-gradient-to-b ${theme.tint} to-transparent`}>
        {/* trail */}
        <div className="absolute top-8 left-1/2 -translate-x-1/2 w-full max-w-2xl px-6 flex flex-col gap-1 pointer-events-none">
          {trail.map((t, ti) => {
            const th = typeTheme[t.type] ?? typeTheme.ROLL;
            const opacity = 0.15 + ti * 0.12;
            return (
              <div key={t.id} className={osrs ? 'owb-tl-trail' : `text-[11px] font-mono text-gray-400 truncate ${th.bg} ${th.border} border rounded px-2 py-1`} style={{ opacity: osrs ? 0.35 + ti * 0.15 : opacity }}>
                <span className="text-gray-500">[{th.label}]</span> {t.message}
              </div>
            );
          })}
        </div>

        {/* current event card */}
        <div className="absolute inset-0 flex items-center justify-center p-8">
          <div data-flag={osrs && (isBroken || hasViolation) ? true : undefined} className={osrs ? 'owb-tl-event' : `max-w-2xl w-full ${theme.bg} border-2 ${theme.border} ${theme.glow} rounded-xl p-6 transition-all duration-300 ${isBroken || hasViolation ? 'ring-2 ring-red-500' : ''}`}>
            {currentMilestone && (
              <div className={osrs ? 'owb-tl-milestone' : 'mb-3 flex items-center gap-2 text-amber-300 font-bold uppercase tracking-widest text-xs animate-pulse'}>
                <WikiIcon file={currentMilestone.image} alt="" Fallback={ShieldCheck} size={28} className="shrink-0" />
                {currentMilestone.label}
              </div>
            )}
            <div className="flex items-center justify-between mb-3">
              <span className={osrs ? 'owb-tl-outcome' : 'text-[10px] font-bold tracking-widest text-white/80 uppercase'} data-tone={osrs ? outcomeTone(current.type) : undefined}>{theme.label}</span>
              <span className={osrs ? 'owb-tl-num' : 'text-[10px] font-mono text-white/50'}>#{idx + 1}</span>
            </div>
            <div className={osrs ? 'owb-tl-msg' : 'text-lg text-white mb-1'}>{current.message}</div>
            {current.details && <div className={osrs ? 'owb-tl-details' : 'text-xs text-gray-400 mb-3'}>{current.details}</div>}
            <div className={osrs ? 'owb-tl-narr' : 'text-sm italic text-gray-300 border-l-2 border-white/20 pl-3'}>{narrate(current)}</div>

            <div className={osrs ? 'owb-tl-meta' : 'mt-4 flex items-center gap-3 text-[10px] font-mono'}>
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
        <div className={osrs ? 'owb-tl-spark' : 'absolute bottom-24 left-6 right-6 h-12 flex items-end gap-[1px]'}>
          {chained.map((e, i) => {
            const bar = typeTheme[e.type] ?? typeTheme.ROLL;
            const active = i <= idx;
            const broken = brokenSet.has(i) || violationSet.has(i);
            return (
              <button
                key={e.id}
                onClick={() => setIdx(i)}
                data-tone={osrs ? (broken ? 'broken' : outcomeTone(e.type) ?? 'none') : undefined}
                data-on={osrs && active ? true : undefined}
                className={osrs ? `owb-tl-bar${i === idx ? ' is-cur' : ''}` : `flex-1 min-w-[2px] transition-all ${active ? bar.border.replace('border-', 'bg-') : 'bg-white/5'} ${broken ? '!bg-red-500' : ''} ${i === idx ? 'h-12' : 'h-6'} hover:h-10`}
                title={`#${i + 1} ${e.type}`}
                style={osrs ? undefined : { opacity: active ? 1 : 0.4 }}
              />
            );
          })}
        </div>
      </div>

      {/* Controls */}
      <div className={osrs ? 'owb-tl-controls' : 'shrink-0 px-6 py-4 border-t border-white/10 bg-black/60 flex items-center gap-3'}>
        <button
          onClick={() => setIdx(i => Math.max(0, i - 1))}
          className={osrs ? 'osrs-btn owb-tl-ctl' : 'p-2 rounded bg-white/5 hover:bg-white/10 text-white'}
          title="Step back"
        ><SkipBack size={16} /></button>

        <button
          onClick={() => {
            if (idx >= chained.length - 1) { setIdx(0); setPlaying(true); return; }
            setPlaying(p => !p);
          }}
          className={osrs ? 'osrs-btn owb-tl-ctl owb-tl-play' : 'p-3 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white'}
          title={playing ? 'Pause' : 'Play'}
        >
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </button>

        <button
          onClick={() => setIdx(i => Math.min(chained.length - 1, i + 1))}
          className={osrs ? 'osrs-btn owb-tl-ctl' : 'p-2 rounded bg-white/5 hover:bg-white/10 text-white'}
          title="Step forward"
        ><SkipForward size={16} /></button>

        <button
          onClick={jumpNextMilestone}
          className={osrs ? 'osrs-btn owb-tl-ctl' : 'p-2 rounded bg-white/5 hover:bg-white/10 text-amber-300 border border-amber-500/30'}
          title="Jump to next milestone"
        ><ChevronsRight size={16} /></button>

        <input
          type="range"
          min={0}
          max={chained.length - 1}
          value={idx}
          onChange={e => setIdx(Number(e.target.value))}
          className={osrs ? 'owb-tl-range' : 'flex-1 accent-emerald-400'}
        />

        <div className="flex items-center gap-1">
          {osrs ? <span className="owb-tl-speed">Speed</span> : <FastForward size={14} className="text-gray-400" />}
          {SPEEDS.map(s => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              aria-pressed={osrs ? speed === s : undefined}
              className={osrs ? `osrs-btn owb-tl-ctl${speed === s ? ' is-on' : ''}` : `px-2 py-1 rounded text-[11px] font-mono ${speed === s ? 'bg-emerald-500 text-black' : 'bg-white/5 text-gray-300 hover:bg-white/10'}`}
            >{s}x</button>
          ))}
        </div>
      </div>
     </OsrsFrame>
    </div>
  );
};

/** The OSRS layout's stone window around the timelapse; the classic layout has no wrapper. */
const OsrsFrame: React.FC<{ osrs: boolean; children: React.ReactNode }> = ({ osrs, children }) =>
  osrs ? <div className="osrs-win owb-win owb-tl">{children}</div> : <>{children}</>;

const Stat: React.FC<{ label: string; value: React.ReactNode; accent?: string }> = ({ label, value, accent = 'text-white' }) => (
  <div className="owb-tl-stat flex flex-col leading-tight">
    <span className="text-[9px] uppercase tracking-widest text-gray-500">{label}</span>
    <span className={`owb-tl-val font-mono font-bold ${accent}`}>{value}</span>
  </div>
);
