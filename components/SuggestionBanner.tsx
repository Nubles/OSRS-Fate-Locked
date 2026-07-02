import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { relaySync } from '../services/relaySync';
import { suggestSync, Suggestion } from '../services/suggestSync';
import { isRollEntry } from '../utils/logEntry';
import { LogEntry } from '../types';

/**
 * Invisible-until-triggered, always-mounted: while online sync is enabled,
 * polls for plugin-detected roll suggestions (boss kills, collection log
 * entries, …) and shows a dismissible banner with a "Take me there" jump —
 * never an auto-roll. See services/suggestSync.ts for why this direction
 * (plugin → app) needs no write access from the web side at all.
 */

/** Where "Take me there" should navigate, per suggestion source. */
const navTargetFor = (source: string): string =>
  source.toLowerCase().includes('collection log') ? 'tab:COLLECTION' : 'ctrl:FARM';

const suggestionKey = (s: Suggestion) => `${s.ts}-${s.source}-${s.label}`;

export function SuggestionBanner() {
  const [, force] = useState(0);
  useEffect(() => relaySync.subscribe(() => force((n) => n + 1)), []);
  const enabled = relaySync.enabled;
  const [queue, setQueue] = useState<Suggestion[]>([]);
  const { history } = useGame() as { history: LogEntry[] };

  useEffect(() => {
    if (!enabled) { suggestSync.stop(); return; }
    // Dedup on append, not just in the singleton — React StrictMode's dev-only
    // double-invoked effects can otherwise queue the same item twice in one
    // mounted instance (duplicate React keys). Never happens in production
    // (StrictMode's double-invocation is a dev-only diagnostic), but this is
    // free insurance either way.
    const unsub = suggestSync.subscribe((fresh) => setQueue((q) => {
      const existing = new Set(q.map(suggestionKey));
      const toAdd = fresh.filter((s) => !existing.has(suggestionKey(s)));
      return toAdd.length > 0 ? [...q, ...toAdd] : q;
    }));
    suggestSync.start();
    return () => { unsub(); suggestSync.stop(); };
  }, [enabled]);

  // Auto-clear matching persistent suggestions (the "Suggestions" list in the
  // Auto-Roll tab, see SuggestionQueue.tsx) once the player actually rolls
  // that category — the reminder did its job. This lives here (always
  // mounted) rather than in SuggestionQueue itself (a lazily-mounted
  // Dashboard tab) so a roll made on any other tab is never missed.
  const lastLen = useRef(history.length);
  useEffect(() => {
    if (history.length <= lastLen.current) { lastLen.current = history.length; return; }
    const newest = history[history.length - 1];
    lastLen.current = history.length;
    if (newest && isRollEntry(newest) && newest.source) {
      suggestSync.clearPendingForRoll(newest.source);
    }
  }, [history]);

  if (!enabled || queue.length === 0) return null;

  const dismiss = (s: Suggestion) => {
    suggestSync.markSeen(s.ts);
    setQueue((q) => q.filter((x) => x !== s));
  };

  const jump = (s: Suggestion) => {
    window.dispatchEvent(new CustomEvent('fate:nav', {
      detail: { target: navTargetFor(s.source), query: s.source.toLowerCase().includes('collection log') ? s.label : undefined },
    }));
    dismiss(s); // clears the toast only — stays in the persistent Suggestions list until actually rolled
  };

  return (
    <div className="fixed bottom-3 right-3 z-[200] flex flex-col gap-2 max-w-xs">
      {queue.slice(-3).map((s) => (
        <div
          key={suggestionKey(s)}
          className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-[#0b0b0b]/95 border border-emerald-600/50 shadow-xl backdrop-blur-sm animate-in slide-in-from-right-4 duration-300"
        >
          <Sparkles size={14} className="text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[12px] text-gray-200 leading-snug">
              <span className="font-semibold text-emerald-300">{s.source}</span>: {s.label}
            </p>
            <p className="text-[10px] text-gray-500 mb-1.5">From RuneLite — may be worth a roll.</p>
            <button
              onClick={() => jump(s)}
              className="text-[11px] font-semibold px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              Take me there
            </button>
          </div>
          <button onClick={() => dismiss(s)} className="text-gray-500 hover:text-white shrink-0" aria-label="Dismiss">
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}

export default SuggestionBanner;
