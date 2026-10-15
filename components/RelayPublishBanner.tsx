import { useEffect, useState, type FC } from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { relaySync } from '../services/relaySync';
import { NOT_SAVING_PUBLISH_MESSAGE } from './OnlineSyncDriver';

/** What went wrong, as the player can act on it, for the relay error `lastError`. */
export function relayFailureReason(lastError: string | null): string {
  const error = lastError ?? '';
  const status = Number(/^relay (\d{3})$/.exec(error)?.[1]);
  if (status === 403) {
    return 'The relay refused this connection; another browser may have taken it over. Press Connect tracker in RuneLite to pair this browser again.';
  }
  if (status === 400) {
    return 'The relay refused this connection. Press Connect tracker in RuneLite to pair this browser again.';
  }
  if (status === 413) return 'Your rules were too large for the relay to accept.';
  if (status === 429) return 'The relay is busy right now.';
  if (status >= 500) return 'The relay is having trouble right now.';
  if (/timed out/i.test(error)) return "The relay didn't answer in time.";
  if (/^Couldn't load/.test(error)) return "The tracker couldn't load its map data, so it didn't send your rules.";
  if (/fetch|network|load failed/i.test(error)) return "The tracker couldn't reach the relay. Check your internet connection.";
  return error ? `Sending failed (${error}).` : 'Sending failed.';
}

const clock = (at: number): string =>
  new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export interface RelayPublishBannerViewProps {
  lastError: string | null;
  lastSyncAt: number | null;
  retryAt: number | null;
  retrying: boolean;
  onRetry: () => void;
  onDismiss: () => void;
}

export const RelayPublishBannerView: FC<RelayPublishBannerViewProps> = ({
  lastError, lastSyncAt, retryAt, retrying, onRetry, onDismiss,
}) => (
  <div className="max-w-[1600px] mx-auto px-4 pt-3" data-testid="relay-publish-banner">
    <div
      role="status"
      aria-live="polite"
      className="flex flex-wrap items-start gap-3 bg-amber-950/40 border border-amber-500/30 rounded-lg px-3 py-2 text-[12px] text-amber-200/90 sm:items-center"
    >
      <AlertTriangle size={14} className="text-amber-400 shrink-0" />
      <span className="min-w-0 flex-1 basis-full sm:basis-auto">
        <b className="text-amber-100">RuneLite isn't getting your latest rules.</b>{' '}
        {relayFailureReason(lastError)}{' '}
        RuneLite is still using the rules it last received
        {lastSyncAt ? <> (sent at {clock(lastSyncAt)})</> : null}, so recent unlocks won't show there yet.
        {retrying
          ? <> Sending again now…</>
          : retryAt ? <> The tracker will try again by itself at {clock(retryAt)}.</> : null}
      </span>
      <button
        type="button"
        onClick={onRetry}
        disabled={retrying}
        className="inline-flex shrink-0 items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-600 hover:bg-amber-500 text-white font-bold transition-colors disabled:cursor-wait disabled:opacity-60"
      >
        <RefreshCw size={12} className={retrying ? 'animate-spin' : ''} />
        {retrying ? 'Sending…' : 'Retry now'}
      </button>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 px-2 py-1 rounded-md text-amber-300/70 hover:text-amber-200 hover:bg-white/5 transition-colors"
        title="Hide until sending works again"
        aria-label="Hide until sending works again"
      >
        <X size={13} />
      </button>
    </div>
  </div>
);

/**
 * Says when publishing to RuneLite has failed: what failed, that RuneLite is
 * still on the rules it last received, and when the tracker tries again
 * (OnlineSyncDriver retries by itself), with Retry now. It waits for a second
 * failure in a row before showing, so one blip that the first retry fixes
 * shows nothing, except when retrying can't help. A tab that isn't saving the
 * profile is left to the save banners, which say why.
 */
export const RelayPublishBanner: FC = () => {
  const [, force] = useState(0);
  useEffect(() => relaySync.subscribe(() => force((value) => value + 1)), []);
  // Hidden until a publish works again, or the pairing changes.
  const [dismissed, setDismissed] = useState(false);
  const recovered = relaySync.failures === 0;
  useEffect(() => {
    if (recovered) setDismissed(false);
  }, [recovered]);

  const failing = relaySync.enabled
    && relaySync.failures > 0
    && relaySync.status !== 'synced'
    && relaySync.lastFailure !== NOT_SAVING_PUBLISH_MESSAGE
    && (relaySync.failures >= 2 || !relaySync.retryable);
  if (!failing || dismissed) return null;

  return (
    <RelayPublishBannerView
      lastError={relaySync.lastFailure}
      lastSyncAt={relaySync.lastSyncAt}
      retryAt={relaySync.retryable ? relaySync.retryAt : null}
      retrying={relaySync.status === 'syncing'}
      onRetry={() => { relaySync.requestPush(); }}
      onDismiss={() => setDismissed(true)}
    />
  );
};

export default RelayPublishBanner;
