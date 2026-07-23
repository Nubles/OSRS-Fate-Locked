import { describe, expect, it, vi } from 'vitest';
import { MAX_SAVE_BYTES } from './saveSchema';
import {
  deobfuscateFateSave,
  obfuscateFateSave,
} from './encryption';

const FATE_KEY = 'FATE_IS_ABSOLUTE_THE_VOID_STARES_BACK';

const legacyCipherForBase64 = (base64: string): string => {
  let hex = '';
  for (let index = 0; index < base64.length; index += 1) {
    const encoded = base64.charCodeAt(index)
      ^ FATE_KEY.charCodeAt(index % FATE_KEY.length);
    hex += encoded.toString(16).padStart(2, '0');
  }
  return `FATE_LOCKED::${hex}`;
};

const legacyCipherForText = (text: string): string => {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return legacyCipherForBase64(btoa(binary));
};

describe('Fate save file decoding', () => {
  it('accepts legacy plain JSON and the existing obfuscated wire format', () => {
    expect(deobfuscateFateSave('{"keys":7}')).toEqual({
      ok: true,
      value: { keys: 7 },
    });

    const cipher = obfuscateFateSave({ name: 'Zezima â˜ ', regions: ['Varrock'] });
    expect(deobfuscateFateSave(cipher)).toEqual({
      ok: true,
      value: { name: 'Zezima â˜ ', regions: ['Varrock'] },
    });
  });

  it('accepts a plain JSON payload at the exact UTF-8 byte cap', () => {
    const json = `"${'x'.repeat(MAX_SAVE_BYTES - 2)}"`;
    expect(new TextEncoder().encode(json)).toHaveLength(MAX_SAVE_BYTES);
    expect(deobfuscateFateSave(json)).toMatchObject({ ok: true });
  });

  it('rejects oversized raw input before parsing or decoding', () => {
    expect(deobfuscateFateSave('x'.repeat(MAX_SAVE_BYTES + 1))).toMatchObject({
      ok: false,
      code: 'too_large',
    });
  });

  it('rejects an obfuscated payload whose decoded JSON exceeds the cap', () => {
    const cipher = obfuscateFateSave({ note: 'x'.repeat(MAX_SAVE_BYTES) });
    expect(deobfuscateFateSave(cipher)).toMatchObject({
      ok: false,
      code: 'too_large',
    });
  });

  it.each([
    ['', 'decode_failed'],
    ['not a save', 'decode_failed'],
    ['FATE_LOCKED::0', 'decode_failed'],
    ['FATE_LOCKED::zz', 'decode_failed'],
    ['{"keys":', 'invalid_json'],
    [legacyCipherForBase64('!!!!'), 'decode_failed'],
    [legacyCipherForBase64('/w=='), 'decode_failed'],
    [legacyCipherForText('{"keys":'), 'invalid_json'],
  ] as const)('rejects malformed content safely: %s', (input, code) => {
    expect(deobfuscateFateSave(input)).toMatchObject({ ok: false, code });
  });

  it('does not log imported content when decoding fails', () => {
    const secret = 'SUPER-SECRET-SAVE-CONTENT';
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    deobfuscateFateSave(`{${secret}`);

    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
    error.mockRestore();
    warn.mockRestore();
    log.mockRestore();
  });
});
