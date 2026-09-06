import { useEffect, useMemo, useRef } from 'react';
import { useGame } from '../context/GameContext';
import { getRollInboxStore } from '../services/rollInboxRuntime';
import type { RollInboxRow } from '../services/rollInboxStore';
import type { EventClassification, GameState } from '../types';
import {
  classifyFateEvent,
  classifyFateEventCandidate,
} from '../utils/fateEventEligibility';

const TERMINAL = new Set(['COMPLETED', 'DISMISSED', 'DUPLICATE']);
const CONFIRMED_PREFIX = 'candidate:';

export function classifyRollInboxDriverRow(row: RollInboxRow, state: GameState): EventClassification {
  const event = row.event;
  if (row.state === 'READY' && row.reason?.startsWith(CONFIRMED_PREFIX)) {
    return classifyFateEventCandidate(
      event,
      state,
      row.reason.slice(CONFIRMED_PREFIX.length),
    );
  }
  return classifyFateEvent(event, state);
}

export function RollInboxDriver() {
  const game = useGame();
  const store = useMemo(() => getRollInboxStore(game.runId), [game.runId]);
  const stateRef = useRef<GameState>(game);
  stateRef.current = game;

  useEffect(() => {
    // Current RuneLite builds keep observations local and only read the
    // app-authored profile from the relay. Retain classification for rows
    // migrated from older browser sessions, but never poll or acknowledge the
    // legacy /events and /acks resources.
    const current = stateRef.current;
    for (const row of store.list()) {
      if (TERMINAL.has(row.state)) continue;
      const classification = classifyRollInboxDriverRow(row, current);
      if (classification.state === 'READY') {
        store.transition(row.event.eventId, 'READY', row.reason);
      } else {
        store.transition(row.event.eventId, classification.state, classification.reason);
      }
    }
  }, [game.runRevision, game.linkedAccount, store]);

  return null;
}

export default RollInboxDriver;
