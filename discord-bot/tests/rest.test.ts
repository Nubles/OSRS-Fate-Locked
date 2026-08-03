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

  it('sanitizes malformed successful response bodies', async () => {
    const token = 'test-token-should-not-leak';
    const secret = 'FAKE_SECRET_RESPONSE_BODY_ABC123';
    const client = new DiscordRestClient({
      token,
      fetchImpl: fetchSequence([new Response(`not-json ${secret}`, { status: 200 })]),
    });

    const error = await client.request('GET', '/channels/100000000000000001/messages').catch((error: unknown) => error);

    expect(error).toBeInstanceOf(DiscordApiError);
    expect(error).toMatchObject({ method: 'GET', route: '/channels/:id/messages', status: 200 });
    expect(String(error)).not.toContain(token);
    expect(String(error)).not.toContain(secret);
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
  it('does not retry a forum post after a transient failure', async () => {
    const fetchImpl = fetchSequence([response(500, { message: 'failed' })]);
    const client = new DiscordRestClient({ token: 'test-token', fetchImpl, sleep: async () => undefined });

    await expect(client.createForumPost('100000000000000001', { name: 'journal' })).rejects.toMatchObject({ status: 500 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('edits an interaction original response without exposing its token in errors', async () => {
    const token = 'private-interaction-token';
    const client = new DiscordRestClient({
      token: 'test-token',
      fetchImpl: fetchSequence([response(403, { message: 'not allowed' })]),
      maxRetries: 0,
    });

    const error = await client.editOriginalInteractionResponse('100000000000000001', token, { content: 'hello' }).catch((reason: unknown) => reason);

    expect(error).toMatchObject({ route: '/webhooks/:id/:token/messages/@original' });
    expect(String(error)).not.toContain(token);
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

  it('uses scoped routes for live channel, queue-card, and role-hierarchy reads', async () => {
    const fetchImpl = fetchSequence([
      response(200, { id: '100000000000000001', parent_id: '100000000000000002' }),
      response(200, { id: '100000000000000003', embeds: [] }),
      response(200, [{ id: '100000000000000004', position: 7 }]),
    ]);
    const client = new DiscordRestClient({ token: 'test-token', fetchImpl });

    await expect(client.getChannel('100000000000000001')).resolves.toMatchObject({ parent_id: '100000000000000002' });
    await expect(client.getMessage('100000000000000002', '100000000000000003')).resolves.toMatchObject({ id: '100000000000000003' });
    await expect(client.getGuildRoles('100000000000000004')).resolves.toEqual([{ id: '100000000000000004', position: 7 }]);

    expect(fetchImpl).toHaveBeenNthCalledWith(1,
      'https://discord.com/api/v10/channels/100000000000000001', expect.objectContaining({ method: 'GET' }));
    expect(fetchImpl).toHaveBeenNthCalledWith(2,
      'https://discord.com/api/v10/channels/100000000000000002/messages/100000000000000003', expect.objectContaining({ method: 'GET' }));
    expect(fetchImpl).toHaveBeenNthCalledWith(3,
      'https://discord.com/api/v10/guilds/100000000000000004/roles', expect.objectContaining({ method: 'GET' }));
  });

  it('reads the authenticated bot identity from Discord', async () => {
    const fetchImpl = fetchSequence([response(200, { id: '100000000000000001' })]);
    const client = new DiscordRestClient({ token: 'test-token', fetchImpl });

    await expect(client.getCurrentUser()).resolves.toEqual({ id: '100000000000000001' });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://discord.com/api/v10/users/@me', expect.objectContaining({ method: 'GET' }),
    );
});
});
