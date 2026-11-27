import React, { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import './spend-confirm.css';

/**
 * The Yes / No box "Ask before Key clicks" shows before a click spends a Key or rolls for one
 * (utils/spendConfirm.ts). In-game style in both layouts: a stone window,
 * an orange question, Yes focused so Enter spends, Esc or a click outside
 * cancels.
 */
const SpendConfirm: React.FC<{ question: string; onAnswer: (yes: boolean) => void }> = ({ question, onAnswer }) => {
  const yesRef = useRef<HTMLButtonElement>(null);
  const noRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    yesRef.current?.focus();
    // Capture phase, so the box (the top layer) has the key before the page behind it.
    const onKey = (event: KeyboardEvent) => {
      // A held key that opened the box can't answer it: Yes needs a fresh press.
      if ((event.key === 'Enter' || event.key === ' ') && event.repeat) { event.preventDefault(); return; }
      if (event.key === 'Escape') {
        // One Esc closes one layer: the window that asked stays open.
        event.preventDefault();
        event.stopImmediatePropagation();
        onAnswer(false);
        return;
      }
      if (event.key === 'Tab') {
        // aria-modal: Tab and Shift+Tab only move between Yes and No.
        event.preventDefault();
        (document.activeElement === yesRef.current ? noRef.current : yesRef.current)?.focus();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onAnswer]);
  return (
    <div className="spend-confirm-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onAnswer(false); }}>
      <div className="spend-confirm" role="alertdialog" aria-modal="true" aria-labelledby="spend-confirm-q">
        <p id="spend-confirm-q" className="spend-confirm-q">{question}</p>
        <div className="spend-confirm-actions">
          <button ref={yesRef} type="button" className="osrs-btn" onClick={() => onAnswer(true)}>Yes</button>
          <button ref={noRef} type="button" className="osrs-btn" onClick={() => onAnswer(false)}>No</button>
        </div>
        <p className="spend-confirm-hint">Turn this off in Settings: Ask before Key clicks.</p>
      </div>
    </div>
  );
};

/** Show the box; resolves true on Yes and false on No, Esc or a click outside. */
export function openSpendConfirm(question: string): Promise<boolean> {
  return new Promise(resolve => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    let done = false;
    const answer = (yes: boolean) => {
      if (done) return;
      done = true;
      root.unmount();
      host.remove();
      before?.focus();
      resolve(yes);
    };
    root.render(<SpendConfirm question={question} onAnswer={answer} />);
  });
}
