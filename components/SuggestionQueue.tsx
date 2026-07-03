import React, { useEffect, useState } from 'react';
import { Sparkles, X, ArrowRight, Radio } from 'lucide-react';
import { relaySync } from '../services/relaySync';
import { suggestSync, suggestionNav, Suggestion } from '../services/suggestSync';

/**
 * Persistent list of RuneLite-detected roll suggestions — unlike the
 * SuggestionBanner toast (which disappears whether or not you acted on it),
 * this stays until the player clears it or actually rolls a matching
 * category. Lives in the Auto-Roll tab, next to the online-sync pairing UI
 * that's the other half of this same relay connection.
 *
 * Auto-clear-on-matching-roll lives in SuggestionBanner instead of here —
 * this component is inside a lazily-mounted Dashboard tab (unmounted
 * whenever the player isn't looking at Auto-Roll), so it can't reliably
 * observe a roll that happens while some other tab is open. The always-
 * mounted banner can.
 */

export function SuggestionQueue() {
  const [, force] = useState(0);
  useEffect(() => relaySync.subscribe(() => force((n) => n + 1)), []);
  const [pending, setPending] = useState<Suggestion[]>(() => suggestSync.getPending());
  useEffect(() => suggestSync.subscribePending(() => setPending(suggestSync.getPending())), []);

  if (!relaySync.enabled) return null;

  const jump = (s: Suggestion) => {
    window.dispatchEvent(new CustomEvent('fate:nav', { detail: suggestionNav(s) }));
  };

  return (
    <div className="border border-white/10 rounded-lg bg-white/[0.03] p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Radio size={13} className="text-emerald-400" />
        <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wide">Roll Suggestions</h3>
        <span className="text-[10px] text-gray-500">from RuneLite</span>
        {pending.length > 0 && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-300">{pending.length}</span>
        )}
      </div>
      {pending.length === 0 ? (
        <p className="text-[11px] text-gray-600">
          Nothing pending — boss kills, collection log entries, and raid completions the plugin detects will show up here until you roll for them.
        </p>
      ) : (
        <div className="space-y-1.5">
          {pending.map((s) => (
            <div key={`${s.ts}-${s.source}-${s.label}`} className="flex items-center gap-2 bg-black/20 border border-white/5 rounded px-2.5 py-1.5">
              <Sparkles size={12} className="text-emerald-400 shrink-0" />
              <div className="flex-1 min-w-0 text-[11px] text-gray-300 truncate">
                <span className="font-semibold text-emerald-300">{s.source}</span>: {s.label}
              </div>
              <button
                onClick={() => jump(s)}
                className="text-[10px] font-semibold px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 shrink-0"
              >
                Take me there <ArrowRight size={10} />
              </button>
              <button onClick={() => suggestSync.removePending(s)} className="text-gray-600 hover:text-white shrink-0" aria-label="Dismiss">
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default SuggestionQueue;
