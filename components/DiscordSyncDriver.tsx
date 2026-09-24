import React, { useEffect, useRef } from 'react';
import { useGame } from '../context/GameContext';
import { useProfiles } from '../context/ProfileContext';
import {
  readDiscordConfig, readCursor, writeCursor, isValidWebhookUrl,
  planAnnouncements, unlockEmbed, postEmbeds,
} from '../utils/discordWebhook';

/**
 * Posts new unlocks to the profile's Discord webhook. Renders nothing and
 * must stay ALWAYS-MOUNTED (RollInboxDriver rule): unlocks can happen from
 * any tab. Cursor semantics: advance BEFORE sending and regardless of the
 * outcome — a flaky network may drop an announcement, but a retry loop can
 * never spam the channel or double-post. A missing cursor, or a run replaced
 * by an import, sync code, restore or reset, reseeds silently to the newest
 * entry, so neither enabling nor importing floods the channel.
 */
export const DiscordSyncDriver: React.FC = () => {
  const { history, stateReplacements } = useGame();
  const { storageKeyForActiveProfile: storageKey } = useProfiles();
  const busy = useRef(false);
  const seenReplacements = useRef(stateReplacements);

  useEffect(() => {
    const replaced = seenReplacements.current !== stateReplacements;
    seenReplacements.current = stateReplacements;

    const cfg = readDiscordConfig(storageKey);
    if (!cfg.enabled || !isValidWebhookUrl(cfg.url)) return;

    const plan = planAnnouncements(history, readCursor(storageKey), replaced);
    if (plan.post.length === 0) {
      if (plan.cursor) writeCursor(storageKey, plan.cursor);
      return;
    }
    // Mid-post: leave the cursor so the next history change picks these up.
    if (busy.current) return;

    busy.current = true;
    if (plan.cursor) writeCursor(storageKey, plan.cursor);
    postEmbeds(cfg.url, plan.post.map(unlockEmbed)).finally(() => {
      busy.current = false;
    });
  }, [history, stateReplacements, storageKey]);

  return null;
};
