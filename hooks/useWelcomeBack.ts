import { useMemo, useState } from 'react';
import { useGame } from '../context/GameContext';
import { resolveModeRules } from '../config/gameModes';
import { lastSession, welcomeBackText } from '../utils/welcomeBack';
import { isRollEntry } from '../utils/logEntry';
import { welcomeBackPref } from '../utils/viewerPrefs';

const DISMISS_KEY = 'fate_welcome_back_dismissed_v1';

const readDismissed = (): string | null => {
  try { return localStorage.getItem(DISMISS_KEY); } catch { return null; }
};

/**
 * The welcome-back note after 12 hours or more away: the last session's rolls,
 * Keys and unlocks, and Fate to the next Pity Key. It goes once the player
 * dismisses it or does anything that adds to the run's history.
 */
export const useWelcomeBack = (): { text: string; dismiss: () => void } | null => {
  const on = welcomeBackPref.use();
  const { history, fatePoints, gameModeId, customMode } = useGame();
  // "Away" is measured from when the page opened, so the note doesn't come and go while it's open.
  const [openedAt] = useState(() => Date.now());
  const [dismissed, setDismissed] = useState(readDismissed);
  const session = useMemo(() => {
    if (!on) return null;
    // Only what came before this visit counts; once the player rolls or unlocks
    // something now, they're back in it and the note goes.
    let end = history.length;
    while (end > 0 && history[end - 1].timestamp >= openedAt) {
      const e = history[end - 1];
      if (isRollEntry(e) || e.type === 'UNLOCK') return null;
      end--;
    }
    return lastSession(end === history.length ? history : history.slice(0, end), openedAt);
  }, [on, history, openedAt]);
  if (!session || session.lastId === dismissed) return null;
  const rules = resolveModeRules(gameModeId, customMode);
  const pityLeft = rules.pityEnabled ? rules.pityThreshold - fatePoints : undefined;
  return {
    text: welcomeBackText(session, pityLeft),
    dismiss: () => {
      setDismissed(session.lastId);
      try { localStorage.setItem(DISMISS_KEY, session.lastId); } catch { /* lasts this page only */ }
    },
  };
};
