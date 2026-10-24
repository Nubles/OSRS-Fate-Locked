import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AT_RISK_BACKUP_PROMPT_MIN_HISTORY,
  offDeviceCopyAt,
  offDeviceCopyLabel,
  onlineBackupPromptMinHistory,
  readOffDeviceCopyAt,
  requestPersistenceQuietly,
  shouldRequestPersistenceQuietly,
  storageAtRisk,
  storageEngineFor,
} from './persistentStorage';
import { markExported, markPersistRequested, readNagRecord, snoozeNag } from './backupNag';
import { writeOnlineBackupRecord } from './onlineBackupRecord';

const DAY = 24 * 60 * 60 * 1000;
const KEY = 'FATE_PROFILE_test';

beforeEach(() => {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
  };
});

const UA = {
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1',
  iphoneFirefox: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/127.0 Mobile/15E148 Safari/605.1.15',
  macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  macChrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  winEdge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
  winFirefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
};

describe('storageEngineFor', () => {
  it('treats Safari and every iPhone browser as WebKit (7-day eviction)', () => {
    expect(storageEngineFor({ userAgent: UA.iphoneSafari })).toBe('webkit');
    expect(storageEngineFor({ userAgent: UA.iphoneChrome })).toBe('webkit');
    expect(storageEngineFor({ userAgent: UA.iphoneFirefox })).toBe('webkit');
    expect(storageEngineFor({ userAgent: UA.macSafari })).toBe('webkit');
  });

  it('spots an iPad that reports a Mac user agent by its touch points', () => {
    expect(storageEngineFor({ userAgent: UA.macSafari, maxTouchPoints: 5 })).toBe('webkit');
    expect(storageEngineFor({ userAgent: UA.macChrome, maxTouchPoints: 5 })).toBe('webkit');
  });

  it('keeps Firefox apart (its persist() prompts) and Chromium as other', () => {
    expect(storageEngineFor({ userAgent: UA.winFirefox })).toBe('firefox');
    expect(storageEngineFor({ userAgent: UA.macChrome })).toBe('other');
    expect(storageEngineFor({ userAgent: UA.winEdge })).toBe('other');
    expect(storageEngineFor({ userAgent: UA.androidChrome })).toBe('other');
    expect(storageEngineFor({ userAgent: '' })).toBe('other');
  });
});

describe('shouldRequestPersistenceQuietly', () => {
  it('asks at the first recorded History entry, not before', () => {
    expect(shouldRequestPersistenceQuietly({ historyLength: 0, requestedAt: undefined, engine: 'other' })).toBe(false);
    expect(shouldRequestPersistenceQuietly({ historyLength: 1, requestedAt: undefined, engine: 'other' })).toBe(true);
    expect(shouldRequestPersistenceQuietly({ historyLength: 1, requestedAt: undefined, engine: 'webkit' })).toBe(true);
  });

  it('asks once per profile', () => {
    expect(shouldRequestPersistenceQuietly({ historyLength: 40, requestedAt: 123, engine: 'webkit' })).toBe(false);
  });

  it('never asks quietly in Firefox, where persist() shows a permission prompt', () => {
    expect(shouldRequestPersistenceQuietly({ historyLength: 40, requestedAt: undefined, engine: 'firefox' })).toBe(false);
  });

  it('remembers the request in the profile record without disturbing the reminder', () => {
    const now = Date.now();
    markExported(KEY, now - DAY);
    snoozeNag(KEY, now);
    markPersistRequested(KEY, now);
    const record = readNagRecord(KEY);
    expect(record.persistRequestedAt).toBe(now);
    expect(record.lastExport).toBe(now - DAY);
    expect(record.snoozeUntil).toBeGreaterThan(now);
    // Marking an export afterwards keeps the request on record.
    markExported(KEY, now + 1);
    expect(readNagRecord(KEY).persistRequestedAt).toBe(now);
  });

  it('reads an older record with no request as never asked', () => {
    localStorage.setItem(`${KEY}__exportNag`, JSON.stringify({ lastExport: 5, snoozeUntil: 0 }));
    expect(readNagRecord(KEY)).toEqual({ lastExport: 5, snoozeUntil: 0 });
    expect(readNagRecord(KEY).persistRequestedAt).toBeUndefined();
  });
});

describe('requestPersistenceQuietly', () => {
  it('skips persist() when storage is already persistent', async () => {
    const persist = vi.fn(async () => true);
    await expect(requestPersistenceQuietly({ persisted: async () => true, persist })).resolves.toBe(true);
    expect(persist).not.toHaveBeenCalled();
  });

  it('returns what the browser decided', async () => {
    await expect(requestPersistenceQuietly({ persisted: async () => false, persist: async () => true })).resolves.toBe(true);
    await expect(requestPersistenceQuietly({ persisted: async () => false, persist: async () => false })).resolves.toBe(false);
  });

  it('never throws: missing API or a browser error resolve to null', async () => {
    await expect(requestPersistenceQuietly(undefined)).resolves.toBeNull();
    await expect(requestPersistenceQuietly({})).resolves.toBeNull();
    await expect(requestPersistenceQuietly({ persist: () => { throw new Error('SecurityError'); } })).resolves.toBeNull();
    await expect(requestPersistenceQuietly({ persisted: async () => { throw new Error('nope'); }, persist: async () => true })).resolves.toBeNull();
  });
});

describe('offDeviceCopyAt', () => {
  it('is never until a .fate export or online upload happens', () => {
    expect(offDeviceCopyAt(0, {})).toBeNull();
    expect(offDeviceCopyAt(0, { code: 'X', enabledAt: 1 } as never)).toBeNull();
  });

  it('takes the later of the export and the upload', () => {
    expect(offDeviceCopyAt(100, {})).toBe(100);
    expect(offDeviceCopyAt(100, { code: 'X', lastUploadAt: 250 })).toBe(250);
    expect(offDeviceCopyAt(300, { code: 'X', lastUploadAt: 250 })).toBe(300);
  });

  it('ignores an upload once online backup is off, or while it holds a different run', () => {
    expect(offDeviceCopyAt(0, { lastUploadAt: 250 })).toBeNull();
    expect(offDeviceCopyAt(0, { code: 'X', lastUploadAt: 250, held: 'other-run' })).toBeNull();
    expect(offDeviceCopyAt(0, { code: 'X', lastUploadAt: 250, held: 'shorter' })).toBe(250);
  });

  it('reads both records for a profile', () => {
    expect(readOffDeviceCopyAt(KEY)).toBeNull();
    markExported(KEY, 1_000);
    expect(readOffDeviceCopyAt(KEY)).toBe(1_000);
    writeOnlineBackupRecord(KEY, { code: '0123456789ABCDEFGHJK', lastUploadAt: 2_000 });
    expect(readOffDeviceCopyAt(KEY)).toBe(2_000);
  });
});

describe('offDeviceCopyLabel', () => {
  const now = Date.UTC(2026, 9, 19, 12);
  it('says never, today, yesterday or how many days', () => {
    expect(offDeviceCopyLabel(null, now)).toBe('never');
    expect(offDeviceCopyLabel(now - 60_000, now)).toBe('today');
    expect(offDeviceCopyLabel(now - DAY, now)).toBe('yesterday');
    expect(offDeviceCopyLabel(now - 9 * DAY, now)).toBe('9 days ago');
  });
});

describe('the early online backup question on Safari and iOS', () => {
  const atRisk = { engine: 'webkit' as const, standalone: false, persisted: false, hasOffDeviceCopy: false };

  it('comes early only while the run could be wiped after a week away', () => {
    expect(storageAtRisk(atRisk)).toBe(true);
    expect(onlineBackupPromptMinHistory(atRisk, 10)).toBe(AT_RISK_BACKUP_PROMPT_MIN_HISTORY);
  });

  it('keeps the usual timing when storage is persistent, the app is on the home screen, or a copy exists', () => {
    expect(onlineBackupPromptMinHistory({ ...atRisk, persisted: true }, 10)).toBe(10);
    expect(onlineBackupPromptMinHistory({ ...atRisk, standalone: true }, 10)).toBe(10);
    expect(onlineBackupPromptMinHistory({ ...atRisk, hasOffDeviceCopy: true }, 10)).toBe(10);
  });

  it('keeps the usual timing in other browsers', () => {
    expect(onlineBackupPromptMinHistory({ ...atRisk, engine: 'other' }, 10)).toBe(10);
    expect(onlineBackupPromptMinHistory({ ...atRisk, engine: 'firefox' }, 10)).toBe(10);
  });

  it('never delays a question that would already come sooner', () => {
    expect(onlineBackupPromptMinHistory(atRisk, 2)).toBe(2);
  });
});
