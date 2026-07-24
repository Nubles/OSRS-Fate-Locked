import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../context/GameContext';
import { fateEventRelay } from '../services/fateEventRelay';
import type { EventAcknowledgement } from '../services/fateEventProtocol';
import { getRollInboxStore } from '../services/rollInboxRuntime';
import type { RollInboxRow } from '../services/rollInboxStore';
import { relaySync } from '../services/relaySync';
import type { EventClassification, GameState } from '../types';
import {
  classifyFateEvent,
  classifyFateEventCandidate,
} from '../utils/fateEventEligibility';

const POLL_MS = 5_000;
const TERMINAL = new Set(['COMPLETED', 'DISMISSED', 'DUPLICATE']);
const CONFIRMED_PREFIX = 'candidate:';

function classifyRow(row: RollInboxRow, state: GameState): EventClassification {
  const event = row.state === 'READY'
    ? { ...row.event, runRevision: state.runRevision }
    : row.event;
  if (row.state === 'READY' && row.reason?.startsWith(CONFIRMED_PREFIX)) {
    return classifyFateEventCandidate(
      event,
      state,
      row.reason.slice(CONFIRMED_PREFIX.length),
    );
  }
  return classifyFateEvent(event, state);
}

function acknowledgementFor(row: RollInboxRow): EventAcknowledgement | null {
  if (row.state !== 'COMPLETED' && row.state !== 'DISMISSED' && row.state !== 'DUPLICATE') {
    return null;
  }
  return {
    eventId: row.event.eventId,
    state: row.state,
    acknowledgedAt: row.updatedAt,
  };
}

export function RollInboxDriver() {
  const game = useGame();
  const store = useMemo(() => getRollInboxStore(game.runId), [game.runId]);
  const stateRef = useRef<GameState>(game);
  stateRef.current = game;
  const running = useRef(false);
  const [, relayRevision] = useState(0);

  useEffect(() => relaySync.subscribe(() => relayRevision((value) => value + 1)), []);

  const processRows = useCallback(async (fetchFresh: boolean) => {
    if (running.current) return;
    running.current = true;
    try {
      if (fetchFresh) store.ingest(await fateEventRelay.fetchEvents());
      const current = stateRef.current;
      for (const row of store.list()) {
        if (TERMINAL.has(row.state)) continue;
        const classification = classifyRow(row, current);
        if (classification.state === 'READY') {
          game.reconcileDetectedProgress(classification.progress);
          store.transition(row.event.eventId, 'READY', row.reason);
        } else {
          store.transition(row.event.eventId, classification.state, classification.reason);
        }
      }

      const acknowledgements = store.list()
        .map(acknowledgementFor)
        .filter((item): item is EventAcknowledgement => item !== null);
      if (acknowledgements.length > 0) {
        await fateEventRelay.acknowledge(acknowledgements);
      }
    } finally {
      running.current = false;
    }
  }, [game.reconcileDetectedProgress, store]);

  useEffect(() => {
    void processRows(false);
  }, [game.runRevision, game.linkedAccount, processRows]);

  useEffect(() => {
    if (!relaySync.enabled) return;
    void processRows(true);
    const timer = window.setInterval(() => void processRows(true), POLL_MS);
    return () => window.clearInterval(timer);
  }, [relaySync.enabled, processRows]);

  return null;
}

export default RollInboxDriver;
