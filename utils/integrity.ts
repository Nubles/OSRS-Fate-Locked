import type { LogEntry } from '../types';
import type { GameModeRules } from '../config/gameModes';

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
