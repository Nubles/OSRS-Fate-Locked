import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CHUNK_CONTENT_TIMEOUT_MESSAGE,
  CHUNK_CONTENT_TIMEOUT_MS,
  ChunkContentService,
} from './ChunkContentService';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// A request that never answers, until its signal aborts it.
const stalledFetch = () => vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
  init?.signal?.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')));
}));

describe('chunk content loading', () => {
  it('fails a stalled request so the panels can offer Retry', async () => {
    vi.useFakeTimers();
    const fetch = stalledFetch();
    vi.stubGlobal('fetch', fetch);
    const service = new ChunkContentService();

    const loading = service.init();
    await vi.advanceTimersByTimeAsync(CHUNK_CONTENT_TIMEOUT_MS - 1);
    expect(service.error).toBeNull();
    await vi.advanceTimersByTimeAsync(1);

    expect(await loading).toBe(false);
    expect(service.ready).toBe(false);
    expect(service.error).toBe(CHUNK_CONTENT_TIMEOUT_MESSAGE);

    // Retry starts a fresh request, which can succeed.
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ chunks: {} }) })));
    expect(await service.init()).toBe(true);
    expect(service.ready).toBe(true);
    expect(service.error).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('keeps an HTTP failure as its own message', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })));
    const service = new ChunkContentService();

    expect(await service.init()).toBe(false);
    expect(service.error).toBe('HTTP 503');
  });
});
