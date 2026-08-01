import { markExported } from './backupNag';
import { encodeFateSaveExport } from './encryption';

export interface FateSaveDownloadEnvironment {
  now: () => number;
  createObjectURL: (blob: Blob) => string;
  revokeObjectURL: (url: string) => void;
  createAnchor: () => Pick<HTMLAnchorElement, 'href' | 'download' | 'click'>;
  markExported: (storageKey: string) => void;
}

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
