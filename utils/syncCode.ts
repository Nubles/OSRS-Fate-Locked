/**
 * Sync codes — a single, self-contained, copy/paste string that carries a full
 * run between devices with no backend.
 *
 * Format:  FLSYNC.<method>.<base64url payload>.<checksum>
 *   method   : 'g1' = gzip (CompressionStream), 'r1' = raw UTF-8 (fallback)
 *   payload  : base64url of the (compressed) JSON bytes
 *   checksum : simpleHash(json) — lets the importer detect a truncated or
 *              hand-edited code BEFORE it overwrites a save.
 *
 * Compression uses the browser-native CompressionStream when available (history
 * is highly repetitive, so gzip shrinks codes dramatically) and falls back to a
 * raw UTF-8 payload otherwise. Decoding auto-detects the method from the header,
 * so a code produced on one device always reads on another.
 */

import { simpleHash } from './integrity';

const PREFIX = 'FLSYNC';
const SEP = '.';
const METHOD_GZIP = 'g1';
const METHOD_RAW = 'r1';

// ── base64url ───────────────────────────────────────────────────────────────
const bytesToBase64 = (bytes: Uint8Array): string => {
  let bin = '';
  const chunk = 0x8000; // avoid arg-count limits on String.fromCharCode
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
};

const base64ToBytes = (b64: string): Uint8Array => {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
};

const toUrlSafe = (b64: string): string =>
  b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const fromUrlSafe = (s: string): string => {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = b64.length % 4 ? 4 - (b64.length % 4) : 0;
  return b64 + '='.repeat(padLen);
};

// ── gzip via Compression Streams (browser + Node 18+) ───────────────────────
const canCompress = (): boolean => typeof CompressionStream !== 'undefined';
const canDecompress = (): boolean => typeof DecompressionStream !== 'undefined';

// Pump bytes into a transform stream and read the whole output. The writer
// promises are intentionally swallowed: when the stream errors (e.g. corrupt
// gzip input) the failure surfaces through the readable side, which the
// caller awaits — without this guard the writer's rejection would escape as
// an unhandled promise rejection.
const runStream = async (
  stream: { writable: WritableStream<BufferSource>; readable: ReadableStream<Uint8Array> },
  input: Uint8Array,
): Promise<Uint8Array> => {
  const writer = stream.writable.getWriter();
  // Cast: lib.dom types BufferSource around ArrayBuffer; a plain Uint8Array
  // (ArrayBufferLike) is runtime-compatible but trips TS 5.7's stricter generic.
  void writer.write(input as BufferSource).catch(() => {});
  void writer.close().catch(() => {});
  const buf = await new Response(stream.readable).arrayBuffer();
  return new Uint8Array(buf);
};

const gzipString = async (str: string): Promise<Uint8Array> =>
  runStream(new CompressionStream('gzip'), new TextEncoder().encode(str));

const gunzipToString = async (bytes: Uint8Array): Promise<string> =>
  new TextDecoder().decode(await runStream(new DecompressionStream('gzip'), bytes));

// ── public API ───────────────────────────────────────────────────────────────

/** Encode a persisted-state object into a shareable sync code. */
export const encodeSyncCode = async (state: Record<string, unknown>): Promise<string> => {
  const json = JSON.stringify(state);
  const checksum = simpleHash(json);

  let method = METHOD_RAW;
  let bytes: Uint8Array;
  if (canCompress()) {
    try {
      bytes = await gzipString(json);
      method = METHOD_GZIP;
    } catch {
      bytes = new TextEncoder().encode(json);
      method = METHOD_RAW;
    }
  } else {
    bytes = new TextEncoder().encode(json);
  }

  return [PREFIX, method, toUrlSafe(bytesToBase64(bytes)), checksum].join(SEP);
};

export interface DecodeResult {
  ok: boolean;
  /** The decoded persisted-state object (present whenever decoding succeeded,
   *  even if the checksum failed — so callers can preview a damaged run). */
  state?: Record<string, unknown>;
  /** Whether the embedded checksum matched the decoded payload. */
  checksumOk?: boolean;
  /** Human-readable reason when `ok` is false. */
  error?: string;
}

/** Decode a sync code back into a persisted-state object, validating the checksum. */
export const decodeSyncCode = async (code: string): Promise<DecodeResult> => {
  const trimmed = (code || '').trim();
  if (!trimmed) return { ok: false, error: 'Paste a sync code first.' };

  const parts = trimmed.split(SEP);
  if (parts.length !== 4 || parts[0] !== PREFIX) {
    return { ok: false, error: 'That doesn’t look like a Fate Locked sync code.' };
  }

  const [, method, payload, checksum] = parts;
  let json: string;
  try {
    const bytes = base64ToBytes(fromUrlSafe(payload));
    if (method === METHOD_GZIP) {
      if (!canDecompress()) {
        return { ok: false, error: 'This browser can’t read compressed codes. Try a newer browser.' };
      }
      json = await gunzipToString(bytes);
    } else if (method === METHOD_RAW) {
      json = new TextDecoder().decode(bytes);
    } else {
      return { ok: false, error: `Unknown code format “${method}”.` };
    }
  } catch {
    return { ok: false, error: 'The code is corrupted or incomplete.' };
  }

  const checksumOk = simpleHash(json) === checksum;

  let state: Record<string, unknown>;
  try {
    state = JSON.parse(json);
  } catch {
    return { ok: false, error: 'The decoded data isn’t valid.', checksumOk };
  }

  if (!checksumOk) {
    return {
      ok: false,
      state,
      checksumOk,
      error: 'Checksum mismatch — the code was truncated or edited. Copy the whole code and try again.',
    };
  }

  return { ok: true, state, checksumOk: true };
};

/** True if `s` is shaped like a sync code (cheap, non-async pre-check for UI). */
export const looksLikeSyncCode = (s: string): boolean =>
  (s || '').trim().startsWith(`${PREFIX}${SEP}`);
