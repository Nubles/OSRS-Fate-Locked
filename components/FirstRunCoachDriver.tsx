import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Sparkles } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useProfiles } from '../context/ProfileContext';
import { coachStep, type CoachStepId } from '../utils/firstRunCoach';
import { showToast } from '../utils/toast';

/**
 * First-run coach — spotlights the user's first roll and first key spend.
 * Non-blocking (pointer-events: none overlay; the card itself is clickable
 * only for Skip). Steps derive from real game state via utils/firstRunCoach,
 * so imports and mature runs auto-graduate silently. Must stay
 * ALWAYS-MOUNTED (same rule as FeatureRevealDriver): step advances are
 * triggered by history changes made anywhere in the app.
 *
 * The per-profile done flag lives in localStorage OUTSIDE GameState — it
 * must never travel with exports or sync codes.
 */

const storageKey = (profileId: string) => `fate_first_run_coach_v1_${profileId}`;

const COPY: Record<Exclude<CoachStepId, 'done'>, { title: string; body: string }> = {
  roll: {
    title: 'Make your first roll',
    body: 'Click the first Slayer master card to roll for a Key. Only a 5% chance — but even a failed roll feeds your pity timer.',
  },
  spend: {
    title: 'Spend a Key',
    body: 'You start with 3 Keys. Open Spend Keys and roll any table — Fate picks what unlocks.',
  },
};

const FAIL_NOD = 'Bad luck still pays — that Fate Point is your pity timer filling. ';
const DONE_TOAST = 'Tasks in the Journal are your key farm — Fate takes it from here';

/** Selectors per step, first match wins (spend upgrades to the tables grid once visible). */
const TARGETS: Record<Exclude<CoachStepId, 'done'>, string[]> = {
  roll: ['[data-coach="first-master"]', '[data-tour="farm"]'],
  spend: ['[data-coach="tables"]', '[data-tour="spend"]'],
};

const TIP_W = 300;

export const FirstRunCoachDriver: React.FC = () => {
  const { history, revealAllFeatures } = useGame();
  const { activeProfileId } = useProfiles();
  const [dismissed, setDismissed] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  // Which step the coach actually displayed this session — gates the done toast.
  const shownRef = useRef<CoachStepId | null>(null);

  const done = dismissed || localStorage.getItem(storageKey(activeProfileId)) !== null;
  const step = coachStep({ history, revealAllFeatures }, done);

  const retire = useCallback((silent: boolean) => {
    localStorage.setItem(storageKey(activeProfileId), '1');
    setDismissed(true);
    if (!silent) showToast(DONE_TOAST);
  }, [activeProfileId]);

  // Terminal states: celebrate 'done' only if we coached this session.
  useEffect(() => {
    if (step === 'done') retire(shownRef.current === null);
    else if (step === null && !done && history.length > 0) retire(true);
  }, [step, done, history.length, retire]);

  // Measure the current target; re-measure on layout changes and on a slow
  // interval (targets mount/unmount as the user switches Farm/Spend tabs).
  const measure = useCallback(() => {
    if (step !== 'roll' && step !== 'spend') { setRect(null); return; }
    for (const sel of TARGETS[step]) {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (el) { setRect(el.getBoundingClientRect()); return; }
    }
    setRect(null); // fallback corner card
  }, [step]);

  useLayoutEffect(() => { measure(); }, [measure, history.length]);
  useEffect(() => {
    if (step !== 'roll' && step !== 'spend') return;
    const id = window.setInterval(measure, 600);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [step, measure]);

  if (step !== 'roll' && step !== 'spend') return null;
  shownRef.current = step;

  const copy = COPY[step];
  const lastFailed = history[0]?.type === 'ROLL_FAIL' || history[history.length - 1]?.type === 'ROLL_FAIL';
  const body = step === 'spend' && lastFailed ? FAIL_NOD + copy.body : copy.body;

  // Card position: under the target, clamped; corner fallback without a target.
  const vw = window.innerWidth, vh = window.innerHeight;
  const tipStyle: React.CSSProperties = rect
    ? {
        top: Math.min(Math.max(12, rect.bottom + 12), vh - 170),
        left: Math.min(Math.max(12, rect.left), vw - TIP_W - 12),
      }
    : { bottom: 16, left: 16 };

  return createPortal(
    <div className="fixed inset-0 z-[400] pointer-events-none" aria-live="polite">
      {rect && (
        <div
          className="fixed rounded-lg transition-all duration-300"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
            border: '2px solid rgba(74,222,128,0.9)',
          }}
        />
      )}
      <div
        className="fixed w-[300px] bg-[#1c1c1c] border border-green-500/30 rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.7)] p-3.5 pointer-events-auto animate-in fade-in zoom-in-95 duration-200"
        style={tipStyle}
        role="status"
      >
        <div className="flex items-start gap-2 mb-1.5">
          <div className="w-6 h-6 rounded-lg bg-green-500/15 border border-green-400/30 flex items-center justify-center text-green-300 shrink-0">
            <Sparkles size={13} />
          </div>
          <h3 className="text-[14px] font-bold text-white leading-tight flex-1 pt-0.5">{copy.title}</h3>
          <button
            onClick={() => retire(true)}
            className="text-gray-600 hover:text-gray-300 shrink-0"
            aria-label="Skip the first-run coach"
          >
            <X size={15} />
          </button>
        </div>
        <p className="text-[12px] text-gray-300 leading-relaxed mb-1">{body}</p>
        <button
          onClick={() => retire(true)}
          className="text-[10px] font-bold uppercase tracking-wider text-gray-500 hover:text-gray-300 transition-colors"
        >
          Skip
        </button>
      </div>
    </div>,
    document.body,
  );
};
