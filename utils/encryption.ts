
// XOR key used to obfuscate save data. This is NOT cryptographic encryption -
// it's simple obfuscation to prevent casual editing of save files.
const FATE_KEY = "FATE_IS_ABSOLUTE_THE_VOID_STARES_BACK";

/**
 * Obfuscates a game state object into a "Fate Locked" string format.
 * Process: JSON -> Base64 -> XOR with Key -> Hex String -> Header prepended
 *
 * Note: This is obfuscation, not encryption. The key is embedded in source code.
 */
export const obfuscateFateSave = (data: Record<string, unknown>): string => {
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
    return "FATE_LOCKED::" + result;
  } catch (e) {
    console.error("Obfuscation error", e);
    return "";
  }
};

/**
 * Deobfuscates a "Fate Locked" string back into a game state object.
 * Supports legacy plain JSON files for backward compatibility.
 */
export const deobfuscateFateSave = (cipher: string): Record<string, unknown> | null => {
  if (!cipher) return null;

  // Backward Compatibility: If it looks like JSON, parse it as JSON
  if (cipher.trim().startsWith("{")) {
      try {
          return JSON.parse(cipher);
      } catch (e) {
          console.error("Legacy parse failed", e);
          return null;
      }
  }

  // Validation
  if (!cipher.startsWith("FATE_LOCKED::")) {
      console.error("Invalid Save File Format");
      return null;
  }

  try {
      const hexContent = cipher.replace("FATE_LOCKED::", "");
      let base64 = "";

      // 1. XOR de-obfuscate (Hex -> Base64)
      for (let i = 0; i < hexContent.length; i += 2) {
          const hex = hexContent.substring(i, i + 2);
          const charCode = parseInt(hex, 16);
          const originalCode = charCode ^ FATE_KEY.charCodeAt((i / 2) % FATE_KEY.length);
          base64 += String.fromCharCode(originalCode);
      }

      // 2. Base64 Decode to JSON String
      const json = decodeURIComponent(
        Array.prototype.map.call(atob(base64), (c: string) => {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join('')
      );

      return JSON.parse(json);
  } catch (e) {
      console.error("Deobfuscation error", e);
      return null;
  }
};

