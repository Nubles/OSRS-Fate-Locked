import React, { useEffect, useRef, useState } from 'react';

/**
 * Streamer overlay — a transparent, OBS-browser-source-friendly page showing
 * the live run: keys, fate points, buff, territory count, and a "NEW UNLOCK"
 * pop whenever something opens up. Reached via the hash route
 * `#/overlay?code=<pairing code>` (see index.tsx), so it works on GitHub
 * Pages with no router.
 *
 * Entirely self-contained: no GameContext, no app chrome — it reads the SAME
 * relay bundle the RuneLite plugin polls (the web app pushes it on every
 * change while online sync is on), so the overlay is live wherever the run
 * is being played. Poll is ETag-aware; the FLGZ payload is inflated with the
 * browser's native DecompressionStream.
 *
 * OBS setup: add a Browser source with this URL, width ~800, height ~120.
 */

const DEFAULT_BASE = 'https://fate-relay.fatelocked.workers.dev';
const POLL_MS = 5000;

interface OverlayState {
  keys: number;
  specialKeys: number;
  chaosKeys: number;
  fatePoints: number;
  activeBuff?: string;
  goal?: string;
  territory: number;
  territoryLabel: string;
}

/** Inflate the relay payload: "FLGZ:<base64 gzip>" or plain JSON. */
async function inflate(payload: string): Promise<any> {
  if (!payload.startsWith('FLGZ:')) return JSON.parse(payload);
  const bin = atob(payload.slice(5));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const DS: any = (globalThis as any).DecompressionStream;
  if (!DS) throw new Error('browser lacks DecompressionStream');
  const stream = new Blob([bytes]).stream().pipeThrough(new DS('gzip'));
  return JSON.parse(await new Response(stream).text());
}

function toState(bundle: any): { state: OverlayState; unlockedSet: Set<string> } {
  const s = bundle.state ?? {};
  const chunked = Array.isArray(bundle.unlockedChunks);
  const unlocked: string[] = chunked ? bundle.unlockedChunks : (bundle.unlockedRegions ?? []);
  return {
    state: {
      keys: s.keys ?? 0,
      specialKeys: s.specialKeys ?? 0,
      chaosKeys: s.chaosKeys ?? 0,
      fatePoints: s.fatePoints ?? 0,
      activeBuff: s.activeBuff && s.activeBuff !== 'NONE' ? s.activeBuff : undefined,
      goal: Array.isArray(s.pinnedGoals) && s.pinnedGoals.length > 0 ? s.pinnedGoals[0] : undefined,
      territory: unlocked.length,
      territoryLabel: chunked ? 'chunks' : 'areas',
    },
    unlockedSet: new Set(unlocked),
  };
}

const Badge: React.FC<{ label: string; value: React.ReactNode; tone: string }> = ({ label, value, tone }) => (
  <div className={`flex items-baseline gap-1.5 px-3 py-1.5 rounded-lg border backdrop-blur-sm ${tone}`}>
    <span className="text-lg font-black leading-none">{value}</span>
    <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">{label}</span>
  </div>
);

export const StreamOverlay: React.FC = () => {
  // styles.css paints the body dark for the app — OBS needs it transparent.
  useEffect(() => {
    document.body.style.backgroundColor = 'transparent';
    document.documentElement.style.backgroundColor = 'transparent';
  }, []);

  const params = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
  const code = (params.get('code') ?? '').trim();
  const base = (params.get('relay') ?? DEFAULT_BASE).replace(/\/+$/, '');

  const [state, setState] = useState<OverlayState | null>(null);
  const [error, setError] = useState<string | null>(code ? null : 'Missing ?code= — copy the overlay URL from the Sync & Roll tab.');
  const [newUnlock, setNewUnlock] = useState<string | null>(null);
  const etag = useRef<string | null>(null);
  const prevUnlocked = useRef<Set<string> | null>(null);
  const popTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!code) return;
    let alive = true;

    const poll = async () => {
      try {
        const headers: Record<string, string> = {};
        if (etag.current) headers['If-None-Match'] = etag.current;
        const res = await fetch(`${base}/r/${encodeURIComponent(code)}`, { headers, cache: 'no-store' });
        if (res.status === 304) return;
        if (res.status === 404) { if (alive) setError('Nothing is published yet — connect this profile from RuneLite first.'); return; }
        if (!res.ok) return; // transient — keep the last good frame
        etag.current = res.headers.get('ETag');
        const { payload } = await res.json();
        if (!payload) return;
        const { state: next, unlockedSet } = toState(await inflate(payload));
        if (!alive) return;

        // "NEW UNLOCK" pop: whatever appeared since the previous frame. For
        // Chunked runs the raw "cx,cy" key means nothing on stream, so label
        // it generically.
        if (prevUnlocked.current) {
          const fresh = [...unlockedSet].filter((u) => !prevUnlocked.current!.has(u));
          if (fresh.length > 0) {
            const label = /^\d+,\d+$/.test(fresh[0]) ? `${fresh.length > 1 ? fresh.length + ' new chunks' : 'a new chunk'}` : fresh.join(', ');
            setNewUnlock(label);
            if (popTimer.current) window.clearTimeout(popTimer.current);
            popTimer.current = window.setTimeout(() => setNewUnlock(null), 8000);
          }
        }
        prevUnlocked.current = unlockedSet;
        setState(next);
        setError(null);
      } catch {
        // keep the last good frame; transient errors shouldn't blank a stream
      }
    };

    poll();
    const id = window.setInterval(poll, POLL_MS);
    return () => { alive = false; window.clearInterval(id); if (popTimer.current) window.clearTimeout(popTimer.current); };
  }, [code, base]);

  return (
    <div className="min-h-screen bg-transparent flex items-start justify-start p-3 font-sans select-none">
      {error ? (
        <div className="px-3 py-2 rounded-lg bg-black/70 border border-red-500/40 text-red-200 text-sm">{error}</div>
      ) : !state ? (
        <div className="px-3 py-2 rounded-lg bg-black/70 border border-white/20 text-gray-300 text-sm">Connecting to the run…</div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="px-3 py-1.5 rounded-lg bg-black/70 border border-amber-500/40 text-amber-300 text-[11px] font-black uppercase tracking-widest backdrop-blur-sm">
              Fate Locked
            </div>
            <Badge label="keys" value={state.keys} tone="bg-black/70 border-amber-500/40 text-amber-200" />
            {state.specialKeys > 0 && <Badge label="omni" value={state.specialKeys} tone="bg-black/70 border-purple-500/40 text-purple-200" />}
            {state.chaosKeys > 0 && <Badge label="chaos" value={state.chaosKeys} tone="bg-black/70 border-red-500/40 text-red-200" />}
            <Badge label="fate" value={state.fatePoints} tone="bg-black/70 border-orange-500/30 text-orange-200" />
            <Badge label={state.territoryLabel} value={state.territory} tone="bg-black/70 border-emerald-500/40 text-emerald-200" />
            {state.activeBuff && (
              <div className="px-3 py-1.5 rounded-lg bg-black/70 border border-blue-500/40 text-blue-200 text-[11px] font-bold uppercase tracking-wider backdrop-blur-sm animate-pulse">
                {state.activeBuff}
              </div>
            )}
          </div>
          {state.goal && (
            <div className="self-start px-3 py-1 rounded-md bg-black/60 border border-white/15 text-gray-300 text-[11px] backdrop-blur-sm">
              <span className="opacity-60 font-bold uppercase tracking-wider mr-1.5">Goal</span>{state.goal}
            </div>
          )}
          {newUnlock && (
            <div className="self-start px-4 py-2 rounded-lg bg-emerald-950/85 border border-emerald-400/60 text-emerald-100 text-sm font-bold backdrop-blur-sm animate-in slide-in-from-left-4 fade-in duration-500 shadow-[0_0_25px_rgba(52,211,153,0.35)]">
              ✦ NEW UNLOCK — {newUnlock}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StreamOverlay;
