
import { MAX_SAVE_BYTES } from './saveSchema';

// XOR key used to obfuscate save data. This is NOT cryptographic encryption -
// it's simple obfuscation to prevent casual editing of save files.
const FATE_KEY = "FATE_IS_ABSOLUTE_THE_VOID_STARES_BACK";
const FATE_PREFIX = 'FATE_LOCKED::';

export type SaveDecodeResult =
  | { ok: true; value: unknown }
  | {
      ok: false;
      code: 'too_large' | 'invalid_json' | 'decode_failed';
      message: string;
    };

const failure = (
  code: Extract<SaveDecodeResult, { ok: false }>['code'],
): SaveDecodeResult => {
  const messages = {
    too_large: 'That save file is too large.',
    invalid_json: 'The save data is not valid JSON.',
    decode_failed: 'That does not look like a valid Fate Locked save file.',
  } as const;
  return { ok: false, code, message: messages[code] };
};

const looksLikePlainJson = (value: string): boolean => {
  const first = value[0];
  return first === '{'
    || first === '['
    || first === '"'
    || first === '-'
    || (first >= '0' && first <= '9')
    || value === 'true'
    || value === 'false'
    || value === 'null';
};

const isStrictBase64 = (value: string): boolean =>
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value);

/**
 * Obfuscates a game state object into a "Fate Locked" string format.
 * Process: JSON -> Base64 -> XOR with Key -> Hex String -> Header prepended
 *
 * Note: This is obfuscation, not encryption. The key is embedded in source code.
 */
export const obfuscateFateSave = (data: unknown): string => {
  try {
    const json = JSON.stringify(data);

    // 1. Normalize to Base64 (Handling Unicode properly)
    const base64 = btoa(
      encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, (_match, p1) =>
        String.fromCharCode(parseInt(p1, 16))
      )
    );

    // 2. XOR obfuscation to generate a Hex string
    let result = "";
    for(let i = 0; i < base64.length; i++) {
       const charCode = base64.charCodeAt(i) ^ FATE_KEY.charCodeAt(i % FATE_KEY.length);
       result += charCode.toString(16).padStart(2, '0');
    }

    // 3. Add Header
    return FATE_PREFIX + result;
  } catch (e) {
    console.error("Obfuscation error", e);
    return "";
  }
};

export type FateSaveExportResult =
  | { ok: true; value: string }
  | {
      ok: false;
      code: 'too_large' | 'encode_failed';
      message: string;
    };

export const boundFateSaveExport = (encoded: string): FateSaveExportResult => {
  if (!encoded) {
    return {
      ok: false,
      code: 'encode_failed',
      message: 'The save file could not be generated.',
    };
  }
  if (new TextEncoder().encode(encoded).byteLength > MAX_SAVE_BYTES) {
    return {
      ok: false,
      code: 'too_large',
      message: 'The generated save file is too large to export.',
    };
  }
  return { ok: true, value: encoded };
};

export const encodeFateSaveExport = (data: unknown): FateSaveExportResult =>
  boundFateSaveExport(obfuscateFateSave(data));

/**
 * Deobfuscates a "Fate Locked" string back into a game state object.
 * Supports legacy plain JSON files for backward compatibility.
 */
export const deobfuscateFateSave = (cipher: string): SaveDecodeResult => {
  if (typeof cipher !== 'string' || cipher.length === 0) {
    return failure('decode_failed');
  }
  if (
    cipher.length > MAX_SAVE_BYTES
    || new TextEncoder().encode(cipher).byteLength > MAX_SAVE_BYTES
  ) {
    return failure('too_large');
  }

  // Backward Compatibility: If it looks like JSON, parse it as JSON
  const trimmed = cipher.trim();
  if (looksLikePlainJson(trimmed)) {
    try {
      return { ok: true, value: JSON.parse(trimmed) as unknown };
    } catch {
      return failure('invalid_json');
    }
  }

  if (!cipher.startsWith(FATE_PREFIX)) {
    return failure('decode_failed');
  }

  try {
    const hexContent = cipher.slice(FATE_PREFIX.length);
    if (
      hexContent.length === 0
      || hexContent.length % 2 !== 0
      || !/^[0-9a-f]+$/i.test(hexContent)
    ) {
      return failure('decode_failed');
    }

    const base64Length = hexContent.length / 2;
    const conservativeDecodedBytes = Math.ceil(base64Length / 4) * 3;
    if (conservativeDecodedBytes > MAX_SAVE_BYTES) {
      return failure('too_large');
    }

    let base64 = '';
    for (let index = 0; index < hexContent.length; index += 2) {
      const encoded = Number.parseInt(hexContent.slice(index, index + 2), 16);
      const decoded = encoded
        ^ FATE_KEY.charCodeAt((index / 2) % FATE_KEY.length);
      base64 += String.fromCharCode(decoded);
    }
    if (!isStrictBase64(base64)) return failure('decode_failed');

    const binary = atob(base64);
    if (btoa(binary) !== base64) return failure('decode_failed');
    if (binary.length > MAX_SAVE_BYTES) return failure('too_large');
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    const json = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (new TextEncoder().encode(json).byteLength > MAX_SAVE_BYTES) {
      return failure('too_large');
    }

    try {
      return { ok: true, value: JSON.parse(json) as unknown };
    } catch {
      return failure('invalid_json');
    }
  } catch {
    return failure('decode_failed');
  }
};
