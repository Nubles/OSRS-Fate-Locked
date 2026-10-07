import React, { useCallback, useEffect, useState } from 'react';
import { useProfiles } from '../context/ProfileContext';
import { useGame } from '../context/GameContext';
import {
  readDiscordConfig, writeDiscordConfig, writeCursor, cursorAtNewest, isValidWebhookUrl,
  testEmbed, postEmbeds,
} from '../utils/discordWebhook';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { showToast } from '../utils/toast';
import { X, Webhook, Send, Link2 } from 'lucide-react';
import { relaySync } from '../services/relaySync';
import {
  deleteProgress, formatLinkCode, newProgressShareRecord, publishProgress,
  readProgressShare, requestLinkCode, writeProgressShare,
} from '../utils/progressShare';

/**
 * Settings for Discord unlock announcements. The URL is stored per profile in
 * localStorage only — it never travels with exports or sync codes (a leaked
 * webhook lets anyone post to the channel; keep it on this device).
 */
export const DiscordSettingsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { storageKeyForActiveProfile: storageKey } = useProfiles();
  const { history } = useGame();
  const [cfg, setCfg] = useState(() => readDiscordConfig(storageKey));
  const [showLink, setShowLink] = useState(() => readProgressShare(storageKey)?.enabled === true);
  const [testing, setTesting] = useState(false);
  useEscapeKey(onClose, true);

  const urlOk = isValidWebhookUrl(cfg.url);
  const urlEmpty = cfg.url.trim() === '';

  const save = useCallback((next: { url: string; enabled: boolean }) => {
    setCfg(next);
    writeDiscordConfig(storageKey, next);
    // (Re-)enabling starts announcing from *now* — never the back-catalogue.
    if (next.enabled) writeCursor(storageKey, cursorAtNewest(history));
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

        <ProgressLinkSection storageKey={storageKey} expanded={showLink} onExpand={() => setShowLink(true)} />
      </div>
    </div>
  );
};

type LinkState =
  | { kind: 'idle' }
  | { kind: 'working' }
  | { kind: 'code'; code: string; expiresAt: number }
  | { kind: 'error'; message: string };

/**
 * Link the run to the Fate Locked Discord: turning it on publishes a progress
 * summary to the relay (ProgressShareDriver keeps it current), and a one-time
 * code ties it to the player's Discord account through the bot's /link.
 */
const ProgressLinkSection: React.FC<{ storageKey: string; expanded: boolean; onExpand: () => void }> = ({
  storageKey, expanded, onExpand,
}) => {
  const game = useGame();
  const [record, setRecord] = useState(() => readProgressShare(storageKey));
  const [link, setLink] = useState<LinkState>({ kind: 'idle' });
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (link.kind !== 'code') return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [link.kind]);

  const getCode = useCallback(async () => {
    setLink({ kind: 'working' });
    const current = readProgressShare(storageKey);
    const next = current ? { ...current, enabled: true } : newProgressShareRecord();
    writeProgressShare(storageKey, next);
    setRecord(next);
    const base = relaySync.base();
    // A code needs a published run, so publish now. A refusal within a minute means one is already there.
    const { buildProgressSnapshot } = await import('../utils/progressSnapshot');
    const snapshot = buildProgressSnapshot({
      unlocks: game.unlocks, history: game.history, gameModeId: game.gameModeId,
      customMode: game.customMode, linkedAccount: game.linkedAccount,
    });
    const published = await publishProgress(base, next, snapshot);
    if (!published.ok && 'error' in published) {
      setLink({ kind: 'error', message: published.error === 'network'
        ? 'Could not reach the relay. Check your connection and try again.'
        : 'The relay refused this run\'s progress. Turn sharing off and on, then try again.' });
      return;
    }
    const issued = await requestLinkCode(base, next);
    setNow(Date.now());
    setLink(issued.ok
      ? { kind: 'code', code: issued.code, expiresAt: issued.expiresAt }
      : { kind: 'error', message: 'Could not get a link code. Try again in a minute.' });
  }, [storageKey, game.unlocks, game.history, game.gameModeId, game.customMode, game.linkedAccount]);

  const stop = useCallback(async () => {
    const current = readProgressShare(storageKey);
    if (!current) return;
    writeProgressShare(storageKey, { ...current, enabled: false });
    setRecord({ ...current, enabled: false });
    setLink({ kind: 'idle' });
    const deleted = await deleteProgress(relaySync.base(), current);
    showToast(deleted ? 'Stopped sharing progress with Discord' : 'Sharing is off; the relay copy expires on its own');
  }, [storageKey]);

  const sharing = record?.enabled === true;
  const secondsLeft = link.kind === 'code' ? Math.max(0, Math.ceil((link.expiresAt - now) / 1000)) : 0;

  return (
    <div className="mt-4 pt-3 border-t border-white/10">
      <h3 className="text-[11px] font-black uppercase tracking-wider text-gray-200 flex items-center gap-2 mb-1.5">
        <Link2 size={13} className="text-indigo-400" /> Fate Locked Discord
      </h3>
      {!expanded && !sharing ? (
        <button onClick={onExpand} className="text-[11px] text-indigo-300 hover:text-indigo-200 underline">
          Show your progress in the Fate Locked Discord
        </button>
      ) : (
        <>
          <p className="text-[12px] text-gray-400 mb-2">
            Share a summary of this run (mode, areas, quests, diaries, Combat Achievements and your
            last few unlocks) so <span className="text-gray-200">/progress</span> in the Fate Locked
            Discord can show it. Your save never leaves this device.
          </p>
          {link.kind === 'code' && secondsLeft > 0 ? (
            <div className="bg-black/40 border border-indigo-500/40 rounded-lg p-3 mb-2 text-center">
              <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">In the Discord, type</div>
              <div className="font-mono text-lg text-indigo-200 select-all">/link {formatLinkCode(link.code)}</div>
              <div className="text-[10px] text-gray-500 mt-1">
                Works once, for the next {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
              </div>
            </div>
          ) : link.kind === 'error' ? (
            <p className="text-[11px] text-red-400 mb-2">{link.message}</p>
          ) : null}
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={getCode}
              disabled={link.kind === 'working'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition-colors"
            >
              <Link2 size={12} /> {link.kind === 'working' ? 'Getting code…' : sharing ? 'Get a link code' : 'Share and get a link code'}
            </button>
            {sharing && (
              <button
                onClick={stop}
                className="px-3 py-1.5 rounded-lg text-[11px] font-bold border bg-[#252525] border-white/15 text-gray-400 hover:text-white transition-colors"
              >
                Stop sharing
              </button>
            )}
          </div>
          {sharing && (
            <p className="text-[10px] text-gray-600 mt-1.5">
              Sharing is on. It updates about a minute after your progress changes.
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default DiscordSettingsModal;
