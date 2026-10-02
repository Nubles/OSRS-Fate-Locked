import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BACKUP_CODE_LENGTH,
  decryptBackup,
  deleteBackup,
  deriveBackupKeys,
  encryptBackup,
  fetchBackup,
  formatBackupCode,
  generateBackupCode,
  normalizeBackupCode,
  readOnlineBackupRecord,
  uploadBackup,
  writeOnlineBackupRecord,
} from './onlineBackup';
import { profileOnlineBackupKey } from './profileStorage';

const CODE = '0123456789ABCDEFGHJK';

describe('backup codes', () => {
  it('are 20 Crockford base32 symbols in groups of five', () => {
    const code = generateBackupCode();
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{5}(-[0-9A-HJKMNP-TV-Z]{5}){3}$/);
    expect(normalizeBackupCode(code)).toHaveLength(BACKUP_CODE_LENGTH);
  });

  it('take each symbol from five random bits', () => {
    const bytes = Uint8Array.from({ length: 20 }, (_, index) => index + 32 * 3);
    expect(generateBackupCode(target => { target.set(bytes); return target; })).toBe(formatBackupCode(CODE));
  });

  it('read back however the player types them', () => {
    expect(normalizeBackupCode('01234-56789-abcde-fghjk')).toBe(CODE);
    expect(normalizeBackupCode(' 0123456789ABCDEFGHJK ')).toBe(CODE);
    expect(normalizeBackupCode('O1234 56789 ABCDE FGHJK')).toBe(CODE);
    expect(normalizeBackupCode('0I234-56789-ABCDE-FGHJK')).toBe('01234' + CODE.slice(5));
    expect(normalizeBackupCode('0L234-56789-ABCDE-FGHJK')).toBe('01234' + CODE.slice(5));
  });

  it('refuse a code of the wrong length or with symbols it never uses', () => {
    expect(normalizeBackupCode('0123456789ABCDEFGHJ')).toBeNull();
    expect(normalizeBackupCode('0123456789ABCDEFGHJKM')).toBeNull();
    expect(normalizeBackupCode('0123456789ABCDEFGHJU')).toBeNull();
    expect(normalizeBackupCode('')).toBeNull();
  });
});

describe('backup keys', () => {
  it('come from the code alone, the same in every browser', async () => {
    // Pinned: changing the derivation would strand every backup already made.
    const keys = await deriveBackupKeys(CODE);
    expect(keys.id).toBe('Kevd9_qaEyU6SO1YrannCyFEOtbAKHjjLRK94iUPuDw');
    expect(keys.writeToken).toBe('yiMoFSwRF2i9RqrtPFb3I5OyC7nRTq8wtjJobGIa-7g');
    expect(keys.key.extractable).toBe(false);
  });

  it('differ for every code', async () => {
    const other = await deriveBackupKeys('0123456789ABCDEFGHJM');
    expect(other.id).not.toBe('Kevd9_qaEyU6SO1YrannCyFEOtbAKHjjLRK94iUPuDw');
    expect(other.writeToken).not.toBe(other.id);
  });
});

describe('backup encryption', () => {
  it('reads back with the same code, and differs every time it is made', async () => {
    const { key } = await deriveBackupKeys(CODE);
    const first = await encryptBackup('FLSYNC.g1.payload.checksum', key);
    const second = await encryptBackup('FLSYNC.g1.payload.checksum', key);
    expect(first).toMatch(/^FLBK1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]+$/);
    expect(first).not.toBe(second);
    expect(first).not.toContain('payload');
    expect(await decryptBackup(first, key)).toBe('FLSYNC.g1.payload.checksum');
  });

  it("can't be read with another code, after a change, or in another format", async () => {
    const { key } = await deriveBackupKeys(CODE);
    const { key: wrong } = await deriveBackupKeys('0123456789ABCDEFGHJM');
    const envelope = await encryptBackup('the run', key);
    expect(await decryptBackup(envelope, wrong)).toBeNull();
    const [tag, iv, ciphertext] = envelope.split('.');
    const flipped = ciphertext.slice(0, -2) + (ciphertext.at(-2) === 'A' ? 'B' : 'A') + ciphertext.at(-1);
    expect(await decryptBackup(`${tag}.${iv}.${flipped}`, key)).toBeNull();
    expect(await decryptBackup(`FLBK2.${iv}.${ciphertext}`, key)).toBeNull();
    expect(await decryptBackup(`${tag}.${iv}`, key)).toBeNull();
    expect(await decryptBackup('not a backup', key)).toBeNull();
  });
});

describe('the relay', () => {
  const base = 'https://relay.test';
  const reply = (status: number, body: BodyInit | null = null, headers: Record<string, string> = {}) =>
    vi.fn(async () => new Response(body, { status, headers }));

  it('uploads the envelope under the id, with the write token', async () => {
    const keys = await deriveBackupKeys(CODE);
    const fetchImpl = reply(200, JSON.stringify({ updatedAt: 1234 }));
    expect(await uploadBackup(base, keys, 'FLBK1.x.y', fetchImpl)).toEqual({ ok: true, updatedAt: 1234 });
    expect(fetchImpl).toHaveBeenCalledWith(`${base}/b/${keys.id}`, expect.objectContaining({
      method: 'POST',
      body: 'FLBK1.x.y',
      headers: expect.objectContaining({ Authorization: `Bearer ${keys.writeToken}` }),
    }));
  });

  it('says why an upload failed', async () => {
    const keys = await deriveBackupKeys(CODE);
    expect(await uploadBackup(base, keys, 'e', reply(403))).toEqual({ ok: false, reason: 'forbidden' });
    expect(await uploadBackup(base, keys, 'e', reply(413))).toEqual({ ok: false, reason: 'too-large' });
    expect(await uploadBackup(base, keys, 'e', reply(429, null, { 'Retry-After': '30' })))
      .toEqual({ ok: false, reason: 'throttled', retryAfterMs: 30_000 });
    expect(await uploadBackup(base, keys, 'e', reply(503))).toEqual({ ok: false, reason: 'unavailable' });
    expect(await uploadBackup(base, keys, 'e', vi.fn(async () => { throw new TypeError('offline'); })))
      .toEqual({ ok: false, reason: 'network' });
  });

  it('fetches the envelope and its upload time, or says there is none', async () => {
    const keys = await deriveBackupKeys(CODE);
    expect(await fetchBackup(base, keys, reply(200, 'FLBK1.x.y', { 'X-Backup-Updated-At': '99' })))
      .toEqual({ ok: true, envelope: 'FLBK1.x.y', updatedAt: 99 });
    expect(await fetchBackup(base, keys, reply(404, '{}'))).toEqual({ ok: false, reason: 'not-found' });
    expect(await fetchBackup(base, keys, reply(503))).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('deletes with the write token', async () => {
    const keys = await deriveBackupKeys(CODE);
    const fetchImpl = reply(200, '{"deleted":true}');
    expect(await deleteBackup(base, keys, fetchImpl)).toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith(`${base}/b/${keys.id}`, expect.objectContaining({ method: 'DELETE' }));
    expect(await deleteBackup(base, keys, reply(403))).toBe(false);
  });
});

describe("this browser's record", () => {
  // Isolated in-memory localStorage (same pattern as backups.test.ts).
  beforeEach(() => {
    const store = new Map<string, string>();
    (globalThis as any).localStorage = {
      getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
      setItem: (key: string, value: string) => { store.set(key, value); },
      removeItem: (key: string) => { store.delete(key); },
      clear: () => store.clear(),
    };
  });

  it('keeps the code canonical and drops anything it does not know', () => {
    writeOnlineBackupRecord('P', { code: CODE, enabledAt: 1, lastUploadAt: 2, lastChecksum: 'abc' });
    expect(readOnlineBackupRecord('P')).toEqual({ code: CODE, enabledAt: 1, lastUploadAt: 2, lastChecksum: 'abc' });
    localStorage.setItem(profileOnlineBackupKey('P'), JSON.stringify({ code: '01234-56789-abcde-fghjk', extra: true, lastUploadAt: 'x' }));
    expect(readOnlineBackupRecord('P')).toEqual({ code: CODE });
    localStorage.setItem(profileOnlineBackupKey('P'), 'not json');
    expect(readOnlineBackupRecord('P')).toEqual({});
  });
});
