import { MAX_RECOVERED_PROFILES, isStorageSafeProfileId, sanitizeProfileName } from './profileMetadata';
import { parseAndMigrateSave } from './saveSchema';
import type { GameState } from '../types';

/**
 * The address move (critique SAVE-1 and SEC-1): the tracker leaves the shared
 * nubles.github.io for an address of its own, and players' runs, which live in
 * the old address's browser storage, are handed across with postMessage.
 *
 * 1. The old address opens the new one in a tab (`?move-in`).
 * 2. The new tab asks its opener for the runs: a `request` with a fresh nonce,
 *    posted only to the old origin.
 * 3. The old address answers only a request from the exact new origin, from
 *    the window it opened, with an `offer` that echoes the nonce.
 * 4. The new tab accepts only an offer from the exact old origin and its own
 *    opener, with its nonce. It checks every save with the normal save
 *    validation, never replaces a run it already has, and imports the runs the
 *    player keeps. The first load of each one goes through the normal startup
 *    recovery (components/SaveBootstrap.tsx), which journals it.
 * 5. It posts a `result` back; the old address records which runs moved. It
 *    never deletes them.
 *
 * Secrets stay behind: an offer carries only each profile's id, name, creation
 * time and save. Discord webhooks, relay write tokens, the RuneLite pairing,
 * the online backup code and the Discord progress link are set up again on the
 * new address. A save never holds them (see the workflow skill's rule).
 */
export const MOVE_PROTOCOL = 'fate-locked-move';
export const MOVE_PROTOCOL_VERSION = 1;
export const MAX_MOVE_PROFILES = MAX_RECOVERED_PROFILES;
const NONCE = /^[A-Za-z0-9-]{16,64}$/;
const MAX_NAME_CHARS = 200;

export interface MoveProfile {
  id: string;
  name: string;
  createdAt: number;
  /** The profile that was open on the old address. */
  active: boolean;
  /** The save as stored: the JSON the tracker writes for a run. */
  data: string;
}

/** Why the old address could not send a profile. */
export type MoveSkipReason = 'needs_recovery' | 'unsupported' | 'unreadable' | 'empty';

export interface MoveSkipped {
  id: string;
  name: string;
  reason: MoveSkipReason;
}

export interface MoveRequest {
  protocol: typeof MOVE_PROTOCOL;
  version: typeof MOVE_PROTOCOL_VERSION;
  kind: 'request';
  nonce: string;
}

export interface MoveOffer {
  protocol: typeof MOVE_PROTOCOL;
  version: typeof MOVE_PROTOCOL_VERSION;
  kind: 'offer';
  nonce: string;
  sentAt: number;
  profiles: MoveProfile[];
  skipped: MoveSkipped[];
}

export type MoveOutcomeKind = 'moved' | 'already_there' | 'kept_both' | 'skipped' | 'failed';

export interface MoveOutcome {
  sourceId: string;
  outcome: MoveOutcomeKind;
}

export interface MoveResult {
  protocol: typeof MOVE_PROTOCOL;
  version: typeof MOVE_PROTOCOL_VERSION;
  kind: 'result';
  nonce: string;
  outcomes: MoveOutcome[];
}

/** A message as a window received it. `fromExpectedWindow`: event.source is the window this side trusts. */
export interface ReceivedMessage {
  origin: string;
  data: unknown;
  fromExpectedWindow: boolean;
}

export type MoveRejection = 'wrong_origin' | 'wrong_window' | 'malformed' | 'wrong_nonce';
export type Accepted<T> = { ok: true; value: T } | { ok: false; reason: MoveRejection };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isEnvelope = (value: unknown, kind: string): value is Record<string, unknown> =>
  isRecord(value)
  && value.protocol === MOVE_PROTOCOL
  && value.version === MOVE_PROTOCOL_VERSION
  && value.kind === kind
  && typeof value.nonce === 'string'
  && NONCE.test(value.nonce);

/** Origin and window first: a message from anywhere else is not read at all. */
const checkSender = (message: ReceivedMessage, expectedOrigin: string): MoveRejection | null => {
  if (message.origin !== expectedOrigin) return 'wrong_origin';
  return message.fromExpectedWindow ? null : 'wrong_window';
};

export const newMoveNonce = (randomUUID: () => string = () => crypto.randomUUID()): string => randomUUID();

export const buildMoveRequest = (nonce: string): MoveRequest => ({
  protocol: MOVE_PROTOCOL, version: MOVE_PROTOCOL_VERSION, kind: 'request', nonce,
});

/** Old address: a request counts only from the exact new origin and the tab it opened. */
export const acceptMoveRequest = (message: ReceivedMessage, newOrigin: string): Accepted<MoveRequest> => {
  const sender = checkSender(message, newOrigin);
  if (sender !== null) return { ok: false, reason: sender };
  if (!isEnvelope(message.data, 'request')) return { ok: false, reason: 'malformed' };
  return { ok: true, value: buildMoveRequest(message.data.nonce as string) };
};

export const buildMoveOffer = (
  nonce: string,
  profiles: MoveProfile[],
  skipped: MoveSkipped[],
  sentAt: number,
): MoveOffer => ({
  protocol: MOVE_PROTOCOL, version: MOVE_PROTOCOL_VERSION, kind: 'offer', nonce, sentAt, profiles, skipped,
});

const parseProfiles = (value: unknown): MoveProfile[] | null => {
  if (!Array.isArray(value) || value.length > MAX_MOVE_PROFILES) return null;
  const profiles: MoveProfile[] = [];
  const ids = new Set<string>();
  for (const entry of value) {
    if (!isRecord(entry)) return null;
    const { id, name, createdAt, active, data } = entry;
    if (
      typeof id !== 'string' || !isStorageSafeProfileId(id) || ids.has(id)
      || typeof name !== 'string' || name.length > MAX_NAME_CHARS
      || typeof createdAt !== 'number' || !Number.isSafeInteger(createdAt) || createdAt < 0
      || typeof active !== 'boolean'
      || typeof data !== 'string'
    ) return null;
    ids.add(id);
    profiles.push({ id, name: sanitizeProfileName(name), createdAt, active, data });
  }
  return profiles;
};

const SKIP_REASONS = new Set<MoveSkipReason>(['needs_recovery', 'unsupported', 'unreadable', 'empty']);

const parseSkipped = (value: unknown): MoveSkipped[] | null => {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_MOVE_PROFILES) return null;
  const skipped: MoveSkipped[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) return null;
    const { id, name, reason } = entry;
    if (
      typeof id !== 'string' || !isStorageSafeProfileId(id)
      || typeof name !== 'string' || name.length > MAX_NAME_CHARS
      || typeof reason !== 'string' || !SKIP_REASONS.has(reason as MoveSkipReason)
    ) return null;
    skipped.push({ id, name: sanitizeProfileName(name), reason: reason as MoveSkipReason });
  }
  return skipped;
};

const parseOfferBody = (data: Record<string, unknown>, nonce: string): MoveOffer | null => {
  const profiles = parseProfiles(data.profiles);
  const skipped = parseSkipped(data.skipped);
  const sentAt = data.sentAt;
  if (profiles === null || skipped === null || typeof sentAt !== 'number' || !Number.isSafeInteger(sentAt)) return null;
  return buildMoveOffer(nonce, profiles, skipped, sentAt);
};

/** New address: an offer counts only from the exact old origin, its own opener, and its own nonce. */
export const acceptMoveOffer = (
  message: ReceivedMessage,
  oldOrigin: string,
  expectedNonce: string,
): Accepted<MoveOffer> => {
  const sender = checkSender(message, oldOrigin);
  if (sender !== null) return { ok: false, reason: sender };
  if (!isEnvelope(message.data, 'offer')) return { ok: false, reason: 'malformed' };
  if (message.data.nonce !== expectedNonce) return { ok: false, reason: 'wrong_nonce' };
  const offer = parseOfferBody(message.data, expectedNonce);
  return offer === null ? { ok: false, reason: 'malformed' } : { ok: true, value: offer };
};

export const buildMoveResult = (nonce: string, outcomes: MoveOutcome[]): MoveResult => ({
  protocol: MOVE_PROTOCOL, version: MOVE_PROTOCOL_VERSION, kind: 'result', nonce, outcomes,
});

const OUTCOMES = new Set<MoveOutcomeKind>(['moved', 'already_there', 'kept_both', 'skipped', 'failed']);

/** Old address: the result counts only from the new origin, the tab it opened, and the nonce it answered. */
export const acceptMoveResult = (
  message: ReceivedMessage,
  newOrigin: string,
  expectedNonce: string | null,
): Accepted<MoveResult> => {
  const sender = checkSender(message, newOrigin);
  if (sender !== null) return { ok: false, reason: sender };
  if (!isEnvelope(message.data, 'result')) return { ok: false, reason: 'malformed' };
  if (expectedNonce === null || message.data.nonce !== expectedNonce) return { ok: false, reason: 'wrong_nonce' };
  const raw = message.data.outcomes;
  if (!Array.isArray(raw) || raw.length > MAX_MOVE_PROFILES) return { ok: false, reason: 'malformed' };
  const outcomes: MoveOutcome[] = [];
  for (const entry of raw) {
    if (
      !isRecord(entry) || typeof entry.sourceId !== 'string' || !isStorageSafeProfileId(entry.sourceId)
      || typeof entry.outcome !== 'string' || !OUTCOMES.has(entry.outcome as MoveOutcomeKind)
    ) return { ok: false, reason: 'malformed' };
    outcomes.push({ sourceId: entry.sourceId, outcome: entry.outcome as MoveOutcomeKind });
  }
  return { ok: true, value: buildMoveResult(expectedNonce, outcomes) };
};

// --- The safety-net file -----------------------------------------------------

export const MOVE_BACKUP_KIND = 'all-runs-backup';

/**
 * Every run on this address as one JSON file, offered before the move. The
 * new address's move screen reads it too, so it is also the way across when
 * the two tabs can't talk (another browser, a blocked pop-up).
 */
export const moveBackupFile = (profiles: MoveProfile[], skipped: MoveSkipped[], exportedAt: number): string =>
  JSON.stringify({
    protocol: MOVE_PROTOCOL,
    version: MOVE_PROTOCOL_VERSION,
    kind: MOVE_BACKUP_KIND,
    exportedAt,
    profiles,
    skipped,
  });

export const moveBackupFileName = (exportedAt: number): string =>
  `fate_locked_all_runs_${new Date(exportedAt).toISOString().slice(0, 10)}.json`;

/** Reads a backup file as an offer (no nonce: nothing is posted back). Null when it isn't one. */
export const parseMoveBackupFile = (text: string): MoveOffer | null => {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (
    !isRecord(data) || data.protocol !== MOVE_PROTOCOL || data.version !== MOVE_PROTOCOL_VERSION
    || data.kind !== MOVE_BACKUP_KIND || typeof data.exportedAt !== 'number'
  ) return null;
  return parseOfferBody({ ...data, sentAt: data.exportedAt }, 'backup-file-no-reply');
};

// --- Planning the import on the new address ------------------------------------

export type MovedSaveSummary =
  | { ok: true; runId: string; entries: number; gameModeId: string | null; lastPlayedAt: number | null }
  | { ok: false; message: string };

/** The normal save validation (utils/saveSchema.ts), plus what the review list shows. */
export const summarizeMovedSave = (data: string, defaults: GameState): MovedSaveSummary => {
  const parsed = parseAndMigrateSave(data, defaults);
  if (parsed.ok === false) return { ok: false, message: parsed.message };
  const history = parsed.state.history;
  const lastPlayedAt = history.reduce<number | null>(
    (latest, entry) => (latest === null || entry.timestamp > latest ? entry.timestamp : latest),
    null,
  );
  return {
    ok: true,
    runId: parsed.state.runId,
    entries: history.length,
    gameModeId: parsed.state.gameModeId ?? null,
    lastPlayedAt,
  };
};

/** A run already on the new address. */
export interface ExistingRun {
  profileId: string;
  name: string;
  runId: string | null;
}

/** import: add it. copy: add it beside the same run already here. skip: leave it on the old address. */
export type MoveChoice = 'import' | 'copy' | 'skip';

export type MovePlanItem =
  | { source: MoveProfile; status: 'new'; summary: Extract<MovedSaveSummary, { ok: true }>; choices: MoveChoice[]; choice: MoveChoice }
  | {
    source: MoveProfile;
    status: 'duplicate';
    summary: Extract<MovedSaveSummary, { ok: true }>;
    /** Where the same run already is: a profile here, or an earlier one in this move. */
    duplicateOf: { name: string; incoming: boolean };
    choices: MoveChoice[];
    choice: MoveChoice;
  }
  | { source: MoveProfile; status: 'invalid'; message: string; choices: MoveChoice[]; choice: MoveChoice };

/** The player's pick for one run; a pick the item doesn't offer (replacing a run, importing a broken save) is ignored. */
export const chooseMove = (item: MovePlanItem, choice: MoveChoice): MovePlanItem =>
  (item.choices.includes(choice) ? { ...item, choice } : item);

/**
 * What each incoming run would do. A run the new address already has (same
 * run id) is skipped unless the player asks for a copy: the move never
 * replaces a run that is there.
 */
export const planMoveImport = (
  offer: Pick<MoveOffer, 'profiles'>,
  existing: readonly ExistingRun[],
  summarize: (data: string) => MovedSaveSummary,
): MovePlanItem[] => {
  const here = new Map<string, string>();
  for (const run of existing) if (run.runId !== null && !here.has(run.runId)) here.set(run.runId, run.name);
  const incoming = new Map<string, string>();
  return offer.profiles.map((source): MovePlanItem => {
    const summary = summarize(source.data);
    if (summary.ok === false) return { source, status: 'invalid', message: summary.message, choices: ['skip'], choice: 'skip' };
    const existingName = here.get(summary.runId);
    const incomingName = incoming.get(summary.runId);
    if (existingName !== undefined || incomingName !== undefined) {
      return {
        source,
        status: 'duplicate',
        summary,
        duplicateOf: existingName !== undefined
          ? { name: existingName, incoming: false }
          : { name: incomingName as string, incoming: true },
        choices: ['skip', 'copy'],
        choice: 'skip',
      };
    }
    incoming.set(summary.runId, source.name);
    return { source, status: 'new', summary, choices: ['import', 'skip'], choice: 'import' };
  });
};

/** The outcome of a plan item the player chose to leave behind. */
export const unmovedOutcome = (item: MovePlanItem): MoveOutcomeKind => {
  if (item.status === 'invalid') return 'failed';
  return item.status === 'duplicate' && !item.duplicateOf.incoming ? 'already_there' : 'skipped';
};

/** The name a copy gets beside the run already there. */
export const copyName = (name: string): string => sanitizeProfileName(`${name.slice(0, 22)} (moved)`);

// --- The record the old address keeps ------------------------------------------

export interface MovedRecord {
  version: 1;
  updatedAt: number;
  /** Every run this address had at the last move is on the new address. */
  allMoved: boolean;
  profiles: Record<string, { outcome: MoveOutcomeKind; at: number }>;
}

const DONE = new Set<MoveOutcomeKind>(['moved', 'already_there', 'kept_both']);
export const isMovedOutcome = (outcome: MoveOutcomeKind): boolean => DONE.has(outcome);

export const parseMovedRecord = (raw: string | null): MovedRecord | null => {
  if (raw === null) return null;
  try {
    const data: unknown = JSON.parse(raw);
    if (!isRecord(data) || data.version !== 1 || !isRecord(data.profiles) || typeof data.updatedAt !== 'number') return null;
    const profiles: MovedRecord['profiles'] = {};
    for (const [id, entry] of Object.entries(data.profiles)) {
      if (
        isStorageSafeProfileId(id) && isRecord(entry) && typeof entry.at === 'number'
        && typeof entry.outcome === 'string' && OUTCOMES.has(entry.outcome as MoveOutcomeKind)
      ) profiles[id] = { outcome: entry.outcome as MoveOutcomeKind, at: entry.at };
    }
    return { version: 1, updatedAt: data.updatedAt, allMoved: data.allMoved === true, profiles };
  } catch {
    return null;
  }
};

/**
 * Folds a result into the record. A successful outcome is never downgraded by
 * a later skip (moving twice finds the run already there), and only profiles
 * this address offered are recorded. `currentProfileIds` are every profile
 * this address has now, sent or not.
 */
export const recordMoveResult = (
  previous: MovedRecord | null,
  result: MoveResult,
  offeredIds: ReadonlySet<string>,
  currentProfileIds: readonly string[],
  now: number,
): MovedRecord => {
  const profiles = { ...(previous?.profiles ?? {}) };
  for (const { sourceId, outcome } of result.outcomes) {
    if (!offeredIds.has(sourceId)) continue;
    const before = profiles[sourceId];
    if (before !== undefined && isMovedOutcome(before.outcome) && !isMovedOutcome(outcome)) continue;
    profiles[sourceId] = { outcome, at: now };
  }
  const allMoved = currentProfileIds.length > 0
    && currentProfileIds.every(id => profiles[id] !== undefined && isMovedOutcome(profiles[id].outcome));
  return { version: 1, updatedAt: now, allMoved, profiles };
};
