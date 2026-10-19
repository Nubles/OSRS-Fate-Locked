import { useEffect, useRef, useState } from 'react';
import { relaySync } from '../services/relaySync';
import { getRollInboxStore } from '../services/rollInboxRuntime';
import { announceSentEvents, relayInboxPace, takeSentEvents } from '../services/relayInbox';
import { relayInboxEarliestAt, relayInboxNextAt } from '../utils/relayInbox';

/**
 * While this tab is paired with RuneLite and saves the run, takes what
 * RuneLite's Send to tracker left on the relay into the run's Roll Inbox:
 * on start, when the tab shows again, and every minute while it shows
 * (utils/relayInbox.ts has the pace). Only the saving tab takes, so two tabs
 * never add the same events to one inbox. Nothing rolls.
 */
export function useRelayInboxSync(runId: string, linkedAccount: string | null | undefined, saving: boolean): void {
  const [, force] = useState(0);
  useEffect(() => relaySync.subscribe(() => force((value) => value + 1)), []);
  const code = saving ? relaySync.code : null;
  const token = saving ? relaySync.token : null;
  const linked = useRef(linkedAccount);
  linked.current = linkedAccount;

  useEffect(() => {
    if (!code || !token || relayInboxPace.unsupported) return;
    let cancelled = false;
    let timer: number | null = null;
    let inFlight = false;
    const hidden = () => document.visibilityState === 'hidden';
    const clear = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
    };
    const scheduleAt = (at: number) => {
      clear();
      if (cancelled || hidden()) return;
      timer = window.setTimeout(() => {
        timer = null;
        void take();
      }, Math.max(0, at - Date.now()));
    };

    const take = async () => {
      if (cancelled || inFlight || hidden() || relayInboxPace.unsupported) return;
      // Never twice in 10 seconds, nor before a failure's backoff has passed.
      const earliest = relayInboxEarliestAt(relayInboxPace.lastAttemptAt, relayInboxPace.failures);
      if (Date.now() < earliest) {
        scheduleAt(earliest);
        return;
      }
      inFlight = true;
      relayInboxPace.lastAttemptAt = Date.now();
      const outcome = await takeSentEvents({
        base: relaySync.base(),
        code,
        token,
        store: getRollInboxStore(runId),
        linkedAccount: linked.current,
      });
      inFlight = false;
      if (outcome.kind === 'unsupported') {
        relayInboxPace.unsupported = true;
        return;
      }
      if (outcome.kind === 'refused') return;
      relayInboxPace.failures = outcome.kind === 'failed' ? relayInboxPace.failures + 1 : 0;
      if (outcome.kind === 'taken' && outcome.sent) announceSentEvents(runId, outcome.sent);
      scheduleAt(relayInboxNextAt(relayInboxPace.lastAttemptAt, relayInboxPace.failures));
    };

    const onVisibilityChange = () => {
      if (hidden()) clear();
      else scheduleAt(relayInboxEarliestAt(relayInboxPace.lastAttemptAt, relayInboxPace.failures));
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    scheduleAt(relayInboxEarliestAt(relayInboxPace.lastAttemptAt, relayInboxPace.failures));
    return () => {
      cancelled = true;
      clear();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [code, token, runId]);
}
