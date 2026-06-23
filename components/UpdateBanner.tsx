import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';

/**
 * "A new version is available — reload" banner.
 *
 * Each build stamps a unique id into the bundle (__BUILD_ID__) and into a
 * version.json shipped alongside it (see vite.config.ts). This polls version.json
 * (cache-busted) on an interval and on tab focus; when its build id differs from
 * the one this tab loaded with, a new deploy has landed and we offer a reload —
 * so an already-open tab doesn't keep running stale code/data.
 */
const POLL_MS = 3 * 60 * 1000; // every 3 minutes

export const UpdateBanner: React.FC = () => {
  const [stale, setStale] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const check = useCallback(async () => {
    try {
      const base = (import.meta as any).env?.BASE_URL ?? '/';
      const res = await fetch(`${base}version.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const { build } = await res.json();
      // Only flag when we have both ids and they differ. In dev there's no
      // version.json (or it matches), so this stays quiet.
      if (build && typeof __BUILD_ID__ !== 'undefined' && build !== __BUILD_ID__) setStale(true);
    } catch { /* offline / missing file — ignore */ }
  }, []);

  useEffect(() => {
    const id = window.setInterval(check, POLL_MS);
    const onFocus = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onFocus);
    // Don't check on first mount — we just loaded the current build.
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', onFocus); };
  }, [check]);

  if (!stale || dismissed) return null;

  return (
    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-3 px-3 py-2 rounded-lg bg-[#0b0b0b]/95 border border-emerald-600/50 shadow-xl backdrop-blur-sm">
      <RefreshCw size={14} className="text-emerald-400 shrink-0" />
      <span className="text-[12px] text-gray-200">A new version is available.</span>
      <button
        onClick={() => window.location.reload()}
        className="text-[11px] font-semibold px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white"
      >
        Reload
      </button>
      <button onClick={() => setDismissed(true)} className="text-gray-500 hover:text-white" aria-label="Dismiss">
        <X size={13} />
      </button>
    </div>
  );
};

export default UpdateBanner;
