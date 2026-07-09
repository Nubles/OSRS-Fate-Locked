import React, { useEffect, useRef } from 'react';
import { useGame } from '../context/GameContext';
import { useProfiles } from '../context/ProfileContext';
import {
  readDiscordConfig, readCursor, writeCursor, isValidWebhookUrl,
  pickNewUnlocks, unlockEmbed, postEmbeds,
} from '../utils/discordWebhook';

/**
 * Posts new unlocks to the profile's Discord webhook. Renders nothing and
 * must stay ALWAYS-MOUNTED (SuggestionBanner rule): unlocks can happen from
 * any tab. Cursor semantics: advance BEFORE sending and regardless of the
 * outcome — a flaky network may drop an announcement, but a retry loop can
 * never spam the channel or double-post. First run with no cursor seeds to
 * the newest entry silently so enabling never floods the back-catalogue.
 */
export const DiscordSyncDriver: React.FC = () => {
  const { history } = useGame();
  const { storageKeyForActiveProfile: storageKey } = useProfiles();
  const busy = useRef(false);

  useEffect(() => {
    const cfg = readDiscordConfig(storageKey);
    if (!cfg.enabled || !isValidWebhookUrl(cfg.url)) return;
    if (history.length === 0) return;

    const newest = Math.max(...history.map((e) => e.timestamp));
    const cursor = readCursor(storageKey);
    if (cursor === 0) {
      writeCursor(storageKey, newest); // first sight — never flood old unlocks
      return;
    }

    const fresh = pickNewUnlocks(history, cursor);
    if (fresh.length === 0 || busy.current) return;

    busy.current = true;
    writeCursor(storageKey, newest);
    postEmbeds(cfg.url, fresh.map(unlockEmbed)).finally(() => {
      busy.current = false;
    });
  }, [history, storageKey]);

  return null;
};
