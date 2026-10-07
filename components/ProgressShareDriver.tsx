import React, { useEffect, useRef, useState } from 'react';
import { useGame } from '../context/GameContext';
import { useProfiles } from '../context/ProfileContext';
import { relaySync } from '../services/relaySync';
import {
  PROGRESS_SHARE_EVENT, readProgressShare, type ProgressShareEventDetail,
} from '../utils/progressShareRecord';

/** Coalesce changes: publish once they pause this long. */
const SETTLE_MS = 30_000;
/** Never publish more often than the relay accepts. */
const MIN_GAP_MS = 60_000;

/**
 * Publishes the run's progress for the Fate Locked Discord bot while sharing
 * is on (utils/progressShare.ts). Renders nothing and must stay ALWAYS-MOUNTED
 * (RollInboxDriver rule): progress changes from any tab. Each publish is a KV
 * write, so changes settle for 30 seconds, publishes are a minute apart, and
 * an unchanged snapshot is never sent twice. The snapshot builder pulls in the
 * quest and diary tables, so it and the relay requests load only once sharing is on.
 */
export const ProgressShareDriver: React.FC = () => {
  const { unlocks, history, gameModeId, customMode, linkedAccount } = useGame();
  const { storageKeyForActiveProfile: storageKey } = useProfiles();
  const [record, setRecord] = useState(() => readProgressShare(storageKey));
  const lastSent = useRef<{ id: string; body: string } | null>(null);
  const lastAt = useRef(0);

  useEffect(() => {
    setRecord(readProgressShare(storageKey));
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<ProgressShareEventDetail>).detail;
      if (detail?.storageKey === storageKey) setRecord(readProgressShare(storageKey));
    };
    window.addEventListener(PROGRESS_SHARE_EVENT, onChange);
    return () => window.removeEventListener(PROGRESS_SHARE_EVENT, onChange);
  }, [storageKey]);

  useEffect(() => {
    if (!record?.enabled) return;
    let cancelled = false;
    let timer: number | undefined;

    const send = async () => {
      const [{ buildProgressSnapshot }, { publishProgress }] = await Promise.all([
        import('../utils/progressSnapshot'),
        import('../utils/progressShare'),
      ]);
      if (cancelled) return;
      const body = JSON.stringify(buildProgressSnapshot({ unlocks, history, gameModeId, customMode, linkedAccount }));
      if (lastSent.current?.id === record.id && lastSent.current.body === body) return;
      lastAt.current = Date.now();
      const result = await publishProgress(relaySync.base(), record, JSON.parse(body));
      if (cancelled) return;
      if (result.ok) lastSent.current = { id: record.id, body };
      else if ('retryAfterMs' in result) timer = window.setTimeout(send, result.retryAfterMs);
    };

    // The first publish after turning sharing on (or loading) goes out quickly,
    // so a link code can be requested; later ones wait for changes to settle.
    const settle = lastSent.current?.id === record.id ? SETTLE_MS : 2_000;
    const wait = Math.max(settle, lastAt.current + MIN_GAP_MS - Date.now());
    timer = window.setTimeout(send, wait);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [record, unlocks, history, gameModeId, customMode, linkedAccount]);

  return null;
};
