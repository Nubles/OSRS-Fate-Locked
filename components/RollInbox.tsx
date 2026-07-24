import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Inbox,
  Radio,
  ShieldAlert,
  X,
} from 'lucide-react';
import { useGame } from '../context/GameContext';
import { fateEventRelay } from '../services/fateEventRelay';
import type { EventAcknowledgement } from '../services/fateEventProtocol';
import {
  type RollInboxRow,
  type RollInboxStore,
} from '../services/rollInboxStore';
import { getRollInboxStore } from '../services/rollInboxRuntime';
import { relaySync } from '../services/relaySync';
import type {
  DetectedProgress,
  EventClassification,
  GameEventMeta,
  GameState,
} from '../types';
import {
  classifyFateEvent,
  classifyFateEventCandidate,
} from '../utils/fateEventEligibility';

export interface RollInboxGame {
  state: GameState;
  rollForKey: (
    source: string,
    threshold: number,
    x?: number,
    y?: number,
    meta?: GameEventMeta,
  ) => void;
  reconcileDetectedProgress: (progress: DetectedProgress) => void;
}

interface RollInboxViewProps {
  store: RollInboxStore;
  game: RollInboxGame;
  acknowledge?: (items: EventAcknowledgement[]) => Promise<boolean>;
  connected?: boolean;
}

const TERMINAL = new Set(['COMPLETED', 'DISMISSED', 'DUPLICATE']);
const CONFIRMED_PREFIX = 'candidate:';

type ClassifiedRow = { row: RollInboxRow; classification: EventClassification };
type ClassificationState = EventClassification['state'];

function inState<S extends ClassificationState>(state: S) {
  return (item: ClassifiedRow): item is ClassifiedRow & {
    classification: Extract<EventClassification, { state: S }>;
  } => item.classification.state === state;
}

function classificationFor(
  row: RollInboxRow,
  state: GameState,
): EventClassification {
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

const timeLabel = (timestamp: number): string =>
  new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp);

function terminalAck(
  eventId: string,
  state: EventAcknowledgement['state'],
): EventAcknowledgement {
  return { eventId, state, acknowledgedAt: Date.now() };
}

export function RollInboxView({
  store,
  game,
  acknowledge = (items) => fateEventRelay.acknowledge(items),
  connected = relaySync.enabled,
}: RollInboxViewProps) {
  const [, refresh] = useState(0);
  const [selection, setSelection] = useState<Record<string, string>>({});
  const rolling = useRef(new Set<string>());

  useEffect(() => store.subscribe(() => refresh((value) => value + 1)), [store]);

  const active = store.list().filter((row) => !TERMINAL.has(row.state));
  const classified = useMemo(
    () => active.map((row) => ({
      row,
      classification: classificationFor(row, game.state),
    })),
    [active, game.state],
  );

  const groups = {
    READY: classified.filter(inState('READY')),
    NEEDS_CONFIRMATION: classified.filter(inState('NEEDS_CONFIRMATION')),
    BLOCKED: classified.filter(inState('BLOCKED')),
    DUPLICATE: classified.filter(inState('DUPLICATE')),
  };

  const dismiss = (
    row: RollInboxRow,
    reason: string,
    ackState: EventAcknowledgement['state'] = 'DISMISSED',
  ) => {
    const nextState = ackState === 'DUPLICATE' ? 'DUPLICATE' : 'DISMISSED';
    if (!store.transition(row.event.eventId, nextState, reason)) return;
    void acknowledge([terminalAck(row.event.eventId, ackState)]);
  };

  const roll = (row: RollInboxRow, classification: EventClassification) => {
    if (classification.state !== 'READY' || rolling.current.has(row.event.eventId)) return;
    rolling.current.add(row.event.eventId);
    game.reconcileDetectedProgress(classification.progress);
    game.rollForKey(
      classification.intent.source,
      classification.intent.threshold,
      undefined,
      undefined,
      {
        fateEventId: row.event.eventId,
        detectorId: row.event.detectorId,
        detectorVersion: row.event.detectorVersion,
      },
    );
    store.transition(row.event.eventId, 'COMPLETED');
    void acknowledge([terminalAck(row.event.eventId, 'COMPLETED')]);
  };

  const review = (row: RollInboxRow, classification: EventClassification) => {
    if (classification.state !== 'NEEDS_CONFIRMATION') return;
    const target = selection[row.event.eventId]
      ?? classification.candidates?.[0]?.target;
    if (!target) return;
    store.transition(row.event.eventId, 'READY', `${CONFIRMED_PREFIX}${target}`);
  };

  const sourceLabel = (classification: EventClassification, row: RollInboxRow) =>
    classification.state === 'READY'
      ? classification.intent.source
      : row.event.eventType.replaceAll('_', ' ');

  const RowFrame = ({
    row,
    classification,
    children,
    tone,
  }: {
    row: RollInboxRow;
    classification: EventClassification;
    children: React.ReactNode;
    tone: string;
  }) => (
    <div className={`rounded-lg border px-3 py-2.5 ${tone}`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-fuchsia-300">
              {sourceLabel(classification, row)}
            </span>
            <span className="truncate text-sm font-semibold text-gray-100">
              {row.event.canonicalLabel ?? 'Needs identification'}
            </span>
            <span className="ml-auto shrink-0 text-[10px] text-gray-600">
              {timeLabel(row.event.occurredAt)}
            </span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );

  return (
    <section className="rounded-xl border border-white/10 bg-black/25 p-3 shadow-lg">
      <div className="mb-3 flex items-center gap-2">
        <Inbox size={15} className="text-fuchsia-400" />
        <h3 className="text-xs font-bold uppercase tracking-wide text-gray-100">Roll Inbox</h3>
        {active.length > 0 && (
          <span className="rounded-full bg-fuchsia-500/20 px-1.5 py-0.5 text-[10px] font-bold text-fuchsia-200">
            {active.length}
          </span>
        )}
        <span className={`ml-auto flex items-center gap-1 text-[10px] ${connected ? 'text-emerald-400' : 'text-gray-500'}`}>
          <Radio size={10} />
          {connected ? 'Listening' : 'Offline · inbox kept locally'}
        </span>
      </div>

      {active.length === 0 ? (
        <p className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-[11px] text-gray-500">
          No detected rolls waiting. RuneLite events will queue here for you to decide.
        </p>
      ) : (
        <div className="space-y-3">
          {groups.READY.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-400">
                <CheckCircle2 size={11} /> Ready
              </div>
              {groups.READY.map(({ row, classification }) => (
                <RowFrame
                  key={row.event.eventId}
                  row={row}
                  classification={classification}
                  tone="border-emerald-500/25 bg-emerald-500/[0.06]"
                >
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[11px] text-gray-500">
                      {classification.state === 'READY' && `${classification.intent.threshold}% chance`}
                    </span>
                    <button
                      type="button"
                      onClick={() => roll(row, classification)}
                      className="ml-auto rounded-md bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-500"
                    >
                      Roll
                    </button>
                    <button
                      type="button"
                      onClick={() => dismiss(row, 'Marked not eligible by player.')}
                      className="rounded-md px-2 py-1.5 text-[11px] text-gray-400 hover:bg-white/5 hover:text-white"
                    >
                      Not eligible
                    </button>
                  </div>
                </RowFrame>
              ))}
            </div>
          )}

          {groups.NEEDS_CONFIRMATION.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-400">
                <HelpCircle size={11} /> Needs review
              </div>
              {groups.NEEDS_CONFIRMATION.map(({ row, classification }) => (
                <RowFrame
                  key={row.event.eventId}
                  row={row}
                  classification={classification}
                  tone="border-amber-500/25 bg-amber-500/[0.05]"
                >
                  <p className="mt-1 text-[11px] text-amber-200/80">{classification.reason}</p>
                  <div className="mt-2 flex items-center gap-2">
                    {classification.candidates?.length ? (
                      <select
                        value={selection[row.event.eventId] ?? classification.candidates[0].target}
                        onChange={(e) => setSelection((current) => ({
                          ...current,
                          [row.event.eventId]: e.target.value,
                        }))}
                        className="min-w-0 flex-1 rounded-md border border-white/10 bg-black/70 px-2 py-1.5 text-[11px] text-gray-200"
                      >
                        {classification.candidates.map((candidate) => (
                          <option key={candidate.target} value={candidate.target}>
                            {candidate.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="flex-1 text-[10px] text-gray-600">No safe match found</span>
                    )}
                    <button
                      type="button"
                      disabled={!classification.candidates?.length}
                      onClick={() => review(row, classification)}
                      className="rounded-md bg-amber-600 px-2.5 py-1.5 text-[11px] font-bold text-white enabled:hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Review
                    </button>
                    <button
                      type="button"
                      onClick={() => dismiss(row, 'Dismissed after review.')}
                      aria-label="Dismiss"
                      className="rounded p-1.5 text-gray-500 hover:bg-white/5 hover:text-white"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </RowFrame>
              ))}
            </div>
          )}

          {groups.BLOCKED.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-red-400">
                <ShieldAlert size={11} /> Blocked
              </div>
              {groups.BLOCKED.map(({ row, classification }) => (
                <RowFrame
                  key={row.event.eventId}
                  row={row}
                  classification={classification}
                  tone="border-red-500/20 bg-red-500/[0.04]"
                >
                  <div className="mt-1 flex items-center gap-2">
                    <p className="flex-1 text-[11px] text-red-200/75">{classification.reason}</p>
                    <button
                      type="button"
                      onClick={() => dismiss(row, classification.reason)}
                      className="rounded-md px-2 py-1 text-[11px] text-gray-400 hover:bg-white/5 hover:text-white"
                    >
                      Dismiss
                    </button>
                  </div>
                </RowFrame>
              ))}
            </div>
          )}

          {groups.DUPLICATE.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-sky-500/20 bg-sky-500/[0.04] px-3 py-2">
              <AlertCircle size={13} className="text-sky-400" />
              <span className="text-[11px] text-sky-100/75">
                {groups.DUPLICATE.length} already handled {groups.DUPLICATE.length === 1 ? 'event' : 'events'}
              </span>
              <button
                type="button"
                onClick={() => groups.DUPLICATE.forEach(({ row }) =>
                  dismiss(row, 'Already recorded in roll history.', 'DUPLICATE'))}
                className="ml-auto rounded-md px-2 py-1 text-[11px] font-semibold text-sky-300 hover:bg-sky-500/10"
              >
                Dismiss duplicate events
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export function RollInbox() {
  const game = useGame();
  const store = useMemo(
    () => getRollInboxStore(game.runId),
    [game.runId],
  );
  const [, relayRevision] = useState(0);
  useEffect(() => relaySync.subscribe(() => relayRevision((value) => value + 1)), []);

  return (
    <RollInboxView
      store={store}
      game={{ state: game, rollForKey: game.rollForKey, reconcileDetectedProgress: game.reconcileDetectedProgress }}
      connected={relaySync.enabled}
    />
  );
}

export default RollInbox;
