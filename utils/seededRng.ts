import type { GameState, LogEntry } from '../types';

/**
 * Seeded runs — deterministic gameplay randomness.
 *
 * Model: every draw hashes (seed, context, purpose, index). Version 2 uses
 * semantic history; existing version 1 saves keep the original history hash. Consequences:
 *
 *  - Same seed + same decisions in the same order → identical outcomes, so
 *    two players (or a streamer and their chat) can race "the same fate".
 *  - Given the seed and the history, every roll is *recomputable* — this
 *    slots into the existing tamper-evident hash chain / verified bundles.
 *  - No PRNG stream state to persist: the history chain IS the state.
 *
 * A run without a seed (rngSeed undefined) keeps classic Math.random play —
 * existing runs are untouched. Visual-only randomness (particles etc.)
 * stays Math.random everywhere; only gameplay outcomes route through here.
 */

/** xfnv1a — string → well-mixed 32-bit uint. */
const hash32 = (s: string): number => {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  }
  // final avalanche (from splitmix-style mixing)
  h ^= h >>> 15; h = Math.imul(h, 2246822507);
  h ^= h >>> 13; h = Math.imul(h, 3266489909);
  h ^= h >>> 16;
  return h >>> 0;
};

/** mulberry32 — 32-bit seed → [0,1) float. One step is all we need per draw. */
const mulberry32Step = (seed: number): number => {
  let t = (seed + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/**
 * Deterministic float in [0,1).
 * @param seed    the run's seed phrase (any non-empty string)
 * @param context hash of the newest history entry ('genesis' on a fresh run)
 * @param purpose draw site label ('roll', 'gacha', …) — keeps parallel draws
 *                at one context independent
 * @param index   nth draw for this purpose at this context
 */
export const drawFloat = (seed: string, context: string, purpose: string, index = 0): number =>
  mulberry32Step(hash32(`${seed}\u0000${context}\u0000${purpose}\u0000${index}`));

const incidentalFields = new Set(['id', 'timestamp', 'hash', 'prevHash', 'fateEventId', 'runId', 'runRevision', 'account', 'x', 'y']);
const semanticValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(semanticValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([key]) => !incidentalFields.has(key))
      .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, child]) => [key, semanticValue(child)]));
  }
  return value;
};
const semanticContexts = new WeakMap<LogEntry, { previous: string; context: string }>();

/** A separate semantic chain leaves the tamper-evident history untouched. */
export const seededContext = (state: Pick<GameState, 'history' | 'rngVersion'>): string => {
  if (state.rngVersion !== 2) return state.history[state.history.length - 1]?.hash ?? 'genesis';
  let context = 'genesis';
  for (const entry of state.history) {
    const cached = semanticContexts.get(entry);
    if (cached?.previous === context) { context = cached.context; continue; }
    const previous = context;
    context = hash32(`${previous}|${JSON.stringify(semanticValue(entry))}`).toString(16);
    semanticContexts.set(entry, { previous, context });
  }
  return context;
};

/** Deterministic die: integer in [1, max]. */
export const drawDice = (seed: string, context: string, purpose: string, index = 0, max = 100): number =>
  Math.floor(drawFloat(seed, context, purpose, index) * max) + 1;

// ── Seed helpers ────────────────────────────────────────────────────────────

/** ISO-8601 week label, e.g. "FATE-2026-W28" — the community weekly seed. */
export const weeklySeed = (date: Date = new Date()): string => {
  // ISO week: Thursday of the current week determines the year/week number.
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `FATE-${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
};

/** A short readable random seed, e.g. "FATE-K7Q2X9". */
export const randomSeed = (): string => {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L
  let s = '';
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `FATE-${s}`;
};

/** Trimmed, uppercased, length-capped canonical form (seeds are case-insensitive). */
export const normalizeSeed = (raw: string): string => raw.trim().toUpperCase().slice(0, 64);
