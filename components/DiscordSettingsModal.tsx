import React, { useCallback, useState } from 'react';
import { useProfiles } from '../context/ProfileContext';
import { useGame } from '../context/GameContext';
import {
  readDiscordConfig, writeDiscordConfig, writeCursor, isValidWebhookUrl,
  testEmbed, postEmbeds,
} from '../utils/discordWebhook';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { showToast } from '../utils/toast';
import { X, Webhook, Send } from 'lucide-react';

/**
 * Settings for Discord unlock announcements. The URL is stored per profile in
 * localStorage only — it never travels with exports or sync codes (a leaked
 * webhook lets anyone post to the channel; keep it on this device).
 */
export const DiscordSettingsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { storageKeyForActiveProfile: storageKey } = useProfiles();
  const { history } = useGame();
  const [cfg, setCfg] = useState(() => readDiscordConfig(storageKey));
  const [testing, setTesting] = useState(false);
  useEscapeKey(onClose, true);

  const urlOk = isValidWebhookUrl(cfg.url);
  const urlEmpty = cfg.url.trim() === '';

  const save = useCallback((next: { url: string; enabled: boolean }) => {
    setCfg(next);
    writeDiscordConfig(storageKey, next);
    // (Re-)enabling starts announcing from *now* — never the back-catalogue.
    if (next.enabled) {
      const newest = history.length ? Math.max(...history.map((e) => e.timestamp)) : Date.now();
      writeCursor(storageKey, newest);
    }
  }, [storageKey, history]);

  const handleTest = useCallback(async () => {
    setTesting(true);
    const ok = await postEmbeds(cfg.url, [testEmbed()]);
    setTesting(false);
    showToast(ok ? 'Test message sent — check your channel' : 'Test failed — check the webhook URL');
  }, [cfg.url]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md bg-[#1c1c1c] border border-white/15 rounded-xl shadow-2xl p-5"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Discord notifications"
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-black uppercase tracking-wider text-gray-100 flex items-center gap-2">
            <Webhook size={15} className="text-indigo-400" /> Discord notifications
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white" aria-label="Close"><X size={16} /></button>
        </div>

        <p className="text-[12px] text-gray-400 mb-3">
          Announce every unlock in a Discord channel. In Discord: channel settings →
          Integrations → Webhooks → New Webhook → Copy URL.
        </p>

        <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1" htmlFor="discord-url">
          Webhook URL
        </label>
        <input
          id="discord-url"
          type="password"
          value={cfg.url}
          onChange={(e) => save({ ...cfg, url: e.target.value, enabled: cfg.enabled && isValidWebhookUrl(e.target.value) })}
          placeholder="https://discord.com/api/webhooks/…"
          autoComplete="off"
          className={`w-full bg-black/40 border rounded-lg px-3 py-2 text-[12px] text-gray-200 placeholder-gray-600 focus:outline-none ${urlEmpty ? 'border-white/15' : urlOk ? 'border-emerald-500/50' : 'border-red-500/50'}`}
        />
        {!urlEmpty && !urlOk && (
          <p className="text-[11px] text-red-400 mt-1">That doesn't look like a Discord webhook URL.</p>
        )}
        <p className="text-[10px] text-gray-600 mt-1.5">
          Stays on this device — never included in save exports or sync codes.
        </p>

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/10">
          <button
            onClick={() => save({ ...cfg, enabled: !cfg.enabled })}
            disabled={!urlOk}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider border transition-colors ${cfg.enabled ? 'bg-emerald-900/40 border-emerald-500/50 text-emerald-300' : 'bg-[#252525] border-white/15 text-gray-400 hover:text-white disabled:opacity-40'}`}
            aria-pressed={cfg.enabled}
          >
            {cfg.enabled ? 'Announcements: on' : 'Announcements: off'}
          </button>
          <button
            onClick={handleTest}
            disabled={!urlOk || testing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition-colors"
          >
            <Send size={12} /> {testing ? 'Sending…' : 'Send test'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DiscordSettingsModal;
