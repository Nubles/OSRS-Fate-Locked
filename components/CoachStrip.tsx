import React, { useEffect, useMemo, useState } from 'react';
import { Lightbulb, ArrowRight, X } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { resolveModeRules } from '../config/gameModes';
import { relaySync } from '../services/relaySync';
import { getRollInboxStore } from '../services/rollInboxRuntime';
import { isRollEntry } from '../utils/logEntry';
import { LogEntry } from '../types';

/**
 * The coach strip: one contextual "here's your next step" line under the
 * header. The core loop (do a task in-game → roll its card → spend the key →
 * see what opened) spans three panels and nothing else connects them — this
 * reads the run state and points at the single most relevant next action.
 *
 * Deliberately quiet: renders nothing when there's no clear next step, and
 * dismissing a hint hides it until the situation changes to a DIFFERENT hint
 * (per-profile, persisted). Priority order matters — spendable keys beat
 * everything, because an unspent key is always the loop's next beat.
 */

interface Hint {
  id: string;
  text: string;
  cta: string;
  act: () => void;
}

const DISMISS_KEY = 'fate_coach_dismissed_v1';
const TOUR_DONE_KEY = 'fate_tour_done_v1';

const nav = (target: string) => window.dispatchEvent(new CustomEvent('fate:nav', { detail: { target } }));

export const CoachStrip: React.FC = () => {
  const { keys, fatePoints, history, runId, gameModeId, customMode } = useGame() as {
    keys: number; fatePoints: number; history: LogEntry[]; runId: string; gameModeId?: string; customMode?: any;
  };

  const [dismissed, setDismissed] = useState<string | null>(() => {
    try { return localStorage.getItem(DISMISS_KEY); } catch { return null; }
  });
  const [tourDone, setTourDone] = useState<boolean>(() => {
    try { return localStorage.getItem(TOUR_DONE_KEY) === '1'; } catch { return false; }
  });

  const inboxStore = useMemo(() => getRollInboxStore(runId), [runId]);
  const countPending = () => inboxStore.list().filter((row) =>
    row.state !== 'COMPLETED' && row.state !== 'DISMISSED' && row.state !== 'DUPLICATE').length;
  const [pendingCount, setPendingCount] = useState(countPending);
  useEffect(() => {
    setPendingCount(countPending());
    return inboxStore.subscribe(() => setPendingCount(countPending()));
  }, [inboxStore]);
  const [, forceRelay] = useState(0);
  useEffect(() => relaySync.subscribe(() => forceRelay((n) => n + 1)), []);

  const hint = useMemo((): Hint | null => {
    const rules = resolveModeRules(gameModeId, customMode);
    const hasRolled = history.some(isRollEntry);

    if (!hasRolled && !tourDone) {
      return {
        id: 'tour',
        text: 'New here? Everything has a place — take the 30-second tour.',
        cta: 'Show me around',
        act: () => {
          try { localStorage.setItem(TOUR_DONE_KEY, '1'); } catch { /* ignore */ }
          setTourDone(true);
          window.dispatchEvent(new CustomEvent('fate:start-tour'));
        },
      };
    }
    if (keys > 0) {
      return {
        id: 'spend',
        text: `You have ${keys} key${keys > 1 ? 's' : ''} — let Fate decide what ${keys > 1 ? 'they unlock' : 'it unlocks'}.`,
        cta: 'Spend Keys',
        act: () => nav('ctrl:SPEND'),
      };
    }
    if (pendingCount > 0) {
      return {
        id: 'roll-inbox',
        text: `${pendingCount} RuneLite detection${pendingCount > 1 ? 's are' : ' is'} waiting for your decision.`,
        cta: 'Open Roll Inbox',
        act: () => nav('tab:AUTOROLL'),
      };
    }
    if (rules.pityEnabled && fatePoints >= rules.pityThreshold * 0.8) {
      return {
        id: 'pity',
        text: `${rules.pityThreshold - fatePoints} fate point${rules.pityThreshold - fatePoints === 1 ? '' : 's'} from a guaranteed pity key — even failed rolls count.`,
        cta: 'Farm Keys',
        act: () => nav('ctrl:FARM'),
      };
    }
    if (!hasRolled) {
      return {
        id: 'farm',
        text: 'Complete a task in-game (a slayer task, a quest, a clue), then click its card to roll for a key.',
        cta: 'Farm Keys',
        act: () => nav('ctrl:FARM'),
      };
    }
    return null;
  }, [keys, fatePoints, history, gameModeId, customMode, pendingCount, tourDone]);

  if (!hint || hint.id === dismissed) return null;

  const dismiss = () => {
    setDismissed(hint.id);
    try { localStorage.setItem(DISMISS_KEY, hint.id); } catch { /* ignore */ }
  };

  return (
    <div className="max-w-[1600px] mx-auto px-4">
      <div className="flex items-center gap-2.5 px-3 py-2 mt-2 rounded-lg bg-amber-950/25 border border-amber-500/20 animate-in fade-in slide-in-from-top-1 duration-300">
        <Lightbulb size={13} className="text-amber-400 shrink-0" />
        <p className="text-[12px] text-amber-100/90 leading-snug flex-1 min-w-0">{hint.text}</p>
        <button
          onClick={hint.act}
          className="shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-md bg-amber-600/80 hover:bg-amber-500 text-white flex items-center gap-1 transition-colors"
        >
          {hint.cta} <ArrowRight size={11} />
        </button>
        <button onClick={dismiss} className="shrink-0 p-1 text-amber-200/50 hover:text-white rounded" aria-label="Dismiss hint">
          <X size={12} />
        </button>
      </div>
    </div>
  );
};

export default CoachStrip;
