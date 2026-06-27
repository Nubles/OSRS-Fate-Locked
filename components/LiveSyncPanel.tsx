import React, { useEffect, useState } from 'react';
import { Radio, Plug, PlugZap, AlertTriangle, Upload, MapPin, Loader2, CheckCircle2 } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { liveSync, LiveStatus, LiveState } from '../services/liveSync';
import { buildRuneliteBundle } from '../utils/runeliteBundle';

/** Subscribe to the liveSync singleton and re-render on its changes. */
function useLive(): { status: LiveStatus; state: LiveState | null; error: string | null } {
  const [, force] = useState(0);
  useEffect(() => liveSync.subscribe(() => force(n => n + 1)), []);
  return { status: liveSync.status, state: liveSync.state, error: liveSync.lastError };
}

const LOCK_COLOR: Record<string, string> = {
  UNLOCKED: 'text-emerald-300', LOCKED: 'text-red-300', UNAUTHORED: 'text-gray-400',
};

export const LiveSyncPanel: React.FC = () => {
  const { unlocks, keys, specialKeys, chaosKeys, fatePoints, activeBuff, pinnedGoals, linkedAccount } = useGame() as any;
  const { status, state, error } = useLive();
  const [port, setPort] = useState(liveSync.getPort());
  const [pushState, setPushState] = useState<'idle' | 'pushing' | 'ok' | 'fail'>('idle');

  const connected = status === 'connected';
  const on = status !== 'off';

  const toggle = () => { if (on) liveSync.stop(); else { liveSync.setPort(port); liveSync.start(); } };

  const push = async () => {
    setPushState('pushing');
    const bundle = buildRuneliteBundle(unlocks.regions, { keys, specialKeys, chaosKeys, fatePoints, activeBuff, pinnedGoals: pinnedGoals ?? [], linkedAccount });
    const ok = await liveSync.pushBundle(JSON.stringify(bundle));
    setPushState(ok ? 'ok' : 'fail');
    window.setTimeout(() => setPushState('idle'), 2500);
  };

  // Account-mismatch hint: the live character vs the run's bound account.
  const mismatch = connected && state?.loggedIn && linkedAccount && state.player &&
    state.player.replace(/ /g, ' ').toLowerCase() !== String(linkedAccount).toLowerCase();

  return (
    <div className="mt-5 border-t border-white/10 pt-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Radio size={15} className={connected ? 'text-emerald-400' : 'text-gray-500'} />
        <h3 className="text-sm font-bold text-white">Live RuneLite sync</h3>
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
          connected ? 'bg-emerald-500/15 text-emerald-300' : status === 'connecting' ? 'bg-amber-500/15 text-amber-300'
            : status === 'error' ? 'bg-red-500/15 text-red-300' : 'bg-white/5 text-gray-400'}`}>
          {connected ? 'Connected' : status === 'connecting' ? 'Connecting…' : status === 'error' ? 'No plugin' : 'Off'}
        </span>
        <div className="flex-1" />
        <label className="flex items-center gap-1 text-[10px] text-gray-500">
          port
          <input
            type="number"
            value={port}
            onChange={(e) => setPort(+e.target.value || 43596)}
            className="w-16 bg-black/40 border border-white/15 rounded px-1.5 py-0.5 text-[11px] text-gray-200 focus:outline-none focus:border-emerald-500/60"
          />
        </label>
        <button
          onClick={toggle}
          className={`px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1.5 ${
            on ? 'bg-white/10 hover:bg-white/15 text-gray-200' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
        >
          {on ? <Plug size={14} /> : <PlugZap size={14} />} {on ? 'Disconnect' : 'Connect'}
        </button>
      </div>

      {status === 'error' && (
        <div className="text-[11px] text-gray-500 flex items-start gap-1.5">
          <AlertTriangle size={12} className="shrink-0 mt-0.5 text-gray-600" />
          Can't reach the plugin on port {liveSync.getPort()}. In RuneLite, open the Fate Locked plugin config →
          <span className="text-gray-400"> Live sync → Enable live sync</span> (matching this port), then make sure RuneLite is running.
        </div>
      )}

      {connected && state && (
        <div className="space-y-2.5">
          {state.loggedIn ? (
            <>
              <div className="flex items-center gap-3 flex-wrap bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                <div>
                  <div className="text-sm font-bold text-white flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-emerald-400" /> {state.player ?? 'Logged in'}
                  </div>
                  <div className="text-[11px] text-gray-500">
                    {state.combatLevel != null && <>Combat <span className="text-gray-300 font-mono">{state.combatLevel}</span> · </>}
                    World <span className="text-gray-300 font-mono">{state.world ?? '—'}</span>
                  </div>
                </div>
                <div className="flex-1" />
                {state.chunk && (
                  <div className="text-right text-[11px]">
                    <div className="text-gray-400 flex items-center gap-1 justify-end"><MapPin size={11} /> {state.area || `(${state.chunk[0]},${state.chunk[1]})`}</div>
                    {state.lock && <div className={`text-[10px] font-semibold ${LOCK_COLOR[state.lock] ?? 'text-gray-400'}`}>{state.lock.toLowerCase()}</div>}
                  </div>
                )}
              </div>

              {mismatch && (
                <div className="text-[11px] text-amber-300/90 flex items-start gap-1.5">
                  <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                  You're playing <span className="font-semibold">{state.player}</span>, but this run is bound to <span className="font-semibold">{linkedAccount}</span>.
                </div>
              )}

              {state.skills && (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-1">
                  {Object.entries(state.skills).slice(0, 24).map(([sk, lvl]) => (
                    <div key={sk} className="flex items-center justify-between px-1.5 py-0.5 rounded bg-white/5 text-[10px]">
                      <span className="text-gray-400 truncate">{sk.slice(0, 4)}</span>
                      <span className="text-gray-200 font-mono">{lvl}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="text-[12px] text-gray-400">Plugin connected — log in to a character to see live state.</div>
          )}

          <button
            onClick={push}
            disabled={pushState === 'pushing'}
            className="px-3 py-1.5 rounded-lg bg-cyan-700/70 hover:bg-cyan-600/70 disabled:opacity-50 text-white text-sm font-semibold flex items-center gap-1.5"
          >
            {pushState === 'pushing' ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {pushState === 'ok' ? 'Pushed ✓' : pushState === 'fail' ? 'Push failed' : 'Push my unlocks to RuneLite'}
          </button>
          <p className="text-[10px] text-gray-600">
            The plugin's in-game warnings then use your current unlock state. Live state updates ~once a second while connected.
          </p>
        </div>
      )}

      {status === 'off' && (
        <p className="text-[11px] text-gray-500">
          Connect to mirror your live game (level-ups, position, current chunk) here and push your unlocks into the
          in-game plugin. Requires the Fate Locked RuneLite plugin with <span className="text-gray-400">Live sync</span> enabled.
        </p>
      )}
    </div>
  );
};

export default LiveSyncPanel;
