import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRightLeft, Check, Download, ExternalLink, X } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useProfiles } from '../context/ProfileContext';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { NEW_TRACKER_URL } from '../config/trackerAddress';
import { MOVED_RECORD_KEY, trackerOrigin } from '../utils/moveRole';
import {
  acceptMoveRequest,
  acceptMoveResult,
  buildMoveOffer,
  isMovedOutcome,
  moveBackupFile,
  moveBackupFileName,
  parseMovedRecord,
  recordMoveResult,
  type MovedRecord,
  type MoveProfile,
  type MoveSkipped,
  type MoveSkipReason,
} from '../utils/originMove';
import { collectMoveProfiles } from '../utils/originMoveStorage';
import { productionSaveBootstrapDependencies } from './SaveBootstrap';

/**
 * The old address's half of the move (utils/originMove.ts): a one-time banner
 * and the Settings dialog that hands every run to the new address. Mounted
 * only on the old address once NEW_TRACKER_URL is set. Nothing here deletes
 * or changes a run; it only records which runs reached the new address.
 */

const BANNER_KEY = 'fate_move_banner_v1';
const NEW_ORIGIN = trackerOrigin(NEW_TRACKER_URL) ?? '';
/** How players read the new address: "fatelocked.github.io". */
export const NEW_ADDRESS_LABEL = NEW_TRACKER_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');

const read = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string): void => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Only the banner's memory or the moved marks are lost; no run is affected.
  }
};

const SKIP_TEXT: Record<MoveSkipReason, string> = {
  needs_recovery: 'Open this profile here first and choose which save to keep, then move again.',
  unsupported: 'Saved by a newer version of the tracker. Open it on the new address instead.',
  unreadable: 'Its save could not be read in this browser.',
  empty: 'No run yet. Nothing to move.',
};

type Phase =
  | { kind: 'collecting' }
  | { kind: 'ready' }
  | { kind: 'opened' }
  | { kind: 'blocked' }
  | { kind: 'sent' }
  | { kind: 'done'; moved: number; total: number };

interface Session {
  win: Window | null;
  nonce: string | null;
  profiles: MoveProfile[];
  skipped: MoveSkipped[];
  offeredIds: Set<string>;
}

const openMoveEvent = 'open:move-address';

export const MoveAddressDriver: React.FC = () => {
  const { profiles, activeProfileId } = useProfiles();
  const { getExportData } = useGame();
  const [open, setOpen] = useState(false);
  const [record, setRecord] = useState<MovedRecord | null>(() => parseMovedRecord(read(MOVED_RECORD_KEY)));
  const bannerState = record?.allMoved ? 'moved' : 'offer';
  const [bannerSeen, setBannerSeen] = useState(() => read(BANNER_KEY));
  const [phase, setPhase] = useState<Phase>({ kind: 'collecting' });
  const [collected, setCollected] = useState<{ profiles: MoveProfile[]; skipped: MoveSkipped[] } | null>(null);
  const [backedUp, setBackedUp] = useState(false);
  const [skipBackup, setSkipBackup] = useState(false);
  const sessionRef = useRef<Session | null>(null);
  const currentIdsRef = useRef<string[]>([]);
  currentIdsRef.current = profiles.map(profile => profile.id);

  const dismissBanner = useCallback(() => {
    write(BANNER_KEY, bannerState);
    setBannerSeen(bannerState);
  }, [bannerState]);

  // Settings → "Move to the new address" (both layouts) arrives as a fate:nav event.
  useEffect(() => {
    const onNav = (event: Event) => {
      if ((event as CustomEvent<{ target?: string }>).detail?.target === openMoveEvent) setOpen(true);
    };
    window.addEventListener('fate:nav', onNav);
    return () => window.removeEventListener('fate:nav', onNav);
  }, []);

  // Every time the dialog opens, read every run fresh.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setPhase({ kind: 'collecting' });
    setCollected(null);
    void collectMoveProfiles(profiles, activeProfileId, getExportData(), productionSaveBootstrapDependencies)
      .then(result => {
        if (cancelled) return;
        setCollected(result);
        setPhase({ kind: 'ready' });
      });
    return () => { cancelled = true; };
    // Read once per opening: the open run keeps saving while the dialog is up,
    // and the next opening reads it again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // The handshake. Only the tab this dialog opened, on exactly the new origin,
  // gets an answer; everything else is ignored without a reply.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const session = sessionRef.current;
      if (session === null || session.win === null) return;
      const message = { origin: event.origin, data: event.data, fromExpectedWindow: event.source === session.win };
      const request = acceptMoveRequest(message, NEW_ORIGIN);
      if (request.ok) {
        session.nonce = request.value.nonce;
        session.win.postMessage(buildMoveOffer(session.nonce, session.profiles, session.skipped, Date.now()), NEW_ORIGIN);
        setPhase(current => (current.kind === 'done' ? current : { kind: 'sent' }));
        return;
      }
      const result = acceptMoveResult(message, NEW_ORIGIN, session.nonce);
      if (!result.ok) return;
      const next = recordMoveResult(
        parseMovedRecord(read(MOVED_RECORD_KEY)),
        result.value,
        session.offeredIds,
        currentIdsRef.current,
        Date.now(),
      );
      write(MOVED_RECORD_KEY, JSON.stringify(next));
      setRecord(next);
      setPhase({
        kind: 'done',
        moved: result.value.outcomes.filter(outcome => isMovedOutcome(outcome.outcome)).length,
        total: session.profiles.length + session.skipped.length,
      });
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const downloadBackup = useCallback(() => {
    if (collected === null) return;
    const now = Date.now();
    const blob = new Blob([moveBackupFile(collected.profiles, collected.skipped, now)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    try {
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = moveBackupFileName(now);
      anchor.click();
      setBackedUp(true);
    } finally {
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    }
  }, [collected]);

  const openNewAddress = useCallback(() => {
    if (collected === null) return;
    // Opened from the click itself so pop-up blockers allow it, and without
    // noopener: the new tab needs this window to ask for the runs.
    const win = window.open(`${NEW_TRACKER_URL}?move-in=1`, 'fate-locked-move');
    sessionRef.current = {
      win,
      nonce: null,
      profiles: collected.profiles,
      skipped: collected.skipped,
      offeredIds: new Set(collected.profiles.map(profile => profile.id)),
    };
    setPhase(win === null ? { kind: 'blocked' } : { kind: 'opened' });
  }, [collected]);

  const close = useCallback(() => setOpen(false), []);
  useEscapeKey(close, open);

  const showBanner = !open && bannerSeen !== bannerState && !(bannerState === 'offer' && bannerSeen === 'moved');

  return (
    <>
      {showBanner && (
        <div
          role="region"
          aria-label="New address"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[95] w-[calc(100%-2rem)] max-w-lg bg-[#1c1c1c] border border-amber-500/40 rounded-xl shadow-2xl p-4 text-[13px] text-gray-200"
        >
          <div className="flex items-start gap-3">
            <ArrowRightLeft size={18} className="text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1">
              {bannerState === 'moved' ? (
                <p>Your runs are on the new address, <b>{NEW_ADDRESS_LABEL}</b>. Play there from now on.</p>
              ) : (
                <p>
                  Fate Locked has its own address now: <b>{NEW_ADDRESS_LABEL}</b>. Your runs are safer there.
                  Bring them along in one click. They stay here too.
                </p>
              )}
              <div className="flex flex-wrap gap-2 mt-3">
                {bannerState === 'moved' ? (
                  <a href={NEW_TRACKER_URL} className="px-3 py-1.5 rounded-lg bg-amber-500 text-black font-bold hover:bg-amber-400">
                    Open the new address
                  </a>
                ) : (
                  <button type="button" onClick={() => setOpen(true)} className="px-3 py-1.5 rounded-lg bg-amber-500 text-black font-bold hover:bg-amber-400">
                    Move my runs
                  </button>
                )}
                <button type="button" onClick={dismissBanner} className="px-3 py-1.5 rounded-lg border border-white/15 text-gray-300 hover:text-white">
                  Not now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={close}>
          <div
            className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-[#1c1c1c] border border-white/15 rounded-xl shadow-2xl p-5 text-[13px] text-gray-300"
            onClick={event => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="move-address-title"
          >
            <div className="flex items-center justify-between mb-3">
              <h2 id="move-address-title" className="text-sm font-black uppercase tracking-wider text-gray-100 flex items-center gap-2">
                <ArrowRightLeft size={15} className="text-amber-400" aria-hidden="true" /> Move to the new address
              </h2>
              <button type="button" onClick={close} className="text-gray-500 hover:text-white" aria-label="Close"><X size={16} /></button>
            </div>
            <p className="mb-3">
              Fate Locked now has its own address, <b className="text-gray-100">{NEW_ADDRESS_LABEL}</b>. Other sites
              share this one and can read and change what the tracker keeps in your browser. Moving copies every run
              across. Nothing here is deleted.
            </p>

            {collected === null ? (
              <p role="status" className="text-gray-500 mb-3">Reading your runs…</p>
            ) : (
              <ul className="mb-4 space-y-1.5" aria-label="Your runs">
                {collected.profiles.map(profile => {
                  const moved = record?.profiles[profile.id];
                  return (
                    <li key={profile.id} className="flex items-center gap-2">
                      {moved !== undefined && isMovedOutcome(moved.outcome)
                        ? <Check size={13} className="text-emerald-400 shrink-0" aria-label="Moved" />
                        : <span className="w-[13px] shrink-0" />}
                      <span className="text-gray-100">{profile.name}</span>
                      <span className="ml-auto text-[11px] text-gray-500">
                        {moved !== undefined && isMovedOutcome(moved.outcome)
                          ? `moved ${new Date(moved.at).toLocaleDateString()}`
                          : 'ready to move'}
                      </span>
                    </li>
                  );
                })}
                {collected.skipped.map(skipped => (
                  <li key={skipped.id} className="flex flex-col pl-[21px]">
                    <span className="text-gray-100">{skipped.name}</span>
                    <span className="text-[11px] text-amber-300/90">{SKIP_TEXT[skipped.reason]}</span>
                  </li>
                ))}
              </ul>
            )}

            <ol className="space-y-3">
              <li>
                <p className="mb-1.5"><b className="text-gray-100">1. Keep a copy first.</b> One file with every run, in case anything goes wrong. The new address can read it too.</p>
                <button
                  type="button"
                  onClick={downloadBackup}
                  disabled={collected === null}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 border border-white/15 text-gray-100 hover:bg-white/15 disabled:opacity-50"
                >
                  {backedUp ? <Check size={13} className="text-emerald-400" aria-hidden="true" /> : <Download size={13} aria-hidden="true" />}
                  {backedUp ? 'Backup downloaded' : 'Download a backup of all runs'}
                </button>
              </li>
              <li>
                <p className="mb-1.5"><b className="text-gray-100">2. Move.</b> The new address opens in a new tab and asks for your runs. You choose there which ones to bring.</p>
                <button
                  type="button"
                  onClick={openNewAddress}
                  disabled={collected === null || collected.profiles.length === 0 || !(backedUp || skipBackup)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500 text-black font-bold hover:bg-amber-400 disabled:opacity-50"
                >
                  <ExternalLink size={13} aria-hidden="true" /> Open the new address and move
                </button>
                {!backedUp && !skipBackup && collected !== null && collected.profiles.length > 0 && (
                  <button type="button" onClick={() => setSkipBackup(true)} className="mt-1.5 text-[11px] text-gray-500 underline hover:text-gray-300">
                    Move without a backup
                  </button>
                )}
              </li>
            </ol>

            <div role="status" aria-live="polite" className="mt-4 text-[12px]">
              {phase.kind === 'opened' && <p className="text-gray-400">Waiting for the new address to answer…</p>}
              {phase.kind === 'sent' && <p className="text-gray-400">Your runs are in the new tab. Choose what to bring there, then come back.</p>}
              {phase.kind === 'blocked' && (
                <p className="text-amber-300">
                  Your browser blocked the new tab. Allow pop-ups for this site and try again, or open{' '}
                  <a className="underline" href={`${NEW_TRACKER_URL}?move-in=1`} target="_blank" rel="noreferrer">{NEW_ADDRESS_LABEL}</a>{' '}
                  and choose the backup file there.
                </p>
              )}
              {phase.kind === 'done' && (
                <p className="text-emerald-300">
                  {phase.moved === phase.total
                    ? `Done: ${phase.moved === 1 ? 'your run is' : `all ${phase.moved} runs are`} on the new address.`
                    : `${phase.moved} of ${phase.total} runs are on the new address. The rest are still here.`}{' '}
                  They stay here too. Play on <a className="underline" href={NEW_TRACKER_URL}>{NEW_ADDRESS_LABEL}</a> from now on.
                </p>
              )}
            </div>
            <p className="mt-3 text-[11px] text-gray-500">
              Set up again on the new address: online backup, Discord notifications and Discord link, and the
              RuneLite connection. Those keys stay on this address on purpose.
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default MoveAddressDriver;
