import React, { useEffect, useState } from 'react';
import { Puzzle, Copy, Check, ExternalLink, CheckCircle2, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { relaySync, RelayStatus } from '../services/relaySync';

/**
 * The Sync & Roll tab's single home for the RuneLite connection: a first-run
 * guide (install plugin → enable sync → paste code) that doubles as the
 * ongoing status/control surface — run-upload status, Disconnect, and the
 * plugin-side heartbeat (the plugin POSTs {ts} to /state after each
 * successful import, so "connected" means the full pipeline works).
 * Absorbed the old separate OnlineSyncPanel, which duplicated the enable
 * button and instructions right below this card.
 *
 * Collapses to a slim status row (persisted) once it's done its job.
 */

const PUSH_LABEL: Record<RelayStatus, string> = {
  off: 'off', syncing: 'uploading…', synced: 'up to date', error: 'error',
};
const PUSH_CLASS: Record<RelayStatus, string> = {
  off: 'text-gray-500', syncing: 'text-amber-300', synced: 'text-emerald-300', error: 'text-red-300',
};

const HUB_URL = 'https://runelite.net/plugin-hub/show/fate-locked-ironman';
const HIDDEN_KEY = 'fate_rl_onboard_hidden_v1';
const POLL_MS = 15 * 1000;

const agoLabel = (ts: number): string => {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 90) return `${s}s ago`;
  if (s < 90 * 60) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
};

const Step: React.FC<{ n: number; done?: boolean; children: React.ReactNode }> = ({ n, done, children }) => (
  <li className="flex items-start gap-2.5">
    <span className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold mt-0.5
      ${done ? 'bg-emerald-600 text-white' : 'bg-white/10 text-gray-300'}`}>
      {done ? <Check size={11} /> : n}
    </span>
    <div className="text-[12px] text-gray-300 leading-relaxed">{children}</div>
  </li>
);

export const RuneLiteOnboarding: React.FC = () => {
  const [, force] = useState(0);
  useEffect(() => relaySync.subscribe(() => force((n) => n + 1)), []);
  const [copied, setCopied] = useState(false);
  const [pluginSeen, setPluginSeen] = useState<number | null>(null);
  const [hidden, setHidden] = useState<boolean>(() => {
    try { return localStorage.getItem(HIDDEN_KEY) === '1'; } catch { return false; }
  });

  const enabled = relaySync.enabled;
  const connected = pluginSeen != null;

  // Poll the plugin heartbeat while a session exists. Keeps polling after
  // connection so the "last import" label stays honest.
  useEffect(() => {
    if (!enabled) { setPluginSeen(null); return; }
    let alive = true;
    const check = async () => {
      const state = await relaySync.fetchPluginState();
      if (alive && state) setPluginSeen(state.ts);
    };
    check();
    const id = window.setInterval(check, POLL_MS);
    return () => { alive = false; window.clearInterval(id); };
  }, [enabled]);

  const setHiddenPersist = (v: boolean) => {
    setHidden(v);
    try { localStorage.setItem(HIDDEN_KEY, v ? '1' : '0'); } catch { /* ignore */ }
  };

  const copy = () => {
    if (!relaySync.code) return;
    navigator.clipboard?.writeText(relaySync.code).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  // Collapsed: one honest status line, expandable.
  if (hidden) {
    return (
      <button
        onClick={() => setHiddenPersist(false)}
        className="w-full flex items-center gap-2 border border-white/10 rounded-lg bg-white/[0.03] px-3 py-2 text-left hover:bg-white/[0.06] transition-colors"
      >
        <Puzzle size={13} className={connected ? 'text-emerald-400' : 'text-gray-500'} />
        <span className="text-[12px] text-gray-300 font-semibold">RuneLite plugin</span>
        {connected
          ? <span className="text-[11px] text-emerald-300">connected · last import {agoLabel(pluginSeen!)}</span>
          : <span className="text-[11px] text-gray-500">setup guide</span>}
        <div className="flex-1" />
        <ChevronDown size={13} className="text-gray-500" />
      </button>
    );
  }

  return (
    <div className="border border-white/10 rounded-lg bg-white/[0.03] p-3.5 space-y-3">
      <div className="flex items-center gap-2">
        <Puzzle size={14} className="text-emerald-400" />
        <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wide">Connect RuneLite</h3>
        {connected && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-300 flex items-center gap-1">
            <CheckCircle2 size={10} /> connected
          </span>
        )}
        <div className="flex-1" />
        <button onClick={() => setHiddenPersist(true)} className="p-1 rounded hover:bg-white/10 text-gray-500 hover:text-white" aria-label="Collapse guide">
          <ChevronUp size={13} />
        </button>
      </div>

      <ol className="space-y-2.5">
        <Step n={1}>
          Install <span className="text-gray-100 font-semibold">Fate Locked Ironman</span> from the{' '}
          <a href={HUB_URL} target="_blank" rel="noopener noreferrer" className="text-emerald-300 hover:text-emerald-200 underline underline-offset-2 inline-flex items-center gap-0.5">
            Plugin Hub <ExternalLink size={10} />
          </a>{' '}
          (in RuneLite: wrench icon → Plugin Hub → search "Fate Locked").
        </Step>
        <Step n={2} done={enabled}>
          {enabled ? (
            <span className="flex items-center gap-2 flex-wrap">
              Online sync is on — your pairing code is
              <span className="font-mono font-bold text-amber-300 tracking-widest">{relaySync.code}</span>
              <button onClick={copy} className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white" aria-label="Copy pairing code">
                {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              </button>
            </span>
          ) : (
            <span className="flex items-center gap-2 flex-wrap">
              <button onClick={() => relaySync.enable()} className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white">
                Enable online sync
              </button>
              to get a pairing code (optional — the clipboard/file export works without it).
            </span>
          )}
        </Step>
        <Step n={3} done={connected}>
          In RuneLite, open the plugin's config, tick <span className="text-gray-100">Enable online sync</span> (accept the
          prompt), and paste the code into <span className="text-gray-100">Online sync code</span>.
        </Step>
      </ol>

      {enabled && (
        <>
          <div className={`flex items-center gap-2 rounded-md px-2.5 py-2 text-[11px] border
            ${connected ? 'bg-emerald-900/15 border-emerald-500/25 text-emerald-200' : 'bg-amber-900/10 border-amber-500/20 text-amber-200/90'}`}>
            {connected
              ? <><CheckCircle2 size={12} className="text-emerald-400" /> Plugin connected — last import {agoLabel(pluginSeen!)}.</>
              : <><Loader2 size={12} className="animate-spin text-amber-300" /> Waiting for the plugin's first sync — it appears here within seconds of pasting the code.</>}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-gray-500 flex-wrap">
            <span>
              Run upload: <span className={`font-semibold ${PUSH_CLASS[relaySync.status]}`}>{PUSH_LABEL[relaySync.status]}</span>
              {relaySync.status === 'synced' && relaySync.lastSyncAt ? ` · ${agoLabel(relaySync.lastSyncAt)}` : ''}
            </span>
            {relaySync.status === 'error' && relaySync.lastError && (
              <span className="text-red-300/90">({relaySync.lastError} — the clipboard/file export still works)</span>
            )}
            <span className="text-gray-600">· data is ephemeral (24h), readable only with this code</span>
            <div className="flex-1" />
            <button
              onClick={() => relaySync.disable()}
              className="px-2 py-0.5 rounded text-[11px] font-semibold bg-white/10 hover:bg-white/15 text-gray-300"
            >
              Disconnect
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default RuneLiteOnboarding;
