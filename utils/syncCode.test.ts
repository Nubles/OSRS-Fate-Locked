import { describe, it, expect } from 'vitest';
import { simpleHash } from './integrity';
import { MAX_SAVE_BYTES } from './saveSchema';
import {
  MAX_SYNC_CODE_CHARS,
  boundRawSyncPayload,
  encodeSyncCode,
  decodeSyncCode,
  looksLikeSyncCode,
  type DecodeResult,
} from './syncCode';

const sampleState = {
  version: 1,
  keys: 7,
  specialKeys: 2,
  chaosKeys: 1,
  fatePoints: 13,
  unlocks: {
    skills: { Hitpoints: 5, Attack: 3 },
    regions: ['Varrock', 'Falador'],
    quests: ['cooks_assistant', 'dragon_slayer'],
  },
  history: [
    { id: 'a', timestamp: 1, type: 'ROLL_FAIL', message: 'No Key.', prevHash: 'GENESIS', hash: 'deadbeef' },
    { id: 'b', timestamp: 2, type: 'ROLL_SUCCESS', message: 'Key Found!', prevHash: 'deadbeef', hash: 'cafef00d' },
  ],
};

const toBase64Url = (bytes: Uint8Array): string => {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary)
    .split('+').join('-')
    .split('/').join('_')
    .replace(/=+$/, '');
};

const oldRawCode = (json: string, checksum = simpleHash(json)): string =>
  `FLSYNC.r1.${toBase64Url(new TextEncoder().encode(json))}.${checksum}`;

const oldGzipCode = async (json: string): Promise<string> => {
  const input = new TextEncoder().encode(json);
  const stream = new Blob([input]).stream().pipeThrough(new CompressionStream('gzip'));
  const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
  return `FLSYNC.g1.${toBase64Url(compressed)}.${simpleHash(json)}`;
};

const expectStableFailure = (
  result: DecodeResult,
  code: NonNullable<DecodeResult['code']>,
): void => {
  expect(result).toMatchObject({ ok: false, code });
  expect(result).not.toHaveProperty('state');
};

describe('sync code codec', () => {
  it('round-trips an arbitrary state object', async () => {
    const code = await encodeSyncCode(sampleState);
    const result = await decodeSyncCode(code);
    expect(result.ok).toBe(true);
    expect(result.checksumOk).toBe(true);
    expect(result.state).toEqual(sampleState);
  });

  it('produces a recognisable, prefixed code', async () => {
    const code = await encodeSyncCode(sampleState);
    expect(code.startsWith('FLSYNC.')).toBe(true);
    expect(looksLikeSyncCode(code)).toBe(true);
    expect(looksLikeSyncCode('  not a code  ')).toBe(false);
  });

  it('handles unicode and empty structures', async () => {
    const tricky = { name: 'Zezima ☠ 🗝️', notes: { x: '' }, list: [], nested: { a: { b: 1 } } };
    const result = await decodeSyncCode(await encodeSyncCode(tricky));
    expect(result.ok).toBe(true);
    expect(result.state).toEqual(tricky);
  });

  it('rejects a non-sync-code string', async () => {
    const result = await decodeSyncCode('hello world');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/sync code/i);
  });

  it('rejects an empty string', async () => {
    const result = await decodeSyncCode('   ');
    expect(result.ok).toBe(false);
  });

  it('flags a truncated code via checksum (no silent corruption)', async () => {
    const code = await encodeSyncCode(sampleState);
    const parts = code.split('.');
    // Drop the last few payload chars but keep the original checksum.
    parts[2] = parts[2].slice(0, -6);
    const tampered = parts.join('.');
    const result = await decodeSyncCode(tampered);
    expect(result.ok).toBe(false);
    // Either the payload no longer decodes, or it decodes to a different
    // string whose checksum won't match — both are caught, never a clean pass.
  });

  it('flags an edited checksum', async () => {
    const code = await encodeSyncCode(sampleState);
    const parts = code.split('.');
    parts[3] = '00000000';
    const result = await decodeSyncCode(parts.join('.'));
    expect(result.ok).toBe(false);
    expect(result.checksumOk).toBe(false);
  });

  it('accepts the encoded cap exactly and rejects one character above it', async () => {
    const exact = await decodeSyncCode('x'.repeat(MAX_SYNC_CODE_CHARS));
    expectStableFailure(exact, 'decode_failed');
    const oversized = await decodeSyncCode('x'.repeat(MAX_SYNC_CODE_CHARS + 1));
    expectStableFailure(oversized, 'too_large');
  });

  it('accepts raw decoded bytes at the expanded cap and rejects one byte above it', () => {
    expect(boundRawSyncPayload(new Uint8Array(MAX_SAVE_BYTES))).toMatchObject({
      ok: true,
    });
    expect(boundRawSyncPayload(new Uint8Array(MAX_SAVE_BYTES + 1))).toMatchObject({
      ok: false,
      code: 'too_large',
    });
  });

  it('accepts compressed JSON whose decompressed UTF-8 bytes equal the save limit', async () => {
    const note = 'x'.repeat(MAX_SAVE_BYTES - '{"note":""}'.length);
    const json = JSON.stringify({ note });
    expect(new TextEncoder().encode(json)).toHaveLength(MAX_SAVE_BYTES);
    const code = await oldGzipCode(json);
    expect(code.length).toBeLessThan(MAX_SYNC_CODE_CHARS);

    const result = await decodeSyncCode(code);

    expect(result).toMatchObject({ ok: true, checksumOk: true });
    expect(result.state).toEqual({ note });
  }, 30_000);

  it('aborts a compressed payload once decompressed output crosses the save limit', async () => {
    const json = JSON.stringify({ note: 'x'.repeat(MAX_SAVE_BYTES) });
    const code = await oldGzipCode(json);
    expect(code.length).toBeLessThan(MAX_SYNC_CODE_CHARS);
    expectStableFailure(await decodeSyncCode(code), 'too_large');
  }, 30_000);

  it('decodes valid legacy raw and gzip wire-format fixtures', async () => {
    const json = JSON.stringify(sampleState);
    for (const code of [oldRawCode(json), await oldGzipCode(json)]) {
      await expect(decodeSyncCode(code)).resolves.toEqual({
        ok: true,
        state: sampleState,
        checksumOk: true,
      });
    }
  });

  it.each([
    ['unknown method', 'FLSYNC.x1.e30.5465b825', 'decode_failed'],
    ['malformed Base64URL alphabet', 'FLSYNC.r1.abc%25.00000000', 'decode_failed'],
    ['impossible Base64URL length', 'FLSYNC.r1.a.00000000', 'decode_failed'],
    ['truncated code', 'FLSYNC.r1.e30', 'decode_failed'],
    ['empty payload', 'FLSYNC.r1..00000000', 'decode_failed'],
    ['corrupt gzip', 'FLSYNC.g1.e30.00000000', 'decode_failed'],
  ] as const)('rejects %s with a stable failure', async (_label, code, failureCode) => {
    expectStableFailure(await decodeSyncCode(code), failureCode);
  });

  it('distinguishes invalid JSON from decode failures', async () => {
    const invalidJson = '{"keys":';
    expectStableFailure(await decodeSyncCode(oldRawCode(invalidJson)), 'invalid_json');

    const invalidUtf8 = `FLSYNC.r1.${toBase64Url(new Uint8Array([0xff]))}.00000000`;
    expectStableFailure(await decodeSyncCode(invalidUtf8), 'decode_failed');
  });

  it('rejects checksum mismatch without exposing parsed state', async () => {
    const result = await decodeSyncCode(oldRawCode(JSON.stringify(sampleState), '00000000'));
    expectStableFailure(result, 'decode_failed');
    expect(result.checksumOk).toBe(false);
  });
});
