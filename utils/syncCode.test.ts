import { describe, it, expect } from 'vitest';
import { encodeSyncCode, decodeSyncCode, looksLikeSyncCode } from './syncCode';

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
});
