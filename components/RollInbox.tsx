import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Inbox,
  ShieldAlert,
  X,
} from 'lucide-react';
import { useGame } from '../context/GameContext';
import { RUNELITE_TERMS } from '../data/runeliteTerms';
import { DetectorPlaytestExport } from './DetectorPlaytestExport';
import type { EventAcknowledgement } from '../services/fateEventProtocol';
import {
  type RollInboxRow,
  type RollInboxStore,
} from '../services/rollInboxStore';
import { getRollInboxStore } from '../services/rollInboxRuntime';
import type {
  DetectedEventIdentity,
  DetectedProgress,
  EventClassification,
  GameEventMeta,
  GameState,
} from '../types';
import {
  classifyFateEvent,
  classifyFateEventCandidate,
} from '../utils/fateEventEligibility';
import { parsePastedEvents, pasteSummary } from '../utils/runelitePaste';
import { petById, type Pet } from '../data/pets';
import { PetPicker } from './PetPicker';

export interface RollInboxGame {
  state: GameState;
  acceptDetectedEvent: (
    progress: DetectedProgress,
    intent: Extract<EventClassification, { state: 'READY' }>['intent'],
    meta: GameEventMeta,
    expected: DetectedEventIdentity,
  ) => boolean;
}

interface RollInboxViewProps {
  store: RollInboxStore;
  game: RollInboxGame;
  acknowledge?: (items: EventAcknowledgement[]) => Promise<boolean>;
}

const TERMINAL = new Set(['COMPLETED', 'DISMISSED', 'DUPLICATE']);
/** RuneLite can't tell which pet dropped, so a pet starts with no choice made for the player. */
const mustChoose = (row: RollInboxRow) => row.event.eventType === 'PET_DROP';
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

const timeLabel = (timestamp: number): string =>
  new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp);

const sourceLabel = (classification: EventClassification, row: RollInboxRow) =>
  classification.state === 'READY'
    ? classification.intent.source
    : row.event.eventType.replaceAll('_', ' ');

// Module scope keeps the row's component type stable. Declared inside the
// view, every render remounted every row, dropping focus from the review
// select and closing it whenever a relay event re-rendered the list.
const RowFrame = ({
  row,
  classification,
  children,
  tone,
  account,
}: {
  row: RollInboxRow;
  classification: EventClassification;
  children: React.ReactNode;
  tone: string;
  /** Whose event it is, shown when the run is linked to no one. */
  account?: string;
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
          {account && <span className="shrink-0 text-[10px] text-gray-400">{account}</span>}
          <span className="ml-auto shrink-0 text-[10px] text-gray-600">
            {timeLabel(row.event.occurredAt)}
          </span>
        </div>
        {children}
      </div>
    </div>
  </div>
);

function terminalAck(
  eventId: string,
  state: EventAcknowledgement['state'],
): EventAcknowledgement {
  return { eventId, state, acknowledgedAt: Date.now() };
}

/**
 * Current RuneLite builds keep detections local and never read the legacy
 * /acks resource (docs/online-relay.md), so by default a decision stays in
 * this browser's inbox. A caller can still pass fateEventRelay.acknowledge.
 */
const keepAcknowledgementLocal = async (): Promise<boolean> => false;

export function RollInboxView({
  store,
  game,
  acknowledge = keepAcknowledgementLocal,
}: RollInboxViewProps) {
  const [, refresh] = useState(0);
  const [selection, setSelection] = useState<Record<string, string>>({});
  // A pet's claim waits for the player to check the pet: each pet counts once.
  const [confirmingPet, setConfirmingPet] = useState<string | null>(null);
  const [pasting, setPasting] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteNote, setPasteNote] = useState<string | null>(null);
  const rolling = useRef(new Set<string>());

  useEffect(() => store.subscribe(() => refresh((value) => value + 1)), [store]);

  const allRows = store.list();
  const active = allRows.filter((row) => !TERMINAL.has(row.state));
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
    const accepted = game.acceptDetectedEvent(
      classification.progress,
      classification.intent,
      {
        fateEventId: row.event.eventId,
        detectorId: row.event.detectorId,
        detectorVersion: row.event.detectorVersion,
      },
      {
        runId: row.event.runId,
        account: row.event.account,
        runRevision: row.event.runRevision,
      },
    );
    if (!accepted) {
      rolling.current.delete(row.event.eventId);
      return;
    }
    store.transition(row.event.eventId, 'COMPLETED');
    void acknowledge([terminalAck(row.event.eventId, 'COMPLETED')]);
  };

  // A run linked to no one takes any character's events (plan decision 9), so each row says whose.
  const whose = (row: RollInboxRow) => (game.state.linkedAccount ? undefined : row.event.account);

  /** RuneLite's copy, added to the inbox: nothing rolls until the player says so. */
  const takePaste = (text: string): boolean => {
    const pasted = parsePastedEvents(text);
    if (!pasted) {
      setPasteNote(`That isn’t a copy from RuneLite. In its Roll inbox card, choose ${RUNELITE_TERMS.COPY_FOR_TRACKER} first.`);
      return false;
    }
    const added = store.ingest(pasted.events);
    const characters = game.state.linkedAccount
      ? []
      : [...new Set(pasted.events.map((event) => event.account))];
    setPasteNote(pasteSummary(pasted, added, characters));
    setPasting(false);
    setPasteText('');
    return true;
  };

  const pasteFromRuneLite = async () => {
    try {
      if (takePaste(await navigator.clipboard.readText())) return;
    } catch {
      // The browser won't read the clipboard here: a box to paste into instead.
      setPasteNote(null);
    }
    setPasting(true);
  };

  const review = (row: RollInboxRow, classification: EventClassification) => {
    if (classification.state !== 'NEEDS_CONFIRMATION') return;
    const target = selection[row.event.eventId]
      ?? (mustChoose(row) ? undefined : classification.candidates?.[0]?.target);
    if (!target) return;
    const originalTarget = classification.candidates?.[0]?.target;
    store.transition(
      row.event.eventId,
      'READY',
      `${CONFIRMED_PREFIX}${target}`,
      target === originalTarget ? 'CONFIRMED_UNCHANGED' : 'CORRECTED',
    );
  };

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
        <span className="ml-auto text-[10px] text-gray-500">Kept in this browser</span>
        <button
          type="button"
          onClick={() => void pasteFromRuneLite()}
          className="rounded-md bg-fuchsia-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-fuchsia-500"
        >
          {RUNELITE_TERMS.PASTE_FROM_RUNELITE}
        </button>
        <DetectorPlaytestExport inbox={allRows} history={game.state.history} />
      </div>

      {pasteNote && <p role="status" className="mb-2 text-[11px] text-fuchsia-100/80">{pasteNote}</p>}
      {pasting && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            takePaste(pasteText);
          }}
          className="mb-3 space-y-1.5"
        >
          <label htmlFor="runelite-paste" className="block text-[11px] text-gray-400">
            Paste RuneLite’s copy here
          </label>
          <textarea
            id="runelite-paste"
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-white/10 bg-black/70 px-2 py-1.5 font-mono text-[11px] text-gray-200"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!pasteText.trim()}
              className="rounded-md bg-fuchsia-600 px-2.5 py-1.5 text-[11px] font-bold text-white enabled:hover:bg-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => {
                setPasting(false);
                setPasteText('');
              }}
              className="rounded-md px-2 py-1.5 text-[11px] text-gray-400 hover:bg-white/5 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {active.length === 0 ? (
        <p className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-[11px] text-gray-500">
          In RuneLite, open the Roll inbox card and choose {RUNELITE_TERMS.COPY_FOR_TRACKER}, then paste here.
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-[10px] text-gray-500">Skip any you’ve already logged by hand.</p>
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
                  account={whose(row)}
                  tone="border-emerald-500/25 bg-emerald-500/[0.06]"
                >
                  {classification.progress.kind === 'PET' && confirmingPet === row.event.eventId ? (
                    <div role="group" aria-label="Check your pet" className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="text-[11px] text-gray-300">
                        Claim an Omni-Key for {petById(classification.progress.petId)?.name ?? 'this pet'}? Each pet counts
                        once, so check it’s the one you got.
                      </span>
                      <button
                        type="button"
                        onClick={() => { setConfirmingPet(null); roll(row, classification); }}
                        className="ml-auto rounded-md bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-500"
                      >
                        Yes, I got {petById(classification.progress.petId)?.name ?? 'it'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingPet(null)}
                        className="rounded-md px-2 py-1.5 text-[11px] text-gray-400 hover:bg-white/5 hover:text-white"
                      >
                        Back
                      </button>
                    </div>
                  ) : (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[11px] text-gray-500">
                      {classification.state === 'READY' && (classification.progress.kind === 'PET'
                        ? 'An Omni-Key, once per pet'
                        : `${classification.intent.threshold}% chance`)}
                    </span>
                    <button
                      type="button"
                      onClick={() => (classification.progress.kind === 'PET'
                        ? setConfirmingPet(row.event.eventId)
                        : roll(row, classification))}
                      className="ml-auto rounded-md bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-500"
                    >
                      {classification.state === 'READY' && classification.progress.kind === 'PET' ? 'Claim' : 'Roll'}
                    </button>
                    <button
                      type="button"
                      onClick={() => dismiss(row, 'Marked not eligible by player.')}
                      className="rounded-md px-2 py-1.5 text-[11px] text-gray-400 hover:bg-white/5 hover:text-white"
                    >
                      Not eligible
                    </button>
                  </div>
                  )}
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
                  account={whose(row)}
                  tone="border-amber-500/25 bg-amber-500/[0.05]"
                >
                  <p className="mt-1 text-[11px] text-amber-200/80">{classification.reason}</p>
                  <div className="mt-2 flex items-center gap-2">
                    {classification.candidates?.length && mustChoose(row) ? (
                      <div className="min-w-0 flex-1">
                        <PetPicker
                          label="The pet you got"
                          pets={classification.candidates
                            .map((candidate) => petById(Number(candidate.target)))
                            .filter((pet): pet is Pet => pet !== undefined)}
                          value={selection[row.event.eventId] ?? ''}
                          onChange={(value) => setSelection((current) => ({ ...current, [row.event.eventId]: value }))}
                        />
                      </div>
                    ) : classification.candidates?.length ? (
                      <select
                        aria-label={mustChoose(row) ? 'The pet you got' : undefined}
                        value={selection[row.event.eventId] ?? (mustChoose(row) ? '' : classification.candidates[0].target)}
                        onChange={(e) => setSelection((current) => ({
                          ...current,
                          [row.event.eventId]: e.target.value,
                        }))}
                        className="min-w-0 flex-1 rounded-md border border-white/10 bg-black/70 px-2 py-1.5 text-[11px] text-gray-200"
                      >
                        {mustChoose(row) && <option value="" disabled>Choose the pet you got…</option>}
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
                      disabled={!classification.candidates?.length || (mustChoose(row) && !selection[row.event.eventId])}
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
                  account={whose(row)}
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

  return (
    <RollInboxView
      store={store}
      game={{ state: game, acceptDetectedEvent: game.acceptDetectedEvent }}
    />
  );
}

export default RollInbox;
