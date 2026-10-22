import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRightLeft, Check, FileUp } from 'lucide-react';
import { createFreshState } from '../context/GameContext';
import { getGameMode } from '../config/gameModes';
import { NEW_TRACKER_URL, OLD_TRACKER_URL } from '../config/trackerAddress';
import { trackerOrigin } from '../utils/moveRole';
import {
  acceptMoveOffer,
  buildMoveRequest,
  buildMoveResult,
  chooseMove,
  newMoveNonce,
  parseMoveBackupFile,
  planMoveImport,
  summarizeMovedSave,
  type MoveChoice,
  type MoveOffer,
  type MoveOutcome,
  type MovePlanItem,
  type MoveSkipReason,
} from '../utils/originMove';
import { applyMovePlan, readExistingRuns } from '../utils/originMoveStorage';
import type { ProfileTransactionDependencies } from '../utils/profileMetadataTransaction';
import { parseAndMigrateSave } from '../utils/saveSchema';
import { openRecoveryDatabase } from '../utils/recoveryDatabase';

/**
 * The new address's half of the move (utils/originMove.ts), shown instead of
 * the tracker at `?move-in`. It asks the old address that opened it for the
 * runs, or reads the all-runs backup file, lets the player choose, and adds
 * the chosen runs without touching any run already here.
 */

const OLD_ORIGIN = trackerOrigin(OLD_TRACKER_URL) ?? '';
const REQUEST_EVERY_MS = 1_500;
const GIVE_UP_AFTER_MS = 10_000;

const SKIP_TEXT: Record<MoveSkipReason, string> = {
  needs_recovery: 'Not sent: open it on the old address and choose which save to keep, then move again.',
  unsupported: 'Not sent: saved by a newer version of the tracker.',
  unreadable: 'Not sent: its save could not be read.',
  empty: 'No run yet.',
};

const OUTCOME_TEXT: Record<MoveOutcome['outcome'], string> = {
  moved: 'Moved',
  kept_both: 'Moved as a second copy',
  already_there: 'Already here',
  skipped: 'Left on the old address',
  failed: 'Not moved',
};

const CHOICE_TEXT: Record<MoveChoice, string> = {
  import: 'Move',
  copy: 'Keep both',
  skip: 'Leave it',
};

type Phase =
  | { kind: 'asking' }
  | { kind: 'file'; note: string | null }
  | { kind: 'review'; offer: MoveOffer; viaMessage: boolean; items: MovePlanItem[] }
  | { kind: 'moving' }
  | { kind: 'done'; items: MovePlanItem[]; outcomes: MoveOutcome[]; skipped: MoveOffer['skipped'] };

const browserProfileDependencies = (): ProfileTransactionDependencies => ({
  storage: window.localStorage,
  ownerId: crypto.randomUUID(),
  now: Date.now,
  wait: milliseconds => new Promise(resolve => window.setTimeout(resolve, milliseconds)),
  validateGameSave: raw => parseAndMigrateSave(raw, createFreshState()).ok,
  createProfileId: () => crypto.randomUUID(),
  ...(typeof indexedDB === 'undefined' ? {} : { openRecoveryRepository: () => openRecoveryDatabase() }),
});

const summarize = (data: string) => summarizeMovedSave(data, createFreshState());
const runIdOf = (data: string): string | null => {
  const summary = summarize(data);
  return summary.ok ? summary.runId : null;
};

const planFor = (offer: MoveOffer): MovePlanItem[] => {
  let storage: Pick<Storage, 'getItem'>;
  try {
    storage = window.localStorage;
  } catch {
    return planMoveImport(offer, [], summarize);
  }
  return planMoveImport(offer, readExistingRuns(storage, runIdOf), summarize);
};

const describe = (item: MovePlanItem): string => {
  if (item.status === 'invalid') return `Can't be moved: ${item.message}`;
  const { entries, gameModeId, lastPlayedAt } = item.summary;
  const parts = [
    getGameMode(gameModeId ?? undefined).name,
    `${entries.toLocaleString()} ${entries === 1 ? 'entry' : 'entries'}`,
    lastPlayedAt === null ? null : `last played ${new Date(lastPlayedAt).toLocaleDateString()}`,
  ].filter((part): part is string => part !== null);
  const line = parts.join(' · ');
  if (item.status !== 'duplicate') return line;
  return item.duplicateOf.incoming
    ? `${line}. The same run as ${item.duplicateOf.name} above.`
    : `${line}. Already here as ${item.duplicateOf.name}.`;
};

export const MoveInScreen: React.FC = () => {
  const [phase, setPhase] = useState<Phase>(() => (
    window.opener ? { kind: 'asking' } : { kind: 'file', note: null }
  ));
  const nonceRef = useRef<string>(newMoveNonce());
  const fileRef = useRef<HTMLInputElement>(null);

  // Ask the opener for the runs until it answers. Only an offer from exactly
  // the old origin, from this tab's opener, with this tab's nonce is read.
  useEffect(() => {
    if (phase.kind !== 'asking') return;
    const opener = window.opener as Window | null;
    if (opener === null) return;
    const nonce = nonceRef.current;
    const onMessage = (event: MessageEvent) => {
      const accepted = acceptMoveOffer(
        { origin: event.origin, data: event.data, fromExpectedWindow: event.source === opener },
        OLD_ORIGIN,
        nonce,
      );
      if (!accepted.ok) return;
      setPhase({ kind: 'review', offer: accepted.value, viaMessage: true, items: planFor(accepted.value) });
    };
    window.addEventListener('message', onMessage);
    const ask = () => {
      try {
        // A target origin: the browser drops this unless the opener is on the old address.
        opener.postMessage(buildMoveRequest(nonce), OLD_ORIGIN);
      } catch {
        // The opener closed; the timer below falls back to the file.
      }
    };
    ask();
    const repeat = window.setInterval(ask, REQUEST_EVERY_MS);
    const giveUp = window.setTimeout(() => {
      setPhase(current => (current.kind === 'asking'
        ? { kind: 'file', note: "The old address didn't answer. Go back to it and press Move again, or choose your backup file below." }
        : current));
    }, GIVE_UP_AFTER_MS);
    return () => {
      window.removeEventListener('message', onMessage);
      window.clearInterval(repeat);
      window.clearTimeout(giveUp);
    };
  }, [phase.kind]);

  const readFile = useCallback((file: File) => {
    file.text().then(text => {
      const offer = parseMoveBackupFile(text);
      if (offer === null) {
        setPhase({ kind: 'file', note: "That isn't an all-runs backup file. It is named fate_locked_all_runs_….json." });
        return;
      }
      setPhase({ kind: 'review', offer, viaMessage: false, items: planFor(offer) });
    }).catch(() => setPhase({ kind: 'file', note: 'That file could not be read.' }));
  }, []);

  const choose = useCallback((index: number, choice: MoveChoice) => {
    setPhase(current => (current.kind === 'review'
      ? { ...current, items: current.items.map((item, at) => (at === index ? chooseMove(item, choice) : item)) }
      : current));
  }, []);

  const move = useCallback(async () => {
    if (phase.kind !== 'review') return;
    const { items, offer, viaMessage } = phase;
    setPhase({ kind: 'moving' });
    let outcomes: MoveOutcome[];
    try {
      outcomes = await applyMovePlan(browserProfileDependencies(), items);
    } catch {
      outcomes = items.map(item => ({ sourceId: item.source.id, outcome: 'failed' as const }));
    }
    if (viaMessage) {
      try {
        (window.opener as Window | null)?.postMessage(buildMoveResult(offer.nonce, outcomes), OLD_ORIGIN);
      } catch {
        // The old tab closed: its runs are simply not marked as moved there.
      }
    }
    setPhase({ kind: 'done', items, outcomes, skipped: offer.skipped });
  }, [phase]);

  const toMove = phase.kind === 'review' ? phase.items.filter(item => item.choice !== 'skip' && item.status !== 'invalid').length : 0;

  return (
    <main className="min-h-screen bg-[#141414] text-gray-300 flex justify-center p-4 text-[13px]">
      <section className="w-full max-w-xl mt-6 sm:mt-16 bg-[#1c1c1c] border border-white/15 rounded-xl shadow-2xl p-5 h-fit" aria-labelledby="move-in-title">
        <h1 id="move-in-title" className="text-sm font-black uppercase tracking-wider text-gray-100 flex items-center gap-2 mb-3">
          <ArrowRightLeft size={15} className="text-amber-400" aria-hidden="true" /> Bring your runs to the new address
        </h1>

        {phase.kind === 'asking' && <p role="status">Asking the old address for your runs…</p>}

        {phase.kind === 'file' && (
          <div>
            {phase.note !== null && <p role="alert" className="text-amber-300 mb-3">{phase.note}</p>}
            <p className="mb-3">
              Open the tracker at its old address, then Settings, then <b className="text-gray-100">Move to the new address</b>.
              Or, if you downloaded the backup of all runs, choose that file here.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={event => {
                const file = event.target.files?.[0];
                if (file) readFile(file);
                event.target.value = '';
              }}
            />
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 border border-white/15 text-gray-100 hover:bg-white/15">
                <FileUp size={13} aria-hidden="true" /> Choose the backup file
              </button>
              <a href={NEW_TRACKER_URL} className="px-3 py-1.5 rounded-lg border border-white/15 text-gray-400 hover:text-white">Go to the tracker</a>
            </div>
          </div>
        )}

        {phase.kind === 'review' && (
          <div>
            <p className="mb-3">Choose what to bring. A run that is already here is never written over.</p>
            <ul className="space-y-2 mb-4" aria-label="Runs to move">
              {phase.items.map((item, index) => (
                <li key={item.source.id} className="border border-white/10 rounded-lg p-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-gray-100 font-bold">{item.source.name}</span>
                    {item.source.active && <span className="text-[10px] uppercase tracking-wider text-amber-300">open</span>}
                    <span className="ml-auto flex gap-1" role="radiogroup" aria-label={`${item.source.name}: what to do`}>
                      {item.choices.map(choice => (
                        <button
                          key={choice}
                          type="button"
                          role="radio"
                          aria-checked={item.choice === choice}
                          onClick={() => choose(index, choice)}
                          className={`px-2 py-0.5 rounded border text-[11px] ${item.choice === choice ? 'bg-amber-500 text-black border-amber-500 font-bold' : 'border-white/15 text-gray-400 hover:text-white'}`}
                        >
                          {CHOICE_TEXT[choice]}
                        </button>
                      ))}
                    </span>
                  </div>
                  <p className={`text-[11px] mt-1 ${item.status === 'invalid' ? 'text-red-300' : item.status === 'duplicate' ? 'text-amber-300/90' : 'text-gray-500'}`}>
                    {describe(item)}
                  </p>
                </li>
              ))}
              {phase.offer.skipped.map(skipped => (
                <li key={skipped.id} className="border border-white/10 rounded-lg p-2.5">
                  <span className="text-gray-100 font-bold">{skipped.name}</span>
                  <p className="text-[11px] mt-1 text-amber-300/90">{SKIP_TEXT[skipped.reason]}</p>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => { void move(); }}
              disabled={toMove === 0}
              className="px-3 py-1.5 rounded-lg bg-amber-500 text-black font-bold hover:bg-amber-400 disabled:opacity-50"
            >
              {toMove === 0 ? 'Nothing to move' : toMove === 1 ? 'Move 1 run' : `Move ${toMove} runs`}
            </button>
          </div>
        )}

        {phase.kind === 'moving' && <p role="status">Moving your runs…</p>}

        {phase.kind === 'done' && (
          <div>
            <ul className="space-y-1.5 mb-4" aria-label="What moved">
              {phase.items.map((item, index) => {
                const outcome = phase.outcomes[index]?.outcome ?? 'failed';
                const ok = outcome === 'moved' || outcome === 'kept_both' || outcome === 'already_there';
                return (
                  <li key={item.source.id} className="flex items-center gap-2">
                    {ok ? <Check size={13} className="text-emerald-400 shrink-0" aria-hidden="true" /> : <span className="w-[13px] shrink-0" />}
                    <span className="text-gray-100">{item.source.name}</span>
                    <span className={`ml-auto text-[11px] ${ok ? 'text-gray-400' : 'text-amber-300'}`}>{OUTCOME_TEXT[outcome]}</span>
                  </li>
                );
              })}
            </ul>
            <p className="mb-3">
              The old address keeps its copy. Set these up again here when you need them: online backup, Discord
              notifications and the Discord link, and the RuneLite connection.
            </p>
            <a href={NEW_TRACKER_URL} className="inline-block px-3 py-1.5 rounded-lg bg-amber-500 text-black font-bold hover:bg-amber-400">
              Open the tracker
            </a>
          </div>
        )}
      </section>
    </main>
  );
};

export default MoveInScreen;
