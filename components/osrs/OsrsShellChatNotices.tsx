import { useEffect, useMemo, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { resolveModeRules } from '../../config/gameModes';
import { relaySync } from '../../services/relaySync';
import { getRollInboxStore } from '../../services/rollInboxRuntime';
import { isRollEntry } from '../../utils/logEntry';
import type { LogEntry } from '../../types';
import { useWelcomeBack } from '../../hooks/useWelcomeBack';

/**
 * Game messages the OSRS chatbox pins under the log, in place of the classic
 * layout's strip under the header:
 *   - the welcome-back note after a break (hooks/useWelcomeBack.ts)
 *   - the coach hint (CoachStrip: the one next step, its button, its dismiss)
 * Same rules, same storage keys and same actions as that strip, so a hint
 * dismissed in one layout stays dismissed in the other.
 */

export interface OsrsChatNoticeAction { label: string; run: () => void; title?: string }
export interface OsrsChatNotice { id: string; text: string; actions: OsrsChatNoticeAction[] }

// CoachStrip's storage keys (shared on purpose).
const DISMISS_KEY = 'fate_coach_dismissed_v1';
const TOUR_DONE_KEY = 'fate_tour_done_v1';

const nav = (target: string) => window.dispatchEvent(new CustomEvent('fate:nav', { detail: { target } }));

export const useOsrsChatNotices = (): OsrsChatNotice[] => {
  const { keys, fatePoints, history, runId, gameModeId, customMode } = useGame() as {
    keys: number; fatePoints: number; history: LogEntry[]; runId: string; gameModeId?: string; customMode?: unknown;
  };

  // ── Coach hint (CoachStrip) ──
  const [dismissed, setDismissed] = useState<string | null>(() => {
    try { return localStorage.getItem(DISMISS_KEY); } catch { return null; }
  });
  const [tourDone, setTourDone] = useState<boolean>(() => {
    try { return localStorage.getItem(TOUR_DONE_KEY) === '1'; } catch { return false; }
  });
  const inboxStore = useMemo(() => getRollInboxStore(runId), [runId]);
  const countPending = () => inboxStore.list().filter(row =>
    row.state !== 'COMPLETED' && row.state !== 'DISMISSED' && row.state !== 'DUPLICATE').length;
  const [pendingCount, setPendingCount] = useState(countPending);
  useEffect(() => {
    setPendingCount(countPending());
    return inboxStore.subscribe(() => setPendingCount(countPending()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inboxStore]);
  const [, forceRelay] = useState(0);
  useEffect(() => relaySync.subscribe(() => forceRelay(n => n + 1)), []);

  const hint = useMemo((): { id: string; text: string; cta: string; act: () => void } | null => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rules = resolveModeRules(gameModeId as any, customMode as any);
    const hasRolled = history.some(isRollEntry);
    if (!hasRolled && !tourDone) {
      return {
        id: 'tour', text: 'New here? Take the short tour to see where everything is.', cta: 'Show me around',
        act: () => {
          try { localStorage.setItem(TOUR_DONE_KEY, '1'); } catch { /* ignore */ }
          setTourDone(true);
          window.dispatchEvent(new CustomEvent('fate:start-tour'));
        },
      };
    }
    if (keys > 0) {
      return {
        id: 'spend', text: `You have ${keys} Key${keys > 1 ? 's' : ''}. Spend ${keys > 1 ? 'them' : 'it'} to unlock something at random.`,
        cta: 'Spend Keys', act: () => nav('ctrl:SPEND'),
      };
    }
    if (pendingCount > 0) {
      return {
        id: 'roll-inbox', text: `${pendingCount} event${pendingCount > 1 ? 's' : ''} from RuneLite ${pendingCount > 1 ? 'are' : 'is'} waiting in your Roll Inbox.`,
        cta: 'Open Roll Inbox', act: () => nav('tab:AUTOROLL'),
      };
    }
    if (rules.pityEnabled && fatePoints >= rules.pityThreshold * 0.8) {
      const left = rules.pityThreshold - fatePoints;
      return {
        id: 'pity', text: `${left} Fate Point${left === 1 ? '' : 's'} from a guaranteed Pity Key. Failed rolls count toward it.`,
        cta: 'Farm Keys: harder rolls pay more Fate', act: () => nav('ctrl:FARM'),
      };
    }
    if (!hasRolled) {
      return {
        id: 'farm', text: 'Finish something in game (a Slayer task, a quest, a clue), then click its card to roll for a Key.',
        cta: 'Farm Keys', act: () => nav('ctrl:FARM'),
      };
    }
    return null;
  }, [keys, fatePoints, history, gameModeId, customMode, pendingCount, tourDone]);

  const welcome = useWelcomeBack();
  const notices: OsrsChatNotice[] = [];
  if (welcome) {
    notices.push({
      id: 'welcome-back',
      text: welcome.text,
      actions: [{ label: 'Dismiss', title: 'Hide this until your next break', run: welcome.dismiss }],
    });
  }
  if (hint && hint.id !== dismissed) {
    notices.push({
      id: `coach-${hint.id}`,
      text: hint.text,
      actions: [
        { label: hint.cta, run: hint.act },
        {
          label: 'Dismiss',
          title: 'Hide this hint until there is a different one',
          run: () => {
            setDismissed(hint.id);
            try { localStorage.setItem(DISMISS_KEY, hint.id); } catch { /* ignore */ }
          },
        },
      ],
    });
  }
  return notices;
};
