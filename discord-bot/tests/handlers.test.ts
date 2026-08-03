import { createHmac } from 'node:crypto';
import nacl from 'tweetnacl';
import { describe, expect, it, vi } from 'vitest';
import { handleAutomationRequest } from '../src/handlers/automation.js';
import { handleInteractionRequest } from '../src/handlers/interactions.js';
import type { BotConfig } from '../src/types.js';

const json = (value: unknown, status = 200): Response =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const config: BotConfig = {
  applicationId: '100000000000000001',
  publicKey: '',
  botToken: 'test-token-not-a-real-secret',
  guildId: '1533446664709341357',
  channels: {
    announcements: '100000000000000002',
    runJournals: '100000000000000003',
    verificationQueue: '100000000000000004',
    auditLog: '100000000000000005',
    rules: '100000000000000006',
  },
  roles: {
    moderator: '100000000000000007',
    administrator: '100000000000000008',
    fatekeeper: '100000000000000009',
    verifiedRunner: '100000000000000010',
    updates: '100000000000000011',
    weeklySeed: '100000000000000012',
  },
  tags: {
    vanilla: '100000000000000013',
    chunked: '100000000000000014',
    custom: '100000000000000015',
    active: '100000000000000016',
    verified: '100000000000000017',
  },
  componentHmacKey: 'component-key-at-least-32-bytes-long',
  automationHmacKey: 'automation-key-at-least-32-bytes-long',
  allowedRepositories: ['Nubles/OSRS-Fate-Locked'],
  mutationsEnabled: false,
};

const signedInteractionRequest = (body: string, publicKey: Uint8Array, secretKey: Uint8Array): Request => {
  const timestamp = '1700000000';
  const signature = nacl.sign.detached(new TextEncoder().encode(`${timestamp}${body}`), secretKey);
  return new Request('https://example.test/api/interactions', {
    method: 'POST',
    headers: {
      'x-signature-timestamp': timestamp,
      'x-signature-ed25519': Buffer.from(signature).toString('hex'),
    },
    body,
  });
};

describe('handleInteractionRequest', () => {
  it('rejects missing or invalid signatures without invoking the router', async () => {
    const route = vi.fn(async () => json({ routed: true }));
    const missing = new Request('https://example.test/api/interactions', {
      method: 'POST',
      body: '{"type":1}',
    });
    const bad = new Request('https://example.test/api/interactions', {
      method: 'POST',
      headers: {
        'x-signature-timestamp': '1700000000',
        'x-signature-ed25519': '00'.repeat(64),
      },
      body: '{"type":1}',
    });

    await expect(handleInteractionRequest(missing, { config, route })).resolves.toMatchObject({ status: 401 });
    await expect(handleInteractionRequest(bad, { config, route })).resolves.toMatchObject({ status: 401 });
    expect(route).not.toHaveBeenCalled();
  });

  it('returns the Discord PING response after signature verification', async () => {
    const keyPair = nacl.sign.keyPair.fromSeed(new Uint8Array(32).fill(3));
    const requestConfig = { ...config, publicKey: Buffer.from(keyPair.publicKey).toString('hex') };
    const route = vi.fn(async () => json({ routed: true }));
    const response = await handleInteractionRequest(
      signedInteractionRequest('{"type":1}', keyPair.publicKey, keyPair.secretKey),
      { config: requestConfig, route },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ type: 1 });
    expect(route).not.toHaveBeenCalled();
  });

  it('returns an ephemeral response for a non-PING interaction from another guild', async () => {
    const keyPair = nacl.sign.keyPair.fromSeed(new Uint8Array(32).fill(4));
    const requestConfig = { ...config, publicKey: Buffer.from(keyPair.publicKey).toString('hex') };
    const route = vi.fn(async () => json({ routed: true }));
    const response = await handleInteractionRequest(
      signedInteractionRequest('{"type":2,"guild_id":"100000000000000099"}', keyPair.publicKey, keyPair.secretKey),
      { config: requestConfig, route },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      type: 4,
      data: { content: 'This app is only available in Fate Locked Ironman.', flags: 64 },
    });
    expect(route).not.toHaveBeenCalled();
  });
});

  it('rejects a matching wrong guild from a malformed injected config without routing', async () => {
    const wrongGuildId = '100000000000000099';
    const keyPair = nacl.sign.keyPair.fromSeed(new Uint8Array(32).fill(5));
    const malformedConfig = {
      ...config,
      guildId: wrongGuildId,
      publicKey: Buffer.from(keyPair.publicKey).toString('hex'),
    } as unknown as BotConfig;
    const route = vi.fn(async () => json({ routed: true }));
    const response = await handleInteractionRequest(
      signedInteractionRequest(`{"type":2,"guild_id":"${wrongGuildId}"}`, keyPair.publicKey, keyPair.secretKey),
      { config: malformedConfig, route },
    );

    await expect(response.json()).resolves.toEqual({
      type: 4,
      data: { content: 'This app is only available in Fate Locked Ironman.', flags: 64 },
    });
    expect(route).not.toHaveBeenCalled();
  });

describe('handleAutomationRequest', () => {
  const body = '{"repository":"Nubles/OSRS-Fate-Locked","type":"weekly_seed","sentAt":"2023-11-14T22:13:20.000Z"}';
  const timestamp = '1700000000';
  const validSignature = `v1=${createHmac('sha256', config.automationHmacKey)
    .update(`${timestamp}.${body}`)
    .digest('hex')}`;

  it('returns 401 for a bad HMAC', async () => {
    const handleEvent = vi.fn(async () => json({ accepted: true }));
    const request = new Request('https://example.test/api/automation', {
      method: 'POST',
      headers: { 'x-fate-timestamp': timestamp, 'x-fate-signature': 'v1=00' },
      body,
    });

    const response = await handleAutomationRequest(request, { config, handleEvent }, 1_700_000_100);

    expect(response.status).toBe(401);
    expect(handleEvent).not.toHaveBeenCalled();
  });

  it('dispatches a valid automation request exactly once', async () => {
    const handleEvent = vi.fn(async () => json({ accepted: true }, 202));
    const request = new Request('https://example.test/api/automation', {
      method: 'POST',
      headers: { 'x-fate-timestamp': timestamp, 'x-fate-signature': validSignature },
      body,
    });

    const response = await handleAutomationRequest(request, { config, handleEvent }, 1_700_000_100);

    expect(response.status).toBe(202);
    expect(handleEvent).toHaveBeenCalledTimes(1);
  });
});
