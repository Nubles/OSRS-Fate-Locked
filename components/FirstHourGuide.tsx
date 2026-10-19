import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Check, X } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { resolveModeRules } from '../config/gameModes';
import { STARTING_KEYS } from '../config/economy';
import { useIsOsrsUi } from '../utils/uiStyle';
import {
  EMPTY_RECORD, FIRST_ROLL_CHECKS, firstHourActive, firstHourProgress, firstSightRecord, markSeen, nextAnnouncement,
  readFirstHourEnabled, readFirstHourRecord, rollCheckActive, writeFirstHourRecord,
  type FirstHourRecord, type FirstHourStep, type FirstHourStepId, type FirstHourTarget,
} from '../utils/firstHour';
import { setFirstHourView, type FirstHourView } from '../utils/firstHourStore';
import { setRollCheckOn, useRollCheck, type RollCheck } from '../utils/rollCheck';
import type { LogEntry } from '../types';

/**
 * The guided first hour (utils/firstHour.ts has the steps and why they are
 * done). This driver works out the current step, points at the real thing to
 * click, and notices the look-at steps (Journal, Void Altar, Sync & Roll)
 * being opened. It draws:
 *   - classic layout: a card under the header, in place of the coach strip,
 *     and an amber ring on the thing to click;
 *   - OSRS layout: Tutorial Island's yellow hint arrow over the thing to
 *     click; the instruction itself is spoken in the chatbox
 *     (components/osrs/OsrsChatbox.tsx reads utils/firstHourStore.ts);
 *   - both: a quest-complete scroll at the end.
 * It also asks "Did you finish this in game?" before a new run's first few
 * rolls (utils/rollCheck.ts), since a roll can't be undone.
 * Skip guide stops it for this run; Settings → Guided first hour turns it off
 * everywhere, or back on (which restarts it for the current run).
 */

const UI = `${import.meta.env.BASE_URL}osrs-ui/`;

/**
 * What each step points at, per layout: the first visible match wins, so a
 * list goes from the most specific (a table inside the open Spend Keys panel)
 * to the way there (the Spend Keys tab).
 */
const TARGETS: Record<'classic' | 'osrs', Record<FirstHourTarget, string[]>> = {
  classic: {
    'spend-keys': ['[data-first-hour="spend-table"]', '[data-tour="spend"]'],
    'spend-table': ['[data-first-hour="spend-table"]'],
    journal: ['[data-first-hour="journal-card"]', '[data-first-hour="journal-tab"]'],
    'farm-keys': ['[data-tour="farm"]'],
    fate: ['[data-first-hour="fate"]'],
    altar: ['[data-tour="altar"]'],
    sync: ['[data-first-hour="sync-tab"]'],
  },
  osrs: {
    'spend-keys': ['[data-first-hour="spend-table"]', '[data-tour="spend"]'],
    'spend-table': ['[data-first-hour="spend-table"]'],
    journal: ['[data-first-hour="journal-card"]', '[data-first-hour="journal-tab"]'],
    'farm-keys': ['[data-tour="farm"]'],
    fate: ['[data-first-hour="fate"]'],
    altar: ['[data-tour="altar"]'],
    sync: ['[data-first-hour="sync-tab"]'],
  },
};

/** A look-at step is done once this is on screen. */
const SEEN: Partial<Record<FirstHourStepId, string>> = {
  journal: '[data-first-hour="journal-open"]',
  altar: '[data-first-hour="altar-open"]',
  sync: '[data-first-hour="sync-open"]',
};

const ICONS: Record<FirstHourStepId, string> = {
  spend: `${UI}items/key.png`,
  journal: `${UI}quest_point_icon.png`,
  roll: `${UI}npc/turael_chat.png`,
  fate: `${UI}items/void_seal.png`,
  altar: `${UI}items/void_seal.png`,
  sync: `${UI}items/achievement_diaries_icon.png`,
};

const visible = (el: Element | null): el is HTMLElement => {
  if (!(el instanceof HTMLElement)) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0
    && r.top < window.innerHeight && r.left < window.innerWidth;
};

const firstVisible = (selectors: string[]): HTMLElement | null => {
  for (const sel of selectors) {
    for (const el of Array.from(document.querySelectorAll(sel))) if (visible(el)) return el as HTMLElement;
  }
  return null;
};

/** The guide's per-run record: read on run change, created on first sight. */
const useRecord = (runId: string, history: readonly LogEntry[]) => {
  const [state, setState] = useState<{ runId: string; record: FirstHourRecord }>(() => ({
    runId, record: readFirstHourRecord(runId) ?? EMPTY_RECORD,
  }));
  useEffect(() => {
    const stored = readFirstHourRecord(runId);
    if (stored) { setState({ runId, record: stored }); return; }
    const fresh = firstSightRecord(history);
    writeFirstHourRecord(runId, fresh);
    setState({ runId, record: fresh });
    // Only on a run change: first sight must read the history the run had then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);
  const update = useCallback((fn: (r: FirstHourRecord) => FirstHourRecord) => {
    setState((s) => {
      const next = fn(s.record);
      if (next === s.record) return s;
      writeFirstHourRecord(s.runId, next);
      return { ...s, record: next };
    });
  }, []);
  return [state.runId === runId ? state.record : (readFirstHourRecord(runId) ?? EMPTY_RECORD), update, setState] as const;
};

export const FirstHourGuide: React.FC = () => {
  const { history, keys, runId, gameModeId, customMode, hasSeenOnboarding } = useGame() as unknown as {
    history: LogEntry[]; keys: number; runId: string; gameModeId?: string;
    customMode?: unknown; hasSeenOnboarding: boolean;
  };
  const isOsrs = useIsOsrsUi();
  const [enabled, setEnabled] = useState(readFirstHourEnabled);
  const [record, update, setRecordState] = useRecord(runId, history);

  // Settings → Guided first hour. Turning it on restarts it for this run.
  useEffect(() => {
    const onChange = () => {
      const on = readFirstHourEnabled();
      setEnabled(on);
      if (on) {
        const stored = readFirstHourRecord(runId) ?? EMPTY_RECORD;
        const restarted: FirstHourRecord = { seen: stored.seen };
        writeFirstHourRecord(runId, restarted);
        setRecordState({ runId, record: restarted });
      }
    };
    window.addEventListener('fate:first-hour', onChange);
    return () => window.removeEventListener('fate:first-hour', onChange);
  }, [runId, setRecordState]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rules = resolveModeRules(gameModeId as any, customMode as any);
  const input = useMemo(() => ({
    history, keys, startingKeys: STARTING_KEYS,
    pityThreshold: rules.pityThreshold, chunked: gameModeId === 'chunked',
  }), [history, keys, rules.pityThreshold, gameModeId]);
  const progress = useMemo(() => firstHourProgress(input, record), [input, record]);
  const active = hasSeenOnboarding && firstHourActive(record, enabled);

  const checking = hasSeenOnboarding && rollCheckActive(record, enabled, history);
  useEffect(() => { setRollCheckOn(checking); }, [checking]);
  useEffect(() => () => setRollCheckOn(false), []);
  const rollCheck = useRollCheck();

  // "Done" beats: each step finished while the guide watches says what it
  // taught, in order, even when one roll finishes two steps at once. Steps
  // already done when the guide first sees the run are not announced.
  const [announced, setAnnounced] = useState<{ runId: string; ids: Set<FirstHourStepId> }>(() => ({ runId, ids: new Set(progress.done) }));
  useEffect(() => {
    if (announced.runId !== runId) setAnnounced({ runId, ids: new Set(progress.done) });
  }, [runId, announced.runId, progress.done]);
  const announce = announced.runId === runId ? nextAnnouncement(progress.steps, progress.done, announced.ids) : null;

  // The current step's most specific target is on screen (e.g. the open Spend Keys panel).
  const [atTarget, setAtTarget] = useState(false);

  const finishedNow = active && progress.current === null && !announce;

  // Look-at steps: done once their screen is open.
  useEffect(() => {
    if (!active) return;
    const check = () => {
      for (const [step, sel] of Object.entries(SEEN) as [FirstHourStepId, string][]) {
        if (!progress.done.has(step) && visible(document.querySelector(sel))) update((r) => markSeen(r, step));
      }
    };
    check();
    const t = window.setInterval(check, 500);
    return () => window.clearInterval(t);
  }, [active, progress.done, update]);

  const step = announce ?? progress.current;
  const phase: 'doing' | 'done' = announce ? 'done' : 'doing';
  const stepIndex = step ? progress.steps.findIndex((s) => s.id === step.id) : -1;

  const skipGuide = useCallback(() => update((r) => ({ ...r, skipped: true })), [update]);
  const markAnnounced = useCallback((id: FirstHourStepId) =>
    setAnnounced((a) => ({ ...a, ids: new Set([...a.ids, id]) })), []);
  const skipStep = useCallback(() => {
    const cur = progress.current;
    if (!cur?.optional) return;
    markAnnounced(cur.id);
    update((r) => markSeen(r, cur.id));
  }, [progress.current, update, markAnnounced]);
  const next = useCallback(() => { if (announce) markAnnounced(announce.id); }, [announce, markAnnounced]);
  const finish = useCallback(() => update((r) => ({ ...r, finished: true })), [update]);

  // Publish the instruction for the OSRS chatbox (and to quiet the coach hint).
  useEffect(() => {
    if (!active || !step || finishedNow) { setFirstHourView(null); return; }
    const view: FirstHourView = {
      title: phase === 'done' ? `Done: ${step.title}` : step.title,
      body: phase === 'done' ? step.done : (atTarget && step.hereBody) || step.body,
      phase,
      percent: progress.percent,
      stepNumber: stepIndex + 1,
      stepCount: progress.steps.length,
      counter: step.id === 'spend' && phase === 'doing' ? `${progress.spent}/${STARTING_KEYS} Keys spent` : undefined,
      optional: !!step.optional && phase === 'doing',
      icon: ICONS[step.id],
      next, skipStep, skipGuide,
    };
    setFirstHourView(view);
  }, [active, step, phase, atTarget, progress.percent, progress.spent, progress.steps.length, stepIndex, finishedNow, next, skipStep, skipGuide]);
  useEffect(() => () => setFirstHourView(null), []);

  // Where to point: the current step's target, while it is being done.
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const targetRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const clear = () => {
      targetRef.current?.removeAttribute('data-first-hour-flash');
      targetRef.current = null;
    };
    if (!active || phase !== 'doing' || !progress.current) { clear(); setTargetRect(null); return; }
    const selectors = TARGETS[isOsrs ? 'osrs' : 'classic'][progress.current.target];
    const find = () => {
      const el = firstVisible(selectors);
      setAtTarget(!!el && el.matches(selectors[0]));
      if (el !== targetRef.current) {
        clear();
        targetRef.current = el;
        // Only buttons and tabs flash, as the game flashes its side tabs.
        if (el?.matches('button, [role="tab"]')) el.setAttribute('data-first-hour-flash', '');
      }
      setTargetRect((prev) => {
        const r = el?.getBoundingClientRect() ?? null;
        if (!r || !prev) return r;
        return r.top === prev.top && r.left === prev.left && r.width === prev.width && r.height === prev.height ? prev : r;
      });
    };
    find();
    const t = window.setInterval(find, 400);
    window.addEventListener('resize', find);
    window.addEventListener('scroll', find, true);
    return () => {
      window.clearInterval(t);
      window.removeEventListener('resize', find);
      window.removeEventListener('scroll', find, true);
      clear();
    };
  }, [active, phase, progress.current, isOsrs]);

  const showMe = () => {
    if (!progress.current) return;
    const el = firstVisible(TARGETS[isOsrs ? 'osrs' : 'classic'][progress.current.target])
      ?? document.querySelector<HTMLElement>(TARGETS[isOsrs ? 'osrs' : 'classic'][progress.current.target].join(','));
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  if (!active && !rollCheck) return null;

  return (
    <>
      <style>{GUIDE_CSS}</style>
      {rollCheck && createPortal(<RollCheckDialog check={rollCheck} osrs={isOsrs} />, document.body)}
      {active && !isOsrs && step && !finishedNow && (
        <ClassicCard
          step={step} phase={phase} here={atTarget} index={stepIndex} count={progress.steps.length} percent={progress.percent}
          counter={step.id === 'spend' && phase === 'doing' ? `${progress.spent}/${STARTING_KEYS} spent` : undefined}
          onNext={next} onShowMe={showMe} onSkipStep={skipStep} onSkipGuide={skipGuide}
        />
      )}
      {active && targetRect && phase === 'doing' && createPortal(<Pointer rect={targetRect} osrs={isOsrs} />, document.body)}
      {active && finishedNow && createPortal(<FinishScroll osrs={isOsrs} onClose={finish} />, document.body)}
    </>
  );
};

// ── Classic layout: a card under the header ─────────────────────────────────

const ClassicCard: React.FC<{
  step: FirstHourStep; phase: 'doing' | 'done'; here: boolean; index: number; count: number; percent: number; counter?: string;
  onNext: () => void; onShowMe: () => void; onSkipStep: () => void; onSkipGuide: () => void;
}> = ({ step, phase, here, index, count, percent, counter, onNext, onShowMe, onSkipStep, onSkipGuide }) => {
  // Stays in view under the sticky header when the page scrolls.
  const [top, setTop] = useState(0);
  useEffect(() => {
    const header = document.querySelector('header');
    if (!header) return;
    const apply = () => setTop(header.getBoundingClientRect().height);
    apply();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(apply);
    observer?.observe(header);
    return () => observer?.disconnect();
  }, []);
  return (
  <div className="max-w-[1600px] mx-auto px-4 sticky z-40" style={{ top }}>
    <section
      className="fh-card mt-2 rounded-lg border border-amber-500/25 bg-[#1b1b1b] shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-300"
      aria-label="Guided first hour" aria-live="polite"
    >
      <div className="flex items-center gap-3 px-3 py-1.5 border-b border-white/5 bg-black/20">
        <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-amber-400">First steps</span>
        <span className="text-[10px] font-mono text-gray-500">Step {index + 1} of {count}</span>
        <div className="flex-1 flex gap-1 max-w-[220px]" aria-hidden="true">
          {Array.from({ length: count }, (_, i) => (
            <span key={i} className={`h-1 flex-1 rounded-full ${i < index || (i === index && phase === 'done') ? 'bg-amber-400' : i === index ? 'bg-amber-400/40' : 'bg-white/10'}`} />
          ))}
        </div>
        <span className="sr-only">{percent}% done</span>
        <button type="button" onClick={onSkipGuide} className="ml-auto text-[11px] text-gray-500 hover:text-white flex items-center gap-1" title="Stop the guide for this run. Settings can turn it back on.">
          Skip guide <X size={11} />
        </button>
      </div>
      <div className="flex items-center gap-3 px-3 py-2.5">
        <span className={`shrink-0 w-8 h-8 rounded-md flex items-center justify-center border ${phase === 'done' ? 'bg-green-900/30 border-green-500/30 text-green-400' : 'bg-amber-950/40 border-amber-500/30 text-amber-300'}`}>
          {phase === 'done' ? <Check size={16} /> : <img src={ICONS[step.id]} alt="" aria-hidden="true" className="max-w-[24px] max-h-[22px] object-contain" style={{ imageRendering: 'pixelated' }} />}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className={`text-[13px] font-bold ${phase === 'done' ? 'text-green-300' : 'text-white'}`}>{phase === 'done' ? `Done: ${step.title}` : step.title}</h3>
            {counter && <span className="text-[10px] font-mono whitespace-nowrap px-1.5 py-0.5 rounded bg-black/40 border border-white/10 text-amber-200">{counter}</span>}
            {step.optional && phase === 'doing' && <span className="text-[10px] text-gray-500">optional</span>}
          </div>
          <p className="text-[12px] text-gray-300 leading-snug mt-0.5">{phase === 'done' ? step.done : (here && step.hereBody) || step.body}</p>
        </div>
        {phase === 'done' ? (
          <button type="button" onClick={onNext} className="shrink-0 text-[11px] font-bold px-3 py-1.5 rounded-md bg-amber-600/80 hover:bg-amber-500 text-white flex items-center gap-1">
            Next step <ArrowRight size={11} />
          </button>
        ) : (
          <div className="shrink-0 flex items-center gap-2">
            {step.optional && (
              <button type="button" onClick={onSkipStep} className="text-[11px] px-2.5 py-1.5 rounded-md border border-white/10 text-gray-300 hover:text-white hover:bg-white/5">Skip step</button>
            )}
            <button type="button" onClick={onShowMe} className="text-[11px] font-bold px-3 py-1.5 rounded-md bg-amber-600/80 hover:bg-amber-500 text-white flex items-center gap-1">
              Show me <ArrowRight size={11} />
            </button>
          </div>
        )}
      </div>
    </section>
  </div>
  );
};

// ── The pointer: an amber ring (classic) or Tutorial Island's arrow (OSRS) ──

const Pointer: React.FC<{ rect: DOMRect; osrs: boolean }> = ({ rect, osrs }) => {
  const below = rect.top < 70;
  const cx = rect.left + rect.width / 2;
  return (
    <div className="fh-pointer" aria-hidden="true">
      {!osrs && <div className="fh-ring" style={{ top: rect.top - 4, left: rect.left - 4, width: rect.width + 8, height: rect.height + 8 }} />}
      <div
        className={`fh-arrow${osrs ? ' is-osrs' : ''}${below ? ' is-below' : ''}`}
        style={{ left: cx - (osrs ? 21 : 11), top: below ? rect.bottom + 4 : rect.top - (osrs ? 46 : 28) }}
      >
        {osrs ? (
          // The game's yellow hint arrow, drawn as pixels.
          <svg width="42" height="42" viewBox="0 0 17 17" shapeRendering="crispEdges">
            <path d="M5 0h7v8h4l-7.5 8.5L1 8h4z" fill="#ffff00" stroke="#000" strokeWidth="1" />
            <path d="M6 1h1v7H6zM3 9h1v1H3z" fill="#ffffa0" />
            <path d="M11 1h1v8h-1zM9 14h1v1H9z" fill="#c0a000" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 22 22"><path d="M11 21 2 10h5V1h8v9h5z" fill="#f59e0b" stroke="#78350f" strokeWidth="1.5" strokeLinejoin="round" /></svg>
        )}
      </div>
    </div>
  );
};

// ── Before a new run's first rolls: "Did you finish this in game?" ─────────

const RollCheckDialog: React.FC<{ check: RollCheck; osrs: boolean }> = ({ check, osrs }) => {
  const yesRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    yesRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') check.answer(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [check]);
  const note = `A roll can't be undone, so only roll what you really did. This check stops after your first ${FIRST_ROLL_CHECKS} rolls.`;
  if (osrs) {
    return (
      <div className="fh-scrim" onClick={() => check.answer(false)}>
        <div className="fh-scroll fh-ask" role="alertdialog" aria-modal="true" aria-labelledby="fh-ask-q" onClick={(e) => e.stopPropagation()}>
          <div className="fh-scroll-head">Select an Option</div>
          <div id="fh-ask-q" className="fh-ask-q">{check.question}</div>
          <button ref={yesRef} type="button" className="fh-scroll-close fh-ask-opt" onClick={() => check.answer(true)}>Yes, roll it.</button>
          <button type="button" className="fh-scroll-close fh-ask-opt" onClick={() => check.answer(false)}>No, not yet.</button>
          <div className="fh-ask-note">{note}</div>
        </div>
      </div>
    );
  }
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60" onClick={() => check.answer(false)}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="fh-ask-q" className="w-[380px] max-w-[calc(100vw-32px)] rounded-xl border border-amber-500/30 bg-[#1b1b1b] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 pt-4 pb-3">
          <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-amber-400">Before you roll</div>
          <h2 id="fh-ask-q" className="text-[15px] font-bold text-white mt-1">{check.question}</h2>
          <p className="text-[12px] text-gray-400 leading-snug mt-1.5">{note}</p>
        </div>
        <div className="px-5 py-3 border-t border-white/5 bg-black/20 flex items-center justify-end gap-2">
          <button type="button" onClick={() => check.answer(false)} className="text-[12px] px-3 py-1.5 rounded-md border border-white/10 text-gray-300 hover:text-white hover:bg-white/5">Not yet</button>
          <button ref={yesRef} type="button" onClick={() => check.answer(true)} className="text-[12px] font-bold px-3 py-1.5 rounded-md bg-amber-600/80 hover:bg-amber-500 text-white">Yes, roll it</button>
        </div>
      </div>
    </div>
  );
};

// ── The end: a quest-complete scroll ───────────────────────────────────────

const LEARNED = [
  'Keys open tables. You pick the table, fate picks the unlock.',
  'Finishing things in game rolls for Keys.',
  'A miss pays Fate Points, and Fate pays for Pity Keys and rituals.',
];

const FinishScroll: React.FC<{ osrs: boolean; onClose: () => void }> = ({ osrs, onClose }) => {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  if (osrs) {
    return (
      <div className="fh-scrim" onClick={onClose} role="dialog" aria-modal="true" aria-label="First steps complete">
        <div className="fh-scroll" onClick={(e) => e.stopPropagation()}>
          <div className="fh-scroll-title">Congratulations!</div>
          <div className="fh-scroll-sub">You have completed First Steps!</div>
          <div className="fh-scroll-body">
            <img className="osrs-px" src={`${UI}items/key.png`} alt="" width={72} height={64} />
            <div>
              <div className="fh-scroll-head">You have learned:</div>
              {LEARNED.map((l) => <div key={l}>{l}</div>)}
              <div className="fh-scroll-head" style={{ marginTop: 8 }}>Reward:</div>
              <div>None. Fate hands those out.</div>
            </div>
          </div>
          <button ref={closeRef} type="button" className="fh-scroll-close" onClick={onClose}>Click here to continue</button>
        </div>
      </div>
    );
  }
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose} role="dialog" aria-modal="true" aria-label="First steps complete">
      <div className="w-[440px] max-w-[calc(100vw-32px)] rounded-xl border border-amber-500/30 bg-[#1b1b1b] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 pt-5 pb-3 text-center">
          <div className="mx-auto w-12 h-12 rounded-lg bg-amber-950/50 border border-amber-500/40 flex items-center justify-center mb-3"><img src={`${UI}items/key.png`} alt="" aria-hidden="true" width={36} height={32} style={{ imageRendering: 'pixelated' }} /></div>
          <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-amber-400">First steps complete</div>
          <h2 className="text-lg font-black text-white mt-1">You know how fate works now</h2>
        </div>
        <ul className="px-6 pb-4 space-y-1.5">
          {LEARNED.map((l) => (
            <li key={l} className="flex gap-2 text-[12px] text-gray-300"><Check size={13} className="text-green-400 shrink-0 mt-0.5" />{l}</li>
          ))}
        </ul>
        <div className="px-5 py-3 border-t border-white/5 bg-black/20 flex items-center">
          <span className="text-[11px] text-gray-500">The tour and the Rules page are always in Jump to.</span>
          <button ref={closeRef} type="button" onClick={onClose} className="ml-auto text-[12px] font-bold px-3 py-1.5 rounded-md bg-amber-600/80 hover:bg-amber-500 text-white">Got it</button>
        </div>
      </div>
    </div>
  );
};

const GUIDE_CSS = `
@keyframes fh-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }
@keyframes fh-bob-up { 0%,100% { transform: translateY(0) rotate(180deg) } 50% { transform: translateY(6px) rotate(180deg) } }
@keyframes fh-ring { 0%,100% { box-shadow: 0 0 0 2px rgba(251,191,36,.85), 0 0 0 6px rgba(251,191,36,.18) } 50% { box-shadow: 0 0 0 2px rgba(251,191,36,.5), 0 0 0 10px rgba(251,191,36,0) } }
.fh-pointer { position: fixed; inset: 0; pointer-events: none; z-index: 85; }
.fh-ring { position: fixed; border-radius: 10px; animation: fh-ring 1.6s ease-in-out infinite; }
.fh-arrow { position: fixed; animation: fh-bob 1s ease-in-out infinite; filter: drop-shadow(0 2px 2px rgba(0,0,0,.6)); }
.fh-arrow.is-below { animation-name: fh-bob-up; }
.fh-arrow.is-osrs { filter: none; animation-timing-function: steps(2, jump-none); animation-duration: .7s; }
@keyframes fh-flash { 0%,49% { box-shadow: inset 0 0 0 999px rgba(255,0,0,.28) } 50%,100% { box-shadow: none } }
html[data-ui="osrs"] [data-first-hour-flash] { animation: fh-flash 1.2s steps(1) infinite; }
@media (prefers-reduced-motion: reduce) {
  .fh-arrow, .fh-ring, html[data-ui="osrs"] [data-first-hour-flash] { animation: none; }
}
.fh-scrim { position: fixed; inset: 0; z-index: 300; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,.55); }
.fh-scroll {
  width: 470px; max-width: calc(100vw - 32px); padding: 22px 28px 16px; text-align: center;
  background: #c8b38a linear-gradient(#d8c59c, #c2ab80); color: #000;
  border: 2px solid #5a4a2e; border-radius: 3px; box-shadow: 0 0 0 1px #000, 0 10px 30px rgba(0,0,0,.6), inset 0 0 30px rgba(90,60,20,.35);
  font: 16px 'RS', sans-serif; line-height: 20px;
}
.fh-scroll-title { font: 22px 'RSBold', sans-serif; color: #800000; }
.fh-scroll-sub { font: 16px 'RSBold', sans-serif; color: #000; margin-top: 2px; }
.fh-scroll-body { display: flex; gap: 18px; align-items: center; justify-content: center; text-align: left; margin-top: 14px; }
.fh-scroll-head { color: #800000; }
.fh-scroll-close { all: unset; cursor: pointer; display: inline-block; margin-top: 16px; color: #0000ff; font: 16px 'RS', sans-serif; }
.fh-scroll-close:hover, .fh-scroll-close:focus-visible { color: #fff; }
.fh-ask { width: 400px; padding: 16px 24px 14px; }
.fh-ask-q { margin: 6px 0 10px; }
.fh-ask-opt { display: block; margin: 6px auto 0; }
.fh-ask-note { margin-top: 12px; font: 14px 'RS', sans-serif; line-height: 17px; color: #3a2a10; }
`;

export default FirstHourGuide;
