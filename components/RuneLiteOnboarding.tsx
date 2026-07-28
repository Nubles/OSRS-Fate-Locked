import React, { useEffect, useState } from 'react';
import {
  Check, CheckCircle2, ChevronDown, ChevronUp, ExternalLink,
  Loader2, Puzzle, XCircle,
} from 'lucide-react';
import { relaySync } from '../services/relaySync';
import { RUNELITE_PAIRING_SUCCESS_COPY } from '../utils/runelitePairing';

type DeliveryStatus = 'off' | 'sending' | 'sent' | 'upload-error';

const HUB_URL =
  'https://runelite.net/plugin-hub/show/fate-locked-ironman';
const HIDDEN_KEY = 'fate_rl_onboard_hidden_v1';

const agoLabel = (ts: number): string => {
  const seconds = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (seconds < 90) return `${seconds}s ago`;
  if (seconds < 90 * 60) return `${Math.round(seconds / 60)}m ago`;
  return `${Math.round(seconds / 3600)}h ago`;
};

const Step: React.FC<{
  n: number;
  done?: boolean;
  children: React.ReactNode;
}> = ({ n, done, children }) => (
  <li className="flex items-start gap-2.5">
    <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold
      ${done ? 'bg-emerald-600 text-white' : 'bg-white/10 text-gray-300'}`}>
      {done ? <Check size={11} /> : n}
    </span>
    <div className="text-[12px] leading-relaxed text-gray-300">
      {children}
    </div>
  </li>
);

export const RuneLiteOnboarding: React.FC = () => {
  const [, force] = useState(0);
  useEffect(
    () => relaySync.subscribe(() => force((value) => value + 1)),
    [],
  );
  const [hidden, setHidden] = useState<boolean>(() => {
    try {
      return localStorage.getItem(HIDDEN_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [overlayCopied, setOverlayCopied] = useState(false);

  const deliveryStatus: DeliveryStatus = !relaySync.enabled
    ? 'off'
    : relaySync.status === 'error'
      ? 'upload-error'
      : relaySync.status === 'synced'
        ? 'sent'
        : 'sending';

  const setHiddenPersist = (value: boolean) => {
    setHidden(value);
    try {
      localStorage.setItem(HIDDEN_KEY, value ? '1' : '0');
    } catch {
      // Storage restrictions must not block the guide.
    }
  };

  const copyOverlayUrl = () => {
    if (!relaySync.code) return;
    const url =
      `${window.location.origin}${window.location.pathname}`
      + `#/overlay?code=${relaySync.code}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    setOverlayCopied(true);
    window.setTimeout(() => setOverlayCopied(false), 1500);
  };

  if (hidden) {
    const collapsedLabel: Record<DeliveryStatus, string> = {
      off: 'Setup guide',
      sending: 'Sending profile',
      sent: 'Profile sent',
      'upload-error': 'Upload error',
    };
    return (
      <button
        onClick={() => setHiddenPersist(false)}
        className="flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-left transition-colors hover:bg-white/[0.06]"
      >
        <Puzzle
          size={13}
          className={deliveryStatus === 'sent'
            ? 'text-emerald-400'
            : 'text-gray-500'}
        />
        <span className="text-[12px] font-semibold text-gray-300">
          RuneLite plugin
        </span>
        <span className={deliveryStatus === 'sent'
          ? 'text-[11px] text-emerald-300'
          : 'text-[11px] text-gray-500'}
        >
          {collapsedLabel[deliveryStatus]}
        </span>
        <div className="flex-1" />
        <ChevronDown size={13} className="text-gray-500" />
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-white/10 bg-white/[0.03] p-3.5">
      <div className="flex items-center gap-2">
        <Puzzle size={14} className="text-emerald-400" />
        <h3 className="text-xs font-bold uppercase tracking-wide text-gray-200">
          Connect RuneLite
        </h3>
        {deliveryStatus === 'sent' && (
          <span className="flex items-center gap-1 rounded bg-emerald-900/40 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
            <CheckCircle2 size={10} /> Profile sent
          </span>
        )}
        <div className="flex-1" />
        <button
          onClick={() => setHiddenPersist(true)}
          className="rounded p-1 text-gray-500 hover:bg-white/10 hover:text-white"
          aria-label="Collapse guide"
        >
          <ChevronUp size={13} />
        </button>
      </div>

      <ol className="space-y-2.5">
        <Step n={1}>
          Install{' '}
          <span className="font-semibold text-gray-100">
            Fate Locked Ironman
          </span>{' '}
          from the{' '}
          <a
            href={HUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-emerald-300 underline underline-offset-2 hover:text-emerald-200"
          >
            Plugin Hub <ExternalLink size={10} />
          </a>
          .
        </Step>
        <Step n={2} done={deliveryStatus === 'sent'}>
          {deliveryStatus === 'off' && (
            <p>
              In RuneLite, open the Fate Locked panel and click
              {' '}<span className="font-semibold text-gray-100">
                Connect tracker
              </span>. Confirm this profile in the tab RuneLite opens.
            </p>
          )}
          {deliveryStatus === 'sending' && (
            <p className="flex items-center gap-2 text-amber-200">
              <Loader2 size={12} className="animate-spin" />
              Sending profile to RuneLite…
            </p>
          )}
          {deliveryStatus === 'sent' && (
            <p className="text-emerald-200">
              {RUNELITE_PAIRING_SUCCESS_COPY}
            </p>
          )}
          {deliveryStatus === 'upload-error' && (
            <div className="space-y-2 text-red-200">
              <p className="flex items-center gap-2">
                <XCircle size={12} />
                <span>{relaySync.lastError || 'Profile upload failed.'}</span>
              </p>
              <button
                type="button"
                onClick={() => relaySync.requestPush()}
                className="rounded bg-red-700 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-red-600"
              >
                Retry profile upload
              </button>
            </div>
          )}
        </Step>
      </ol>

      <div className="rounded-md border border-white/10 bg-black/15 px-2.5 py-2 text-[11px] leading-relaxed text-gray-400">
        <span className="font-semibold text-gray-300">
          Advanced recovery:
        </span>{' '}
        use clipboard or file import if the relay is unavailable. RuneLite
        local history is not transferred to the web Roll Inbox.
      </div>

      {relaySync.enabled && (
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
          {deliveryStatus === 'sent' && relaySync.lastSyncAt && (
            <span>Profile sent {agoLabel(relaySync.lastSyncAt)}</span>
          )}
          <span className="text-gray-600">
            · published data is ephemeral (24h)
          </span>
          <div className="flex-1" />
          <button
            onClick={copyOverlayUrl}
            className="rounded bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-gray-300 hover:bg-white/15"
            title="OBS browser-source URL for the browser-authored profile"
          >
            {overlayCopied ? 'Copied!' : 'Copy stream overlay URL'}
          </button>
          <button
            onClick={() => relaySync.disable()}
            className="rounded bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-gray-300 hover:bg-white/15"
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
};

export default RuneLiteOnboarding;
