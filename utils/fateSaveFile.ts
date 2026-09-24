import { markExported } from './backupNag';
import { encodeFateSaveExport } from './encryption';

export interface FateSaveDownloadEnvironment {
  now: () => number;
  createObjectURL: (blob: Blob) => string;
  revokeObjectURL: (url: string) => void;
  createAnchor: () => Pick<HTMLAnchorElement, 'href' | 'download' | 'click'>;
  markExported: (storageKey: string) => void;
}

/** Shown after any .fate export. The file is obfuscated, not encrypted. */
export const FATE_EXPORT_DONE_MESSAGE =
  "Save exported. Keep the .fate file safe: it isn't encrypted, so anyone you share it with can read it.";

/** Tooltip for export controls. */
export const FATE_EXPORT_HINT =
  "Download a backup of this run. The file isn't encrypted: anyone you share it with can read your notes and linked account name.";

export type FateSaveDownloadResult =
  | { ok: true }
  | { ok: false; message: string };

export const downloadFateSave = (
  rawData: string,
  storageKey: string,
  environment?: FateSaveDownloadEnvironment,
): FateSaveDownloadResult => {
  const browserEnvironment = environment ?? {
    now: () => Date.now(),
    createObjectURL: (blob: Blob) => URL.createObjectURL(blob),
    revokeObjectURL: (url: string) => URL.revokeObjectURL(url),
    createAnchor: () => document.createElement('a'),
    markExported,
  };
  let url: string | null = null;

  try {
    const encoded = encodeFateSaveExport(JSON.parse(rawData));
    if (encoded.ok === false) {
      return { ok: false, message: encoded.message };
    }

    const blob = new Blob([encoded.value], { type: 'text/plain' });
    url = browserEnvironment.createObjectURL(blob);
    const anchor = browserEnvironment.createAnchor();
    anchor.href = url;
    anchor.download = `fate_locked_${browserEnvironment.now()}.fate`;
    anchor.click();
    browserEnvironment.markExported(storageKey);
    return { ok: true };
  } catch {
    return { ok: false, message: 'Export failed' };
  } finally {
    if (url !== null) {
      try {
        browserEnvironment.revokeObjectURL(url);
      } catch {
        // The download already completed or failed; cleanup is best-effort.
      }
    }
  }
};
