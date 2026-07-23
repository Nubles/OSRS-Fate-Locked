/**
 * Sync codes — a single, self-contained, copy/paste string that carries a full
 * run between devices with no backend.
 *
 * Format:  FLSYNC.<method>.<base64url payload>.<checksum>
 *   method   : 'g1' = gzip (CompressionStream), 'r1' = raw UTF-8 (fallback)
 *   payload  : base64url of the (compressed) JSON bytes
 *   checksum : simpleHash(json)
 */

import { simpleHash } from './integrity';
import type { GameState } from '../types';
import {
  MAX_SAVE_BYTES,
  validateAndMigrateSave,
  type SaveErrorCode,
  type SaveWarning,
} from './saveSchema';

const PREFIX = 'FLSYNC';
const SEP = '.';
const METHOD_GZIP = 'g1';
const METHOD_RAW = 'r1';

export const MAX_SYNC_CODE_CHARS = 2 * 1024 * 1024;

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
};

const base64ToBytes = (base64: string): Uint8Array => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const toUrlSafe = (base64: string): string =>
  base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const fromUrlSafe = (value: string): string => {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = base64.length % 4 ? 4 - (base64.length % 4) : 0;
  return base64 + '='.repeat(padding);
};

const isStrictBase64Url = (value: string): boolean =>
  value.length > 0
  && value.length % 4 !== 1
  && /^[A-Za-z0-9_-]+$/.test(value);

const canCompress = (): boolean => typeof CompressionStream !== 'undefined';
const canDecompress = (): boolean => typeof DecompressionStream !== 'undefined';

const runCompressionStream = async (
  stream: CompressionStream,
  input: Uint8Array,
): Promise<Uint8Array> => {
  const writer = stream.writable.getWriter();
  void writer.write(input as BufferSource).catch(() => {});
  void writer.close().catch(() => {});
  const buffer = await new Response(stream.readable).arrayBuffer();
  return new Uint8Array(buffer);
};

const gzipString = async (value: string): Promise<Uint8Array> =>
  runCompressionStream(
    new CompressionStream('gzip'),
    new TextEncoder().encode(value),
  );

class ExpandedPayloadTooLarge extends Error {}

const gunzipBounded = async (input: Uint8Array): Promise<Uint8Array> => {
  const stream = new DecompressionStream('gzip');
  const writer = stream.writable.getWriter();
  const reader = stream.readable.getReader();
  const pump = writer.write(input as BufferSource).then(() => writer.close());
  void pump.catch(() => {});

  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > MAX_SAVE_BYTES) {
        await reader.cancel('Expanded sync payload exceeds the save limit').catch(() => {});
        await writer.abort().catch(() => {});
        await pump.catch(() => {});
        throw new ExpandedPayloadTooLarge();
      }
      chunks.push(value);
    }
    await pump;
  } catch (error) {
    await reader.cancel().catch(() => {});
    await writer.abort().catch(() => {});
    await pump.catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
    writer.releaseLock();
  }

  const output = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
};

export const encodeSyncCode = async (
  state: Record<string, unknown>,
): Promise<string> => {
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
    }
  } else {
    bytes = new TextEncoder().encode(json);
  }

  return [PREFIX, method, toUrlSafe(bytesToBase64(bytes)), checksum].join(SEP);
};

export interface DecodeResult {
  ok: boolean;
  state?: Record<string, unknown>;
  checksumOk?: boolean;
  code?: 'too_large' | 'decode_failed' | 'invalid_json';
  error?: string;
}

const decodeFailure = (
  code: NonNullable<DecodeResult['code']>,
  error: string,
  checksumOk?: boolean,
): DecodeResult => ({
  ok: false,
  code,
  error,
  ...(checksumOk === undefined ? {} : { checksumOk }),
});

export type BoundedRawSyncPayloadResult =
  | { ok: true; bytes: Uint8Array }
  | { ok: false; code: 'too_large'; error: string };

export const boundRawSyncPayload = (
  bytes: Uint8Array,
): BoundedRawSyncPayloadResult => (
  bytes.byteLength > MAX_SAVE_BYTES
    ? {
        ok: false,
        code: 'too_large',
        error: 'The decoded save data is too large.',
      }
    : { ok: true, bytes }
);

export const decodeSyncCode = async (code: string): Promise<DecodeResult> => {
  if (typeof code !== 'string' || code.length === 0) {
    return decodeFailure('decode_failed', 'Paste a sync code first.');
  }
  if (code.length > MAX_SYNC_CODE_CHARS) {
    return decodeFailure('too_large', 'That sync code is too large.');
  }

  const trimmed = code.trim();
  if (!trimmed) {
    return decodeFailure('decode_failed', 'Paste a sync code first.');
  }

  const parts = trimmed.split(SEP);
  if (parts.length !== 4 || parts[0] !== PREFIX) {
    return decodeFailure(
      'decode_failed',
      'That doesn’t look like a Fate Locked sync code.',
    );
  }

  const [, method, payload, checksum] = parts;
  if (method !== METHOD_RAW && method !== METHOD_GZIP) {
    return decodeFailure('decode_failed', 'Unknown sync code format.');
  }
  if (!isStrictBase64Url(payload) || !/^[0-9a-f]{8}$/i.test(checksum)) {
    return decodeFailure('decode_failed', 'The code is corrupted or incomplete.');
  }

  const conservativeDecodedBytes = Math.floor(payload.length * 3 / 4);
  if (method === METHOD_RAW && conservativeDecodedBytes > MAX_SAVE_BYTES) {
    return decodeFailure('too_large', 'The decoded save data is too large.');
  }

  let bytes: Uint8Array;
  try {
    bytes = base64ToBytes(fromUrlSafe(payload));
    if (toUrlSafe(bytesToBase64(bytes)) !== payload) {
      return decodeFailure('decode_failed', 'The code is corrupted or incomplete.');
    }
  } catch {
    return decodeFailure('decode_failed', 'The code is corrupted or incomplete.');
  }

  let jsonBytes: Uint8Array;
  if (method === METHOD_RAW) {
    const bounded = boundRawSyncPayload(bytes);
    if (!bounded.ok) return bounded;
    jsonBytes = bounded.bytes;
  } else {
    if (!canDecompress()) {
      return decodeFailure(
        'decode_failed',
        'This browser can’t read compressed codes. Try a newer browser.',
      );
    }
    try {
      jsonBytes = await gunzipBounded(bytes);
    } catch (error) {
      if (error instanceof ExpandedPayloadTooLarge) {
        return decodeFailure('too_large', 'The decoded save data is too large.');
      }
      return decodeFailure('decode_failed', 'The code is corrupted or incomplete.');
    }
  }

  let json: string;
  try {
    json = new TextDecoder('utf-8', { fatal: true }).decode(jsonBytes);
  } catch {
    return decodeFailure('decode_failed', 'The code is corrupted or incomplete.');
  }

  const checksumOk = simpleHash(json) === checksum;
  if (!checksumOk) {
    return decodeFailure(
      'decode_failed',
      'Checksum mismatch — the code was truncated or edited. Copy the whole code and try again.',
      false,
    );
  }

  try {
    return {
      ok: true,
      state: JSON.parse(json) as Record<string, unknown>,
      checksumOk: true,
    };
  } catch {
    return decodeFailure(
      'invalid_json',
      'The decoded data isn’t valid JSON.',
      true,
    );
  }
};

export type ValidatedSyncCodeResult =
  | {
      ok: true;
      state: GameState;
      checksumOk: true;
      warnings: SaveWarning[];
    }
  | {
      ok: false;
      code: SaveErrorCode;
      error: string;
      path?: string;
      checksumOk?: boolean;
    };

export const decodeAndValidateSyncCode = async (
  code: string,
  defaults: GameState,
): Promise<ValidatedSyncCodeResult> => {
  const decoded = await decodeSyncCode(code);
  if (!decoded.ok || !decoded.state) {
    return {
      ok: false,
      code: decoded.code ?? 'decode_failed',
      error: decoded.error ?? 'Could not read that code.',
      ...(decoded.checksumOk === undefined ? {} : { checksumOk: decoded.checksumOk }),
    };
  }

  const validated = validateAndMigrateSave(decoded.state, defaults);
  if (validated.ok === false) {
    return {
      ok: false,
      code: validated.code,
      error: validated.message,
      ...(validated.path ? { path: validated.path } : {}),
      checksumOk: true,
    };
  }

  return {
    ok: true,
    state: validated.state,
    checksumOk: true,
    warnings: validated.warnings,
  };
};

export const looksLikeSyncCode = (value: string): boolean =>
  (value || '').trim().startsWith(`${PREFIX}${SEP}`);
