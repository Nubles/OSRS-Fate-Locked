import { describe, expect, it, vi } from 'vitest';
import { initialState } from '../context/GameContext';
import { MAX_SAVE_BYTES, validateAndMigrateSave } from './saveSchema';
import {
  boundFateSaveExport,
  deobfuscateFateSave,
  encodeFateSaveExport,
  MAX_FATE_FILE_BYTES,
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

describe('Fate save file export bounds', () => {
  it('keeps existing valid file exports wire-compatible', () => {
    const result = encodeFateSaveExport({ keys: 7, regions: ['Varrock'] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(deobfuscateFateSave(result.value)).toEqual({
        ok: true,
        value: { keys: 7, regions: ['Varrock'] },
      });
    }
  });

  it('rejects an empty encoder result instead of treating it as a download', () => {
    expect(boundFateSaveExport('')).toEqual({
      ok: false,
      code: 'encode_failed',
      message: 'The save file could not be generated.',
    });
  });

  it('exports and restores a valid live save whose file is larger than the save cap', () => {
    // The file is ~8/3 the save's size, so a long run's backup must not be
    // refused merely because its encoded file exceeds MAX_SAVE_BYTES.
    const live = structuredClone(initialState);
    live.userNotes = Object.fromEntries(Array.from(
      { length: 105 },
      (_, index) => [`note-${index}`, 'x'.repeat(20_000)],
    ));
    expect(validateAndMigrateSave(live, initialState).ok).toBe(true);
    expect(new TextEncoder().encode(JSON.stringify(live)).byteLength).toBeLessThan(MAX_SAVE_BYTES);

    const exported = encodeFateSaveExport(live);
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    expect(exported.value.length).toBeGreaterThan(MAX_SAVE_BYTES);
    expect(exported.value.length).toBeLessThanOrEqual(MAX_FATE_FILE_BYTES);
    expect(deobfuscateFateSave(exported.value)).toEqual({ ok: true, value: JSON.parse(JSON.stringify(live)) });
  });

  it('restores a save file right up to the save cap', () => {
    // A regular expression used to check the decoded Base64 here. Browsers run
    // out of stack on one that long, so every save file above about 3.3 MB
    // exported fine and then could not be imported again.
    const live = structuredClone(initialState);
    live.userNotes = Object.fromEntries(Array.from(
      { length: 245 },
      (_, index) => [`note-${index}`, 'x'.repeat(20_000)],
    ));
    const bytes = new TextEncoder().encode(JSON.stringify(live)).byteLength;
    expect(bytes).toBeGreaterThan(4_800_000);
    expect(bytes).toBeLessThan(MAX_SAVE_BYTES);

    const exported = encodeFateSaveExport(live);
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    const restored = deobfuscateFateSave(exported.value);
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    expect(restored.value).toEqual(JSON.parse(JSON.stringify(live)));
  }, 30_000);

  it('still refuses to export a save larger than the save cap', () => {
    expect(encodeFateSaveExport({ note: 'x'.repeat(MAX_SAVE_BYTES) })).toEqual({
      ok: false,
      code: 'too_large',
      message: 'The generated save file is too large to export.',
    });
  });
});

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

  it('rejects non-canonical Base64 aliases while accepting the canonical legacy bytes', () => {
    expect(deobfuscateFateSave(legacyCipherForBase64('e30='))).toEqual({
      ok: true,
      value: {},
    });
    for (const alias of ['e31=', 'e32=', 'e33=']) {
      expect(deobfuscateFateSave(legacyCipherForBase64(alias))).toMatchObject({
        ok: false,
        code: 'decode_failed',
      });
    }
  });

  it('rejects Base64 with characters outside the alphabet or misplaced padding', () => {
    for (const malformed of ['e3=0', '=e30', 'e30', 'e3 0', 'e3\n0', 'e3-_', 'e===', '====', 'e30=e30=']) {
      expect(deobfuscateFateSave(legacyCipherForBase64(malformed))).toMatchObject({
        ok: false,
        code: 'decode_failed',
      });
    }
  });

  it('accepts a plain JSON payload at the exact UTF-8 byte cap', () => {
    const json = `"${'x'.repeat(MAX_SAVE_BYTES - 2)}"`;
    expect(new TextEncoder().encode(json)).toHaveLength(MAX_SAVE_BYTES);
    expect(deobfuscateFateSave(json)).toMatchObject({ ok: true });
  });

  it('rejects oversized raw input before parsing or decoding', () => {
    expect(deobfuscateFateSave('x'.repeat(MAX_FATE_FILE_BYTES + 1))).toMatchObject({
      ok: false,
      code: 'too_large',
    });
  });

  it('rejects a plain JSON payload above the save cap', () => {
    expect(deobfuscateFateSave(`"${'x'.repeat(MAX_SAVE_BYTES)}"`)).toMatchObject({
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
