import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isValidWebhookUrl, pickNewUnlocks, unlockEmbed, postEmbeds,
  readDiscordConfig, writeDiscordConfig, readCursor, writeCursor,
  MAX_EMBEDS_PER_POST,
} from './discordWebhook';
import type { LogEntry } from '../types';

// Isolated in-memory localStorage (same pattern as backups.test.ts).
beforeEach(() => {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
  };
});

const entry = (over: Partial<LogEntry> = {}): LogEntry => ({
  id: 'x', timestamp: 1000, type: 'UNLOCK', message: 'Unlocked Zulrah',
  meta: { item: 'Zulrah', category: 'Bosses', cost: 1, costType: 'key' },
  ...over,
});

describe('isValidWebhookUrl', () => {
  it('accepts real Discord webhook URLs', () => {
    expect(isValidWebhookUrl('https://discord.com/api/webhooks/123456/aBc-DeF_123')).toBe(true);
    expect(isValidWebhookUrl('https://discordapp.com/api/webhooks/1/t')).toBe(true);
    expect(isValidWebhookUrl('https://ptb.discord.com/api/webhooks/1/t')).toBe(true);
  });
  it('rejects everything else', () => {
    expect(isValidWebhookUrl('')).toBe(false);
    expect(isValidWebhookUrl('https://evil.com/api/webhooks/1/t')).toBe(false);
    expect(isValidWebhookUrl('http://discord.com/api/webhooks/1/t')).toBe(false);
    expect(isValidWebhookUrl('https://discord.com/other/1/t')).toBe(false);
  });
});

describe('pickNewUnlocks', () => {
  it('returns only UNLOCKs newer than the cursor, oldest first', () => {
    const history: LogEntry[] = [
      entry({ id: 'c', timestamp: 3000 }),
      entry({ id: 'a', timestamp: 1000 }),
      entry({ id: 'roll', timestamp: 2500, type: 'ROLL_SUCCESS' }),
      entry({ id: 'b', timestamp: 2000 }),
    ];
    expect(pickNewUnlocks(history, 1000).map((e) => e.id)).toEqual(['b', 'c']);
    expect(pickNewUnlocks(history, 9999)).toEqual([]);
  });
});

describe('unlockEmbed', () => {
  it('describes the unlock, table and cost', () => {
    const e = unlockEmbed(entry());
    expect(e.title).toBe('🔓 Unlocked Zulrah');
    expect(e.description).toBe('Bosses — spent 1 Key');
  });
  it('labels omni/chaos spends', () => {
    expect(unlockEmbed(entry({ meta: { category: 'Skills', costType: 'specialKey' } })).description)
      .toBe('Skills — spent an Omni-key');
    expect(unlockEmbed(entry({ meta: { category: 'Regions', costType: 'chaosKey' } })).description)
      .toBe('Regions — spent a Chaos key');
  });
  it('survives missing meta', () => {
    expect(unlockEmbed(entry({ meta: undefined })).description).toBe('');
  });
});

describe('config & cursor records', () => {
  it('round-trip and default safely', () => {
    expect(readDiscordConfig('K')).toEqual({ url: '', enabled: false });
    writeDiscordConfig('K', { url: 'https://discord.com/api/webhooks/1/t', enabled: true });
    expect(readDiscordConfig('K').enabled).toBe(true);
    expect(readCursor('K')).toBe(0);
    writeCursor('K', 123);
    expect(readCursor('K')).toBe(123);
  });
});

describe('postEmbeds', () => {
  const URL = 'https://discord.com/api/webhooks/123/tok';

  it('refuses invalid URLs and empty batches without fetching', async () => {
    const f = vi.fn();
    expect(await postEmbeds('https://evil.com/x', [{}], f as any)).toBe(false);
    expect(await postEmbeds(URL, [], f as any)).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });

  it('posts embeds in batches of 10', async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    const embeds = Array.from({ length: MAX_EMBEDS_PER_POST + 2 }, (_, i) => ({ title: String(i) }));
    expect(await postEmbeds(URL, embeds, f as any)).toBe(true);
    expect(f).toHaveBeenCalledTimes(2);
    expect(JSON.parse(f.mock.calls[0][1].body).embeds.length).toBe(MAX_EMBEDS_PER_POST);
    expect(JSON.parse(f.mock.calls[1][1].body).embeds.length).toBe(2);
  });

  it('retries once on 429 using retry_after', async () => {
    vi.useFakeTimers();
    const f = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({ retry_after: 0.01 }) })
      .mockResolvedValueOnce({ ok: true, status: 204 });
    const p = postEmbeds(URL, [{ title: 'x' }], f as any);
    await vi.runAllTimersAsync();
    expect(await p).toBe(true);
    expect(f).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('reports failure but never throws', async () => {
    const f = vi.fn().mockRejectedValue(new Error('offline'));
    expect(await postEmbeds(URL, [{ title: 'x' }], f as any)).toBe(false);
  });
});
