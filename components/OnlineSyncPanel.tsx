import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff, Copy, Check } from 'lucide-react';
import { relaySync, RelayStatus } from '../services/relaySync';

const STATUS_LABEL: Record<RelayStatus, string> = {
  off: 'Off', syncing: 'Syncing…', synced: 'Synced', error: 'Error',
};
const STATUS_CLASS: Record<RelayStatus, string> = {
  off: 'text-gray-400', syncing: 'text-amber-300', synced: 'text-emerald-300', error: 'text-red-300',
};

/** Optional online-sync control: generate a pairing code and push the run to the
 *  relay so the RuneLite plugin can pull it by code (no clipboard/file). */
export const OnlineSyncPanel: React.FC = () => {
  const [, force] = useState(0);
  useEffect(() => relaySync.subscribe(() => force((n) => n + 1)), []);
  const [copied, setCopied] = useState(false);

  const enabled = relaySync.enabled;

  const copy = () => {
    if (!relaySync.code) return;
    navigator.clipboard?.writeText(relaySync.code).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const ago = relaySync.lastSyncAt
    ? Math.max(0, Math.round((Date.now() - relaySync.lastSyncAt) / 1000)) + 's ago'
    : '—';

  return (
    <div className="mt-5 border-t border-white/10 pt-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        {enabled ? <Wifi size={15} className="text-emerald-400" /> : <WifiOff size={15} className="text-gray-500" />}
        <h3 className="text-sm font-bold text-white">Online sync</h3>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-400 font-semibold">beta</span>
        <div className="flex-1" />
        {enabled
          ? <button onClick={() => relaySync.disable()} className="px-3 py-1.5 rounded-lg text-sm font-bold bg-white/10 hover:bg-white/15 text-gray-200">Disconnect</button>
          : <button onClick={() => relaySync.enable()} className="px-3 py-1.5 rounded-lg text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white">Enable</button>}
      </div>

      {enabled ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
            <span className="text-[11px] text-gray-500">Pairing code</span>
            <span className="font-mono font-bold text-base text-amber-300 tracking-widest">{relaySync.code}</span>
            <button onClick={copy} className="ml-1 p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white" aria-label="Copy code">
              {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            </button>
            <div className="flex-1" />
            <span className={`text-[11px] font-semibold ${STATUS_CLASS[relaySync.status]}`}>
              {STATUS_LABEL[relaySync.status]}{relaySync.status === 'synced' ? ` · ${ago}` : ''}
            </span>
          </div>
          <p className="text-[11px] text-gray-500">
            In RuneLite, open the Fate Locked plugin config and paste this into <span className="text-gray-300">Online sync code</span>.
            Your unlocks then sync over the internet — no clipboard or files. Data is ephemeral (24h); only this code can read it.
          </p>
          {relaySync.status === 'error' && relaySync.lastError && (
            <p className="text-[11px] text-red-300/90">Couldn't reach the relay ({relaySync.lastError}). The clipboard/file paths still work.</p>
          )}
        </div>
      ) : (
        <p className="text-[11px] text-gray-500">
          Optional: sync your run to the RuneLite plugin over the internet with a pairing code — handy if the game and this page
          are on different machines. Prefer the clipboard/file export if you'd rather nothing leave your device.
        </p>
      )}
    </div>
  );
};

export default OnlineSyncPanel;
