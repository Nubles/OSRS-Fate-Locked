import React, { useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowRight, ArrowLeft, Compass } from 'lucide-react';

/**
 * A replayable, spotlight-style guided tour. Each step highlights a real element
 * (by `data-tour` attribute) and explains it, walking through the core loop:
 * earn keys → spend keys → fate points → altar, plus where everything lives.
 * Start it anytime by dispatching `fate:start-tour` (the ⌘K palette has an entry,
 * and you can wire a button to it). Pure DOM measurement — no library.
 */

interface Step {
  sel: string | null; // null = centered intro card
  title: string;
  body: string;
  place?: 'right' | 'bottom' | 'left' | 'top';
}

const STEPS: Step[] = [
  { sel: null, title: 'Welcome to Fate Locked', body: 'You start with nothing — every skill, item and region is locked until fate decides otherwise. Here’s the 60-second tour of how it all fits together.' },
  { sel: '[data-tour="farm"]', title: '1 · Farm keys', body: 'Roll slayer tasks and clue scrolls here. Each roll has a chance to drop a Key — the currency everything runs on. Failed rolls build Fate Points.', place: 'right' },
  { sel: '[data-tour="spend"]', title: '2 · Spend keys', body: 'Spend a Key to let fate unlock a random piece of content from a category — gear, regions, bosses, skills and more. This is the heart of the game.', place: 'right' },
  { sel: '[data-tour="keys"]', title: 'Keys & Fate Points', body: 'Your Keys, Omni-keys and Fate Points live up here, and tick over as you earn them.', place: 'bottom' },
  { sel: '[data-tour="altar"]', title: '3 · The Void Altar', body: 'Spend built-up Fate Points on high-risk, high-reward rituals — bonus keys, rerolls and more.', place: 'bottom' },
  { sel: '[data-tour="dashtabs"]', title: 'Your account', body: 'Everything you’ve unlocked lives on the right: gear & skills, the world map, activities, your journal and collection log. Each tab has a “?” for details.', place: 'bottom' },
  { sel: '[data-tour="palette"]', title: 'Jump to anything', body: 'Press ⌘K (or click here) anytime to open the command palette and jump straight to any tab or tool. That’s the tour — good luck!', place: 'bottom' },
];

const TIP_W = 330;
const PAD = 8;

export const GuidedTour: React.FC = () => {
  const [active, setActive] = useState(false);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const step = STEPS[i];

  const measure = useCallback(() => {
    if (!step || !step.sel) { setRect(null); return; }
    const el = document.querySelector(step.sel) as HTMLElement | null;
    setRect(el ? el.getBoundingClientRect() : null);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [step]);

  useLayoutEffect(() => { if (active) measure(); }, [active, i, measure]);

  useEffect(() => {
    if (!active) return;
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [active, measure]);

  useEffect(() => {
    const onStart = () => { setI(0); setActive(true); };
    window.addEventListener('fate:start-tour', onStart);
    return () => window.removeEventListener('fate:start-tour', onStart);
  }, []);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActive(false);
      else if (e.key === 'ArrowRight' || e.key === 'Enter') next();
      else if (e.key === 'ArrowLeft') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, i]);

  const close = () => setActive(false);
  const next = () => { if (i >= STEPS.length - 1) close(); else setI((n) => n + 1); };
  const back = () => setI((n) => Math.max(0, n - 1));

  if (!active) return null;

  // Tooltip position.
  let tipStyle: React.CSSProperties;
  if (!rect) {
    tipStyle = { top: '50%', left: '50%', transform: 'translate(-50%,-50%)' };
  } else {
    const place = step.place ?? 'bottom';
    const vw = window.innerWidth, vh = window.innerHeight;
    let top: number, left: number;
    if (place === 'right' && rect.right + TIP_W + 24 < vw) { left = rect.right + 16; top = rect.top; }
    else if (place === 'left' && rect.left - TIP_W - 24 > 0) { left = rect.left - TIP_W - 16; top = rect.top; }
    else if (place === 'top') { left = rect.left; top = rect.top - 200; }
    else { left = rect.left; top = rect.bottom + 16; } // bottom default
    left = Math.min(Math.max(12, left), vw - TIP_W - 12);
    top = Math.min(Math.max(12, top), vh - 220);
    tipStyle = { top, left };
  }

  return createPortal(
    <div className="fixed inset-0 z-[500]" role="dialog" aria-modal="true" aria-label="Guided tour">
      {/* Spotlight: dim everything except a hole around the target. */}
      {rect ? (
        <div
          className="fixed rounded-lg pointer-events-none transition-all duration-300"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.72)',
            border: '2px solid rgba(251,191,36,0.9)',
          }}
        />
      ) : (
        <div className="fixed inset-0 bg-black/72" />
      )}

      {/* Click-catch layer so the app underneath isn't interactable mid-tour. */}
      <div className="fixed inset-0" onClick={(e) => e.stopPropagation()} />

      {/* Tooltip card */}
      <div
        className="fixed w-[330px] bg-[#1c1c1c] border border-amber-500/30 rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.7)] p-4 animate-in fade-in zoom-in-95 duration-200"
        style={tipStyle}
      >
        <div className="flex items-start gap-2 mb-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-amber-300 shrink-0">
            <Compass size={15} />
          </div>
          <h3 className="text-[15px] font-bold text-white leading-tight flex-1 pt-0.5">{step.title}</h3>
          <button onClick={close} className="text-gray-600 hover:text-gray-300 shrink-0" aria-label="End tour"><X size={16} /></button>
        </div>
        <p className="text-[12.5px] text-gray-300 leading-relaxed mb-3.5">{step.body}</p>
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {STEPS.map((_, n) => (
              <span key={n} className={`h-1.5 rounded-full transition-all ${n === i ? 'w-4 bg-amber-400' : 'w-1.5 bg-white/15'}`} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {i > 0 && (
              <button onClick={back} className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
                <ArrowLeft size={12} /> Back
              </button>
            )}
            <button onClick={next} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-amber-500 text-black hover:bg-amber-400 transition-colors">
              {i >= STEPS.length - 1 ? 'Finish' : <>Next <ArrowRight size={12} /></>}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};
