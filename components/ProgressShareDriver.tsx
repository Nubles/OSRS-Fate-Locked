import React, { useEffect, useRef, useState } from 'react';
import { useGame } from '../context/GameContext';
import { useProfiles } from '../context/ProfileContext';
import { relaySync } from '../services/relaySync';
import { profileProgressShareKey } from '../utils/profileStorage';
import {
  PROGRESS_SHARE_EVENT, readProgressShare, type ProgressShareEventDetail,
} from '../utils/progressShareRecord';

/** Coalesce changes: publish once they pause this long. */
export const PROGRESS_SETTLE_MS = 60_000;
/**
 * Publishes are at least this far apart (the relay accepts one a minute).
 * Each is one of the relay's 1,000 KV writes a day for every player, and the
 * Discord feed posts a publish's new unlocks together, so a run of unlocks
 * goes out as one.
 */
export const PROGRESS_MIN_GAP_MS = 3 * 60_000;

/**
 * Publishes the run's progress for the Fate Locked Discord bot while sharing
 * is on (utils/progressShare.ts). Renders nothing and must stay ALWAYS-MOUNTED
 * (RollInboxDriver rule): progress changes from any tab. Each publish is a KV
 * write, so changes settle for a minute, publishes are 3 minutes apart, and
 * an unchanged snapshot is never sent twice (after a reload the relay itself
 * skips the write). Only the tab that owns the save publishes, and it follows
 * the stored record, which another tab of the profile may change. The snapshot
 * builder pulls in the quest and diary tables, so it and the relay requests
 * load only once sharing is on.
 */
export const ProgressShareDriver: React.FC = () => {
  const { unlocks, history, gameModeId, customMode, linkedAccount, saveOwnershipStatus } = useGame();
  const { storageKeyForActiveProfile: storageKey } = useProfiles();
  const [record, setRecord] = useState(() => readProgressShare(storageKey));
  /** The run id this driver published since sharing was last on (or the page loaded). */
  const publishedId = useRef<string | null>(null);
  const lastAt = useRef(0);

  useEffect(() => {
    setRecord(readProgressShare(storageKey));
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<ProgressShareEventDetail>).detail;
      if (detail?.storageKey === storageKey) setRecord(readProgressShare(storageKey));
    };
    // Another tab's Stop sharing or Public: off arrives as a storage event.
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === profileProgressShareKey(storageKey)) setRecord(readProgressShare(storageKey));
    };
    window.addEventListener(PROGRESS_SHARE_EVENT, onChange);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(PROGRESS_SHARE_EVENT, onChange);
      window.removeEventListener('storage', onStorage);
    };
  }, [storageKey]);

  useEffect(() => {
    if (!record?.enabled) {
      publishedId.current = null; // the relay copy went with Stop sharing
      return;
    }
    // A tab that does not own the save holds older progress.
    if (saveOwnershipStatus !== 'owner') return;
    let cancelled = false;
    let timer: number | undefined;

    const send = async () => {
      const [{ buildProgressSnapshot }, { publishProgress, replaceRefusedShare, lastAcceptedSummary }] = await Promise.all([
        import('../utils/progressSnapshot'),
        import('../utils/progressShare'),
      ]);
      if (cancelled) return;
      // Publish what is stored now, not what this tab last saw.
      const current = readProgressShare(storageKey);
      if (!current?.enabled || current.id !== record.id) return;
      const body = JSON.stringify(buildProgressSnapshot({
        unlocks, history, gameModeId, customMode, linkedAccount, publicLog: current.publicLog === true,
      }));
      // Skip only a summary the relay already took from this page (the settings publish too).
      if (publishedId.current === current.id && lastAcceptedSummary(current.id) === body) return;
      lastAt.current = Date.now();
      const result = await publishProgress(relaySync.base(), current, JSON.parse(body));
      if (cancelled) return;
      if (result.ok) publishedId.current = current.id;
      else if ('retryAfterMs' in result) timer = window.setTimeout(send, result.retryAfterMs);
      else if ('error' in result && result.error === 'forbidden') {
        // Another token holds this run's id: move to a new one, once (replaceRefusedShare).
        const next = replaceRefusedShare(storageKey, current);
        if (next && next.id !== current.id) setRecord(next);
      }
    };

    // The first publish after turning sharing on (or loading) goes out quickly,
    // so a link code can be requested; later ones wait for changes to settle.
    const settle = publishedId.current === record.id ? PROGRESS_SETTLE_MS : 2_000;
    const wait = Math.max(settle, lastAt.current + PROGRESS_MIN_GAP_MS - Date.now());
    timer = window.setTimeout(send, wait);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [record, storageKey, saveOwnershipStatus, unlocks, history, gameModeId, customMode, linkedAccount]);

  return null;
};
