import React, { useEffect, useRef, useState } from 'react';
import { DEFAULT_RELAY_BASE, parseRelayBase } from '../utils/relayBase';
import { WikiIcon } from './WikiIcon';

/**
 * Streamer overlay — a transparent, OBS-browser-source-friendly page showing
 * the live run: keys, fate points, buff, territory count, and a "NEW UNLOCK"
 * pop whenever something opens up. Reached via the hash route
 * `#/overlay?code=<pairing code>` (see index.tsx), so it works on GitHub
 * Pages with no router; `&relay=<address>` names a relay other than the
 * public one.
 *
 * Entirely self-contained: no GameContext, no app chrome — it reads the SAME
 * relay bundle the RuneLite plugin polls (the web app pushes it on every
 * change while online sync is on), so the overlay is live wherever the run
 * is being played. Poll is ETag-aware; the FLGZ payload is inflated with the
 * browser's native DecompressionStream.
 *
 * OBS setup: add a Browser source with this URL, width ~800, height ~120.
 */

// The overlay is informational rather than latency-critical. A 30-second
// cadence keeps it useful on stream without consuming an entire free Worker
// allowance when it is left open for long sessions.
const POLL_MS = 30_000;
// A real bundle inflates to about 1.3 MB. The cap leaves plenty of headroom
// but stops a gzip bomb, which could inflate a relay-sized upload to hundreds
// of megabytes inside the OBS browser source.
const MAX_INFLATED_BYTES = 8 * 1024 * 1024;

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
export async function inflate(payload: string): Promise<unknown> {
  if (!payload.startsWith('FLGZ:')) return JSON.parse(payload);
  const bin = atob(payload.slice(5));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const DS: any = (globalThis as any).DecompressionStream;
  if (!DS) throw new Error('browser lacks DecompressionStream');
  const reader = new Blob([bytes]).stream().pipeThrough<Uint8Array>(new DS('gzip')).getReader();
  const decoder = new TextDecoder();
  let text = '';
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_INFLATED_BYTES) {
      await reader.cancel();
      throw new Error('relay payload is too large');
    }
    text += decoder.decode(value, { stream: true });
  }
  return JSON.parse(text + decoder.decode());
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
// Absent fields read as empty; a field of the wrong type returns null.
const count = (value: unknown): number | null =>
  value == null ? 0 : typeof value === 'number' && Number.isFinite(value) ? value : null;
const strings = (value: unknown): string[] | null =>
  value == null ? [] : Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : null;

/**
 * The overlay's fields from a bundle, or null when any has the wrong type:
 * rendering an object such as `keys: {}` would throw and blank the source.
 */
export function toState(bundle: unknown): { state: OverlayState; unlockedSet: Set<string> } | null {
  if (!isRecord(bundle)) return null;
  const s = bundle.state ?? {};
  if (!isRecord(s)) return null;
  const chunked = Array.isArray(bundle.unlockedChunks);
  const unlocked = strings(chunked ? bundle.unlockedChunks : bundle.unlockedRegions);
  const keys = count(s.keys);
  const specialKeys = count(s.specialKeys);
  const chaosKeys = count(s.chaosKeys);
  const fatePoints = count(s.fatePoints);
  const goals = strings(s.pinnedGoals);
  const buff = s.activeBuff ?? 'NONE';
  if (keys === null || specialKeys === null || chaosKeys === null || fatePoints === null
    || !unlocked || !goals || typeof buff !== 'string') return null;
  return {
    state: {
      keys,
      specialKeys,
      chaosKeys,
      fatePoints,
      activeBuff: buff && buff !== 'NONE' ? buff : undefined,
      goal: goals[0],
      territory: unlocked.length,
      territoryLabel: chunked ? 'chunks' : 'areas',
    },
    unlockedSet: new Set(unlocked),
  };
}

/**
 * Keeps a render error in the badges from blanking the OBS source: it shows a
 * notice instead, and tries again when the next frame arrives.
 */
class OverlayErrorBoundary extends React.Component<
  { frame: unknown; children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidUpdate(prev: { frame: unknown }, prevState: { failed: boolean }) {
    // Not in the update that failed: its frame is the one that broke.
    if (prevState.failed && prev.frame !== this.props.frame) this.setState({ failed: false });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="px-3 py-2 rounded-lg bg-black/70 border border-red-500/40 text-red-200 text-sm">
        The overlay couldn't show the latest update — waiting for the next one.
      </div>
    );
  }
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
  const relay = params.get('relay');
  const base = relay === null ? DEFAULT_RELAY_BASE : parseRelayBase(relay);

  const [state, setState] = useState<OverlayState | null>(null);
  const [error, setError] = useState<string | null>(
    !code ? 'Missing ?code= — copy the overlay URL from the Sync & Roll tab.'
      : !base ? 'The relay address in this overlay URL is not a secure (https) address — copy the overlay URL again.'
        : null,
  );
  const [newUnlock, setNewUnlock] = useState<string | null>(null);
  const etag = useRef<string | null>(null);
  const prevUnlocked = useRef<Set<string> | null>(null);
  const popTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!code || !base) return;
    let alive = true;

    const poll = async () => {
      try {
        const headers: Record<string, string> = {};
        if (etag.current) headers['If-None-Match'] = etag.current;
        const res = await fetch(`${base}/r/${encodeURIComponent(code)}`, { headers, cache: 'no-store' });
        if (res.status === 304) return;
        if (res.status === 404) {
          // The record expired; drop its ETag so the next publish can't be
          // mistaken for it and answered with 304.
          etag.current = null;
          if (alive) setError('Nothing is published yet — connect this profile from RuneLite first.');
          return;
        }
        if (!res.ok) return; // transient — keep the last good frame
        const body = await res.json();
        if (typeof body?.payload !== 'string') return;
        const frame = toState(await inflate(body.payload));
        if (!frame || !alive) return; // malformed — keep the last good frame
        // Only now: a version that failed to parse must be fetched again, not
        // answered with 304 until the next publish.
        etag.current = res.headers.get('ETag');
        const { state: next, unlockedSet } = frame;

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
        <OverlayErrorBoundary frame={state}>
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
                <WikiIcon file="Crystal_key.png" alt="" size={16} className="mr-1.5 align-middle" /> NEW UNLOCK — {newUnlock}
              </div>
            )}
          </div>
        </OverlayErrorBoundary>
      )}
    </div>
  );
};

export default StreamOverlay;
