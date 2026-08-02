import { describe, expect, it, vi } from 'vitest';
import { DiscordApiError, DiscordRestClient } from '../src/discord/rest.js';

const response = (status: number, body?: unknown, headers?: HeadersInit): Response =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers });

const fetchSequence = (responses: Response[]) => {
  const fetchImpl = vi.fn(async () => {
    const next = responses.shift();
    if (!next) throw new Error('unexpected request');
    return next;
  });
  return fetchImpl as unknown as typeof fetch;
};

describe('DiscordRestClient', () => {
  it('decodes a successful JSON response with Discord headers', async () => {
    const fetchImpl = fetchSequence([response(200, { id: 'message-1' })]);
    const client = new DiscordRestClient({ token: 'test-token', fetchImpl });

    await expect(client.request<{ id: string }>('GET', '/gateway')).resolves.toEqual({ id: 'message-1' });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://discord.com/api/v10/gateway',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          authorization: 'Bot test-token',
          'content-type': 'application/json',
          'user-agent': 'FateLockedDiscordBot/1.0',
        }),
      }),
    );
  });

  it('returns undefined for a no-content response', async () => {
    const client = new DiscordRestClient({ token: 'test-token', fetchImpl: fetchSequence([response(204)]) });

    await expect(client.request<void>('DELETE', '/channels/100000000000000001/messages/100000000000000002')).resolves.toBeUndefined();
  });

  it('waits for a bounded Discord retry_after before retrying a rate-limited request', async () => {
    const sleep = vi.fn(async () => undefined);
    const client = new DiscordRestClient({
      token: 'test-token',
      fetchImpl: fetchSequence([
        response(429, { retry_after: 0.25 }),
        response(200, { id: 'message-1' }),
      ]),
      sleep,
    });

    await expect(client.request('GET', '/channels/100000000000000001/messages')).resolves.toEqual({ id: 'message-1' });
    expect(sleep).toHaveBeenCalledWith(250);
  });

  it('retries transient server failures before returning the successful response', async () => {
    const fetchImpl = fetchSequence([
      response(500, { message: 'first failure' }),
      response(500, { message: 'second failure' }),
      response(200, { ok: true }),
    ]);
    const client = new DiscordRestClient({ token: 'test-token', fetchImpl, sleep: async () => undefined });

    await expect(client.request('POST', '/channels/100000000000000001/messages', { content: 'hello' })).resolves.toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('fails forbidden requests immediately with a sanitized API error', async () => {
    const token = 'super-secret-token';
    const client = new DiscordRestClient({
      token,
      fetchImpl: fetchSequence([response(403, { message: 'secret response content' })]),
    });

    const error = await client.request('GET', '/channels/100000000000000001/messages').catch((error: unknown) => error);

    expect(error).toBeInstanceOf(DiscordApiError);
    expect(error).toMatchObject({ method: 'GET', route: '/channels/:id/messages', status: 403 });
    expect(String(error)).not.toContain(token);
    expect(String(error)).not.toContain('secret response content');
  });

  it('uses a path-only route template in errors from convenience methods', async () => {
    const client = new DiscordRestClient({
      token: 'test-token',
      fetchImpl: fetchSequence([response(403, { message: 'not allowed' })]),
    });

    const error = await client.getChannelMessages('100000000000000001').catch((error: unknown) => error);
    expect(error).toMatchObject({ route: '/channels/:id/messages' });
  });
  it('stops after the configured retry budget', async () => {
    const fetchImpl = fetchSequence([
      response(500, { message: 'one' }),
      response(500, { message: 'two' }),
      response(500, { message: 'three' }),
    ]);
    const client = new DiscordRestClient({ token: 'test-token', fetchImpl, sleep: async () => undefined, maxRetries: 2 });

    await expect(client.request('GET', '/channels/100000000000000001/messages')).rejects.toMatchObject({ status: 500 });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});
