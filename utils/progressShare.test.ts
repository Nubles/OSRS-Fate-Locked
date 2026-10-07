import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deleteProgress, formatLinkCode, newProgressShareRecord, publishProgress,
  readProgressShare, requestLinkCode, writeProgressShare,
} from './progressShare';

const BASE = 'https://relay.test';
const record = newProgressShareRecord(bytes => bytes.fill(7));

const reply = (status: number, body: unknown = {}) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

// Isolated in-memory localStorage (same pattern as discordWebhook.test.ts).
beforeEach(() => {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
  };
});

describe('progress share record', () => {
  it('makes an id and token of the shape the relay accepts', () => {
    expect(record.id).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(record.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(record.enabled).toBe(true);
  });

  it('keeps the record per profile, outside the save, and forgets it', () => {
    writeProgressShare('FATE_PROFILE_a', record);
    expect(readProgressShare('FATE_PROFILE_a')).toEqual(record);
    expect(readProgressShare('FATE_PROFILE_b')).toBeNull();
    expect(localStorage.getItem('FATE_PROFILE_a')).toBeNull();
    writeProgressShare('FATE_PROFILE_a', null);
    expect(readProgressShare('FATE_PROFILE_a')).toBeNull();
  });

  it('ignores a malformed record', () => {
    localStorage.setItem('FATE_PROFILE_a__progressShare', JSON.stringify({ id: 'short', token: record.token, enabled: true }));
    expect(readProgressShare('FATE_PROFILE_a')).toBeNull();
  });
});

describe('progress share requests', () => {
  it('publishes with the write token and reads the relay\'s answers', async () => {
    const ok = reply(200, { updatedAt: 1 });
    expect(await publishProgress(BASE, record, { v: 1 }, ok)).toEqual({ ok: true });
    expect(ok).toHaveBeenCalledWith(`${BASE}/p/${record.id}`, expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: `Bearer ${record.token}` }),
    }));
    expect(await publishProgress(BASE, record, {}, reply(429))).toEqual({ ok: false, retryAfterMs: 60_000 });
    expect(await publishProgress(BASE, record, {}, reply(403))).toEqual({ ok: false, error: 'forbidden' });
    expect(await publishProgress(BASE, record, {}, vi.fn(async () => { throw new TypeError('offline'); })))
      .toEqual({ ok: false, error: 'network' });
  });

  it('gets a link code, or says why not', async () => {
    expect(await requestLinkCode(BASE, record, reply(200, { code: 'ABCD2345', expiresAt: 9 })))
      .toEqual({ ok: true, code: 'ABCD2345', expiresAt: 9 });
    expect(await requestLinkCode(BASE, record, reply(404))).toEqual({ ok: false, error: 'not-published' });
    expect(formatLinkCode('ABCD2345')).toBe('ABCD-2345');
  });

  it('deletes with the write token', async () => {
    const ok = reply(200, { deleted: true });
    expect(await deleteProgress(BASE, record, ok)).toBe(true);
    expect(ok).toHaveBeenCalledWith(`${BASE}/p/${record.id}`, expect.objectContaining({ method: 'DELETE' }));
  });
});
