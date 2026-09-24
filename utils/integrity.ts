import { LogEntry } from '../types';
import { CUSTOM_RULE_BOUNDS, type GameModeRules } from '../config/gameModes';

/** The ruleset a run was played under, recorded in the verified bundle. */
export interface RunMode {
  id: string;
  rules: GameModeRules;
}

// Non-crypto sync hash (FNV-1a 32-bit, hex). Fast enough to chain every
// dispatch. Good enough to catch casual edits; for published commitments
// we also expose SHA-256 via sha256Hex() which is async.
export const simpleHash = (s: string): string => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
};

// Canonical string form of an entry — excludes hash/prevHash so the hash
// covers everything else. Key order is forced so two equivalent entries
// hash the same regardless of construction order.
const canonicalize = (entry: LogEntry): string => {
  const { hash: _h, prevHash: _p, ...body } = entry;
  const keys = Object.keys(body).sort();
  const ordered: Record<string, unknown> = {};
  for (const k of keys) {
    const v = (body as any)[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const innerKeys = Object.keys(v).sort();
      const inner: Record<string, unknown> = {};
      for (const ik of innerKeys) inner[ik] = v[ik];
      ordered[k] = inner;
    } else {
      ordered[k] = v;
    }
  }
  return JSON.stringify(ordered);
};

const GENESIS = 'GENESIS';

export const hashEntry = (entry: LogEntry, prevHash: string): string => {
  return simpleHash(prevHash + '|' + canonicalize(entry));
};

// Lazily fills in prevHash/hash for any entry missing them, without
// mutating inputs. Preserves any existing chain links so re-running is
// idempotent. Existing broken links are left as-is so verifyChain can
// flag them.
export const ensureChain = (history: LogEntry[]): LogEntry[] => {
  let needsRebuild = false;
  for (const e of history) {
    if (!e.hash) { needsRebuild = true; break; }
  }
  if (!needsRebuild) return history;

  const out: LogEntry[] = [];
  let prev = GENESIS;
  for (const e of history) {
    if (e.hash && e.prevHash) {
      out.push(e);
      prev = e.hash;
      continue;
    }
    const prevHash = e.prevHash ?? prev;
    const hash = e.hash ?? hashEntry(e, prevHash);
    const filled = { ...e, prevHash, hash };
    out.push(filled);
    prev = hash;
  }
  return out;
};

export interface ChainReport {
  ok: boolean;
  brokenAt: number[];
  firstBreak: number | null;
}

export const verifyChain = (history: LogEntry[]): ChainReport => {
  const brokenAt: number[] = [];
  let prev = GENESIS;
  for (let i = 0; i < history.length; i++) {
    const e = history[i];
    if (!e.hash || !e.prevHash) continue;
    if (e.prevHash !== prev) brokenAt.push(i);
    else if (hashEntry(e, e.prevHash) !== e.hash) brokenAt.push(i);
    prev = e.hash ?? prev;
  }
  return { ok: brokenAt.length === 0, brokenAt, firstBreak: brokenAt[0] ?? null };
};

// --- Invariant replay ---------------------------------------------------

export interface InvariantViolation {
  index: number;
  kind: 'KEYS_NEGATIVE' | 'SPECIAL_NEGATIVE' | 'CHAOS_NEGATIVE' | 'FATE_NEGATIVE' | 'FATE_OVERFLOW' | 'ROLL_OUT_OF_RANGE' | 'LEGACY_RITUAL_ESTIMATE';
  message: string;
}

export interface ReplayState {
  keys: number;
  specialKeys: number;
  chaosKeys: number;
  fatePoints: number;
  unlocks: number;
  rolls: number;
  successes: number;
  omnis: number;
  pities: number;
}

// Given the history alone, re-derive the running state and flag anything
// physically impossible (negative keys, fate over cap, roll outside 0.01-100.0).
// Doesn't prove the *roll values* are honest — a determined editor can
// rewrite consistently — but catches naive tampering and any inconsistency
// introduced by hand-editing isolated fields.
export const replayInvariants = (history: LogEntry[], startKeys = 3): { violations: InvariantViolation[]; final: ReplayState } => {
  const recordedFateAward = (entry: LogEntry): number => {
    const award = entry.meta?.fatePointsEarned;
    return typeof award === 'number' && Number.isFinite(award) && award >= 0
      ? award
      : 1;
  };
  const validPityThreshold = (value: unknown): number | null =>
    typeof value === 'number'
      && Number.isSafeInteger(value)
      && value >= CUSTOM_RULE_BOUNDS.pityThreshold.min
      && value <= CUSTOM_RULE_BOUNDS.pityThreshold.max
      ? value
      : null;
  const recordedPityThreshold = (entry: LogEntry): number =>
    validPityThreshold(entry.meta?.pityThreshold) ?? 50;
  const fateCap = history
    .filter(entry => entry.type === 'PITY')
    .map(entry => validPityThreshold(entry.meta?.pityThreshold))
    .find((threshold): threshold is number => threshold !== null) ?? 50;
  const detectedSkillChaosAward = (entry: LogEntry): number => {
    const award = entry.meta?.chaosKeysAwarded;
    return entry.meta?.detectorId === 'skill-level-v1'
      && typeof award === 'number'
      && Number.isSafeInteger(award)
      && award >= 0
      ? award
      : 0;
  };
  const s: ReplayState = {
    keys: startKeys,
    specialKeys: 0,
    chaosKeys: 0,
    fatePoints: 0,
    unlocks: 0,
    rolls: 0,
    successes: 0,
    omnis: 0,
    pities: 0,
  };
  const violations: InvariantViolation[] = [];
  let fateEstimate = false;
  const check = (idx: number) => {
    if (s.keys < 0) violations.push({ index: idx, kind: 'KEYS_NEGATIVE', message: `keys went negative (${s.keys})` });
    if (s.specialKeys < 0) violations.push({ index: idx, kind: 'SPECIAL_NEGATIVE', message: `specialKeys went negative` });
    if (s.chaosKeys < 0) violations.push({ index: idx, kind: 'CHAOS_NEGATIVE', message: `chaosKeys went negative` });
    if (!fateEstimate && s.fatePoints < 0) violations.push({ index: idx, kind: 'FATE_NEGATIVE', message: `fatePoints went negative` });
    if (!fateEstimate && s.fatePoints > fateCap) violations.push({ index: idx, kind: 'FATE_OVERFLOW', message: `fatePoints above cap (${s.fatePoints})` });
  };

  for (let i = 0; i < history.length; i++) {
    const e = history[i];
    if (e.rollValue !== undefined && (!Number.isFinite(e.rollValue) || e.rollValue < 0.01 || e.rollValue > 100)) {
      violations.push({
        index: i,
        kind: 'ROLL_OUT_OF_RANGE',
        message: `roll ${e.rollValue} out of 0.01-100.0`,
      });
    }
    switch (e.type) {
      case 'ROLL_OMNI':
        s.chaosKeys += detectedSkillChaosAward(e);
        s.specialKeys += 1;
        s.keys += 1;
        s.fatePoints = 0;
        fateEstimate = false;
        s.rolls += 1; s.successes += 1; s.omnis += 1;
        break;
      case 'ROLL_SUCCESS':
        s.chaosKeys += detectedSkillChaosAward(e);
        s.keys += (e.details && /\(Doubled\)/.test(e.message) ? 2 : 1);
        s.fatePoints = 0;
        fateEstimate = false;
        s.rolls += 1; s.successes += 1;
        break;
      case 'PITY':
        s.keys += 1;
        s.fatePoints = Math.max(0, s.fatePoints + recordedFateAward(e) - recordedPityThreshold(e));
        s.rolls += 1; s.pities += 1;
        break;
      case 'ROLL_FAIL':
        s.chaosKeys += detectedSkillChaosAward(e);
        s.fatePoints += recordedFateAward(e);
        s.rolls += 1;
        break;
      case 'UNLOCK': {
        const cost = typeof e.meta?.cost === 'number' ? e.meta.cost : 0;
        const costType = e.meta?.costType;
        if (costType === 'key') s.keys -= cost;
        else if (costType === 'specialKey') s.specialKeys -= 1;
        else if (costType === 'chaosKey') s.chaosKeys -= 1;
        s.unlocks += 1;
        break;
      }
      case 'ALTAR': {
        const amount = (key: string, fallback: number | (() => number)): number => {
          const value = e.meta?.[key];
          return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
            ? value : typeof fallback === 'function' ? fallback() : fallback;
        };
        // Old entries omitted the paid cost and custom multiplier. Do not rewrite
        // their hashes or certify an estimate as an exact balance. The historical
        // base prices changed in 46b0792 (2026-07-04); a stale client may differ.
        const legacyCost = (before: number, after: number): number => {
          if (typeof e.meta?.fateCost === 'number' && Number.isSafeInteger(e.meta.fateCost) && e.meta.fateCost >= 0) return e.meta.fateCost;
          fateEstimate = true;
          violations.push({ index: i, kind: 'LEGACY_RITUAL_ESTIMATE', message: 'Historical ritual did not record its paid cost; Fate balance is estimated until the next reset.' });
          return e.timestamp < Date.parse('2026-07-04T13:34:16Z') ? before : after;
        };
        const ritual = e.meta?.ritual;
        // Message matching is only for legacy entries without a recorded
        // ritual: a Cartographer entry naming "Chaos Temple" is not Chaos.
        const isRitual = (id: string, legacyMessage: RegExp): boolean =>
          typeof ritual === 'string' ? ritual === id : legacyMessage.test(e.message);
        if (isRitual('LUCK', /Clarity/)) s.fatePoints -= legacyCost(15, 8);
        else if (isRitual('GREED', /Greed/)) s.fatePoints -= legacyCost(30, 15);
        else if (isRitual('CHAOS', /Chaos/)) {
          s.fatePoints -= legacyCost(25, 25); s.chaosKeys += amount('chaosKeysAwarded', 1);
        } else if (isRitual('TRANSMUTE', /Transmut/)) {
          s.keys -= amount('keyCost', 5); s.specialKeys += amount('specialKeysAwarded', 1);
        } else if (isRitual('GAMBIT', /Void Gambit/)) {
          s.fatePoints = 0;
          fateEstimate = false;
          s.keys += amount('keysAwarded', Number(e.message.match(/WON.*?([0-9]+) Key/)?.[1] ?? 0));
        } else if (isRitual('CARTOGRAPHER', /Cartographer/)) {
          s.fatePoints -= amount('fateCost', () => Number(e.details?.match(/for ([0-9]+) Fate/)?.[1] ?? legacyCost(40, 40)));
          s.unlocks += 1;
        }
        break;
      }
      case 'LEVEL_UP': {
        const chaosAwarded = e.meta?.chaosKeysAwarded;
        if (typeof chaosAwarded === 'number'
          && Number.isSafeInteger(chaosAwarded)
          && chaosAwarded >= 0) {
          s.chaosKeys += chaosAwarded;
        } else if (/Chaos Key Drop/.test(e.message)) s.chaosKeys += 1;
        break;
      }
      case 'COMPENSATION': {
        const choice = e.meta?.choice;
        if (choice === 'chaos' || choice === 'full') {
          const chaosAwarded = e.meta?.chaosKeysAwarded;
          if (typeof chaosAwarded === 'number'
            && Number.isSafeInteger(chaosAwarded)
            && chaosAwarded >= 0) {
            s.chaosKeys += chaosAwarded;
          }
        }
        if (choice === 'full') {
          const pityAwarded = e.meta?.pityKeysAwarded;
          if (typeof pityAwarded === 'number'
            && Number.isSafeInteger(pityAwarded)
            && pityAwarded >= 0) {
            s.keys += pityAwarded;
          }
          const fateAfter = e.meta?.fatePointsAfter;
          if (typeof fateAfter === 'number'
            && Number.isSafeInteger(fateAfter)
            && fateAfter >= 0) {
            s.fatePoints = fateAfter;
          }
        }
        break;
      }
      case 'XTREME_MILESTONE':
        s.keys += typeof e.meta?.gained === 'number' ? e.meta.gained : 1;
        break;
    }
    check(i);
  }
  return { violations, final: s };
};

// --- Run audit (import verdict) -----------------------------------------

export type RunVerdict = 'verified' | 'warning' | 'tampered';

export interface RunAudit {
  /**
   * 'verified'  — hash chain intact AND no impossible states.
   * 'warning'   — chain intact but the replay hit an invariant violation
   *               (e.g. legacy data, or a partial edit).
   * 'tampered'  — the hash chain is broken; entries were added/edited/removed.
   */
  verdict: RunVerdict;
  chain: ChainReport;
  violations: InvariantViolation[];
  final: ReplayState;
}

/**
 * Classify a run's history for display at import time. Combines the hash-chain
 * check with the invariant replay into a single traffic-light verdict.
 * A history with no hash links at all (very old saves) chains cleanly from
 * GENESIS and reads as intact — we only flag links that are actually broken.
 */
export const auditHistory = (history: LogEntry[]): RunAudit => {
  const chained = ensureChain(history);
  const chain = verifyChain(chained);
  const { violations, final } = replayInvariants(chained);
  let verdict: RunVerdict = 'verified';
  if (!chain.ok) verdict = 'tampered';
  else if (violations.length > 0) verdict = 'warning';
  return { verdict, chain, violations, final };
};

// --- Run ID & SHA-256 commitment ----------------------------------------

// Browser-native SHA-256. Async, but only needed at export/verify time.
export const sha256Hex = async (s: string): Promise<string> => {
  const buf = new TextEncoder().encode(s);
  const hashBuf = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(hashBuf)].map(b => b.toString(16).padStart(2, '0')).join('');
};

// Deterministic run ID derived from the first event's hash. Players can
// publish this as a pre-commitment.
export const computeRunId = (history: LogEntry[]): string | null => {
  const chained = ensureChain(history);
  if (chained.length === 0) return null;
  return `run-${chained[0].hash ?? simpleHash(JSON.stringify(chained[0]))}`;
};

export interface VerifiedBundle {
  version: 1;
  runId: string;
  exportedAt: string;
  /** The game mode the run was played under, if known. */
  mode?: RunMode;
  history: LogEntry[];
  finalState: ReplayState;
  chainReport: ChainReport;
  /** Missing historical costs and other replay limitations must travel with the export. */
  replayWarnings?: InvariantViolation[];
  commitmentHash: string;
}

export const buildVerifiedBundle = async (
  history: LogEntry[],
  mode?: RunMode,
): Promise<VerifiedBundle> => {
  const chained = ensureChain(history);
  const chainReport = verifyChain(chained);
  const { final, violations } = replayInvariants(chained);
  const runId = computeRunId(chained) ?? 'run-empty';
  // The mode is part of what's committed to — a run isn't fully verified
  // without the ruleset it was played under.
  const commitmentHash = await sha256Hex(JSON.stringify({ runId, mode: mode ?? null, history: chained }));
  return {
    version: 1,
    runId,
    exportedAt: new Date().toISOString(),
    ...(mode ? { mode } : {}),
    history: chained,
    finalState: final,
    chainReport,
    ...(violations.length ? { replayWarnings: violations } : {}),
    commitmentHash,
  };
};
